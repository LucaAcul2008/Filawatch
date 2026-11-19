// Filament-Vorlagen für Schnellauswahl
// Quelle: Bambu Lab Filament Datasheets + Polymaker/Sunlu/Eryone Datasheets

export const FILAMENT_PRESETS = [
  // === BAMBU LAB PLA ===
  { name: "Bambu PLA Basic", brand: "Bambu Lab", material: "PLA", nozzle_temp: 220, bed_temp: 55, print_speed: 250, spool_weight_g: 250, initial_weight_g: 1000 },
  { name: "Bambu PLA Matte", brand: "Bambu Lab", material: "PLA Matte", nozzle_temp: 220, bed_temp: 55, print_speed: 200, spool_weight_g: 250, initial_weight_g: 1000 },
  { name: "Bambu PLA Silk", brand: "Bambu Lab", material: "PLA Silk", nozzle_temp: 230, bed_temp: 55, print_speed: 200, spool_weight_g: 250, initial_weight_g: 1000 },
  { name: "Bambu PLA Silk+", brand: "Bambu Lab", material: "PLA Silk", nozzle_temp: 230, bed_temp: 55, print_speed: 200, spool_weight_g: 250, initial_weight_g: 1000 },
  { name: "Bambu PLA Sparkle", brand: "Bambu Lab", material: "PLA", nozzle_temp: 220, bed_temp: 55, print_speed: 200, spool_weight_g: 250, initial_weight_g: 1000 },
  { name: "Bambu PLA Marble", brand: "Bambu Lab", material: "PLA", nozzle_temp: 220, bed_temp: 55, print_speed: 200, spool_weight_g: 250, initial_weight_g: 1000 },
  { name: "Bambu PLA Metal", brand: "Bambu Lab", material: "PLA", nozzle_temp: 220, bed_temp: 55, print_speed: 200, spool_weight_g: 250, initial_weight_g: 1000 },
  { name: "Bambu PLA Wood", brand: "Bambu Lab", material: "PLA", nozzle_temp: 220, bed_temp: 55, print_speed: 200, spool_weight_g: 250, initial_weight_g: 1000 },
  { name: "Bambu PLA-CF", brand: "Bambu Lab", material: "PLA-CF", nozzle_temp: 240, bed_temp: 55, print_speed: 150, spool_weight_g: 250, initial_weight_g: 1000 },
  { name: "Bambu PLA Aero", brand: "Bambu Lab", material: "PLA", nozzle_temp: 240, bed_temp: 45, print_speed: 100, spool_weight_g: 250, initial_weight_g: 1000 },
  { name: "Bambu PLA Galaxy", brand: "Bambu Lab", material: "PLA", nozzle_temp: 220, bed_temp: 55, print_speed: 200, spool_weight_g: 250, initial_weight_g: 1000 },
  { name: "Bambu PLA Glow", brand: "Bambu Lab", material: "PLA", nozzle_temp: 220, bed_temp: 55, print_speed: 200, spool_weight_g: 250, initial_weight_g: 1000 },

  // === BAMBU LAB PETG ===
  { name: "Bambu PETG HF", brand: "Bambu Lab", material: "PETG HF", nozzle_temp: 255, bed_temp: 70, print_speed: 250, spool_weight_g: 250, initial_weight_g: 1000 },
  { name: "Bambu PETG Translucent", brand: "Bambu Lab", material: "PETG", nozzle_temp: 260, bed_temp: 70, print_speed: 200, spool_weight_g: 250, initial_weight_g: 1000 },
  { name: "Bambu PETG-CF", brand: "Bambu Lab", material: "PETG-CF", nozzle_temp: 270, bed_temp: 80, print_speed: 200, spool_weight_g: 250, initial_weight_g: 1000 },

  // === BAMBU LAB ABS / ASA ===
  { name: "Bambu ABS", brand: "Bambu Lab", material: "ABS", nozzle_temp: 270, bed_temp: 90, print_speed: 200, spool_weight_g: 250, initial_weight_g: 1000 },
  { name: "Bambu ABS-GF", brand: "Bambu Lab", material: "ABS", nozzle_temp: 280, bed_temp: 90, print_speed: 150, spool_weight_g: 250, initial_weight_g: 1000 },
  { name: "Bambu ASA", brand: "Bambu Lab", material: "ASA", nozzle_temp: 270, bed_temp: 90, print_speed: 200, spool_weight_g: 250, initial_weight_g: 1000 },
  { name: "Bambu ASA Aero", brand: "Bambu Lab", material: "ASA", nozzle_temp: 270, bed_temp: 90, print_speed: 100, spool_weight_g: 250, initial_weight_g: 1000 },

  // === BAMBU LAB ENGINEERING ===
  { name: "Bambu TPU 95A", brand: "Bambu Lab", material: "TPU 95A", nozzle_temp: 240, bed_temp: 35, print_speed: 60, spool_weight_g: 250, initial_weight_g: 1000 },
  { name: "Bambu TPU 95A HF", brand: "Bambu Lab", material: "TPU 95A", nozzle_temp: 240, bed_temp: 35, print_speed: 200, spool_weight_g: 250, initial_weight_g: 1000 },
  { name: "Bambu PC", brand: "Bambu Lab", material: "PC", nozzle_temp: 270, bed_temp: 100, print_speed: 150, spool_weight_g: 250, initial_weight_g: 1000 },
  { name: "Bambu PC FR", brand: "Bambu Lab", material: "PC-FR", nozzle_temp: 280, bed_temp: 100, print_speed: 150, spool_weight_g: 250, initial_weight_g: 1000 },
  { name: "Bambu PA-CF", brand: "Bambu Lab", material: "PA-CF", nozzle_temp: 290, bed_temp: 80, print_speed: 150, spool_weight_g: 250, initial_weight_g: 1000 },
  { name: "Bambu PA6-CF", brand: "Bambu Lab", material: "PA6-CF", nozzle_temp: 290, bed_temp: 80, print_speed: 150, spool_weight_g: 250, initial_weight_g: 1000 },
  { name: "Bambu PAHT-CF", brand: "Bambu Lab", material: "PAHT-CF", nozzle_temp: 300, bed_temp: 90, print_speed: 150, spool_weight_g: 250, initial_weight_g: 1000 },

  // === BAMBU LAB SUPPORT ===
  { name: "Bambu Support for PLA", brand: "Bambu Lab", material: "PVA", nozzle_temp: 220, bed_temp: 50, print_speed: 100, spool_weight_g: 250, initial_weight_g: 500 },
  { name: "Bambu Support for PA/PET", brand: "Bambu Lab", material: "HIPS", nozzle_temp: 280, bed_temp: 80, print_speed: 100, spool_weight_g: 250, initial_weight_g: 500 },
  { name: "Bambu Support W", brand: "Bambu Lab", material: "PVA", nozzle_temp: 220, bed_temp: 60, print_speed: 100, spool_weight_g: 250, initial_weight_g: 500 },

  // === POLYMAKER ===
  { name: "Polymaker PolyTerra PLA", brand: "Polymaker", material: "PLA Matte", nozzle_temp: 215, bed_temp: 55, print_speed: 200, spool_weight_g: 200, initial_weight_g: 1000 },
  { name: "Polymaker PolyLite PLA", brand: "Polymaker", material: "PLA", nozzle_temp: 210, bed_temp: 60, print_speed: 200, spool_weight_g: 200, initial_weight_g: 1000 },
  { name: "Polymaker PolyMax PLA", brand: "Polymaker", material: "PLA", nozzle_temp: 220, bed_temp: 60, print_speed: 200, spool_weight_g: 200, initial_weight_g: 750 },
  { name: "Polymaker PolyLite PETG", brand: "Polymaker", material: "PETG", nozzle_temp: 240, bed_temp: 70, print_speed: 200, spool_weight_g: 200, initial_weight_g: 1000 },
  { name: "Polymaker PolyMide PA6-CF", brand: "Polymaker", material: "PA6-CF", nozzle_temp: 290, bed_temp: 80, print_speed: 150, spool_weight_g: 200, initial_weight_g: 750 },

  // === SUNLU ===
  { name: "Sunlu PLA+", brand: "Sunlu", material: "PLA", nozzle_temp: 215, bed_temp: 60, print_speed: 200, spool_weight_g: 250, initial_weight_g: 1000 },
  { name: "Sunlu PLA Meta", brand: "Sunlu", material: "PLA", nozzle_temp: 220, bed_temp: 60, print_speed: 250, spool_weight_g: 250, initial_weight_g: 1000 },
  { name: "Sunlu PLA Silk", brand: "Sunlu", material: "PLA Silk", nozzle_temp: 215, bed_temp: 60, print_speed: 200, spool_weight_g: 250, initial_weight_g: 1000 },
  { name: "Sunlu PETG", brand: "Sunlu", material: "PETG", nozzle_temp: 240, bed_temp: 70, print_speed: 200, spool_weight_g: 250, initial_weight_g: 1000 },

  // === ERYONE / OVERTURE ===
  { name: "Eryone PLA Matte", brand: "Eryone", material: "PLA Matte", nozzle_temp: 200, bed_temp: 55, print_speed: 200, spool_weight_g: 230, initial_weight_g: 1000 },
  { name: "Overture PLA", brand: "Overture", material: "PLA", nozzle_temp: 210, bed_temp: 60, print_speed: 200, spool_weight_g: 230, initial_weight_g: 1000 },
  { name: "Overture PETG", brand: "Overture", material: "PETG", nozzle_temp: 245, bed_temp: 80, print_speed: 200, spool_weight_g: 230, initial_weight_g: 1000 },
];
