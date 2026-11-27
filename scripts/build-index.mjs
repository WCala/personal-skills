#!/usr/bin/env node
// Genera index.json: l'elenco che l'app legge per mostrare le skill disponibili.
// Per ogni skill riporta il manifest e l'elenco dei file con dimensione e impronta
// sha256, che l'app controlla dopo ogni download.
//
//   node scripts/build-index.mjs           scrive index.json (solo se qualcosa è cambiato)
//   node scripts/build-index.mjs --check   controlla soltanto; esce con errore se è da rigenerare

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillsDir = path.join(root, "skills");
const indexPath = path.join(root, "index.json");
const check = process.argv.includes("--check");

const ID = /^[a-z][a-z0-9-]{0,46}[a-z0-9]$/;
const SEGMENT = /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/;
const PERMISSIONS = ["net", "notifications"];
const PLATFORMS = ["windows", "linux", "macos", "android"];
const MAX_FILE = 20 * 1024 * 1024;

// catalog.json (facoltativo) dà un nome al catalogo e dice chi lo cura.
let catalog = {};
try { catalog = JSON.parse(fs.readFileSync(path.join(root, "catalog.json"), "utf8")); } catch {}
const meta = {};
if (typeof catalog.name === "string" && catalog.name.trim()) meta.name = catalog.name.trim().slice(0, 80);
if (typeof catalog.maintainer === "string" && catalog.maintainer.trim()) meta.maintainer = catalog.maintainer.trim().slice(0, 80);

const errors = [];
const fail = (id, msg) => errors.push(`${id}: ${msg}`);

function listFiles(dir, prefix = "") {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listFiles(path.join(dir, entry.name), rel));
    else if (entry.isFile()) out.push(rel);
  }
  return out.sort();
}

const skills = [];
const folders = fs.existsSync(skillsDir)
  ? fs.readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()
  : [];

for (const folder of folders) {
  const dir = path.join(skillsDir, folder);
  const manifestPath = path.join(dir, "manifest.json");
  if (!fs.existsSync(manifestPath)) { fail(folder, "manca manifest.json"); continue; }

  let m;
  try { m = JSON.parse(fs.readFileSync(manifestPath, "utf8")); }
  catch (e) { fail(folder, `manifest.json non valido (${e.message})`); continue; }

  if (m.id !== folder) fail(folder, `l'id del manifest ("${m.id}") deve coincidere con il nome della cartella`);
  if (!ID.test(folder)) fail(folder, "id non valido: minuscole, cifre e trattini, da 2 a 48 caratteri");
  if (!m.name || !m.version) fail(folder, "nome e versione sono obbligatori");
  if (m.author !== undefined && (typeof m.author !== "string" || !m.author.trim() || m.author.length > 80))
    fail(folder, "`author` deve essere un testo di massimo 80 caratteri");
  for (const p of m.permissions ?? []) if (!PERMISSIONS.includes(p)) fail(folder, `permesso sconosciuto "${p}"`);
  for (const p of m.platforms ?? []) if (!PLATFORMS.includes(p)) fail(folder, `piattaforma sconosciuta "${p}"`);
  if ((m.net?.allow?.length ?? 0) > 0 && !(m.permissions ?? []).includes("net"))
    fail(folder, 'net.allow richiede il permesso "net"');

  const files = [];
  for (const rel of listFiles(dir)) {
    if (!rel.split("/").every((s) => SEGMENT.test(s))) { fail(folder, `nome di file non ammesso: ${rel}`); continue; }
    const bytes = fs.readFileSync(path.join(dir, rel));
    if (bytes.length > MAX_FILE) fail(folder, `${rel} supera i 20 MB`);
    files.push({ path: rel, sha256: createHash("sha256").update(bytes).digest("hex"), size: bytes.length });
  }
  const entry = m.entry ?? "index.html";
  if (!files.some((f) => f.path === entry)) fail(folder, `manca il file di ingresso "${entry}"`);
  if (m.icon && !files.some((f) => f.path === m.icon)) fail(folder, `manca l'icona "${m.icon}"`);

  skills.push({ ...m, files });
}

if (errors.length) {
  console.error("Catalogo non valido:\n" + errors.map((e) => "  - " + e).join("\n"));
  process.exit(1);
}

// La data cambia solo se cambia il contenuto: niente commit a vuoto.
let previous = null;
try { previous = JSON.parse(fs.readFileSync(indexPath, "utf8")); } catch {}
const same =
  previous &&
  JSON.stringify(previous.skills) === JSON.stringify(skills) &&
  previous.name === meta.name &&
  previous.maintainer === meta.maintainer;

if (same) {
  console.log(`index.json è già aggiornato (${skills.length} skill).`);
} else if (check) {
  console.error("index.json non è aggiornato: esegui `node scripts/build-index.mjs`.");
  process.exit(1);
} else {
  const index = { schema: 1, ...meta, generatedAt: new Date().toISOString(), skills };
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2) + "\n");
  console.log(`index.json scritto: ${skills.length} skill.`);
}
