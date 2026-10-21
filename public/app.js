// Icon sprite (index.html <symbol id="i-*">): one 24px grid, one stroke weight
const icon = (name, cls = 'i i-sm') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const ICONS = {
  pause: icon('pause'),
  play: icon('play'),
  gateOpen: icon('gate-open', 'i'),
  gateClosed: icon('gate-closed', 'i'),
  shieldCheck: icon('shield'),
  block: icon('ban'),
  check: icon('check'),
  folder: icon('folder'),
  chart: icon('chart'),
  globe: icon('globe'),
  scan: icon('radar'),
  desktop: icon('desktop', 'i'),
  router: icon('router', 'i'),
  edit: icon('edit'),
  trash: icon('trash'),
  clock: icon('clock'),
  close: icon('x'),
  bell: icon('bell'),
  alert: icon('alert'),
  devices: icon('devices'),
  external: icon('external')
};

// Theme: colours live in CSS custom properties; canvases read them at draw time
const THEME_KEY = 'dm-theme';
const THEME_ORDER = ['system', 'light', 'dark'];
const THEME_LABELS = { system: 'Sistem', light: 'Açık', dark: 'Koyu' };
const THEME_ICONS = { system: 'desktop', light: 'sun', dark: 'moon' };

function readThemePref() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

function applyThemePref(pref) {
  const root = document.documentElement;
  if (pref === 'light' || pref === 'dark') root.dataset.theme = pref;
  else delete root.dataset.theme;
  try {
    if (pref === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, pref);
  } catch {}
  const label = document.getElementById('menuThemeLabel');
  if (label) label.textContent = THEME_LABELS[pref];
  const iconUse = document.querySelector('#menuThemeIcon use');
  if (iconUse) iconUse.setAttribute('href', `#i-${THEME_ICONS[pref]}`);
  if (window.darkMirrorDesktop?.setTheme) window.darkMirrorDesktop.setTheme(pref);
  redrawCanvases();
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function themeColors() {
  return {
    paper: cssVar('--dm-paper'),
    paper2: cssVar('--dm-paper-2'),
    sheet: cssVar('--dm-sheet'),
    rule: cssVar('--dm-rule'),
    ruleSoft: cssVar('--dm-rule-soft'),
    ink: cssVar('--dm-ink'),
    ink2: cssVar('--dm-ink-2'),
    ink3: cssVar('--dm-ink-3'),
    inbound: cssVar('--dm-in'),
    outbound: cssVar('--dm-out'),
    threat: cssVar('--dm-threat'),
    foil: cssVar('--dm-foil'),
    mono: cssVar('--dm-mono') || 'Consolas, monospace',
    font: cssVar('--dm-font') || 'sans-serif'
  };
}

function withAlpha(hex, alpha) {
  const h = String(hex).replace('#', '');
  if (h.length !== 6) return hex;
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function redrawCanvases() {
  if (state.activeTab === 'graph') {
    if (state.graphSubView === 'map') drawGeoMap();
    else {
      drawMainTrafficGraph();
      drawOverviewScrubber();
    }
  } else if (state.activeTab === 'usage') {
    drawUsageDonut(state.usageTotals.rx, state.usageTotals.tx);
  }
}

// Two-ink share bar under each row: gelen (petrol) | giden (kehribar)
function rowBar(pct, rx, tx) {
  if (rx === null || rx === undefined) return '';
  const a = Math.max(0, Number(rx) || 0);
  const b = Math.max(0, Number(tx) || 0);
  const sum = a + b || 1;
  return `<div class="dm-row-bar" style="width:${pct}%"><i class="in" style="flex:${(a / sum).toFixed(3)}"></i><i class="out" style="flex:${(b / sum).toFixed(3)}"></i></div>`;
}

function inOutSmall(rx, tx) {
  return `<small><span class="in">${formatBytes(rx)}</span> gelen · <span class="out">${formatBytes(tx)}</span> giden</small>`;
}

// One severity code everywhere: info = neutral, important/warning = caution violet, danger = threat red
// One severity code everywhere: info = neutral, caution = violet, threat = red
function severityStamp(level) {
  if (level === 'threat') return 'threat';
  if (level === 'caution') return 'caution';
  return 'neutral';
}

// Right-hand figures: real bytes when measured, otherwise the live connection count
function rowFigures(rx, tx, live) {
  if (rx === null || rx === undefined) {
    return `<strong>${live ? `${live} bağlantı` : '—'}</strong><small>Trafik ölçülmüyor</small>`;
  }
  return `<strong>${formatBytes((rx || 0) + (tx || 0))}</strong>${inOutSmall(rx, tx)}`;
}

function emptyState(title, text) {
  return `<div class="dm-empty"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span></div>`;
}

const state = {
  activeTab: 'graph',
  graphSubView: 'chart',
  graphPivot: 'all', // 'all' | 'apps' | 'traffic' | 'publishers'
  graphRangeMinutes: 5,
  graphPaused: false,
  graphAppFilter: '',
  usagePeriod: 'day',
  alertFilter: 'all',
  alertSeverityFilter: 'all',
  alertSearchQuery: '',
  selectedLanIp: '',
  hoverIndex: -1,
  overviewZoomStart: 0.0,
  series: [],
  apps: [],
  hosts: [],
  protocols: [],
  adapter: null,
  status: { admin: true, estats: true, bytesKnown: true },
  home: null,
  lanDevices: [],
  alerts: [],
  settings: {
    rules_enabled: 'true',
    incognito: 'false',
    snooze: 'false',
    bandwidth_quota_gb: '100',
    vt_key_set: 'false'
  },
  latestTick: null,
  usageTotals: { rx: 1, tx: 1 },
  lastToggledAppId: null
};

// 3D Interactive Globe State
const globeState = {
  rotLon: -28,
  rotLat: 24,
  targetRotLon: null,
  targetRotLat: null,
  zoom: 1.0,
  zoomTarget: 1.0,
  velLon: 0,
  velLat: 0,
  autoRotate: true,
  isDragging: false,
  lastMouseX: 0,
  lastMouseY: 0,
  animFrameId: null
};

// Country names come from the platform (Intl); positions come from the engine (country centroids)
const COUNTRY_NAMES = new Intl.DisplayNames(['tr'], { type: 'region' });

function countryName(code) {
  if (!code) return 'Bilinmiyor';
  if (code === 'LAN') return 'Yerel ağ';
  try {
    return COUNTRY_NAMES.of(code) || code;
  } catch {
    return code;
  }
}

function countryGeo(code) {
  if (state.home && state.home.code === code && state.home.lat != null) return state.home;
  const h = state.hosts.find((x) => x.country === code && x.lat != null);
  return h ? { code, lat: h.lat, lon: h.lon } : null;
}

const CONTINENT_POLYGONS = [
  [
    [36, -9], [43, -9], [48, -4], [54, 8], [58, 10], [64, 14], [70, 25],
    [68, 40], [56, 48], [46, 48], [42, 42], [36, 36], [36, 26], [40, 26],
    [38, 22], [40, 18], [44, 12], [38, 15], [43, 5], [36, -5]
  ],
  [
    [50, -5], [58, -6], [58, -2], [51, 1], [50, -5]
  ],
  [
    [35, -6], [37, 10], [32, 32], [12, 51], [-2, 41], [-18, 36], [-34, 25],
    [-34, 18], [-16, 12], [4, 9], [5, -8], [15, -17], [28, -13], [35, -6]
  ],
  [
    [36, 36], [42, 42], [46, 48], [56, 48], [68, 60], [72, 100], [66, 170],
    [52, 140], [38, 120], [22, 114], [8, 104], [14, 98], [22, 88], [8, 77],
    [24, 67], [26, 56], [13, 45], [28, 34], [36, 36]
  ],
  [
    [31, 130], [35, 136], [40, 140], [44, 144], [36, 141], [31, 130]
  ],
  [
    [70, -160], [72, -120], [60, -64], [45, -60], [40, -74], [25, -80],
    [30, -88], [20, -97], [16, -90], [8, -78], [16, -100], [24, -110],
    [34, -120], [48, -124], [60, -148], [70, -160]
  ],
  [
    [11, -75], [8, -60], [-5, -35], [-15, -39], [-23, -43], [-35, -54],
    [-54, -68], [-42, -73], [-18, -71], [-5, -81], [11, -75]
  ],
  [
    [-12, 131], [-12, 142], [-28, 153], [-38, 146], [-34, 135], [-34, 115],
    [-22, 114], [-15, 124], [-12, 131]
  ]
];

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '—';
  const n = Number(bytes) || 0;
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatRate(bytesPerSec) {
  return `${formatBytes(bytesPerSec)}/sn`;
}

function formatTime(ts) {
  if (!ts) return '-';
  return new Date(ts).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function formatDateTime(ts) {
  if (!ts) return '-';
  return new Date(ts).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function appInitials(name = '') {
  const clean = String(name).replace(/\.exe$/i, '').trim();
  return (clean.slice(0, 2) || 'DM').toUpperCase();
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// API errors (e.g. missing admin rights) surface as a short message instead of failing silently
async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    showMessage(data.error || 'İşlem tamamlanamadı.');
    return { ...data, error: data.error || 'error', code: data.code };
  }
  return data;
}

const desktop = window.darkMirrorDesktop;

const SIGNATURE_LABELS = {
  valid: 'İmzalı',
  unsigned: 'İmzasız',
  invalid: 'Geçersiz imza',
  unknown: 'Doğrulanamadı',
  pending: 'Doğrulanıyor'
};

function signatureStamp(app) {
  const sig = app?.signature || 'unknown';
  const cls = sig === 'valid' ? 'allowed' : sig === 'unsigned' || sig === 'invalid' ? 'caution' : 'neutral';
  return `<span class="dm-status-pill ${cls}">${escapeHtml(SIGNATURE_LABELS[sig] || sig)}</span>`;
}

function publisherText(app) {
  if (app?.signature === 'valid' && app.signer) return app.signer;
  if (app?.publisher) return `${app.publisher} (doğrulanmamış)`;
  return app?.exe_path ? 'Yayımcı bilgisi yok' : 'Dosya yolu okunamadı';
}

// ==================== IN-APP ALERTS (no sound) ====================
const EVENT_LABELS = {
  unsigned_app: 'İmzasız uygulama',
  binary_changed: 'Dosya değişti',
  virustotal_threat: 'VirusTotal',
  gateway_mac_changed: 'Ağ geçidi',
  device_added: 'Yeni cihaz',
  rdp_inbound: 'Uzak masaüstü',
  dns_changed: 'DNS',
  hosts_file_changed: 'Sistem dosyası'
};

function eventLabel(type) {
  return EVENT_LABELS[type] || 'Güvenlik';
}

function showInAppAlert(ev) {
  const stack = document.getElementById('dmToastStack');
  if (!stack) return;
  while (stack.children.length >= 3) stack.removeChild(stack.firstElementChild);

  const card = document.createElement('div');
  card.className = 'dm-toast';
  card.setAttribute('role', 'status');
  const meta = [ev.app_name, ev.host_ip].filter(Boolean).map(escapeHtml).join(' · ');
  card.innerHTML = `
    <div class="dm-tp-body">
      <div class="dm-app-avatar">${escapeHtml(appInitials(ev.app_name || 'DM'))}</div>
      <div class="dm-tp-content">
        <div class="dm-tp-title"><strong>${escapeHtml(ev.title)}</strong></div>
        <div class="dm-tp-detail">${escapeHtml(ev.detail || '')}</div>
        <div class="dm-tp-stamps">
          <span class="dm-status-pill ${severityStamp(ev.level)}">${escapeHtml(eventLabel(ev.type))}</span>
          ${meta ? `<span class="dm-tp-meta">${meta}</span>` : ''}
        </div>
      </div>
      <button class="dm-icon-btn dm-tp-close" data-tp-close title="Kapat" aria-label="Bildirimi kapat">${ICONS.close}</button>
    </div>
    <div class="dm-tp-actions">
      <svg class="dm-mark dm-tp-mark" aria-hidden="true"><use href="#dm-mark"/></svg>
      ${ev.app_id ? `<button class="dm-pill-btn" data-tp-block>${ICONS.block}<span>Engelle</span></button>` : ''}
      <button class="dm-pill-btn" data-tp-details><span>Ayrıntılar</span></button>
    </div>
  `;

  const removeCard = () => card.remove();
  card.querySelector('[data-tp-close]')?.addEventListener('click', removeCard);
  card.querySelector('[data-tp-block]')?.addEventListener('click', async () => {
    const res = await api('/api/firewall/toggle', { method: 'POST', body: JSON.stringify({ appId: ev.app_id, blocked: true }) });
    if (!res.error) {
      state.lastToggledAppId = ev.app_id;
      removeCard();
    }
    await refreshBootstrap();
  });
  card.querySelector('[data-tp-details]')?.addEventListener('click', () => {
    removeCard();
    switchTab('alerts');
  });
  stack.appendChild(card);
  setTimeout(removeCard, 12000);
}

// Short neutral message (errors, confirmations); never used for security alerts
function showMessage(text) {
  const stack = document.getElementById('dmToastStack');
  if (!stack || !text) return;
  const card = document.createElement('div');
  card.className = 'dm-toast dm-message';
  card.setAttribute('role', 'alert');
  card.innerHTML = `<div class="dm-tp-body"><div class="dm-tp-content"><div class="dm-tp-detail">${escapeHtml(text)}</div></div>
    <button class="dm-icon-btn dm-tp-close" title="Kapat" aria-label="Kapat">${ICONS.close}</button></div>`;
  card.querySelector('button').addEventListener('click', () => card.remove());
  stack.appendChild(card);
  setTimeout(() => card.remove(), 7000);
}

// Switch main navigation tab
function switchTab(tabName) {
  state.activeTab = tabName;
  document.querySelectorAll('.dm-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.dm-view').forEach((sec) => {
    sec.classList.toggle('active', sec.id === `view-${tabName}`);
  });

  if (tabName === 'graph') {
    requestAnimationFrame(() => {
      if (state.graphSubView === 'map') {
        startGlobeLoop();
      } else {
        stopGlobeLoop();
        drawMainTrafficGraph();
        drawOverviewScrubber();
      }
    });
  } else {
    stopGlobeLoop();
    if (tabName === 'usage') loadUsageView();
    else if (tabName === 'firewall') renderFirewallView();
    else if (tabName === 'network') renderNetworkView();
    else if (tabName === 'alerts') renderAlertsView();
  }
}

async function initDarkMirror() {
  bindWindowControls();
  bindNavigationAndMenus();
  bindGraphControls();
  bindGlobeInteraction();
  bindFirewallControls();
  bindUsageControls();
  bindNetworkControls();
  bindAlertControls();

  applyThemePref(readThemePref());
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redrawCanvases);

  await refreshBootstrap();
  await loadGraphSeries();
  connectRealtimeStream();

  window.addEventListener('resize', redrawCanvases);
}

function bindWindowControls() {
  document.getElementById('btnWinMinimize')?.addEventListener('click', () => desktop?.minimize());
  document.getElementById('btnWinMaximize')?.addEventListener('click', () => desktop?.maximize());
  document.getElementById('btnWinClose')?.addEventListener('click', () => desktop?.close());

  document.getElementById('btnMiniViewer')?.addEventListener('click', async () => {
    const res = await desktop?.toggleMiniViewer();
    document.body.classList.toggle('dm-mini-viewer', Boolean(res?.isMiniViewer));
    setTimeout(() => drawMainTrafficGraph(), 60);
  });

  document.getElementById('btnRelaunchAdmin')?.addEventListener('click', () => desktop?.relaunchAsAdmin());

  if (desktop) {
    desktop.onNavigateTab((tab) => switchTab(tab));
    desktop.onSettingsUpdated((settings) => {
      state.settings = { ...state.settings, ...settings };
      syncSettingsUI();
    });
    desktop.onMiniViewerChanged((isMini) => {
      document.body.classList.toggle('dm-mini-viewer', Boolean(isMini));
      if (isMini) switchTab('graph');
      setTimeout(() => drawMainTrafficGraph(), 60);
    });
  }
}

function bindNavigationAndMenus() {
  document.querySelectorAll('.dm-tab').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  const menuBtn = document.getElementById('btnMainMenu');
  const menuBox = document.getElementById('mainDropdownMenu');

  menuBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    menuBox.hidden = !menuBox.hidden;
  });

  document.addEventListener('click', () => {
    if (menuBox) menuBox.hidden = true;
  });

  document.getElementById('menuMiniViewer')?.addEventListener('click', () => {
    document.getElementById('btnMiniViewer')?.click();
  });

  document.getElementById('menuTheme')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const cur = readThemePref();
    applyThemePref(THEME_ORDER[(THEME_ORDER.indexOf(cur) + 1) % THEME_ORDER.length]);
  });

  document.getElementById('menuVirusTotal')?.addEventListener('click', () => openVirusTotalKeyModal());

  document.getElementById('menuDataPlan')?.addEventListener('click', () => {
    switchTab('usage');
    document.getElementById('btnConfigPlan')?.click();
  });

  document.getElementById('menuExportCsv')?.addEventListener('click', () => desktop?.exportCsv('usage'));

  document.getElementById('menuClearHistory')?.addEventListener('click', async () => {
    await api('/api/usage/reset', { method: 'POST' });
    await refreshBootstrap();
    await loadGraphSeries();
  });

  document.getElementById('menuAbout')?.addEventListener('click', () => {
    showAboutModal();
  });

  document.getElementById('menuQuitApp')?.addEventListener('click', () => desktop?.quit());

  document.getElementById('btnIncognito')?.addEventListener('click', async () => {
    const res = await api('/api/settings', {
      method: 'POST',
      body: JSON.stringify({ incognito: state.settings.incognito !== 'true' })
    });
    if (res.settings) state.settings = res.settings;
    syncSettingsUI();
  });

  document.getElementById('btnSnooze')?.addEventListener('click', async () => {
    const res = await api('/api/settings', {
      method: 'POST',
      body: JSON.stringify({ snooze: state.settings.snooze !== 'true' })
    });
    if (res.settings) state.settings = res.settings;
    syncSettingsUI();
  });

  document.getElementById('btnCloseModal')?.addEventListener('click', () => {
    document.getElementById('appDetailModal').hidden = true;
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const modal = document.getElementById('appDetailModal');
    if (modal && !modal.hidden) modal.hidden = true;
    if (menuBox) menuBox.hidden = true;
  });

  document.getElementById('appDetailModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'appDetailModal') {
      document.getElementById('appDetailModal').hidden = true;
    }
  });
}

