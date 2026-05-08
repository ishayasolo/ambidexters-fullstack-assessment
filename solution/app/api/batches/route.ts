import { NextRequest, NextResponse } from "next/server";
import { listBatches } from "@/lib/db";
import type { PaginatedResponse, BatchSummary } from "@/lib/types";

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
  );

  try {
    const { rows, total } = listBatches(page, limit);

    const response: PaginatedResponse<BatchSummary> = {
      data: rows as BatchSummary[],
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[GET /api/batches]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
