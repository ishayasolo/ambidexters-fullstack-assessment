import type { BatchSummary } from "@/lib/types";
import { formatKobo } from "@/lib/format";

interface Props {
  batch: BatchSummary;
}

function Stat({
  label,
  amount,
  count,
  colorClass,
}: {
  label: string;
  amount: number;
  count: number;
  colorClass: string;
}) {
  return (
    <div className={`rounded-lg border p-4 ${colorClass}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{formatKobo(amount)}</p>
      <p className="mt-0.5 text-sm opacity-60">{count.toLocaleString()} payment{count !== 1 ? "s" : ""}</p>
    </div>
  );
}

export function FinancialSummary({ batch }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat
        label="Cleared"
        amount={batch.cleared_amount}
        count={batch.cleared_count}
        colorClass="bg-green-50 border-green-200 text-green-900"
      />
      <Stat
        label="In flight"
        amount={batch.in_flight_amount}
        count={batch.sent_count}
        colorClass="bg-blue-50 border-blue-200 text-blue-900"
      />
      <Stat
        label="Failed"
        amount={batch.failed_amount}
        count={batch.failed_count}
        colorClass="bg-red-50 border-red-200 text-red-900"
      />
      <Stat
        label="Reversed"
        amount={batch.reversed_amount}
        count={batch.reversed_count}
        colorClass="bg-orange-50 border-orange-200 text-orange-900"
      />
    </div>
  );
}
