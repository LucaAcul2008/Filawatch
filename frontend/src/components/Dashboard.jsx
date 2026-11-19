import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Panel, Stat } from './ui.jsx';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, Legend } from 'recharts';
import ActivityFeed from './ActivityFeed.jsx';

const MATERIAL_COLORS = {
  PLA: '#00d9ff',
  PETG: '#00ff88',
  ABS: '#ff3860',
  TPU: '#ffb800',
  ASA: '#ff6b00',
  PC: '#a855f7',
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [monthly, setMonthly] = useState([]);

  useEffect(() => {
    api.getStats().then(setStats);
    api.getMonthlyStats(6).then(setMonthly);
    const t = setInterval(() => {
      api.getStats().then(setStats);
      api.getMonthlyStats(6).then(setMonthly);
    }, 30000);
    return () => clearInterval(t);
  }, []);

  if (!stats) return <div className="text-gray-500 font-display text-xs">// LOADING TELEMETRY...</div>;

  const pieData = stats.byMaterial.map(m => ({
    name: m.material,
    value: m.grams || 0,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Stat label="Spulen" value={stats.totalFilaments} unit="aktiv" />
        <Stat label="Filament" value={(stats.totalGramsLeft / 1000).toFixed(2)} unit="kg" accent="#00d9ff" />
        <Stat label="Drucke" value={stats.totalPrints} unit="ges." accent="#00ff88" />
        <Stat label="Verbraucht" value={(stats.totalGramsUsed / 1000).toFixed(2)} unit="kg" accent="#ff6b00" />
        <Stat label="Druckzeit" value={stats.totalHours} unit="h" accent="#a855f7" />
        <Stat label="Druckkosten" value={((stats.costMaterial || 0) + (stats.costPower || 0)).toFixed(2)} unit="€" accent="#ff3860" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Panel title="MAT.VERTEILUNG" accent="#00d9ff" className="lg:col-span-1">
          {pieData.length === 0 ? (
            <div className="text-gray-500 text-xs text-center py-12">// KEINE DATEN</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" innerRadius={50} outerRadius={90} stroke="#0a0e1a" strokeWidth={2}>
                  {pieData.map((d, i) => (
                    <Cell key={i} fill={MATERIAL_COLORS[d.name] || '#666'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#0d1b2a', border: '1px solid #1e3a5f', fontFamily: 'JetBrains Mono', fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="mt-2 space-y-1">
            {pieData.map(d => (
              <div key={d.name} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 inline-block" style={{ background: MATERIAL_COLORS[d.name] || '#666' }} />
                  <span className="font-display">{d.name}</span>
                </div>
                <span className="text-gray-400">{(d.value / 1000).toFixed(2)} kg</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="LOW STOCK ALERT" accent="#ff3860" className="lg:col-span-1">
          {stats.lowStock.length === 0 ? (
            <div className="text-success text-xs py-8 text-center font-display">
              ✓ ALLE BESTÄNDE OK
            </div>
          ) : (
            <div className="space-y-2">
              {stats.lowStock.map(f => (
                <div key={f.id} className="flex items-center gap-3 p-2 border border-line bg-ink/40">
                  <div className="w-8 h-8 border border-line" style={{ background: f.color_hex }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs truncate">{f.brand} {f.material}</div>
                    <div className="text-[10px] text-gray-500">{f.color_name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-danger text-sm">{f.current_weight_g}g</div>
                    <div className="text-[9px] text-gray-500 blink">! NACHKAUFEN</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="LETZTE DRUCKE" accent="#00ff88" className="lg:col-span-1">
          {stats.recentPrints.length === 0 ? (
            <div className="text-gray-500 text-xs text-center py-8">// KEINE DRUCKE</div>
          ) : (
            <div className="space-y-2">
              {stats.recentPrints.map(p => (
                <div key={p.id} className="border border-line bg-ink/40 p-2">
                  <div className="flex items-start gap-2">
                    {p.filament_hex && (
                      <div className="w-3 h-3 mt-1 border border-line shrink-0" style={{ background: p.filament_hex }} />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs truncate">{p.title}</div>
                      <div className="text-[10px] text-gray-500 flex gap-2">
                        <span>{p.weight_used_g}g</span>
                        <span>·</span>
                        <span>{Math.floor(p.duration_minutes / 60)}h{p.duration_minutes % 60}m</span>
                        {p.user_display_name && <><span>·</span><span>{p.user_display_name}</span></>}
                      </div>
                    </div>
                    <div className={`text-[9px] font-display uppercase ${p.status === 'success' ? 'text-success' : 'text-danger'}`}>
                      {p.status === 'success' ? '✓' : '✗'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {stats.byUser && stats.byUser.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Panel title="LEADERBOARD" accent="#a855f7">
            <div className="space-y-2">
              {stats.byUser.map((u, i) => (
                <div key={u.name} className="flex items-center gap-3">
                  <div className="font-display text-xs text-gray-600 w-6">#{i + 1}</div>
                  <div className="w-7 h-7 flex items-center justify-center text-xs font-display font-bold border border-line" style={{ background: u.color, color: '#0a0e1a' }}>
                    {u.name[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 text-sm">{u.name}</div>
                  <div className="font-display text-xs text-accent">{u.prints} drucke</div>
                  <div className="font-display text-xs text-accent2 w-20 text-right">{(u.grams / 1000).toFixed(2)} kg</div>
                  <div className="font-display text-xs text-danger w-16 text-right">{(u.total_cost || 0).toFixed(2)}€</div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="ACTIVITY FEED" accent="#00d9ff">
            <ActivityFeed limit={10} compact />
          </Panel>
        </div>
      )}

      {monthly && monthly.length > 0 && (
        <Panel title="VERLAUF // LETZTE 6 MONATE" accent="#ff6b00">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthly} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <XAxis dataKey="month" stroke="#666" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} />
              <YAxis stroke="#666" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} />
              <Tooltip
                contentStyle={{ background: '#0d1b2a', border: '1px solid #1e3a5f', fontFamily: 'JetBrains Mono', fontSize: 11 }}
                labelStyle={{ color: '#ffb800' }}
              />
              <Legend wrapperStyle={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} />
              <Bar dataKey="grams" name="Gramm" fill="#00d9ff" />
              <Bar dataKey="prints" name="Drucke" fill="#00ff88" />
              <Bar dataKey="total_cost" name="Kosten €" fill="#ff6b00" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      )}

      <div className="flex justify-end">
        <a
          href={api.exportPrintsCsvUrl}
          download
          className="text-[10px] font-display uppercase tracking-widest border border-line px-3 py-2 hover:border-accent hover:text-accent text-gray-400"
        >
          ↓ Druck-Historie als CSV exportieren
        </a>
      </div>
    </div>
  );
}
