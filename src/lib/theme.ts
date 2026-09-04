export type ThemeMode = 'dark' | 'light';

const THEME_KEY = 'tma_wardrobe_theme';

/** Тёмная тема — дефолт приложения, не зависит от настроек Telegram-клиента. */
export function getStoredTheme(): ThemeMode {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === 'light' ? 'light' : 'dark';
}

function setDataTheme(theme: ThemeMode) {
  document.documentElement.setAttribute('data-theme', theme);
}

/** Применяет сохранённую (или дефолтную тёмную) тему. Вызывать как можно раньше при старте. */
export function applyStoredTheme() {
  setDataTheme(getStoredTheme());
}

export function toggleTheme(): ThemeMode {
  const next: ThemeMode = getStoredTheme() === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, next);
  setDataTheme(next);
  return next;
}
