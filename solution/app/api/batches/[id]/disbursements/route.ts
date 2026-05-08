import { NextRequest, NextResponse } from "next/server";
import { getBatch, listDisbursements } from "@/lib/db";
import type { PaginatedResponse, Disbursement } from "@/lib/types";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const batchId = parseInt(id, 10);

  if (isNaN(batchId) || batchId < 1) {
    return NextResponse.json({ error: "Invalid batch id" }, { status: 400 });
  }

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
  );
  const status = searchParams.get("status") ?? undefined;

  try {
    const batch = getBatch(batchId);
    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    const { rows, total } = listDisbursements(batchId, page, limit, status);

    const response: PaginatedResponse<Disbursement> = {
      data: rows as Disbursement[],
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error(`[GET /api/batches/${id}/disbursements]`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
