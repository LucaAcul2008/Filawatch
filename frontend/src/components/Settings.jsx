import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useTheme } from '../ThemeContext.jsx';
import { Panel, Button, Input, Select, Modal } from './ui.jsx';
import { subscribeToPush, unsubscribeFromPush, getPushPermission } from '../push.js';

export default function Settings() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <div className="space-y-6">
      <AppearanceSection />
      <ProfileSection />
      <PushSection />
      {isAdmin && <CostSection />}
      {isAdmin && <PrinterSection />}
      {isAdmin && <BackupSection />}
      {isAdmin && <UsersSection />}
    </div>
  );
}

function AppearanceSection() {
  const { theme, setTheme, isDark } = useTheme();
  return (
    <Panel title="DARSTELLUNG" accent="#a855f7">
      <div className="space-y-3">
        <div className="text-[10px] uppercase tracking-widest text-gray-500 font-display">Farbschema</div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setTheme('dark')}
            className={`p-4 border transition-all text-left ${
              isDark ? 'border-accent bg-accent/5' : 'border-line hover:border-gray-400'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-display text-sm uppercase tracking-wider">☾ Dark</span>
              {isDark && <span className="text-accent text-xs">✓ AKTIV</span>}
            </div>
            <div className="text-[10px] text-gray-500 font-body">
              Industrial Blueprint. Scanlines, dunkler Hintergrund, neon-Akzente.
            </div>
          </button>
          <button
            onClick={() => setTheme('light')}
            className={`p-4 border transition-all text-left ${
              !isDark ? 'border-accent bg-accent/5' : 'border-line hover:border-gray-400'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-display text-sm uppercase tracking-wider">☀ Light</span>
              {!isDark && <span className="text-accent text-xs">✓ AKTIV</span>}
            </div>
            <div className="text-[10px] text-gray-500 font-body">
              Sauber und hell. Gut für Tageslicht und empfindliche Augen.
            </div>
          </button>
        </div>
        <div className="text-[10px] text-gray-600 font-body italic">
          Die Einstellung wird lokal im Browser gespeichert (LocalStorage).
        </div>
      </div>
    </Panel>
  );
}

function CostSection() {
  const [settings, setSettings] = useState(null);
  const [msg, setMsg] = useState('');

  const load = () => api.getAppSettings().then(setSettings);
  useEffect(() => { load(); }, []);

  const save = async () => {
    setMsg('');
    try {
      await api.updateAppSettings({
        cost_power_kwh: parseFloat(settings.cost_power_kwh),
        cost_printer_watts: parseFloat(settings.cost_printer_watts),
      });
      setMsg('Gespeichert ✓');
      setTimeout(() => setMsg(''), 2000);
    } catch (e) { setMsg('Fehler: ' + e.message); }
  };

  if (!settings) return null;

  return (
    <Panel title="KOSTEN-BERECHNUNG" accent="#ff6b00">
      <div className="text-xs text-gray-400 mb-4">
        Diese Werte werden für die automatische Kostenrechnung pro Druck verwendet (Material aus Spulen-Preis × verbrauchte Gramm + Stromkosten aus Druckdauer).
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="Strompreis (€/kWh)" type="number" step="0.01" value={settings.cost_power_kwh} onChange={e => setSettings({ ...settings, cost_power_kwh: e.target.value })} />
        <Input label="Drucker Verbrauch (Watt)" type="number" value={settings.cost_printer_watts} onChange={e => setSettings({ ...settings, cost_printer_watts: e.target.value })} />
        <div className="sm:col-span-2 text-[10px] text-gray-500">
          Bambu P2S braucht typisch ~120-180W beim Drucken. Standard: 150W.
        </div>
        <div className="sm:col-span-2 flex justify-end items-center gap-3">
          {msg && <span className="text-xs text-success font-display">{msg}</span>}
          <Button onClick={save}>Speichern</Button>
        </div>
      </div>
    </Panel>
  );
}

function BackupSection() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [backups, setBackups] = useState([]);
  const [showList, setShowList] = useState(false);

  const doBackup = async () => {
    setBusy(true); setMsg('');
    try {
      const r = await api.backupToAzure();
      setMsg(`✓ Backup hochgeladen: ${r.blobName} (${(r.size / 1024).toFixed(0)} KB)`);
    } catch (e) {
      setMsg('Fehler: ' + e.message);
    } finally { setBusy(false); }
  };

  const loadBackups = async () => {
    try {
      const list = await api.listBackups();
      setBackups(list);
      setShowList(true);
    } catch (e) { setMsg('Fehler: ' + e.message); }
  };

  return (
    <Panel title="AZURE BLOB BACKUP" accent="#00d9ff">
      <div className="text-xs text-gray-400 mb-4 space-y-1">
        <p>Sichert die komplette SQLite-DB in deinen Azure Storage Account.</p>
        <p className="text-gray-500">Voraussetzung: <code className="text-accent">AZURE_STORAGE_CONNECTION_STRING</code> im Backend gesetzt. Container: <code className="text-accent">filatrack-backups</code> (wird automatisch erstellt).</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <Button onClick={doBackup} disabled={busy}>{busy ? '// BACKUP...' : '☁ Jetzt backupen'}</Button>
        <Button variant="ghost" onClick={loadBackups}>Backups auflisten</Button>
      </div>
      {msg && <div className="mt-3 text-xs font-display">{msg}</div>}
      {showList && backups.length > 0 && (
        <div className="mt-4 space-y-1 max-h-64 overflow-auto">
          {backups.map(b => (
            <div key={b.name} className="flex items-center justify-between text-[10px] font-display border border-line p-2">
              <span className="text-gray-300 truncate">{b.name}</span>
              <span className="text-gray-500">{(b.size / 1024).toFixed(0)} KB · {new Date(b.created).toLocaleString('de-DE')}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function ProfileSection() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ display_name: user.display_name, email: user.email || '', avatar_color: user.avatar_color, password: '' });
  const [msg, setMsg] = useState('');

  const save = async () => {
    setMsg('');
    try {
      const data = { ...form };
      if (!data.password) delete data.password;
      const updated = await api.updateMe(data);
      setUser(updated);
      setForm({ ...form, password: '' });
      setMsg('Gespeichert ✓');
      setTimeout(() => setMsg(''), 2000);
    } catch (e) { setMsg('Fehler: ' + e.message); }
  };

  return (
    <Panel title="MEIN PROFIL" accent="#00d9ff">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="Anzeigename" value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} />
        <Input label="Email (optional)" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        <div>
          <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1 font-display">Avatar-Farbe</div>
          <div className="flex gap-2">
            <input type="color" value={form.avatar_color} onChange={e => setForm({ ...form, avatar_color: e.target.value })} className="h-10 w-16 bg-ink border border-line cursor-pointer" />
            <div className="flex items-center justify-center w-10 h-10 border border-line font-display font-bold" style={{ background: form.avatar_color, color: '#0a0e1a' }}>
              {form.display_name?.[0]?.toUpperCase() || '?'}
            </div>
          </div>
        </div>
        <Input label="Neues Passwort (leer = nicht ändern)" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
        <div className="sm:col-span-2 flex justify-end items-center gap-3">
          {msg && <span className="text-xs text-success font-display">{msg}</span>}
          <Button onClick={save}>Speichern</Button>
        </div>
      </div>
    </Panel>
  );
}

function PushSection() {
  const [permission, setPermission] = useState(getPushPermission());
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription())
        .then(sub => setEnabled(!!sub));
    }
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      await subscribeToPush();
      setEnabled(true);
      setPermission('granted');
    } catch (e) { alert('Fehler: ' + e.message); }
    finally { setBusy(false); }
  };

  const disable = async () => {
    setBusy(true);
    try {
      await unsubscribeFromPush();
      setEnabled(false);
    } catch (e) { alert('Fehler: ' + e.message); }
    finally { setBusy(false); }
  };

  return (
    <Panel title="PUSH-BENACHRICHTIGUNGEN" accent="#a855f7">
      <div className="text-xs text-gray-400 mb-4">
        Du bekommst eine Browser-Benachrichtigung wenn:
        <ul className="list-disc list-inside ml-2 mt-1 text-gray-500">
          <li>Ein Druck startet oder fertig ist</li>
          <li>Ein Druck fehlschlägt</li>
          <li>Filament fast leer ist</li>
        </ul>
      </div>
      <div className="flex items-center gap-3">
        {!enabled ? (
          <Button onClick={enable} disabled={busy || permission === 'denied'}>
            {busy ? '// AKTIVIERE...' : '▸ Aktivieren'}
          </Button>
        ) : (
          <Button variant="ghost" onClick={disable} disabled={busy}>
            ✓ Aktiv — Deaktivieren
          </Button>
        )}
        {permission === 'denied' && (
          <span className="text-xs text-danger">Im Browser blockiert. Bitte in den Browser-Einstellungen erlauben.</span>
        )}
      </div>
    </Panel>
  );
}

