export type BatchStatus = "pending" | "processing" | "completed" | "failed";
export type DisbursementStatus = "queued" | "sent" | "cleared" | "failed" | "reversed";

export interface Batch {
  id: number;
  name: string;
  created_by: string;
  initiated_at: string;
  total_count: number;
  status: BatchStatus;
}

export interface BatchSummary extends Batch {
  cleared_count: number;
  failed_count: number;
  reversed_count: number;
  sent_count: number;
  queued_count: number;
  cleared_amount: number;
  failed_amount: number;
  reversed_amount: number;
  in_flight_amount: number;
}

export interface Disbursement {
  id: number;
  batch_id: number;
  recipient_name: string;
  account_reference: string;
  amount: number;
  status: DisbursementStatus;
  initiated_at: string;
  settled_at: string | null;
  failure_reason: string | null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}
