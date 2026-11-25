'use strict';
/* Copies the dashboard (index.html, css/*.css, js/*.js) into public/ for Vercel's CDN.
 * Allow-list only: server code, tests, data, docs and config are never published.
 *   node scripts/build-static.js [outDir]   (default: public) */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const out = path.resolve(process.argv[2] || path.join(ROOT, 'public'));
const ALLOWED = { css: /^[\w.-]+\.css$/, js: /^[\w.-]+\.js$/ };

// The output folder is emptied first, so it must be public/ itself or somewhere outside the project
// (tests build into a temp folder), never the project, one of its parents, or any other folder inside it.
const PUBLIC = path.join(ROOT, 'public');
const norm = p => (process.platform === 'win32' ? p.toLowerCase() : p); // Windows paths ignore case
const inside = (child, parent) => norm(child) === norm(parent) || norm(child).startsWith(norm(parent) + path.sep);
if (norm(out) !== norm(PUBLIC) && (inside(out, ROOT) || inside(ROOT, out))) throw new Error(`Refusing to build into ${out}`);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.copyFileSync(path.join(ROOT, 'index.html'), path.join(out, 'index.html'));
let n = 1;
for (const [dir, re] of Object.entries(ALLOWED)) {
  fs.mkdirSync(path.join(out, dir), { recursive: true });
  for (const name of fs.readdirSync(path.join(ROOT, dir))) {
    const src = path.join(ROOT, dir, name);
    if (re.test(name) && fs.statSync(src).isFile()) { fs.copyFileSync(src, path.join(out, dir, name)); n++; }
  }
}
console.log(`Static build: ${n} files in ${path.relative(ROOT, out) || out}`);
