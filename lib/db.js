// Data layer for the brief/script flow. Ported from the original
// better-sqlite3 db.js, but async throughout and backed by either:
//  - @vercel/postgres, when POSTGRES_URL is set (real, persistent, shared
//    across serverless function instances), or
//  - a plain in-memory array, when it isn't (zero-config local dev, and
//    lets `next build`/`next dev` work with no external services at all).
//
// The in-memory fallback is per-process — fine for local dev, but on
// Vercel serverless each invocation may be a fresh process, so data will
// NOT persist between requests without a real POSTGRES_URL configured.

const { nanoid } = require('nanoid');

const USE_PG = !!process.env.POSTGRES_URL;

// Cap on how many past script generations are kept per brief — mirrors the
// "max of 3" regenerate limit enforced in app/api/briefs/[id]/generate-script.
const MAX_SCRIPT_HISTORY = 3;

function parseScriptHistory(raw) {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

// Fields the client's brief form is allowed to write.
const ALLOWED_FIELDS = [
  'companyName',
  'contactPerson',
  'contactEmail',
  // JSON string of [{ name, email }] — extra contact people beyond the
  // primary contactPerson/contactEmail above, added via the "+" on the
  // contact step. The confirmation email on submit goes to contactEmail
  // AND every email in here (see lib/email.js's recipientsFor()).
  'additionalContacts',
  'hoofdspotLength',
  'impressions',
  'impressionsCustom',
  'airDate',
  'dateUnknown',
  'airMonth',
  'needsVariations',
  'disclaimerText',
  'extraNote',
  'product',
  'audience',
  'decisionMaker',
  'audienceAgeInterests',
  'usp',
  'price',
  'priceDetail',
  'mainMessage',
  'cta',
  'slogan',
  'toneOfVoice',
  'variationDetail',
  'scriptApproved',
  'voiceGender',
  'voiceAgeRange',
  'voiceStyleTags',
  'voiceNote',
  'selectedVoiceId',
  'selectedVoiceLabel',
  'selectedVoiceTags',
  'selectedTrackId',
  'selectedTrackTitle',
  'selectedTrackArtist',
  'selectedPlaylistId',
  'selectedPlaylistName',
  'selectedTracks',
];
const BOOL_FIELDS = new Set(['needsVariations', 'dateUnknown', 'scriptApproved']);
// price is tri-state: null (not answered), 0 (no), 1 (yes) — not a plain bool.
const TRISTATE_FIELDS = new Set(['price']);

// Fields the script review step is allowed to write.
const EDIT_FIELDS = ['editedScript', 'editedVarScript'];

// Producer-only workflow status — deliberately NOT in ALLOWED_FIELDS (the
// client-facing brief flow never sees or sets this) and updated through its
// own dedicated updateBriefStatus() below instead of the general patch path.
const STATUS_VALUES = ['todo', 'pending_customer', 'in_progress', 'done'];
const DEFAULT_STATUS = 'todo';

const STRING_COLUMNS = [
  'companyName', 'contactPerson', 'contactEmail', 'additionalContacts', 'hoofdspotLength', 'impressions',
  'impressionsCustom', 'airDate', 'airMonth', 'disclaimerText', 'extraNote', 'product',
  'audience', 'decisionMaker', 'audienceAgeInterests', 'usp', 'priceDetail', 'mainMessage',
  'cta', 'slogan', 'variationDetail', 'generatedScript', 'generatedVarScript', 'scriptSource', 'scriptHistory',
  'voiceGender', 'voiceAgeRange', 'voiceStyleTags', 'voiceNote', 'selectedVoiceId',
  'selectedVoiceLabel', 'selectedVoiceTags', 'selectedTrackId', 'selectedTrackTitle',
  'selectedTrackArtist', 'selectedPlaylistId', 'selectedPlaylistName', 'selectedTracks',
  'toneOfVoice',
];

function coerceValue(key, value) {
  if (BOOL_FIELDS.has(key)) return value ? 1 : 0;
  if (TRISTATE_FIELDS.has(key)) return value === null || value === undefined ? null : (value ? 1 : 0);
  return String(value ?? '');
}

function parseInternalNotes(raw) {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function rowToBrief(row) {
  if (!row) return null;
  return {
    id: row.id,
    companyName: row.companyName,
    contactPerson: row.contactPerson,
    contactEmail: row.contactEmail,
    additionalContacts: row.additionalContacts || '[]',
    hoofdspotLength: row.hoofdspotLength,
    impressions: row.impressions,
    impressionsCustom: row.impressionsCustom,
    airDate: row.airDate,
    dateUnknown: !!row.dateUnknown,
    airMonth: row.airMonth,
    needsVariations: !!row.needsVariations,
    disclaimerText: row.disclaimerText,
    extraNote: row.extraNote,
    product: row.product,
    audience: row.audience || null,
    decisionMaker: row.decisionMaker,
    audienceAgeInterests: row.audienceAgeInterests,
    usp: row.usp,
    price: row.price === null || row.price === undefined ? null : !!row.price,
    priceDetail: row.priceDetail,
    mainMessage: row.mainMessage,
    cta: row.cta,
    slogan: row.slogan,
    variationDetail: row.variationDetail,
    scriptApproved: !!row.scriptApproved,
    generatedScript: row.generatedScript,
    generatedVarScript: row.generatedVarScript,
    scriptSource: row.scriptSource,
    scriptGeneratedAt: row.scriptGeneratedAt,
    // Up to 3 past AI/template generations for this brief, newest last —
    // JSON string of [{ id, main, variation, source, createdAt }]. Lets the
    // client-flow script step offer "view all responses and pick one"
    // instead of only ever showing the most recent generation.
    scriptHistory: row.scriptHistory || '[]',
    editedScript: row.editedScript,
    editedVarScript: row.editedVarScript,
    voiceGender: row.voiceGender,
    voiceAgeRange: row.voiceAgeRange,
    voiceStyleTags: row.voiceStyleTags,
    voiceNote: row.voiceNote,
    selectedVoiceId: row.selectedVoiceId,
    selectedVoiceLabel: row.selectedVoiceLabel,
    selectedVoiceTags: row.selectedVoiceTags,
    selectedTrackId: row.selectedTrackId,
    selectedTrackTitle: row.selectedTrackTitle,
    selectedTrackArtist: row.selectedTrackArtist,
    selectedPlaylistId: row.selectedPlaylistId,
    selectedPlaylistName: row.selectedPlaylistName,
    selectedTracks: row.selectedTracks,
    toneOfVoice: row.toneOfVoice,
    status: row.status || DEFAULT_STATUS,
    // Team-only workflow metadata — never touched by the client-facing brief
    // flow (not in ALLOWED_FIELDS), set from the dashboard instead via their
    // own dedicated update functions below, same separation as `status`.
    assignedTo: row.assignedTo || '',
    dueDate: row.dueDate || '',
    // Internal producer notes thread — JSON string of
    // [{ id, author, text, createdAt }], newest last. Never shown to the
    // client, only in the dashboard's brief detail view.
    internalNotes: row.internalNotes || '[]',
    submittedAt: row.submittedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function freshRow(id, now) {
  const row = { id, createdAt: now, updatedAt: now, submittedAt: null };
  for (const col of STRING_COLUMNS) row[col] = '';
  row.hoofdspotLength = '20';
  row.selectedTracks = '[]';
  row.toneOfVoice = '[]';
  row.scriptHistory = '[]';
  row.additionalContacts = '[]';
  row.dateUnknown = 0;
  row.needsVariations = 0;
  row.scriptApproved = 0;
  row.price = null;
  row.scriptGeneratedAt = null;
  row.editedScript = null;
  row.editedVarScript = null;
  row.status = DEFAULT_STATUS;
  row.assignedTo = '';
  row.dueDate = '';
  row.internalNotes = '[]';
  return row;
}

// ------------------------------------------------------------------------
// In-memory fallback
// ------------------------------------------------------------------------
const mem = {
  briefs: new Map(),
  sentEmails: [],
  tracks: null, // seeded lazily by lib/library.js
  voices: null,
};

async function memCreateBrief(id) {
  const now = new Date().toISOString();
  const row = freshRow(id, now);
  mem.briefs.set(id, row);
  return rowToBrief(row);
}

async function memGetBrief(id) {
  return rowToBrief(mem.briefs.get(id));
}

async function memListBriefs() {
  return Array.from(mem.briefs.values())
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .map(rowToBrief);
}

async function memUpdateBrief(id, patch) {
  const row = mem.briefs.get(id);
  if (!row) return null;
  for (const key of ALLOWED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      const coerced = coerceValue(key, patch[key]);
      row[key] = BOOL_FIELDS.has(key) ? !!coerced : coerced;
    }
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'submitted') && patch.submitted) {
    row.submittedAt = new Date().toISOString();
  }
  row.updatedAt = new Date().toISOString();
  return rowToBrief(row);
}

async function memSaveEdit(id, patch) {
  const row = mem.briefs.get(id);
  if (!row) return null;
  for (const key of EDIT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      row[key] = patch[key] === null ? null : String(patch[key]);
    }
  }
  row.updatedAt = new Date().toISOString();
  return rowToBrief(row);
}

async function memSaveGeneratedScript(id, { main, variation, source }) {
  const row = mem.briefs.get(id);
  if (!row) return null;
  const now = new Date().toISOString();
  const history = parseScriptHistory(row.scriptHistory);
  history.push({ id: nanoid(10), main: main || '', variation: variation || '', source: source || '', createdAt: now });
  row.scriptHistory = JSON.stringify(history.slice(-MAX_SCRIPT_HISTORY));
  row.generatedScript = main || '';
  row.generatedVarScript = variation || '';
  row.scriptSource = source || '';
  row.scriptGeneratedAt = now;
  row.editedScript = null;
  row.editedVarScript = null;
  row.scriptApproved = false;
  row.updatedAt = now;
  return rowToBrief(row);
}

// Re-points generatedScript/generatedVarScript at one of this brief's
// stored history entries — used when the client picks a previous
// generation instead of the most recent one (the script step's "view all
// responses and pick one").
async function memSelectScriptVersion(id, versionId) {
  const row = mem.briefs.get(id);
  if (!row) return null;
  const history = parseScriptHistory(row.scriptHistory);
  const entry = history.find((h) => h.id === versionId);
  if (!entry) return null;
  row.generatedScript = entry.main || '';
  row.generatedVarScript = entry.variation || '';
  row.scriptSource = entry.source || '';
  row.scriptGeneratedAt = entry.createdAt;
  row.editedScript = null;
  row.editedVarScript = null;
  row.scriptApproved = false;
  row.updatedAt = new Date().toISOString();
  return rowToBrief(row);
}

async function memUpdateStatus(id, status) {
  const row = mem.briefs.get(id);
  if (!row) return null;
  row.status = status;
  row.updatedAt = new Date().toISOString();
  return rowToBrief(row);
}

// Team-only workflow metadata — see the comment on rowToBrief's
// assignedTo/dueDate/internalNotes fields above.
async function memUpdateTeamMeta(id, { assignedTo, dueDate }) {
  const row = mem.briefs.get(id);
  if (!row) return null;
  if (assignedTo !== undefined) row.assignedTo = assignedTo || '';
  if (dueDate !== undefined) row.dueDate = dueDate || '';
  row.updatedAt = new Date().toISOString();
  return rowToBrief(row);
}

async function memAddInternalNote(id, { author, text }) {
  const row = mem.briefs.get(id);
  if (!row) return null;
  const notes = parseInternalNotes(row.internalNotes);
  notes.push({ id: nanoid(10), author: author || '', text: text || '', createdAt: new Date().toISOString() });
  row.internalNotes = JSON.stringify(notes);
  row.updatedAt = new Date().toISOString();
  return rowToBrief(row);
}

async function memInsertSentEmail({ id, briefId, to, subject, html }) {
  mem.sentEmails.push({ id, briefId, to, subject, html, createdAt: new Date().toISOString() });
}

async function memListSentEmails() {
  return mem.sentEmails.slice().reverse();
}

// ------------------------------------------------------------------------
// Postgres backend
// ------------------------------------------------------------------------
let migrated = false;
async function runMigrations() {
  if (!USE_PG || migrated) return;
  const { sql } = await import('@vercel/postgres');
  await sql`
    CREATE TABLE IF NOT EXISTS briefs (
      id TEXT PRIMARY KEY,
      "companyName" TEXT NOT NULL DEFAULT '',
      "contactPerson" TEXT NOT NULL DEFAULT '',
      "contactEmail" TEXT NOT NULL DEFAULT '',
      "additionalContacts" TEXT NOT NULL DEFAULT '[]',
      "hoofdspotLength" TEXT NOT NULL DEFAULT '20',
      impressions TEXT NOT NULL DEFAULT '',
      "impressionsCustom" TEXT NOT NULL DEFAULT '',
      "airDate" TEXT NOT NULL DEFAULT '',
      "dateUnknown" BOOLEAN NOT NULL DEFAULT false,
      "airMonth" TEXT NOT NULL DEFAULT '',
      "needsVariations" BOOLEAN NOT NULL DEFAULT false,
      "disclaimerText" TEXT NOT NULL DEFAULT '',
      "extraNote" TEXT NOT NULL DEFAULT '',
      product TEXT NOT NULL DEFAULT '',
      audience TEXT NOT NULL DEFAULT '',
      "decisionMaker" TEXT NOT NULL DEFAULT '',
      "audienceAgeInterests" TEXT NOT NULL DEFAULT '',
      usp TEXT NOT NULL DEFAULT '',
      price BOOLEAN,
      "priceDetail" TEXT NOT NULL DEFAULT '',
      "mainMessage" TEXT NOT NULL DEFAULT '',
      cta TEXT NOT NULL DEFAULT '',
      slogan TEXT NOT NULL DEFAULT '',
      "variationDetail" TEXT NOT NULL DEFAULT '',
      "scriptApproved" BOOLEAN NOT NULL DEFAULT false,
      "generatedScript" TEXT NOT NULL DEFAULT '',
      "generatedVarScript" TEXT NOT NULL DEFAULT '',
      "scriptSource" TEXT NOT NULL DEFAULT '',
      "scriptHistory" TEXT NOT NULL DEFAULT '[]',
      "scriptGeneratedAt" TEXT,
      "editedScript" TEXT,
      "editedVarScript" TEXT,
      "voiceGender" TEXT NOT NULL DEFAULT '',
      "voiceAgeRange" TEXT NOT NULL DEFAULT '',
      "voiceStyleTags" TEXT NOT NULL DEFAULT '',
      "voiceNote" TEXT NOT NULL DEFAULT '',
      "selectedVoiceId" TEXT NOT NULL DEFAULT '',
      "selectedVoiceLabel" TEXT NOT NULL DEFAULT '',
      "selectedVoiceTags" TEXT NOT NULL DEFAULT '',
      "selectedTrackId" TEXT NOT NULL DEFAULT '',
      "selectedTrackTitle" TEXT NOT NULL DEFAULT '',
      "selectedTrackArtist" TEXT NOT NULL DEFAULT '',
      "selectedPlaylistId" TEXT NOT NULL DEFAULT '',
      "selectedPlaylistName" TEXT NOT NULL DEFAULT '',
      "selectedTracks" TEXT NOT NULL DEFAULT '[]',
      "toneOfVoice" TEXT NOT NULL DEFAULT '[]',
      "status" TEXT NOT NULL DEFAULT 'todo',
      "assignedTo" TEXT NOT NULL DEFAULT '',
      "dueDate" TEXT NOT NULL DEFAULT '',
      "internalNotes" TEXT NOT NULL DEFAULT '[]',
      "submittedAt" TEXT,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );
  `;
  // Backfill for tables created before the status column existed.
  await sql`ALTER TABLE briefs ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'todo';`;
  await sql`ALTER TABLE briefs ADD COLUMN IF NOT EXISTS "scriptHistory" TEXT NOT NULL DEFAULT '[]';`;
  // Team-only workflow metadata — who's assigned, when it's due, and an
  // internal notes thread, none of it ever exposed to the client-facing
  // brief flow (see ALLOWED_FIELDS, which deliberately excludes all three).
  await sql`ALTER TABLE briefs ADD COLUMN IF NOT EXISTS "assignedTo" TEXT NOT NULL DEFAULT '';`;
  await sql`ALTER TABLE briefs ADD COLUMN IF NOT EXISTS "dueDate" TEXT NOT NULL DEFAULT '';`;
  await sql`ALTER TABLE briefs ADD COLUMN IF NOT EXISTS "internalNotes" TEXT NOT NULL DEFAULT '[]';`;
  await sql`ALTER TABLE briefs ADD COLUMN IF NOT EXISTS "additionalContacts" TEXT NOT NULL DEFAULT '[]';`;
  await sql`
    CREATE TABLE IF NOT EXISTS sent_emails (
      id TEXT PRIMARY KEY,
      brief_id TEXT NOT NULL,
      to_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      html TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `;
  migrated = true;
}

async function pgCreateBrief(id) {
  await runMigrations();
  const { sql } = await import('@vercel/postgres');
  const now = new Date().toISOString();
  await sql`
    INSERT INTO briefs (id, "companyName", "hoofdspotLength", "needsVariations", "disclaimerText", "extraNote", "submittedAt", "createdAt", "updatedAt")
    VALUES (${id}, '', '20', false, '', '', NULL, ${now}, ${now})
  `;
  return pgGetBrief(id);
}

async function pgGetBrief(id) {
  await runMigrations();
  const { sql } = await import('@vercel/postgres');
  const { rows } = await sql`SELECT * FROM briefs WHERE id = ${id}`;
  return rowToBrief(rows[0]);
}

async function pgListBriefs() {
  await runMigrations();
  const { sql } = await import('@vercel/postgres');
  const { rows } = await sql`SELECT * FROM briefs ORDER BY "updatedAt" DESC`;
  return rows.map(rowToBrief);
}

// Column names are drawn only from ALLOWED_FIELDS/EDIT_FIELDS (a fixed,
// hard-coded list), never from request input, so building this SQL by
// string interpolation is safe — only the VALUES are parameterized.
async function pgUpdateBrief(id, patch) {
  await runMigrations();
  const { sql } = await import('@vercel/postgres');
  const existing = await sql`SELECT id FROM briefs WHERE id = ${id}`;
  if (!existing.rows.length) return null;

  const sets = [];
  const values = [];
  let i = 1;
  for (const key of ALLOWED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      const coerced = coerceValue(key, patch[key]);
      sets.push(`"${key}" = $${i++}`);
      values.push(BOOL_FIELDS.has(key) ? !!coerced : coerced);
    }
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'submitted') && patch.submitted) {
    sets.push(`"submittedAt" = $${i++}`);
    values.push(new Date().toISOString());
  }
  if (sets.length === 0) return pgGetBrief(id);

  sets.push(`"updatedAt" = $${i++}`);
  values.push(new Date().toISOString());
  values.push(id);

  const query = `UPDATE briefs SET ${sets.join(', ')} WHERE id = $${i}`;
  await sql.query(query, values);
  return pgGetBrief(id);
}

