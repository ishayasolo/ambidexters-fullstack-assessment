const state = {
  page: 1,
  limit: 20,
  status: '',
  type: '',
};

// ── Formatting helpers ────────────────────────────────────────────────────────

function formatAmount(cents, currency) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── API ───────────────────────────────────────────────────────────────────────

async function fetchTransactions() {
  const params = new URLSearchParams({
    page: state.page,
    limit: state.limit,
  });
  if (state.status) params.set('status', state.status);
  if (state.type) params.set('type', state.type);

  const res = await fetch(`/transactions?${params}`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

async function fetchSummary() {
  // Fetch unfiltered totals for the summary bar
  const [all, debits, credits, pending, completed, failed] = await Promise.all([
    fetch('/transactions?limit=1').then(r => r.json()),
    fetch('/transactions?type=debit&limit=1').then(r => r.json()),
    fetch('/transactions?type=credit&limit=1').then(r => r.json()),
    fetch('/transactions?status=pending&limit=1').then(r => r.json()),
    fetch('/transactions?status=completed&limit=1').then(r => r.json()),
    fetch('/transactions?status=failed&limit=1').then(r => r.json()),
  ]);

  // Fetch full sets to sum amounts (only feasible at small scale; noted as a trade-off)
  const [debitFull, creditFull] = await Promise.all([
    fetch(`/transactions?type=debit&limit=100`).then(r => r.json()),
    fetch(`/transactions?type=credit&limit=100`).then(r => r.json()),
  ]);

  const sumCents = (rows) => rows.reduce((acc, t) => acc + t.amount, 0);

  return {
    totalDebits: sumCents(debitFull.data),
    totalCredits: sumCents(creditFull.data),
    pending: pending.meta.total,
    completed: completed.meta.total,
    failed: failed.meta.total,
  };
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderTable(transactions) {
  const tbody = document.getElementById('transactions-body');

  if (!transactions.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">No transactions found.</td></tr>';
    return;
  }

  tbody.innerHTML = transactions.map(t => `
    <tr>
      <td>${escapeHtml(t.description)}</td>
      <td><span class="badge badge-${t.type}">${t.type}</span></td>
      <td>${formatAmount(t.amount, t.currency)}</td>
      <td>${t.currency}</td>
      <td><span class="badge badge-${t.status}">${t.status}</span></td>
      <td>${formatDate(t.created_at)}</td>
    </tr>
  `).join('');
}

function renderPagination(meta) {
  const nav = document.getElementById('pagination');
  nav.innerHTML = '';

  const prev = document.createElement('button');
  prev.textContent = '← Prev';
  prev.disabled = meta.page <= 1;
  prev.addEventListener('click', () => { state.page--; load(); });
  nav.appendChild(prev);

  for (let i = 1; i <= meta.pages; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    if (i === meta.page) btn.classList.add('active');
    btn.addEventListener('click', () => { state.page = i; load(); });
    nav.appendChild(btn);
  }

  const next = document.createElement('button');
  next.textContent = 'Next →';
  next.disabled = meta.page >= meta.pages;
  next.addEventListener('click', () => { state.page++; load(); });
  nav.appendChild(next);
}

function renderSummary(summary) {
  document.getElementById('total-credits').textContent = formatAmount(summary.totalCredits, 'USD');
  document.getElementById('total-debits').textContent = formatAmount(summary.totalDebits, 'USD');
  document.getElementById('count-pending').textContent = summary.pending;
  document.getElementById('count-completed').textContent = summary.completed;
  document.getElementById('count-failed').textContent = summary.failed;
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Load ──────────────────────────────────────────────────────────────────────

async function load() {
  const tbody = document.getElementById('transactions-body');
  tbody.innerHTML = '<tr><td colspan="6" class="empty">Loading...</td></tr>';

  try {
    const { data, meta } = await fetchTransactions();
    renderTable(data);
    renderPagination(meta);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty">Failed to load transactions: ${err.message}</td></tr>`;
  }
}

async function loadSummary() {
  try {
    const summary = await fetchSummary();
    renderSummary(summary);
  } catch (err) {
    console.error('Failed to load summary:', err);
  }
}

// ── Event listeners ───────────────────────────────────────────────────────────

document.getElementById('filter-status').addEventListener('change', (e) => {
  state.status = e.target.value;
  state.page = 1;
  load();
});

document.getElementById('filter-type').addEventListener('change', (e) => {
  state.type = e.target.value;
  state.page = 1;
  load();
});

// ── Init ──────────────────────────────────────────────────────────────────────

load();
loadSummary();
