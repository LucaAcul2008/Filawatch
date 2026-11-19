const BASE = '/api';

function getToken() {
  return localStorage.getItem('filatrack_token');
}

export function setToken(t) {
  if (t) localStorage.setItem('filatrack_token', t);
  else localStorage.removeItem('filatrack_token');
}

async function req(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (!opts.isFormData) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(BASE + path, {
    ...opts,
    headers,
    body: opts.isFormData ? opts.body : (opts.body ? JSON.stringify(opts.body) : undefined),
  });
  if (res.status === 401) {
    setToken(null);
    window.location.reload();
    return;
  }
  if (!res.ok) {
    const txt = await res.text();
    let msg = txt;
    try { msg = JSON.parse(txt).error || txt; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  // Auth
  login: (username, password) => req('/auth/login', { method: 'POST', body: { username, password } }),
  me: () => req('/auth/me'),
  updateMe: (data) => req('/auth/me', { method: 'PUT', body: data }),
  listUsers: () => req('/auth/users'),
  createUser: (data) => req('/auth/users', { method: 'POST', body: data }),
  deleteUser: (id) => req(`/auth/users/${id}`, { method: 'DELETE' }),

  // Filaments
  listFilaments: () => req('/filaments'),
  createFilament: (data) => req('/filaments', { method: 'POST', body: data }),
  updateFilament: (id, data) => req(`/filaments/${id}`, { method: 'PUT', body: data }),
  deleteFilament: (id) => req(`/filaments/${id}`, { method: 'DELETE' }),

  // Prints
  listPrints: () => req('/prints'),
  createPrint: (data) => req('/prints', { method: 'POST', body: data }),
  deletePrint: (id) => req(`/prints/${id}`, { method: 'DELETE' }),
  uploadPrintPhoto: (id, file) => {
    const fd = new FormData();
    fd.append('photo', file);
    return req(`/prints/${id}/photo`, { method: 'POST', body: fd, isFormData: true });
  },
  uploadPrintFile: (id, file) => {
    const fd = new FormData();
    fd.append('file', file);
    return req(`/prints/${id}/file`, { method: 'POST', body: fd, isFormData: true });
  },

  // Stats
  getStats: () => req('/stats'),

  // Wishlist & Ideas
  listWishlist: () => req('/wishlist'),
  addWishlist: (data) => req('/wishlist', { method: 'POST', body: data }),
  deleteWishlist: (id) => req(`/wishlist/${id}`, { method: 'DELETE' }),
  listIdeas: () => req('/ideas'),
  addIdea: (data) => req('/ideas', { method: 'POST', body: data }),
  toggleIdea: (id) => req(`/ideas/${id}/toggle`, { method: 'PUT' }),
  deleteIdea: (id) => req(`/ideas/${id}`, { method: 'DELETE' }),

  // Printer
  getPrinterStatus: () => req('/printer/status'),
  getPrinterConfig: () => req('/printer/config'),
  setupLan: (data) => req('/printer/config/lan', { method: 'POST', body: data }),
  cloudLogin: (email, password, region) => req('/printer/cloud/login', { method: 'POST', body: { email, password, region } }),
  cloudVerify: (email, code, region) => req('/printer/cloud/verify', { method: 'POST', body: { email, code, region } }),
  cloudVerifyTfa: (code, region) => req('/printer/cloud/verify-tfa', { method: 'POST', body: { code, region } }),
  cloudDevices: () => req('/printer/cloud/devices'),
  selectDevice: (dev_id, name) => req('/printer/cloud/select-device', { method: 'POST', body: { dev_id, name } }),
  reconnectPrinter: () => req('/printer/reconnect', { method: 'POST' }),

  // v7: Printer Control
  printerPause: () => req('/printer/control/pause', { method: 'POST' }),
  printerResume: () => req('/printer/control/resume', { method: 'POST' }),
  printerStop: () => req('/printer/control/stop', { method: 'POST' }),
  printerLight: (on) => req('/printer/control/light', { method: 'POST', body: { on } }),
  printerSpeed: (level) => req('/printer/control/speed', { method: 'POST', body: { level: String(level) } }),
  printerEmergencyStop: () => req('/printer/control/emergency-stop', { method: 'POST' }),

  // v7: AMS assignments
  getAmsAssignments: () => req('/printer/ams/assignments'),
  setAmsAssignment: (unit_id, slot_id, filament_id) =>
    req('/printer/ams/assignments', { method: 'POST', body: { unit_id, slot_id, filament_id } }),
  deleteAmsAssignment: (unit_id, slot_id) =>
    req(`/printer/ams/assignments/${unit_id}/${slot_id}`, { method: 'DELETE' }),

  // v7: Photo edit on existing prints
  deletePrintPhoto: (id) => req(`/prints/${id}/photo`, { method: 'DELETE' }),

  // Push
  getPushKey: () => req('/push/key'),
  subscribePush: (sub) => req('/push/subscribe', { method: 'POST', body: sub }),
  unsubscribePush: (endpoint) => req('/push/unsubscribe', { method: 'POST', body: { endpoint } }),

  // Etappe 2: Activity, QR, Settings, Backup
  getActivity: (limit = 50) => req(`/activity?limit=${limit}`),
  getAppSettings: () => req('/settings'),
  updateAppSettings: (data) => req('/settings', { method: 'PUT', body: data }),
  getFilamentQrUrl: (id) => `/api/filaments/${id}/qr`,
  getFilamentQrPngUrl: (id) => `/api/filaments/${id}/qr.png`,
  getFilamentLabelUrl: (id) => `/api/filaments/${id}/label`,
  getFilamentProfileUrl: (id) => `/api/filaments/${id}/profile`,
  backupToAzure: () => req('/backup/azure', { method: 'POST' }),
  listBackups: () => req('/backup/list'),

  // Etappe 3: Maintenance, Calendar, Gallery
  listMaintenance: () => req('/maintenance'),
  markMaintenanceDone: (id) => req(`/maintenance/${id}/done`, { method: 'POST' }),
  addMaintenance: (data) => req('/maintenance', { method: 'POST', body: data }),
  deleteMaintenance: (id) => req(`/maintenance/${id}`, { method: 'DELETE' }),
  getCalendar: (month) => req(`/calendar${month ? '?month=' + month : ''}`),
  getGallery: () => req('/gallery'),
  getMonthlyStats: (months = 12) => req(`/stats/monthly?months=${months}`),
  exportPrintsCsvUrl: '/api/export/prints.csv',

  // v6: Filament Extras
  getFilamentStats: (id) => req(`/filaments/${id}/stats`),
  weighFilament: (id, total_weight_g) => req(`/filaments/${id}/weigh`, { method: 'POST', body: { total_weight_g } }),
  markFilamentDried: (id) => req(`/filaments/${id}/dried`, { method: 'POST' }),
  canPrint: (id, payload) => req(`/filaments/${id}/can-print`, { method: 'POST', body: payload }),
  similarFilaments: (id) => req(`/filaments/${id}/similar`),
  getMaterialMeta: () => req('/filaments/_meta/materials'),

  // v6: 3MF Files
  list3mf: () => req('/threemf'),
  get3mf: (id) => req(`/threemf/${id}`),
  parse3mf: async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return req('/threemf/parse', { method: 'POST', body: fd, isFormData: true });
  },
  delete3mf: (id) => req(`/threemf/${id}`, { method: 'DELETE' }),
  upload3mfToCloud: (id) => req(`/threemf/${id}/upload-to-cloud`, { method: 'POST' }),
  bambuConnectUrl: (id) => req(`/threemf/${id}/bambu-connect-url`),
  threemfDownloadUrl: (id) => `/api/threemf/${id}/download`,
};