function bindGraphControls() {
  document.querySelectorAll('#graphSubViewGroup .dm-seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.graphSubView = btn.dataset.subview;
      document.querySelectorAll('#graphSubViewGroup .dm-seg-btn').forEach((b) =>
        b.classList.toggle('active', b === btn)
      );
      const chartStage = document.getElementById('graphChartStage');
      const mapStage = document.getElementById('graphMapStage');
      if (state.graphSubView === 'map') {
        chartStage.hidden = true;
        mapStage.hidden = false;
        renderGlobeCountryHud();
        startGlobeLoop();
      } else {
        stopGlobeLoop();
        chartStage.hidden = false;
        mapStage.hidden = true;
        drawMainTrafficGraph();
        drawOverviewScrubber();
      }
    });
  });

  document.querySelectorAll('#graphPivotGroup .dm-seg-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      state.graphPivot = btn.dataset.pivot;
      document.querySelectorAll('#graphPivotGroup .dm-seg-btn').forEach((b) =>
        b.classList.toggle('active', b === btn)
      );
      if (state.graphPivot === 'traffic') {
        const u = await api(`/api/usage?period=day`);
        state.protocols = u.byProtocol || [];
      }
      renderGraphSplitLists();
    });
  });

  document.querySelectorAll('#graphRangeGroup .dm-seg-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      state.graphRangeMinutes = Number(btn.dataset.minutes) || 5;
      document.querySelectorAll('#graphRangeGroup .dm-seg-btn').forEach((b) =>
        b.classList.toggle('active', b === btn)
      );
      await loadGraphSeries();
    });
  });

  const pauseBtn = document.getElementById('btnPauseGraph');
  pauseBtn?.addEventListener('click', () => {
    state.graphPaused = !state.graphPaused;
    pauseBtn.classList.toggle('paused', state.graphPaused);
    pauseBtn.innerHTML = state.graphPaused
      ? `${ICONS.play}<span>Sürdür</span>`
      : `${ICONS.pause}<span>Duraklat</span>`;
  });

  document.getElementById('graphAppFilter')?.addEventListener('change', (e) => {
    state.graphAppFilter = e.target.value;
    renderGraphSplitLists();
  });

  document.getElementById('graphAppSearch')?.addEventListener('input', () => renderGraphSplitLists());
  document.getElementById('graphHostSearch')?.addEventListener('input', () => renderGraphSplitLists());

  const canvas = document.getElementById('trafficCanvas');
  canvas?.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / Math.max(1, rect.width - 84);
    const visibleSeries = getVisibleSeries();
    if (!visibleSeries.length) return;
    const idx = Math.min(
      visibleSeries.length - 1,
      Math.max(0, Math.floor(relX * visibleSeries.length))
    );
    state.hoverIndex = idx;
    drawMainTrafficGraph();
  });

  canvas?.addEventListener('mouseleave', () => {
    state.hoverIndex = -1;
    const tip = document.getElementById('graphTooltip');
    if (tip) tip.hidden = true;
    drawMainTrafficGraph();
  });

  const overviewCanvas = document.getElementById('overviewCanvas');
  overviewCanvas?.addEventListener('click', (e) => {
    const rect = overviewCanvas.getBoundingClientRect();
    const clickRatio = Math.max(0, Math.min(0.75, (e.clientX - rect.left) / rect.width - 0.25));
    state.overviewZoomStart = clickRatio < 0.05 ? 0 : clickRatio;
    drawMainTrafficGraph();
    drawOverviewScrubber();
  });
}

function getVisibleSeries() {
  if (!state.series.length) return [];
  if (state.overviewZoomStart <= 0.01) return state.series;
  const startIdx = Math.floor(state.series.length * state.overviewZoomStart);
  return state.series.slice(startIdx);
}

