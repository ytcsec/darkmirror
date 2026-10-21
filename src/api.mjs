// In-process API used by the Electron renderer through the app:// protocol.
// Takes a standard Request and returns a standard Response; nothing listens on a network port.
import * as engine from './engine.mjs';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

const fail = (err) => json({ error: err.message || 'Hata', code: err.code || 'error' }, err.code === 'not_found' ? 404 : 400);

const PERIOD_MS = { day: 86400000, week: 7 * 86400000, month: 30 * 86400000 };

const SERVICE_PORTS = {
  21: 'FTP', 22: 'SSH', 25: 'SMTP', 53: 'DNS', 80: 'HTTP', 110: 'POP3', 123: 'NTP', 143: 'IMAP', 443: 'HTTPS',
  465: 'SMTPS', 587: 'SMTP', 853: 'DNS-over-TLS', 993: 'IMAPS', 995: 'POP3S', 1883: 'MQTT', 3389: 'RDP',
  5222: 'XMPP', 5228: 'Google Push', 8080: 'HTTP-alt', 8443: 'HTTPS-alt'
};
const serviceOf = (port) => SERVICE_PORTS[port] || `TCP ${port}`;

const EVENT_CATEGORY = {
  unsigned_app: 'apps',
  binary_changed: 'apps',
  virustotal_threat: 'apps',
  gateway_mac_changed: 'network',
  device_added: 'network',
  rdp_inbound: 'network',
  dns_changed: 'system',
  hosts_file_changed: 'system'
};

function mapApp(a, bytesKnown) {
  return {
    ...a,
    publisher: a.signature === 'valid' ? a.signer : a.company || null,
    total_rx: bytesKnown ? a.bytes_in : null,
    total_tx: bytesKnown ? a.bytes_out : null,
    live_connections: engine.liveByApp.get(a.id) || 0
  };
}

function mapHost(h, bytesKnown) {
  const geo = engine.geoOf(h.country_code);
  return {
    ...h,
    remote_ip: h.ip,
    country: h.is_lan ? 'LAN' : h.country_code,
    country_name: h.is_lan ? 'Yerel ağ' : geo?.name || null,
    lat: geo?.lat ?? null,
    lon: geo?.lon ?? null,
    total_rx: bytesKnown ? h.bytes_in : null,
    total_tx: bytesKnown ? h.bytes_out : null
  };
}

function mapEvent(e) {
  return { ...e, description: e.detail, raw_type: e.type, category: EVENT_CATEGORY[e.type] || 'system', severity: e.level };
}

function hostsWithService(db, limit) {
  return db
    .prepare(
      `SELECT h.*, (SELECT port FROM app_host u WHERE u.host_ip = h.ip ORDER BY (u.bytes_in + u.bytes_out) DESC, u.last_seen DESC LIMIT 1) AS port
       FROM hosts h ORDER BY (h.bytes_in + h.bytes_out) DESC, h.last_seen DESC LIMIT ?`
    )
    .all(limit);
}

function bootstrap() {
  const db = engine.getDb();
  const bytesKnown = engine.getSettings().bytes_measured === 'true';
  const apps = db.prepare('SELECT * FROM apps ORDER BY (bytes_in + bytes_out) DESC, last_seen DESC').all().map((a) => mapApp(a, bytesKnown));
  const hosts = hostsWithService(db, 150).map((h) => ({ ...mapHost(h, bytesKnown), protocol: h.port ? serviceOf(h.port) : null }));
  const alerts = db.prepare('SELECT * FROM events ORDER BY ts DESC LIMIT 300').all().map(mapEvent);
  return {
    settings: engine.publicSettings(),
    status: { ...engine.status, bytesKnown },
    adapter: engine.adapter,
    home: engine.home,
    apps,
    hosts,
    lanDevices: engine.listDevices(),
    alerts,
    speed: engine.currentSpeed
  };
}

