export interface Appointment {
  id: string;
  business_id: string;
  customer_id: string;
  service_id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: "PENDING" | "PENDING_APPROVAL" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  created_via: "whatsapp" | "manual";
  approval_expires_at?: string | null;
  created_at: string;
  customer_name?: string;
  customer_phone?: string;
  service_name?: string;
}

export interface AvailableSlotsResult {
  date: string;
  service_id: string;
  duration_minutes: number;
  slots: string[];
}

export interface CreateAppointmentInput {
  customer_id: string;
  service_id: string;
  date: string;
  start_time: string;
  created_via?: "whatsapp" | "manual";
}
