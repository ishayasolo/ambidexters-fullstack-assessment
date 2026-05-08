import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { formatKobo, formatDate } from "@/lib/format";
import type { BatchSummary, PaginatedResponse } from "@/lib/types";

interface SearchParams {
  page?: string;
}

async function fetchBatches(page: number): Promise<PaginatedResponse<BatchSummary>> {
  const res = await fetch(
    `http://localhost:3000/api/batches?page=${page}&limit=20`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Failed to fetch batches");
  return res.json();
}

function urgencyScore(b: BatchSummary): number {
  if (b.status === "completed" && b.failed_count > 0) {
    return b.failed_count * 1000 + (b.cleared_count + b.failed_count);
  }
  return 0;
}

export default async function BatchListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const { data: batches, pagination } = await fetchBatches(page);

  const sorted = [...batches].sort((a, b) => urgencyScore(b) - urgencyScore(a));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Batches</h2>
          <p className="mt-1 text-sm text-gray-500">
            {pagination.total} batch{pagination.total !== 1 ? "es" : ""} total
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Batch</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Payments</th>
              <th className="px-4 py-3 text-right">Cleared</th>
              <th className="px-4 py-3 text-right">In Flight</th>
              <th className="px-4 py-3 text-right">Failed</th>
              <th className="px-4 py-3 text-left">Initiated</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sorted.map((batch) => {
              const isUrgent =
                batch.status === "completed" && batch.failed_count > 0;
              return (
                <tr
                  key={batch.id}
                  className={`transition-colors hover:bg-gray-50 ${
                    isUrgent ? "bg-red-50/40" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/batches/${batch.id}`}
                      className="font-medium text-gray-900 hover:text-blue-600 hover:underline"
                    >
                      {batch.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-gray-400">
                      by {batch.created_by}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={batch.status} type="batch" />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                    {batch.total_count.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-green-700">
                    {batch.cleared_amount > 0 ? formatKobo(batch.cleared_amount) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-blue-700">
                    {batch.in_flight_amount > 0
                      ? formatKobo(batch.in_flight_amount)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {batch.failed_count > 0 ? (
                      <span className="tabular-nums font-medium text-red-600">
                        {batch.failed_count.toLocaleString()} ({formatKobo(batch.failed_amount)})
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {formatDate(batch.initiated_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pagination.total_pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
          <span>
            Page {pagination.page} of {pagination.total_pages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/?page=${page - 1}`}
                className="rounded border bg-white px-3 py-1.5 hover:bg-gray-50"
              >
                Previous
              </Link>
            )}
            {page < pagination.total_pages && (
              <Link
                href={`/?page=${page + 1}`}
                className="rounded border bg-white px-3 py-1.5 hover:bg-gray-50"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
