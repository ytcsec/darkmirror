// Compiles native/dmprobe.cs with the C# compiler that ships with Windows (.NET Framework 4.x).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const windir = process.env.WINDIR || 'C:\\Windows';
const candidates = [
  path.join(windir, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'),
  path.join(windir, 'Microsoft.NET', 'Framework', 'v4.0.30319', 'csc.exe')
];
const csc = candidates.find((p) => fs.existsSync(p));
if (!csc) {
  console.error('csc.exe bulunamadı. .NET Framework 4.x gerekli (Windows 10/11 ile birlikte gelir).');
  process.exit(1);
}

const outDir = path.join(ROOT, 'build');
fs.mkdirSync(outDir, { recursive: true });
execFileSync(
  csc,
  ['/nologo', '/optimize+', '/platform:anycpu', '/target:exe', `/out:${path.join(outDir, 'dmprobe.exe')}`, path.join(ROOT, 'native', 'dmprobe.cs')],
  { stdio: 'inherit' }
);
console.log('build/dmprobe.exe hazır');
