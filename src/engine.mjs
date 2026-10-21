// DarkMirror engine: collects real network telemetry, keeps local history in SQLite
// and raises alerts only for things that are dangerous or unknown.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import readline from 'node:readline';
import { EventEmitter } from 'node:events';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { loadLookups, countryOf, countryInfo, isPrivateIp, macVendor, GEOIP_ATTRIBUTION } from './lookup.mjs';
import * as win from './windows.mjs';

const execFileAsync = promisify(execFile);
export const events = new EventEmitter();

let db = null;
let opts = null;
let probeProc = null;
const timers = [];

export const status = {
  admin: false,
  estats: false,
  probe: 'starting', // starting | running | fallback | stopped
  geoSource: null,
  geoAttribution: GEOIP_ATTRIBUTION,
  lastTick: 0
};

export let adapter = { adapterName: null, localIp: null, gateway: null, dnsServers: [], macAddress: null, lastScanTs: null };
export let home = null;
export let currentSpeed = { inBps: 0, outBps: 0, activeConnections: 0, ts: 0 };
export let liveByApp = new Map(); // appId -> live connection count

// ---------------------------------------------------------------- database
const SCHEMA = `
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS apps (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, exe_path TEXT,
    signature TEXT NOT NULL DEFAULT 'pending', signer TEXT, company TEXT, version TEXT,
    file_mtime INTEGER, sha256 TEXT,
    vt_status TEXT NOT NULL DEFAULT 'unscanned', vt_detections INTEGER, vt_total INTEGER, vt_last_scan INTEGER,
    blocked INTEGER NOT NULL DEFAULT 0,
    first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL,
    bytes_in INTEGER NOT NULL DEFAULT 0, bytes_out INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS hosts (
    ip TEXT PRIMARY KEY, hostname TEXT, country_code TEXT, is_lan INTEGER NOT NULL DEFAULT 0,
    first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL,
    bytes_in INTEGER NOT NULL DEFAULT 0, bytes_out INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS app_host (
    app_id TEXT NOT NULL, host_ip TEXT NOT NULL, port INTEGER NOT NULL,
    bytes_in INTEGER NOT NULL DEFAULT 0, bytes_out INTEGER NOT NULL DEFAULT 0,
    first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL,
    PRIMARY KEY (app_id, host_ip, port)
  );
  CREATE TABLE IF NOT EXISTS usage_hour (
    hour INTEGER NOT NULL, kind TEXT NOT NULL, key TEXT NOT NULL,
    bytes_in INTEGER NOT NULL DEFAULT 0, bytes_out INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (hour, kind, key)
  );
  CREATE TABLE IF NOT EXISTS samples (ts INTEGER PRIMARY KEY, rx_rate INTEGER NOT NULL, tx_rate INTEGER NOT NULL, conns INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, type TEXT NOT NULL, level TEXT NOT NULL,
    title TEXT NOT NULL, detail TEXT NOT NULL, app_id TEXT, app_name TEXT, host_ip TEXT,
    old_value TEXT, new_value TEXT, notified INTEGER NOT NULL DEFAULT 0, is_read INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS devices (
    mac TEXT PRIMARY KEY, ip TEXT NOT NULL, hostname TEXT, vendor TEXT, randomized INTEGER NOT NULL DEFAULT 0,
    kind TEXT, custom_name TEXT, notes TEXT, first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL
  );
`;

const DEFAULT_SETTINGS = {
  incognito: 'false',
  snooze: 'false',
  rules_enabled: 'true',
  bandwidth_quota_gb: '100',
  vt_api_key: '',
  bytes_measured: 'false'
};
const USER_SETTINGS = new Set(['incognito', 'snooze', 'rules_enabled', 'bandwidth_quota_gb', 'vt_api_key']);

let stmt = {};

