# Task — Disbursement Operations Dashboard

## Context

Ambidexters runs a payment infrastructure layer that handles bulk disbursements on behalf of enterprise clients — payroll runs, vendor settlements, and agent commissions. The operations team currently monitors disbursement progress through direct database queries, which means only engineers can answer questions like "how much of Monday's payroll actually cleared?" Your job is to build the internal tool that changes that.

## The data

The platform tracks disbursements in two layers.

A **batch** represents a single disbursement run — a named group of payments initiated together. Each batch has a name, the identity of who created it, a timestamp for when it was initiated, a count of how many disbursements it contains, and an overall status. Batch status is derived: a batch is pending while payments are being queued, processing while at least one payment is in flight, completed when every payment has reached a terminal state, and failed if the entire batch was rejected before processing began.

Each **disbursement** belongs to a batch. It has a recipient name, an account reference, an amount in kobo (always an integer — never a decimal), a current status, and timestamps for when it was initiated and when it settled. Status moves through: queued → sent → cleared or failed or reversed. A failed disbursement carries a reason — a short string describing what went wrong (insufficient funds, invalid account, bank timeout, etc.).

## What the user needs

Operations staff need to:

- See all batches at a glance and understand which ones need attention — a batch that finished an hour ago with 40 failures is more urgent than one that is still processing normally.
- Drill into any batch and see the full picture of its disbursements — what cleared, what failed, what is still in flight, and why failures happened.
- Understand the financial weight of a batch — not just counts, but how much money moved successfully and how much did not.
- Filter disbursements within a batch by status so they can focus on failures without scrolling through hundreds of cleared rows.

## The open question

When showing the financial summary for a batch, there is a question about what "total disbursed" means. Cleared disbursements are settled — the money has landed. Sent disbursements are in flight — the instruction has left but settlement is not confirmed. Some ops teams want the conservative figure (cleared only) so the number reflects what is definitively done. Others want the broader figure (cleared + sent) for cash flow visibility.

A decision is required. Implement consistently across every surface that shows financial totals, and document your reasoning in the README.

## Deliverables

- All your work goes inside the `solution/` directory in this repo
- A `README.md` inside `solution/` covering:
  - How to run it locally (exact commands)
  - The data contract you designed — document every endpoint, what it accepts, and what it returns
  - The decision you made on the open question, and why
  - Assumptions you made
  - One thing you'd do differently with more time
- Seed data that makes the app immediately useful to a reviewer — multiple batches in different states, a realistic mix of cleared and failed disbursements, and at least one batch with more than one page of disbursements

## Constraints

- Amounts must be stored and computed as integer kobo at every layer — never convert to a float at any point in your code or database
- Batch financial summaries (total cleared, total failed, total in flight) must be computed at the data layer — do not fetch all disbursements and sum them in application memory or on the client
- All list endpoints must be paginated server-side — the API must refuse to return an unbounded result set regardless of what the client requests

Note: CSV export of a batch's disbursements for bank reconciliation is on the roadmap but out of scope for this sprint. Complete the core experience first. If you have capacity after that, explore it — but a polished core beats a half-built extension.

## Deadline

Sunday, May 10, 2026 at 8:00pm EDT

## What we're looking for

We are not looking for how much you built. We are looking for how deliberately you built it — the decisions you made, the ones you didn't make and why, and whether the engineer behind the code is visible in the commit history and README.
