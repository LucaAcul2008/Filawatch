import React, { useEffect, useState } from 'react';
import { Panel, Button, Modal } from './ui.jsx';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useToast } from '../ToastContext.jsx';

export default function PrinterLive() {
  const [state, setState] = useState(null);
  const [confirm, setConfirm] = useState(null); // { action, title, body, danger }
  const [busy, setBusy] = useState(false);
  const [lightOn, setLightOn] = useState(true);
  const [speedLevel, setSpeedLevel] = useState('2');
  const [assignments, setAssignments] = useState([]);
  const [filaments, setFilaments] = useState([]);
  const [amsModalOpen, setAmsModalOpen] = useState(false);
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    const token = localStorage.getItem('filatrack_token');
    if (!token) return;
    const es = new EventSource(`/api/printer/stream?token=${encodeURIComponent(token)}`);
    es.onmessage = (e) => {
      try { setState(JSON.parse(e.data)); } catch {}
    };
    es.onerror = () => {};
    return () => es.close();
  }, []);

  const loadAssignments = async () => {
    try {
      const [a, f] = await Promise.all([api.getAmsAssignments(), api.listFilaments()]);
      setAssignments(a);
      setFilaments(f);
    } catch (e) {
      // silent, wir zeigen trotzdem die AMS-Slots
    }
  };
  useEffect(() => { loadAssignments(); }, []);
  // Reload alle 15s damit fremde Änderungen sichtbar werden
  useEffect(() => {
    const iv = setInterval(loadAssignments, 15000);
    return () => clearInterval(iv);
  }, []);

  const assignSlot = async (unitId, slotId, filamentId) => {
    try {
      if (!filamentId) {
        await api.deleteAmsAssignment(unitId, slotId);
        toast.success('Zuordnung entfernt');
      } else {
        await api.setAmsAssignment(unitId, slotId, filamentId);
        toast.success('Zuordnung gespeichert');
      }
      loadAssignments();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const findAssignment = (unitId, slotId) =>
    assignments.find(a => a.unit_id === unitId && a.slot_id === slotId);

  if (!state) return <div className="text-gray-500 font-display text-xs">// VERBINDE ZU DRUCKER...</div>;

  const isPrinting = state.status === 'RUNNING' || state.status === 'PAUSE';
  const isPaused = state.status === 'PAUSE';
  const progressPct = state.progress || 0;
  const remH = Math.floor((state.remaining_time || 0) / 60);
  const remM = (state.remaining_time || 0) % 60;

  // Direct actions (non-destructive)
  const doAction = async (fn, successMsg) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      toast.success(successMsg);
    } catch (e) {
      toast.error(e.message || 'Fehler');
    } finally {
      setBusy(false);
    }
  };

  const handlePause   = () => doAction(() => api.printerPause(),  'Druck pausiert');
  const handleResume  = () => doAction(() => api.printerResume(), 'Druck fortgesetzt');
  const handleLight   = () => {
    const next = !lightOn;
    setLightOn(next);
    doAction(() => api.printerLight(next), `Licht ${next ? 'an' : 'aus'}`);
  };
  const handleSpeed = (level) => {
    setSpeedLevel(level);
    const labels = { '1': 'Silent', '2': 'Standard', '3': 'Sport', '4': 'Ludicrous' };
    doAction(() => api.printerSpeed(level), `Geschwindigkeit: ${labels[level]}`);
  };

  // Confirm-required actions
  const askStop = () => setConfirm({
    action: 'stop',
    title: 'Druck wirklich abbrechen?',
    body: 'Der aktuelle Druck wird sofort gestoppt. Diese Aktion kann nicht rückgängig gemacht werden.',
    danger: true,
  });
  const askEmergency = () => setConfirm({
    action: 'emergency',
    title: 'NOTFALL-AUS?',
    body: 'Stoppt den Druck SOFORT, schaltet Heizung und Lüfter ab. Nur im Notfall verwenden!',
    danger: true,
  });

  const executeConfirm = async () => {
    if (!confirm) return;
    const action = confirm.action;
    setConfirm(null);
    if (action === 'stop') {
      await doAction(() => api.printerStop(), 'Druck gestoppt');
    } else if (action === 'emergency') {
      await doAction(() => api.printerEmergencyStop(), 'NOTFALL-AUS ausgeführt');
    }
  };

  return (
    <div className="space-y-6">
      {/* Connection status banner */}
      <div className={`border ${state.connected ? 'border-success' : 'border-danger'} bg-blueprint/60 p-3 flex items-center justify-between relative overflow-hidden`}>
        {state.connected && <div className="scan-line" />}
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${state.connected ? 'bg-success' : 'bg-danger'} ${state.connected ? '' : 'blink'}`} />
          <span className="font-display text-xs uppercase tracking-widest">
            {state.connected ? `${state.device_name || 'BAMBU P2S'} // ONLINE` : 'BAMBU P2S // OFFLINE'}
          </span>
        </div>
        <span className="text-[10px] text-gray-500 font-display">
          {state.last_update ? new Date(state.last_update).toLocaleTimeString('de-DE') : '--:--:--'}
        </span>
      </div>

      {state.error && (
        <div className="border border-danger bg-danger/10 p-4 text-xs text-danger font-body">
          ⚠ {state.error}
        </div>
      )}

      {/* === v7 CONTROL PANEL === */}
      {state.connected && isAdmin && (
        <Panel title="STEUERUNG" accent="#ff3860">
          <div className="space-y-4">
            {/* Print state controls */}
            <div>
              <div className="text-[10px] uppercase tracking-widest text-gray-500 font-display mb-2">Druck-Steuerung</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {!isPaused ? (
                  <button
                    onClick={handlePause}
                    disabled={busy || !isPrinting}
                    className="px-4 py-4 border border-line hover:border-accent hover:text-accent disabled:opacity-30 disabled:cursor-not-allowed font-display text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    <span className="text-base">⏸</span> Pause
                  </button>
                ) : (
                  <button
                    onClick={handleResume}
                    disabled={busy}
                    className="px-4 py-4 border border-success text-success hover:bg-success hover:text-ink disabled:opacity-30 font-display text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    <span className="text-base">▶</span> Resume
                  </button>
                )}
                <button
                  onClick={askStop}
                  disabled={busy || !isPrinting}
                  className="px-4 py-4 border border-danger text-danger hover:bg-danger hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed font-display text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                >
                  <span className="text-base">■</span> Stop
                </button>
                <button
                  onClick={askEmergency}
                  disabled={busy}
                  className="pulse-danger col-span-2 sm:col-span-1 px-4 py-4 bg-danger text-ink hover:brightness-110 disabled:opacity-30 font-display text-xs uppercase tracking-widest font-bold transition-all flex items-center justify-center gap-2 border border-danger"
                >
                  <span className="text-base">⚡</span> Notfall-Aus
                </button>
              </div>
            </div>

            {/* Light + Speed */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-line">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-gray-500 font-display mb-2">Kammer-Licht</div>
                <button
                  onClick={handleLight}
                  disabled={busy}
                  className={`w-full px-4 py-3 border font-display text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-30 ${
                    lightOn
                      ? 'border-accent text-accent hover:bg-accent hover:text-ink'
                      : 'border-line text-gray-500 hover:border-gray-400'
                  }`}
                >
                  <span className="text-base">{lightOn ? '☀' : '○'}</span>
                  {lightOn ? 'Licht AN' : 'Licht AUS'}
                </button>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-gray-500 font-display mb-2">Geschwindigkeit</div>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { v: '1', label: 'Silent', icon: '🔇' },
                    { v: '2', label: 'Std', icon: '◐' },
                    { v: '3', label: 'Sport', icon: '⚡' },
                    { v: '4', label: 'Ludi', icon: '🚀' },
                  ].map(s => (
                    <button
                      key={s.v}
                      onClick={() => handleSpeed(s.v)}
                      disabled={busy}
                      className={`px-1 py-3 border font-display text-[10px] uppercase tracking-wider transition-all disabled:opacity-30 ${
                        speedLevel === s.v
                          ? 'border-accent text-accent bg-accent/10'
                          : 'border-line text-gray-500 hover:border-gray-400'
                      }`}
                    >
                      <div className="text-sm">{s.icon}</div>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="text-[9px] text-gray-600 font-body italic pt-1">
              Hinweis: Bambu blockt seit FW 01.08+ einige Befehle eventuell. Falls nichts passiert,
              ist das ein Drucker-seitiger Schutz.
            </div>
          </div>
        </Panel>
      )}

      {/* Status & Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Panel title="STATUS" accent="#00ff88" className="lg:col-span-2">
          <div className="space-y-4">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-gray-500 font-display">Aktueller Druck</div>
              <div className="font-display text-lg mt-1 truncate">{state.print_name || '— kein aktiver Druck —'}</div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] font-display uppercase mb-2">
                <span className="text-gray-500">Fortschritt</span>
                <span className="text-accent">{progressPct}%</span>
              </div>
              <div className="h-4 bg-ink border border-line relative overflow-hidden">
                <div className="h-full bg-gradient-to-r from-accent2 to-success transition-all duration-700" style={{ width: `${progressPct}%` }} />
                {isPrinting && <div className="absolute inset-0 progress-shine" />}
                {isPrinting && <div className="absolute inset-0 scan-line" />}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="border border-line p-2">
                <div className="text-[9px] uppercase text-gray-500 font-display">Layer</div>
                <div className="font-display text-sm text-accent">{state.current_layer} / {state.total_layers}</div>
              </div>
              <div className="border border-line p-2">
                <div className="text-[9px] uppercase text-gray-500 font-display">Restzeit</div>
                <div className="font-display text-sm text-accent2">{remH}h {remM}m</div>
              </div>
              <div className="border border-line p-2">
                <div className="text-[9px] uppercase text-gray-500 font-display">Modus</div>
                <div className="font-display text-sm text-success">{state.status || '—'}</div>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="TEMPERATUREN" accent="#ff6b00">
          <div className="space-y-4">
            <TempBar label="Düse" value={state.nozzle_temp} target={state.nozzle_target} max={300} color="#ff3860" />
            <TempBar label="Heizbett" value={state.bed_temp} target={state.bed_target} max={120} color="#ffb800" />
            <TempBar label="Kammer" value={state.chamber_temp} target={null} max={70} color="#00d9ff" />
          </div>
        </Panel>
      </div>

      {/* AMS Slots with v7 assignment */}
      {state.ams && state.ams.length > 0 && (
        <Panel title="AMS // FILAMENT SLOTS" accent="#a855f7">
          <div className="space-y-4">
            {isAdmin && (
              <div className="flex justify-end">
                <button
                  onClick={() => setAmsModalOpen(true)}
                  className="icon-btn px-3 py-2 border border-line hover:border-accent hover:text-accent font-display text-[10px] uppercase tracking-widest transition-colors"
                >
                  ⚙ AMS einrichten
                </button>
              </div>
            )}
            {state.ams.map(unit => (
              <div key={unit.id}>
                <div className="text-[10px] uppercase tracking-widest text-gray-500 font-display mb-2">
                  AMS Unit {unit.id} · {unit.temp}°C · Humidity {unit.humidity}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {unit.slots.map(slot => {
                    const assigned = findAssignment(unit.id, slot.id);
                    return (
                      <div key={slot.id} className="border border-line p-3 bg-ink/40">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-10 h-10 border border-line shrink-0"
                            style={{ background: assigned?.color_hex || slot.color || '#333' }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-display text-gray-400">SLOT {slot.id}</div>
                            {assigned ? (
                              <>
                                <div className="text-xs truncate text-accent">{assigned.brand}</div>
                                <div className="text-[10px] text-gray-500 truncate">{assigned.material} · {assigned.color_name}</div>
                              </>
                            ) : (
                              <div className="text-xs truncate text-gray-500">{slot.type || '—'}</div>
                            )}
                          </div>
                        </div>
                        {slot.remain != null && slot.remain >= 0 && (
                          <div className="mt-2">
                            <div className="h-1 bg-ink border border-line">
                              <div className="h-full transition-all" style={{ width: `${slot.remain}%`, background: assigned?.color_hex || slot.color || '#666' }} />
                            </div>
                            <div className="flex justify-between text-[9px] text-gray-500 mt-1">
                              <span>{slot.remain}%</span>
                              {assigned && <span className="text-accent">{assigned.current_weight_g}g</span>}
                            </div>
                          </div>
                        )}
                        {isAdmin && (
                          <select
                            value={assigned?.filament_id || ''}
                            onChange={e => assignSlot(unit.id, slot.id, e.target.value || null)}
                            className="mt-2 w-full bg-blueprint border border-line px-2 py-1.5 text-[11px] font-body focus:outline-none focus:border-accent"
                            title="Spule zuordnen"
                          >
                            <option value="">— nicht zugeordnet —</option>
                            {filaments.map(f => (
                              <option key={f.id} value={f.id}>
                                {f.brand} {f.color_name} ({f.current_weight_g}g)
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="text-[9px] text-gray-600 font-body italic pt-1">
              Zugeordnete Spulen werden automatisch aktualisiert, sobald der Drucker Verbrauch meldet.
            </div>
          </div>
        </Panel>
      )}

      {!state.connected && !state.error && (
        <Panel title="HINWEIS">
          <div className="text-xs text-gray-400 font-body leading-relaxed space-y-2">
            <p>Es konnte noch keine Verbindung zum Drucker aufgebaut werden.</p>
            <p>Bitte überprüfe die Drucker-Konfiguration unter <code className="text-accent">Settings → Drucker</code>.</p>
          </div>
        </Panel>
      )}

      {/* Confirm Modal */}
      <Modal open={!!confirm} onClose={() => setConfirm(null)} title={confirm?.title || ''}>
        {confirm && (
          <div className="space-y-4">
            <div className={`border p-4 ${confirm.danger ? 'border-danger bg-danger/10' : 'border-line'}`}>
              <div className="flex items-start gap-3">
                <div className="text-2xl">{confirm.danger ? '⚠' : 'ℹ'}</div>
                <div className="text-sm font-body" style={{ color: 'var(--text)' }}>{confirm.body}</div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button variant="ghost" onClick={() => setConfirm(null)}>Abbrechen</Button>
              <Button variant="danger" onClick={executeConfirm}>
                {confirm.action === 'emergency' ? 'NOTFALL-AUS' : 'Bestätigen'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* AMS Setup Modal */}
      <AmsSetupModal
        open={amsModalOpen}
        onClose={() => setAmsModalOpen(false)}
        amsState={state.ams}
        assignments={assignments}
        filaments={filaments}
        onAssign={assignSlot}
      />
    </div>
  );
}

function AmsSetupModal({ open, onClose, amsState, assignments, filaments, onAssign }) {
  if (!amsState || amsState.length === 0) return null;
  const findA = (u, s) => assignments.find(a => a.unit_id === u && a.slot_id === s);
  return (
    <Modal open={open} onClose={onClose} title="AMS EINRICHTEN">
      <div className="space-y-4">
        <div className="text-xs text-gray-400 font-body">
          Ordne jedem AMS-Slot eine Spule aus deiner Filament-Liste zu. Filawatch zieht dann automatisch
          den Verbrauch vom Bestand ab, sobald der Drucker neue Werte meldet.
        </div>
        {amsState.map(unit => (
          <div key={unit.id} className="border border-line">
            <div className="bg-blueprint/60 px-3 py-2 border-b border-line text-[10px] font-display uppercase tracking-widest text-accent">
              AMS Unit {unit.id}
            </div>
            <div className="divide-y divide-line/50">
              {unit.slots.map(slot => {
                const a = findA(unit.id, slot.id);
                return (
                  <div key={slot.id} className="p-3 flex items-center gap-3">
                    <div
                      className="w-10 h-10 border border-line shrink-0"
                      style={{ background: a?.color_hex || slot.color || '#333' }}
                    />
                    <div className="w-16 shrink-0">
                      <div className="text-[10px] font-display text-gray-500">SLOT</div>
                      <div className="font-display text-accent">{slot.id}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <select
                        value={a?.filament_id || ''}
                        onChange={e => onAssign(unit.id, slot.id, e.target.value || null)}
                        className="w-full bg-ink border border-line px-2 py-2 text-xs font-body focus:outline-none focus:border-accent"
                      >
                        <option value="">— nicht zugeordnet —</option>
                        {filaments.map(f => (
                          <option key={f.id} value={f.id}>
                            {f.brand} · {f.material} · {f.color_name} ({f.current_weight_g}g)
                          </option>
                        ))}
                      </select>
                      {slot.remain != null && slot.remain >= 0 && (
                        <div className="text-[10px] text-gray-500 mt-1">Drucker meldet: {slot.remain}%</div>
                      )}
                    </div>
                    {a && (
                      <button
                        onClick={() => onAssign(unit.id, slot.id, null)}
                        className="icon-btn text-gray-500 hover:text-danger text-sm"
                        title="Zuordnung entfernen"
                      >✕</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div className="flex justify-end pt-2 border-t border-line">
          <Button onClick={onClose}>Fertig</Button>
        </div>
      </div>
    </Modal>
  );
}

function TempBar({ label, value, target, max, color }) {
  const v = value || 0;
  const t = target || 0;
  const pct = Math.min(100, (v / max) * 100);
  const tPct = Math.min(100, (t / max) * 100);
  return (
    <div>
      <div className="flex justify-between text-[10px] font-display uppercase mb-1">
        <span className="text-gray-500">{label}</span>
        <span style={{ color }}>{v.toFixed(0)}°C {t > 0 && <span className="text-gray-600">/ {t.toFixed(0)}°</span>}</span>
      </div>
      <div className="h-2 bg-ink border border-line relative">
        <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
        {t > 0 && (
          <div className="absolute top-0 bottom-0 w-px bg-white/60" style={{ left: `${tPct}%` }} />
        )}
      </div>
    </div>
  );
}
