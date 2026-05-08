import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "disbursements.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  const isNew = !fs.existsSync(DB_PATH);
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  if (isNew) {
    initSchema(_db);
    seedData(_db);
  }

  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS batches (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    NOT NULL,
      created_by    TEXT    NOT NULL,
      initiated_at  TEXT    NOT NULL,
      total_count   INTEGER NOT NULL DEFAULT 0,
      -- NULL means status is derived from disbursements; 'failed' means batch-level rejection
      pre_failed    INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS disbursements (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id          INTEGER NOT NULL REFERENCES batches(id),
      recipient_name    TEXT    NOT NULL,
      account_reference TEXT    NOT NULL,
      amount            INTEGER NOT NULL,
      status            TEXT    NOT NULL CHECK(status IN ('queued','sent','cleared','failed','reversed')),
      initiated_at      TEXT    NOT NULL,
      settled_at        TEXT,
      failure_reason    TEXT,
      CHECK(amount > 0),
      CHECK((status IN ('cleared','failed','reversed') AND settled_at IS NOT NULL) OR status NOT IN ('cleared','failed','reversed')),
      CHECK((status = 'failed' AND failure_reason IS NOT NULL) OR status != 'failed')
    );

    CREATE INDEX IF NOT EXISTS idx_disbursements_batch_id ON disbursements(batch_id);
    CREATE INDEX IF NOT EXISTS idx_disbursements_batch_status ON disbursements(batch_id, status);
  `);
}

// Batch status is derived in SQL — not stored (except for pre-processing failures).
// Status derivation:
//   failed     → pre_failed = 1
//   pending    → all disbursements are queued (none sent/cleared/failed/reversed)
//   completed  → all disbursements are in terminal states (cleared/failed/reversed)
//   processing → at least one is queued or sent
const BATCH_STATUS_SQL = `
  CASE
    WHEN b.pre_failed = 1 THEN 'failed'
    WHEN NOT EXISTS (
      SELECT 1 FROM disbursements d2
      WHERE d2.batch_id = b.id AND d2.status NOT IN ('queued')
    ) THEN 'pending'
    WHEN NOT EXISTS (
      SELECT 1 FROM disbursements d2
      WHERE d2.batch_id = b.id AND d2.status IN ('queued','sent')
    ) THEN 'completed'
    ELSE 'processing'
  END
`;

const BATCH_SUMMARY_SQL = `
  SELECT
    b.id,
    b.name,
    b.created_by,
    b.initiated_at,
    b.total_count,
    (${BATCH_STATUS_SQL}) AS status,

    COALESCE(SUM(CASE WHEN d.status = 'cleared'  THEN 1 ELSE 0 END), 0) AS cleared_count,
    COALESCE(SUM(CASE WHEN d.status = 'failed'   THEN 1 ELSE 0 END), 0) AS failed_count,
    COALESCE(SUM(CASE WHEN d.status = 'reversed' THEN 1 ELSE 0 END), 0) AS reversed_count,
    COALESCE(SUM(CASE WHEN d.status = 'sent'     THEN 1 ELSE 0 END), 0) AS sent_count,
    COALESCE(SUM(CASE WHEN d.status = 'queued'   THEN 1 ELSE 0 END), 0) AS queued_count,

    -- "Total disbursed" = cleared only (definitively settled)
    COALESCE(SUM(CASE WHEN d.status = 'cleared'  THEN d.amount ELSE 0 END), 0) AS cleared_amount,
    COALESCE(SUM(CASE WHEN d.status = 'failed'   THEN d.amount ELSE 0 END), 0) AS failed_amount,
    COALESCE(SUM(CASE WHEN d.status = 'reversed' THEN d.amount ELSE 0 END), 0) AS reversed_amount,
    -- In-flight = sent (instruction has left, settlement not confirmed)
    COALESCE(SUM(CASE WHEN d.status = 'sent'     THEN d.amount ELSE 0 END), 0) AS in_flight_amount

  FROM batches b
  LEFT JOIN disbursements d ON d.batch_id = b.id
`;

export function listBatches(page: number, limit: number) {
  const db = getDb();
  const offset = (page - 1) * limit;

  const total = (
    db.prepare("SELECT COUNT(*) as count FROM batches").get() as {
      count: number;
    }
  ).count;

  const rows = db
    .prepare(
      `${BATCH_SUMMARY_SQL}
       GROUP BY b.id
       ORDER BY b.initiated_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(limit, offset);

  return { rows, total };
}

