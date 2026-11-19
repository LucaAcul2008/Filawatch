// Bambu Lab Cloud API Client
// Implementiert den inoffiziellen Cloud-Login + MQTT-Stream

const REGIONS = {
  // WICHTIG: Bambu hat nur zwei MQTT-Endpoints — us.mqtt.bambulab.com für die Welt
  // und cn.mqtt.bambulab.com für China. eu.mqtt existiert NICHT!
  // (us.mqtt.bambulab.com ist hinter einem CDN und auch aus Europa schnell)
  eu: { api: 'https://api.bambulab.com', mqtt: 'us.mqtt.bambulab.com' },
  us: { api: 'https://api.bambulab.com', mqtt: 'us.mqtt.bambulab.com' },
  cn: { api: 'https://api.bambulab.cn', mqtt: 'cn.mqtt.bambulab.com' },
};

// Diese Headers sind WICHTIG damit Bambu/Cloudflare uns nicht blockt
function makeHeaders(extra = {}) {
  return {
    'User-Agent': 'bambu_network_agent/01.09.05.01',
    'X-BBL-Client-Name': 'OrcaSlicer',
    'X-BBL-Client-Type': 'slicer',
    'X-BBL-Client-Version': '01.09.05.51',
    'X-BBL-Language': 'en-US',
    'X-BBL-OS-Type': 'linux',
    'X-BBL-OS-Version': '6.2.0',
    'X-BBL-Agent-Version': '01.09.05.01',
    'X-BBL-Executable-info': '{}',
    'X-BBL-Agent-OS-Type': 'linux',
    'Accept': 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
    ...extra,
  };
}

function decodeJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

export class BambuCloud {
  constructor(region = 'eu') {
    this.region = region;
    this.endpoints = REGIONS[region] || REGIONS.eu;
    this.accessToken = null;
    this.userId = null;
    this._tfaKey = null;
  }

  setRegion(region) {
    this.region = region;
    this.endpoints = REGIONS[region] || REGIONS.eu;
  }

  setToken(token) {
    this.accessToken = token;
    this.userId = this._extractUserId(token);
    if (!this.userId) {
      console.warn('[BambuCloud] userId konnte nicht aus Token extrahiert werden — werde Profile-API als Fallback nutzen');
    } else {
      console.log(`[BambuCloud] userId aus Token: ${String(this.userId).substring(0, 4)}...`);
    }
  }

  setTfaKey(key) {
    this._tfaKey = key;
  }

  _extractUserId(token) {
    const payload = decodeJwtPayload(token);
    if (!payload) return null;
    // pybambu Logik: username ist im JWT als "u_<digits>"
    const candidates = [payload.username, payload.uid, payload.userId, payload.user_id, payload.sub];
    for (const c of candidates) {
      if (typeof c === 'string') {
        if (c.startsWith('u_')) return c.substring(2);
        if (/^\d+$/.test(c)) return c;
      } else if (typeof c === 'number') {
        return String(c);
      }
    }
    return null;
  }

  // Fallback: userId via Profile-API holen
  // Bambu hat zwei Endpoints: /v1/user-service/my/profile und /v1/design-user-service/my/preference
  async fetchUserIdFromProfile() {
    if (!this.accessToken) return null;
    // Erst Profile probieren
    try {
      const res = await fetch(`${this.endpoints.api}/v1/user-service/my/profile`, {
        headers: makeHeaders({ 'Authorization': `Bearer ${this.accessToken}` }),
      });
      if (res.ok) {
        const data = await res.json();
        const uid = data.uid || data.userId || data.user_id;
        if (uid) {
          this.userId = String(uid);
          console.log(`[BambuCloud] userId via Profile-API: ${this.userId.substring(0, 4)}...`);
          return this.userId;
        }
      } else {
        console.warn(`[BambuCloud] Profile-API Status ${res.status}`);
      }
    } catch (err) {
      console.warn('[BambuCloud] Profile-API Fehler:', err.message);
    }
    // Fallback: Preference-API
    try {
      const res = await fetch(`${this.endpoints.api}/v1/design-user-service/my/preference`, {
        headers: makeHeaders({ 'Authorization': `Bearer ${this.accessToken}` }),
      });
      if (res.ok) {
        const data = await res.json();
        const uid = data.uid || data.userId || data.user_id;
        if (uid) {
          this.userId = String(uid);
          console.log(`[BambuCloud] userId via Preference-API: ${this.userId.substring(0, 4)}...`);
          return this.userId;
        }
      }
    } catch (err) {
      console.warn('[BambuCloud] Preference-API Fehler:', err.message);
    }
    return null;
  }

