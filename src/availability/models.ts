export interface AvailabilityBlock {
  id: string;
  business_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  active: number;
}

export interface AvailabilityException {
  id: string;
  business_id: string;
  date: string;
  closed_all_day: number;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
}

export interface CreateBlockInput {
  day_of_week?: number;
  start_time?: string;
  end_time?: string;
}

export interface UpdateBlockInput {
  start_time?: string;
  end_time?: string;
}

export interface CreateExceptionInput {
  date?: string;
  closed_all_day?: number | boolean;
  start_time?: string | null;
  end_time?: string | null;
  reason?: string | null;
}
