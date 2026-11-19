// Material-Konstanten für Berechnungen
// Dichten in g/cm³ — Quelle: Materialdatenblätter Bambu Lab und Polymaker

export const MATERIAL_DENSITIES = {
  'PLA': 1.24,
  'PLA-CF': 1.30,
  'PLA Silk': 1.24,
  'PLA Matte': 1.24,
  'PETG': 1.27,
  'PETG-CF': 1.31,
  'PETG HF': 1.27,
  'ABS': 1.04,
  'ABS-CF': 1.10,
  'ASA': 1.07,
  'ASA-CF': 1.11,
  'TPU': 1.21,
  'TPU 95A': 1.21,
  'PC': 1.20,
  'PC-FR': 1.21,
  'Nylon': 1.14,
  'PA': 1.14,
  'PA-CF': 1.16,
  'PA6-CF': 1.16,
  'PAHT-CF': 1.18,
  'PPS-CF': 1.46,
  'PEEK': 1.31,
  'PVA': 1.23,        // Support
  'HIPS': 1.04,       // Support
  'Sonstiges': 1.24,  // Default = PLA
};

// Welche Materialien sind feuchtigkeits-empfindlich?
// → bekommen Trocknungs-Erinnerungen
export const HYGROSCOPIC_MATERIALS = new Set([
  'PETG', 'PETG-CF', 'PETG HF',
  'TPU', 'TPU 95A',
  'Nylon', 'PA', 'PA-CF', 'PA6-CF', 'PAHT-CF',
  'PC', 'PC-FR',
  'PVA', 'PPS-CF',
]);

// Berechne verbleibende Filament-Länge in Metern
// Formel: Volumen = Gewicht / Dichte
//          Querschnitt = π × (d/2)²
//          Länge = Volumen / Querschnitt
export function calcLengthMeters(weight_g, diameter_mm = 1.75, material = 'PLA') {
  if (!weight_g || weight_g <= 0) return 0;
  const density = MATERIAL_DENSITIES[material] || MATERIAL_DENSITIES['PLA'];
  const volume_cm3 = weight_g / density;
  const radius_cm = (diameter_mm / 2) / 10;
  const cross_section_cm2 = Math.PI * radius_cm * radius_cm;
  const length_cm = volume_cm3 / cross_section_cm2;
  return Math.round(length_cm / 100 * 10) / 10; // in Meter, 1 Dezimalstelle
}

// Berechne Gewicht aus Länge (umgekehrt)
export function calcWeightFromLength(length_m, diameter_mm = 1.75, material = 'PLA') {
  const density = MATERIAL_DENSITIES[material] || MATERIAL_DENSITIES['PLA'];
  const radius_cm = (diameter_mm / 2) / 10;
  const cross_section_cm2 = Math.PI * radius_cm * radius_cm;
  const length_cm = length_m * 100;
  const volume_cm3 = length_cm * cross_section_cm2;
  return Math.round(volume_cm3 * density);
}

// Tage seit Datum
export function daysSince(dateString) {
  if (!dateString) return null;
  const then = new Date(dateString).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}
