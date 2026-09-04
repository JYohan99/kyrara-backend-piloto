import makeWASocket, {
  DisconnectReason,
  initAuthCreds,
  BufferJSON,
  proto,
  type AuthenticationState,
} from "baileys";
import { Boom } from "@hapi/boom";
import qrcode from "qrcode-terminal";
import pino from "pino";
import { pool } from "../database/connection.js";
import { handleIncomingMessage } from "./engine.js";

const logger = pino({ level: "silent" });

// Guarda la sesión de WhatsApp (equivalente a "dispositivos vinculados")
// directo en Postgres, en vez de en archivos locales — así sobrevive a
// cualquier redeploy en Render, igual que el resto de los datos.
async function usePostgresAuthState(): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}> {
  async function readData(key: string) {
    const res = await pool.query("SELECT value FROM whatsapp_auth WHERE key = $1", [key]);
    if (!res.rows[0]) return null;
    return JSON.parse(res.rows[0].value, BufferJSON.reviver);
  }
  async function writeData(key: string, data: any) {
    const value = JSON.stringify(data, BufferJSON.replacer);
    await pool.query(
      `INSERT INTO whatsapp_auth (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $2`,
      [key, value]
    );
  }
  async function removeData(key: string) {
    await pool.query("DELETE FROM whatsapp_auth WHERE key = $1", [key]);
  }

  const storedCreds = await readData("creds");
  const creds = storedCreds ?? initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data: { [id: string]: any } = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(`${type}-${id}`);
              if (type === "app-state-sync-key" && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            })
          );
          return data;
        },
        set: async (data) => {
          const tasks: Promise<void>[] = [];
          for (const category in data) {
            for (const id in (data as any)[category]) {
              const value = (data as any)[category][id];
              const key = `${category}-${id}`;
              tasks.push(value ? writeData(key, value) : removeData(key));
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: async () => {
      await writeData("creds", creds);
    },
  };
}

let currentSock: any = null;
let latestQR: string | null = null;
let connectionStatus: "open" | "connecting" | "close" = "connecting";

export function getWhatsAppStatus() {
  return {
    status: connectionStatus,
    isRegistered: currentSock?.authState?.creds?.registered ?? false,
    hasQR: Boolean(latestQR),
    qr: latestQR,
  };
}

export async function requestPairingCode(phoneNumber: string): Promise<string> {
  if (!currentSock) {
    throw new Error("El servicio de WhatsApp está iniciándose, intenta de nuevo en unos segundos.");
  }
  if (currentSock.authState?.creds?.registered) {
    throw new Error("WhatsApp ya está vinculado y conectado.");
  }
  const cleanNumber = phoneNumber.replace(/[^0-9]/g, "");
  if (!cleanNumber || cleanNumber.length < 8) {
    throw new Error("El número debe tener al menos 8 dígitos e incluir el código de país (ej. 59899123456).");
  }
  const code = await currentSock.requestPairingCode(cleanNumber);
  return code;
}

export async function restartWhatsApp() {
  if (currentSock) {
    try {
      currentSock.end(undefined);
    } catch {}
  }
  latestQR = null;
  connectionStatus = "connecting";
  return startWhatsApp();
}

export async function logoutWhatsApp() {
  if (currentSock) {
    try {
      await currentSock.logout();
    } catch {}
  }
  await pool.query("DELETE FROM whatsapp_auth");
  latestQR = null;
  connectionStatus = "close";
  return startWhatsApp();
}

export async function startWhatsApp() {
  const { state, saveCreds } = await usePostgresAuthState();

  const sock = makeWASocket({
    auth: state,
    logger,
  });

  currentSock = sock;
  connectionStatus = "connecting";

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      latestQR = qr;
      console.log("\nEscaneá este código QR con WhatsApp (Dispositivos vinculados) en el teléfono del negocio:\n");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      connectionStatus = "close";
      const shouldReconnect =
        (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log(
        "Conexión de WhatsApp cerrada.",
        shouldReconnect ? "Reintentando..." : "Sesión cerrada, hay que volver a escanear el QR o generar código."
      );
      if (shouldReconnect) {
        startWhatsApp();
      } else {
        latestQR = null;
      }
    } else if (connection === "open") {
      connectionStatus = "open";
      latestQR = null;
      console.log("✅ WhatsApp conectado correctamente.");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid!;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

    console.log(`📩 Mensaje de ${from}: "${text}"`);

    try {
      await handleIncomingMessage(sock, from, text);
    } catch (err) {
      console.error("Error procesando mensaje de WhatsApp:", err);
      await sock.sendMessage(from, { text: "Uy, tuvimos un problema. Probá de nuevo en un rato." });
    }
  });

  return sock;
}