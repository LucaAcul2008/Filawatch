import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { Panel } from './ui.jsx';

const MONTHS_DE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const DAYS_DE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export default function Calendar() {
  const [date, setDate] = useState(new Date());
  const [prints, setPrints] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);

  const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

  useEffect(() => {
    api.getCalendar(month).then(setPrints);
  }, [month]);

  // Drucke nach Tag gruppieren
  const byDay = useMemo(() => {
    const map = {};
    for (const p of prints) {
      const day = new Date(p.started_at).getDate();
      if (!map[day]) map[day] = [];
      map[day].push(p);
    }
    return map;
  }, [prints]);

  // Kalender-Grid berechnen (Mo-So)
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const startWeekday = (firstDay.getDay() + 6) % 7; // Montag = 0
  const daysInMonth = lastDay.getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prev = () => setDate(new Date(date.getFullYear(), date.getMonth() - 1, 1));
  const next = () => setDate(new Date(date.getFullYear(), date.getMonth() + 1, 1));
  const today = new Date();
  const isToday = (d) => d === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();

  return (
    <Panel title="DRUCK-KALENDER" accent="#a855f7">
      <div className="flex items-center justify-between mb-4">
        <button onClick={prev} className="text-accent2 hover:text-accent font-display text-xs px-3 py-1 border border-line">◀ PREV</button>
        <div className="font-display text-sm uppercase tracking-widest text-accent">
          {MONTHS_DE[date.getMonth()]} {date.getFullYear()}
        </div>
        <button onClick={next} className="text-accent2 hover:text-accent font-display text-xs px-3 py-1 border border-line">NEXT ▶</button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {DAYS_DE.map(d => (
          <div key={d} className="text-center text-[10px] font-display uppercase text-gray-600">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const dayPrints = byDay[d] || [];
          const hasFails = dayPrints.some(p => p.status !== 'success');
          return (
            <button
              key={i}
              onClick={() => dayPrints.length > 0 && setSelectedDay(d)}
              className={`aspect-square border ${isToday(d) ? 'border-accent' : 'border-line'} ${dayPrints.length > 0 ? 'bg-blueprint/60 hover:bg-blueprint cursor-pointer' : 'bg-ink/30'} p-1 flex flex-col items-center justify-between`}
            >
              <div className={`text-[10px] font-display ${isToday(d) ? 'text-accent' : 'text-gray-400'}`}>{d}</div>
              {dayPrints.length > 0 && (
                <div className="flex flex-wrap gap-0.5 justify-center">
                  {dayPrints.slice(0, 4).map((p, idx) => (
                    <div key={idx} className="w-1.5 h-1.5" style={{ background: p.filament_hex || (p.status === 'success' ? '#00ff88' : '#ff3860') }} />
                  ))}
                  {dayPrints.length > 4 && <div className="text-[8px] text-gray-500">+{dayPrints.length - 4}</div>}
                </div>
              )}
              {hasFails && <div className="text-[8px] text-danger">!</div>}
            </button>
          );
        })}
      </div>

      {selectedDay && byDay[selectedDay] && (
        <div className="mt-4 border-t border-line pt-4">
          <div className="font-display text-xs uppercase text-accent mb-2">
            ▸ {selectedDay}. {MONTHS_DE[date.getMonth()]} ({byDay[selectedDay].length} Drucke)
          </div>
          <div className="space-y-1">
            {byDay[selectedDay].map(p => (
              <div key={p.id} className="flex items-center gap-2 text-xs border border-line p-2 bg-ink/40">
                {p.filament_hex && <div className="w-3 h-3 border border-line shrink-0" style={{ background: p.filament_hex }} />}
                <div className="flex-1 min-w-0 truncate">{p.title}</div>
                <span className="text-gray-500">{p.weight_used_g}g</span>
                <span className={`text-[10px] font-display ${p.status === 'success' ? 'text-success' : 'text-danger'}`}>
                  {p.status === 'success' ? '✓' : '✗'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 text-[10px] text-gray-500 font-display uppercase">
        // {prints.length} Drucke in diesem Monat
      </div>
    </Panel>
  );
}
