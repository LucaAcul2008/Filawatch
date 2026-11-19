import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Panel, Button, Input, Modal } from './ui.jsx';

export default function Maintenance() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [tasks, setTasks] = useState([]);
  const [adding, setAdding] = useState(null);

  const load = () => api.listMaintenance().then(setTasks);
  useEffect(() => { load(); }, []);

  const markDone = async (id) => {
    await api.markMaintenanceDone(id);
    load();
  };

  const save = async () => {
    await api.addMaintenance({ ...adding, interval_hours: Number(adding.interval_hours) });
    setAdding(null);
    load();
  };

  const remove = async (id) => {
    if (!confirm('Wartungsaufgabe löschen?')) return;
    await api.deleteMaintenance(id);
    load();
  };

  return (
    <Panel title="WARTUNGS-TRACKER" accent="#ff6b00">
      <div className="text-xs text-gray-400 mb-4">
        Wartungsaufgaben für deinen Bambu P2S. Werden anhand der Druckstunden seit der letzten Erledigung berechnet.
      </div>

      {isAdmin && (
        <div className="flex justify-end mb-3">
          <Button onClick={() => setAdding({ name: '', description: '', interval_hours: 100 })}>+ Neue Aufgabe</Button>
        </div>
      )}

      <div className="space-y-2">
        {tasks.map(t => {
          const isDue = t.is_due;
          const isWarning = !isDue && t.progress_pct > 80;
          const color = isDue ? '#ff3860' : isWarning ? '#ffb800' : '#00ff88';
          return (
            <div key={t.id} className="border border-line bg-ink/40 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-display text-sm">{t.name}</div>
                    {isDue && <span className="text-[9px] font-display bg-danger text-ink px-1.5 py-0.5">DUE</span>}
                    {isWarning && <span className="text-[9px] font-display bg-accent text-ink px-1.5 py-0.5">SOON</span>}
                  </div>
                  {t.description && <div className="text-[10px] text-gray-500 mt-0.5">{t.description}</div>}
                </div>
                <button
                  onClick={() => markDone(t.id)}
                  className="text-[10px] font-display uppercase tracking-wider px-3 py-1.5 border border-line hover:border-success hover:text-success"
                >
                  ✓ Erledigt
                </button>
                {isAdmin && (
                  <button onClick={() => remove(t.id)} className="text-gray-600 hover:text-danger text-sm">✕</button>
                )}
              </div>
              <div className="mt-2">
                <div className="flex justify-between text-[10px] font-display mb-1">
                  <span className="text-gray-500">{t.hours_since_last}h / {t.interval_hours}h</span>
                  <span style={{ color }}>
                    {isDue ? `${Math.abs(t.due_in_hours)}h überfällig` : `noch ${t.due_in_hours}h`}
                  </span>
                </div>
                <div className="h-1.5 bg-ink border border-line">
                  <div className="h-full transition-all" style={{ width: `${t.progress_pct}%`, background: color }} />
                </div>
              </div>
              {t.last_done_at && (
                <div className="mt-2 text-[9px] text-gray-600 font-display">
                  Zuletzt: {new Date(t.last_done_at).toLocaleDateString('de-DE')} {t.last_done_by && `· ${t.last_done_by}`}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Modal open={!!adding} onClose={() => setAdding(null)} title="Neue Wartungsaufgabe">
        {adding && (
          <div className="space-y-4">
            <Input label="Name" value={adding.name} onChange={e => setAdding({ ...adding, name: e.target.value })} />
            <Input label="Beschreibung" value={adding.description} onChange={e => setAdding({ ...adding, description: e.target.value })} />
            <Input label="Intervall (Druckstunden)" type="number" value={adding.interval_hours} onChange={e => setAdding({ ...adding, interval_hours: e.target.value })} />
            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button variant="ghost" onClick={() => setAdding(null)}>Abbrechen</Button>
              <Button onClick={save}>Anlegen</Button>
            </div>
          </div>
        )}
      </Modal>
    </Panel>
  );
}
