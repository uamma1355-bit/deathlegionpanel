/**
 * Shared Design System for Death Legion Panel
 * ============================================
 * Imported by all page endpoints to ensure visual consistency.
 * Bronze + dark theme with glassmorphism, smooth animations, and
 * responsive layouts.
 */

export const DESIGN_SYSTEM_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

:root {
  --dl-bg: #080808;
  --dl-bg-elevated: rgba(20,15,12,0.9);
  --dl-bg-card: rgba(20,20,20,0.85);
  --dl-bg-input: rgba(12,12,12,0.8);
  --dl-border: rgba(255,255,255,0.06);
  --dl-border-hover: rgba(188,110,60,0.3);
  --dl-bronze: #bc6e3c;
  --dl-bronze-light: #e89060;
  --dl-bronze-glow: rgba(188,110,60,0.15);
  --dl-red: #ef4444;
  --dl-red-light: #f87171;
  --dl-green: #22c55e;
  --dl-yellow: #eab308;
  --dl-blue: #3b82f6;
  --dl-purple: #a855f7;
  --dl-text: #e5e5e5;
  --dl-text-muted: #888;
  --dl-text-dim: #555;
  --dl-radius-sm: 6px;
  --dl-radius: 10px;
  --dl-radius-lg: 16px;
  --dl-radius-xl: 20px;
  --dl-shadow-sm: 0 2px 8px rgba(0,0,0,0.3);
  --dl-shadow: 0 8px 24px rgba(0,0,0,0.4);
  --dl-shadow-lg: 0 20px 60px rgba(0,0,0,0.6);
  --dl-shadow-glow: 0 0 40px rgba(188,110,60,0.12);
  --dl-transition: 0.2s cubic-bezier(0.4,0,0.2,1);
  --dl-font-display: 'Cinzel', serif;
  --dl-font-body: 'Inter', sans-serif;
  --dl-font-mono: 'JetBrains Mono', monospace;
}

* { margin:0; padding:0; box-sizing:border-box; }

