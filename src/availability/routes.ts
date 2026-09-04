import type { FastifyInstance } from "fastify";
import {
  CreateBlockInput,
  CreateExceptionInput,
  UpdateBlockInput,
} from "./models.js";
import {
  createBlock,
  createException,
  deleteBlock,
  deleteException,
  listBlocks,
  listExceptions,
  toggleBlock,
  updateBlock,
} from "./service.js";

export async function availabilityRoutes(app: FastifyInstance) {
  // GET /availability -> Listar bloques semanales
  app.get("/", async () => {
    return listBlocks();
  });

  // POST /availability -> Crear un bloque de horario semanal
  app.post("/", async (request, reply) => {
    const body = request.body as CreateBlockInput;
    try {
      const created = await createBlock(body);
      return reply.status(201).send(created);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // PUT /availability/:id -> Modificar horas de un bloque
  app.put("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as UpdateBlockInput;
    try {
      return await updateBlock(id, body);
    } catch (err: any) {
      const status = err.message === "Horario no encontrado" ? 404 : 400;
      return reply.status(status).send({ error: err.message });
    }
  });

  // PATCH /availability/:id/toggle-active -> Activar o pausar un bloque
  app.patch("/:id/toggle-active", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      return await toggleBlock(id);
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }
  });

  // DELETE /availability/:id -> Eliminar un bloque
  app.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await deleteBlock(id);
      return { success: true, id };
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }
  });

  // --------------------------------------------------------------------------
  // EXCEPCIONES DE CALENDARIO (FERIADOS, CIERRES EXTRAORDINARIOS)
  // --------------------------------------------------------------------------

  // GET /availability/exceptions -> Listar excepciones
  app.get("/exceptions", async () => {
    return listExceptions();
  });

  // POST /availability/exceptions -> Crear una excepción
  app.post("/exceptions", async (request, reply) => {
    const body = request.body as CreateExceptionInput;
    try {
      const created = await createException(body);
      return reply.status(201).send(created);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // DELETE /availability/exceptions/:id -> Eliminar excepción
  app.delete("/exceptions/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await deleteException(id);
      return { success: true, id };
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }
  });
}