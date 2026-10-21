// Apply the stored theme before first paint (system | light | dark)
try {
  const t = localStorage.getItem('dm-theme');
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
} catch {}
