import db from './db.js';

export function getSetting(key, defaultVal) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : defaultVal;
}

export function setSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
}

// Kosten eines Drucks berechnen
// Material: (verbrauchte_g / initial_g) * spulen_preis
// Strom: (dauer_minuten / 60) * watts / 1000 * €/kWh
export function calcPrintCost(print, filament) {
  let material = 0;
  if (filament && filament.price && filament.initial_weight_g) {
    material = (print.weight_used_g / filament.initial_weight_g) * filament.price;
  }
  const watts = parseFloat(getSetting('cost_printer_watts', '150'));
  const kwhPrice = parseFloat(getSetting('cost_power_kwh', '0.30'));
  const power = (print.duration_minutes / 60) * (watts / 1000) * kwhPrice;
  return {
    material: Math.round(material * 100) / 100,
    power: Math.round(power * 100) / 100,
    total: Math.round((material + power) * 100) / 100,
  };
}
