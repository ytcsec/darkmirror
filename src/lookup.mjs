// Offline lookups built by scripts/build-data.mjs:
//   IP → country (DB-IP Lite, CC BY 4.0), country centroid, MAC prefix → manufacturer (IEEE).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import net from 'node:net';

let geo = null;
let centroids = {};
let oui = {};
const countryNames = new Intl.DisplayNames(['tr'], { type: 'region' });

export function loadLookups(dataDir) {
  try {
    const buf = fs.readFileSync(path.join(dataDir, 'geoip.bin'));
    const headerLen = buf.readUInt32LE(0);
    const header = JSON.parse(buf.subarray(4, 4 + headerLen).toString('utf8'));
    let off = 4 + headerLen + ((4 - (headerLen % 4)) % 4);
    const u32 = (n) => {
      const arr = new Uint32Array(buf.buffer, buf.byteOffset + off, n);
      off += n * 4;
      return arr;
    };
    const v4Starts = u32(header.v4);
    const v6Hi = u32(header.v6);
    const v6Lo = u32(header.v6);
    const v4Codes = new Uint8Array(buf.buffer, buf.byteOffset + off, header.v4);
    off += header.v4;
    const v6Codes = new Uint8Array(buf.buffer, buf.byteOffset + off, header.v6);
    geo = { ...header, v4Starts, v6Hi, v6Lo, v4Codes, v6Codes };
  } catch {
    geo = null;
  }
  try {
    centroids = JSON.parse(fs.readFileSync(path.join(dataDir, 'countries.json'), 'utf8'));
  } catch {
    centroids = {};
  }
  try {
    oui = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dataDir, 'oui.json.gz'))).toString('utf8'));
  } catch {
    oui = {};
  }
  return { geoip: Boolean(geo), geoSource: geo?.source || null, centroids: Object.keys(centroids).length, oui: Object.keys(oui).length };
}

export function isPrivateIp(ip) {
  if (!ip) return true;
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 10 || a === 127 || a === 0 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
      a >= 224
    );
  }
  const l = ip.toLowerCase();
  return l === '::1' || l === '::' || l.startsWith('fe80:') || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('ff');
}

function upperBound(arr, value) {
  // index of the last element <= value
  let lo = 0;
  let hi = arr.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid] <= value) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

function v6Prefix(ip) {
  const [head, tail = ''] = ip.toLowerCase().split('::');
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const g = [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t].map((x) => parseInt(x || '0', 16) || 0);
  return [((g[0] << 16) | g[1]) >>> 0, ((g[2] << 16) | g[3]) >>> 0];
}

export function countryOf(ip) {
  if (!geo || !ip || isPrivateIp(ip)) return null;
  let code = 'ZZ';
  if (net.isIPv4(ip)) {
    const n = ip.split('.').reduce((acc, o) => acc * 256 + Number(o), 0) >>> 0;
    const i = upperBound(geo.v4Starts, n);
    if (i >= 0) code = geo.codes[geo.v4Codes[i]];
  } else if (net.isIPv6(ip)) {
    const [hi, lo] = v6Prefix(ip);
    let a = 0;
    let b = geo.v6Hi.length - 1;
    let ans = -1;
    while (a <= b) {
      const mid = (a + b) >>> 1;
      const mh = geo.v6Hi[mid];
      const le = mh < hi || (mh === hi && geo.v6Lo[mid] <= lo);
      if (le) {
        ans = mid;
        a = mid + 1;
      } else b = mid - 1;
    }
    if (ans >= 0) code = geo.codes[geo.v6Codes[ans]];
  }
  return code && code !== 'ZZ' ? code : null;
}

export function countryInfo(code) {
  if (!code) return null;
  const c = centroids[code];
  let name = code;
  try {
    name = countryNames.of(code) || code;
  } catch {}
  return { code, name, lat: c ? c[0] : null, lon: c ? c[1] : null };
}

export function macVendor(mac) {
  const norm = String(mac || '').toUpperCase().replace(/[^0-9A-F]/g, '');
  if (norm.length < 6) return { vendor: null, randomized: false };
  // Locally administered bit (second hex digit 2/6/A/E): randomized / private MAC
  const randomized = ['2', '6', 'A', 'E'].includes(norm[1]);
  return { vendor: oui[norm.slice(0, 6)] || null, randomized };
}

export const GEOIP_ATTRIBUTION = 'IP geolocation by DB-IP (https://db-ip.com), CC BY 4.0';
