import type { FastifyInstance } from "fastify";
import QRCode from "qrcode";
import {
  getWhatsAppStatus,
  requestPairingCode,
  logoutWhatsApp,
  restartWhatsApp,
} from "./connection.js";

export async function whatsappRoutes(app: FastifyInstance) {
  // Estado actual de la conexión de WhatsApp
  app.get("/status", async () => {
    return getWhatsAppStatus();
  });

  // Imagen PNG directa del código QR actual
  app.get("/qr", async (request, reply) => {
    const status = getWhatsAppStatus();
    if (!status.qr) {
      if (status.status === "open") {
        return reply.status(400).send({ error: "WhatsApp ya está conectado." });
      }
      return reply.status(404).send({ error: "Generando código QR, intenta de nuevo en unos segundos." });
    }

    try {
      const buffer = await QRCode.toBuffer(status.qr, {
        margin: 2,
        scale: 8,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });
      reply.header("Content-Type", "image/png");
      reply.header("Cache-Control", "no-cache, no-store, must-revalidate");
      return reply.send(buffer);
    } catch (err: any) {
      return reply.status(500).send({ error: "Error generando imagen QR", detail: err.message });
    }
  });

  // Generar código de vinculación de 8 dígitos (Pairing Code)
  app.post("/pairing-code", async (request, reply) => {
    const body = request.body as { phone?: string };
    if (!body?.phone) {
      return reply.status(400).send({ error: "Debes ingresar un número de teléfono con código de país." });
    }

    try {
      const code = await requestPairingCode(body.phone);
      return { success: true, code, phone: body.phone };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || "Error solicitando código de vinculación." });
    }
  });

  // Desvincular / Cerrar sesión para volver a vincular desde cero
  app.post("/logout", async () => {
    await logoutWhatsApp();
    return { success: true, message: "Sesión eliminada. Se ha reiniciado el proceso de vinculación." };
  });

  // Reiniciar el socket
  app.post("/restart", async () => {
    await restartWhatsApp();
    return { success: true, message: "Socket de WhatsApp reiniciado." };
  });

  // Página web visual interactiva para vincular fácilmente
  app.get("/connect", async (request, reply) => {
    reply.header("Content-Type", "text/html; charset=utf-8");
    return reply.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vincular WhatsApp — Kyrara</title>
  <style>
    :root {
      --bg: #0d1117;
      --card: #161b22;
      --border: #30363d;
      --primary: #238636;
      --primary-hover: #2ea043;
      --accent: #58a6ff;
      --text: #c9d1d9;
      --text-white: #ffffff;
      --danger: #da3633;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body { background-color: var(--bg); color: var(--text); padding: 24px 16px; display: flex; justify-content: center; min-height: 100vh; }
    .container { max-width: 680px; width: 100%; }
    .header { text-align: center; margin-bottom: 24px; }
    .header h1 { color: var(--text-white); font-size: 26px; margin-bottom: 8px; }
    .badge { display: inline-block; padding: 6px 14px; border-radius: 20px; font-size: 14px; font-weight: 600; margin-top: 6px; }
    .badge.connected { background: rgba(35, 134, 54, 0.2); color: #3fb950; border: 1px solid #238636; }
    .badge.waiting { background: rgba(210, 153, 34, 0.2); color: #d29922; border: 1px solid #9e6a03; }
    .badge.disconnected { background: rgba(218, 54, 51, 0.2); color: #f85149; border: 1px solid #da3633; }
    
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
    .card h2 { font-size: 18px; color: var(--text-white); margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
    .desc { font-size: 14px; color: #8b949e; margin-bottom: 16px; line-height: 1.5; }
    
    .input-group { display: flex; gap: 10px; margin-bottom: 16px; }
    input[type="text"] { flex: 1; padding: 12px 14px; background: #0d1117; border: 1px solid var(--border); border-radius: 8px; color: #fff; font-size: 15px; outline: none; }
    input[type="text"]:focus { border-color: var(--accent); }
    button { padding: 12px 20px; background: var(--primary); color: #fff; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
    button:hover { background: var(--primary-hover); }
    button.btn-danger { background: var(--danger); }
    button.btn-danger:hover { background: #b62324; }
    button:disabled { opacity: 0.6; cursor: not-allowed; }

    .code-box { display: none; text-align: center; background: #0d1117; border: 2px dashed #238636; border-radius: 10px; padding: 20px; margin-top: 14px; }
    .code-box.show { display: block; }
    .code-val { font-size: 32px; letter-spacing: 6px; font-weight: 800; color: #3fb950; font-family: monospace; user-select: all; }
    
    .steps { margin-top: 14px; font-size: 13px; color: #8b949e; line-height: 1.6; }
    .steps ol { padding-left: 20px; }
    
    .qr-container { text-align: center; padding: 16px 0; }
    .qr-img { width: 280px; height: 280px; border-radius: 10px; background: #fff; padding: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.5); }
    .actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 12px; }
    .reload-text { font-size: 12px; color: #8b949e; text-align: center; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Kyrara WhatsApp Engine</h1>
      <div id="statusBadge" class="badge waiting">Comprobando estado...</div>
    </div>

    <!-- SECCIÓN CONECTADO -->
    <div id="connectedCard" class="card" style="display:none; text-align: center;">
      <h2 style="justify-content: center; color: #3fb950;">✅ WhatsApp Conectado y Activo</h2>
      <p class="desc" style="margin-top: 8px;">El bot está escuchando mensajes y procesando reservas correctamente.</p>
      <div style="margin-top: 20px;">
        <button onclick="logout()" class="btn-danger">Cerrar Sesión / Desvincular</button>
      </div>
    </div>

    <!-- SECCIÓN DESCONECTADO -->
    <div id="disconnectedSection">
      <!-- OPCIÓN 1: CÓDIGO DE 8 DÍGITOS (PAIRING CODE) -->
      <div class="card">
        <h2>⚡ Método 1: Código de 8 Dígitos (Sin Cámara)</h2>
        <p class="desc">Ingresa el número de teléfono con código de país (ej. <strong>59899123456</strong> para Uruguay o <strong>54911...</strong> para Argentina) para generar un código numérico y vincular directamente en la app de WhatsApp.</p>
        <div class="input-group">
          <input type="text" id="phoneInput" placeholder="Ej: 59899123456" />
          <button id="pairingBtn" onclick="generatePairingCode()">Generar Código</button>
        </div>
        <div id="codeResult" class="code-box">
          <div style="font-size: 13px; color: #8b949e; margin-bottom: 6px;">CÓDIGO DE VINCULACIÓN:</div>
          <div id="pairingCodeDisplay" class="code-val">----</div>
          <div class="steps">
            <ol>
              <li>En tu celular abre WhatsApp > toca los <strong>3 puntos (Ajustes)</strong> > <strong>Dispositivos vinculados</strong>.</li>
              <li>Toca <strong>Vincular un dispositivo</strong>.</li>
              <li>Abajo en letras pequeñas toca <strong>"Vincular con el número de teléfono"</strong>.</li>
              <li>Ingresa el código que ves arriba.</li>
            </ol>
          </div>
        </div>
      </div>

      <!-- OPCIÓN 2: CÓDIGO QR VISUAL DE ALTA RESOLUCIÓN -->
      <div class="card">
        <h2>📷 Método 2: Escanear Código QR Nítido</h2>
        <p class="desc">Abre WhatsApp en tu teléfono, ve a <strong>Dispositivos vinculados > Vincular dispositivo</strong> y escanea esta imagen directamente desde tu pantalla:</p>
        <div class="qr-container">
          <img id="qrImage" class="qr-img" src="/whatsapp/qr" alt="Código QR WhatsApp" onerror="handleQRError()" />
          <div class="reload-text">Esta imagen se actualiza automáticamente cada 15 segundos.</div>
        </div>
        <div class="actions" style="justify-content: center;">
          <button onclick="refreshQR()" style="background: #21262d; border: 1px solid var(--border);">🔄 Recargar QR</button>
        </div>
      </div>
    </div>
  </div>

  <script>
    async function checkStatus() {
      try {
        const res = await fetch('/whatsapp/status');
        const data = await res.json();
        const badge = document.getElementById('statusBadge');
        const connectedCard = document.getElementById('connectedCard');
        const disconnectedSection = document.getElementById('disconnectedSection');

        if (data.status === 'open') {
          badge.className = 'badge connected';
          badge.textContent = '🟢 Conectado';
          connectedCard.style.display = 'block';
          disconnectedSection.style.display = 'none';
        } else if (data.hasQR) {
          badge.className = 'badge waiting';
          badge.textContent = '🟡 Esperando vinculación';
          connectedCard.style.display = 'none';
          disconnectedSection.style.display = 'block';
        } else {
          badge.className = 'badge disconnected';
          badge.textContent = '🔴 Inicializando...';
          connectedCard.style.display = 'none';
          disconnectedSection.style.display = 'block';
        }
      } catch (err) {}
    }

    async function generatePairingCode() {
      const input = document.getElementById('phoneInput');
      const phone = input.value.trim();
      const btn = document.getElementById('pairingBtn');
      const box = document.getElementById('codeResult');
      const display = document.getElementById('pairingCodeDisplay');

      if (!phone) {
        alert('Por favor ingresa un número de teléfono válido.');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Generando...';

      try {
        const res = await fetch('/whatsapp/pairing-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone }),
        });
        const data = await res.json();
        if (data.code) {
          display.textContent = data.code;
          box.classList.add('show');
        } else {
          alert('Error: ' + (data.error || 'No se pudo generar el código.'));
        }
      } catch (err) {
        alert('Error de conexión con el servidor.');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Generar Código';
      }
    }

    function refreshQR() {
      const img = document.getElementById('qrImage');
      img.src = '/whatsapp/qr?t=' + Date.now();
    }

    function handleQRError() {
      setTimeout(refreshQR, 3000);
    }

    async function logout() {
      if (!confirm('¿Seguro que deseas desconectar WhatsApp?')) return;
      await fetch('/whatsapp/logout', { method: 'POST' });
      setTimeout(checkStatus, 1500);
    }

    // Comprobar estado cada 5 segundos
    checkStatus();
    setInterval(checkStatus, 5000);
    // Recargar imagen QR cada 15 segundos
    setInterval(refreshQR, 15000);
  </script>
</body>
</html>`);
  });
}
