import type { FastifyInstance } from "fastify";
import { CreateCustomerInput, UpdateCustomerInput } from "./models.js";
import {
  createCustomer,
  deleteCustomer,
  getCustomerDetail,
  listCustomers,
  updateCustomer,
} from "./service.js";

export async function customerRoutes(app: FastifyInstance) {
  // GET /customers -> Listar clientes activos (con opción de búsqueda)
  app.get("/", async (request) => {
    const { search } = request.query as { search?: string };
    return listCustomers(search);
  });

  // GET /customers/:id -> Detalle del cliente e historial de citas
  app.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      return await getCustomerDetail(id);
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }
  });

  // POST /customers -> Crear nuevo cliente
  app.post("/", async (request, reply) => {
    const body = request.body as CreateCustomerInput;
    try {
      const created = await createCustomer(body);
      return reply.status(201).send(created);
    } catch (err: any) {
      const status = err.message.includes("Ya existe") ? 409 : 400;
      return reply.status(status).send({ error: err.message });
    }
  });

  // PUT /customers/:id -> Modificar datos del cliente
  app.put("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as UpdateCustomerInput;
    try {
      return await updateCustomer(id, body);
    } catch (err: any) {
      const status = err.message === "Cliente no encontrado" ? 404 : 400;
      return reply.status(status).send({ error: err.message });
    }
  });

  // DELETE /customers/:id -> Desactivar cliente (Soft delete)
  app.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await deleteCustomer(id);
      return { success: true, id };
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }
  });
}