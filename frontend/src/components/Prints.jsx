import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { Panel, Button, Input, Select, Modal } from './ui.jsx';
import { useToast } from '../ToastContext.jsx';

const empty = {
  title: '', filament_id: '',
  weight_used_g: 0, duration_minutes: 0, status: 'success', notes: '',
};

export default function Prints() {
  const [list, setList] = useState([]);
  const [filaments, setFilaments] = useState([]);
  const [adding, setAdding] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [photoEditFor, setPhotoEditFor] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmPhotoDelete, setConfirmPhotoDelete] = useState(null);
  const fileInput = useRef(null);
  const toast = useToast();

  const load = async () => {
    try {
      const [prints, fils] = await Promise.all([api.listPrints(), api.listFilaments()]);
      setList(prints);
      setFilaments(fils);
    } catch (e) {
      toast.error(e.message);
    }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      const data = {
        ...adding,
        weight_used_g: Number(adding.weight_used_g),
        duration_minutes: Number(adding.duration_minutes),
      };
      await api.createPrint(data);
      toast.success('Druck protokolliert');
      setAdding(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    try {
      await api.deletePrint(confirmDelete.id);
      toast.success('Druck gelöscht');
      setConfirmDelete(null);
      if (viewing && viewing.id === confirmDelete.id) setViewing(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const uploadPhoto = async (printId, file) => {
    if (!file) return;
    try {
      await api.uploadPrintPhoto(printId, file);
      toast.success('Foto hochgeladen');
      setPhotoEditFor(null);
      await load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const doDeletePhoto = async () => {
    if (!confirmPhotoDelete) return;
    try {
      await api.deletePrintPhoto(confirmPhotoDelete.id);
      toast.success('Foto gelöscht');
      setConfirmPhotoDelete(null);
      setPhotoEditFor(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const uploadFile = async (printId, file) => {
    if (!file) return;
    try {
      await api.uploadPrintFile(printId, file);
      toast.success('Datei hochgeladen');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setAdding({ ...empty })}>+ Druck protokollieren</Button>
      </div>

      <Panel title="DRUCK-HISTORIE" accent="#00ff88">
        {list.length === 0 ? (
          <div className="text-gray-500 text-xs text-center py-12">// NOCH KEINE DRUCKE PROTOKOLLIERT</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.map(p => (
              <div key={p.id} className="border border-line bg-blueprint/40 corner-marks group relative">
                <div className="cursor-pointer" onClick={() => setViewing(p)}>
                  {p.image_path ? (
                    <div className="aspect-video bg-ink overflow-hidden">
                      <img src={p.image_path} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="aspect-video bg-ink flex items-center justify-center text-gray-700 font-display text-xs">
                      [ NO IMAGE ]
                    </div>
                  )}
                </div>
                {/* Foto-Edit-Button always visible */}
                <button
                  onClick={(e) => { e.stopPropagation(); setPhotoEditFor(p); }}
                  className="absolute top-2 right-2 icon-btn w-9 h-9 flex items-center justify-center bg-ink/80 border border-line hover:border-accent hover:text-accent text-xs backdrop-blur-sm"
                  title="Foto bearbeiten"
                >
                  📷
                </button>
                <div className="p-3 cursor-pointer" onClick={() => setViewing(p)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-display text-sm truncate">{p.title}</div>
                      <div className="text-[10px] text-gray-500 font-display">
                        {new Date(p.started_at).toLocaleDateString('de-DE')}
                        {p.auto_logged ? ' · 🤖 AUTO' : ''}
                      </div>
                    </div>
                    <span className={`text-[10px] font-display ${p.status === 'success' ? 'text-success' : 'text-danger'}`}>
                      {p.status === 'success' ? '✓' : '✗'}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] font-display">
                    <div className="flex items-center gap-2">
                      {p.filament_hex && <div className="w-3 h-3 border border-line" style={{ background: p.filament_hex }} />}
                      <span className="text-gray-400 truncate">{p.filament_brand || '—'}</span>
                    </div>
                    <span className="text-accent">{p.weight_used_g}g</span>
                  </div>
                  {p.user_display_name && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="w-4 h-4 flex items-center justify-center text-[8px] font-display font-bold border border-line" style={{ background: p.user_avatar_color || '#666', color: '#0a0e1a' }}>
                        {p.user_display_name[0]}
                      </div>
                      <span className="text-[10px] text-gray-500">{p.user_display_name}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Add Modal */}
      <Modal open={!!adding} onClose={() => setAdding(null)} title="Druck protokollieren">
        {adding && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Input label="Titel" value={adding.title} onChange={e => setAdding({ ...adding, title: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1 font-display">Filament</div>
              <select
                value={adding.filament_id}
                onChange={e => setAdding({ ...adding, filament_id: e.target.value })}
                className="w-full bg-ink border border-line px-3 py-2 text-sm font-body focus:outline-none focus:border-accent"
              >
                <option value="">— wählen —</option>
                {filaments.map(f => (
                  <option key={f.id} value={f.id}>{f.brand} {f.material} {f.color_name} ({f.current_weight_g}g)</option>
                ))}
              </select>
            </div>
            <Input label="Verbrauch (g)" type="number" value={adding.weight_used_g} onChange={e => setAdding({ ...adding, weight_used_g: e.target.value })} />
            <Input label="Dauer (Minuten)" type="number" value={adding.duration_minutes} onChange={e => setAdding({ ...adding, duration_minutes: e.target.value })} />
            <Select label="Status" value={adding.status} onChange={e => setAdding({ ...adding, status: e.target.value })} options={['success', 'failed']} />
            <div className="sm:col-span-2">
              <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1 font-display">Notizen</div>
              <textarea value={adding.notes || ''} onChange={e => setAdding({ ...adding, notes: e.target.value })} rows="2" className="w-full bg-ink border border-line px-3 py-2 text-sm font-body focus:outline-none focus:border-accent" />
            </div>
            <div className="sm:col-span-2 text-[10px] text-gray-500">
              Nach dem Speichern kannst du Foto und STL-Datei hochladen.
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2 pt-2 border-t border-line">
              <Button variant="ghost" onClick={() => setAdding(null)}>Abbrechen</Button>
              <Button onClick={save}>Speichern</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* View Modal */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.title || ''}>
        {viewing && (
          <div className="space-y-4">
            {viewing.image_path && (
              <div className="relative group">
                <img src={viewing.image_path} alt="" className="w-full max-h-96 object-contain bg-ink border border-line" />
                <button
                  onClick={() => { setViewing(null); setPhotoEditFor(viewing); }}
                  className="absolute top-2 right-2 icon-btn px-3 py-2 bg-ink/80 border border-line hover:border-accent hover:text-accent text-xs backdrop-blur-sm font-display uppercase tracking-wider"
                >
                  ✎ Foto bearbeiten
                </button>
              </div>
            )}
            {!viewing.image_path && (
              <button
                onClick={() => { setViewing(null); setPhotoEditFor(viewing); }}
                className="w-full aspect-video bg-ink border border-dashed border-line flex flex-col items-center justify-center hover:border-accent hover:text-accent transition-colors"
              >
                <div className="text-3xl opacity-50">📷</div>
                <div className="text-[10px] font-display uppercase tracking-widest text-gray-500 mt-2">Foto hinzufügen</div>
              </button>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <Field label="Datum" value={new Date(viewing.started_at).toLocaleString('de-DE')} />
              <Field label="Wer" value={viewing.user_display_name || '—'} />
              <Field label="Verbrauch" value={`${viewing.weight_used_g}g`} />
              <Field label="Dauer" value={`${Math.floor(viewing.duration_minutes / 60)}h ${viewing.duration_minutes % 60}m`} />
              <Field label="Filament" value={viewing.filament_brand ? `${viewing.filament_brand} ${viewing.filament_color}` : '—'} />
              <Field label="Status" value={viewing.status} color={viewing.status === 'success' ? '#00ff88' : '#ff3860'} />
              {(viewing.cost_material > 0 || viewing.cost_power > 0) && (
                <>
                  <Field label="Material-Kosten" value={`${(viewing.cost_material || 0).toFixed(2)} €`} color="#ffb800" />
                  <Field label="Strom-Kosten" value={`${(viewing.cost_power || 0).toFixed(2)} €`} color="#ff6b00" />
                </>
              )}
              {viewing.notes && <div className="sm:col-span-2"><Field label="Notizen" value={viewing.notes} /></div>}
              {viewing.file_path && (
                <div className="sm:col-span-2">
                  <a href={viewing.file_path} download className="text-accent2 text-xs hover:underline">▸ Druckdatei herunterladen</a>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 pt-3 border-t border-line">
              <input ref={fileInput} type="file" accept=".stl,.3mf,.gcode,.obj,.step,.stp" hidden onChange={e => { uploadFile(viewing.id, e.target.files?.[0]); e.target.value = ''; }} />
              <Button variant="ghost" onClick={() => fileInput.current?.click()}>📁 STL/3MF hochladen</Button>
              <div className="flex-1" />
              <Button variant="danger" onClick={() => setConfirmDelete(viewing)}>Löschen</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Photo Edit Modal */}
      <PhotoEditModal
        open={!!photoEditFor}
        print={photoEditFor}
        onClose={() => setPhotoEditFor(null)}
        onUpload={(file) => uploadPhoto(photoEditFor.id, file)}
        onDelete={() => setConfirmPhotoDelete(photoEditFor)}
      />

      {/* Confirm Delete Print */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Druck löschen?">
        {confirmDelete && (
          <div className="space-y-4">
            <div className="border border-danger bg-danger/10 p-4 text-sm font-body">
              „{confirmDelete.title}" wird unwiderruflich gelöscht, inklusive Foto und angehängter Datei.
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Abbrechen</Button>
              <Button variant="danger" onClick={doDelete}>Löschen</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm Delete Photo */}
      <Modal open={!!confirmPhotoDelete} onClose={() => setConfirmPhotoDelete(null)} title="Foto löschen?">
        {confirmPhotoDelete && (
          <div className="space-y-4">
            <div className="border border-danger bg-danger/10 p-4 text-sm font-body">
              Das Foto von „{confirmPhotoDelete.title}" wird gelöscht. Der Druck-Eintrag bleibt erhalten.
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button variant="ghost" onClick={() => setConfirmPhotoDelete(null)}>Abbrechen</Button>
              <Button variant="danger" onClick={doDeletePhoto}>Foto löschen</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function PhotoEditModal({ open, print, onClose, onUpload, onDelete }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  if (!print) return null;

  const handleFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    onUpload(file);
  };

  return (
    <Modal open={open} onClose={onClose} title={`FOTO // ${print.title}`}>
      <div className="space-y-4">
        {print.image_path && (
          <div>
            <div className="text-[10px] uppercase tracking-widest text-gray-500 font-display mb-2">Aktuelles Foto</div>
            <img src={print.image_path} alt="" className="w-full max-h-64 object-contain bg-ink border border-line" />
          </div>
        )}

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
            dragOver ? 'border-accent bg-accent/10' : 'border-line hover:border-accent hover:bg-ink/40'
          }`}
        >
          <div className="text-5xl mb-2 opacity-60">📷</div>
          <div className="font-display text-xs uppercase tracking-widest text-gray-400">
            {print.image_path ? 'Neues Foto hochladen' : 'Foto hochladen'}
          </div>
          <div className="text-[10px] text-gray-600 mt-1 font-body">
            Datei hierher ziehen oder klicken zum Auswählen
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }}
          />
        </div>

        <div className="flex justify-between gap-2 pt-2 border-t border-line">
          <div>
            {print.image_path && (
              <Button variant="danger" onClick={onDelete}>Foto löschen</Button>
            )}
          </div>
          <Button variant="ghost" onClick={onClose}>Schließen</Button>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, value, color }) {
  return (
    <div className="border border-line p-2">
      <div className="text-[9px] uppercase tracking-widest text-gray-500 font-display">{label}</div>
      <div className="font-body" style={{ color: color || 'var(--text)' }}>{value}</div>
    </div>
  );
}