async function pgSaveEdit(id, patch) {
  await runMigrations();
  const { sql } = await import('@vercel/postgres');
  const existing = await sql`SELECT id FROM briefs WHERE id = ${id}`;
  if (!existing.rows.length) return null;

  const sets = [];
  const values = [];
  let i = 1;
  for (const key of EDIT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      sets.push(`"${key}" = $${i++}`);
      values.push(patch[key] === null ? null : String(patch[key]));
    }
  }
  if (sets.length === 0) return pgGetBrief(id);

  sets.push(`"updatedAt" = $${i++}`);
  values.push(new Date().toISOString());
  values.push(id);

  const query = `UPDATE briefs SET ${sets.join(', ')} WHERE id = $${i}`;
  await sql.query(query, values);
  return pgGetBrief(id);
}

async function pgSaveGeneratedScript(id, { main, variation, source }) {
  await runMigrations();
  const { sql } = await import('@vercel/postgres');
  const existing = await sql`SELECT "scriptHistory" FROM briefs WHERE id = ${id}`;
  if (!existing.rows.length) return null;
  const now = new Date().toISOString();
  const history = parseScriptHistory(existing.rows[0].scriptHistory);
  history.push({ id: nanoid(10), main: main || '', variation: variation || '', source: source || '', createdAt: now });
  const historyJson = JSON.stringify(history.slice(-MAX_SCRIPT_HISTORY));
  await sql`
    UPDATE briefs SET
      "generatedScript" = ${main || ''},
      "generatedVarScript" = ${variation || ''},
      "scriptSource" = ${source || ''},
      "scriptHistory" = ${historyJson},
      "scriptGeneratedAt" = ${now},
      "editedScript" = NULL,
      "editedVarScript" = NULL,
      "scriptApproved" = false,
      "updatedAt" = ${now}
    WHERE id = ${id}
  `;
  return pgGetBrief(id);
}

