// Version control for the AI script-generation prompt's opening instructions
// (the "command" that tells Claude/Gemini/Ollama how to write — tone,
// approach, what a good radio script sounds like). Producers manage this
// from /dashboard/prompt: see the current live version, draft a new one,
// make a draft live, or disable the live one.
//
// Only the opening instructional paragraphs are editable this way — the
// per-brief data block (KLANTBRIEF, OPBOUW, EISEN, and the JSON-output
// contract) stays hard-coded in lib/scriptgen.js's buildPrompt(), since
// that part has to reliably reflect the brief's real fields and keep the
// response parseable. Same dual Postgres/in-memory backend pattern as
// lib/db.js and lib/library.js.

import { nanoid } from 'nanoid';

const USE_PG = !!process.env.POSTGRES_URL;

// Exactly the two opening paragraphs that used to be hard-coded in
// buildPrompt() — seeded as version 1 so behavior is unchanged until a
// producer actually edits something.
export const DEFAULT_PROMPT_INTRO = [
  'Je bent een ervaren, gelauwerde radiocopywriter bij TFA. Je schrijft al jaren commercials die op de radio ECHT opvallen — niet omdat ze schreeuwen, maar omdat ze goed geschreven zijn: een scherpe invalshoek, natuurlijk ritme, en zinnen die prettig hardop lezen in plaats van zinnen die eruitzien als een opsomming van een briefingformulier.',
  'Schrijf een radiocommercial-script in het Nederlands, gebaseerd op de klantbrief hieronder. Lees de hele brief eerst als geheel — waar wil dit merk mee scoren, wat is de emotie of het gemak dat ze verkopen — en schrijf dan pas. Het resultaat moet klinken als één samenhangend verhaal van een copywriter, met een duidelijke opening, opbouw en afsluiting — nooit als losse feitjes uit de brief die na elkaar zijn geplakt.',
].join('\n\n');

function rowOut(row) {
  if (!row) return null;
  return {
    id: row.id,
    label: row.label,
    content: row.content,
    status: row.status, // 'live' | 'inactive'
    createdAt: row.createdAt,
  };
}

// ------------------------------------------------------------------------
// In-memory fallback
// ------------------------------------------------------------------------
const mem = { versions: null };

function seedIfEmpty() {
  if (mem.versions) return;
  mem.versions = [
    { id: nanoid(10), label: 'Versie 1 (origineel)', content: DEFAULT_PROMPT_INTRO, status: 'live', createdAt: new Date().toISOString() },
  ];
}

async function memList() {
  seedIfEmpty();
  return mem.versions.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map(rowOut);
}
async function memCreate({ label, content }) {
  seedIfEmpty();
  const entry = { id: nanoid(10), label: label || 'Naamloze versie', content: content || '', status: 'inactive', createdAt: new Date().toISOString() };
  mem.versions.push(entry);
  return rowOut(entry);
}
async function memActivate(id) {
  seedIfEmpty();
  const target = mem.versions.find((v) => v.id === id);
  if (!target) return null;
  mem.versions.forEach((v) => { v.status = v.id === id ? 'live' : 'inactive'; });
  return rowOut(target);
}
async function memDeactivate(id) {
  seedIfEmpty();
  const target = mem.versions.find((v) => v.id === id);
  if (!target) return null;
  target.status = 'inactive';
  return rowOut(target);
}
async function memUpdate(id, patch) {
  seedIfEmpty();
  const target = mem.versions.find((v) => v.id === id);
  if (!target) return null;
  if (patch.label !== undefined) target.label = patch.label;
  if (patch.content !== undefined) target.content = patch.content;
  return rowOut(target);
}
async function memGetLive() {
  seedIfEmpty();
  return mem.versions.find((v) => v.status === 'live') || null;
}

// ------------------------------------------------------------------------
// Postgres backend
// ------------------------------------------------------------------------
let migrated = false;
async function runMigrations() {
  if (!USE_PG || migrated) return;
  const { sql } = await import('@vercel/postgres');
  await sql`
    CREATE TABLE IF NOT EXISTS prompt_versions (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'inactive',
      "createdAt" TEXT NOT NULL
    );
  `;
  const { rows } = await sql`SELECT id FROM prompt_versions LIMIT 1`;
  if (!rows.length) {
    await sql`
      INSERT INTO prompt_versions (id, label, content, status, "createdAt")
      VALUES (${nanoid(10)}, 'Versie 1 (origineel)', ${DEFAULT_PROMPT_INTRO}, 'live', ${new Date().toISOString()})
    `;
  }
  migrated = true;
}

