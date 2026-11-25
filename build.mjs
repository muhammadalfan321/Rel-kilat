import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, 'public');
const DIST_DIR = path.resolve(__dirname, 'dist');
const GAME_HTML_PATH = path.resolve(
  PUBLIC_DIR,
  'assets/aistudio/rel-kilat-lengkap_ab50420c.html',
);

if (!fs.existsSync(GAME_HTML_PATH)) {
  console.error('Missing source HTML:', GAME_HTML_PATH);
  process.exit(1);
}

fs.rmSync(DIST_DIR, { recursive: true, force: true });
fs.mkdirSync(DIST_DIR, { recursive: true });
fs.cpSync(PUBLIC_DIR, DIST_DIR, { recursive: true, force: true });
fs.copyFileSync(GAME_HTML_PATH, path.join(DIST_DIR, 'index.html'));

console.log('Built dist/index.html from original Rel Kilat HTML.');
