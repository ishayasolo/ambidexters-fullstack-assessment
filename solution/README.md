# Disbursement Operations Dashboard

## How to run locally

```bash
cd solution
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The SQLite database (`disbursements.db`) is created automatically on first run and pre-seeded with six batches in varied states. To reset and reseed, delete the file and restart:

```bash
rm disbursements.db && npm run dev
```

---

## Data contract

### `GET /api/batches`

Returns a paginated list of batches with financial summaries computed at the database layer.

**Query parameters:**

| Param   | Default | Max | Description      |
|---------|---------|-----|------------------|
| `page`  | `1`     | —   | Page number      |
| `limit` | `20`    | `50`| Results per page |

**Response:**

```json
{
  "data": [
    {
      "id": 1,
      "name": "May 2026 Payroll Run",
      "created_by": "finance@ambidexters.io",
      "initiated_at": "2026-05-08T08:00:00.000Z",
      "total_count": 120,
      "status": "completed",
      "cleared_count": 100,
      "failed_count": 15,
      "reversed_count": 5,
      "sent_count": 0,
      "queued_count": 0,
      "cleared_amount": 1500000000,
      "failed_amount": 225000000,
      "reversed_amount": 75000000,
      "in_flight_amount": 0
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 6,
    "total_pages": 1
  }
}
```

All `*_amount` fields are in **kobo (integer)**. `status` is derived at query time — not stored.

---

### `GET /api/batches/:id`

Returns a single batch with the same shape as a `data` item above. Returns `404` if not found.

---

### `GET /api/batches/:id/disbursements`

Returns a paginated, optionally filtered list of disbursements for a batch.

**Query parameters:**

| Param    | Default | Max  | Description                                                          |
|----------|---------|------|----------------------------------------------------------------------|
| `page`   | `1`     | —    | Page number                                                          |
| `limit`  | `25`    | `100`| Results per page                                                     |
| `status` | —       | —    | Filter: `queued`, `sent`, `cleared`, `failed`, `reversed`            |

`limit` is always capped server-side regardless of what the client sends — the API will never return an unbounded result set.

**Response:**

```json
{
  "data": [
    {
      "id": 42,
      "batch_id": 1,
      "recipient_name": "Adaeze Okafor",
      "account_reference": "04410000000001",
      "amount": 17500000,
      "status": "cleared",
      "initiated_at": "2026-05-08T07:58:00.000Z",
      "settled_at": "2026-05-08T08:58:00.000Z",
      "failure_reason": null
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 120,
    "total_pages": 5
  }
}
```

`failure_reason` is non-null only when `status` is `"failed"`. `settled_at` is non-null for `cleared`, `failed`, and `reversed` disbursements.

---

## Decision: what counts as "total disbursed"?

**I defined "total disbursed" as cleared-only** — money that has definitively settled.

The reasoning: this is a reconciliation tool, not a cash-flow forecast. An ops team's job is to verify that money landed, and the only number they can defend is one where settlement is confirmed. Cleared-only gives them that. In-flight (sent) amounts are shown separately as a distinct "In flight" figure so cash-flow visibility is preserved — ops gets both signals without conflating them.

Using cleared + sent as the headline would also produce confusing results on a live batch: the "total disbursed" figure would shrink as sent payments resolve to failed, which violates the intuition that disbursed means done.

This definition is applied consistently across every surface: the batch list table, the batch detail financial summary, and the API response fields.

---

## Assumptions

- **Kobo amounts are always positive integers.** The schema enforces `amount > 0 CHECK` and stores `INTEGER NOT NULL`. No float arithmetic anywhere in the codebase.
- **Batch status is derived at query time.** There is no `status` column on `batches`. The single exception is `pre_failed` (a boolean flag) which marks a batch that was rejected before any disbursement began — the only state that cannot be inferred from disbursement statuses alone.
- **Account references are opaque strings**, stored as provided. NUBAN validation is out of scope.
- **Timestamps are ISO 8601 strings** in UTC. SQLite has no native datetime type; this keeps them unambiguous and sortable.
- **Single process, single writer.** WAL mode handles read concurrency; no distributed locking is needed for an internal ops tool.

---

## One thing I'd do differently with more time

I'd make the batch detail page live-refreshing during active processing runs. Right now ops staff must manually reload to see progress advance. A lightweight polling mechanism (or server-sent events on the batch status + counts) would make in-progress batches feel alive and give the team a real-time view without leaving the page.
