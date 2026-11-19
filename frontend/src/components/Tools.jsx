import React, { useState } from 'react';
import Calendar from './Calendar.jsx';
import Gallery from './Gallery.jsx';
import Maintenance from './Maintenance.jsx';

const SUBTABS = [
  { id: 'gallery', label: 'GALERIE' },
  { id: 'calendar', label: 'KALENDER' },
  { id: 'maintenance', label: 'WARTUNG' },
];

export default function Tools() {
  const [tab, setTab] = useState('gallery');

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-line">
        {SUBTABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 font-display text-[11px] uppercase tracking-widest transition-colors ${
              tab === t.id ? 'text-accent border-b-2 border-accent -mb-px' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'gallery' && <Gallery />}
      {tab === 'calendar' && <Calendar />}
      {tab === 'maintenance' && <Maintenance />}
    </div>
  );
}
