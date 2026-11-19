// 3MF File Parser
// Eine .3mf von Bambu Studio ist ein ZIP mit:
//   - Metadata/_rels/.rels                  XML mit Verweisen
//   - Metadata/plate_*.png                  Vorschau-Bilder
//   - Metadata/slice_info.config            Slicer-Metadaten (Druckzeit, Filament-Verbrauch)
//   - Metadata/project_settings.config      JSON mit allen Slicer-Settings
//   - Metadata/model_settings.config        XML mit Modell-Daten
//   - 3D/3dmodel.model                      Eigentliche Geometrie

import yauzl from 'yauzl';

// 3MF parsen — gibt zurück: { preview (base64 PNG), metadata (object) }
export function parse3mf(filepath) {
  return new Promise((resolve, reject) => {
    yauzl.open(filepath, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(err);

      const result = {
        preview: null,           // base64 PNG (data URL)
        plate_count: 0,
        plates: [],              // [{ index, preview, ... }]
        metadata: {
          estimated_time_seconds: null,
          estimated_time_text: null,
          total_filament_used_g: null,
          total_filament_used_mm: null,
          filament_per_extruder: [],
          layer_count: null,
          layer_height: null,
          nozzle_temperature: null,
          bed_temperature: null,
          bed_type: null,
          printer_model: null,
          slicer: null,
          slicer_version: null,
          object_count: null,
          model_size_mm: null,
        },
      };

      const fileBuffers = {};

      zip.readEntry();
      zip.on('entry', (entry) => {
        // Wir interessieren uns nur für bestimmte Dateien
        const isPreview = /^Metadata\/(plate|top)_?\d*\.png$/i.test(entry.fileName);
        const isSliceInfo = /^Metadata\/slice_info\.config$/i.test(entry.fileName);
        const isProjectSettings = /^Metadata\/project_settings\.config$/i.test(entry.fileName);
        const isModelSettings = /^Metadata\/model_settings\.config$/i.test(entry.fileName);

        if (!isPreview && !isSliceInfo && !isProjectSettings && !isModelSettings) {
          zip.readEntry();
          return;
        }

        zip.openReadStream(entry, (err, stream) => {
          if (err) {
            zip.readEntry();
            return;
          }
          const chunks = [];
          stream.on('data', (c) => chunks.push(c));
          stream.on('end', () => {
            fileBuffers[entry.fileName] = Buffer.concat(chunks);
            zip.readEntry();
          });
          stream.on('error', () => zip.readEntry());
        });
      });

      zip.on('end', () => {
        try {
          // Vorschau-Bilder finden — bevorzugt plate_1.png oder ähnlich
          const previewKeys = Object.keys(fileBuffers)
            .filter(k => /\.png$/i.test(k))
            .sort();
          if (previewKeys.length > 0) {
            // Erste preview als Haupt-Vorschau
            const buf = fileBuffers[previewKeys[0]];
            result.preview = `data:image/png;base64,${buf.toString('base64')}`;
            result.plate_count = previewKeys.length;
            result.plates = previewKeys.map((k, i) => ({
              index: i + 1,
              filename: k,
              preview: `data:image/png;base64,${fileBuffers[k].toString('base64')}`,
            }));
          }

          // slice_info.config — XML mit allen Druckdaten
          const sliceKey = Object.keys(fileBuffers).find(k => /slice_info\.config$/i.test(k));
          if (sliceKey) {
            const xml = fileBuffers[sliceKey].toString('utf8');
            parseSliceInfo(xml, result.metadata);
          }

          // project_settings.config — JSON mit Slicer-Settings
          const projKey = Object.keys(fileBuffers).find(k => /project_settings\.config$/i.test(k));
          if (projKey) {
            try {
              const json = JSON.parse(fileBuffers[projKey].toString('utf8'));
              parseProjectSettings(json, result.metadata);
            } catch (e) {
              // ignore
            }
          }

          resolve(result);
        } catch (err) {
          reject(err);
        }
      });

      zip.on('error', reject);
    });
  });
}

// Parse slice_info.config XML
// Beispiel-Inhalt:
//   <metadata key="prediction" value="3892"/>           // Sekunden
//   <metadata key="weight" value="42.5"/>               // Gramm
//   <filament id="1" tray_info_idx="GFA00" type="PLA" color="#FF0000" used_m="14.32" used_g="42.5"/>
function parseSliceInfo(xml, meta) {
  // metadata key="..." value="..."
  const metaPattern = /<metadata\s+key="([^"]+)"\s+value="([^"]*)"\s*\/>/gi;
  let match;
  while ((match = metaPattern.exec(xml)) !== null) {
    const key = match[1];
    const val = match[2];
    if (key === 'prediction') {
      meta.estimated_time_seconds = parseInt(val);
      meta.estimated_time_text = formatTime(parseInt(val));
    } else if (key === 'weight') {
      meta.total_filament_used_g = parseFloat(val);
    } else if (key === 'layer_num') {
      meta.layer_count = parseInt(val);
    }
  }

  // filament id="..." used_m="..." used_g="..."
  const filamentPattern = /<filament\s+([^>]+)\/>/gi;
  while ((match = filamentPattern.exec(xml)) !== null) {
    const attrs = parseAttrs(match[1]);
    meta.filament_per_extruder.push({
      id: attrs.id,
      type: attrs.type,
      color: attrs.color,
      tray_info: attrs.tray_info_idx,
      used_m: parseFloat(attrs.used_m) || 0,
      used_g: parseFloat(attrs.used_g) || 0,
    });
  }

  // Falls total_filament_used_g nicht im metadata war, aus filament-Liste summieren
  if (!meta.total_filament_used_g && meta.filament_per_extruder.length > 0) {
    meta.total_filament_used_g = meta.filament_per_extruder.reduce((s, f) => s + f.used_g, 0);
    meta.total_filament_used_mm = meta.filament_per_extruder.reduce((s, f) => s + f.used_m * 1000, 0);
  }
}

// project_settings.config ist ein riesiges JSON mit allen Settings
function parseProjectSettings(json, meta) {
  if (json.layer_height) meta.layer_height = parseFloat(json.layer_height);
  if (json.nozzle_temperature) {
    meta.nozzle_temperature = Array.isArray(json.nozzle_temperature)
      ? parseInt(json.nozzle_temperature[0])
      : parseInt(json.nozzle_temperature);
  }
  if (json.hot_plate_temp || json.bed_temperature) {
    const t = json.hot_plate_temp || json.bed_temperature;
    meta.bed_temperature = Array.isArray(t) ? parseInt(t[0]) : parseInt(t);
  }
  if (json.curr_bed_type) meta.bed_type = json.curr_bed_type;
  if (json.printer_model) meta.printer_model = json.printer_model;
  if (json.printer_settings_id) meta.printer_model = meta.printer_model || json.printer_settings_id;
}

function parseAttrs(s) {
  const attrs = {};
  const re = /(\w+)="([^"]*)"/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    attrs[m[1]] = m[2];
  }
  return attrs;
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
