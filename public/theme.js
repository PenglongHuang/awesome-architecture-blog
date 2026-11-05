// Runs in the head to apply the saved preference before the first paint.
(() => {
  const root = document.documentElement;
  let stored;
  try { stored = localStorage.getItem('theme'); } catch { /* Storage may be disabled. */ }
  root.dataset.theme = ['light', 'dark'].includes(stored)
    ? stored
    : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  function syncButton(button) {
    const dark = root.dataset.theme === 'dark';
    const label = `切换到${dark ? '明亮' : '暗黑'}主题`;
    const icon = button.querySelector('[data-theme-icon]');
    const sun = icon?.querySelector?.('[data-icon-sun]');
    const moon = icon?.querySelector?.('[data-icon-moon]');
    if (sun && moon) {
      // The masthead carries a pair of stroke icons; glyph buttons keep the text fallback.
      sun.hidden = !dark;
      moon.hidden = dark;
    } else if (icon) {
      icon.textContent = dark ? '☀' : '☾';
    }
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const buttons = [...document.querySelectorAll('[data-theme-toggle]')];
    for (const button of buttons) {
      syncButton(button);
      button.addEventListener('click', () => {
        const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
        root.dataset.theme = next;
        try { localStorage.setItem('theme', next); } catch { /* The page still changes. */ }
        buttons.forEach(syncButton);
        window.dispatchEvent(new CustomEvent('themechange', { detail: next }));
      });
    }
  });
})();
