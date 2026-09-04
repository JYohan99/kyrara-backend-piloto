import { randomUUID } from "node:crypto";
import { getBusinessId } from "../core/business.js";
import { CreateCustomerInput, Customer, UpdateCustomerInput } from "./models.js";
import {
  findCustomerById,
  findCustomerByPhone,
  findCustomers,
  findCustomerWithAppointments,
  insertCustomer,
  reactivateCustomer,
  softDeleteCustomerRecord,
  updateCustomerRecord,
} from "./repository.js";

export async function listCustomers(search?: string): Promise<Customer[]> {
  const businessId = await getBusinessId();
  if (!businessId) return [];
  return findCustomers(businessId, search);
}

export async function getCustomerDetail(id: string) {
  const result = await findCustomerWithAppointments(id);
  if (!result) throw new Error("Cliente no encontrado");
  return { ...result.customer, appointments: result.appointments };
}

export async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  if (!input.phone) {
    throw new Error("phone es obligatorio");
  }

  const businessId = await getBusinessId();
  if (!businessId) throw new Error("No hay negocio cargado");

  const existing = await findCustomerByPhone(businessId, input.phone);
  if (existing) {
    if (existing.active === 0) {
      return reactivateCustomer(existing.id, input.name, input.notes);
    }
    throw new Error("Ya existe un cliente con ese teléfono");
  }

  const id = randomUUID();
  return insertCustomer({
    id,
    businessId,
    name: input.name,
    phone: input.phone,
    notes: input.notes,
  });
}

export async function updateCustomer(id: string, input: UpdateCustomerInput): Promise<Customer> {
  const existing = await findCustomerById(id);
  if (!existing) throw new Error("Cliente no encontrado");

  return updateCustomerRecord(id, {
    name: input.name !== undefined ? input.name : existing.name,
    phone: input.phone !== undefined ? input.phone : existing.phone,
    notes: input.notes !== undefined ? input.notes : existing.notes,
  });
}

export async function deleteCustomer(id: string): Promise<void> {
  const existing = await findCustomerById(id);
  if (!existing) throw new Error("Cliente no encontrado");
  await softDeleteCustomerRecord(id);
}
