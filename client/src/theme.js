const STORAGE_KEY = 'share2d-theme';
const DEFAULT_THEME = 'dark';

export function getStoredTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light') return 'light';
  if (stored === 'system') return DEFAULT_THEME;
  return stored === 'dark' ? 'dark' : DEFAULT_THEME;
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
}

export function initTheme() {
  applyTheme(getStoredTheme());
}

export function saveTheme(theme) {
  const next = theme === 'light' ? 'light' : 'dark';
  localStorage.setItem(STORAGE_KEY, next);
  applyTheme(next);
}

export function toggleTheme(current) {
  return current === 'dark' ? 'light' : 'dark';
}
