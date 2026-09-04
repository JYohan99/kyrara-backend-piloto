// ============================================================================
// FUNCIONES AUXILIARES DE TIEMPO Y FECHAS (CENTRALIZADAS)
// ============================================================================

/**
 * Convierte "HH:mm" a minutos totales transcurridos desde las 00:00.
 */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Convierte una cantidad de minutos a formato legible "HH:mm".
 */
export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60).toString().padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Obtiene el día de la semana (0 = Domingo, 1 = Lunes, ..., 6 = Sábado).
 */
export function dayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * Devuelve la fecha actual y los minutos de hoy en la zona horaria indicada.
 */
export function getCurrentDateAndMinutes(timezone: string = "America/Montevideo"): {
  currentDate: string;
  currentMinutes: number;
} {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    return {
      currentDate: `${year}-${month}-${day}`,
      currentMinutes: hour * 60 + minute,
    };
  } catch {
    const now = new Date();
    const currentDate = now.toISOString().slice(0, 10);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return { currentDate, currentMinutes };
  }
}
