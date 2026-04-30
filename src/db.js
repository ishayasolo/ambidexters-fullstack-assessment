const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../transactions.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id          TEXT PRIMARY KEY,
    amount      INTEGER NOT NULL,
    currency    TEXT NOT NULL DEFAULT 'USD',
    status      TEXT NOT NULL CHECK(status IN ('pending', 'completed', 'failed')),
    type        TEXT NOT NULL CHECK(type IN ('debit', 'credit')),
    description TEXT NOT NULL,
    created_at  TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_status ON transactions(status);
  CREATE INDEX IF NOT EXISTS idx_type ON transactions(type);
  CREATE INDEX IF NOT EXISTS idx_created_at ON transactions(created_at);
`);

module.exports = db;
