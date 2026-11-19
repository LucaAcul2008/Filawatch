import React, { useEffect, useState } from 'react';
import { useAuth } from './auth.jsx';
import { useTheme } from './ThemeContext.jsx';
import Login from './components/Login.jsx';
import Dashboard from './components/Dashboard.jsx';
import Filaments from './components/Filaments.jsx';
import PrinterLive from './components/PrinterLive.jsx';
import Prints from './components/Prints.jsx';
import WishlistIdeas from './components/WishlistIdeas.jsx';
import Settings from './components/Settings.jsx';
import Tools from './components/Tools.jsx';
import Slicer from './components/Slicer.jsx';
import InstallBanner from './components/InstallBanner.jsx';

const TABS = [
  { id: 'dash', label: 'DASHBOARD', code: '01', icon: '◉', mobile: true },
  { id: 'printer', label: 'PRINTER', code: '02', icon: '⊡', mobile: true },
  { id: 'filaments', label: 'FILAMENTE', code: '03', icon: '◎', mobile: true },
  { id: 'prints', label: 'HISTORIE', code: '04', icon: '▤', mobile: true },
  { id: 'slicer', label: 'SLICER', code: '05', icon: '▶', mobile: false },
  { id: 'tools', label: 'TOOLS', code: '06', icon: '▦', mobile: false },
  { id: 'extras', label: 'WISHLIST', code: '07', icon: '★', mobile: false },
  { id: 'settings', label: 'SETTINGS', code: '08', icon: '⚙', mobile: true },
];

const MOBILE_TABS = TABS.filter(t => t.mobile);

function getInitialTab() {
  const params = new URLSearchParams(window.location.search);
  const t = params.get('tab');
  if (t && TABS.find(x => x.id === t)) return t;
  return 'dash';
}

