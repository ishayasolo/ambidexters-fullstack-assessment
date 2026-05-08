import type { BatchStatus, DisbursementStatus } from "@/lib/types";

const BATCH_COLORS: Record<BatchStatus, string> = {
  pending:    "bg-yellow-100 text-yellow-800 border-yellow-200",
  processing: "bg-blue-100 text-blue-800 border-blue-200",
  completed:  "bg-green-100 text-green-800 border-green-200",
  failed:     "bg-red-100 text-red-800 border-red-200",
};

const DISBURSEMENT_COLORS: Record<DisbursementStatus, string> = {
  queued:   "bg-gray-100 text-gray-700 border-gray-200",
  sent:     "bg-blue-100 text-blue-700 border-blue-200",
  cleared:  "bg-green-100 text-green-700 border-green-200",
  failed:   "bg-red-100 text-red-700 border-red-200",
  reversed: "bg-orange-100 text-orange-700 border-orange-200",
};

interface Props {
  status: BatchStatus | DisbursementStatus;
  type: "batch" | "disbursement";
}

export function StatusBadge({ status, type }: Props) {
  const colors =
    type === "batch"
      ? BATCH_COLORS[status as BatchStatus]
      : DISBURSEMENT_COLORS[status as DisbursementStatus];

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border capitalize ${colors}`}
    >
      {status}
    </span>
  );
}
