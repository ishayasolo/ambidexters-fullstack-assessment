# Transaction Feed

A fullstack transaction dashboard with a REST API and a minimal browser UI.

## Stack

- **Backend**: Node.js + Express
- **Database**: SQLite (via `better-sqlite3`)
- **Frontend**: Vanilla HTML, CSS, JavaScript — no framework

## How to run

**Prerequisites**: Node.js 18+

```bash
# Install dependencies
npm install

# Seed the database with sample data (optional but recommended for testing)
npm run seed

# Start the server
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

The API is available at `http://localhost:3000/transactions`.

## API

### `POST /transactions`

Creates a new transaction.

```json
{
  "amount": 4999,
  "currency": "USD",
  "status": "pending",
  "type": "debit",
  "description": "Vendor payment — AWS"
}
```

- `amount` is in **integer cents** (e.g. 4999 = $49.99). Floats are rejected.
- `status`: `pending` | `completed` | `failed`
- `type`: `debit` | `credit`

Returns `201` on success, `400` on invalid payload.

### `GET /transactions`

Returns a paginated list of transactions.

Query params:
- `status` — filter by status
- `type` — filter by type
- `page` — page number (default: 1)
- `limit` — results per page, max 100 (default: 20)

Filters compose — you can combine `status` and `type` in the same request.

### `GET /transactions/:id`

Returns a single transaction. Returns `404` if not found.

## Assumptions

- Auth is out of scope for this task. In production I'd add JWT middleware at the route level before any handler — the Express middleware chain makes that straightforward to slot in without touching route logic.
- The summary bar on the frontend fetches a separate set of requests to compute totals. At scale this should be a dedicated `/transactions/summary` endpoint that runs aggregation queries on the DB side. I kept it simple here given the task scope.
- SQLite is appropriate for a local assessment. A production version would use PostgreSQL with a connection pool.

## One thing I'd do differently with more time

Add a `GET /transactions/summary` endpoint that returns aggregate totals (total debit amount, total credit amount, count by status) in a single DB query instead of the frontend making multiple requests. The current approach works but doesn't scale and makes unnecessary round trips.
