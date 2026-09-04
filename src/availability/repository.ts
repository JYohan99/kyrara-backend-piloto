import { pool } from "../database/connection.js";
import { AvailabilityBlock, AvailabilityException } from "./models.js";

export async function findBlocksByBusinessId(businessId: string): Promise<AvailabilityBlock[]> {
  const { rows } = await pool.query(
    "SELECT * FROM availability WHERE business_id = $1 ORDER BY day_of_week, start_time",
    [businessId]
  );
  return rows;
}

export async function findBlockById(id: string): Promise<AvailabilityBlock | null> {
  const { rows } = await pool.query("SELECT * FROM availability WHERE id = $1", [id]);
  return rows[0] ?? null;
}

export async function insertBlockRecord(data: {
  id: string;
  businessId: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}): Promise<AvailabilityBlock> {
  await pool.query(
    `INSERT INTO availability (id, business_id, day_of_week, start_time, end_time, active)
     VALUES ($1, $2, $3, $4, $5, 1)`,
    [data.id, data.businessId, data.day_of_week, data.start_time, data.end_time]
  );
  const created = await findBlockById(data.id);
  if (!created) throw new Error("Error creando bloque de disponibilidad");
  return created;
}

export async function updateBlockRecord(
  id: string,
  start_time: string,
  end_time: string
): Promise<AvailabilityBlock> {
  await pool.query(
    "UPDATE availability SET start_time = $1, end_time = $2 WHERE id = $3",
    [start_time, end_time, id]
  );
  const updated = await findBlockById(id);
  if (!updated) throw new Error("Horario no encontrado");
  return updated;
}

export async function toggleBlockActiveRecord(
  id: string,
  newActive: number
): Promise<AvailabilityBlock> {
  await pool.query("UPDATE availability SET active = $1 WHERE id = $2", [newActive, id]);
  const updated = await findBlockById(id);
  if (!updated) throw new Error("Horario no encontrado");
  return updated;
}

export async function deleteBlockRecord(id: string): Promise<void> {
  await pool.query("DELETE FROM availability WHERE id = $1", [id]);
}

// ----------------------------------------------------------------------------
// EXCEPCIONES DE CALENDARIO
// ----------------------------------------------------------------------------

export async function findExceptionsByBusinessId(businessId: string): Promise<AvailabilityException[]> {
  const { rows } = await pool.query(
    "SELECT * FROM availability_exception WHERE business_id = $1 ORDER BY date",
    [businessId]
  );
  return rows;
}

export async function findExceptionById(id: string): Promise<AvailabilityException | null> {
  const { rows } = await pool.query("SELECT * FROM availability_exception WHERE id = $1", [id]);
  return rows[0] ?? null;
}

export async function insertExceptionRecord(data: {
  id: string;
  businessId: string;
  date: string;
  closed_all_day: number;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
}): Promise<AvailabilityException> {
  await pool.query(
    `INSERT INTO availability_exception (id, business_id, date, closed_all_day, start_time, end_time, reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      data.id,
      data.businessId,
      data.date,
      data.closed_all_day,
      data.start_time,
      data.end_time,
      data.reason,
    ]
  );
  const created = await findExceptionById(data.id);
  if (!created) throw new Error("Error creando excepción");
  return created;
}

export async function deleteExceptionRecord(id: string): Promise<void> {
  await pool.query("DELETE FROM availability_exception WHERE id = $1", [id]);
}