// ==================== LIVE TRAFFIC GRAPH ====================
function drawMainTrafficGraph() {
  const canvas = document.getElementById('trafficCanvas');
  if (!canvas || canvas.offsetParent === null) return;

  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (width <= 0 || height <= 0) return;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);
  const c = themeColors();

  const rightAxisWidth = 84;
  const plotW = Math.max(60, width - rightAxisWidth);
  const bottomPad = 26;
  const topPad = 44;
  const plotH = Math.max(50, height - bottomPad);

  const points = getVisibleSeries();
  let maxRate = 1024;
  for (const pt of points) {
    if (pt.rx > maxRate) maxRate = pt.rx;
    if (pt.tx > maxRate) maxRate = pt.tx;
  }
  maxRate *= 1.18;

  const peakEl = document.getElementById('graphPeakRate');
  if (peakEl) peakEl.textContent = formatRate(maxRate / 1.18);

  // Axis rail
  ctx.strokeStyle = c.rule;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(plotW + 0.5, topPad - 8);
  ctx.lineTo(plotW + 0.5, plotH);
  ctx.stroke();

  const gridRows = 4;
  ctx.font = `11px ${c.mono}`;
  ctx.fillStyle = c.ink3;
  for (let i = 0; i <= gridRows; i++) {
    const y = Math.round(topPad + ((plotH - topPad) * i) / gridRows) + 0.5;
    ctx.strokeStyle = i === gridRows ? c.rule : c.ruleSoft;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(plotW, y);
    ctx.stroke();
    const val = maxRate * (1 - i / gridRows);
    ctx.fillText(formatRate(val), plotW + 10, y + 4);
  }

  if (points.length < 2) return;

  const stepX = plotW / (points.length - 1);
  const yFor = (v) => topPad + (plotH - topPad) * (1 - Math.min(1, (v || 0) / maxRate));

  function drawCurve(key, ink, fillAlpha) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, plotW, plotH);
    ctx.clip();

    ctx.beginPath();
    points.forEach((pt, idx) => {
      const x = idx * stepX;
      const y = yFor(pt[key]);
      if (idx === 0) ctx.moveTo(x, y);
      else {
        const prevX = (idx - 1) * stepX;
        const prevY = yFor(points[idx - 1][key]);
        const cx = (prevX + x) / 2;
        ctx.bezierCurveTo(cx, prevY, cx, y, x, y);
      }
    });
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.75;
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.lineTo(plotW, plotH);
    ctx.lineTo(0, plotH);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, topPad, 0, plotH);
    grad.addColorStop(0, withAlpha(ink, fillAlpha));
    grad.addColorStop(1, withAlpha(ink, 0.02));
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }

  drawCurve('rx', c.inbound, 0.22);
  drawCurve('tx', c.outbound, 0.18);

  ctx.fillStyle = c.ink3;
  ctx.font = `11px ${c.mono}`;
  const maxTicks = Math.max(2, Math.min(7, Math.floor(plotW / 120)));
  for (let i = 0; i < maxTicks; i++) {
    const idx = Math.floor((i * (points.length - 1)) / Math.max(1, maxTicks - 1));
    const rawX = idx * stepX;
    const x = Math.min(plotW - 60, Math.max(8, rawX - 26));
    ctx.fillText(formatTime(points[idx].ts), x, height - 8);
  }

  const minTs = points[0].ts;
  const maxTs = points[points.length - 1].ts;
  if (maxTs > minTs) {
    state.alerts.slice(0, 12).forEach((al) => {
      if (al.ts >= minTs && al.ts <= maxTs) {
        const ax = ((al.ts - minTs) / (maxTs - minTs)) * plotW;
        if (ax > 4 && ax < plotW - 4) {
          ctx.strokeStyle = withAlpha(c.threat, 0.35);
          ctx.setLineDash([2, 3]);
          ctx.beginPath();
          ctx.moveTo(ax, topPad);
          ctx.lineTo(ax, plotH);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = c.threat;
          ctx.beginPath();
          ctx.arc(ax, plotH - 1, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });
  }

  const tip = document.getElementById('graphTooltip');
  if (state.hoverIndex >= 0 && state.hoverIndex < points.length) {
    const pt = points[state.hoverIndex];
    const hx = Math.round(Math.min(plotW - 1, state.hoverIndex * stepX)) + 0.5;

    ctx.strokeStyle = c.ink3;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hx, topPad - 8);
    ctx.lineTo(hx, plotH);
    ctx.stroke();

    [['rx', c.inbound], ['tx', c.outbound]].forEach(([key, ink]) => {
      ctx.fillStyle = c.sheet;
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hx, yFor(pt[key]), 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    if (tip) {
      tip.hidden = false;
      tip.innerHTML = `
        <div class="dm-tip-time">${ICONS.clock}<span>${formatTime(pt.ts)}</span></div>
        <div class="dm-tip-in">Gelen <strong>${formatRate(pt.rx)}</strong></div>
        <div class="dm-tip-out">Giden <strong>${formatRate(pt.tx)}</strong></div>
      `;
    }
  }
}

// ==================== TIMELINE OVERVIEW ====================
function drawOverviewScrubber() {
  const canvas = document.getElementById('overviewCanvas');
  if (!canvas || canvas.offsetParent === null) return;

  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (width <= 0 || height <= 0) return;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const pts = state.series;
  if (pts.length < 2) return;
  const c = themeColors();

  let maxVal = 1024;
  for (const p of pts) {
    const sum = (p.rx || 0) + (p.tx || 0);
    if (sum > maxVal) maxVal = sum;
  }

  const stepX = width / (pts.length - 1);
  ctx.beginPath();
  pts.forEach((p, idx) => {
    const x = idx * stepX;
    const y = height - 5 - (height - 10) * Math.min(1, ((p.rx || 0) + (p.tx || 0)) / maxVal);
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = c.ink3;
  ctx.lineWidth = 1.25;
  ctx.stroke();
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fillStyle = withAlpha(c.ink3, 0.1);
  ctx.fill();

  const winEl = document.getElementById('overviewWindow');
  if (winEl) {
    const leftPct = (state.overviewZoomStart * 100).toFixed(1);
    winEl.style.left = `${leftPct}%`;
    winEl.style.width = `${(100 - state.overviewZoomStart * 100).toFixed(1)}%`;
  }
}

// ==================== 3D INTERACTIVE WORLD GLOBE ====================
function bindGlobeInteraction() {
  const canvas = document.getElementById('geoMapCanvas');
  if (!canvas) return;

  canvas.addEventListener('pointerdown', (e) => {
    globeState.isDragging = true;
    globeState.targetRotLon = null;
    globeState.targetRotLat = null;
    globeState.velLon = 0;
    globeState.velLat = 0;
    globeState.lastMouseX = e.clientX;
    globeState.lastMouseY = e.clientY;
    canvas.setPointerCapture?.(e.pointerId);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!globeState.isDragging) return;
    const dx = e.clientX - globeState.lastMouseX;
    const dy = e.clientY - globeState.lastMouseY;
    globeState.lastMouseX = e.clientX;
    globeState.lastMouseY = e.clientY;
    // Drag speed scales with zoom so the surface tracks the pointer
    const k = 0.42 / globeState.zoom;
    globeState.rotLon -= dx * k;
    globeState.rotLat = Math.max(-68, Math.min(68, globeState.rotLat + dy * k));
    globeState.velLon = -dx * k;
    globeState.velLat = dy * k;
  });

  const endDrag = () => {
    globeState.isDragging = false;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.12 : -0.12;
      globeState.zoomTarget = Math.max(0.65, Math.min(2.1, globeState.zoomTarget + delta));
    },
    { passive: false }
  );

  const btnAuto = document.getElementById('btnGlobeAutoRotate');
  btnAuto?.addEventListener('click', () => {
    globeState.autoRotate = !globeState.autoRotate;
    btnAuto.classList.toggle('active', globeState.autoRotate);
    const lbl = document.getElementById('globeRotateLabel');
    if (lbl) lbl.textContent = globeState.autoRotate ? 'Otomatik döndür: açık' : 'Otomatik döndür: kapalı';
  });

  document.getElementById('btnGlobeResetView')?.addEventListener('click', () => {
    if (state.home) focusGlobeOn(state.home.code);
    globeState.zoomTarget = 1.15;
  });

  document.getElementById('btnGlobeZoomIn')?.addEventListener('click', () => {
    globeState.zoomTarget = Math.min(2.1, globeState.zoomTarget + 0.2);
  });

  document.getElementById('btnGlobeZoomOut')?.addEventListener('click', () => {
    globeState.zoomTarget = Math.max(0.65, globeState.zoomTarget - 0.2);
  });
}

function startGlobeLoop() {
  if (globeState.animFrameId) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const step = () => {
    if (state.activeTab !== 'graph' || state.graphSubView !== 'map') {
      globeState.animFrameId = null;
      return;
    }
    if (globeState.targetRotLon !== null && globeState.targetRotLat !== null) {
      const ease = reduceMotion ? 1 : 0.1;
      globeState.rotLon += (globeState.targetRotLon - globeState.rotLon) * ease;
      globeState.rotLat += (globeState.targetRotLat - globeState.rotLat) * ease;
      if (
        Math.abs(globeState.targetRotLon - globeState.rotLon) < 0.2 &&
        Math.abs(globeState.targetRotLat - globeState.rotLat) < 0.2
      ) {
        globeState.targetRotLon = null;
        globeState.targetRotLat = null;
      }
    } else if (!globeState.isDragging) {
      // Momentum after a flick, decaying into the slow idle rotation
      if (Math.abs(globeState.velLon) > 0.01 || Math.abs(globeState.velLat) > 0.01) {
        globeState.rotLon += globeState.velLon;
        globeState.rotLat = Math.max(-68, Math.min(68, globeState.rotLat + globeState.velLat));
        globeState.velLon *= 0.93;
        globeState.velLat *= 0.88;
      } else if (globeState.autoRotate && !reduceMotion) {
        globeState.rotLon -= 0.12;
      }
    }
    globeState.zoom += (globeState.zoomTarget - globeState.zoom) * (reduceMotion ? 1 : 0.16);
    drawGeoMap();
    globeState.animFrameId = requestAnimationFrame(step);
  };
  globeState.animFrameId = requestAnimationFrame(step);
}

function stopGlobeLoop() {
  if (globeState.animFrameId) {
    cancelAnimationFrame(globeState.animFrameId);
    globeState.animFrameId = null;
  }
}

function project3DPoint(latDeg, lonDeg, cx, cy, radius, altitude = 1.0) {
  const lat = (latDeg * Math.PI) / 180;
  const lon = ((lonDeg + globeState.rotLon) * Math.PI) / 180;
  const tilt = (globeState.rotLat * Math.PI) / 180;

  const x0 = Math.cos(lat) * Math.sin(lon);
  const y0 = Math.sin(lat);
  const z0 = Math.cos(lat) * Math.cos(lon);

  const y1 = y0 * Math.cos(tilt) - z0 * Math.sin(tilt);
  const z1 = y0 * Math.sin(tilt) + z0 * Math.cos(tilt);

  const r = radius * altitude;
  return {
    x: cx + x0 * r,
    y: cy - y1 * r,
    z: z1
  };
}

function focusGlobeOn(code) {
  const geo = countryGeo(code);
  if (!geo) return;
  globeState.targetRotLon = -geo.lon;
  globeState.targetRotLat = Math.max(-55, Math.min(55, geo.lat * 0.75));
  globeState.velLon = 0;
  globeState.velLat = 0;
}

function renderGlobeCountryHud() {
  const hud = document.getElementById('globeCountryHud');
  if (!hud) return;

  const byCountry = new Map();
  state.hosts.forEach((h) => {
    if (!h.country) return;
    const cur = byCountry.get(h.country) || { code: h.country, count: 0, bytes: 0 };
    cur.count += 1;
    cur.bytes += (h.total_rx || 0) + (h.total_tx || 0);
    byCountry.set(h.country, cur);
  });

  const sorted = Array.from(byCountry.values()).sort((a, b) => b.bytes - a.bytes || b.count - a.count);
  hud.innerHTML = `
    <div class="dm-hud-title">Bağlanılan ülkeler · ${sorted.length}</div>
    ${
      sorted.length
        ? sorted
            .map(
              (item) => `
          <button class="dm-globe-hud-item" data-focus-country="${escapeHtml(item.code)}" title="Haritada bu ülkeye odaklan">
            <span class="dm-hud-country">
              <span class="dm-hud-code">${escapeHtml(item.code)}</span>
              <span class="dm-hud-name">
                <strong>${escapeHtml(countryName(item.code))}</strong>
                <small>${item.count} sunucu</small>
              </span>
            </span>
            <span class="dm-hud-bytes">${state.status.bytesKnown ? formatBytes(item.bytes) : ''}</span>
          </button>`
            )
            .join('')
        : '<div class="dm-muted" style="padding:6px">Henüz bağlantı yok.</div>'
    }
    <div class="dm-hud-note">Ülke, IP adresinin kayıtlı olduğu yerdir; sunucunun fiziksel konumu farklı olabilir.</div>
  `;

  hud.querySelectorAll('[data-focus-country]').forEach((el) => {
    el.addEventListener('click', () => focusGlobeOn(el.dataset.focusCountry));
  });
}

// Globe geometry helpers: unit vectors, great-circle interpolation, densified coastlines
const DEG = Math.PI / 180;

function latLonToVec(lat, lon) {
  const la = lat * DEG;
  const lo = lon * DEG;
  return [Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)];
}

function vecToLatLon(v) {
  const [x, y, z] = v;
  return [Math.asin(Math.max(-1, Math.min(1, y))) / DEG, Math.atan2(z, x) / DEG];
}

function slerpLatLon(a, b, t) {
  const va = latLonToVec(a[0], a[1]);
  const vb = latLonToVec(b[0], b[1]);
  const dot = Math.max(-1, Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
  const omega = Math.acos(dot);
  if (omega < 1e-6) return a;
  const s = Math.sin(omega);
  const ka = Math.sin((1 - t) * omega) / s;
  const kb = Math.sin(t * omega) / s;
  return vecToLatLon([va[0] * ka + vb[0] * kb, va[1] * ka + vb[1] * kb, va[2] * ka + vb[2] * kb]);
}

function greatCircleAngle(a, b) {
  const va = latLonToVec(a[0], a[1]);
  const vb = latLonToVec(b[0], b[1]);
  return Math.acos(Math.max(-1, Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2])));
}

// Coastline edges are split into ≤3° steps so they bend with the sphere instead of cutting chords
const DENSE_CONTINENTS = CONTINENT_POLYGONS.map((poly) => {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const steps = Math.max(1, Math.ceil(greatCircleAngle(a, b) / DEG / 3));
    for (let s = 0; s < steps; s++) out.push(slerpLatLon(a, b, s / steps));
  }
  return out;
});

// Natural Earth 1:110m coastlines (public domain), shipped locally; the sketch polygons are the fallback
let GLOBE_LAND = DENSE_CONTINENTS;
fetch('/brand/land-110m.json')
  .then((r) => (r.ok ? r.json() : null))
  .then((rings) => {
    if (Array.isArray(rings) && rings.length) GLOBE_LAND = rings;
  })
  .catch(() => {});

// Points behind the horizon are pushed onto the limb, so filled land clips cleanly at the edge
function projectClamped(lat, lon, cx, cy, radius) {
  const p = project3DPoint(lat, lon, cx, cy, radius);
  if (p.z >= 0) return p;
  const dx = p.x - cx;
  const dy = p.y - cy;
  const d = Math.hypot(dx, dy) || 1;
  return { x: cx + (dx / d) * radius, y: cy + (dy / d) * radius, z: p.z };
}

