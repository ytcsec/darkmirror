// Desktop notification window: shows one alert the engine marked as worth interrupting for
const desktop = window.darkMirrorDesktop;
let current = null;

const CATEGORY = {
  unsigned_app: 'İmzasız uygulama',
  binary_changed: 'Dosya değişti',
  virustotal_threat: 'VirusTotal',
  gateway_mac_changed: 'Ağ geçidi',
  rdp_inbound: 'Uzak masaüstü',
  dns_changed: 'DNS',
  hosts_file_changed: 'Sistem dosyası'
};

function render(al) {
  current = al;
  const cat = document.getElementById('popupCategory');
  cat.className = `dm-status-pill ${al.level === 'threat' ? 'threat' : al.level === 'caution' ? 'caution' : 'neutral'}`;
  cat.textContent = CATEGORY[al.type] || 'Güvenlik';
  document.getElementById('popupTitle').textContent = al.title || '';
  document.getElementById('popupDetail').textContent = al.detail || '';
  const name = al.app_name || '';
  document.getElementById('popupAvatar').textContent = (name.replace(/\.exe$/i, '').slice(0, 2) || 'DM').toUpperCase();
  document.getElementById('popupUnsigned').hidden = al.type !== 'unsigned_app';
  document.getElementById('popupMeta').textContent = [al.app_name, al.host_ip].filter(Boolean).join(' · ');
  const canGate = Boolean(al.app_id);
  document.getElementById('btnAllow').hidden = !canGate;
  document.getElementById('btnBlock').hidden = !canGate;
}

desktop?.onNotificationData(render);

document.getElementById('btnClose').addEventListener('click', () => desktop?.closeNotification());
// "İzin ver" keeps the app allowed; nothing to change, just dismiss
document.getElementById('btnAllow').addEventListener('click', () => desktop?.closeNotification());
document.getElementById('btnBlock').addEventListener('click', async () => {
  if (current?.app_id) {
    const res = await fetch('/api/firewall/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId: current.app_id, blocked: true })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      document.getElementById('popupDetail').textContent = err.error || 'Engellenemedi.';
      return;
    }
  }
  desktop?.closeNotification();
});
document.getElementById('btnDetails').addEventListener('click', () => desktop?.openAlertsFromNotification());
document.getElementById('popupBodyClick').addEventListener('click', (e) => {
  if (!e.target.closest('button')) desktop?.openAlertsFromNotification();
});
