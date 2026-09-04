import { pool } from "../database/connection.js";
import { Appointment } from "./models.js";

export async function findAppointmentsByDate(day: string): Promise<Appointment[]> {
  const { rows } = await pool.query(
    `SELECT a.*, c.name as customer_name, c.phone as customer_phone, s.name as service_name
     FROM appointment a
     JOIN customer c ON c.id = a.customer_id
     JOIN service s ON s.id = a.service_id
     WHERE a.date = $1 AND a.status != 'CANCELLED'
     ORDER BY a.start_time`,
    [day]
  );
  return rows;
}

export async function findAppointmentById(id: string): Promise<Appointment | null> {
  const { rows } = await pool.query(
    `SELECT a.*, c.name as customer_name, c.phone as customer_phone, s.name as service_name
     FROM appointment a
     JOIN customer c ON c.id = a.customer_id
     JOIN service s ON s.id = a.service_id
     WHERE a.id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function findBusySlots(
  businessId: string,
  date: string
): Promise<{ start_time: string; end_time: string }[]> {
  const { rows } = await pool.query(
    `SELECT start_time, end_time FROM appointment
     WHERE business_id = $1 AND date = $2 AND status != 'CANCELLED'`,
    [businessId, date]
  );
  return rows;
}

export async function insertAppointmentTransaction(data: {
  id: string;
  businessId: string;
  customerId: string;
  serviceId: string;
  date: string;
  startTime: string;
  endTime: string;
  createdVia: "whatsapp" | "manual";
}): Promise<Appointment> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Verificar colisión concurrente dentro de la transacción
    const conflictRes = await client.query(
      `SELECT id FROM appointment
       WHERE business_id = $1 AND date = $2 AND status != 'CANCELLED'
       AND start_time < $3 AND end_time > $4`,
      [data.businessId, data.date, data.endTime, data.startTime]
    );

    if (conflictRes.rows[0]) {
      await client.query("ROLLBACK");
      throw new Error("El horario ya no está disponible");
    }

    await client.query(
      `INSERT INTO appointment (id, business_id, customer_id, service_id, date, start_time, end_time, status, created_via)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'CONFIRMED', $8)`,
      [
        data.id,
        data.businessId,
        data.customerId,
        data.serviceId,
        data.date,
        data.startTime,
        data.endTime,
        data.createdVia,
      ]
    );

    // Reactivar cliente automáticamente si estaba inactivo
    await client.query(
      "UPDATE customer SET active = 1 WHERE id = $1 AND active = 0",
      [data.customerId]
    );

    await client.query("COMMIT");

    const created = await findAppointmentById(data.id);
    if (!created) throw new Error("Error creando reserva");
    return created;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function updateAppointmentStatusRecord(id: string, status: string): Promise<Appointment> {
  await pool.query("UPDATE appointment SET status = $1 WHERE id = $2", [status, id]);
  const updated = await findAppointmentById(id);
  if (!updated) throw new Error("Reserva no encontrada");
  return updated;
}
