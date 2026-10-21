// Builds the offline lookup data shipped with DarkMirror (resources/data/):
//   geoip.bin       IP → country, from DB-IP "IP to Country Lite" (CC BY 4.0, https://db-ip.com)
//   countries.json  country centroid lat/lon (Google DSPL canonical countries table, Apache-2.0)
//   oui.json.gz     MAC prefix → manufacturer (IEEE MA-L public registry)
//
// Usage: node scripts/build-data.mjs [YYYY-MM]
// Downloads the sources, so it needs network access. Run it monthly to refresh GeoIP.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'resources', 'data');
fs.mkdirSync(OUT, { recursive: true });

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function ipv4ToInt(ip) {
  return ip.split('.').reduce((n, o) => n * 256 + Number(o), 0);
}

// First 64 bits of an IPv6 address as [hi, lo] uint32
function ipv6Prefix(ip) {
  let [head, tail = ''] = ip.split('::');
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const groups = [...h, ...Array(8 - h.length - t.length).fill('0'), ...t].map((g) => parseInt(g || '0', 16));
  return [((groups[0] << 16) | groups[1]) >>> 0, ((groups[2] << 16) | groups[3]) >>> 0];
}

async function buildGeoip(month) {
  const csv = zlib.gunzipSync(await download(`https://download.db-ip.com/free/dbip-country-lite-${month}.csv.gz`)).toString('utf8');
  const codes = ['ZZ'];
  const codeIdx = new Map([['ZZ', 0]]);
  const idx = (c) => {
    if (!codeIdx.has(c)) {
      codeIdx.set(c, codes.length);
      codes.push(c);
    }
    return codeIdx.get(c);
  };
  const v4 = [];
  const v6 = [];
  for (const line of csv.split('\n')) {
    const [start, end, cc] = line.trim().split(',');
    if (!cc) continue;
    if (start.includes(':')) v6.push([ipv6Prefix(start), ipv6Prefix(end), idx(cc)]);
    else v4.push([ipv4ToInt(start), ipv4ToInt(end), idx(cc)]);
  }

  // Ranges with gaps filled by "ZZ" (unknown) and neighbours of the same country merged
  const v4Starts = [];
  const v4Codes = [];
  let expected = 0;
  for (const [s, e, c] of v4.sort((a, b) => a[0] - b[0])) {
    if (s > expected) {
      v4Starts.push(expected);
      v4Codes.push(0);
    }
    if (!v4Codes.length || v4Codes[v4Codes.length - 1] !== c) {
      v4Starts.push(s);
      v4Codes.push(c);
    }
    expected = e + 1;
  }

  const cmp = (a, b) => (a[0] - b[0]) || (a[1] - b[1]);
  const v6Hi = [];
  const v6Lo = [];
  const v6Codes = [];
  for (const [s, , c] of v6.sort((a, b) => cmp(a[0], b[0]))) {
    if (!v6Codes.length || v6Codes[v6Codes.length - 1] !== c) {
      v6Hi.push(s[0]);
      v6Lo.push(s[1]);
      v6Codes.push(c);
    }
  }

  const header = Buffer.from(JSON.stringify({ source: `DB-IP IP to Country Lite ${month}`, license: 'CC BY 4.0', codes, v4: v4Starts.length, v6: v6Codes.length }));
  const parts = [
    Buffer.from(Uint32Array.of(header.length).buffer),
    header,
    Buffer.alloc((4 - (header.length % 4)) % 4),
    Buffer.from(Uint32Array.from(v4Starts).buffer),
    Buffer.from(Uint32Array.from(v6Hi).buffer),
    Buffer.from(Uint32Array.from(v6Lo).buffer),
    Buffer.from(Uint8Array.from(v4Codes).buffer),
    Buffer.from(Uint8Array.from(v6Codes).buffer)
  ];
  fs.writeFileSync(path.join(OUT, 'geoip.bin'), Buffer.concat(parts));
  console.log(`geoip.bin: ${v4Starts.length} IPv4 + ${v6Codes.length} IPv6 ranges, ${codes.length} codes`);
}

async function buildCountries() {
  // Google DSPL canonical countries table (Apache-2.0)
  const csv = (await download('https://raw.githubusercontent.com/google/dspl/master/samples/google/canonical/countries.csv')).toString('utf8');
  const out = {};
  for (const line of csv.split('\n').slice(1)) {
    const m = line.match(/^([A-Z]{2}),(-?[\d.]+),(-?[\d.]+),/);
    if (m) out[m[1]] = [Number(Number(m[2]).toFixed(2)), Number(Number(m[3]).toFixed(2))];
  }
  fs.writeFileSync(path.join(OUT, 'countries.json'), JSON.stringify(out));
  console.log(`countries.json: ${Object.keys(out).length} centroids`);
}

async function buildOui() {
  const csv = (await download('https://standards-oui.ieee.org/oui/oui.csv')).toString('utf8');
  const out = {};
  for (const line of csv.split('\n').slice(1)) {
    const m = line.match(/^MA-L,([0-9A-F]{6}),("([^"]*)"|[^,]*)/);
    if (m) out[m[1]] = (m[3] ?? m[2]).trim();
  }
  fs.writeFileSync(path.join(OUT, 'oui.json.gz'), zlib.gzipSync(JSON.stringify(out), { level: 9 }));
  console.log(`oui.json.gz: ${Object.keys(out).length} manufacturers`);
}

const month = process.argv[2] || new Date().toISOString().slice(0, 7);
await buildGeoip(month);
await buildCountries();
await buildOui();