body {
  font-family: var(--dl-font-body);
  background: var(--dl-bg);
  color: var(--dl-text);
  min-height: 100vh;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body.dl-bg {
  background-image:
    radial-gradient(ellipse at top left, rgba(188,110,60,0.06) 0%, transparent 50%),
    radial-gradient(ellipse at bottom right, rgba(188,110,60,0.04) 0%, transparent 50%),
    linear-gradient(rgba(8,8,8,0.92), rgba(8,8,8,0.95)),
    url('https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=1920&q=80');
  background-size: cover, cover, cover, cover;
  background-position: center;
  background-attachment: fixed;
}

/* === Header === */
.dl-header {
  background: rgba(15,15,15,0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(188,110,60,0.15);
  padding: 0.7rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 1px 20px rgba(0,0,0,0.3);
}

.dl-logo-wrap {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.dl-logo-img {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  object-fit: cover;
  border: 1px solid rgba(188,110,60,0.4);
  box-shadow: 0 0 12px rgba(188,110,60,0.25);
  transition: var(--dl-transition);
}

.dl-logo-img:hover {
  transform: scale(1.05) rotate(-3deg);
  box-shadow: 0 0 20px rgba(188,110,60,0.4);
}

.dl-logo-text {
  font-family: var(--dl-font-display);
  font-size: 1.25rem;
  font-weight: 900;
  background: linear-gradient(135deg, var(--dl-bronze), var(--dl-bronze-light));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.dl-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-left: 0.4rem;
  vertical-align: middle;
}

.dl-badge-bronze {
  background: linear-gradient(135deg, var(--dl-bronze), var(--dl-bronze-light));
  color: #fff;
}

.dl-badge-red {
  background: linear-gradient(135deg, var(--dl-red), var(--dl-red-light));
  color: #fff;
}

.dl-badge-green {
  background: rgba(34,197,94,0.15);
  color: var(--dl-green);
  border: 1px solid rgba(34,197,94,0.3);
}

/* === Navigation === */
.dl-nav {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.dl-nav a {
  padding: 0.35rem 0.8rem;
  background: rgba(20,20,20,0.8);
  border: 1px solid var(--dl-border);
  border-radius: var(--dl-radius-sm);
  color: var(--dl-text-muted);
  text-decoration: none;
  font-size: 0.78rem;
  font-weight: 500;
  transition: var(--dl-transition);
  white-space: nowrap;
}

.dl-nav a:hover {
  color: var(--dl-bronze-light);
  border-color: var(--dl-border-hover);
  background: rgba(188,110,60,0.08);
  transform: translateY(-1px);
}

.dl-nav a.active {
  background: rgba(188,110,60,0.15);
  color: var(--dl-bronze-light);
  border-color: rgba(188,110,60,0.3);
}

/* === Container === */
.dl-container {
  max-width: 1100px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.dl-container-wide {
  max-width: 1400px;
  margin: 0 auto;
  padding: 1.5rem;
}

/* === Cards === */
.dl-card {
  background: var(--dl-bg-card);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--dl-border);
  border-radius: var(--dl-radius-lg);
  padding: 1.5rem;
  transition: var(--dl-transition);
}

.dl-card:hover {
  border-color: var(--dl-border-hover);
  box-shadow: var(--dl-shadow);
}

.dl-card-glow {
  box-shadow: var(--dl-shadow-glow);
}

/* === Hero Section === */
.dl-hero {
  background: var(--dl-bg-elevated);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(188,110,60,0.2);
  border-radius: var(--dl-radius-xl);
  padding: 2.5rem;
  text-align: center;
  margin-bottom: 1.5rem;
  box-shadow: var(--dl-shadow), var(--dl-shadow-glow);
  position: relative;
  overflow: hidden;
}

.dl-hero::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(188,110,60,0.05) 0%, transparent 60%);
  animation: dl-pulse-bg 8s ease-in-out infinite;
  pointer-events: none;
}

@keyframes dl-pulse-bg {
  0%, 100% { transform: scale(1); opacity: 0.5; }
  50% { transform: scale(1.1); opacity: 1; }
}

.dl-hero h1 {
  font-family: var(--dl-font-display);
  font-size: 2rem;
  font-weight: 900;
  color: var(--dl-bronze-light);
  margin-bottom: 0.5rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  position: relative;
}

.dl-hero p {
  color: var(--dl-text-muted);
  font-size: 0.9rem;
  margin-bottom: 1.5rem;
  position: relative;
}

/* === Stat Display === */
.dl-stat-row {
  display: flex;
  justify-content: center;
  gap: 2.5rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
  position: relative;
}

.dl-stat {
  text-align: center;
}

.dl-stat-num {
  font-family: var(--dl-font-mono);
  font-size: 2.5rem;
  font-weight: 700;
  background: linear-gradient(135deg, var(--dl-bronze), var(--dl-bronze-light));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  line-height: 1.1;
}

.dl-stat-label {
  color: var(--dl-text-dim);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-top: 0.3rem;
  font-weight: 500;
}

/* === Grid === */
.dl-grid {
  display: grid;
  gap: 1rem;
}

.dl-grid-2 { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
.dl-grid-3 { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
.dl-grid-4 { grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); }
.dl-grid-cards { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }

/* === Buttons === */
.dl-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.65rem 1.3rem;
  border: none;
  border-radius: var(--dl-radius);
  font-family: var(--dl-font-body);
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  text-decoration: none;
  transition: var(--dl-transition);
  white-space: nowrap;
  position: relative;
  overflow: hidden;
}

.dl-btn-primary {
  background: linear-gradient(135deg, var(--dl-bronze), var(--dl-bronze-light));
  color: #fff;
  box-shadow: 0 4px 12px rgba(188,110,60,0.25);
}

.dl-btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(188,110,60,0.4);
}

.dl-btn-primary:active {
  transform: translateY(0);
}

.dl-btn-outline {
  background: transparent;
  border: 1px solid rgba(188,110,60,0.3);
  color: var(--dl-bronze-light);
}

.dl-btn-outline:hover {
  background: rgba(188,110,60,0.1);
  border-color: rgba(188,110,60,0.5);
}

.dl-btn-ghost {
  background: rgba(40,40,40,0.6);
  color: var(--dl-text-muted);
  border: 1px solid var(--dl-border);
}

.dl-btn-ghost:hover {
  background: rgba(60,60,60,0.8);
  color: var(--dl-text);
}

.dl-btn-danger {
  background: linear-gradient(135deg, var(--dl-red), var(--dl-red-light));
  color: #fff;
}

.dl-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
}

/* === Progress Bar === */
.dl-progress {
  width: 100%;
  height: 6px;
  background: rgba(255,255,255,0.08);
  border-radius: 3px;
  overflow: hidden;
}

.dl-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--dl-bronze), var(--dl-bronze-light));
  border-radius: 3px;
  transition: width 0.5s cubic-bezier(0.4,0,0.2,1);
  box-shadow: 0 0 10px rgba(188,110,60,0.4);
}

/* === Section Title === */
.dl-section-title {
  font-family: var(--dl-font-display);
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--dl-bronze-light);
  margin-bottom: 1rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.dl-section-title::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, rgba(188,110,60,0.2), transparent);
}

/* === Inputs === */
.dl-input {
  width: 100%;
  padding: 0.65rem 1rem;
  background: var(--dl-bg-input);
  border: 1px solid var(--dl-border);
  border-radius: var(--dl-radius);
  color: var(--dl-text);
  font-size: 0.88rem;
  font-family: var(--dl-font-body);
  transition: var(--dl-transition);
}

.dl-input:focus {
  outline: none;
  border-color: rgba(188,110,60,0.5);
  box-shadow: 0 0 0 3px rgba(188,110,60,0.1);
}

.dl-input::placeholder {
  color: var(--dl-text-dim);
}

