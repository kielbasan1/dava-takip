import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OWNER = process.env.GH_OWNER || 'kielbasan1';
const REPO = process.env.GH_REPO || 'dava-takip';
const TOKEN = process.env.GH_TOKEN || '';
const API = `https://api.github.com/repos/${OWNER}/${REPO}`;

async function gh(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'User-Agent': 'devcontainer',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

const EXCLUDE = new Set(['.git', '.cache', '.config', '.local', '.npm', '.ssh', 'node_modules']);
function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE.has(ent.name) || ent.name.startsWith('.')) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(full));
    else out.push({ path: path.relative(ROOT, full), full });
  }
  return out;
}

const files = walk(ROOT);
console.log('Dosyalar:', files.map((f) => f.path).join(', '));

const tree = [];
for (const f of files) {
  const enc = fs.readFileSync(f.full).toString('base64');
  const blob = await gh('POST', `${API}/git/blobs`, { content: enc, encoding: 'base64' });
  tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
  console.log(`blob ok: ${f.path}`);
}

const theTree = await gh('POST', `${API}/git/trees`, { tree });
const commit = await gh('POST', `${API}/git/commits`, {
  message: 'Dava Takip PWA: görev, dava, dosya takibi + bildirimler',
  tree: theTree.sha,
  parents: [],
});
console.log('commit:', commit.sha);

try {
  await gh('POST', `${API}/git/refs`, { ref: 'refs/heads/main', sha: commit.sha });
  console.log('ref refs/heads/main olusturuldu');
} catch (e) {
  if (String(e).includes('422')) console.log('ref zaten var (update deneyecegim)');
  else throw e;
}
try {
  const res = await fetch(`${API}/git/refs/heads/main`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json','User-Agent':'x' },
    body: JSON.stringify({ sha: commit.sha, force: true }),
  });
  const d = await res.json();
  console.log('ref guncellendi:', d.sha || JSON.stringify(d));
} catch (e) {
  console.log('ref guncelleme atlaniyor:', String(e));
}