const { Router } = require('express');
const { randomUUID } = require('crypto');
const db = require('../db');

const router = Router();

const VALID_STATUSES = ['pending', 'completed', 'failed'];
const VALID_TYPES = ['debit', 'credit'];

// POST /transactions
router.post('/', (req, res) => {
  const { amount, currency, status, type, description } = req.body;

  if (amount === undefined || amount === null) {
    return res.status(400).json({ error: '`amount` is required' });
  }
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
    return res.status(400).json({ error: '`amount` must be a positive integer (cents)' });
  }
  if (!currency || typeof currency !== 'string') {
    return res.status(400).json({ error: '`currency` is required' });
  }
  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `\`status\` must be one of: ${VALID_STATUSES.join(', ')}` });
  }
  if (!type || !VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `\`type\` must be one of: ${VALID_TYPES.join(', ')}` });
  }
  if (!description || typeof description !== 'string' || !description.trim()) {
    return res.status(400).json({ error: '`description` is required' });
  }

  const transaction = {
    id: randomUUID(),
    amount,
    currency: currency.toUpperCase(),
    status,
    type,
    description: description.trim(),
    created_at: new Date().toISOString(),
  };

  db.prepare(`
    INSERT INTO transactions (id, amount, currency, status, type, description, created_at)
    VALUES (@id, @amount, @currency, @status, @type, @description, @created_at)
  `).run(transaction);

  return res.status(201).json({ data: transaction });
});

// GET /transactions
router.get('/', (req, res) => {
  const { status, type, page = '1', limit = '20' } = req.query;

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);

  if (isNaN(pageNum) || pageNum < 1) {
    return res.status(400).json({ error: '`page` must be a positive integer' });
  }
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    return res.status(400).json({ error: '`limit` must be between 1 and 100' });
  }
  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `\`status\` must be one of: ${VALID_STATUSES.join(', ')}` });
  }
  if (type && !VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `\`type\` must be one of: ${VALID_TYPES.join(', ')}` });
  }

  const conditions = [];
  const params = {};

  if (status) {
    conditions.push('status = @status');
    params.status = status;
  }
  if (type) {
    conditions.push('type = @type');
    params.type = type;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (pageNum - 1) * limitNum;

  const total = db.prepare(`SELECT COUNT(*) as count FROM transactions ${where}`).get(params).count;
  const rows = db.prepare(`
    SELECT * FROM transactions ${where}
    ORDER BY created_at DESC
    LIMIT ${limitNum} OFFSET ${offset}
  `).all(params);

  return res.json({
    data: rows,
    meta: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum),
    },
  });
});

// GET /transactions/:id
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);

  if (!row) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  return res.json({ data: row });
});

module.exports = router;