async function pgList() {
  await runMigrations();
  const { sql } = await import('@vercel/postgres');
  const { rows } = await sql`SELECT * FROM prompt_versions ORDER BY "createdAt" DESC`;
  return rows.map(rowOut);
}
async function pgCreate({ label, content }) {
  await runMigrations();
  const { sql } = await import('@vercel/postgres');
  const entry = { id: nanoid(10), label: label || 'Naamloze versie', content: content || '', status: 'inactive', createdAt: new Date().toISOString() };
  await sql`INSERT INTO prompt_versions (id, label, content, status, "createdAt") VALUES (${entry.id}, ${entry.label}, ${entry.content}, ${entry.status}, ${entry.createdAt})`;
  return entry;
}
async function pgActivate(id) {
  await runMigrations();
  const { sql } = await import('@vercel/postgres');
  const existing = await sql`SELECT id FROM prompt_versions WHERE id = ${id}`;
  if (!existing.rows.length) return null;
  await sql`UPDATE prompt_versions SET status = 'inactive'`;
  await sql`UPDATE prompt_versions SET status = 'live' WHERE id = ${id}`;
  const { rows } = await sql`SELECT * FROM prompt_versions WHERE id = ${id}`;
  return rowOut(rows[0]);
}
async function pgDeactivate(id) {
  await runMigrations();
  const { sql } = await import('@vercel/postgres');
  const existing = await sql`SELECT id FROM prompt_versions WHERE id = ${id}`;
  if (!existing.rows.length) return null;
  await sql`UPDATE prompt_versions SET status = 'inactive' WHERE id = ${id}`;
  const { rows } = await sql`SELECT * FROM prompt_versions WHERE id = ${id}`;
  return rowOut(rows[0]);
}
async function pgUpdate(id, patch) {
  await runMigrations();
  const { sql } = await import('@vercel/postgres');
  const { rows: existingRows } = await sql`SELECT * FROM prompt_versions WHERE id = ${id}`;
  const current = existingRows[0];
  if (!current) return null;
  const label = patch.label !== undefined ? patch.label : current.label;
  const content = patch.content !== undefined ? patch.content : current.content;
  await sql`UPDATE prompt_versions SET label = ${label}, content = ${content} WHERE id = ${id}`;
  const { rows } = await sql`SELECT * FROM prompt_versions WHERE id = ${id}`;
  return rowOut(rows[0]);
}
async function pgGetLive() {
  await runMigrations();
  const { sql } = await import('@vercel/postgres');
  const { rows } = await sql`SELECT * FROM prompt_versions WHERE status = 'live' LIMIT 1`;
  return rows[0] ? rowOut(rows[0]) : null;
}

// ------------------------------------------------------------------------
// Public API
// ------------------------------------------------------------------------
export async function listPromptVersions() {
  return USE_PG ? pgList() : memList();
}
export async function createPromptVersion(data) {
  return USE_PG ? pgCreate(data) : memCreate(data);
}
export async function activatePromptVersion(id) {
  return USE_PG ? pgActivate(id) : memActivate(id);
}
export async function deactivatePromptVersion(id) {
  return USE_PG ? pgDeactivate(id) : memDeactivate(id);
}
// Edits a version's name and/or instructions in place — works on both a live
// and an inactive version (editing the live one changes what's in effect
// immediately, same as editing any other producer-facing setting).
export async function updatePromptVersion(id, patch) {
  return USE_PG ? pgUpdate(id, patch) : memUpdate(id, patch);
}
// Returns just the live version's content, or '' if none is live (callers
// fall back to DEFAULT_PROMPT_INTRO in that case) — never throws, so a
// prompt-store hiccup never blocks script generation.
export async function getLivePromptIntro() {
  try {
    const live = USE_PG ? await pgGetLive() : await memGetLive();
    return (live && live.content) || '';
  } catch (err) {
    console.error('[promptVersions] getLivePromptIntro failed, using default:', err.message);
    return '';
  }
}
