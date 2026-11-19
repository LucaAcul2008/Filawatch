import React, { useEffect, useState } from 'react';

const DISMISSED_KEY = 'filatrack_install_dismissed';

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [show, setShow] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return;

    // Schon installiert?
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if (window.navigator.standalone) return; // iOS

    // Android: beforeinstallprompt
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS: kein beforeinstallprompt → Hinweis anzeigen
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIos) {
      // Erst nach 3 Sekunden anzeigen damit er nicht aufdringlich ist
      const t = setTimeout(() => setShowIosHint(true), 3000);
      return () => { clearTimeout(t); window.removeEventListener('beforeinstallprompt', handler); };
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShow(false);
    }
    setDeferredPrompt(null);
  };

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setShow(false);
    setShowIosHint(false);
  };

  if (!show && !showIosHint) return null;

  return (
    <div className="bg-accent/10 border-b border-accent/40 relative z-20">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3">
        <div className="text-accent text-lg">📱</div>
        <div className="flex-1 text-xs">
          {show ? (
            <>
              <span className="font-display text-accent uppercase tracking-wider">App installieren</span>
              <span className="text-gray-400 ml-2 hidden sm:inline">— Schneller Zugriff vom Homescreen</span>
            </>
          ) : (
            <>
              <span className="font-display text-accent uppercase tracking-wider">Auf iPhone installieren:</span>
              <span className="text-gray-400 ml-2">Teilen-Button → "Zum Home-Bildschirm"</span>
            </>
          )}
        </div>
        {show && (
          <button
            onClick={install}
            className="text-[10px] font-display uppercase tracking-widest bg-accent text-ink px-3 py-1.5"
          >
            Installieren
          </button>
        )}
        <button onClick={dismiss} className="text-gray-500 hover:text-accent text-lg leading-none px-1">
          ×
        </button>
      </div>
    </div>
  );
}