// Engraved-map globe: lit paper sphere, hatched land, glass-thin far side, great-circle routes
function drawGeoMap() {
  const canvas = document.getElementById('geoMapCanvas');
  if (!canvas || canvas.offsetParent === null) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w <= 0 || h <= 0) return;

  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const c = themeColors();
  const isDark = document.documentElement.dataset.theme === 'dark' ||
    (!document.documentElement.dataset.theme && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const cx = Math.max(w * 0.43, (w - 280) * 0.52);
  const cy = h * 0.5;
  const baseRadius = Math.min(w - 320, h - 48) * 0.47;
  const radius = Math.max(75, baseRadius * globeState.zoom);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nowSec = performance.now() / 1000;

  // Contact shadow: the globe rests on the page like an object on a desk
  const shadowY = cy + radius * 1.04;
  const sh = ctx.createRadialGradient(cx, shadowY, 0, cx, shadowY, radius * 0.95);
  sh.addColorStop(0, withAlpha(isDark ? '#000000' : c.ink, isDark ? 0.45 : 0.16));
  sh.addColorStop(1, withAlpha(isDark ? '#000000' : c.ink, 0));
  ctx.save();
  ctx.translate(cx, shadowY);
  ctx.scale(1, 0.16);
  ctx.translate(-cx, -shadowY);
  ctx.fillStyle = sh;
  ctx.beginPath();
  ctx.arc(cx, shadowY, radius * 0.95, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Sphere body: key light from upper left, limb falls off toward the rule colour
  const body = ctx.createRadialGradient(cx - radius * 0.38, cy - radius * 0.42, radius * 0.05, cx, cy, radius);
  body.addColorStop(0, isDark ? '#22304f' : '#ffffff');
  body.addColorStop(0.55, c.sheet);
  body.addColorStop(0.88, c.paper2);
  body.addColorStop(1, isDark ? '#0a1020' : c.rule);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();

  // Far side, seen through the glass: faint coastline only
  ctx.strokeStyle = withAlpha(c.ink, isDark ? 0.1 : 0.08);
  ctx.lineWidth = 1;
  GLOBE_LAND.forEach((poly) => {
    ctx.beginPath();
    let pen = false;
    poly.forEach(([lat, lon]) => {
      const p = project3DPoint(lat, lon, cx, cy, radius);
      if (p.z < 0) {
        if (pen) ctx.lineTo(p.x, p.y);
        else ctx.moveTo(p.x, p.y);
        pen = true;
      } else pen = false;
    });
    ctx.stroke();
  });

  // Graticule fades toward the limb so curvature reads without shading tricks
  const strokeFaded = (pts, base) => {
    let prev = null;
    pts.forEach(([lat, lon]) => {
      const p = project3DPoint(lat, lon, cx, cy, radius);
      if (prev && p.z > 0 && prev.z > 0) {
        ctx.strokeStyle = withAlpha(c.ink, base * Math.min(1, (p.z + prev.z) * 0.75));
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      prev = p;
    });
  };
  ctx.lineWidth = 0.75;
  for (let lat = -75; lat <= 75; lat += 15) {
    const pts = [];
    for (let lon = -180; lon <= 180; lon += 4) pts.push([lat, lon]);
    strokeFaded(pts, lat === 0 ? 0.2 : 0.09);
  }
  for (let lon = -180; lon < 180; lon += 15) {
    const pts = [];
    for (let lat = -84; lat <= 84; lat += 4) pts.push([lat, lon]);
    strokeFaded(pts, 0.09);
  }

  // Land: tinted fill, engraved horizontal hatching, crisp coastline
  const landPath = new Path2D();
  GLOBE_LAND.forEach((poly) => {
    let anyFront = false;
    const pts = poly.map(([lat, lon]) => {
      const p = projectClamped(lat, lon, cx, cy, radius);
      if (p.z > 0) anyFront = true;
      return p;
    });
    if (!anyFront) return;
    pts.forEach((p, i) => (i ? landPath.lineTo(p.x, p.y) : landPath.moveTo(p.x, p.y)));
    landPath.closePath();
  });
  ctx.fillStyle = withAlpha(c.ink, isDark ? 0.1 : 0.06);
  ctx.fill(landPath);
  ctx.save();
  ctx.clip(landPath);
  ctx.strokeStyle = withAlpha(c.ink, isDark ? 0.2 : 0.16);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  const gap = Math.max(2.5, radius / 70);
  for (let y = cy - radius; y <= cy + radius; y += gap) {
    ctx.moveTo(cx - radius, y);
    ctx.lineTo(cx + radius, y);
  }
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = withAlpha(c.ink, isDark ? 0.62 : 0.55);
  ctx.lineWidth = 1;
  ctx.lineJoin = 'round';
  GLOBE_LAND.forEach((poly) => {
    ctx.beginPath();
    let pen = false;
    poly.forEach(([lat, lon]) => {
      const p = project3DPoint(lat, lon, cx, cy, radius);
      if (p.z >= 0) {
        if (pen) ctx.lineTo(p.x, p.y);
        else ctx.moveTo(p.x, p.y);
        pen = true;
      } else pen = false;
    });
    ctx.stroke();
  });

  // Specular sheen, then a soft terminator on the lower right for volume
  const sheen = ctx.createRadialGradient(cx - radius * 0.45, cy - radius * 0.5, 0, cx - radius * 0.45, cy - radius * 0.5, radius * 0.7);
  sheen.addColorStop(0, `rgba(255, 255, 255, ${isDark ? 0.07 : 0.5})`);
  sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  const shade = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.35, radius * 0.6, cx, cy, radius * 1.05);
  shade.addColorStop(0, 'rgba(0, 0, 0, 0)');
  shade.addColorStop(1, `rgba(0, 0, 0, ${isDark ? 0.35 : 0.1})`);
  ctx.fillStyle = shade;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  ctx.restore();

  // Engraved double rim
  ctx.strokeStyle = withAlpha(c.ink, isDark ? 0.4 : 0.32);
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = withAlpha(c.ink, isDark ? 0.22 : 0.16);
  ctx.lineWidth = 0.75;
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 5, 0, Math.PI * 2);
  ctx.stroke();

  // Routes: great-circle arcs lifted off the surface, height by distance, width by volume
  const originGeo = state.home && state.home.lat != null ? state.home : null;
  const origin = originGeo ? [originGeo.lat, originGeo.lon] : null;
  const originPt = originGeo ? project3DPoint(originGeo.lat, originGeo.lon, cx, cy, radius, 1.0) : { z: -1 };

  const uniqueTargets = new Map();
  state.hosts.forEach((hst) => {
    if (!hst.country || hst.country === 'LAN' || hst.lat == null) return;
    const bytes = (hst.total_rx || 0) + (hst.total_tx || 0);
    if (!uniqueTargets.has(hst.country)) uniqueTargets.set(hst.country, { code: hst.country, bytes, count: 1, lat: hst.lat, lon: hst.lon });
    else {
      const t = uniqueTargets.get(hst.country);
      t.bytes += bytes;
      t.count += 1;
    }
  });
  const targets = Array.from(uniqueTargets.values()).sort((a, b) => b.bytes - a.bytes);
  const maxBytes = Math.max(1, ...targets.map((t) => (state.status.bytesKnown ? t.bytes : t.count)));
  const placedLabels = [];
  const markers = [];

  targets.forEach((targetInfo, idx) => {
    const destGeo = targetInfo;
    if (!origin || (originGeo && targetInfo.code === originGeo.code)) {
      const p = project3DPoint(destGeo.lat, destGeo.lon, cx, cy, radius, 1.0);
      if (p.z > 0.05) markers.push({ destPt: p, targetInfo, weight: 0.4, idx });
      return;
    }
    const dest = [destGeo.lat, destGeo.lon];
    const span = greatCircleAngle(origin, dest);
    const lift = 0.05 + Math.min(0.2, span * 0.16);
    const weight = 0.35 + 0.65 * Math.sqrt((state.status.bytesKnown ? targetInfo.bytes : targetInfo.count) / maxBytes);
    const segs = 48;
    const pts = [];
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const [la, lo] = slerpLatLon(origin, dest, t);
      pts.push(project3DPoint(la, lo, cx, cy, radius, 1 + Math.sin(t * Math.PI) * lift));
    }

    // Occlusion: a lifted point is hidden only when it sits behind the sphere's disc
    const visible = (p) => p.z > -0.05 || Math.hypot(p.x - cx, p.y - cy) > radius;
    ctx.lineCap = 'round';
    for (let s = 1; s < pts.length; s++) {
      const a = pts[s - 1];
      const b = pts[s];
      if (!visible(a) || !visible(b)) continue;
      ctx.strokeStyle = withAlpha(c.inbound, 0.25 + 0.6 * weight);
      ctx.lineWidth = 0.9 + 1.6 * weight;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    if (!reduceMotion) {
      // A short travelling trail rather than a single dot
      const head = (nowSec * 0.32 + idx * 0.173) % 1;
      for (let k = 0; k < 6; k++) {
        const t = head - k * 0.018;
        if (t < 0) continue;
        const [la, lo] = slerpLatLon(origin, dest, t);
        const p = project3DPoint(la, lo, cx, cy, radius, 1 + Math.sin(t * Math.PI) * lift);
        if (!visible(p)) continue;
        ctx.fillStyle = withAlpha(c.outbound, 1 - k / 6);
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.8, 2.6 - k * 0.35), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const destPt = project3DPoint(destGeo.lat, destGeo.lon, cx, cy, radius, 1.0);
    if (destPt.z > 0.05) markers.push({ destPt, targetInfo, weight, idx });
  });

  // Destination marks drawn after all routes so they sit on top
  markers.forEach(({ destPt, targetInfo, weight, idx }) => {
    const r = 3 + 2.5 * weight;
    if (!reduceMotion) {
      const phase = (nowSec * 0.6 + idx * 0.29) % 1;
      ctx.strokeStyle = withAlpha(c.ink, 0.35 * (1 - phase));
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(destPt.x, destPt.y, r + phase * 10, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = c.sheet;
    ctx.strokeStyle = c.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(destPt.x, destPt.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = c.ink;
    ctx.beginPath();
    ctx.arc(destPt.x, destPt.y, Math.max(1.2, r * 0.38), 0, Math.PI * 2);
    ctx.fill();

    // Label with a short leader line, placed away from the globe centre
    const dirX = destPt.x >= cx ? 1 : -1;
    const labelText = state.status.bytesKnown ? `${targetInfo.code}  ${formatBytes(targetInfo.bytes)}` : `${targetInfo.code}  ${targetInfo.count} sunucu`;
    ctx.font = `600 11px ${c.mono}`;
    const textW = ctx.measureText(labelText).width + 14;
    const textH = 20;
    const lx = dirX > 0 ? destPt.x + 16 : destPt.x - 16 - textW;
    const ly = destPt.y - 24;
    const collides = placedLabels.some(
      (box) => lx < box.x + box.w + 4 && lx + textW + 4 > box.x && ly < box.y + box.h + 3 && ly + textH + 3 > box.y
    );
    if (collides) return;
    placedLabels.push({ x: lx, y: ly, w: textW, h: textH });
    ctx.strokeStyle = withAlpha(c.ink, 0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(destPt.x + dirX * (r + 1), destPt.y - 1);
    ctx.lineTo(dirX > 0 ? lx : lx + textW, ly + textH / 2);
    ctx.stroke();
    ctx.fillStyle = c.sheet;
    ctx.strokeStyle = c.rule;
    ctx.beginPath();
    ctx.roundRect(lx, ly, textW, textH, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = c.ink;
    ctx.fillText(labelText, lx + 7, ly + 14);
  });

  // Home: ink square, the passport-issuing office
  if (originPt.z > 0) {
    ctx.fillStyle = c.ink;
    ctx.strokeStyle = c.sheet;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(originPt.x - 5.5, originPt.y - 5.5, 11, 11);
    ctx.fill();
    ctx.stroke();
  }

  const overlayCount = document.getElementById('mapActiveCountries');
  if (overlayCount) {
    overlayCount.textContent = `${uniqueTargets.size} ülke · ${state.hosts.length} sunucu`;
  }
}

// ==================== GRAPH BOTTOM 2-COLUMN SPLIT (APPS | HOSTS) ====================
function renderGraphSplitLists() {
  const appSearch = (document.getElementById('graphAppSearch')?.value || '').toLowerCase();
  const hostSearch = (document.getElementById('graphHostSearch')?.value || '').toLowerCase();

  const filterSelect = document.getElementById('graphAppFilter');
  if (filterSelect) {
    const currentVal = filterSelect.value;
    const existingNames = new Set(
      Array.from(filterSelect.options)
        .slice(1)
        .map((o) => o.value)
    );
    state.apps.forEach((a) => {
      if (!existingNames.has(a.name)) {
        const opt = document.createElement('option');
        opt.value = a.name;
        opt.textContent = a.name;
        filterSelect.appendChild(opt);
      }
    });
    filterSelect.value = currentVal;
  }

  const filteredApps = state.apps.filter((a) => {
    if (state.graphAppFilter && a.name !== state.graphAppFilter) return false;
    if (!appSearch) return true;
    return (
      a.name.toLowerCase().includes(appSearch) ||
      (a.publisher || '').toLowerCase().includes(appSearch)
    );
  });

  const maxAppBytes = Math.max(
    1,
    ...filteredApps.map((a) => (a.total_rx || 0) + (a.total_tx || 0))
  );

  document.getElementById('graphAppsCount').textContent = String(filteredApps.length);
  const appsContainer = document.getElementById('graphAppsList');
  if (appsContainer) {
    appsContainer.innerHTML = filteredApps.length
      ? filteredApps
      .slice(0, 45)
      .map((app) => {
        const total = (app.total_rx || 0) + (app.total_tx || 0);
        const pct = Math.max(3, Math.round((total / maxAppBytes) * 100));
        return `
          <div class="dm-row-item" data-app-id="${escapeHtml(app.id)}">
            <button class="dm-row-gate ${Number(app.blocked) === 1 ? 'blocked' : ''}" data-row-gate="${escapeHtml(app.id)}"
              title="${Number(app.blocked) === 1 ? 'Engelli — izin vermek için tıklayın' : 'İzinli — engellemek için tıklayın'}"
              aria-label="${Number(app.blocked) === 1 ? `${escapeHtml(app.name)} için izin ver` : `${escapeHtml(app.name)} uygulamasını engelle`}">
              ${Number(app.blocked) === 1 ? ICONS.gateClosed : ICONS.gateOpen}
            </button>
            <div class="dm-row-left">
              <div class="dm-app-avatar">${escapeHtml(appInitials(app.name))}</div>
              <div class="dm-row-titles">
                <strong>${escapeHtml(app.name)}</strong>
                <small>${escapeHtml(publisherText(app))}</small>
              </div>
            </div>
            <div class="dm-row-right">${rowFigures(app.total_rx, app.total_tx, app.live_connections)}</div>
            ${rowBar(pct, app.total_rx, app.total_tx)}
          </div>
        `;
      })
      .join('')
      : emptyState('Uygulama yok', appSearch ? 'Aramanızla eşleşen uygulama bulunamadı.' : 'Ağa çıkan uygulamalar burada listelenir.');

    appsContainer.querySelectorAll('[data-row-gate]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const appObj = state.apps.find((x) => String(x.id) === String(btn.dataset.rowGate));
        if (!appObj) return;
        btn.disabled = true;
        await api('/api/firewall/toggle', {
          method: 'POST',
          body: JSON.stringify({ appId: appObj.id, blocked: Number(appObj.blocked) !== 1 })
        });
        state.lastToggledAppId = appObj.id;
        await refreshBootstrap();
      });
    });

    appsContainer.querySelectorAll('.dm-row-item').forEach((row) => {
      row.addEventListener('click', () => {
        const appObj = state.apps.find((x) => String(x.id) === String(row.dataset.appId));
        if (appObj) openAppDetailModal(appObj);
      });
    });
  }

  const rightTitle = document.getElementById('graphRightPaneTitle');
  const hostsContainer = document.getElementById('graphHostsList');
  if (!hostsContainer) return;

  // Pivot 1: Protocols
  if (state.graphPivot === 'traffic') {
    if (rightTitle) rightTitle.textContent = 'Protokoller';
    const maxProto = Math.max(1, ...state.protocols.map((p) => (p.rx || 0) + (p.tx || 0)));
    document.getElementById('graphHostsCount').textContent = String(state.protocols.length);
    if (!state.protocols.length) {
      hostsContainer.innerHTML = state.status.bytesKnown
        ? emptyState('Henüz veri yok', 'Bugün ölçülmüş bağlantı trafiği burada port ve servise göre listelenir.')
        : emptyState('Ölçüm yok', 'Servis başına trafik, DarkMirror yönetici olarak çalışırken ölçülür.');
      return;
    }
    hostsContainer.innerHTML = state.protocols
      .map((p) => {
        const total = (p.rx || 0) + (p.tx || 0);
        const pct = Math.max(4, Math.round((total / maxProto) * 100));
        return `
          <div class="dm-row-item">
            <div class="dm-row-left">
              <div class="dm-app-avatar">${escapeHtml(p.protocol.slice(0, 3))}</div>
              <div class="dm-row-titles">
                <strong>${escapeHtml(p.protocol)}</strong>
                <small>port ${p.port} · ${p.app_count || 1} uygulama</small>
              </div>
            </div>
            <div class="dm-row-right">${rowFigures(p.rx, p.tx, 0)}</div>
            ${rowBar(pct, p.rx, p.tx)}
          </div>
        `;
      })
      .join('');
    return;
  }

  // Pivot 2: Publishers
  if (state.graphPivot === 'publishers') {
    if (rightTitle) rightTitle.textContent = 'Yayımcılar';
    const byPub = new Map();
    state.apps.forEach((a) => {
      const pub = a.signature === 'valid' && a.signer ? a.signer : 'İmzasız veya doğrulanmamış';
      const cur = byPub.get(pub) || { publisher: pub, rx: state.status.bytesKnown ? 0 : null, tx: state.status.bytesKnown ? 0 : null, count: 0, live: 0 };
      cur.live += a.live_connections || 0;
      if (cur.rx !== null) {
        cur.rx += a.total_rx || 0;
        cur.tx += a.total_tx || 0;
      }
      cur.count += 1;
      byPub.set(pub, cur);
    });
    const pubList = Array.from(byPub.values()).sort((a, b) => b.rx + b.tx - (a.rx + a.tx));
    const maxPub = Math.max(1, ...pubList.map((p) => p.rx + p.tx));
    document.getElementById('graphHostsCount').textContent = String(pubList.length);
    hostsContainer.innerHTML = pubList
      .map((p) => {
        const total = p.rx + p.tx;
        const pct = Math.max(4, Math.round((total / maxPub) * 100));
        return `
          <div class="dm-row-item">
            <div class="dm-row-left">
              <div class="dm-app-avatar">${escapeHtml(p.publisher.slice(0, 2).toUpperCase())}</div>
              <div class="dm-row-titles">
                <strong>${escapeHtml(p.publisher)}</strong>
                <small>${p.count} uygulama</small>
              </div>
            </div>
            <div class="dm-row-right">${rowFigures(p.rx, p.tx, p.live)}</div>
            ${rowBar(pct, p.rx, p.tx)}
          </div>
        `;
      })
      .join('');
    return;
  }

  // Default: Hosts
  if (rightTitle) rightTitle.textContent = 'Sunucular';
  const filteredHosts = state.hosts.filter((h) => {
    if (!hostSearch) return true;
    return (
      (h.hostname || '').toLowerCase().includes(hostSearch) ||
      (h.remote_ip || '').toLowerCase().includes(hostSearch) ||
      (h.country || '').toLowerCase().includes(hostSearch)
    );
  });

  const maxHostBytes = Math.max(
    1,
    ...filteredHosts.map((h) => (h.total_rx || 0) + (h.total_tx || 0))
  );
  document.getElementById('graphHostsCount').textContent = String(filteredHosts.length);

  hostsContainer.innerHTML = filteredHosts.length
    ? filteredHosts
    .slice(0, 45)
    .map((h) => {
      const total = (h.total_rx || 0) + (h.total_tx || 0);
      const pct = Math.max(3, Math.round((total / maxHostBytes) * 100));
      return `
        <div class="dm-row-item" data-host-ip="${escapeHtml(h.remote_ip)}">
          <div class="dm-row-left">
            <div class="dm-app-avatar">${escapeHtml(h.country || 'IP')}</div>
            <div class="dm-row-titles">
              <strong>${escapeHtml(h.hostname || h.remote_ip)}</strong>
              <small>${escapeHtml(h.remote_ip)}${h.protocol ? ` · ${escapeHtml(h.protocol)}` : ''} · ${escapeHtml(countryName(h.country))}</small>
            </div>
          </div>
          <div class="dm-row-right">${rowFigures(h.total_rx, h.total_tx, 0)}</div>
          ${rowBar(pct, h.total_rx, h.total_tx)}
        </div>
      `;
    })
    .join('')
    : emptyState('Sunucu yok', hostSearch ? 'Aramanızla eşleşen sunucu bulunamadı.' : 'Uzak sunucu bağlantıları burada görünür.');

  hostsContainer.querySelectorAll('[data-host-ip]').forEach((row) => {
    row.addEventListener('click', () => {
      openHostDetailModal(row.dataset.hostIp);
    });
  });

  if (state.graphSubView === 'map') {
    renderGlobeCountryHud();
  }
}

// ==================== FIREWALL VIEW ====================
// Every block here is a real Windows Defender Firewall rule (group "DarkMirror")
function bindFirewallControls() {
  document.getElementById('btnFirewallToggle')?.addEventListener('click', async () => {
    const res = await api('/api/firewall/enabled', {
      method: 'POST',
      body: JSON.stringify({ enabled: state.settings.rules_enabled === 'false' })
    });
    if (res.settings) state.settings = res.settings;
    syncSettingsUI();
  });

  document.getElementById('btnUnblockAll')?.addEventListener('click', async () => {
    await api('/api/firewall/unblock-all', { method: 'POST' });
    await refreshBootstrap();
  });

  document.getElementById('firewallSearch')?.addEventListener('input', () => renderFirewallView());

  document.getElementById('btnAddFirewallRule')?.addEventListener('click', async () => {
    const exePath = await desktop?.pickExecutable();
    if (!exePath) return;
    const res = await api('/api/firewall/add', { method: 'POST', body: JSON.stringify({ exePath }) });
    if (!res.error) state.lastToggledAppId = res.app?.id;
    await refreshBootstrap();
  });
}

function vtCell(app) {
  const id = escapeHtml(app.id);
  if (!app.exe_path) return '<span class="dm-muted">—</span>';
  if (app.vt_status === 'clean') {
    return `<button class="dm-status-pill allowed" data-vt-id="${id}" title="Yeniden sorgula">${ICONS.shieldCheck}<span>Temiz ${app.vt_detections}/${app.vt_total}</span></button>`;
  }
  if (app.vt_status === 'malicious') {
    return `<button class="dm-status-pill threat" data-vt-id="${id}" title="Yeniden sorgula">${ICONS.alert}<span>Tehdit ${app.vt_detections}/${app.vt_total}</span></button>`;
  }
  if (app.vt_status === 'not_found') {
    return `<button class="dm-status-pill neutral" data-vt-id="${id}" title="VirusTotal bu dosyayı hiç görmemiş">${ICONS.shieldCheck}<span>Kayıt yok</span></button>`;
  }
  return `<button class="dm-pill-btn" data-vt-id="${id}">${ICONS.shieldCheck}<span>Sorgula</span></button>`;
}

async function runVirusTotal(appId) {
  if (state.settings.vt_key_set !== 'true') {
    openVirusTotalKeyModal(appId);
    return null;
  }
  const res = await api('/api/virustotal/scan', { method: 'POST', body: JSON.stringify({ appId }) });
  if (res.code === 'no_key' || res.code === 'bad_key') openVirusTotalKeyModal(appId);
  await refreshBootstrap();
  return res.app || null;
}

function renderFirewallView() {
  const tbody = document.getElementById('firewallTableBody');
  if (!tbody) return;

  const q = (document.getElementById('firewallSearch')?.value || '').toLowerCase();
  const list = state.apps.filter((app) => {
    if (!q) return true;
    return (
      app.name.toLowerCase().includes(q) ||
      (app.exe_path || '').toLowerCase().includes(q) ||
      publisherText(app).toLowerCase().includes(q)
    );
  });

  const blockedCount = state.apps.filter((a) => Number(a.blocked) === 1).length;
  const summaryEl = document.getElementById('firewallSummaryStats');
  if (summaryEl) summaryEl.textContent = `${state.apps.length} uygulama · ${blockedCount} engelli`;

  const fwBadge = document.getElementById('firewallBadge');
  if (fwBadge) {
    fwBadge.hidden = blockedCount === 0;
    fwBadge.textContent = String(blockedCount);
  }

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="height:auto">${emptyState(
      'Uygulama bulunamadı',
      q ? 'Aramanızla eşleşen uygulama yok.' : 'Ağa bağlanan uygulamalar burada görünür.'
    )}</td></tr>`;
  } else {
    tbody.innerHTML = list
      .map((app) => {
        const isBlocked = Number(app.blocked) === 1;
        const canGate = Boolean(app.exe_path);
        const stamped = String(state.lastToggledAppId) === String(app.id) ? ' dm-stamped' : '';
        return `
        <tr class="${isBlocked ? 'is-blocked' : ''}">
          <td style="text-align:center;">
            <button class="dm-gate-btn ${isBlocked ? 'blocked' : ''}" data-toggle-id="${escapeHtml(app.id)}" ${canGate ? '' : 'disabled'}
              title="${!canGate ? 'Dosya yolu okunamadığı için kural oluşturulamıyor' : isBlocked ? 'Geçit kapalı — izin vermek için tıklayın' : 'Geçit açık — engellemek için tıklayın'}"
              aria-label="${isBlocked ? `${escapeHtml(app.name)} için izin ver` : `${escapeHtml(app.name)} uygulamasını engelle`}">
              ${isBlocked ? ICONS.gateClosed : ICONS.gateOpen}
            </button>
          </td>
          <td>
            <div class="dm-row-left" style="cursor:pointer;" data-detail-id="${escapeHtml(app.id)}">
              <div class="dm-app-avatar">${escapeHtml(appInitials(app.name))}</div>
              <div class="dm-row-titles">
                <strong>${escapeHtml(app.name)} ${signatureStamp(app)}</strong>
                <small>${escapeHtml(publisherText(app))}${app.exe_path ? ` · ${escapeHtml(app.exe_path)}` : ''}</small>
              </div>
            </div>
          </td>
          <td class="dm-host-cell num-mono">${app.last_seen ? formatDateTime(app.last_seen) : '—'}</td>
          <td class="num in">${formatBytes(app.total_rx)}</td>
          <td class="num out">${formatBytes(app.total_tx)}</td>
          <td>${vtCell(app)}</td>
          <td>
            <span class="dm-status-pill ${isBlocked ? 'blocked' : 'allowed'}${stamped}">
              ${isBlocked ? `${ICONS.block}<span>Engelli</span>` : `${ICONS.check}<span>İzinli</span>`}
            </span>
          </td>
          <td style="text-align:right;">
            ${canGate ? `<button class="dm-pill-btn" data-toggle-id="${escapeHtml(app.id)}"><span>${isBlocked ? 'İzin ver' : 'Engelle'}</span></button>` : ''}
          </td>
        </tr>
      `;
      })
      .join('');
  }
  state.lastToggledAppId = null;

  tbody.querySelectorAll('[data-toggle-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.toggleId;
      const appObj = state.apps.find((a) => String(a.id) === String(id));
      if (!appObj) return;
      btn.disabled = true;
      const res = await api('/api/firewall/toggle', {
        method: 'POST',
        body: JSON.stringify({ appId: id, blocked: Number(appObj.blocked) !== 1 })
      });
      if (!res.error) state.lastToggledAppId = id;
      await refreshBootstrap();
    });
  });

  tbody.querySelectorAll('[data-vt-id]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      btn.disabled = true;
      btn.innerHTML = `${ICONS.shieldCheck}<span>Sorgulanıyor…</span>`;
      await runVirusTotal(btn.dataset.vtId);
      renderFirewallView();
    });
  });

  tbody.querySelectorAll('[data-detail-id]').forEach((el) => {
    el.addEventListener('click', () => {
      const appObj = state.apps.find((a) => String(a.id) === String(el.dataset.detailId));
      if (appObj) openAppDetailModal(appObj);
    });
  });
}

// ==================== USAGE VIEW ====================
function bindUsageControls() {
  document.querySelectorAll('#usagePeriodGroup .dm-seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.usagePeriod = btn.dataset.period;
      document.querySelectorAll('#usagePeriodGroup .dm-seg-btn').forEach((b) =>
        b.classList.toggle('active', b === btn)
      );
      loadUsageView();
    });
  });

  document.getElementById('btnExportUsage')?.addEventListener('click', () => desktop?.exportCsv('usage'));

  document.getElementById('btnResetUsage')?.addEventListener('click', async () => {
    await api('/api/usage/reset', { method: 'POST' });
    await loadUsageView();
    await refreshBootstrap();
  });

  document.getElementById('btnConfigPlan')?.addEventListener('click', () => {
    openDataPlanModal();
  });
}

async function loadUsageView() {
  const data = await api(`/api/usage?period=${state.usagePeriod}`);
  const rx = data.totals?.rx || 0;
  const tx = data.totals?.tx || 0;
  const lanBytes = data.totals?.lanBytes || 0;
  const attributed = (data.totals?.attributedRx || 0) + (data.totals?.attributedTx || 0);
  const total = rx + tx;

  state.protocols = data.byProtocol || [];

  document.getElementById('usageTotalBytes').textContent = formatBytes(total);
  document.getElementById('usageDownBytes').textContent = formatBytes(rx);
  document.getElementById('usageUpBytes').textContent = formatBytes(tx);

  const rxPct = total > 0 ? Math.round((rx / total) * 100) : 0;
  const txPct = total > 0 ? 100 - rxPct : 0;
  document.getElementById('usageDownPercent').textContent = `Toplamın %${rxPct} kadarı`;
  document.getElementById('usageUpPercent').textContent = `Toplamın %${txPct} kadarı`;
  if (data.bytesKnown) {
    const share = total > 0 ? Math.min(100, Math.round((attributed / total) * 100)) : 0;
    document.getElementById('usageActiveCounts').textContent = `%${share}`;
    document.getElementById('usageTopPublisher').textContent = `${formatBytes(attributed)} TCP trafiği uygulamalara atandı · yerel ağ ${formatBytes(lanBytes)}. Kalanı UDP/QUIC ve sistem trafiği.`;
  } else {
    document.getElementById('usageActiveCounts').textContent = '—';
    document.getElementById('usageTopPublisher').textContent = 'Uygulama başına ölçüm için DarkMirror yönetici olarak çalışmalı.';
  }

  const quotaGb = Number(state.settings.bandwidth_quota_gb) || 100;
  const quotaBytes = quotaGb * 1024 * 1024 * 1024;
  const usedPct = Math.min(100, (total / quotaBytes) * 100);
  document.getElementById('quotaText').textContent = `${formatBytes(total)} / ${quotaGb} GB`;
  document.getElementById('quotaPercentText').textContent = `%${usedPct.toFixed(1)}`;
  document.getElementById('quotaFillBar').style.width = `${Math.max(2, usedPct)}%`;

  state.usageTotals = { rx, tx };
  drawUsageDonut(rx, tx);

  renderUsageColumn(
    'usageAppsList',
    data.byApp || [],
    (item) => ({
      id: item.id,
      type: 'app',
      badge: appInitials(item.name),
      title: item.name,
      sub: item.signature === 'valid' && item.publisher ? item.publisher : item.publisher ? `${item.publisher} (doğrulanmamış)` : 'Yayımcı bilgisi yok',
      rx: item.rx,
      tx: item.tx
    })
  );

  renderUsageColumn(
    'usageProtocolsList',
    data.byProtocol || [],
    (item) => ({
      id: item.port,
      type: 'proto',
      badge: (item.protocol || 'TCP').slice(0, 3),
      title: item.protocol,
      sub: `port ${item.port} · ${item.app_count} uygulama`,
      rx: item.rx,
      tx: item.tx
    })
  );

  renderUsageColumn(
    'usageHostsList',
    data.byHost || [],
    (item) => ({
      id: item.remote_ip,
      type: 'host',
      badge: item.country || 'IP',
      title: item.hostname || item.remote_ip,
      sub: `${item.remote_ip} · ${countryName(item.country)}`,
      rx: item.rx,
      tx: item.tx
    })
  );
}

function renderUsageColumn(containerId, items, mapper) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const maxVal = Math.max(1, ...items.map((i) => (i.rx || 0) + (i.tx || 0)));

  if (!items.length) {
    el.innerHTML = state.status.bytesKnown
      ? emptyState('Bu dönemde kayıt yok', 'Seçili dönem için ölçülmüş trafik yok.')
      : emptyState('Ölçüm yok', 'Uygulama ve sunucu başına trafik, DarkMirror yönetici olarak çalışırken ölçülür.');
    return;
  }

  el.innerHTML = items
    .map((raw) => {
      const item = mapper(raw);
      const total = (item.rx || 0) + (item.tx || 0);
      const pct = Math.max(3, Math.round((total / maxVal) * 100));
      return `
        <div class="dm-row-item" data-usage-type="${escapeHtml(item.type)}" data-usage-id="${escapeHtml(item.id)}">
          <div class="dm-row-left">
            <div class="dm-app-avatar">${escapeHtml(item.badge)}</div>
            <div class="dm-row-titles">
              <strong>${escapeHtml(item.title)}</strong>
              <small>${escapeHtml(item.sub)}</small>
            </div>
          </div>
          <div class="dm-row-right">
            <strong>${formatBytes(total)}</strong>
            ${inOutSmall(item.rx, item.tx)}
          </div>
          ${rowBar(pct, item.rx, item.tx)}
        </div>
      `;
    })
    .join('');

  el.querySelectorAll('.dm-row-item').forEach((row) => {
    row.addEventListener('click', () => {
      const t = row.dataset.usageType;
      const id = row.dataset.usageId;
      if (t === 'app') {
        const appObj = state.apps.find((a) => String(a.id) === String(id));
        if (appObj) openAppDetailModal(appObj);
      } else if (t === 'host') {
        openHostDetailModal(id);
      }
    });
  });
}

function drawUsageDonut(rx = 1, tx = 1) {
  const canvas = document.getElementById('usageDonutCanvas');
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const size = 144;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, size, size);
  const c = themeColors();

  const cx = size / 2;
  const cy = size / 2;
  const r = 58;
  const total = Math.max(1, rx + tx);
  const rxAngle = (rx / total) * Math.PI * 2;
  const gap = rx > 0 && tx > 0 ? 0.04 : 0;

  ctx.lineWidth = 10;
  ctx.lineCap = 'butt';
  ctx.strokeStyle = c.ruleSoft;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  if (rx > 0) {
    ctx.strokeStyle = c.inbound;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2 + gap, -Math.PI / 2 + rxAngle - gap);
    ctx.stroke();
  }
  if (tx > 0) {
    ctx.strokeStyle = c.outbound;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2 + rxAngle + gap, Math.PI * 1.5 - gap);
    ctx.stroke();
  }
}

// ==================== NETWORK VIEW ====================
function bindNetworkControls() {
  const scanBtn = document.getElementById('btnScanLan');
  const scanText = document.getElementById('scanLanBtnText');
  scanBtn?.addEventListener('click', async () => {
    scanBtn.disabled = true;
    if (scanText) scanText.textContent = 'Taranıyor…';
    const res = await api('/api/lan/scan', { method: 'POST' });
    if (res.devices) state.lanDevices = res.devices;
    if (res.adapter) state.adapter = res.adapter;
    scanBtn.disabled = false;
    if (scanText) scanText.textContent = 'Ağı tara';
    renderNetworkView();
  });

  document.getElementById('btnExportNetworkCsv')?.addEventListener('click', () => desktop?.exportCsv('network'));

  document.getElementById('lanSearchInput')?.addEventListener('input', () => renderNetworkView());
}

function renderNetworkView() {
  const q = (document.getElementById('lanSearchInput')?.value || '').toLowerCase();
  const devices = state.lanDevices.filter((d) => {
    if (!q) return true;
    return (
      d.ip.toLowerCase().includes(q) ||
      d.mac.toLowerCase().includes(q) ||
      (d.vendor || '').toLowerCase().includes(q) ||
      (d.hostname || '').toLowerCase().includes(q) ||
      (d.custom_name || '').toLowerCase().includes(q)
    );
  });

  document.getElementById('networkCountBadge').textContent = String(state.lanDevices.length);
  document.getElementById('sidebarDeviceCount').textContent = String(devices.length);
  document.getElementById('lanScanStatus').textContent = `${state.lanDevices.length} cihaz · son taramada ${
    state.lanDevices.filter((d) => d.online).length
  } tanesi görüldü`;

  const stripEl = document.getElementById('adapterInfoStrip');
  if (stripEl && state.adapter) {
    const a = state.adapter;
    stripEl.innerHTML = a.localIp
      ? `${escapeHtml(a.adapterName || '')} · IP <strong>${escapeHtml(a.localIp)}</strong> · Ağ geçidi <strong>${escapeHtml(
          a.gateway || '—'
        )}</strong> · DNS <strong>${escapeHtml((a.dnsServers || []).join(', ') || '—')}</strong>`
      : 'Etkin ağ bağlantısı bulunamadı';
  }

  const sideEl = document.getElementById('networkSidebarList');
  if (sideEl) {
    sideEl.innerHTML = devices
      .map(
        (d) => `
        <button class="dm-side-device ${state.selectedLanIp === d.ip ? 'is-selected' : ''}" data-side-ip="${escapeHtml(d.ip)}">
          <span class="dm-side-name">
            <span class="dm-presence ${d.online ? 'on' : ''}" title="${d.online ? 'Son taramada görüldü' : 'Son taramada görülmedi'}"></span>
            <span>${escapeHtml(d.custom_name || d.hostname || d.ip)}</span>
          </span>
          <span class="dm-side-ip">${escapeHtml(d.ip)}</span>
        </button>
      `
      )
      .join('');

    sideEl.querySelectorAll('[data-side-ip]').forEach((row) => {
      row.addEventListener('click', () => {
        state.selectedLanIp = state.selectedLanIp === row.dataset.sideIp ? '' : row.dataset.sideIp;
        renderNetworkView();
      });
    });
  }

  const visibleCards = state.selectedLanIp
    ? devices.filter((d) => d.ip === state.selectedLanIp)
    : devices;

  const gridEl = document.getElementById('lanDevicesGrid');
  if (gridEl) {
    gridEl.innerHTML = visibleCards.length
      ? visibleCards
      .map((d) => {
        const isGw = d.kind === 'gateway';
        const kindLabel = d.kind === 'gateway' ? 'Ağ geçidi (modem/router)' : d.kind === 'self' ? 'Bu bilgisayar' : null;
        const vendor = d.vendor || (d.randomized ? 'Rastgele MAC (gizlilik özelliği)' : 'Bilinmiyor');
        return `
        <div class="dm-device-card">
          <div class="dm-device-top">
            <span class="dm-device-ip">${escapeHtml(d.ip)}</span>
            <span class="dm-status-pill ${d.online ? 'allowed' : 'neutral'}">${d.online ? 'Görüldü' : 'Görülmedi'}</span>
          </div>
          <div class="dm-device-name">
            ${isGw ? ICONS.router : ICONS.desktop}
            <span>${escapeHtml(d.custom_name || d.hostname || kindLabel || 'Adı bilinmiyor')}</span>
          </div>
          <dl class="dm-device-meta">
            <dt>MAC</dt><dd class="mono dm-selectable">${escapeHtml(d.mac)}</dd>
            <dt>Üretici</dt><dd title="${escapeHtml(vendor)}">${escapeHtml(vendor)}</dd>
            ${kindLabel ? `<dt>Rol</dt><dd>${escapeHtml(kindLabel)}</dd>` : ''}
            <dt>İlk görülme</dt><dd class="mono">${formatDateTime(d.first_seen)}</dd>
            <dt>Son görülme</dt><dd class="mono">${formatDateTime(d.last_seen)}</dd>
            ${d.notes ? `<dt>Not</dt><dd>${escapeHtml(d.notes)}</dd>` : ''}
          </dl>
          <div class="dm-card-actions">
            <button class="dm-pill-btn" data-rename-mac="${escapeHtml(d.mac)}" data-rename-ip="${escapeHtml(
          d.ip
        )}" data-current-name="${escapeHtml(d.custom_name || d.hostname || '')}" data-current-notes="${escapeHtml(
          d.notes || ''
        )}">
              ${ICONS.edit}
              <span>Ad ve not düzenle</span>
            </button>
          </div>
        </div>
      `;
      })
      .join('')
      : emptyState('Cihaz bulunamadı', q ? 'Aramanızla eşleşen cihaz yok.' : 'Yerel ağı taramak için “Ağı tara” düğmesini kullanın.');

    gridEl.querySelectorAll('[data-rename-ip]').forEach((btn) => {
      btn.addEventListener('click', () => {
        openDeviceRenameModal(
          btn.dataset.renameMac,
          btn.dataset.renameIp,
          btn.dataset.currentName,
          btn.dataset.currentNotes
        );
      });
    });
  }
}

// ==================== ALERTS VIEW ====================
function bindAlertControls() {
  document.querySelectorAll('#alertFilterGroup .dm-seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.alertFilter = btn.dataset.type;
      document.querySelectorAll('#alertFilterGroup .dm-seg-btn').forEach((b) =>
        b.classList.toggle('active', b === btn)
      );
      renderAlertsView();
    });
  });

  document.getElementById('alertSeveritySelect')?.addEventListener('change', (e) => {
    state.alertSeverityFilter = e.target.value;
    renderAlertsView();
  });

  document.getElementById('alertSearchInput')?.addEventListener('input', (e) => {
    state.alertSearchQuery = e.target.value.toLowerCase();
    renderAlertsView();
  });

  document.getElementById('btnMarkAlertsRead')?.addEventListener('click', async () => {
    await api('/api/alerts/action', {
      method: 'POST',
      body: JSON.stringify({ action: 'mark_all_read' })
    });
    state.alerts.forEach((a) => (a.is_read = 1));
    updateAlertBadge();
    renderAlertsView();
  });

  document.getElementById('btnClearAllAlerts')?.addEventListener('click', async () => {
    await api('/api/alerts/action', {
      method: 'POST',
      body: JSON.stringify({ action: 'clear_all' })
    });
    state.alerts = [];
    updateAlertBadge();
    renderAlertsView();
  });
}

function updateAlertBadge() {
  // The badge counts what needs attention; informational history does not
  const unread = state.alerts.filter((a) => !a.is_read && a.level !== 'info').length;
  const badge = document.getElementById('alertUnreadBadge');
  if (badge) {
    badge.hidden = unread === 0;
    badge.textContent = String(unread);
  }
}

function renderAlertsView() {
  const container = document.getElementById('alertsTimeline');
  if (!container) return;

  const list = state.alerts.filter((a) => {
    if (state.alertFilter !== 'all' && a.category !== state.alertFilter) return false;
    if (state.alertSeverityFilter !== 'all' && a.severity !== state.alertSeverityFilter) return false;
    if (state.alertSearchQuery) {
      const hay = `${a.title || ''} ${a.description || ''} ${a.app_name || ''} ${a.host_ip || ''}`.toLowerCase();
      if (!hay.includes(state.alertSearchQuery)) return false;
    }
    return true;
  });

  if (!list.length) {
    container.innerHTML = emptyState(
      'Uyarı yok',
      state.alerts.length
        ? 'Seçili filtreyle eşleşen uyarı yok.'
        : 'Her şey sakin. DarkMirror yalnızca imzasız uygulamalar, ağ geçidi değişiklikleri, DNS ve sistem dosyası değişiklikleri gibi önemli olayları buraya yazar.'
    );
    return;
  }

  container.innerHTML = list
    .map((a) => {
      const catLabel = eventLabel(a.type);
      const tags = [];
      if (a.app_name) tags.push(`<span class="dm-alert-tag">${escapeHtml(a.app_name)}</span>`);
      if (a.host_ip) tags.push(`<span class="dm-alert-tag">${escapeHtml(a.host_ip)}</span>`);
      if (a.old_value) tags.push(`<span class="dm-alert-tag">eski: ${escapeHtml(a.old_value)}</span>`);
      if (a.new_value) tags.push(`<span class="dm-alert-tag">yeni: ${escapeHtml(a.new_value)}</span>`);
      const kindIcon = a.category === 'network' ? ICONS.devices : a.level === 'info' ? ICONS.bell : ICONS.alert;

      return `
      <div class="dm-alert-card severity-${escapeHtml(a.level)} ${a.is_read ? '' : 'is-unread'}">
        <span class="dm-alert-icon">${kindIcon}</span>
        <div class="dm-alert-body">
          <div class="dm-alert-head">
            ${!a.is_read ? '<span class="dm-unread-dot" title="Okunmadı"></span>' : ''}
            <span class="dm-alert-title">${escapeHtml(a.title)}</span>
            <span class="dm-status-pill ${severityStamp(a.level)}">${escapeHtml(catLabel)}</span>
          </div>
          <p class="dm-alert-desc">${escapeHtml(a.description)}</p>
          ${tags.length ? `<div class="dm-alert-meta-tags">${tags.join('')}</div>` : ''}
          <div class="dm-alert-actions">
            <button class="dm-pill-btn" data-alert-read="${a.id}" data-current-read="${a.is_read ? '1' : '0'}">
              ${ICONS.check}
              <span>${a.is_read ? 'Okunmadı say' : 'Okundu say'}</span>
            </button>
            ${
              a.app_id
                ? `<button class="dm-pill-btn" data-alert-block="${escapeHtml(a.app_id)}">
                    ${ICONS.block}
                    <span>Uygulamayı engelle</span>
                  </button>`
                : ''
            }
            <button class="dm-pill-btn" data-alert-delete="${a.id}" aria-label="Uyarıyı sil">
              ${ICONS.trash}
              <span>Sil</span>
            </button>
          </div>
        </div>
        <time class="dm-alert-time">${formatDateTime(a.ts)}</time>
      </div>
    `;
    })
    .join('');

  container.querySelectorAll('[data-alert-read]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.alertRead);
      const nextRead = btn.dataset.currentRead !== '1';
      await api('/api/alerts/action', {
        method: 'POST',
        body: JSON.stringify({ action: 'mark_read', id, isRead: nextRead })
      });
      await refreshBootstrap();
    });
  });

  container.querySelectorAll('[data-alert-block]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const appId = btn.dataset.alertBlock;
      await api('/api/firewall/toggle', {
        method: 'POST',
        body: JSON.stringify({ appId, blocked: true })
      });
      await refreshBootstrap();
    });
  });

  container.querySelectorAll('[data-alert-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.alertDelete);
      await api('/api/alerts/action', {
        method: 'POST',
        body: JSON.stringify({ action: 'delete', id })
      });
      await refreshBootstrap();
    });
  });
}

// Machine-readable zone, built from the app's real fields (ICAO-style alphabet: A-Z 0-9 <)
function mrzSafe(text) {
  const map = { Ç: 'C', Ğ: 'G', İ: 'I', I: 'I', Ö: 'O', Ş: 'S', Ü: 'U' };
  return String(text || '')
    .toLocaleUpperCase('tr-TR')
    .replace(/[ÇĞİIÖŞÜ]/g, (ch) => map[ch] || ch)
    .replace(/[^A-Z0-9]+/g, '<');
}

function mrzLine(text, len = 44) {
  return (text + '<'.repeat(len)).slice(0, len);
}

function buildAppMrz(app) {
  const name = mrzSafe(String(app.name || '').replace(/\.exe$/i, ''));
  const pub = mrzSafe((app.signature === 'valid' && app.signer) || 'DOGRULANMAMIS');
  const sha = mrzSafe((app.sha256 || '').slice(0, 12) || 'OZETYOK');
  const sig = { valid: 'V', unsigned: 'U', invalid: 'X' }[app.signature] || 'Q';
  const gate = Number(app.blocked) === 1 ? 'BLK' : 'ALW';
  const seen = app.first_seen ? new Date(app.first_seen).toISOString().slice(2, 10).replace(/-/g, '') : '000000';
  return [mrzLine(`A<DMR${name}<<${pub}`), mrzLine(`${sha}<${sig}${gate}<${seen}`)].join('\n');
}

function openModalShell({ avatar, title, subtitle }) {
  document.getElementById('modalAppAvatar').textContent = avatar;
  document.getElementById('modalAppName').textContent = title;
  document.getElementById('modalAppPublisher').textContent = subtitle;
  return document.getElementById('modalAppBody');
}

function vtLabel(app) {
  if (app.vt_status === 'clean') return { text: `Temiz · ${app.vt_detections}/${app.vt_total} motor`, cls: 'ok' };
  if (app.vt_status === 'malicious') return { text: `Tehdit · ${app.vt_detections}/${app.vt_total} motor işaretledi`, cls: 'threat' };
  if (app.vt_status === 'not_found') return { text: 'VirusTotal bu dosyayı hiç görmemiş', cls: '' };
  return { text: 'Sorgulanmadı', cls: '' };
}

function signatureDetail(app) {
  if (app.signature === 'valid') return { text: `Geçerli imza · ${app.signer || 'imzalayan okunamadı'}`, cls: 'ok' };
  if (app.signature === 'unsigned') return { text: 'İmzasız', cls: 'caution' };
  if (app.signature === 'invalid') return { text: 'İmza geçersiz veya değiştirilmiş', cls: 'caution' };
  if (app.signature === 'pending') return { text: 'Doğrulanıyor…', cls: '' };
  return { text: 'Dosyaya erişilemediği için doğrulanamadı', cls: '' };
}

// ==================== MODALS ====================
async function openAppDetailModal(appSummary) {
  const modal = document.getElementById('appDetailModal');
  const detail = await api(`/api/apps/${encodeURIComponent(appSummary.id)}`);
  const app = detail.app || appSummary;
  const appHosts = detail.hosts || [];
  const body = openModalShell({ avatar: appInitials(app.name), title: app.name, subtitle: publisherText(app) });
  const isBlocked = Number(app.blocked) === 1;
  const sig = signatureDetail(app);
  const vt = vtLabel(app);

  body.innerHTML = `
    <div class="dm-fields">
      <div class="dm-kv-row wide"><span>Dosya yolu</span><strong class="mono dm-selectable">${escapeHtml(app.exe_path || 'Okunamadı (korumalı sistem süreci)')}</strong></div>
      <div class="dm-kv-row"><span>Dijital imza</span><strong class="${sig.cls}">${escapeHtml(sig.text)}</strong></div>
      <div class="dm-kv-row"><span>Sürüm</span><strong class="mono">${escapeHtml(app.version || '—')}</strong></div>
      <div class="dm-kv-row"><span>VirusTotal</span><strong id="modalVtStatus" class="${vt.cls}">${escapeHtml(vt.text)}</strong></div>
      <div class="dm-kv-row"><span>Geçit durumu</span><strong class="${isBlocked ? '' : 'ok'}">${isBlocked ? 'Engelli (Windows Güvenlik Duvarı kuralı)' : 'İzinli'}</strong></div>
      <div class="dm-kv-row"><span>Gelen</span><strong class="mono in">${formatBytes(app.total_rx)}</strong></div>
      <div class="dm-kv-row"><span>Giden</span><strong class="mono out">${formatBytes(app.total_tx)}</strong></div>
      <div class="dm-kv-row"><span>İlk görülme</span><strong class="mono">${formatDateTime(app.first_seen)}</strong></div>
      <div class="dm-kv-row"><span>Son görülme</span><strong class="mono">${formatDateTime(app.last_seen)}</strong></div>
      <div class="dm-kv-row wide"><span>SHA-256</span><strong class="mono dm-selectable">${escapeHtml(app.sha256 || (app.exe_path ? 'Hesaplanıyor…' : '—'))}</strong></div>
    </div>

    ${
      appHosts.length
        ? `
      <div>
        <div class="dm-subhead">Bağlandığı sunucular · ${appHosts.length}</div>
        <div class="dm-mini-list">
          ${appHosts
            .slice(0, 15)
            .map(
              (h) => `
            <div class="dm-mini-row">
              <span><strong>${escapeHtml(h.hostname || h.host_ip)}</strong> <small>${escapeHtml(countryName(h.country_code))} · ${escapeHtml(h.protocol)}</small></span>
              <span class="mono">${state.status.bytesKnown ? formatBytes((h.bytes_in || 0) + (h.bytes_out || 0)) : formatDateTime(h.last_seen)}</span>
            </div>`
            )
            .join('')}
        </div>
      </div>`
        : ''
    }

    <div class="dm-modal-actions">
      <div>
        ${app.exe_path ? `<button class="dm-pill-btn" id="btnModalOpenFolder">${ICONS.folder}<span>Dosya konumunu aç</span></button>` : ''}
        ${app.exe_path ? `<button class="dm-pill-btn" id="btnModalVtScan">${ICONS.shieldCheck}<span>VirusTotal'da sorgula</span></button>` : ''}
      </div>
      <div>
        ${app.exe_path ? `<button class="dm-pill-btn" id="btnModalToggleFw">${isBlocked ? `${ICONS.check}<span>İzin ver</span>` : `${ICONS.block}<span>Engelle</span>`}</button>` : ''}
        <button class="dm-btn-primary" id="btnModalFilterGraph">${ICONS.chart}<span>Listede göster</span></button>
      </div>
    </div>

    <div class="dm-mrz" title="Uygulama kimlik satırı">${escapeHtml(buildAppMrz(app))}</div>
  `;

  document.getElementById('btnModalOpenFolder')?.addEventListener('click', () => desktop?.openFileLocation(app.exe_path));

  document.getElementById('btnModalVtScan')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const statusEl = document.getElementById('modalVtStatus');
    if (state.settings.vt_key_set !== 'true') {
      openVirusTotalKeyModal(app.id);
      return;
    }
    btn.disabled = true;
    if (statusEl) {
      statusEl.className = '';
      statusEl.textContent = 'Sorgulanıyor…';
    }
    const updated = await runVirusTotal(app.id);
    if (updated && statusEl) {
      const next = vtLabel(updated);
      statusEl.className = next.cls;
      statusEl.textContent = next.text;
    } else if (statusEl) {
      statusEl.textContent = vt.text;
    }
    btn.disabled = false;
  });

  document.getElementById('btnModalToggleFw')?.addEventListener('click', async () => {
    const res = await api('/api/firewall/toggle', {
      method: 'POST',
      body: JSON.stringify({ appId: app.id, blocked: !isBlocked })
    });
    if (!res.error) {
      state.lastToggledAppId = app.id;
      modal.hidden = true;
    }
    await refreshBootstrap();
  });

  document.getElementById('btnModalFilterGraph')?.addEventListener('click', () => {
    state.graphAppFilter = app.name;
    const sel = document.getElementById('graphAppFilter');
    if (sel) sel.value = app.name;
    modal.hidden = true;
    switchTab('graph');
    renderGraphSplitLists();
  });

  modal.hidden = false;
}

async function openHostDetailModal(ip) {
  if (!ip) return;
  const modal = document.getElementById('appDetailModal');
  const data = await api(`/api/hosts/${encodeURIComponent(ip)}`);
  const host = data.host;
  if (!host) return;
  const hostApps = data.apps || [];

  const body = openModalShell({
    avatar: host.country || 'IP',
    title: host.hostname || host.ip,
    subtitle: host.is_lan ? 'Yerel ağ' : countryName(host.country)
  });

  body.innerHTML = `
    <div class="dm-fields">
      <div class="dm-kv-row"><span>IP adresi</span><strong class="mono dm-selectable">${escapeHtml(host.ip)}</strong></div>
      <div class="dm-kv-row"><span>Ters DNS</span><strong class="dm-selectable">${escapeHtml(host.hostname || 'Kayıt yok')}</strong></div>
      <div class="dm-kv-row"><span>IP kayıt ülkesi</span><strong>${escapeHtml(host.is_lan ? 'Yerel ağ' : countryName(host.country))}</strong></div>
      <div class="dm-kv-row"><span>İlk görülme</span><strong class="mono">${formatDateTime(host.first_seen)}</strong></div>
      <div class="dm-kv-row"><span>Gelen</span><strong class="mono in">${formatBytes(host.total_rx)}</strong></div>
      <div class="dm-kv-row"><span>Giden</span><strong class="mono out">${formatBytes(host.total_tx)}</strong></div>
    </div>

    <div>
      <div class="dm-subhead">Bu sunucuyla konuşan uygulamalar · ${hostApps.length}</div>
      <div class="dm-mini-list">
        ${
          hostApps.length
            ? hostApps
                .map(
                  (u) => `
          <div class="dm-mini-row">
            <span><strong>${escapeHtml(u.app_name || u.app_id)}</strong> <small>${escapeHtml(u.protocol)}</small></span>
            <span class="mono">${state.status.bytesKnown ? formatBytes((u.bytes_in || 0) + (u.bytes_out || 0)) : formatDateTime(u.last_seen)}</span>
          </div>`
                )
                .join('')
            : '<div class="dm-mini-row"><span class="dm-muted">Kayıtlı uygulama yok</span></div>'
        }
      </div>
    </div>

    <p class="dm-form-hint">Ülke bilgisi, IP adresinin kayıtlı olduğu ülkedir (DB-IP). İçerik dağıtım ağlarında sunucunun fiziksel konumu farklı olabilir.</p>

    ${
      host.is_lan || host.lat == null
        ? ''
        : `<div class="dm-modal-actions end"><button class="dm-btn-primary" id="btnFocusGlobeHost">${ICONS.globe}<span>Haritada göster</span></button></div>`
    }
  `;

  document.getElementById('btnFocusGlobeHost')?.addEventListener('click', () => {
    modal.hidden = true;
    switchTab('graph');
    document.querySelector('#graphSubViewGroup [data-subview="map"]')?.click();
    focusGlobeOn(host.country);
  });

  modal.hidden = false;
}

function openVirusTotalKeyModal(thenScanAppId = null) {
  const modal = document.getElementById('appDetailModal');
  const body = openModalShell({
    avatar: 'VT',
    title: 'VirusTotal API anahtarı',
    subtitle: 'Dosya özetlerini VirusTotal veritabanında sorgulamak için'
  });
  body.innerHTML = `
    <p class="dm-form-hint">DarkMirror dosyanın kendisini göndermez; yalnızca SHA-256 özetini sorgular. Ücretsiz anahtarı
      virustotal.com hesabınızın "API Key" sayfasından alabilirsiniz. Anahtar yalnızca bu bilgisayarda saklanır.</p>
    <label class="dm-form-field">
      <span>API anahtarı</span>
      <input type="password" id="inputVtKey" class="dm-input" autocomplete="off" placeholder="${state.settings.vt_key_set === 'true' ? 'Kayıtlı anahtar var — değiştirmek için yazın' : '64 karakterlik anahtar'}" />
    </label>
    <div class="dm-modal-actions">
      <div>
        <button class="dm-pill-btn" id="btnVtOpenSite">${ICONS.external}<span>Anahtar al</span></button>
        ${state.settings.vt_key_set === 'true' ? `<button class="dm-pill-btn" id="btnVtRemove">${ICONS.trash}<span>Anahtarı sil</span></button>` : ''}
      </div>
      <div><button class="dm-btn-primary" id="btnVtSave">${ICONS.check}<span>Kaydet</span></button></div>
    </div>
  `;
  document.getElementById('btnVtOpenSite')?.addEventListener('click', () => desktop?.openExternal('https://www.virustotal.com/gui/my-apikey'));
  document.getElementById('btnVtRemove')?.addEventListener('click', async () => {
    const res = await api('/api/settings', { method: 'POST', body: JSON.stringify({ vt_api_key: '' }) });
    if (res.settings) state.settings = res.settings;
    modal.hidden = true;
  });
  document.getElementById('btnVtSave')?.addEventListener('click', async () => {
    const input = document.getElementById('inputVtKey');
    const key = input.value.trim();
    if (!key) {
      input.focus();
      return;
    }
    const res = await api('/api/settings', { method: 'POST', body: JSON.stringify({ vt_api_key: key }) });
    if (res.settings) state.settings = res.settings;
    modal.hidden = true;
    if (thenScanAppId) {
      await runVirusTotal(thenScanAppId);
      renderFirewallView();
    }
  });
  modal.hidden = false;
  document.getElementById('inputVtKey')?.focus();
}

function showAboutModal() {
  const modal = document.getElementById('appDetailModal');
  const s = state.status;
  const body = openModalShell({
    avatar: 'DM',
    title: 'DarkMirror',
    subtitle: 'Bilgisayarınızın ağdaki yansıması: kim, nereye, ne kadar.'
  });
  const probeText =
    s.probe === 'running'
      ? s.estats
        ? 'Bağlantı başına bayt ölçümü etkin'
        : 'Bağlantılar izleniyor; bayt ölçümü için yönetici izni gerekli'
      : 'Yedek mod (netstat): bağlantılar izleniyor, bayt ölçümü yok';
  body.innerHTML = `
    <div class="dm-fields">
      <div class="dm-kv-row"><span>Sürüm</span><strong class="mono">${escapeHtml(s.version || '—')}</strong></div>
      <div class="dm-kv-row"><span>Yetki</span><strong>${s.admin ? 'Yönetici' : 'Standart kullanıcı'}</strong></div>
      <div class="dm-kv-row wide"><span>Ölçüm</span><strong>${escapeHtml(probeText)}</strong></div>
      <div class="dm-kv-row wide"><span>Veri</span><strong>Tüm ölçümler bu bilgisayarda kalır; hesap veya bulut yok.</strong></div>
      <div class="dm-kv-row wide"><span>Kaynaklar</span><strong>${escapeHtml(s.geoSource || 'IP veritabanı yüklenemedi')} · ${escapeHtml(
        s.geoAttribution || ''
      )} · MAC üreticileri: IEEE kayıt listesi</strong></div>
      <div class="dm-kv-row wide"><span>Lisans</span><strong>MIT — açık kaynak</strong></div>
    </div>
  `;
  modal.hidden = false;
}

function openDataPlanModal() {
  const modal = document.getElementById('appDetailModal');
  const body = openModalShell({
    avatar: 'GB',
    title: 'Aylık veri planı',
    subtitle: 'Kullanım sekmesinde kotanıza göre doluluk gösterilir'
  });

  body.innerHTML = `
    <label class="dm-form-field">
      <span>Aylık kota (GB)</span>
      <input type="number" id="inputQuotaGb" class="dm-input" value="${escapeHtml(state.settings.bandwidth_quota_gb || '100')}" min="1" max="100000" />
    </label>
    <div class="dm-modal-actions end">
      <button class="dm-btn-primary" id="btnSaveQuota">${ICONS.check}<span>Kaydet</span></button>
    </div>
  `;

  document.getElementById('btnSaveQuota')?.addEventListener('click', async () => {
    const val = document.getElementById('inputQuotaGb')?.value || '100';
    const res = await api('/api/settings', { method: 'POST', body: JSON.stringify({ bandwidth_quota_gb: String(val) }) });
    if (res.settings) state.settings = res.settings;
    modal.hidden = true;
    loadUsageView();
  });

  modal.hidden = false;
}

function openDeviceRenameModal(mac, ip, currentName, currentNotes) {
  const modal = document.getElementById('appDetailModal');
  const body = openModalShell({ avatar: 'LAN', title: `Cihazı düzenle · ${ip}`, subtitle: `MAC ${mac}` });

  body.innerHTML = `
    <label class="dm-form-field">
      <span>Cihaz adı</span>
      <input type="text" id="inputDeviceLabel" class="dm-input" value="${escapeHtml(currentName)}" />
    </label>
    <label class="dm-form-field">
      <span>Not veya konum</span>
      <input type="text" id="inputDeviceNotes" class="dm-input" value="${escapeHtml(currentNotes || '')}" placeholder="Örn. Salon televizyonu" />
    </label>
    <div class="dm-modal-actions end">
      <button class="dm-btn-primary" id="btnSaveDeviceLabel">${ICONS.check}<span>Kaydet</span></button>
    </div>
  `;

  document.getElementById('btnSaveDeviceLabel')?.addEventListener('click', async () => {
    const customName = document.getElementById('inputDeviceLabel')?.value?.trim() || '';
    const notes = document.getElementById('inputDeviceNotes')?.value?.trim() || '';
    const res = await api('/api/network/device', { method: 'POST', body: JSON.stringify({ mac, customName, notes }) });
    if (res.devices) state.lanDevices = res.devices;
    modal.hidden = true;
    renderNetworkView();
  });

  modal.hidden = false;
  document.getElementById('inputDeviceLabel')?.focus();
}

// ==================== SYNC SETTINGS & LIVE DATA ====================
function syncSettingsUI() {
  const isIncognito = state.settings.incognito === 'true';
  const isSnooze = state.settings.snooze === 'true';
  const rulesOn = state.settings.rules_enabled !== 'false';

  document.getElementById('btnIncognito')?.classList.toggle('active-incognito', isIncognito);
  document.getElementById('btnSnooze')?.classList.toggle('active-snooze', isSnooze);

  const subEl = document.getElementById('miniLiveSubtitle');
  if (subEl) {
    subEl.textContent = isIncognito ? 'Gizli mod' : rulesOn ? 'İzleniyor' : 'Kurallar kapalı';
    subEl.classList.toggle('is-off', !rulesOn && !isIncognito);
    subEl.classList.toggle('is-incognito', isIncognito);
  }

  const fwBtn = document.getElementById('btnFirewallToggle');
  const fwLabel = document.getElementById('firewallStatusLabel');
  if (fwBtn && fwLabel) {
    fwBtn.classList.toggle('off', !rulesOn);
    fwBtn.setAttribute('aria-checked', String(rulesOn));
    fwLabel.textContent = rulesOn ? 'DarkMirror kuralları açık' : 'DarkMirror kuralları kapalı';
  }

  const banner = document.getElementById('adminBanner');
  if (banner) banner.hidden = state.status.admin;
}

async function refreshBootstrap() {
  const data = await api('/api/bootstrap');
  if (data.error) return;
  state.settings = { ...state.settings, ...(data.settings || {}) };
  state.status = data.status || state.status;
  state.adapter = data.adapter || state.adapter;
  state.home = data.home || null;
  state.apps = data.apps || [];
  state.hosts = data.hosts || [];
  state.lanDevices = data.lanDevices || [];
  state.alerts = data.alerts || [];

  syncSettingsUI();
  updateAlertBadge();
  renderGraphSplitLists();
  renderFirewallView();
  renderNetworkView();
  renderAlertsView();
}

async function loadGraphSeries() {
  const data = await api(`/api/graph?minutes=${state.graphRangeMinutes}`);
  state.series = (data.series || []).slice().sort((a, b) => a.ts - b.ts);
  state.overviewZoomStart = 0;
  drawMainTrafficGraph();
  drawOverviewScrubber();
}

// Live data arrives over IPC from the main process; there is no network socket
function connectRealtimeStream() {
  desktop?.onAlert((ev) => {
    showInAppAlert(ev);
    refreshBootstrap();
  });

  desktop?.onTick((msg) => {
    state.latestTick = msg;
    document.getElementById('liveDownRate').textContent = formatRate(msg.rxRate || 0);
    document.getElementById('liveUpRate').textContent = formatRate(msg.txRate || 0);
    const sockEl = document.getElementById('graphSocketCount');
    if (sockEl) sockEl.textContent = String(msg.activeConnections || 0);

    const lastTs = state.series.length ? state.series[state.series.length - 1].ts : 0;
    if (!state.graphPaused && msg.ts >= lastTs) {
      state.series.push({ ts: msg.ts, rx: msg.rxRate || 0, tx: msg.txRate || 0 });
      const keep = Math.max(200, Math.round((state.graphRangeMinutes * 60) / 1.5));
      while (state.series.length > keep) state.series.shift();
      if (state.activeTab === 'graph' && state.graphSubView === 'chart') {
        drawMainTrafficGraph();
        drawOverviewScrubber();
      }
    }
  });

  setInterval(() => {
    if (!state.graphPaused && document.visibilityState === 'visible') refreshBootstrap();
  }, 6000);
}

initDarkMirror();
