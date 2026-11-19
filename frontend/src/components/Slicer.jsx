import React, { useEffect, useState, useRef } from 'react';
import { api } from '../api.js';
import { Panel, Button, Modal } from './ui.jsx';

export default function Slicer() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [parsing, setParsing] = useState(false);
  const fileInput = useRef(null);

  const load = () => api.list3mf().then(setFiles).catch(() => setFiles([]));
  useEffect(() => { load(); }, []);

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.3mf') && !file.name.toLowerCase().endsWith('.gcode.3mf')) {
      alert('Bitte eine .3mf-Datei hochladen (von Bambu Studio exportiert)');
      return;
    }
    setUploading(true);
    setParsing(true);
    try {
      const result = await api.parse3mf(file);
      setSelected(result);
      load();
    } catch (err) {
      alert('Fehler: ' + err.message);
    } finally {
      setUploading(false);
      setParsing(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const openFile = async (id) => {
    setParsing(true);
    setSelected(null);
    try {
      const result = await api.get3mf(id);
      setSelected(result);
    } catch (err) {
      alert('Fehler: ' + err.message);
    } finally {
      setParsing(false);
    }
  };

  const deleteFile = async (id) => {
    if (!confirm('Wirklich löschen?')) return;
    await api.delete3mf(id);
    if (selected?.file_id === id) setSelected(null);
    load();
  };

  return (
    <div className="space-y-6">
      <Panel title="3MF UPLOAD // SLICER INTEGRATION" accent="#a855f7">
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={onDrop}
          className="border-2 border-dashed border-line p-8 text-center hover:border-accent2 cursor-pointer transition-colors"
          onClick={() => fileInput.current?.click()}
        >
          <input ref={fileInput} type="file" accept=".3mf" hidden onChange={e => handleFile(e.target.files[0])} />
          {uploading ? (
            <div className="font-display text-sm text-accent2 blink">// PARSING 3MF...</div>
          ) : (
            <>
              <div className="font-display text-sm uppercase mb-2">▾ 3MF hier ablegen oder klicken</div>
              <div className="text-xs text-gray-500">
                Aus Bambu Studio: <span className="text-accent">Datei → Exportieren → Bambu Studio 3MF (.3mf)</span>
              </div>
            </>
          )}
        </div>
      </Panel>

      {files.length > 0 && (
        <Panel title={`HOCHGELADENE FILES [ ${String(files.length).padStart(2, '0')} ]`} accent="#00d9ff">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {files.map(f => (
              <div key={f.id} className="border border-line p-3 hover:border-accent2 cursor-pointer group" onClick={() => openFile(f.id)}>
                <div className="font-display text-xs uppercase truncate">{f.original_name}</div>
                <div className="text-[10px] text-gray-500 mt-1">
                  {(f.file_size / 1024 / 1024).toFixed(1)} MB · {f.uploaded_by_name || '—'}
                </div>
                {f.metadata && (
                  <div className="text-[10px] text-accent2 mt-1">
                    {f.metadata.estimated_time_text && `⏱ ${f.metadata.estimated_time_text}`}
                    {f.metadata.total_filament_used_g && ` · ${f.metadata.total_filament_used_g.toFixed(0)}g`}
                  </div>
                )}
                <button
                  onClick={e => { e.stopPropagation(); deleteFile(f.id); }}
                  className="opacity-0 group-hover:opacity-100 mt-2 text-[9px] text-danger hover:underline"
                >
                  Löschen
                </button>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Modal open={!!selected || parsing} onClose={() => setSelected(null)} title={selected?.original_name || '3MF DETAILS'}>
        {parsing && <div className="text-center py-8 text-gray-500 font-display text-xs">// PARSE 3MF...</div>}
        {selected && (
          <div className="space-y-4">
            {selected.preview && (
              <div className="border border-line bg-ink p-2">
                <img src={selected.preview} alt="Preview" className="w-full max-h-96 object-contain mx-auto" />
              </div>
            )}

            {selected.plates && selected.plates.length > 1 && (
              <div className="text-[10px] text-gray-500 font-display uppercase">
                {selected.plates.length} Platten in diesem Projekt
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <MetaCell label="Druckzeit" value={selected.metadata?.estimated_time_text} accent="#ffb800" />
              <MetaCell label="Filament" value={selected.metadata?.total_filament_used_g ? `${selected.metadata.total_filament_used_g.toFixed(1)} g` : null} accent="#00d9ff" />
              <MetaCell label="Schichten" value={selected.metadata?.layer_count} accent="#a855f7" />
              <MetaCell label="Schichthöhe" value={selected.metadata?.layer_height ? `${selected.metadata.layer_height} mm` : null} accent="#00ff88" />
              <MetaCell label="Düse" value={selected.metadata?.nozzle_temperature ? `${selected.metadata.nozzle_temperature}°C` : null} accent="#ff6b00" />
              <MetaCell label="Bett" value={selected.metadata?.bed_temperature ? `${selected.metadata.bed_temperature}°C` : null} accent="#ff6b00" />
              <MetaCell label="Bett-Typ" value={selected.metadata?.bed_type} accent="#666" />
              <MetaCell label="Drucker" value={selected.metadata?.printer_model} accent="#666" />
            </div>

            {selected.metadata?.filament_per_extruder?.length > 0 && (
              <div className="border border-line p-3">
                <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-2 font-display">Filament-Verbrauch pro Slot</div>
                <div className="space-y-1">
                  {selected.metadata.filament_per_extruder.map((fil, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <div className="w-4 h-4 border border-line" style={{ background: fil.color || '#888' }} />
                      <div className="flex-1">{fil.type || `Slot ${fil.id}`}</div>
                      <div className="text-accent2 font-mono">{fil.used_g.toFixed(1)}g</div>
                      <div className="text-gray-500 font-mono w-16 text-right">{fil.used_m.toFixed(1)}m</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-line pt-4 space-y-2">
              <div className="text-[10px] uppercase tracking-widest text-gray-500 font-display">Aktionen</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <a
                  href={api.threemfDownloadUrl(selected.file_id)}
                  download={selected.original_name}
                  className="text-center py-2 border border-line hover:border-accent text-[10px] font-display uppercase tracking-wider hover:text-accent"
                >
                  ↓ DOWNLOAD
                </a>
                <BambuConnectButton fileId={selected.file_id} />
              </div>
              <div className="text-[10px] text-gray-500 mt-2">
                ℹ <span className="text-accent">"Print via Bambu Connect"</span> öffnet die Datei in Bambu Connect — du klickst dort einmal auf Print, dann startet der Druck.
                Bambu Connect muss installiert sein. Funktioniert nur wenn Filawatch auf dem gleichen Rechner läuft.
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function MetaCell({ label, value, accent }) {
  if (!value) return null;
  return (
    <div className="border border-line p-2">
      <div className="text-[9px] uppercase tracking-widest text-gray-500 font-display">{label}</div>
      <div className="text-sm font-display mt-1" style={{ color: accent }}>{value}</div>
    </div>
  );
}

function BambuConnectButton({ fileId }) {
  const [loading, setLoading] = useState(false);
  const click = async () => {
    setLoading(true);
    try {
      const { url } = await api.bambuConnectUrl(fileId);
      // URL-Scheme öffnen — Browser startet Bambu Connect
      window.location.href = url;
    } catch (err) {
      alert('Fehler: ' + err.message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <button
      onClick={click}
      disabled={loading}
      className="text-center py-2 border border-line hover:border-success text-[10px] font-display uppercase tracking-wider hover:text-success"
    >
      {loading ? '// LADE...' : '🖨 Print via Bambu Connect'}
    </button>
  );
}
