// End-to-end check of the engine and in-process API against the real machine.
// Runs without Electron: no window, no network port. Uses a throw-away data directory.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as engine from '../src/engine.mjs';
import { handleApi, exportCsv } from '../src/api.mjs';
import { loadLookups, countryOf, macVendor, isPrivateIp } from '../src/lookup.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'darkmirror-test-'));
const call = async (p, body) => {
  const res = await handleApi(
    new Request(`app://darkmirror${p}`, body ? { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {})
  );
  return { status: res.status, data: await res.json() };
};

let failed = false;
try {
  // Offline lookup data
  const lk = loadLookups(path.join(ROOT, 'resources', 'data'));
  assert.ok(lk.geoip, 'GeoIP database loads');
  assert.ok(lk.centroids > 200, 'country centroids load');
  assert.ok(lk.oui > 10000, 'IEEE OUI list loads');
  assert.equal(countryOf('8.8.8.8'), 'US');
  assert.equal(countryOf('192.168.1.10'), null, 'private addresses have no country');
  assert.ok(isPrivateIp('10.0.0.1') && !isPrivateIp('1.1.1.1'));
  assert.equal(macVendor('00:15:5D:00:00:01').vendor, 'Microsoft Corporation');
  assert.equal(macVendor('FE:1A:8D:47:0D:96').randomized, true);

  const probePath = path.join(ROOT, 'build', 'dmprobe.exe');
  await engine.init({ dataDir, resourceDir: path.join(ROOT, 'resources'), probePath, version: 'test' });
  await new Promise((r) => setTimeout(r, 5000));

  const boot = await call('/api/bootstrap');
  assert.equal(boot.status, 200);
  for (const key of ['settings', 'status', 'adapter', 'apps', 'hosts', 'lanDevices', 'alerts']) assert.ok(key in boot.data, `bootstrap has ${key}`);
  assert.ok(['running', 'fallback'].includes(boot.data.status.probe), 'probe or fallback is collecting');
  assert.ok(!('vt_api_key' in boot.data.settings), 'API key never leaves the engine');
  for (const a of boot.data.apps) {
    assert.ok(['pending', 'valid', 'unsigned', 'invalid', 'unknown'].includes(a.signature), `signature state for ${a.name}`);
    if (!boot.data.status.bytesKnown) assert.equal(a.total_rx, null, 'unmeasured bytes are null, not 0');
  }

  const graph = await call('/api/graph?minutes=5');
  assert.equal(graph.status, 200);
  assert.ok(graph.data.series.every((p) => p.ts && p.rx >= 0 && p.tx >= 0), 'graph has only measured samples');

  assert.equal((await call('/api/usage?period=week')).status, 200);
  assert.equal((await call('/api/apps/does-not-exist')).status, 404);

  // Settings: only whitelisted keys are writable
  const s = await call('/api/settings', { snooze: true, firewall_mode: 'block_all' });
  assert.equal(s.data.settings.snooze, 'true');
  assert.ok(!('firewall_mode' in s.data.settings), 'unknown settings are ignored');

  // VirusTotal without a key must refuse instead of inventing a result
  if (boot.data.apps[0]) {
    const vt = await call('/api/virustotal/scan', { appId: boot.data.apps[0].id });
    assert.equal(vt.data.code, 'no_key');
  }

  assert.ok(exportCsv('usage').startsWith('﻿'));
  assert.ok(exportCsv('network').includes('MAC'));

  console.log(
    JSON.stringify({
      ok: true,
      probe: boot.data.status.probe,
      admin: boot.data.status.admin,
      bytesMeasured: boot.data.status.bytesKnown,
      apps: boot.data.apps.length,
      hosts: boot.data.hosts.length,
      devices: boot.data.lanDevices.length,
      geo: lk.geoSource
    })
  );
} catch (err) {
  failed = true;
  console.error(err);
} finally {
  engine.stop();
  fs.rmSync(dataDir, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
}
