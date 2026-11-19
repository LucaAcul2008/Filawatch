import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Panel } from './ui.jsx';

const ACTION_LABELS = {
  filament_added: { icon: '+', label: 'hat Filament hinzugefügt', color: '#00ff88' },
  filament_deleted: { icon: '×', label: 'hat Filament gelöscht', color: '#ff3860' },
  print_logged: { icon: '▸', label: 'hat Druck protokolliert', color: '#00d9ff' },
  user_created: { icon: '👤', label: 'hat User erstellt', color: '#a855f7' },
};

export default function ActivityFeed({ limit = 20, compact = false }) {
  const [items, setItems] = useState([]);

  const load = () => api.getActivity(limit).then(setItems);
  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [limit]);

  if (items.length === 0) {
    return <div className="text-gray-500 text-xs text-center py-6 font-display">// KEINE AKTIVITÄT</div>;
  }

  return (
    <div className="space-y-1.5">
      {items.map(a => {
        const cfg = ACTION_LABELS[a.action] || { icon: '•', label: a.action, color: '#666' };
        const time = new Date(a.created_at);
        const ago = formatAgo(time);
        return (
          <div key={a.id} className="flex items-center gap-3 p-2 border border-line bg-ink/40 text-xs">
            <div className="w-6 h-6 flex items-center justify-center border border-line shrink-0 font-display font-bold" style={{ background: a.avatar_color || '#333', color: '#0a0e1a' }}>
              {(a.user_name || '?')[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0 truncate">
              <span className="text-gray-300">{a.user_name || 'System'}</span>
              <span className="text-gray-500 mx-1">{cfg.label}</span>
              {a.target && <span style={{ color: cfg.color }}>{a.target}</span>}
              {a.detail && !compact && <span className="text-gray-600 ml-2">· {a.detail}</span>}
            </div>
            <div className="text-[10px] text-gray-600 font-display shrink-0">{ago}</div>
          </div>
        );
      })}
    </div>
  );
}

function formatAgo(date) {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return 'gerade';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return date.toLocaleDateString('de-DE');
}
