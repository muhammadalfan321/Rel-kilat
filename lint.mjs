import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

for (const file of ['server.mjs', 'build.mjs', 'lint.mjs']) {
  execFileSync(process.execPath, ['--check', path.join(__dirname, file)], {
    stdio: 'inherit',
  });
}

const gameHtmlPath = path.join(
  __dirname,
  'public/assets/aistudio/rel-kilat-lengkap_ab50420c.html',
);
const html = fs.readFileSync(gameHtmlPath, 'utf8');
const scriptMatches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)];
if (scriptMatches.length === 0) {
  throw new Error('No <script> block found in Rel Kilat HTML');
}

for (const match of scriptMatches) {
  new vm.Script(match[1], { filename: 'rel-kilat-inline-script.js' });
}

console.log('Lint and syntax checks passed.');