function usage(period) {
  const db = engine.getDb();
  const since = Math.floor((Date.now() - (PERIOD_MS[period] || PERIOD_MS.day)) / 3600000);
  const bytesKnown = engine.getSettings().bytes_measured === 'true';
  const iface = db.prepare("SELECT COALESCE(SUM(bytes_in),0) AS rx, COALESCE(SUM(bytes_out),0) AS tx FROM usage_hour WHERE kind = 'iface' AND hour >= ?").get(since);
  const attributed = db.prepare("SELECT COALESCE(SUM(bytes_in),0) AS rx, COALESCE(SUM(bytes_out),0) AS tx FROM usage_hour WHERE kind = 'app' AND hour >= ?").get(since);
  const lan = db
    .prepare("SELECT COALESCE(SUM(u.bytes_in + u.bytes_out),0) AS b FROM usage_hour u JOIN hosts h ON h.ip = u.key WHERE u.kind = 'host' AND h.is_lan = 1 AND u.hour >= ?")
    .get(since).b;
  const byApp = db
    .prepare(
      `SELECT a.id, a.name, a.signer, a.company, a.signature, SUM(u.bytes_in) AS rx, SUM(u.bytes_out) AS tx
       FROM usage_hour u JOIN apps a ON a.id = u.key WHERE u.kind = 'app' AND u.hour >= ?
       GROUP BY a.id ORDER BY SUM(u.bytes_in + u.bytes_out) DESC LIMIT 60`
    )
    .all(since)
    .map((a) => ({ ...a, publisher: a.signature === 'valid' ? a.signer : a.company }));
  const byHost = db
    .prepare(
      `SELECT h.ip AS remote_ip, h.hostname, h.country_code, h.is_lan, SUM(u.bytes_in) AS rx, SUM(u.bytes_out) AS tx
       FROM usage_hour u JOIN hosts h ON h.ip = u.key WHERE u.kind = 'host' AND u.hour >= ?
       GROUP BY h.ip ORDER BY SUM(u.bytes_in + u.bytes_out) DESC LIMIT 60`
    )
    .all(since)
    .map((h) => ({ ...h, country: h.is_lan ? 'LAN' : h.country_code }));
  const byService = db
    .prepare(
      `SELECT ah.port, SUM(ah.bytes_in) AS rx, SUM(ah.bytes_out) AS tx, COUNT(DISTINCT ah.app_id) AS app_count
       FROM app_host ah WHERE ah.last_seen >= ? GROUP BY ah.port ORDER BY SUM(ah.bytes_in + ah.bytes_out) DESC LIMIT 40`
    )
    .all(since * 3600000)
    .map((r) => ({ ...r, protocol: serviceOf(r.port) }));
  return {
    bytesKnown,
    totals: {
      rx: iface.rx,
      tx: iface.tx,
      attributedRx: attributed.rx,
      attributedTx: attributed.tx,
      lanBytes: lan,
      wanBytes: Math.max(0, attributed.rx + attributed.tx - lan)
    },
    byApp,
    byProtocol: byService,
    byHost
  };
}

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportCsv(kind) {
  const db = engine.getDb();
  const bytesKnown = engine.getSettings().bytes_measured === 'true';
  let rows;
  if (kind === 'network') {
    rows = [['IP', 'MAC', 'Ad', 'Üretici', 'Tür', 'İlk görülme', 'Son görülme']];
    for (const d of engine.listDevices()) {
      rows.push([d.ip, d.mac, d.custom_name || d.hostname || '', d.vendor || '', d.kind || '', new Date(d.first_seen).toISOString(), new Date(d.last_seen).toISOString()]);
    }
  } else {
    rows = [['Uygulama', 'Dosya yolu', 'İmza', 'Yayımcı', 'Gelen (bayt)', 'Giden (bayt)', 'Engelli', 'SHA-256']];
    for (const a of db.prepare('SELECT * FROM apps ORDER BY (bytes_in + bytes_out) DESC').all()) {
      rows.push([a.name, a.exe_path || '', a.signature, a.signature === 'valid' ? a.signer : a.company || '', bytesKnown ? a.bytes_in : '', bytesKnown ? a.bytes_out : '', a.blocked ? 'evet' : 'hayır', a.sha256 || '']);
    }
  }
  return '﻿' + rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');
}

