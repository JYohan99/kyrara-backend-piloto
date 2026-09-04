export interface Customer {
  id: string;
  business_id: string;
  name: string | null;
  phone: string;
  notes: string | null;
  whatsapp_lid: string | null;
  active: number;
  created_at: string;
}

export interface CreateCustomerInput {
  name?: string;
  phone: string;
  notes?: string;
}

export interface UpdateCustomerInput {
  name?: string;
  phone?: string;
  notes?: string;
}