// Re-points generatedScript/generatedVarScript at one of this brief's
// stored history entries — see memSelectScriptVersion for the in-memory
// twin of this function.
async function pgSelectScriptVersion(id, versionId) {
  await runMigrations();
  const { sql } = await import('@vercel/postgres');
  const existing = await sql`SELECT "scriptHistory" FROM briefs WHERE id = ${id}`;
  if (!existing.rows.length) return null;
  const history = parseScriptHistory(existing.rows[0].scriptHistory);
  const entry = history.find((h) => h.id === versionId);
  if (!entry) return null;
  const now = new Date().toISOString();
  await sql`
    UPDATE briefs SET
      "generatedScript" = ${entry.main || ''},
      "generatedVarScript" = ${entry.variation || ''},
      "scriptSource" = ${entry.source || ''},
      "scriptGeneratedAt" = ${entry.createdAt},
      "editedScript" = NULL,
      "editedVarScript" = NULL,
      "scriptApproved" = false,
      "updatedAt" = ${now}
    WHERE id = ${id}
  `;
  return pgGetBrief(id);
}

async function pgUpdateStatus(id, status) {
  await runMigrations();
  const { sql } = await import('@vercel/postgres');
  const existing = await sql`SELECT id FROM briefs WHERE id = ${id}`;
  if (!existing.rows.length) return null;
  const now = new Date().toISOString();
  await sql`UPDATE briefs SET "status" = ${status}, "updatedAt" = ${now} WHERE id = ${id}`;
  return pgGetBrief(id);
}