export function getBatch(id: number) {
  const db = getDb();
  return db
    .prepare(
      `${BATCH_SUMMARY_SQL}
       WHERE b.id = ?
       GROUP BY b.id`
    )
    .get(id);
}

export function listDisbursements(
  batchId: number,
  page: number,
  limit: number,
  status?: string
) {
  const db = getDb();
  const offset = (page - 1) * limit;

  const validStatuses = ["queued", "sent", "cleared", "failed", "reversed"];
  const filterStatus =
    status && validStatuses.includes(status) ? status : null;

  const whereClause = filterStatus
    ? "WHERE batch_id = ? AND status = ?"
    : "WHERE batch_id = ?";
  const params = filterStatus ? [batchId, filterStatus] : [batchId];

  const total = (
    db
      .prepare(`SELECT COUNT(*) as count FROM disbursements ${whereClause}`)
      .get(...params) as { count: number }
  ).count;

  const rows = db
    .prepare(
      `SELECT * FROM disbursements ${whereClause}
       ORDER BY initiated_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  return { rows, total };
}

function seedData(db: Database.Database) {
  const now = new Date("2026-05-08T10:00:00Z");

  const insertBatch = db.prepare(`
    INSERT INTO batches (name, created_by, initiated_at, total_count, pre_failed)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertDisbursement = db.prepare(`
    INSERT INTO disbursements (batch_id, recipient_name, account_reference, amount, status, initiated_at, settled_at, failure_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedAll = db.transaction(() => {
    // ── Batch 1: Completed May payroll (large, > 1 page, mix of cleared/failed)
    const b1 = insertBatch.run(
      "May 2026 Payroll Run",
      "finance@ambidexters.io",
      new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      120,
      0
    );
    const b1id = b1.lastInsertRowid as number;

    const staffNames = [
      "Adaeze Okafor", "Chukwuemeka Nwosu", "Fatima Al-Hassan", "Obinna Eze",
      "Ngozi Adeyemi", "Seun Adesanya", "Kemi Bello", "Tunde Fashola",
      "Amaka Okonkwo", "Ikenna Chukwu", "Blessing Okeke", "Emeka Obi",
      "Chisom Nnadi", "Yusuf Musa", "Hauwa Garba", "Suleiman Abdullahi",
      "Grace Adeleke", "Samuel Taiwo", "Ruth Olawale", "Daniel Afolabi",
    ];
    const banks = ["044", "058", "011", "033", "057", "035", "070", "076"];

    for (let i = 0; i < 120; i++) {
      const name = staffNames[i % staffNames.length] + (i >= staffNames.length ? ` ${Math.floor(i / staffNames.length) + 1}` : "");
      const acct = `${banks[i % banks.length]}${String(1000000000 + i).padStart(10, "0")}`;
      const amount = 150000 * 100 + Math.floor(Math.random() * 50000) * 100; // 150k–200k NGN in kobo
      const initiated = new Date(now.getTime() - 2 * 60 * 60 * 1000 - i * 2000).toISOString();
      const settled = new Date(now.getTime() - 60 * 60 * 1000 - i * 1000).toISOString();

      let status: string, failure_reason: string | null = null;
      if (i < 80) {
        status = "cleared";
      } else if (i < 95) {
        status = "failed";
        const reasons = ["insufficient funds", "invalid account number", "bank timeout", "account frozen", "beneficiary bank offline"];
        failure_reason = reasons[i % reasons.length];
      } else if (i < 100) {
        status = "reversed";
      } else {
        // Still a few sent (shouldn't happen in a "completed" batch, so make them cleared)
        status = "cleared";
      }

      insertDisbursement.run(
        b1id, name, acct, amount, status, initiated,
        status === "queued" ? null : settled,
        failure_reason
      );
    }

    // ── Batch 2: Currently processing (payroll for another entity)
    const b2 = insertBatch.run(
      "Vendor Settlements – April",
      "ops@ambidexters.io",
      new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
      45,
      0
    );
    const b2id = b2.lastInsertRowid as number;

    const vendors = [
      "TechSupply Ltd", "CloudHost NG", "Fuel Depot Abuja", "Office Mart",
      "Security Services Pro", "Cleaning Crew Co", "Catering Express",
      "Print & Design Hub", "Transport Solutions", "Maintenance Works",
    ];

    for (let i = 0; i < 45; i++) {
      const name = vendors[i % vendors.length];
      const acct = `058${String(2000000000 + i).padStart(10, "0")}`;
      const amount = 500000 * 100 + Math.floor(Math.random() * 200000) * 100;
      const initiated = new Date(now.getTime() - 25 * 60 * 1000 - i * 500).toISOString();

      let status: string, settled: string | null = null, failure_reason: string | null = null;
      if (i < 20) {
        status = "cleared";
        settled = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
      } else if (i < 35) {
        status = "sent";
      } else if (i < 40) {
        status = "failed";
        failure_reason = i % 2 === 0 ? "invalid account number" : "bank timeout";
        settled = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
      } else {
        status = "queued";
      }

      insertDisbursement.run(b2id, name, acct, amount, status, initiated, settled, failure_reason);
    }

    // ── Batch 3: Pending (just queued, nothing sent yet)
    const b3 = insertBatch.run(
      "Agent Commissions – Q1 2026",
      "commissions@ambidexters.io",
      new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
      30,
      0
    );
    const b3id = b3.lastInsertRowid as number;

    const agents = [
      "Emeka Sales", "Bola Growth", "Tunde Field", "Ada Rep", "Kunle Agent",
      "Musa Direct", "Ngozi Partner", "Sola Force", "Dayo Connect", "Femi Link",
    ];

    for (let i = 0; i < 30; i++) {
      const name = agents[i % agents.length] + (i >= agents.length ? ` ${Math.floor(i / agents.length) + 1}` : "");
      const acct = `033${String(3000000000 + i).padStart(10, "0")}`;
      const amount = 25000 * 100 + Math.floor(Math.random() * 75000) * 100;
      const initiated = new Date(now.getTime() - 3 * 60 * 1000 - i * 100).toISOString();

      insertDisbursement.run(b3id, name, acct, amount, "queued", initiated, null, null);
    }

    // ── Batch 4: Failed (batch-level rejection before processing)
    const b4 = insertBatch.run(
      "Emergency Contractor Payments",
      "cfo@ambidexters.io",
      new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
      12,
      1  // pre_failed = true
    );
    const b4id = b4.lastInsertRowid as number;

    for (let i = 0; i < 12; i++) {
      const name = `Contractor ${String.fromCharCode(65 + i)}`;
      const acct = `057${String(4000000000 + i).padStart(10, "0")}`;
      const amount = 1000000 * 100;
      const initiated = new Date(now.getTime() - 4 * 60 * 60 * 1000 - i * 1000).toISOString();
      insertDisbursement.run(b4id, name, acct, amount, "queued", initiated, null, null);
    }

    // ── Batch 5: Completed small batch (all cleared, recent)
    const b5 = insertBatch.run(
      "Executive Bonuses – Q1",
      "cfo@ambidexters.io",
      new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
      8,
      0
    );
    const b5id = b5.lastInsertRowid as number;

    const execs = [
      "CEO Office", "CTO Office", "CFO Office", "COO Office",
      "VP Engineering", "VP Sales", "VP Operations", "Head of Finance",
    ];

    for (let i = 0; i < 8; i++) {
      const acct = `011${String(5000000000 + i).padStart(10, "0")}`;
      const amount = 5000000 * 100;
      const initiated = new Date(now.getTime() - 6 * 60 * 60 * 1000 - i * 500).toISOString();
      const settled = new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString();
      insertDisbursement.run(b5id, execs[i], acct, amount, "cleared", initiated, settled, null);
    }

    // ── Batch 6: Completed but with many failures (urgent attention needed)
    const b6 = insertBatch.run(
      "Retail Partner Payouts – Week 18",
      "finance@ambidexters.io",
      new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
      60,
      0
    );
    const b6id = b6.lastInsertRowid as number;

    for (let i = 0; i < 60; i++) {
      const name = `Partner ${String(1000 + i)}`;
      const acct = `070${String(6000000000 + i).padStart(10, "0")}`;
      const amount = 75000 * 100 + Math.floor(Math.random() * 25000) * 100;
      const initiated = new Date(now.getTime() - 55 * 60 * 1000 - i * 500).toISOString();
      const settled = new Date(now.getTime() - 10 * 60 * 1000 - i * 200).toISOString();

      let status: string, failure_reason: string | null = null;
      if (i < 20) {
        status = "cleared";
      } else if (i < 60) {
        // 40 failures — batch "finished an hour ago with 40 failures"
        status = "failed";
        const reasons = ["invalid account number", "bank timeout", "account dormant", "beneficiary bank offline", "daily limit exceeded"];
        failure_reason = reasons[i % reasons.length];
      }

      insertDisbursement.run(b6id, name, acct, amount, status!, initiated, settled, failure_reason);
    }
  });

  seedAll();
}

export { getDb };
