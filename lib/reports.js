// Pure aggregation helpers for /dashboard/reports — takes the array of
// briefs already loaded via listBriefs() and produces plain-object summaries
// the reports page renders as stat tiles and simple bar breakdowns. No
// database access here on purpose: this is just number-crunching over data
// the caller already has, so it's trivial to unit-test and reuse (e.g. for
// the CSV export route, which wants the same "one row per brief" shape).

const STATUS_META = {
  todo: { label: 'To-do', color: '#5C5850' },
  pending_customer: { label: 'Wacht op klant', color: '#8C6D1F' },
  in_progress: { label: 'In behandeling', color: '#1F6F8C' },
  done: { label: 'Klaar', color: '#1D7A46' },
};
const STATUS_ORDER = ['todo', 'pending_customer', 'in_progress', 'done'];

const SCRIPT_SOURCE_META = {
  claude: { label: 'Claude (AI)', color: '#8C6D1F' },
  gemini: { label: 'Gemini (AI)', color: '#1F6F8C' },
  ollama: { label: 'Ollama (AI)', color: '#5C5850' },
  template: { label: 'Sjabloon (geen AI)', color: '#8C8880' },
  error: { label: 'Mislukt', color: '#C2513F' },
  '': { label: 'Nog niet gegenereerd', color: '#C9C5B9' },
};

const IMPRESSIONS_LABELS = {
  '25000': '25.000', '50000': '50.000', '100000': '100.000',
  '150000': '150.000', '250000': '250.000', '500000': '500.000',
  meer: 'Meer dan 500.000', '': 'Nog niet gekozen',
};

// bucketCounts() below needs { label, color } entries, not the plain
// value->label strings above (those are shared with the CSV row-builder,
// which just wants the plain string) — derive one from the other so the
// two never drift out of sync.
const IMPRESSIONS_META = Object.fromEntries(
  Object.entries(IMPRESSIONS_LABELS).map(([key, label]) => [key, { label, color: '#8C6D1F' }])
);

function parseHistory(brief) {
  try {
    const parsed = brief.scriptHistory ? JSON.parse(brief.scriptHistory) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function bucketCounts(items, keyFn, meta) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item) ?? '';
    counts[key] = (counts[key] || 0) + 1;
  }
  const total = items.length;
  return Object.entries(counts)
    .map(([key, count]) => ({
      key,
      label: (meta && meta[key] && meta[key].label) || key || 'Onbekend',
      color: (meta && meta[key] && meta[key].color) || '#8C8880',
      count,
      pct: total ? Math.round((count / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

function monthKey(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const MONTH_SHORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

// Last `months` calendar months (oldest first), each with how many briefs
// were created in it — a simple intake-volume trend line without needing
// any charting library, just a row of bars sized by percent-of-max.
function monthlyTrend(briefs, months = 6) {
  const now = new Date();
  const buckets = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: MONTH_SHORT[d.getMonth()], count: 0 });
  }
  const byKey = {};
  buckets.forEach((b) => { byKey[b.key] = b; });
  briefs.forEach((b) => {
    const key = monthKey(b.createdAt);
    if (key && byKey[key]) byKey[key].count += 1;
  });
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return buckets.map((b) => ({ ...b, pct: Math.round((b.count / max) * 100) }));
}

export function buildReportData(briefs) {
  const total = briefs.length;

  const statusBreakdown = STATUS_ORDER.map((key) => {
    const count = briefs.filter((b) => (b.status || 'todo') === key).length;
    return { key, label: STATUS_META[key].label, color: STATUS_META[key].color, count, pct: total ? Math.round((count / total) * 1000) / 10 : 0 };
  });

  const audienceBreakdown = bucketCounts(briefs, (b) => b.audience || 'onbekend', {
    b2b: { label: 'B2B — vooral bedrijven', color: '#8C6D1F' },
    b2c: { label: 'B2C — vooral consumenten', color: '#1F6F8C' },
    onbekend: { label: 'Nog niet ingevuld', color: '#C9C5B9' },
  });

  const scriptSourceBreakdown = bucketCounts(briefs, (b) => b.scriptSource || '', SCRIPT_SOURCE_META);

  const withScript = briefs.filter((b) => !!b.generatedScript);
  const approvedCount = withScript.filter((b) => b.scriptApproved).length;
  const approvalRate = withScript.length ? Math.round((approvedCount / withScript.length) * 1000) / 10 : null;

  const regenCounts = briefs.map((b) => parseHistory(b).length).filter((n) => n > 0);
  const avgRegenerations = regenCounts.length
    ? Math.round((regenCounts.reduce((a, c) => a + c, 0) / regenCounts.length) * 10) / 10
    : 0;

  const variationsBreakdown = bucketCounts(briefs, (b) => (b.needsVariations ? 'ja' : 'nee'), {
    ja: { label: 'Ja, variaties nodig', color: '#8C6D1F' },
    nee: { label: 'Nee, alleen hoofdspot', color: '#5C5850' },
  });

  const impressionsBreakdown = bucketCounts(briefs, (b) => b.impressions || '', IMPRESSIONS_META);

  const thisMonthKey = monthKey(new Date().toISOString());
  const newThisMonth = briefs.filter((b) => monthKey(b.createdAt) === thisMonthKey).length;

  return {
    total,
    newThisMonth,
    statusBreakdown,
    audienceBreakdown,
    scriptSourceBreakdown,
    variationsBreakdown,
    impressionsBreakdown,
    approvalRate,
    approvedCount,
    scriptedCount: withScript.length,
    avgRegenerations,
    monthlyTrend: monthlyTrend(briefs, 6),
  };
}

// One flat row per brief — shared by the CSV export route so the download
// matches exactly what the report page is summarizing.
export function briefsToRows(briefs) {
  return briefs.map((b) => ({
    id: b.id,
    bedrijf: b.companyName || '',
    contactpersoon: b.contactPerson || '',
    email: b.contactEmail || '',
    status: (STATUS_META[b.status] || STATUS_META.todo).label,
    doelgroep: b.audience === 'b2b' ? 'B2B' : b.audience === 'b2c' ? 'B2C' : '',
    lengte: b.hoofdspotLength ? `${b.hoofdspotLength}s` : '',
    variaties: b.needsVariations ? 'Ja' : 'Nee',
    impressies: IMPRESSIONS_LABELS[b.impressions || ''] || b.impressions || '',
    scriptBron: (SCRIPT_SOURCE_META[b.scriptSource || ''] || {}).label || b.scriptSource || '',
    scriptGoedgekeurd: b.scriptApproved ? 'Ja' : 'Nee',
    aangemaakt: b.createdAt || '',
    ingediend: b.submittedAt || '',
  }));
}

export function rowsToCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    const s = String(v ?? '');
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(';')];
  rows.forEach((row) => lines.push(headers.map((h) => escape(row[h])).join(';')));
  return lines.join('\r\n');
}
