// .github/scripts/review.js
// Called by claude-review.yml — runs inside the GitHub Actions runner.

const https = require('https');

async function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
        catch (e) { resolve({ status: res.statusCode, body }); }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function fetchDiff(owner, repo, pullNumber, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}/pulls/${pullNumber}`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3.diff',
        'User-Agent': 'jobtern-review-bot',
      },
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.end();
  });
}

async function postReview({ owner, repo, pullNumber, commitId, body, event, token }) {
  const payload = JSON.stringify({ body, event, commit_id: commitId });
  return fetchJson(`https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`, {
    method: 'POST',
    hostname: 'api.github.com',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'jobtern-review-bot',
      'Content-Length': Buffer.byteLength(payload),
    },
    body: payload,
  });
}

async function callClaude({ systemPrompt, userPrompt, apiKey }) {
  const payload = JSON.stringify({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
        catch (e) { reject(new Error(`Failed to parse Claude response: ${body}`)); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function fetchRubric(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchRubric(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to fetch rubric: HTTP ${res.statusCode} from ${url}`));
      }
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve(body));
    }).on('error', reject);
  });
}


function scoreBar(label, val) {
  return `**${label}**: ${'█'.repeat(val)}${'░'.repeat(5 - val)} ${val}/5`;
}

async function run() {
  const {
    ANTHROPIC_API_KEY,
    RUBRIC_URL,
    GITHUB_TOKEN,
    PR_OWNER,
    PR_REPO,
    PR_NUMBER,
    PR_HEAD_SHA,
    PR_BODY,
  } = process.env;

  if (!RUBRIC_URL) {
    console.error('RUBRIC_URL is not set. Run new-assessment.sh to configure it.');
    process.exit(1);
  }

  console.log(`Fetching rubric from: ${RUBRIC_URL}`);
  const reviewContext = await fetchRubric(RUBRIC_URL);

  // Fetch diff
  const diff = await fetchDiff(PR_OWNER, PR_REPO, PR_NUMBER, GITHUB_TOKEN);

  const systemPrompt = [
    'You are a senior engineer conducting a code review for a junior engineering screening assessment.',
    'Your job is to evaluate the submission honestly and without diplomatic softening.',
    '',
    'The review context below contains the task rubric, hard-fail conditions, and the exact JSON',
    'format you must return. You must return ONLY valid JSON — no prose, no markdown fences,',
    'no explanation outside the JSON object.',
    '',
    reviewContext,
  ].join('\n');

  const truncatedDiff = diff.length > 80000
    ? diff.slice(0, 80000) + '\n\n[diff truncated — evaluate what is visible]'
    : diff;

  const userPrompt = [
    '## Candidate PR description',
    '',
    PR_BODY || '(no PR description provided)',
    '',
    '## Code diff',
    '',
    '```diff',
    truncatedDiff,
    '```',
    '',
    'Review this submission against the rubric. Return only the JSON object.',
  ].join('\n');

  // Call Claude
  const { status, body: claudeData } = await callClaude({
    systemPrompt,
    userPrompt,
    apiKey: ANTHROPIC_API_KEY,
  });

  if (status !== 200) {
    console.error(`Anthropic API error ${status}:`, claudeData);
    process.exit(1);
  }

  const rawText = claudeData.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');

  // Parse JSON response
  let review;
  try {
    const clean = rawText.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim();
    review = JSON.parse(clean);
  } catch (e) {
    console.error('Failed to parse Claude response as JSON:', e.message);
    console.error('Raw response:', rawText);
    process.exit(1);
  }

  // Build candidate-facing PR comment
  const hardFailSection = review.hard_fails?.length
    ? '\n\n### Hard fails\n' + review.hard_fails.map((f) => `- ${f}`).join('\n')
    : '';

  const inlineSection = review.inline_comments?.length
    ? '\n\n### File notes\n' + review.inline_comments
        .map((c) => `**\`${c.file}\`**\n${c.note}`)
        .join('\n\n')
    : '';

  const prComment = [
    '## Assessment review',
    '',
    review.summary,
    hardFailSection,
    inlineSection,
    '',
    '---',
    `*Reviewed by Jobtern. Verdict: **${review.verdict}**.*`,
  ].join('\n');

  // Post GitHub review
  const reviewRes = await postReview({
    owner: PR_OWNER,
    repo: PR_REPO,
    pullNumber: PR_NUMBER,
    commitId: PR_HEAD_SHA,
    body: prComment,
    event: review.verdict === 'APPROVE' ? 'APPROVE' : 'REQUEST_CHANGES',
    token: GITHUB_TOKEN,
  });

  if (reviewRes.status !== 200) {
    console.error('Failed to post GitHub review:', reviewRes.body);
    process.exit(1);
  }

  // Internal summary (Actions run only — not visible to candidates)
  const hireEmoji = { strong: 'STRONG', moderate: 'MODERATE', weak: 'WEAK', no: 'NO' }[review.hire_signal] || 'UNKNOWN';

  console.log('');
  console.log('=== JOBTERN INTERNAL REVIEW ===');
  console.log('Verdict:     ', review.verdict);
  console.log('Hire signal: ', hireEmoji);
  console.log('Correctness: ', review.score?.correctness ?? 'N/A', '/ 5');
  console.log('Craft:       ', review.score?.craft ?? 'N/A', '/ 5');
  console.log('Communication:', review.score?.communication ?? 'N/A', '/ 5');
  if (review.hard_fails?.length) {
    console.log('Hard fails:');
    review.hard_fails.forEach((f) => console.log(' -', f));
  }
  console.log('================================');
  console.log('');
  console.log('Review posted successfully.');
}

run().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
