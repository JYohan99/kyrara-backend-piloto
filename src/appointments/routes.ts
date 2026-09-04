import type { FastifyInstance } from "fastify";
import {
  getBusinessProfile,
  setBusinessPushToken,
  updateBusinessProfile,
  updateBusinessSettings,
} from "../core/business.js";
import { sendPushNotification } from "../notifications/firebase.js";
import { listServices } from "../services/service.js";
import { CreateAppointmentInput } from "./models.js";
import {
  bookAppointment,
  calculateAvailableSlots,
  cancelAppointment,
  completeAppointment,
  listAppointmentsForDay,
  respondAppointmentApproval,
  updateAppointment,
} from "./service.js";

// ============================================================================
// DEFINICIÓN DE RUTAS DE CITAS Y CONFIGURACIÓN DEL NEGOCIO
// ============================================================================

export async function appointmentRoutes(app: FastifyInstance) {
  // --------------------------------------------------------------------------
  // GET /appointments -> Listar agenda del día
  // --------------------------------------------------------------------------
  app.get("/", async (request) => {
    const { date } = request.query as { date?: string };
    return listAppointmentsForDay(date);
  });

  // --------------------------------------------------------------------------
  // GET /appointments/available-slots -> Obtener horarios libres disponibles
  // --------------------------------------------------------------------------
  app.get("/available-slots", async (request, reply) => {
    const { date, service_id } = request.query as {
      date?: string;
      service_id?: string;
    };
    if (!date || !service_id) {
      return reply.status(400).send({ error: "date y service_id son obligatorios" });
    }
    try {
      return await calculateAvailableSlots(date, service_id);
    } catch (err: any) {
      const status = err.message.includes("no encontrado") ? 404 : 400;
      return reply.status(status).send({ error: err.message });
    }
  });

  // --------------------------------------------------------------------------
  // POST /appointments -> Crear reserva manual (desde la app)
  // --------------------------------------------------------------------------
  app.post("/", async (request, reply) => {
    const body = request.body as CreateAppointmentInput;
    try {
      const created = await bookAppointment(body);
      return reply.status(201).send(created);
    } catch (err: any) {
      if (err.message.includes("ya no está disponible")) {
        return reply.status(409).send({ error: err.message });
      }
      const status = err.message.includes("no encontrado") ? 404 : 400;
      return reply.status(status).send({ error: err.message });
    }
  });

  // --------------------------------------------------------------------------
  // PATCH /appointments/:id/cancel -> Cancelar una cita existente
  // --------------------------------------------------------------------------
  app.patch("/:id/cancel", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      return await cancelAppointment(id);
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }
  });

  // --------------------------------------------------------------------------
  // PATCH /appointments/:id/complete -> Marcar una cita como completada
  // --------------------------------------------------------------------------
  app.patch("/:id/complete", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      return await completeAppointment(id);
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }
  });

  // --------------------------------------------------------------------------
  // PATCH /appointments/:id -> Actualizar estado genérico de la cita
  // --------------------------------------------------------------------------
  app.patch("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { status?: string };
    try {
      return await updateAppointment(id, body?.status);
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }
  });

  // --------------------------------------------------------------------------
  // POST /appointments/:id/respond -> Aceptar o rechazar cita en modo aprobación
  // --------------------------------------------------------------------------
  app.post("/:id/respond", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { decision } = request.body as { decision: "accept" | "reject" };
    try {
      return await respondAppointmentApproval(id, decision);
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }
  });

  // --------------------------------------------------------------------------
  // PUT /appointments/business -> Actualizar datos generales del negocio
  // --------------------------------------------------------------------------
  app.put("/business", async (request, reply) => {
    const body = request.body as {
      name?: string;
      phone?: string;
      address?: string;
      logo_base64?: string;
    };
    try {
      return await updateBusinessProfile(body);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // --------------------------------------------------------------------------
  // PATCH /appointments/business/settings -> Ajustes de turnos, modo y notificaciones
  // --------------------------------------------------------------------------
  app.patch("/business/settings", async (request, reply) => {
    const body = request.body as {
      slot_step_minutes?: number;
      booking_mode?: "auto" | "approval";
      notify_upcoming_appointments?: boolean | number;
    };
    try {
      return await updateBusinessSettings(body);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // --------------------------------------------------------------------------
  // GET /appointments/business -> Consultar información del negocio y servicios
  // --------------------------------------------------------------------------
  app.get("/business", async () => {
    const business = await getBusinessProfile();
    if (!business) return { error: "No hay negocio cargado todavía" };

    const services = await listServices();
    return { business, services };
  });

  // --------------------------------------------------------------------------
  // POST /appointments/business/push-token -> Registrar token FCM de notificaciones
  // --------------------------------------------------------------------------
  app.post("/business/push-token", async (request, reply) => {
    const { token } = request.body as { token?: string };
    if (!token) return reply.status(400).send({ error: "token es obligatorio" });

    try {
      await setBusinessPushToken(token);
      return { status: "ok", token };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // --------------------------------------------------------------------------
  // POST /appointments/business/test-push -> Enviar alerta de prueba directa al barbero
  // --------------------------------------------------------------------------
  app.post("/business/test-push", async (request, reply) => {
    const business = await getBusinessProfile();
    const token = business?.expo_push_token;

    if (!token) {
      return reply.status(400).send({
        error:
          "No hay ningún teléfono vinculado todavía. Presiona 'Vincular Teléfono' primero.",
      });
    }

    try {
      const result = await sendPushNotification(
        token,
        "💈 Kyrara Barber",
        "¡Notificación de prueba recibida con éxito en tu teléfono!",
        { type: "TEST" }
      );
      return { success: true, message: "Notificación enviada", result };
    } catch (err: any) {
      return reply.status(500).send({
        error: err?.message || "Error enviando notificación push",
      });
    }
  });
}