// See memUpdateTeamMeta above — same idea, Postgres side.
async function pgUpdateTeamMeta(id, { assignedTo, dueDate }) {
  await runMigrations();
  const { sql } = await import('@vercel/postgres');
  const existing = await sql`SELECT id FROM briefs WHERE id = ${id}`;
  if (!existing.rows.length) return null;

  const sets = [];
  const values = [];
  let i = 1;
  if (assignedTo !== undefined) { sets.push(`"assignedTo" = $${i++}`); values.push(assignedTo || ''); }
  if (dueDate !== undefined) { sets.push(`"dueDate" = $${i++}`); values.push(dueDate || ''); }
  if (sets.length === 0) return pgGetBrief(id);

  sets.push(`"updatedAt" = $${i++}`);
  values.push(new Date().toISOString());
  values.push(id);

  const query = `UPDATE briefs SET ${sets.join(', ')} WHERE id = $${i}`;
  await sql.query(query, values);
  return pgGetBrief(id);
}

// See memAddInternalNote above — same idea, Postgres side.
async function pgAddInternalNote(id, { author, text }) {
  await runMigrations();
  const { sql } = await import('@vercel/postgres');
  const existing = await sql`SELECT "internalNotes" FROM briefs WHERE id = ${id}`;
  if (!existing.rows.length) return null;
  const notes = parseInternalNotes(existing.rows[0].internalNotes);
  notes.push({ id: nanoid(10), author: author || '', text: text || '', createdAt: new Date().toISOString() });
  const now = new Date().toISOString();
  await sql`UPDATE briefs SET "internalNotes" = ${JSON.stringify(notes)}, "updatedAt" = ${now} WHERE id = ${id}`;
  return pgGetBrief(id);
}

