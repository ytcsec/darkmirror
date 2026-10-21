// Windows integrations: Authenticode signatures, Windows Defender Firewall rules,
// network configuration, region. Everything here reads real system state; nothing is guessed.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import crypto from 'node:crypto';

const execFileAsync = promisify(execFile);

async function powershell(script, env = {}, timeout = 20000) {
  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { timeout, maxBuffer: 16 * 1024 * 1024, windowsHide: true, env: { ...process.env, ...env } }
  );
  return stdout.trim();
}

function parseJsonList(out) {
  if (!out) return [];
  const v = JSON.parse(out);
  return Array.isArray(v) ? v : [v];
}

// Authenticode + version info for a batch of executable paths
export async function readFileTrust(paths) {
  if (!paths.length) return [];
  const script = `
    $ErrorActionPreference = 'SilentlyContinue'
    $paths = $env:DM_PATHS | ConvertFrom-Json
    $out = foreach ($p in $paths) {
      $sig = Get-AuthenticodeSignature -LiteralPath $p
      $item = Get-Item -LiteralPath $p
      $cn = $null
      if ($sig.SignerCertificate) { $cn = $sig.SignerCertificate.GetNameInfo('SimpleName', $false) }
      [pscustomobject]@{
        path = $p
        status = [string]$sig.Status
        signer = $cn
        company = $item.VersionInfo.CompanyName
        version = $item.VersionInfo.ProductVersion
      }
    }
    @($out) | ConvertTo-Json -Compress -Depth 3`;
  try {
    return parseJsonList(await powershell(script, { DM_PATHS: JSON.stringify(paths) }, 60000));
  } catch {
    return [];
  }
}

export async function isElevated() {
  try {
    await execFileAsync('net.exe', ['session'], { windowsHide: true, timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

// ---------- Windows Defender Firewall ----------
export const RULE_GROUP = 'DarkMirror';

export function ruleNameFor(exePath) {
  return `DarkMirror-${crypto.createHash('sha1').update(exePath.toLowerCase()).digest('hex').slice(0, 16)}`;
}

export async function blockProgram(exePath, displayName) {
  const name = ruleNameFor(exePath);
  const script = `
    $ErrorActionPreference = 'Stop'
    Remove-NetFirewallRule -Name "$env:DM_NAME-out","$env:DM_NAME-in" -ErrorAction SilentlyContinue
    New-NetFirewallRule -Name "$env:DM_NAME-out" -DisplayName "DarkMirror: $env:DM_LABEL (giden)" -Group "${RULE_GROUP}" -Direction Outbound -Action Block -Program $env:DM_PATH | Out-Null
    New-NetFirewallRule -Name "$env:DM_NAME-in" -DisplayName "DarkMirror: $env:DM_LABEL (gelen)" -Group "${RULE_GROUP}" -Direction Inbound -Action Block -Program $env:DM_PATH | Out-Null
    'ok'`;
  await powershell(script, { DM_NAME: name, DM_PATH: exePath, DM_LABEL: displayName || exePath });
}

export async function unblockProgram(exePath) {
  const name = ruleNameFor(exePath);
  await powershell(`Remove-NetFirewallRule -Name "$env:DM_NAME-out","$env:DM_NAME-in" -ErrorAction SilentlyContinue; 'ok'`, { DM_NAME: name });
}

export async function removeAllRules() {
  await powershell(`Remove-NetFirewallRule -Group "${RULE_GROUP}" -ErrorAction SilentlyContinue; 'ok'`);
}

export async function setRulesEnabled(enabled) {
  await powershell(`${enabled ? 'Enable' : 'Disable'}-NetFirewallRule -Group "${RULE_GROUP}" -ErrorAction SilentlyContinue; 'ok'`);
}

// Programs DarkMirror currently blocks, read back from the firewall itself
export async function listBlockedPrograms() {
  const script = `
    $ErrorActionPreference = 'SilentlyContinue'
    $rules = Get-NetFirewallRule -Group "${RULE_GROUP}" -Direction Outbound
    $out = foreach ($r in $rules) {
      $f = $r | Get-NetFirewallApplicationFilter
      [pscustomobject]@{ path = $f.Program; enabled = [string]$r.Enabled }
    }
    @($out) | ConvertTo-Json -Compress`;
  try {
    return parseJsonList(await powershell(script)).filter((r) => r && r.path);
  } catch {
    return [];
  }
}

// ---------- Network configuration ----------
export async function readNetworkConfig() {
  const script = `
    $ErrorActionPreference = 'SilentlyContinue'
    $c = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.NetAdapter.Status -eq 'Up' } | Select-Object -First 1
    if ($c) {
      [pscustomobject]@{
        alias = $c.InterfaceAlias
        ifIndex = $c.InterfaceIndex
        ip = @($c.IPv4Address)[0].IPAddress
        gateway = @($c.IPv4DefaultGateway)[0].NextHop
        dns = @($c.DNSServer | Where-Object { $_.AddressFamily -eq 2 } | ForEach-Object { $_.ServerAddresses }) -join ','
        mac = $c.NetAdapter.MacAddress
      } | ConvertTo-Json -Compress
    }`;
  try {
    const out = await powershell(script);
    if (!out) return null;
    const v = JSON.parse(out);
    return {
      adapterName: v.alias || null,
      localIp: v.ip || null,
      gateway: v.gateway || null,
      dnsServers: v.dns ? String(v.dns).split(',').filter(Boolean) : [],
      macAddress: v.mac ? String(v.mac).replace(/-/g, ':').toUpperCase() : null
    };
  } catch {
    return null;
  }
}

// The country set in Windows region settings (used only to place "home" on the globe)
export async function readHomeCountry() {
  try {
    const out = await powershell(`(Get-ItemProperty 'HKCU:\\Control Panel\\International\\Geo').Name`);
    return /^[A-Z]{2}$/.test(out) ? out : null;
  } catch {
    return null;
  }
}

export async function readProcessNames() {
  const names = new Map();
  try {
    const { stdout } = await execFileAsync('tasklist.exe', ['/FO', 'CSV', '/NH'], { timeout: 6000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
    for (const line of stdout.split(/\r?\n/)) {
      const m = line.match(/^"([^"]+)","(\d+)"/);
      if (m) names.set(Number(m[2]), m[1]);
    }
  } catch {}
  return names;
}

export async function readArpTable(interfaceIp) {
  const out = [];
  try {
    const { stdout } = await execFileAsync('arp.exe', ['-a'], { timeout: 6000, windowsHide: true });
    let inSection = !interfaceIp;
    for (const raw of stdout.split(/\r?\n/)) {
      const header = raw.match(/^\S.*?:\s*(\d+\.\d+\.\d+\.\d+)\s+---/);
      if (header) {
        inSection = !interfaceIp || header[1] === interfaceIp;
        continue;
      }
      if (!inSection) continue;
      const m = raw.trim().match(/^(\d+\.\d+\.\d+\.\d+)\s+([0-9a-fA-F-]{17})\s+(\S+)/);
      if (!m) continue;
      const type = m[3].toLowerCase();
      // "dynamic"/"dinamik" entries are real neighbours; static ones are broadcast/multicast
      if (!type.startsWith('dyn') && !type.startsWith('din')) continue;
      out.push({ ip: m[1], mac: m[2].toUpperCase().replace(/-/g, ':') });
    }
  } catch {}
  return out;
}
