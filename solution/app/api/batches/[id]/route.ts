import { NextRequest, NextResponse } from "next/server";
import { getBatch } from "@/lib/db";
import type { BatchSummary } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const batchId = parseInt(id, 10);

  if (isNaN(batchId) || batchId < 1) {
    return NextResponse.json({ error: "Invalid batch id" }, { status: 400 });
  }

  try {
    const batch = getBatch(batchId);

    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    return NextResponse.json(batch as BatchSummary);
  } catch (err) {
    console.error(`[GET /api/batches/${id}]`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