export async function handleApi(request) {
  const url = new URL(request.url);
  const p = url.pathname;
  const method = request.method;
  const body = method === 'POST' ? await request.json().catch(() => ({})) : {};
  const db = engine.getDb();

  try {
    if (p === '/api/bootstrap') return json(bootstrap());

    if (p === '/api/graph') {
      const minutes = Math.min(1440, Math.max(1, Number(url.searchParams.get('minutes')) || 5));
      const series = db
        .prepare('SELECT ts, rx_rate AS rx, tx_rate AS tx FROM samples WHERE ts >= ? ORDER BY ts ASC')
        .all(Date.now() - minutes * 60000);
      // Down-sample long ranges to ~600 points by averaging buckets
      const step = Math.max(1, Math.ceil(series.length / 600));
      const out = [];
      for (let i = 0; i < series.length; i += step) {
        const chunk = series.slice(i, i + step);
        out.push({
          ts: chunk[chunk.length - 1].ts,
          rx: Math.round(chunk.reduce((s, c) => s + c.rx, 0) / chunk.length),
          tx: Math.round(chunk.reduce((s, c) => s + c.tx, 0) / chunk.length)
        });
      }
      return json({ series: out });
    }

    if (p === '/api/usage') return json(usage(url.searchParams.get('period') || 'day'));

    if (p === '/api/usage/reset' && method === 'POST') {
      db.exec('DELETE FROM samples; DELETE FROM usage_hour; DELETE FROM app_host; UPDATE apps SET bytes_in = 0, bytes_out = 0; UPDATE hosts SET bytes_in = 0, bytes_out = 0;');
      return json({ ok: true });
    }

    if (p.startsWith('/api/apps/')) {
      const id = decodeURIComponent(p.slice('/api/apps/'.length));
      const app = db.prepare('SELECT * FROM apps WHERE id = ?').get(id);
      if (!app) return json({ error: 'Uygulama bulunamadı' }, 404);
      const bytesKnown = engine.getSettings().bytes_measured === 'true';
      if (app.exe_path && !app.sha256) engine.ensureSha256(id);
      const hosts = db
        .prepare(
          `SELECT u.host_ip, u.port, u.bytes_in, u.bytes_out, u.last_seen, h.hostname, h.country_code, h.is_lan
           FROM app_host u LEFT JOIN hosts h ON h.ip = u.host_ip WHERE u.app_id = ?
           ORDER BY (u.bytes_in + u.bytes_out) DESC, u.last_seen DESC LIMIT 60`
        )
        .all(id)
        .map((h) => ({ ...h, protocol: serviceOf(h.port), country_code: h.is_lan ? 'LAN' : h.country_code }));
      return json({ app: mapApp(app, bytesKnown), hosts });
    }

    if (p.startsWith('/api/hosts/')) {
      const ip = decodeURIComponent(p.slice('/api/hosts/'.length));
      const host = db.prepare('SELECT * FROM hosts WHERE ip = ?').get(ip);
      if (!host) return json({ error: 'Sunucu bulunamadı' }, 404);
      const bytesKnown = engine.getSettings().bytes_measured === 'true';
      const apps = db
        .prepare(
          `SELECT u.app_id, u.port, u.bytes_in, u.bytes_out, u.last_seen, a.name AS app_name
           FROM app_host u LEFT JOIN apps a ON a.id = u.app_id WHERE u.host_ip = ?
           ORDER BY (u.bytes_in + u.bytes_out) DESC LIMIT 60`
        )
        .all(ip)
        .map((u) => ({ ...u, protocol: serviceOf(u.port) }));
      return json({ host: mapHost(host, bytesKnown), apps });
    }

    if (p === '/api/firewall/toggle' && method === 'POST') {
      return json({ app: await engine.setBlocked(String(body.appId), Boolean(body.blocked)) });
    }
    if (p === '/api/firewall/add' && method === 'POST') return json({ app: await engine.addProgramRule(String(body.exePath || '')) });
    if (p === '/api/firewall/unblock-all' && method === 'POST') {
      await engine.unblockAll();
      return json({ ok: true });
    }
    if (p === '/api/firewall/enabled' && method === 'POST') return json({ settings: await engine.setRulesEnabled(Boolean(body.enabled)) });

    if (p === '/api/virustotal/scan' && method === 'POST') return json({ app: await engine.scanVirusTotal(String(body.appId)) });

    if (p === '/api/lan/scan' && method === 'POST') return json(await engine.scanLan());

    if (p === '/api/network/device' && method === 'POST') {
      db.prepare('UPDATE devices SET custom_name = ?, notes = ? WHERE mac = ?').run(body.customName || null, body.notes || null, String(body.mac || ''));
      return json({ devices: engine.listDevices() });
    }

    if (p === '/api/alerts/action' && method === 'POST') {
      if (body.action === 'mark_all_read') db.prepare('UPDATE events SET is_read = 1').run();
      else if (body.action === 'mark_read') db.prepare('UPDATE events SET is_read = ? WHERE id = ?').run(body.isRead ? 1 : 0, Number(body.id));
      else if (body.action === 'delete') db.prepare('DELETE FROM events WHERE id = ?').run(Number(body.id));
      else if (body.action === 'clear_all') db.prepare('DELETE FROM events').run();
      return json({ ok: true });
    }

    if (p === '/api/settings' && method === 'POST') return json({ settings: engine.updateSettings(body) });

    return json({ error: 'Bulunamadı' }, 404);
  } catch (err) {
    return fail(err);
  }
}