async function pgInsertSentEmail({ id, briefId, to, subject, html }) {
  await runMigrations();
  const { sql } = await import('@vercel/postgres');
  await sql`
    INSERT INTO sent_emails (id, brief_id, to_email, subject, html, created_at)
    VALUES (${id}, ${briefId}, ${to}, ${subject}, ${html}, ${new Date().toISOString()})
  `;
}

async function pgListSentEmails() {
  await runMigrations();
  const { sql } = await import('@vercel/postgres');
  const { rows } = await sql`SELECT * FROM sent_emails ORDER BY created_at DESC`;
  return rows;
}

// ------------------------------------------------------------------------
// Public API — picks the backend based on POSTGRES_URL
// ------------------------------------------------------------------------
async function createBrief(id) {
  return USE_PG ? pgCreateBrief(id) : memCreateBrief(id);
}
async function getBrief(id) {
  return USE_PG ? pgGetBrief(id) : memGetBrief(id);
}
async function listBriefs() {
  return USE_PG ? pgListBriefs() : memListBriefs();
}
async function updateBrief(id, patch) {
  return USE_PG ? pgUpdateBrief(id, patch) : memUpdateBrief(id, patch);
}
async function saveEdit(id, patch) {
  return USE_PG ? pgSaveEdit(id, patch) : memSaveEdit(id, patch);
}
async function saveGeneratedScript(id, result) {
  return USE_PG ? pgSaveGeneratedScript(id, result) : memSaveGeneratedScript(id, result);
}
async function insertSentEmail(entry) {
  return USE_PG ? pgInsertSentEmail(entry) : memInsertSentEmail(entry);
}
async function listSentEmails() {
  return USE_PG ? pgListSentEmails() : memListSentEmails();
}
async function updateBriefStatus(id, status) {
  if (!STATUS_VALUES.includes(status)) {
    throw new Error(`Invalid status "${status}". Must be one of: ${STATUS_VALUES.join(', ')}`);
  }
  return USE_PG ? pgUpdateStatus(id, status) : memUpdateStatus(id, status);
}
async function selectScriptVersion(id, versionId) {
  return USE_PG ? pgSelectScriptVersion(id, versionId) : memSelectScriptVersion(id, versionId);
}
async function updateBriefTeamMeta(id, meta) {
  return USE_PG ? pgUpdateTeamMeta(id, meta) : memUpdateTeamMeta(id, meta);
}
async function addInternalNote(id, note) {
  return USE_PG ? pgAddInternalNote(id, note) : memAddInternalNote(id, note);
}

module.exports = {
  USE_PG,
  runMigrations,
  createBrief,
  getBrief,
  listBriefs,
  updateBrief,
  saveEdit,
  saveGeneratedScript,
  selectScriptVersion,
  insertSentEmail,
  listSentEmails,
  updateBriefStatus,
  updateBriefTeamMeta,
  addInternalNote,
  ALLOWED_FIELDS,
  BOOL_FIELDS,
  TRISTATE_FIELDS,
  EDIT_FIELDS,
  STATUS_VALUES,
  DEFAULT_STATUS,
  MAX_SCRIPT_HISTORY,
};
