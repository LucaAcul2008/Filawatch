import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Panel } from './ui.jsx';

export default function Gallery() {
  const [items, setItems] = useState([]);
  const [viewing, setViewing] = useState(null);

  useEffect(() => { api.getGallery().then(setItems); }, []);

  if (items.length === 0) {
    return (
      <Panel title="GALERIE" accent="#00d9ff">
        <div className="text-center py-12 text-gray-500 font-display text-xs">
          // NOCH KEINE FOTOS HOCHGELADEN<br />
          <span className="text-[10px]">Lade Fotos zu deinen Drucken hoch um sie hier zu sehen</span>
        </div>
      </Panel>
    );
  }

  return (
    <Panel title={`GALERIE // ${items.length} WERKE`} accent="#00d9ff">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map(p => (
          <button
            key={p.id}
            onClick={() => setViewing(p)}
            className="group relative aspect-square overflow-hidden border border-line bg-ink"
          >
            <img src={p.image_path} alt={p.title} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-transparent opacity-80 group-hover:opacity-100 transition-opacity" />
            <div className="absolute bottom-0 left-0 right-0 p-2 text-left">
              <div className="text-[10px] font-display text-accent truncate">{p.title}</div>
              <div className="text-[9px] text-gray-400 flex items-center gap-1">
                {p.filament_hex && <div className="w-2 h-2 border border-line" style={{ background: p.filament_hex }} />}
                <span>{p.weight_used_g}g · {Math.floor(p.duration_minutes / 60)}h</span>
              </div>
            </div>
            {p.user_avatar_color && (
              <div className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center text-[9px] font-display font-bold border border-line" style={{ background: p.user_avatar_color, color: '#0a0e1a' }}>
                {p.user_display_name?.[0]?.toUpperCase()}
              </div>
            )}
          </button>
        ))}
      </div>

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/95 backdrop-blur-sm" onClick={() => setViewing(null)}>
          <div className="max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            <img src={viewing.image_path} alt="" className="w-full max-h-[80vh] object-contain border border-line" />
            <div className="bg-blueprint border border-line border-t-0 p-4">
              <div className="font-display text-lg text-accent">{viewing.title}</div>
              <div className="text-xs text-gray-400 mt-1">
                {new Date(viewing.started_at).toLocaleString('de-DE')} · {viewing.user_display_name}
                · {viewing.weight_used_g}g · {Math.floor(viewing.duration_minutes / 60)}h{viewing.duration_minutes % 60}m
              </div>
              <button onClick={() => setViewing(null)} className="absolute top-4 right-4 text-2xl text-gray-400 hover:text-accent">×</button>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}
