const { randomUUID } = require('crypto');
const db = require('./db');

const descriptions = [
  'Payroll disbursement',
  'Vendor payment — AWS',
  'Customer refund',
  'Subscription renewal',
  'Office supplies',
  'Client invoice payment',
  'Software licence',
  'Freelancer payment',
  'Ad spend — Google',
  'Travel reimbursement',
];

const statuses = ['pending', 'completed', 'failed'];
const types = ['debit', 'credit'];
const currencies = ['USD', 'NGN', 'GBP'];

const insert = db.prepare(`
  INSERT OR IGNORE INTO transactions (id, amount, currency, status, type, description, created_at)
  VALUES (@id, @amount, @currency, @status, @type, @description, @created_at)
`);

const insertMany = db.transaction((records) => {
  for (const r of records) insert.run(r);
});

const records = Array.from({ length: 50 }, (_, i) => ({
  id: randomUUID(),
  amount: Math.floor(Math.random() * 500000) + 100,
  currency: currencies[i % currencies.length],
  status: statuses[i % statuses.length],
  type: types[i % types.length],
  description: descriptions[i % descriptions.length],
  created_at: new Date(Date.now() - i * 3600000).toISOString(),
}));

insertMany(records);
console.log(`Seeded ${records.length} transactions.`);