function prepareStatements() {
  stmt = {
    getSetting: db.prepare('SELECT value FROM settings WHERE key = ?'),
    setSetting: db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'),
    getApp: db.prepare('SELECT * FROM apps WHERE id = ?'),
    insApp: db.prepare(`INSERT INTO apps (id, name, exe_path, first_seen, last_seen) VALUES (?, ?, ?, ?, ?)`),
    touchApp: db.prepare('UPDATE apps SET last_seen = ?, bytes_in = bytes_in + ?, bytes_out = bytes_out + ? WHERE id = ?'),
    setTrust: db.prepare('UPDATE apps SET signature = ?, signer = ?, company = ?, version = ?, file_mtime = ? WHERE id = ?'),
    getHost: db.prepare('SELECT ip FROM hosts WHERE ip = ?'),
    upHost: db.prepare(`INSERT INTO hosts (ip, hostname, country_code, is_lan, first_seen, last_seen, bytes_in, bytes_out)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(ip) DO UPDATE SET last_seen = excluded.last_seen, bytes_in = hosts.bytes_in + excluded.bytes_in, bytes_out = hosts.bytes_out + excluded.bytes_out`),
    setHostname: db.prepare('UPDATE hosts SET hostname = ? WHERE ip = ?'),
    upAppHost: db.prepare(`INSERT INTO app_host (app_id, host_ip, port, bytes_in, bytes_out, first_seen, last_seen)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(app_id, host_ip, port) DO UPDATE SET bytes_in = app_host.bytes_in + excluded.bytes_in,
        bytes_out = app_host.bytes_out + excluded.bytes_out, last_seen = excluded.last_seen`),
    upUsage: db.prepare(`INSERT INTO usage_hour (hour, kind, key, bytes_in, bytes_out) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(hour, kind, key) DO UPDATE SET bytes_in = usage_hour.bytes_in + excluded.bytes_in, bytes_out = usage_hour.bytes_out + excluded.bytes_out`),
    insSample: db.prepare('INSERT OR REPLACE INTO samples (ts, rx_rate, tx_rate, conns) VALUES (?, ?, ?, ?)'),
    insEvent: db.prepare(`INSERT INTO events (ts, type, level, title, detail, app_id, app_name, host_ip, old_value, new_value, notified)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    upDevice: db.prepare(`INSERT INTO devices (mac, ip, hostname, vendor, randomized, kind, first_seen, last_seen)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(mac) DO UPDATE SET ip = excluded.ip, hostname = COALESCE(excluded.hostname, devices.hostname),
        vendor = COALESCE(excluded.vendor, devices.vendor), kind = excluded.kind, last_seen = excluded.last_seen`),
    getDevice: db.prepare('SELECT * FROM devices WHERE mac = ?')
  };
}

export function getDb() {
  return db;
}

export function getSettings() {
  const out = { ...DEFAULT_SETTINGS };
  for (const r of db.prepare('SELECT key, value FROM settings').all()) out[r.key] = r.value;
  return out;
}

function setInternal(key, value) {
  stmt.setSetting.run(key, String(value));
}

export function updateSettings(patch) {
  for (const [k, v] of Object.entries(patch || {})) {
    if (USER_SETTINGS.has(k)) setInternal(k, typeof v === 'boolean' ? String(v) : String(v ?? ''));
  }
  const s = getSettings();
  events.emit('settings', publicSettings(s));
  return publicSettings(s);
}

export function publicSettings(s = getSettings()) {
  const { vt_api_key, ...rest } = s;
  return { ...rest, vt_key_set: vt_api_key ? 'true' : 'false' };
}

// ---------------------------------------------------------------- events / alerts
// level: info (history only) | caution | threat. notify: shown as a desktop notification.
export function recordEvent({ type, level = 'info', notify = false, title, detail, app_id = null, app_name = null, host_ip = null, old_value = null, new_value = null }) {
  const s = getSettings();
  if (s.incognito === 'true') return null;
  const ts = Date.now();
  const deliver = notify && s.snooze !== 'true';
  const info = stmt.insEvent.run(ts, type, level, title, detail, app_id, app_name, host_ip, old_value, new_value, deliver ? 1 : 0);
  const ev = { id: Number(info.lastInsertRowid), ts, type, level, title, detail, app_id, app_name, host_ip, old_value, new_value, is_read: 0 };
  if (deliver) events.emit('alert', ev);
  return ev;
}

// ---------------------------------------------------------------- telemetry
const hourOf = (ts) => Math.floor(ts / 3600000);
const prevConn = new Map(); // conn key -> { in, out }
const pidPath = new Map(); // pid -> exe path (from probe)
let pidNames = new Map(); // pid -> image name (tasklist)
let lastNamesRefresh = 0;
let prevIface = null;
const trustQueue = new Set();
let trustBusy = false;
const sessionSeen = new Set();
const rdpAlerted = new Map();

function appIdentity(pid) {
  const p = pidPath.get(pid);
  if (p) return { id: p.toLowerCase(), name: path.basename(p), exePath: p };
  if (pid === 4) return { id: 'name:system', name: 'System', exePath: null };
  if (pid === 0) return { id: 'name:idle', name: 'System Idle', exePath: null };
  const n = pidNames.get(pid);
  return n ? { id: `name:${n.toLowerCase()}`, name: n, exePath: null } : { id: `pid:${pid}`, name: `PID ${pid}`, exePath: null };
}

function ensureApp(ident, now) {
  const existing = stmt.getApp.get(ident.id);
  if (!existing) {
    stmt.insApp.run(ident.id, ident.name, ident.exePath, now, now);
    if (ident.exePath) trustQueue.add(ident.id);
    else db.prepare("UPDATE apps SET signature = 'unknown' WHERE id = ?").run(ident.id);
    sessionSeen.add(ident.id);
    return { isNew: true };
  }
  if (!sessionSeen.has(ident.id)) {
    sessionSeen.add(ident.id);
    // Re-verify when the file on disk changed since we last checked it
    if (ident.exePath) {
      try {
        const mtime = Math.round(fs.statSync(ident.exePath).mtimeMs);
        if (existing.file_mtime && existing.file_mtime !== mtime) trustQueue.add(ident.id);
      } catch {}
    }
  }
  return { isNew: false };
}

async function processTrustQueue() {
  if (trustBusy || !trustQueue.size) return;
  trustBusy = true;
  const ids = [...trustQueue].slice(0, 40);
  ids.forEach((id) => trustQueue.delete(id));
  try {
    const apps = ids.map((id) => stmt.getApp.get(id)).filter((a) => a && a.exe_path);
    const results = await win.readFileTrust(apps.map((a) => a.exe_path));
    const byPath = new Map(results.map((r) => [String(r.path).toLowerCase(), r]));
    for (const a of apps) {
      const r = byPath.get(a.exe_path.toLowerCase());
      const signature = !r || !r.status ? 'unknown' : r.status === 'Valid' ? 'valid' : r.status === 'NotSigned' ? 'unsigned' : 'invalid';
      let mtime = null;
      try {
        mtime = Math.round(fs.statSync(a.exe_path).mtimeMs);
      } catch {}
      const wasVerified = a.signature !== 'pending';
      stmt.setTrust.run(signature, r?.signer || null, r?.company || null, r?.version || null, mtime, a.id);
      if (wasVerified && a.file_mtime && mtime && a.file_mtime !== mtime) {
        db.prepare('UPDATE apps SET sha256 = NULL, vt_status = ? WHERE id = ?').run('unscanned', a.id);
        if (signature !== 'valid') {
          recordEvent({
            type: 'binary_changed', level: 'caution', notify: true,
            title: `${a.name} dosyası değişti ve imzası doğrulanamıyor`,
            detail: `${a.exe_path} güncellendi ama yeni dosya ${signature === 'unsigned' ? 'imzasız' : 'geçersiz imzalı'}. Bu güncellemeyi siz yapmadıysanız inceleyin.`,
            app_id: a.id, app_name: a.name, new_value: a.exe_path
          });
        }
      } else if (!wasVerified && signature !== 'valid' && signature !== 'unknown') {
        recordEvent({
          type: 'unsigned_app', level: 'caution', notify: true,
          title: `İmzasız uygulama ağa bağlandı: ${a.name}`,
          detail: `${a.exe_path} dijital olarak ${signature === 'unsigned' ? 'imzalanmamış' : 'geçersiz imzalı'}. Tanımıyorsanız engelleyebilirsiniz.`,
          app_id: a.id, app_name: a.name, new_value: a.exe_path
        });
      }
    }
  } catch {}
  trustBusy = false;
}

function resolveHostname(ip) {
  dns
    .reverse(ip)
    .then((names) => {
      if (names && names[0]) stmt.setHostname.run(names[0], ip);
    })
    .catch(() => {});
}

function handleSnapshot(snap) {
  const now = Number(snap.t) || Date.now();
  status.admin = Boolean(snap.admin);
  status.estats = Boolean(snap.estats);
  status.estatsErr = snap.estatsErr || 0;
  status.lastTick = now;
  if (status.estats && getSettings().bytes_measured !== 'true') setInternal('bytes_measured', 'true');
  for (const [pid, p] of Object.entries(snap.paths || {})) pidPath.set(Number(pid), p);

  const s = getSettings();
  const recording = s.incognito !== 'true';
  const hour = hourOf(now);

  // Interface totals (all adapters): the ground truth for "how much traffic"
  let dIn = 0;
  let dOut = 0;
  let elapsed = 1.5;
  if (prevIface && snap.rx >= prevIface.rx && snap.tx >= prevIface.tx) {
    dIn = snap.rx - prevIface.rx;
    dOut = snap.tx - prevIface.tx;
    elapsed = Math.max(0.25, (now - prevIface.t) / 1000);
  }
  prevIface = { rx: snap.rx, tx: snap.tx, t: now };

  const conns = Array.isArray(snap.tcp) ? snap.tcp : [];
  if (conns.some(([pid]) => !pidPath.has(pid) && !pidNames.has(pid)) && now - lastNamesRefresh > 2000) {
    lastNamesRefresh = now;
    win.readProcessNames().then((m) => (pidNames = m));
  }

  const live = new Map();
  const seenKeys = new Set();
  const perApp = new Map();
  const perHost = new Map();

  for (const [pid, lip, lport, rip, rport, state, bin, bout] of conns) {
    const ident = appIdentity(pid);
    live.set(ident.id, (live.get(ident.id) || 0) + 1);
    const key = `${pid}|${lip}|${lport}|${rip}|${rport}`;
    seenKeys.add(key);

    let din = 0;
    let dout = 0;
    if (bin >= 0 && bout >= 0) {
      // The first reading of a connection is only a baseline: counters may include traffic from
      // before DarkMirror started watching it, so only growth after that point is attributed.
      const prev = prevConn.get(key);
      din = prev && bin >= prev.in ? bin - prev.in : 0;
      dout = prev && bout >= prev.out ? bout - prev.out : 0;
      prevConn.set(key, { in: bin, out: bout });
    }

    // Inbound remote desktop from the internet is worth a warning
    if (lport === 3389 && state === 5 && !isPrivateIp(rip)) {
      const last = rdpAlerted.get(rip) || 0;
      if (now - last > 3600000) {
        rdpAlerted.set(rip, now);
        recordEvent({
          type: 'rdp_inbound', level: 'threat', notify: true,
          title: 'İnternetten Uzak Masaüstü bağlantısı',
          detail: `${rip} adresinden bu bilgisayara Uzak Masaüstü (RDP, port 3389) bağlantısı kuruldu. Siz başlatmadıysanız bağlantıyı kesin.`,
          host_ip: rip
        });
      }
    }

    if (!recording || ident.id.startsWith('pid:')) continue;
    ensureApp(ident, now);
    const a = perApp.get(ident.id) || { in: 0, out: 0 };
    a.in += din;
    a.out += dout;
    perApp.set(ident.id, a);

    const isLan = isPrivateIp(rip) ? 1 : 0;
    if (!stmt.getHost.get(rip)) {
      stmt.upHost.run(rip, null, isLan ? null : countryOf(rip), isLan, now, now, 0, 0);
      resolveHostname(rip);
    }
    const h = perHost.get(rip) || { in: 0, out: 0 };
    h.in += din;
    h.out += dout;
    perHost.set(rip, h);
    stmt.upAppHost.run(ident.id, rip, rport, din, dout, now, now);
  }
  for (const k of prevConn.keys()) if (!seenKeys.has(k)) prevConn.delete(k);

  if (recording) {
    for (const [id, v] of perApp) {
      stmt.touchApp.run(now, v.in, v.out, id);
      if (v.in || v.out) stmt.upUsage.run(hour, 'app', id, v.in, v.out);
    }
    for (const [ip, v] of perHost) {
      stmt.upHost.run(ip, null, null, 0, now, now, v.in, v.out);
      if (v.in || v.out) stmt.upUsage.run(hour, 'host', ip, v.in, v.out);
    }
    if (dIn || dOut) stmt.upUsage.run(hour, 'iface', 'all', dIn, dOut);
  }

  liveByApp = live;
  currentSpeed = { inBps: Math.round(dIn / elapsed), outBps: Math.round(dOut / elapsed), activeConnections: conns.length, ts: now };
  if (recording) stmt.insSample.run(now, currentSpeed.inBps, currentSpeed.outBps, conns.length);

  processTrustQueue();
  events.emit('tick', { ts: now, rxRate: currentSpeed.inBps, txRate: currentSpeed.outBps, activeConnections: conns.length });
}

// Fallback when dmprobe.exe is unavailable: connection list only, no per-connection bytes
async function fallbackTick() {
  try {
    const [{ stdout }, eStats] = await Promise.all([
      execFileAsync('netstat.exe', ['-ano', '-p', 'TCP'], { timeout: 5000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 }),
      execFileAsync('netstat.exe', ['-e'], { timeout: 5000, windowsHide: true })
    ]);
    const tcp = [];
    for (const raw of stdout.split(/\r?\n/)) {
      const p = raw.trim().split(/\s+/);
      if (p[0] !== 'TCP' || p.length < 5 || p[3] !== 'ESTABLISHED') continue;
      const [lip, lport] = splitAddr(p[1]);
      const [rip, rport] = splitAddr(p[2]);
      if (!rip || rip.startsWith('127.') || rip === '::1') continue;
      tcp.push([Number(p[4]), lip, lport, rip, rport, 5, -1, -1]);
    }
    let rx = prevIface?.rx || 0;
    let tx = prevIface?.tx || 0;
    for (const line of eStats.stdout.split(/\r?\n/)) {
      const m = line.trim().match(/^\S.*?\s(\d+)\s+(\d+)$/);
      if (m && /byte|bayt/i.test(line)) {
        rx = Number(m[1]);
        tx = Number(m[2]);
      }
    }
    handleSnapshot({ t: Date.now(), admin: status.admin, estats: false, rx, tx, tcp, paths: {} });
  } catch {}
}

function splitAddr(a) {
  const i = a.lastIndexOf(':');
  return [a.slice(0, i).replace(/^\[|\]$/g, ''), Number(a.slice(i + 1)) || 0];
}

function startProbe() {
  if (!opts.probePath || !fs.existsSync(opts.probePath)) {
    status.probe = 'fallback';
    timers.push(setInterval(fallbackTick, 2000));
    fallbackTick();
    return;
  }
  probeProc = spawn(opts.probePath, ['1500'], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
  status.probe = 'running';
  const rl = readline.createInterface({ input: probeProc.stdout });
  rl.on('line', (line) => {
    try {
      const snap = JSON.parse(line);
      if (!snap.error) handleSnapshot(snap);
    } catch {}
  });
  probeProc.on('exit', () => {
    probeProc = null;
    if (status.probe === 'running') {
      status.probe = 'fallback';
      timers.push(setInterval(fallbackTick, 2000));
    }
  });
}

// ---------------------------------------------------------------- LAN & system monitors
export async function scanLan() {
  const now = Date.now();
  const cfg = await win.readNetworkConfig();
  if (cfg) {
    adapter = { ...cfg, lastScanTs: now };
    const s = getSettings();
    const dnsKey = cfg.dnsServers.join(', ');
    if (dnsKey) {
      if (s.last_dns && s.last_dns !== dnsKey) {
        recordEvent({
          type: 'dns_changed', level: 'caution', notify: true,
          title: 'DNS sunucuları değişti',
          detail: `Sistemin DNS sunucuları "${s.last_dns}" yerine "${dnsKey}" oldu. Bu değişikliği siz ya da ağınız yapmadıysanız trafiğiniz yönlendiriliyor olabilir.`,
          old_value: s.last_dns, new_value: dnsKey
        });
      }
      setInternal('last_dns', dnsKey);
    }
  } else {
    adapter = { ...adapter, lastScanTs: now };
  }

  const neighbours = await win.readArpTable(adapter.localIp);
  // The very first scan is a baseline; only devices that appear afterwards are "new"
  const baseline = db.prepare('SELECT COUNT(*) AS c FROM devices').get().c === 0;
  if (adapter.macAddress && adapter.localIp) {
    const v = macVendor(adapter.macAddress);
    stmt.upDevice.run(adapter.macAddress, adapter.localIp, os.hostname(), v.vendor, v.randomized ? 1 : 0, 'self', now, now);
  }
  for (const n of neighbours) {
    const isGw = n.ip === adapter.gateway;
    const v = macVendor(n.mac);
    const prev = stmt.getDevice.get(n.mac);
    if (isGw) {
      const gwKey = `gateway_mac:${n.ip}`;
      const known = getSettings()[gwKey];
      if (known && known !== n.mac) {
        recordEvent({
          type: 'gateway_mac_changed', level: 'threat', notify: true,
          title: 'Ağ geçidinin donanım adresi değişti',
          detail: `Ağ geçidi ${n.ip} artık ${n.mac} adresinden yanıt veriyor (önceden ${known}). Modem veya router değiştirmediyseniz bu bir ARP yanıltma (araya girme) saldırısı olabilir.`,
          host_ip: n.ip, old_value: known, new_value: n.mac
        });
      }
      setInternal(gwKey, n.mac);
    }
    stmt.upDevice.run(n.mac, n.ip, null, v.vendor, v.randomized ? 1 : 0, isGw ? 'gateway' : null, now, now);
    if (!prev && !baseline) {
      recordEvent({
        type: 'device_added', level: 'info', notify: false,
        title: `Ağda yeni cihaz: ${n.ip}`,
        detail: `${n.ip} adresinde ${v.vendor || (v.randomized ? 'rastgele MAC kullanan bir cihaz' : 'üreticisi bilinmeyen bir cihaz')} görüldü (MAC ${n.mac}).`,
        host_ip: n.ip, new_value: n.mac
      });
    }
    if (!prev) dns.reverse(n.ip).then((names) => names?.[0] && db.prepare('UPDATE devices SET hostname = ? WHERE mac = ?').run(names[0], n.mac)).catch(() => {});
  }
  return { adapter, devices: listDevices() };
}

export function listDevices() {
  const scan = adapter.lastScanTs || 0;
  return db
    .prepare("SELECT * FROM devices ORDER BY CASE kind WHEN 'gateway' THEN 0 WHEN 'self' THEN 1 ELSE 2 END, last_seen DESC")
    .all()
    .map((d) => ({ ...d, online: scan > 0 && d.last_seen >= scan - 1000 }));
}

function checkHostsFile() {
  try {
    const p = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'drivers', 'etc', 'hosts');
    const hash = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    const known = getSettings().hosts_hash;
    if (known && known !== hash) {
      recordEvent({
        type: 'hosts_file_changed', level: 'caution', notify: true,
        title: 'Sistemin "hosts" dosyası değişti',
        detail: `${p} dosyası değiştirildi. Bu dosya alan adlarını farklı adreslere yönlendirebilir; değişikliği siz yapmadıysanız inceleyin.`,
        old_value: known.slice(0, 16), new_value: hash.slice(0, 16)
      });
    }
    setInternal('hosts_hash', hash);
  } catch {}
}

// ---------------------------------------------------------------- actions
export function computeSha256(filePath) {
  return new Promise((resolve) => {
    try {
      const h = crypto.createHash('sha256');
      fs.createReadStream(filePath).on('data', (d) => h.update(d)).on('end', () => resolve(h.digest('hex'))).on('error', () => resolve(null));
    } catch {
      resolve(null);
    }
  });
}

export async function ensureSha256(appId) {
  const app = stmt.getApp.get(appId);
  if (!app || !app.exe_path) return null;
  if (app.sha256) return app.sha256;
  const sha = await computeSha256(app.exe_path);
  if (sha) db.prepare('UPDATE apps SET sha256 = ? WHERE id = ?').run(sha, appId);
  return sha;
}

export async function scanVirusTotal(appId) {
  const app = stmt.getApp.get(appId);
  if (!app) throw Object.assign(new Error('Uygulama bulunamadı'), { code: 'not_found' });
  const key = (getSettings().vt_api_key || '').trim();
  if (!key) throw Object.assign(new Error('VirusTotal API anahtarı girilmemiş'), { code: 'no_key' });
  const sha = await ensureSha256(appId);
  if (!sha) throw Object.assign(new Error('Dosyaya erişilemedi, özet hesaplanamadı'), { code: 'no_file' });
  const res = await fetch(`https://www.virustotal.com/api/v3/files/${sha}`, { headers: { 'x-apikey': key } });
  const now = Date.now();
  if (res.status === 404) {
    db.prepare("UPDATE apps SET vt_status = 'not_found', vt_detections = NULL, vt_total = NULL, vt_last_scan = ? WHERE id = ?").run(now, appId);
  } else if (res.ok) {
    const stats = (await res.json())?.data?.attributes?.last_analysis_stats || {};
    const bad = (stats.malicious || 0) + (stats.suspicious || 0);
    const total = (stats.harmless || 0) + (stats.undetected || 0) + bad;
    db.prepare('UPDATE apps SET vt_status = ?, vt_detections = ?, vt_total = ?, vt_last_scan = ? WHERE id = ?').run(bad > 0 ? 'malicious' : 'clean', bad, total, now, appId);
    if (bad > 0) {
      recordEvent({
        type: 'virustotal_threat', level: 'threat', notify: true,
        title: `VirusTotal ${app.name} için tehdit bildirdi`,
        detail: `${total} antivirüs motorunun ${bad} tanesi bu dosyayı zararlı veya şüpheli olarak işaretledi.`,
        app_id: appId, app_name: app.name, new_value: `${bad}/${total}`
      });
    }
  } else if (res.status === 401 || res.status === 403) {
    throw Object.assign(new Error('VirusTotal API anahtarı geçersiz'), { code: 'bad_key' });
  } else if (res.status === 429) {
    throw Object.assign(new Error('VirusTotal istek sınırı doldu, biraz sonra deneyin'), { code: 'rate_limited' });
  } else {
    throw Object.assign(new Error(`VirusTotal yanıt vermedi (HTTP ${res.status})`), { code: 'vt_error' });
  }
  return stmt.getApp.get(appId);
}

export async function setBlocked(appId, blocked) {
  const app = stmt.getApp.get(appId);
  if (!app) throw Object.assign(new Error('Uygulama bulunamadı'), { code: 'not_found' });
  if (!app.exe_path) throw Object.assign(new Error(`${app.name} için dosya yolu bilinmiyor, kural oluşturulamaz`), { code: 'no_path' });
  if (opts.protectedPaths?.some((p) => p.toLowerCase() === app.exe_path.toLowerCase())) {
    throw Object.assign(new Error('DarkMirror kendini engelleyemez'), { code: 'protected' });
  }
  try {
    if (blocked) await win.blockProgram(app.exe_path, app.name);
    else await win.unblockProgram(app.exe_path);
  } catch {
    throw Object.assign(new Error('Güvenlik duvarı kuralı uygulanamadı. DarkMirror yönetici olarak çalışmalı.'), { code: 'firewall_denied' });
  }
  db.prepare('UPDATE apps SET blocked = ? WHERE id = ?').run(blocked ? 1 : 0, appId);
  return stmt.getApp.get(appId);
}

export async function addProgramRule(exePath) {
  if (!exePath || !fs.existsSync(exePath)) throw Object.assign(new Error('Dosya bulunamadı'), { code: 'no_file' });
  const id = exePath.toLowerCase();
  const now = Date.now();
  if (!stmt.getApp.get(id)) {
    stmt.insApp.run(id, path.basename(exePath), exePath, now, now);
    trustQueue.add(id);
    processTrustQueue();
  }
  return setBlocked(id, true);
}

export async function unblockAll() {
  try {
    await win.removeAllRules();
  } catch {
    throw Object.assign(new Error('Kurallar kaldırılamadı. DarkMirror yönetici olarak çalışmalı.'), { code: 'firewall_denied' });
  }
  db.prepare('UPDATE apps SET blocked = 0').run();
}

export async function setRulesEnabled(enabled) {
  try {
    await win.setRulesEnabled(enabled);
  } catch {
    throw Object.assign(new Error('Kurallar değiştirilemedi. DarkMirror yönetici olarak çalışmalı.'), { code: 'firewall_denied' });
  }
  return updateSettings({ rules_enabled: enabled });
}

async function syncFirewallState() {
  const rules = await win.listBlockedPrograms();
  const blocked = new Set(rules.map((r) => String(r.path).toLowerCase()));
  db.prepare('UPDATE apps SET blocked = 0').run();
  const now = Date.now();
  for (const r of rules) {
    const id = String(r.path).toLowerCase();
    if (!stmt.getApp.get(id)) {
      stmt.insApp.run(id, path.basename(r.path), r.path, now, now);
      trustQueue.add(id);
    }
  }
  for (const id of blocked) db.prepare('UPDATE apps SET blocked = 1 WHERE id = ?').run(id);
  if (rules.length) setInternal('rules_enabled', rules.some((r) => r.enabled === 'True') ? 'true' : 'false');
}

// ---------------------------------------------------------------- lifecycle
export async function init({ dataDir, resourceDir, probePath, protectedPaths = [], startTelemetry = true, version = null }) {
  opts = { dataDir, resourceDir, probePath, protectedPaths };
  status.version = version;
  fs.mkdirSync(dataDir, { recursive: true });
  db = new DatabaseSync(path.join(dataDir, 'darkmirror.db'));
  db.exec(SCHEMA);
  prepareStatements();
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) if (!stmt.getSetting.get(k)) setInternal(k, v);

  const lk = loadLookups(path.join(resourceDir, 'data'));
  status.geoSource = lk.geoSource;

  status.admin = await win.isElevated();
  const homeCode = await win.readHomeCountry();
  home = countryInfo(homeCode);

  if (!startTelemetry) return;
  syncFirewallState().catch(() => {});
  startProbe();
  scanLan().catch(() => {});
  checkHostsFile();
  timers.push(setInterval(() => scanLan().catch(() => {}), 60000));
  timers.push(setInterval(checkHostsFile, 30000));
  // Keep two days of 1.5 s graph samples; hourly usage stays for the data-plan views
  timers.push(setInterval(() => db.prepare('DELETE FROM samples WHERE ts < ?').run(Date.now() - 2 * 86400000), 3600000));
}

export function stop() {
  timers.splice(0).forEach(clearInterval);
  if (probeProc) {
    status.probe = 'stopped';
    probeProc.kill();
    probeProc = null;
  }
  try {
    db?.close();
  } catch {}
}

export function geoOf(code) {
  return countryInfo(code);
}
