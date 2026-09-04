import { pool } from "../database/connection.js";
import { Customer } from "./models.js";

export async function findCustomers(businessId: string, search?: string): Promise<Customer[]> {
  if (search) {
    const like = `%${search}%`;
    const { rows } = await pool.query(
      `SELECT * FROM customer WHERE business_id = $1 AND active = 1 AND (name ILIKE $2 OR phone ILIKE $2) ORDER BY name`,
      [businessId, like]
    );
    return rows;
  }

  const { rows } = await pool.query(
    "SELECT * FROM customer WHERE business_id = $1 AND active = 1 ORDER BY name",
    [businessId]
  );
  return rows;
}

export async function findCustomerById(id: string): Promise<Customer | null> {
  const { rows } = await pool.query("SELECT * FROM customer WHERE id = $1", [id]);
  return rows[0] ?? null;
}

export async function findCustomerWithAppointments(id: string): Promise<{ customer: Customer; appointments: any[] } | null> {
  const customer = await findCustomerById(id);
  if (!customer) return null;

  const appointmentsRes = await pool.query(
    `SELECT a.*, s.name as service_name FROM appointment a
     JOIN service s ON s.id = a.service_id
     WHERE a.customer_id = $1 ORDER BY a.date DESC, a.start_time DESC`,
    [id]
  );

  return { customer, appointments: appointmentsRes.rows };
}

export async function findCustomerByPhone(businessId: string, phone: string): Promise<Customer | null> {
  const { rows } = await pool.query(
    "SELECT * FROM customer WHERE business_id = $1 AND phone = $2",
    [businessId, phone]
  );
  return rows[0] ?? null;
}

export async function insertCustomer(data: {
  id: string;
  businessId: string;
  name?: string | null;
  phone: string;
  notes?: string | null;
}): Promise<Customer> {
  await pool.query(
    `INSERT INTO customer (id, business_id, name, phone, notes) VALUES ($1, $2, $3, $4, $5)`,
    [data.id, data.businessId, data.name ?? null, data.phone, data.notes ?? null]
  );
  const created = await findCustomerById(data.id);
  if (!created) throw new Error("Error creando cliente");
  return created;
}

export async function reactivateCustomer(
  id: string,
  name?: string | null,
  notes?: string | null
): Promise<Customer> {
  await pool.query(
    "UPDATE customer SET active = 1, name = COALESCE($1, name), notes = COALESCE($2, notes) WHERE id = $3",
    [name ?? null, notes ?? null, id]
  );
  const updated = await findCustomerById(id);
  if (!updated) throw new Error("Error reactivando cliente");
  return updated;
}

export async function updateCustomerRecord(
  id: string,
  data: { name?: string | null; phone?: string | null; notes?: string | null }
): Promise<Customer> {
  await pool.query(
    "UPDATE customer SET name = $1, phone = $2, notes = $3 WHERE id = $4",
    [data.name ?? null, data.phone ?? null, data.notes ?? null, id]
  );
  const updated = await findCustomerById(id);
  if (!updated) throw new Error("Cliente no encontrado");
  return updated;
}

export async function softDeleteCustomerRecord(id: string): Promise<void> {
  await pool.query("UPDATE customer SET active = 0 WHERE id = $1", [id]);
}