export default function App() {
  const { user, loading, logout } = useAuth();
  const { isDark, toggle: toggleTheme } = useTheme();
  const [tab, setTab] = useState(getInitialTab());
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (tab === 'dash') url.searchParams.delete('tab');
    else url.searchParams.set('tab', tab);
    window.history.replaceState({}, '', url);
  }, [tab]);

  const switchTab = (id) => {
    setTab(id);
    setMenuOpen(false);
    window.scrollTo(0, 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500 font-display text-xs relative z-10">
        // INITIALIZING...
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <div className="min-h-screen relative z-10">
      <InstallBanner />

      <header className="border-b border-line bg-blueprint/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-3 min-w-0">
            <div className="font-display text-xl sm:text-2xl font-bold text-accent">FILAWATCH</div>
            <div className="hidden sm:block text-[10px] font-display text-gray-500 uppercase tracking-widest">
              v7 // BAMBU P2S
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="icon-btn w-9 h-9 sm:w-auto sm:h-auto sm:px-3 sm:py-1 flex items-center justify-center border border-line text-gray-400 hover:text-accent hover:border-accent transition-colors"
              title={isDark ? 'Light Mode' : 'Dark Mode'}
              aria-label="Theme toggle"
            >
              <span className="text-sm">{isDark ? '☀' : '☾'}</span>
            </button>
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-7 h-7 flex items-center justify-center text-xs font-display font-bold border border-line" style={{ background: user.avatar_color, color: '#0a0e1a' }}>
                {user.display_name[0]?.toUpperCase()}
              </div>
              <div className="text-[10px] font-display text-gray-400 uppercase">
                {user.display_name}
                {user.role === 'admin' && <span className="text-accent ml-1">★</span>}
              </div>
            </div>
            <button
              onClick={logout}
              className="hidden sm:inline-block text-[10px] font-display text-gray-500 hover:text-danger uppercase tracking-widest border border-line px-2 py-1"
            >
              ▸ Logout
            </button>
            {/* Hamburger only for secondary tabs on mobile */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="sm:hidden icon-btn flex flex-col justify-center items-center w-10 h-10 border border-line"
              aria-label="Menu"
            >
              <span className={`block h-px w-5 bg-accent transition-all ${menuOpen ? 'rotate-45 translate-y-px' : '-translate-y-1'}`} />
              <span className={`block h-px w-5 bg-accent transition-all ${menuOpen ? 'opacity-0' : ''}`} />
              <span className={`block h-px w-5 bg-accent transition-all ${menuOpen ? '-rotate-45 -translate-y-px' : 'translate-y-1'}`} />
            </button>
          </div>
        </div>

        {/* Desktop Tab Bar */}
        <nav className="hidden sm:block border-t border-line">
          <div className="max-w-7xl mx-auto px-4 flex flex-wrap">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => switchTab(t.id)}
                className={`relative px-4 py-3 font-display text-[11px] uppercase tracking-widest transition-colors border-r border-line ${
                  tab === t.id ? 'text-accent bg-ink' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {tab === t.id && <div className="absolute top-0 left-0 right-0 h-px bg-accent" />}
                <span className="text-line mr-2">{t.code}</span>
                {t.label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      {/* Mobile Slide-out Menu — full tab list */}
      {menuOpen && (
        <div className="sm:hidden fixed inset-0 z-40" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-ink/80 backdrop-blur-sm" />
          <div className="absolute right-0 top-0 bottom-0 w-72 bg-blueprint border-l border-accent overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-line flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center font-display font-bold border border-line" style={{ background: user.avatar_color, color: '#0a0e1a' }}>
                {user.display_name[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{user.display_name}</div>
                <div className="text-[10px] text-gray-500 uppercase font-display">
                  {user.role}{user.role === 'admin' && ' ★'}
                </div>
              </div>
            </div>
            <nav className="py-2">
              {TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => switchTab(t.id)}
                  className={`w-full text-left px-4 py-3 font-display text-xs uppercase tracking-widest border-l-2 ${
                    tab === t.id
                      ? 'text-accent border-accent bg-ink/60'
                      : 'text-gray-400 border-transparent hover:bg-ink/30'
                  }`}
                >
                  <span className="text-line mr-3 inline-block w-6">{t.code}</span>
                  <span className="mr-2">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </nav>
            <div className="p-4 border-t border-line space-y-2">
              <button
                onClick={() => { toggleTheme(); }}
                className="w-full text-[11px] font-display uppercase tracking-widest border border-line py-2 text-gray-400 hover:border-accent hover:text-accent flex items-center justify-center gap-2"
              >
                {isDark ? '☀ Light Mode' : '☾ Dark Mode'}
              </button>
              <button
                onClick={() => { logout(); setMenuOpen(false); }}
                className="w-full text-[11px] font-display uppercase tracking-widest border border-line py-2 text-gray-400 hover:border-danger hover:text-danger"
              >
                ▸ Logout
              </button>
            </div>
            <div className="p-4 text-center text-[10px] text-gray-700 font-display uppercase">
              Filawatch v7
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-24 sm:pb-6">
        {tab === 'dash' && <Dashboard />}
        {tab === 'printer' && <PrinterLive />}
        {tab === 'filaments' && <Filaments />}
        {tab === 'prints' && <Prints />}
        {tab === 'slicer' && <Slicer />}
        {tab === 'tools' && <Tools />}
        {tab === 'extras' && <WishlistIdeas />}
        {tab === 'settings' && <Settings />}
      </main>

      {/* Mobile Bottom Nav — 5 main tabs */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-30 bg-blueprint border-t border-line bottom-nav-safe">
        <div className="grid grid-cols-5">
          {MOBILE_TABS.map(t => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => switchTab(t.id)}
                className={`relative flex flex-col items-center justify-center py-2 font-display text-[9px] uppercase tracking-wider transition-colors ${
                  active ? 'text-accent' : 'text-gray-500 hover:text-gray-300'
                }`}
                style={{ minHeight: 56 }}
              >
                {active && <div className="absolute top-0 left-2 right-2 h-px bg-accent" />}
                <span className="text-lg leading-none mb-0.5">{t.icon}</span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <footer className="hidden sm:block max-w-7xl mx-auto px-4 py-6 mt-12 border-t border-line">
        <div className="flex justify-between text-[10px] font-display text-gray-600 uppercase tracking-widest">
          <span>FILAWATCH v7 // PWA</span>
          <span>© LUCA AIGNER</span>
        </div>
      </footer>
    </div>
  );
}
