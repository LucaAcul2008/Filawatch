import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Button, Input, Select, Modal } from './ui.jsx';
import { FILAMENT_PRESETS } from '../filamentPresets.js';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useToast } from '../ToastContext.jsx';

const MATERIALS = [
  'PLA', 'PLA Matte', 'PLA Silk', 'PLA-CF',
  'PETG', 'PETG HF', 'PETG-CF',
  'ABS', 'ASA', 'ASA-CF',
  'TPU', 'TPU 95A',
  'PC', 'PC-FR',
  'Nylon', 'PA', 'PA-CF', 'PA6-CF', 'PAHT-CF',
  'PVA', 'HIPS',
  'Sonstiges'
];

const empty = {
  brand: '', material: 'PLA', color_name: '', color_hex: '#ffb800',
  diameter: 1.75, initial_weight_g: 1000, current_weight_g: 1000,
  spool_weight_g: 250, purchase_date: '', price: '', shop_url: '',
  location: '', nozzle_temp: 220, bed_temp: 55, print_speed: '',
  last_dried: '', notes: '',
};

const VIEW_KEY = 'filatrack_fila_view';

export default function Filaments() {
  const [list, setList] = useState([]);
  const [editing, setEditing] = useState(null);
  const [qrFor, setQrFor] = useState(null);
  const [filter, setFilter] = useState('');
  const [weighFor, setWeighFor] = useState(null);
  const [statsFor, setStatsFor] = useState(null);
  const [stats, setStats] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmDry, setConfirmDry] = useState(null);
  const [view, setView] = useState(() => {
    try { return localStorage.getItem(VIEW_KEY) || 'cards'; } catch { return 'cards'; }
  });
  const toast = useToast();

  const load = () => api.listFilaments().then(setList).catch(e => toast.error(e.message));
  useEffect(() => { load(); }, []);

  useEffect(() => {
    try { localStorage.setItem(VIEW_KEY, view); } catch {}
  }, [view]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fid = params.get('filament');
    if (fid && list.length > 0) {
      const f = list.find(x => x.id === fid);
      if (f) {
        setEditing({ ...f });
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [list]);

  const save = async () => {
    const data = { ...editing };
    ['price', 'nozzle_temp', 'bed_temp', 'print_speed'].forEach(k => {
      if (data[k] === '') data[k] = null;
      else if (data[k] != null) data[k] = Number(data[k]);
    });
    try {
      if (editing.id) {
        await api.updateFilament(editing.id, data);
        toast.success('Spule aktualisiert');
      } else {
        await api.createFilament(data);
        toast.success('Spule angelegt');
      }
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    try {
      await api.deleteFilament(confirmDelete.id);
      toast.success('Spule gelöscht');
      setConfirmDelete(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handlePresetChange = (e) => {
    const selectedName = e.target.value;
    if (!selectedName) return;
    const preset = FILAMENT_PRESETS.find(p => p.name === selectedName);
    if (preset && editing) {
      setEditing({
        ...editing,
        brand: preset.brand,
        material: preset.material,
        nozzle_temp: preset.nozzle_temp,
        bed_temp: preset.bed_temp,
        print_speed: preset.print_speed,
        initial_weight_g: preset.initial_weight_g,
        current_weight_g: editing.id ? editing.current_weight_g : preset.initial_weight_g,
        spool_weight_g: preset.spool_weight_g,
      });
      toast.info(`Vorlage "${preset.name}" geladen`);
    }
  };

  const doWeigh = async (totalG) => {
    if (!weighFor) return;
    try {
      await api.weighFilament(weighFor.id, Number(totalG));
      toast.success('Gewicht aktualisiert');
      setWeighFor(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const doMarkDried = async () => {
    if (!confirmDry) return;
    try {
      await api.markFilamentDried(confirmDry.id);
      toast.success('Als getrocknet markiert');
      setConfirmDry(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const showStats = async (filament) => {
    setStatsFor(filament);
    setStats(null);
    try {
      const s = await api.getFilamentStats(filament.id);
      setStats(s);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const filtered = list.filter(f =>
    !filter ||
    f.brand.toLowerCase().includes(filter.toLowerCase()) ||
    f.color_name.toLowerCase().includes(filter.toLowerCase()) ||
    f.material.toLowerCase().includes(filter.toLowerCase())
  );

  const totalWeight = list.reduce((a, f) => a + (f.current_weight_g || 0), 0);
  const amsFilaments = list.filter(f => f.in_ams);
  const amsWeight = amsFilaments.reduce((a, f) => a + (f.current_weight_g || 0), 0);
  const lowCount = list.filter(f => f.current_weight_g < 150).length;
  const dryCount = list.filter(f => f.needs_drying).length;

  return (
    <div className="space-y-5">
      {/* Header bar with stats + controls */}
      <div className="border border-line bg-blueprint/40 corner-marks">
        <div className="flex flex-wrap items-center gap-4 p-4">
          <div className="flex items-baseline gap-4 flex-1 min-w-[200px]">
            <div>
              <div className="text-[9px] uppercase tracking-widest text-gray-500 font-display">Spulen</div>
              <div className="font-display text-2xl text-accent">{list.length}</div>
            </div>
            <div className="hidden sm:block border-l border-line pl-4">
              <div className="text-[9px] uppercase tracking-widest text-gray-500 font-display">Gesamt</div>
              <div className="font-display text-lg text-accent2">{(totalWeight / 1000).toFixed(2)} kg</div>
            </div>
            {amsFilaments.length > 0 && (
              <div className="hidden md:block border-l border-line pl-4">
                <div className="text-[9px] uppercase tracking-widest text-gray-500 font-display">Im AMS</div>
                <div className="font-display text-lg text-accent">
                  {amsFilaments.length} <span className="text-xs text-gray-500">/ {(amsWeight / 1000).toFixed(2)}kg</span>
                </div>
              </div>
            )}
            {lowCount > 0 && (
              <div className="hidden sm:block border-l border-line pl-4">
                <div className="text-[9px] uppercase tracking-widest text-gray-500 font-display">Niedrig</div>
                <div className="font-display text-lg text-danger">{lowCount}</div>
              </div>
            )}
            {dryCount > 0 && (
              <div className="hidden sm:block border-l border-line pl-4">
                <div className="text-[9px] uppercase tracking-widest text-gray-500 font-display">Trocknen</div>
                <div className="font-display text-lg text-accent2"><span className="water-icon">💧</span> {dryCount}</div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="hidden sm:flex border border-line">
              <button
                onClick={() => setView('cards')}
                className={`icon-btn px-3 py-2 font-display text-xs transition-colors ${view === 'cards' ? 'text-accent bg-ink' : 'text-gray-500 hover:text-gray-300'}`}
                title="Karten-Ansicht"
              >▦</button>
              <button
                onClick={() => setView('list')}
                className={`icon-btn px-3 py-2 font-display text-xs transition-colors border-l border-line ${view === 'list' ? 'text-accent bg-ink' : 'text-gray-500 hover:text-gray-300'}`}
                title="Listen-Ansicht"
              >≡</button>
            </div>
            <Button onClick={() => setEditing({ ...empty })}>+ Neue Spule</Button>
          </div>
        </div>
        <div className="border-t border-line px-4 py-2">
          <Input placeholder="// SEARCH BRAND / FARBE / MATERIAL..." value={filter} onChange={e => setFilter(e.target.value)} />
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="border border-dashed border-line bg-blueprint/20 py-16 px-4 text-center">
          <div className="text-6xl mb-4 opacity-30">◎</div>
          <div className="font-display text-sm uppercase tracking-widest text-gray-400">
            {list.length === 0 ? 'Noch keine Spulen angelegt' : 'Keine Treffer für deine Suche'}
          </div>
          <div className="text-xs text-gray-600 mt-2 font-body">
            {list.length === 0
              ? 'Lege deine erste Filament-Spule an um loszulegen.'
              : 'Versuch einen anderen Suchbegriff oder leere das Feld.'}
          </div>
          {list.length === 0 && (
            <div className="mt-6">
              <Button onClick={() => setEditing({ ...empty })}>+ Erste Spule anlegen</Button>
            </div>
          )}
        </div>
      )}

      {/* Card View */}
      {view === 'cards' && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map(f => (
            <FilamentCard
              key={f.id}
              f={f}
              onEdit={() => setEditing({ ...f })}
              onWeigh={() => setWeighFor(f)}
              onStats={() => showStats(f)}
              onQr={() => setQrFor(f)}
              onDelete={() => setConfirmDelete(f)}
              onDry={() => setConfirmDry(f)}
            />
          ))}
        </div>
      )}

      {/* List View */}
      {view === 'list' && filtered.length > 0 && (
        <div className="border border-line bg-blueprint/40 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-line text-[10px] font-display uppercase tracking-widest text-gray-500">
                <th className="text-left p-3">Farbe</th>
                <th className="text-left p-3">Marke</th>
                <th className="text-left p-3">Material</th>
                <th className="text-right p-3">Bestand</th>
                <th className="text-right p-3">%</th>
                <th className="text-left p-3 hidden sm:table-cell">Ort</th>
                <th className="text-right p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(f => {
                const pct = Math.max(0, Math.min(100, (f.current_weight_g / f.initial_weight_g) * 100));
                const low = f.current_weight_g < 150;
                return (
                  <tr key={f.id} className="border-b border-line/50 hover:bg-ink/40 cursor-pointer" onClick={() => setEditing({ ...f })}>
                    <td className="p-3"><div className="w-6 h-6 border border-line" style={{ background: f.color_hex }} /></td>
                    <td className="p-3 font-display">{f.brand}</td>
                    <td className="p-3 text-gray-400">{f.material} · {f.color_name}</td>
                    <td className="p-3 text-right font-mono" style={{ color: low ? '#ff3860' : undefined }}>{f.current_weight_g}g</td>
                    <td className="p-3 text-right font-mono text-accent">{pct.toFixed(0)}%</td>
                    <td className="p-3 text-gray-500 hidden sm:table-cell">{f.location || '—'}</td>
                    <td className="p-3 text-right">
                      {f.needs_drying && <span className="text-accent2 mr-2" title="Trocknen"><span className="water-icon">💧</span></span>}
                      <button onClick={(e) => { e.stopPropagation(); setWeighFor(f); }} className="text-gray-500 hover:text-accent2 mr-2 icon-btn" title="Wiegen">⚖</button>
                      <button onClick={(e) => { e.stopPropagation(); showStats(f); }} className="text-gray-500 hover:text-success icon-btn" title="Stats">📊</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* === EDIT MODAL === */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Spule bearbeiten' : 'Neue Spule'}>
        {editing && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 mb-2 p-3 bg-blueprint/40 border border-line">
              <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1 font-display">Schnellauswahl ({FILAMENT_PRESETS.length} Vorlagen)</div>
              <select onChange={handlePresetChange} defaultValue="" className="w-full bg-ink border border-line px-3 py-2 text-sm font-body focus:outline-none focus:border-accent">
                <option value="" disabled>Aus Vorlage laden...</option>
                <optgroup label="Bambu Lab">
                  {FILAMENT_PRESETS.filter(p => p.brand === 'Bambu Lab').map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                </optgroup>
                <optgroup label="Polymaker">
                  {FILAMENT_PRESETS.filter(p => p.brand === 'Polymaker').map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                </optgroup>
                <optgroup label="Sunlu">
                  {FILAMENT_PRESETS.filter(p => p.brand === 'Sunlu').map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                </optgroup>
                <optgroup label="Andere">
                  {FILAMENT_PRESETS.filter(p => !['Bambu Lab', 'Polymaker', 'Sunlu'].includes(p.brand)).map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                </optgroup>
              </select>
            </div>

            <Input label="Marke" value={editing.brand} onChange={e => setEditing({ ...editing, brand: e.target.value })} />
            <Select label="Material" value={editing.material} onChange={e => setEditing({ ...editing, material: e.target.value })} options={MATERIALS} />
            <Input label="Farbname" value={editing.color_name} onChange={e => setEditing({ ...editing, color_name: e.target.value })} />
            <div>
              <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1 font-display">Farbe</div>
              <div className="flex gap-2">
                <input type="color" value={editing.color_hex} onChange={e => setEditing({ ...editing, color_hex: e.target.value })} className="h-10 w-16 bg-ink border border-line cursor-pointer" />
                <input type="text" value={editing.color_hex} onChange={e => setEditing({ ...editing, color_hex: e.target.value })} className="flex-1 bg-ink border border-line px-3 py-2 text-sm font-body focus:outline-none focus:border-accent" />
              </div>
            </div>
            <Input label="Durchmesser (mm)" type="number" step="0.05" value={editing.diameter} onChange={e => setEditing({ ...editing, diameter: Number(e.target.value) })} />
            <Input label="Spulengewicht leer (g)" type="number" value={editing.spool_weight_g} onChange={e => setEditing({ ...editing, spool_weight_g: Number(e.target.value) })} />
            <Input label="Startgewicht (g)" type="number" value={editing.initial_weight_g} onChange={e => setEditing({ ...editing, initial_weight_g: Number(e.target.value) })} />
            <Input label="Aktuell (g)" type="number" value={editing.current_weight_g} onChange={e => setEditing({ ...editing, current_weight_g: Number(e.target.value) })} />
            <Input label="Düsentemp (°C)" type="number" value={editing.nozzle_temp || ''} onChange={e => setEditing({ ...editing, nozzle_temp: e.target.value })} />
            <Input label="Bett-Temp (°C)" type="number" value={editing.bed_temp || ''} onChange={e => setEditing({ ...editing, bed_temp: e.target.value })} />
            <Input label="Druckgeschw. (mm/s)" type="number" value={editing.print_speed || ''} onChange={e => setEditing({ ...editing, print_speed: e.target.value })} />
            <Input label="Preis (€)" type="number" step="0.01" value={editing.price || ''} onChange={e => setEditing({ ...editing, price: e.target.value })} />
            <Input label="Kaufdatum" type="date" value={editing.purchase_date || ''} onChange={e => setEditing({ ...editing, purchase_date: e.target.value })} />
            <Input label="Lagerort" value={editing.location || ''} onChange={e => setEditing({ ...editing, location: e.target.value })} />
            <Input label="Shop-URL" value={editing.shop_url || ''} onChange={e => setEditing({ ...editing, shop_url: e.target.value })} />
            <Input label="Zuletzt getrocknet" type="date" value={editing.last_dried || ''} onChange={e => setEditing({ ...editing, last_dried: e.target.value })} />
            <div className="sm:col-span-2">
              <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1 font-display">Notizen</div>
              <textarea value={editing.notes || ''} onChange={e => setEditing({ ...editing, notes: e.target.value })} rows="2" className="w-full bg-ink border border-line px-3 py-2 text-sm font-body focus:outline-none focus:border-accent" />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2 pt-2 border-t border-line">
              <Button variant="ghost" onClick={() => setEditing(null)}>Abbrechen</Button>
              <Button onClick={save}>Speichern</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* === WEIGH MODAL === */}
      <WeighModal open={!!weighFor} onClose={() => setWeighFor(null)} filament={weighFor} onSave={doWeigh} />

      {/* === STATS MODAL === */}
      <Modal open={!!statsFor} onClose={() => { setStatsFor(null); setStats(null); }} title={statsFor ? `STATS // ${statsFor.brand} ${statsFor.color_name}` : ''}>
        {!stats && <div className="text-center py-8 text-gray-500 font-display text-xs">// LADE STATISTIK...</div>}
        {stats && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatBox label="Drucke" value={stats.usage.prints} accent="#ffb800" />
              <StatBox label="Verwendet" value={`${(stats.usage.total_used_g / 1000).toFixed(2)} kg`} accent="#00d9ff" />
              <StatBox label="Erfolg" value={`${stats.usage.success_rate}%`} accent="#00ff88" />
              <StatBox label="Kosten" value={`${stats.usage.total_cost.toFixed(2)} €`} accent="#ff6b00" />
            </div>
            {stats.history.length > 1 && (
              <div className="border border-line p-3">
                <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-2 font-display">Verbrauch über Zeit</div>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={stats.history}>
                    <XAxis dataKey="date" stroke="#666" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} />
                    <YAxis stroke="#666" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} />
                    <Tooltip contentStyle={{ background: '#0d1b2a', border: '1px solid #1e3a5f', fontFamily: 'JetBrains Mono', fontSize: 11 }} />
                    <Line type="monotone" dataKey="used" stroke={statsFor.color_hex} strokeWidth={2} dot={{ fill: statsFor.color_hex }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="border border-line p-3 text-[11px] space-y-1 font-mono">
              <div className="flex justify-between"><span className="text-gray-500">Erste Verwendung:</span><span>{stats.usage.first_use || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Letzte Verwendung:</span><span>{stats.usage.last_use || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Erfolgreiche Drucke:</span><span className="text-success">{stats.usage.success_count}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Fehlgeschlagene Drucke:</span><span className="text-danger">{stats.usage.fail_count}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Druckzeit gesamt:</span><span>{(stats.usage.total_minutes / 60).toFixed(1)} h</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Verbleibend:</span><span className="text-accent">{stats.filament.current_weight_g}g ({stats.filament.length_remaining_m}m)</span></div>
            </div>
          </div>
        )}
      </Modal>

      {/* === QR MODAL === */}
      <Modal open={!!qrFor} onClose={() => setQrFor(null)} title={qrFor ? `QR // ${qrFor.brand} ${qrFor.color_name}` : ''}>
        {qrFor && (
          <div className="space-y-4">
            <div className="bg-white p-6 flex items-center justify-center">
              <img src={api.getFilamentQrUrl(qrFor.id)} alt="QR" className="w-64 h-64" />
            </div>
            <div className="text-xs text-gray-400 text-center">
              Scannen → öffnet die Bearbeitungsseite dieser Spule direkt im Browser
            </div>
            <div className="grid grid-cols-3 gap-2">
              <a href={api.getFilamentQrPngUrl(qrFor.id)} download={`qr-${qrFor.brand}-${qrFor.color_name}.png`} className="text-center py-2 border border-line hover:border-accent text-[10px] font-display uppercase tracking-wider hover:text-accent">↓ PNG</a>
              <a href={api.getFilamentLabelUrl(qrFor.id)} target="_blank" rel="noreferrer" className="text-center py-2 border border-line hover:border-accent2 text-[10px] font-display uppercase tracking-wider hover:text-accent2">🖨 Label</a>
              <a href={api.getFilamentProfileUrl(qrFor.id)} download className="text-center py-2 border border-line hover:border-success text-[10px] font-display uppercase tracking-wider hover:text-success">↓ Profil</a>
            </div>
          </div>
        )}
      </Modal>

      {/* === DELETE CONFIRM === */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Spule löschen?">
        {confirmDelete && (
          <div className="space-y-4">
            <div className="border border-danger bg-danger/10 p-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl">⚠</div>
                <div className="text-sm font-body">
                  „{confirmDelete.brand} {confirmDelete.color_name}" wird unwiderruflich gelöscht.
                  Verknüpfte Drucke bleiben erhalten, verlieren aber die Filament-Referenz.
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Abbrechen</Button>
              <Button variant="danger" onClick={doDelete}>Löschen</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* === DRY CONFIRM === */}
      <Modal open={!!confirmDry} onClose={() => setConfirmDry(null)} title="Als getrocknet markieren?">
        {confirmDry && (
          <div className="space-y-4">
            <div className="border border-accent2 bg-accent2/10 p-4 text-sm font-body">
              „{confirmDry.brand} {confirmDry.color_name}" wird als heute getrocknet markiert.
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button variant="ghost" onClick={() => setConfirmDry(null)}>Abbrechen</Button>
              <Button onClick={doMarkDried}>Bestätigen</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* =========================================================
   FILAMENT CARD — v7 refresh: big color block, hover lift
   ========================================================= */
function FilamentCard({ f, onEdit, onWeigh, onStats, onQr, onDelete, onDry }) {
  const pct = Math.max(0, Math.min(100, (f.current_weight_g / f.initial_weight_g) * 100));
  const low = f.current_weight_g < 150;
  const critical = f.current_weight_g < 50;

  // Determine if the color is very light (for contrast on the color block)
  const isLight = (() => {
    const hex = (f.color_hex || '#000').replace('#', '');
    if (hex.length < 6) return false;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luma > 0.65;
  })();

  return (
    <div className="fila-card lift-in relative bg-blueprint/60 border border-line corner-marks overflow-hidden">
      {/* BIG COLOR BLOCK HEADER */}
      <div
        className="relative h-28 border-b border-line overflow-hidden"
        style={{ background: f.color_hex }}
      >
        {/* Subtle spool-disk decoration */}
        <div
          className="absolute -right-10 -top-10 w-40 h-40 rounded-full border-4 opacity-20"
          style={{ borderColor: isLight ? '#0a0e1a' : '#ffffff' }}
        />
        <div
          className="absolute -right-10 -top-10 w-40 h-40 rounded-full opacity-10"
          style={{ background: `radial-gradient(circle, ${isLight ? '#0a0e1a' : '#ffffff'} 0%, transparent 70%)` }}
        />

        {/* Material badge */}
        <div
          className="absolute top-3 left-3 text-[10px] font-display uppercase tracking-widest px-2 py-0.5 backdrop-blur-sm"
          style={{
            background: isLight ? 'rgba(10,14,26,0.75)' : 'rgba(255,255,255,0.15)',
            color: isLight ? '#ffffff' : '#ffffff',
            border: `1px solid ${isLight ? 'rgba(10,14,26,0.4)' : 'rgba(255,255,255,0.3)'}`,
          }}
        >
          {f.material}
        </div>

        {/* AMS badge */}
        {f.in_ams && (
          <div
            className="absolute top-3 left-3 text-[10px] font-display uppercase tracking-widest px-2 py-0.5 backdrop-blur-sm flex items-center gap-1"
            style={{
              background: 'rgba(168, 85, 247, 0.85)',
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.4)',
              top: '2.3rem',
            }}
            title={`Zugeordnet zu AMS Unit ${f.ams_unit_id} Slot ${f.ams_slot_id}`}
          >
            ⊡ AMS U{f.ams_unit_id}/S{f.ams_slot_id}
          </div>
        )}

        {/* Dry badge (top right) */}
        {f.needs_drying && (
          <div className="absolute top-3 right-3 text-[10px] font-display uppercase tracking-widest px-2 py-1 bg-accent2/90 text-ink border border-accent2 flex items-center gap-1 pulse-soft">
            <span className="water-icon">💧</span> Trocknen
          </div>
        )}

        {/* Critical badge */}
        {critical && !f.needs_drying && (
          <div className="absolute top-3 right-3 text-[10px] font-display uppercase tracking-widest px-2 py-1 bg-danger text-ink border border-danger blink">
            KRITISCH
          </div>
        )}

        {/* Brand + color name overlaid at bottom of color block */}
        <div
          className="absolute bottom-0 left-0 right-0 px-4 py-2 backdrop-blur-sm"
          style={{
            background: isLight ? 'rgba(10,14,26,0.55)' : 'rgba(0,0,0,0.35)',
          }}
        >
          <div className="font-display text-sm uppercase tracking-wide text-white truncate">{f.brand}</div>
          <div className="text-[10px] text-white/80 truncate">{f.color_name}</div>
        </div>
      </div>

      <div className="p-4">
        {/* Progress section */}
        <div>
          <div className="flex justify-between items-baseline text-[10px] font-display uppercase mb-1.5">
            <span className="text-gray-500">Bestand</span>
            <span className={low ? 'text-danger blink' : 'text-accent'}>
              <span className="text-sm font-bold">{f.current_weight_g}</span>
              <span className="text-gray-600"> / {f.initial_weight_g}g</span>
            </span>
          </div>
          <div className="h-3 bg-ink border border-line relative overflow-hidden">
            <div
              className="h-full transition-all duration-700 ease-out relative"
              style={{
                width: `${pct}%`,
                background: low ? '#ff3860' : f.color_hex,
              }}
            >
              {!low && pct > 5 && <div className="absolute inset-0 progress-shine" />}
            </div>
          </div>
          <div className="flex justify-between text-[10px] text-gray-500 mt-1">
            <span className="font-mono">{pct.toFixed(0)}%</span>
            {f.length_remaining_m > 0 && <span className="text-accent2 font-mono">≈ {f.length_remaining_m}m</span>}
          </div>
        </div>

        {/* Temp chips */}
        {(f.nozzle_temp || f.bed_temp || f.print_speed) && (
          <div className="mt-3 flex gap-1.5 flex-wrap text-[10px] font-display">
            {f.nozzle_temp && <span className="border border-line px-2 py-1 text-accent2">N {f.nozzle_temp}°</span>}
            {f.bed_temp && <span className="border border-line px-2 py-1 text-accent">B {f.bed_temp}°</span>}
            {f.print_speed && <span className="border border-line px-2 py-1 text-success">{f.print_speed}mm/s</span>}
            {f.is_hygroscopic && f.days_since_dried !== null && f.days_since_dried !== undefined && (
              <span className={`border px-2 py-1 ${f.needs_drying ? 'border-accent2 text-accent2' : 'border-line text-gray-500'}`}>
                💧 {f.days_since_dried}d
              </span>
            )}
          </div>
        )}

        {f.location && (
          <div className="mt-2 text-[10px] text-gray-500 flex items-center gap-1">
            <span>▸</span> <span className="truncate">{f.location}</span>
          </div>
        )}

        {/* Action bar — always visible on mobile, hover on desktop */}
        <div className="mt-4 grid grid-cols-5 gap-1 sm:opacity-60 sm:group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="icon-btn text-[11px] font-display uppercase tracking-wider py-2 border border-line hover:border-accent hover:text-accent transition-colors" title="Bearbeiten">✎</button>
          <button onClick={onWeigh} className="icon-btn text-[11px] font-display uppercase tracking-wider py-2 border border-line hover:border-accent2 hover:text-accent2 transition-colors" title="Spule wiegen">⚖</button>
          <button onClick={onStats} className="icon-btn text-[11px] font-display uppercase tracking-wider py-2 border border-line hover:border-success hover:text-success transition-colors" title="Statistik">📊</button>
          <button onClick={onQr} className="icon-btn text-[10px] font-display uppercase tracking-wider py-2 border border-line hover:border-accent hover:text-accent transition-colors" title="QR-Code">QR</button>
          <button onClick={onDelete} className="icon-btn text-[11px] font-display uppercase tracking-wider py-2 border border-line hover:border-danger hover:text-danger transition-colors" title="Löschen">✕</button>
        </div>

        {f.is_hygroscopic && (
          <button onClick={onDry} className="mt-2 w-full text-[10px] font-display uppercase tracking-widest py-2 border border-line hover:border-accent2 hover:text-accent2 text-gray-500 transition-colors flex items-center justify-center gap-2">
            <span className="water-icon">💧</span> Als getrocknet markieren
          </button>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, accent }) {
  return (
    <div className="border border-line p-3 relative">
      <div className="absolute top-0 left-0 w-6 h-px" style={{ background: accent }} />
      <div className="text-[9px] uppercase tracking-widest text-gray-500 font-display">{label}</div>
      <div className="text-lg font-display mt-1" style={{ color: accent }}>{value}</div>
    </div>
  );
}

function WeighModal({ open, onClose, filament, onSave }) {
  const [total, setTotal] = useState('');
  useEffect(() => { if (open && filament) setTotal(String(filament.current_weight_g + filament.spool_weight_g)); }, [open, filament]);
  if (!filament) return null;
  const filamentG = total ? Math.max(0, Math.round(Number(total) - filament.spool_weight_g)) : 0;
  return (
    <Modal open={open} onClose={onClose} title={`SPULE WIEGEN // ${filament.brand} ${filament.color_name}`}>
      <div className="space-y-4">
        <div className="text-xs text-gray-400 space-y-2">
          <p>Stell die ganze Spule (Filament + Kern) auf eine Küchenwaage und gib das Gesamtgewicht in Gramm ein.</p>
          <p>Filawatch rechnet automatisch das reine Filament-Gewicht aus indem es das Leergewicht der Spule abzieht.</p>
        </div>
        <div className="border border-line p-3 text-[11px] font-mono space-y-1">
          <div className="flex justify-between"><span className="text-gray-500">Leergewicht der Spule:</span><span>{filament.spool_weight_g}g</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Aktuell gespeichert:</span><span>{filament.current_weight_g}g</span></div>
        </div>
        <Input label="Gesamtgewicht jetzt (g)" type="number" value={total} onChange={e => setTotal(e.target.value)} autoFocus />
        <div className="border border-line p-3 bg-blueprint/40">
          <div className="text-[10px] uppercase tracking-widest text-gray-500 font-display">Berechnetes Filament-Gewicht</div>
          <div className="text-2xl font-display text-accent mt-1">{filamentG} g</div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-line">
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button onClick={() => onSave(total)} disabled={!total}>Speichern</Button>
        </div>
      </div>
    </Modal>
  );
}