/* === Badge / Pill === */
.dl-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.dl-pill-green { background: rgba(34,197,94,0.15); color: var(--dl-green); border: 1px solid rgba(34,197,94,0.25); }
.dl-pill-red { background: rgba(239,68,68,0.15); color: var(--dl-red); border: 1px solid rgba(239,68,68,0.25); }
.dl-pill-yellow { background: rgba(234,179,8,0.15); color: var(--dl-yellow); border: 1px solid rgba(234,179,8,0.25); }
.dl-pill-bronze { background: rgba(188,110,60,0.15); color: var(--dl-bronze-light); border: 1px solid rgba(188,110,60,0.25); }
.dl-pill-blue { background: rgba(59,130,246,0.15); color: var(--dl-blue); border: 1px solid rgba(59,130,246,0.25); }

/* === Live Dot === */
.dl-live-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--dl-green);
  animation: dl-live-pulse 1.5s ease-in-out infinite;
  margin-right: 0.4rem;
}

@keyframes dl-live-pulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(34,197,94,0.4); }
  50% { opacity: 0.7; box-shadow: 0 0 0 6px rgba(34,197,94,0); }
}

/* === Spinner === */
.dl-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,0.15);
  border-top-color: var(--dl-bronze-light);
  border-radius: 50%;
  animation: dl-spin 0.7s linear infinite;
  vertical-align: middle;
}

@keyframes dl-spin {
  to { transform: rotate(360deg); }
}

/* === Tooltip === */
.dl-tooltip {
  position: relative;
}

.dl-tooltip::after {
  content: attr(data-tip);
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(15,15,15,0.95);
  color: var(--dl-bronze-light);
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.7rem;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
  border: 1px solid rgba(188,110,60,0.2);
}

.dl-tooltip:hover::after {
  opacity: 1;
}

/* === Animations === */
@keyframes dl-fade-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes dl-slide-in {
  from { opacity: 0; transform: translateX(-20px); }
  to { opacity: 1; transform: translateX(0); }
}

.dl-fade-in { animation: dl-fade-in 0.4s ease-out; }
.dl-slide-in { animation: dl-slide-in 0.3s ease-out; }

/* === Empty State === */
.dl-empty {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--dl-text-muted);
}

.dl-empty-icon {
  font-size: 3rem;
  margin-bottom: 0.5rem;
  opacity: 0.5;
}

.dl-empty h3 {
  color: var(--dl-bronze-light);
  font-size: 1.1rem;
  margin-bottom: 0.3rem;
}

/* === Footer === */
.dl-footer {
  text-align: center;
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--dl-border);
  color: var(--dl-text-dim);
  font-size: 0.75rem;
}

.dl-footer a {
  color: var(--dl-bronze);
  text-decoration: none;
  transition: var(--dl-transition);
}

.dl-footer a:hover {
  color: var(--dl-bronze-light);
}

/* === Responsive === */
@media (max-width: 768px) {
  .dl-header {
    padding: 0.6rem 1rem;
    flex-direction: column;
    gap: 0.5rem;
  }
  .dl-container {
    padding: 1.5rem 1rem;
  }
  .dl-hero {
    padding: 1.5rem;
  }
  .dl-hero h1 {
    font-size: 1.5rem;
  }
  .dl-stat-row {
    gap: 1.5rem;
  }
  .dl-stat-num {
    font-size: 2rem;
  }
  .dl-nav {
    justify-content: center;
  }
}

/* === Scrollbar === */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: rgba(0,0,0,0.2);
}

::-webkit-scrollbar-thumb {
  background: rgba(188,110,60,0.3);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(188,110,60,0.5);
}

/* === Selection === */
::selection {
  background: rgba(188,110,60,0.3);
  color: #fff;
}
`;

/** Shared HTML for the header/nav bar — used by all standalone pages */
export function sharedHeader(activePage: string = ''): string {
  const NAV_LOGO_URL = 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=120&h=120&fit=crop&q=80';
  const pages = [
    { href: '/', label: 'Panel' },
    { href: '/credits', label: 'Credits' },
    { href: '/ads', label: 'Watch Ads' },
    { href: '/ai-assistant', label: 'AI Chat' },
    { href: '/ai-agent', label: 'AI Agent' },
    { href: '/oauth', label: 'OAuth' },
    { href: '/statistics', label: 'Stats' },
    { href: '/status', label: 'Status' },
    { href: '/admin', label: 'Admin' },
  ];
  const navLinks = pages.map(p =>
    `<a href="${p.href}"${p.href === activePage ? ' class="active"' : ''}>${p.label}</a>`
  ).join('\n      ');
  return `
  <div class="dl-header">
    <div class="dl-logo-wrap">
      <img src="${NAV_LOGO_URL}" class="dl-logo-img" alt="DL" />
      <div>
        <span class="dl-logo-text">Death Legion</span>
        <span class="dl-badge dl-badge-bronze">BETA</span>
      </div>
    </div>
    <nav class="dl-nav">
      ${navLinks}
    </nav>
  </div>`;
}