function PrinterSection() {
  const [config, setConfig] = useState(null);
  const [step, setStep] = useState('overview');
  const [mode, setMode] = useState('cloud');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [region, setRegion] = useState('eu');
  const [code, setCode] = useState('');
  const [devices, setDevices] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // LAN
  const [lanHost, setLanHost] = useState('');
  const [lanCode, setLanCode] = useState('');
  const [lanSerial, setLanSerial] = useState('');

  const load = () => api.getPrinterConfig().then(setConfig);
  useEffect(() => { load(); }, []);

  const startCloudLogin = async () => {
    setError(''); setBusy(true);
    try {
      const r = await api.cloudLogin(email, password, region);
      if (r.needsCode) {
        setStep('code');
      } else if (r.needsTfa) {
        setStep('tfa');
      } else if (r.devices) {
        setDevices(r.devices);
        setStep('select-device');
      }
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const verifyCode = async () => {
    setError(''); setBusy(true);
    try {
      const r = await api.cloudVerify(email, code, region);
      setDevices(r.devices || []);
      setStep('select-device');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const verifyTfa = async () => {
    setError(''); setBusy(true);
    try {
      const r = await api.cloudVerifyTfa(code, region);
      setDevices(r.devices || []);
      setStep('select-device');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const pickDevice = async (d) => {
    setBusy(true);
    try {
      await api.selectDevice(d.dev_id, d.name);
      setStep('overview');
      load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const saveLan = async () => {
    setError(''); setBusy(true);
    try {
      await api.setupLan({ lan_host: lanHost, lan_access_code: lanCode, device_serial: lanSerial });
      setStep('overview');
      load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const reconnect = async () => {
    setBusy(true);
    try { await api.reconnectPrinter(); }
    finally { setBusy(false); }
  };

  return (
    <Panel title="DRUCKER // BAMBU LAB P2S" accent="#ffb800">
      {step === 'overview' && (
        <div>
          {config ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="border border-line p-2">
                  <div className="text-[9px] text-gray-500 font-display uppercase">Modus</div>
                  <div className="font-display text-accent">{config.mode === 'cloud' ? '☁ CLOUD' : '⌂ LAN'}</div>
                </div>
                <div className="border border-line p-2">
                  <div className="text-[9px] text-gray-500 font-display uppercase">Drucker</div>
                  <div className="font-display text-accent2">{config.device_name || '—'}</div>
                </div>
                {config.email && (
                  <div className="border border-line p-2 col-span-2">
                    <div className="text-[9px] text-gray-500 font-display uppercase">Account</div>
                    <div className="font-body text-gray-300">{config.email}</div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setStep('mode-select')}>Neu konfigurieren</Button>
                <Button variant="ghost" onClick={reconnect} disabled={busy}>Reconnect</Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="text-gray-500 text-xs mb-4">// NOCH NICHT KONFIGURIERT</div>
              <Button onClick={() => setStep('mode-select')}>Drucker einrichten</Button>
            </div>
          )}
        </div>
      )}

      {step === 'mode-select' && (
        <div>
          <div className="text-xs text-gray-400 mb-4">Wie soll sich Filawatch mit dem Drucker verbinden?</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button onClick={() => { setMode('cloud'); setStep('cloud-login'); }} className="border border-line p-4 hover:border-accent text-left">
              <div className="font-display text-sm text-accent">☁ BAMBU CLOUD</div>
              <div className="text-[10px] text-gray-500 mt-2">Funktioniert von überall. Login mit Bambu-Account und Email-Code.</div>
            </button>
            <button onClick={() => { setMode('lan'); setStep('lan-setup'); }} className="border border-line p-4 hover:border-accent text-left">
              <div className="font-display text-sm text-accent2">⌂ LAN-MODUS</div>
              <div className="text-[10px] text-gray-500 mt-2">Direktverbindung im selben Netzwerk. Schneller, kein Cloud-Account nötig.</div>
            </button>
          </div>
          <div className="mt-4">
            <Button variant="ghost" onClick={() => setStep('overview')}>Zurück</Button>
          </div>
        </div>
      )}

      {step === 'cloud-login' && (
        <div className="space-y-3">
          <div className="text-xs text-gray-400 mb-2">Login mit deinem Bambu Lab Account.</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            <Input label="Passwort" type="password" value={password} onChange={e => setPassword(e.target.value)} />
            <Select label="Region" value={region} onChange={e => setRegion(e.target.value)} options={['eu', 'us', 'cn']} />
          </div>
          {error && <div className="text-xs text-danger">⚠ {error}</div>}
          <div className="flex gap-2">
            <Button onClick={startCloudLogin} disabled={busy || !email || !password}>{busy ? '// LOGIN...' : '▸ Login'}</Button>
            <Button variant="ghost" onClick={() => setStep('mode-select')}>Zurück</Button>
          </div>
        </div>
      )}

      {step === 'code' && (
        <div className="space-y-3">
          <div className="text-xs text-gray-400">
            Bambu hat dir einen 6-stelligen Code an <span className="text-accent">{email}</span> geschickt. Bitte hier eingeben:
          </div>
          <Input label="Verifizierungs-Code (Email)" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
          {error && <div className="text-xs text-danger">⚠ {error}</div>}
          <div className="flex gap-2">
            <Button onClick={verifyCode} disabled={busy || code.length !== 6}>{busy ? '// PRÜFE...' : '▸ Code verifizieren'}</Button>
            <Button variant="ghost" onClick={() => setStep('cloud-login')}>Zurück</Button>
          </div>
        </div>
      )}

      {step === 'tfa' && (
        <div className="space-y-3">
          <div className="text-xs text-gray-400 space-y-2">
            <p>Dein Bambu-Account hat <span className="text-accent">2FA aktiviert</span>.</p>
            <p>Öffne deine Authenticator-App (Google Authenticator, Authy, 1Password etc.) und gib den aktuellen 6-stelligen Code ein:</p>
          </div>
          <Input label="2FA Code aus der Authenticator-App" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
          {error && <div className="text-xs text-danger">⚠ {error}</div>}
          <div className="flex gap-2">
            <Button onClick={verifyTfa} disabled={busy || code.length !== 6}>{busy ? '// PRÜFE...' : '▸ 2FA verifizieren'}</Button>
            <Button variant="ghost" onClick={() => setStep('cloud-login')}>Zurück</Button>
          </div>
        </div>
      )}

      {step === 'select-device' && (
        <div className="space-y-3">
          <div className="text-xs text-gray-400">Wähle deinen Drucker:</div>
          {devices.length === 0 && <div className="text-gray-500 text-xs">// Keine Drucker gefunden</div>}
          {devices.map(d => (
            <button key={d.dev_id} onClick={() => pickDevice(d)} className="w-full border border-line p-3 hover:border-accent text-left flex items-center justify-between">
              <div>
                <div className="font-display text-sm text-accent">{d.name}</div>
                <div className="text-[10px] text-gray-500">{d.dev_product_name || d.dev_model_name} · {d.dev_id}</div>
              </div>
              <span className={`text-[10px] font-display ${d.online ? 'text-success' : 'text-gray-600'}`}>
                {d.online ? '● ONLINE' : '○ OFFLINE'}
              </span>
            </button>
          ))}
        </div>
      )}

      {step === 'lan-setup' && (
        <div className="space-y-3">
          <div className="text-xs text-gray-400">
            Werte vom Drucker-Touchscreen ablesen: Settings → WLAN bzw. Settings → Device.
          </div>
          <Input label="IP-Adresse" placeholder="192.168.1.50" value={lanHost} onChange={e => setLanHost(e.target.value)} />
          <Input label="Access Code" placeholder="12345678" value={lanCode} onChange={e => setLanCode(e.target.value)} />
          <Input label="Seriennummer" placeholder="01P..." value={lanSerial} onChange={e => setLanSerial(e.target.value)} />
          {error && <div className="text-xs text-danger">⚠ {error}</div>}
          <div className="flex gap-2">
            <Button onClick={saveLan} disabled={busy}>Speichern</Button>
            <Button variant="ghost" onClick={() => setStep('mode-select')}>Zurück</Button>
          </div>
        </div>
      )}
    </Panel>
  );
}

function UsersSection() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [adding, setAdding] = useState(null);

  const load = () => api.listUsers().then(setUsers);
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      await api.createUser(adding);
      setAdding(null);
      load();
    } catch (e) { alert(e.message); }
  };

  const remove = async (u) => {
    if (!confirm(`User "${u.display_name}" wirklich löschen?`)) return;
    await api.deleteUser(u.id);
    load();
  };

  return (
    <Panel title="USER VERWALTEN" accent="#00ff88">
      <div className="flex justify-end mb-3">
        <Button onClick={() => setAdding({ username: '', display_name: '', email: '', password: '', role: 'user', avatar_color: '#00d9ff' })}>+ Neuer User</Button>
      </div>
      <div className="space-y-2">
        {users.map(u => (
          <div key={u.id} className="flex items-center gap-3 border border-line p-3 bg-ink/40">
            <div className="w-10 h-10 flex items-center justify-center font-display font-bold border border-line" style={{ background: u.avatar_color, color: '#0a0e1a' }}>
              {u.display_name[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm">{u.display_name} <span className="text-gray-600 text-xs">@{u.username}</span></div>
              <div className="text-[10px] text-gray-500">{u.role.toUpperCase()} · {u.email || 'no email'}</div>
            </div>
            {u.id !== me.id && (
              <button onClick={() => remove(u)} className="text-gray-600 hover:text-danger">✕</button>
            )}
          </div>
        ))}
      </div>

      <Modal open={!!adding} onClose={() => setAdding(null)} title="Neuer User">
        {adding && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Username (für Login)" value={adding.username} onChange={e => setAdding({ ...adding, username: e.target.value })} />
            <Input label="Anzeigename" value={adding.display_name} onChange={e => setAdding({ ...adding, display_name: e.target.value })} />
            <Input label="Email (optional)" value={adding.email} onChange={e => setAdding({ ...adding, email: e.target.value })} />
            <Input label="Passwort" type="password" value={adding.password} onChange={e => setAdding({ ...adding, password: e.target.value })} />
            <Select label="Rolle" value={adding.role} onChange={e => setAdding({ ...adding, role: e.target.value })} options={['user', 'admin']} />
            <div>
              <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1 font-display">Avatar-Farbe</div>
              <input type="color" value={adding.avatar_color} onChange={e => setAdding({ ...adding, avatar_color: e.target.value })} className="h-10 w-full bg-ink border border-line cursor-pointer" />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2 pt-2 border-t border-line">
              <Button variant="ghost" onClick={() => setAdding(null)}>Abbrechen</Button>
              <Button onClick={save}>Anlegen</Button>
            </div>
          </div>
        )}
      </Modal>
    </Panel>
  );
}