  // Stellt sicher dass userId gesetzt ist (mit Fallback auf API)
  async ensureUserId() {
    if (this.userId) return this.userId;
    return await this.fetchUserIdFromProfile();
  }

  isTokenExpired() {
    if (!this.accessToken) return true;
    const payload = decodeJwtPayload(this.accessToken);
    if (!payload || !payload.exp) return false;
    return (payload.exp * 1000) - Date.now() < 24 * 60 * 60 * 1000;
  }

  async _post(path, body, opts = {}) {
    const url = `${this.endpoints.api}${path}`;
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: makeHeaders(opts.headers || {}),
        body: JSON.stringify(body),
        redirect: 'manual',
      });
    } catch (err) {
      throw new Error(`Netzwerk-Fehler beim Aufruf von Bambu: ${err.message}`);
    }
    const textBody = await res.text().catch(() => '');
    let jsonBody = null;
    try { jsonBody = JSON.parse(textBody); } catch {}
    return { res, textBody, jsonBody };
  }

  async login(email, password) {
    const { res, textBody, jsonBody } = await this._post(
      '/v1/user-service/user/login',
      { account: email, password, apiError: '' }
    );

    if (res.status === 403 && textBody.includes('cloudflare')) {
      throw new Error('Bambu hat den Request blockiert (Cloudflare). Bitte später nochmal versuchen.');
    }

    if (jsonBody?.accessToken) {
      this.setToken(jsonBody.accessToken);
      return { token: jsonBody.accessToken, refreshToken: jsonBody.refreshToken };
    }
    if (jsonBody?.loginType === 'verifyCode') {
      return { needsCode: true };
    }
    if (jsonBody?.loginType === 'tfa') {
      this._tfaKey = jsonBody.tfaKey;
      return { needsTfa: true, tfaKey: jsonBody.tfaKey };
    }

    const detail = jsonBody?.error || jsonBody?.message || textBody || `HTTP ${res.status}`;
    throw new Error(`Login fehlgeschlagen: ${detail}`);
  }

  async verifyCode(email, code) {
    const { res, textBody, jsonBody } = await this._post(
      '/v1/user-service/user/login',
      { account: email, code }
    );

    if (jsonBody?.accessToken) {
      this.setToken(jsonBody.accessToken);
      return { token: jsonBody.accessToken, refreshToken: jsonBody.refreshToken };
    }

    if (jsonBody?.code === 1) throw new Error('Code abgelaufen — bitte erneut Login versuchen');
    if (jsonBody?.code === 2) throw new Error('Code falsch');

    const detail = jsonBody?.error || jsonBody?.message || textBody || `HTTP ${res.status}`;
    throw new Error(`Code-Verifizierung fehlgeschlagen: ${detail}`);
  }

  // 2FA TOTP-Verifizierung
  // Bambu hat zwei Endpoints: /tfa/login (neuer) und /login/tfa (älter)
  // Token kommt entweder im JSON-Body ODER im Set-Cookie Header
  async verifyTfa(tfaCode, tfaKey) {
    const key = tfaKey || this._tfaKey;
    if (!key) {
      throw new Error('Kein tfaKey vorhanden — bitte zuerst nochmal Email/Passwort eingeben');
    }

    // Versuche zuerst den neueren Endpoint
    let result = await this._post('/v1/user-service/user/tfa/login', { tfaKey: key, tfaCode: String(tfaCode) });

    // Falls 404 → fall back auf alten Endpoint
    if (result.res.status === 404) {
      result = await this._post('/v1/user-service/user/login/tfa', { tfaKey: key, tfaCode: String(tfaCode) });
    }

    const { res, textBody, jsonBody } = result;

    // Variante A: Token direkt im JSON-Body (neuere API)
    if (jsonBody?.accessToken) {
      this.setToken(jsonBody.accessToken);
      this._tfaKey = null;
      return { token: jsonBody.accessToken, refreshToken: jsonBody.refreshToken };
    }

    // Variante B: Token im Set-Cookie (ältere API)
    let cookieStrs = [];
    if (typeof res.headers.getSetCookie === 'function') {
      cookieStrs = res.headers.getSetCookie();
    } else {
      const single = res.headers.get('set-cookie');
      if (single) cookieStrs = [single];
    }

    for (const c of cookieStrs) {
      const match = c.match(/token=([^;]+)/);
      if (match) {
        const token = decodeURIComponent(match[1]);
        this.setToken(token);
        this._tfaKey = null;
        return { token };
      }
    }

    let errMsg = textBody || '(leere Antwort)';
    try {
      const j = JSON.parse(textBody);
      errMsg = j.error?.message || j.message || j.error || errMsg;
    } catch {}
    throw new Error(`2FA fehlgeschlagen (HTTP ${res.status}): ${errMsg}`);
  }

  async refreshAccessToken(refreshToken) {
    const { res, textBody, jsonBody } = await this._post(
      '/v1/user-service/user/refreshtoken',
      { refreshToken }
    );
    if (jsonBody?.accessToken) {
      this.setToken(jsonBody.accessToken);
      return { token: jsonBody.accessToken, refreshToken: jsonBody.refreshToken || refreshToken };
    }
    const detail = jsonBody?.error || jsonBody?.message || textBody || `HTTP ${res.status}`;
    throw new Error(`Token-Refresh fehlgeschlagen: ${detail}`);
  }

  async getDevices() {
    if (!this.accessToken) throw new Error('Nicht eingeloggt');
    let res;
    try {
      res = await fetch(`${this.endpoints.api}/v1/iot-service/api/user/bind`, {
        headers: makeHeaders({ 'Authorization': `Bearer ${this.accessToken}` }),
      });
    } catch (err) {
      throw new Error(`Netzwerk-Fehler: ${err.message}`);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Devices-Abruf fehlgeschlagen (HTTP ${res.status}): ${text}`);
    }
    const data = await res.json();
    return (data.devices || []).map(d => ({
      dev_id: d.dev_id,
      name: d.name,
      online: d.online,
      print_status: d.print_status,
      dev_model_name: d.dev_model_name,
      dev_product_name: d.dev_product_name,
    }));
  }

  async getProfile() {
    if (!this.accessToken) throw new Error('Nicht eingeloggt');
    const res = await fetch(`${this.endpoints.api}/v1/user-service/my/profile`, {
      headers: makeHeaders({ 'Authorization': `Bearer ${this.accessToken}` }),
    });
    if (!res.ok) return null;
    return res.json();
  }

  getMqttCredentials() {
    if (!this.accessToken || !this.userId) return null;
    return {
      host: this.endpoints.mqtt,
      port: 8883,
      username: `u_${this.userId}`,
      password: this.accessToken,
    };
  }

  // 3MF/Gcode-File in die Bambu Cloud Library hochladen
  // Nutzt das Upload-Token-Schema von Bambu (zwei-Schritt: Token holen → File POSTen)
  async uploadFile(filename, fileBuffer) {
    if (!this.accessToken) throw new Error('Nicht eingeloggt');
    if (!this.userId) await this.ensureUserId();

    // Schritt 1: Upload-Token holen
    const tokenRes = await fetch(`${this.endpoints.api}/v1/iot-service/api/user/ttcode`, {
      method: 'POST',
      headers: makeHeaders({ 'Authorization': `Bearer ${this.accessToken}` }),
      body: JSON.stringify({ filename, type: 'model' }),
    });
    if (!tokenRes.ok) {
      const text = await tokenRes.text().catch(() => '');
      throw new Error(`Upload-Token fehlgeschlagen (${tokenRes.status}): ${text}`);
    }
    const tokenData = await tokenRes.json();

    // Schritt 2: File hochladen — Upload-URL kommt vom Server
    const uploadUrl = tokenData.upload_url || tokenData.url;
    if (!uploadUrl) throw new Error('Keine Upload-URL erhalten');

    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: fileBuffer,
    });
    if (!uploadRes.ok) {
      const text = await uploadRes.text().catch(() => '');
      throw new Error(`Upload fehlgeschlagen (${uploadRes.status}): ${text}`);
    }

    return {
      ok: true,
      filename,
      url: tokenData.file_url || uploadUrl.split('?')[0],
      size: fileBuffer.length,
    };
  }
}
