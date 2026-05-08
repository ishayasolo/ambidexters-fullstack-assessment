import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { FinancialSummary } from "@/components/FinancialSummary";
import { formatKobo, formatDate } from "@/lib/format";
import type {
  BatchSummary,
  Disbursement,
  DisbursementStatus,
  PaginatedResponse,
} from "@/lib/types";

const DISBURSEMENT_STATUSES: DisbursementStatus[] = [
  "queued",
  "sent",
  "cleared",
  "failed",
  "reversed",
];

interface PageParams {
  id: string;
}

interface SearchParams {
  page?: string;
  status?: string;
}

async function fetchBatch(id: string): Promise<BatchSummary | null> {
  const res = await fetch(`http://localhost:3000/api/batches/${id}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch batch");
  return res.json();
}

async function fetchDisbursements(
  id: string,
  page: number,
  status?: string
): Promise<PaginatedResponse<Disbursement>> {
  const params = new URLSearchParams({
    page: String(page),
    limit: "25",
  });
  if (status) params.set("status", status);

  const res = await fetch(
    `http://localhost:3000/api/batches/${id}/disbursements?${params}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Failed to fetch disbursements");
  return res.json();
}

export default async function BatchDetailPage({
  params,
  searchParams,
}: {
  params: Promise<PageParams>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const { page: pageParam, status: statusParam } = await searchParams;

  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const statusFilter =
    statusParam && DISBURSEMENT_STATUSES.includes(statusParam as DisbursementStatus)
      ? statusParam
      : undefined;

  const [batch, disbursementsResult] = await Promise.all([
    fetchBatch(id),
    fetchDisbursements(id, page, statusFilter),
  ]);

  if (!batch) notFound();

  const { data: disbursements, pagination } = disbursementsResult;

  function buildUrl(overrides: Partial<SearchParams>) {
    const p = new URLSearchParams();
    const merged = { page: String(page), status: statusFilter, ...overrides };
    if (merged.page && merged.page !== "1") p.set("page", merged.page);
    if (merged.status) p.set("status", merged.status);
    const qs = p.toString();
    return `/batches/${id}${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
        >
          ← All batches
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">{batch.name}</h2>
            <p className="mt-1 text-sm text-gray-500">
              Created by {batch.created_by} · {formatDate(batch.initiated_at)}
            </p>
          </div>
          <StatusBadge status={batch.status} type="batch" />
        </div>
      </div>

      {/* Financial summary */}
      <FinancialSummary batch={batch} />

      {/* Progress bar */}
      {batch.total_count > 0 && (
        <ProgressBar batch={batch} />
      )}

      {/* Disbursements table */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold text-gray-800">
            Disbursements
            <span className="ml-2 text-sm font-normal text-gray-400">
              ({pagination.total.toLocaleString()} shown)
            </span>
          </h3>
          {/* Status filter */}
          <div className="flex flex-wrap gap-1.5">
            <Link
              href={buildUrl({ status: undefined, page: "1" })}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                !statusFilter
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-400"
              }`}
            >
              All
            </Link>
            {DISBURSEMENT_STATUSES.map((s) => (
              <Link
                key={s}
                href={buildUrl({ status: s, page: "1" })}
                className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors ${
                  statusFilter === s
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-400"
                }`}
              >
                {s}
              </Link>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Recipient</th>
                <th className="px-4 py-3 text-left">Account</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Initiated</th>
                <th className="px-4 py-3 text-left">Settled</th>
                <th className="px-4 py-3 text-left">Failure reason</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {disbursements.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-sm text-gray-400"
                  >
                    No disbursements match the current filter.
                  </td>
                </tr>
              ) : (
                disbursements.map((d) => (
                  <tr
                    key={d.id}
                    className={`hover:bg-gray-50 ${
                      d.status === "failed" ? "bg-red-50/30" : ""
                    }`}
                  >
                    <td className="px-4 py-2.5 font-medium text-gray-900">
                      {d.recipient_name}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-500">
                      {d.account_reference}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatKobo(d.amount)}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={d.status} type="disbursement" />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">
                      {formatDate(d.initiated_at)}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">
                      {d.settled_at ? formatDate(d.settled_at) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-red-600">
                      {d.failure_reason ?? ""}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.total_pages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
            <span>
              Page {pagination.page} of {pagination.total_pages} ·{" "}
              {pagination.total.toLocaleString()} total
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={buildUrl({ page: String(page - 1) })}
                  className="rounded border bg-white px-3 py-1.5 hover:bg-gray-50"
                >
                  Previous
                </Link>
              )}
              {page < pagination.total_pages && (
                <Link
                  href={buildUrl({ page: String(page + 1) })}
                  className="rounded border bg-white px-3 py-1.5 hover:bg-gray-50"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProgressBar({ batch }: { batch: BatchSummary }) {
  const total = batch.total_count;
  const clearedPct = Math.round((batch.cleared_count / total) * 100);
  const sentPct = Math.round((batch.sent_count / total) * 100);
  const failedPct = Math.round((batch.failed_count / total) * 100);
  const reversedPct = Math.round((batch.reversed_count / total) * 100);

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
        <span className="font-medium text-gray-700">Batch progress</span>
        <span>
          {(
            batch.cleared_count +
            batch.failed_count +
            batch.reversed_count
          ).toLocaleString()}{" "}
          / {total.toLocaleString()} terminal
        </span>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full bg-gray-100">
        <div
          className="bg-green-500 transition-all"
          style={{ width: `${clearedPct}%` }}
          title={`Cleared: ${batch.cleared_count}`}
        />
        <div
          className="bg-blue-400 transition-all"
          style={{ width: `${sentPct}%` }}
          title={`Sent: ${batch.sent_count}`}
        />
        <div
          className="bg-red-400 transition-all"
          style={{ width: `${failedPct}%` }}
          title={`Failed: ${batch.failed_count}`}
        />
        <div
          className="bg-orange-400 transition-all"
          style={{ width: `${reversedPct}%` }}
          title={`Reversed: ${batch.reversed_count}`}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
          Cleared {batch.cleared_count}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-blue-400" />
          In flight {batch.sent_count}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
          Failed {batch.failed_count}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-orange-400" />
          Reversed {batch.reversed_count}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-gray-300" />
          Queued {batch.queued_count}
        </span>
      </div>
    </div>
  );
}
