/**
 * The boot splash: painted from the prerendered HTML before any JavaScript runs, faded out and removed
 * by AppLayout once React has mounted. The root route renders it (src/routes/__root.tsx), and
 * scripts/generate-splash.ts renders the iOS launch screens from it, so launch image → boot splash →
 * app reads as one continuous screen. Plain strings: Node imports this module too.
 */

/** Page background and splash styles; explicit colours, as the theme is not applied yet. */
export const BOOT_CSS = `
html { background: #fff8f4; }
@media (prefers-color-scheme: dark) { html { background: #150d10; } }
html[data-theme='light'] { background: #fff8f4; }
html[data-theme='dark'] { background: #150d10; }
#boot {
  position: fixed; inset: 0; z-index: 2147483000;
  display: grid; place-items: center; align-content: center; gap: 20px;
  font-family: 'Be Vietnam Pro', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  color: #3a1f25; background: #fff8f4;
  transition: opacity 260ms ease, visibility 260ms;
}
@media (prefers-color-scheme: dark) { #boot { color: #f5dfe2; background: #150d10; } }
html[data-theme='dark'] #boot { color: #f5dfe2; background: #150d10; }
html[data-theme='light'] #boot { color: #3a1f25; background: #fff8f4; }
#boot.qv-boot-done { opacity: 0; visibility: hidden; }
#boot svg { width: 96px; height: 96px; filter: drop-shadow(0 14px 28px rgba(215, 38, 61, 0.28)); }
#boot .qv-ring, #boot .qv-core { transform-box: fill-box; transform-origin: center; animation: qv-pop 1.6s cubic-bezier(.34, 1.56, .64, 1) infinite; }
#boot .qv-d2 { animation-delay: .12s; } #boot .qv-d3 { animation-delay: .24s; }
#boot .qv-v { stroke-dasharray: 130; animation: qv-draw 1.6s ease-in-out infinite; }
#boot .qv-star { transform-box: fill-box; transform-origin: center; animation: qv-twinkle 1.6s cubic-bezier(.34, 1.56, .64, 1) infinite; }
#boot .qv-word { font-weight: 700; font-size: 22px; letter-spacing: -0.02em; }
#boot .qv-word b { color: #d7263d; }
#boot .qv-dots { display: flex; gap: 6px; justify-content: center; }
#boot .qv-dots i { width: 7px; height: 7px; border-radius: 2px; background: currentColor; opacity: .35; animation: qv-hop 1s ease-in-out infinite; }
#boot .qv-dots i:nth-child(2) { animation-delay: .15s; } #boot .qv-dots i:nth-child(3) { animation-delay: .3s; }
@keyframes qv-pop { 0%, 100% { transform: scale(1); } 18% { transform: scale(.72); } 38% { transform: scale(1.08); } 55% { transform: scale(1); } }
@keyframes qv-draw { 0% { stroke-dashoffset: 130; } 45%, 80% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: -130; } }
@keyframes qv-twinkle { 0%, 100% { transform: rotate(0) scale(1); } 40% { transform: rotate(72deg) scale(1.18); } 60% { transform: rotate(72deg) scale(.96); } }
@keyframes qv-hop { 0%, 100% { transform: translateY(0); opacity: .35; } 40% { transform: translateY(-6px); opacity: 1; } }
@media (prefers-reduced-motion: reduce) { #boot * { animation: none !important; } }
`

export const BOOT_HTML = `<div id="boot" role="status" aria-live="polite">
  <svg viewBox="0 0 512 512" aria-hidden="true">
    <defs>
      <linearGradient id="qvb-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0435a" /><stop offset=".55" stop-color="#d7263d" /><stop offset="1" stop-color="#a5122a" /></linearGradient>
    </defs>
    <rect width="512" height="512" rx="116" fill="url(#qvb-bg)" />
    <g fill="none" stroke="#fff" stroke-width="26">
      <rect class="qv-ring" x="85" y="85" width="102" height="102" rx="26" />
      <rect class="qv-ring qv-d2" x="325" y="85" width="102" height="102" rx="26" />
      <rect class="qv-ring qv-d3" x="85" y="325" width="102" height="102" rx="26" />
    </g>
    <g fill="#fff">
      <rect class="qv-core" x="116" y="116" width="40" height="40" rx="11" />
      <rect class="qv-core qv-d2" x="356" y="116" width="40" height="40" rx="11" />
      <rect class="qv-core qv-d3" x="116" y="356" width="40" height="40" rx="11" />
    </g>
    <path class="qv-v" d="M214 218 L256 296 L298 218" fill="none" stroke="#fff" stroke-width="30" stroke-linecap="round" stroke-linejoin="round" />
    <polygon class="qv-star" points="376.0,306.0 393.6,351.7 442.6,354.4 404.5,385.3 417.1,432.6 376.0,406.0 334.9,432.6 347.5,385.3 309.4,354.4 358.4,351.7" fill="#ffc93c" stroke="#ffc93c" stroke-width="10" stroke-linejoin="round" />
  </svg>
  <div class="qv-word">QR<b>Viet</b></div>
  <div class="qv-dots" aria-label="Đang tải"><i></i><i></i><i></i></div>
</div>`

/** Applies the saved colour mode and language before first paint, so neither flashes. */
export const PREPAINT_SCRIPT = `try {
  var s = JSON.parse(localStorage.getItem('qrviet:settings') || '{}');
  var m = s && s.state && s.state.mode;
  if (m === 'light' || m === 'dark') document.documentElement.setAttribute('data-theme', m);
  var l = s && s.state && s.state.locale;
  if (l === 'en') document.documentElement.setAttribute('lang', 'en');
} catch (e) {}`
