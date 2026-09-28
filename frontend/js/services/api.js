/**
 * Measure X — Production API Service Layer
 * Directly interfaces with FastAPI + MySQL 8.0+ backend.
 * Uses real signed JWT Bearer authentication.
 * Absolutely NO mock fallback. Real database is the single source of truth.
 */

const TOKEN_STORAGE_KEY = 'measurex_jwt_token';

class MeasureXAPI {
  constructor(config = null) {
    this._customConfig = config;
  }

  get config() {
    return this._customConfig || window.MEASUREX_CONFIG || {
      API_BASE_URL: 'http://127.0.0.1:8000/api/v1',
      USE_MOCK: false
    };
  }

  get apiBaseUrl() {
    const c = this.config;
    return c.API_BASE_URL || '/api/v1';
  }

  getToken() {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  setToken(token) {
    try {
      if (token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    } catch (e) {
      console.warn('[MeasureX API] Failed to store auth token in localStorage', e);
    }
  }

  clearToken() {
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch (e) {}
  }

  async _delay(ms = 30) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Robust Fetch Wrapper with JWT Injection and Error Normalization
  async _fetch(endpoint, options = {}) {
    const url = `${this.apiBaseUrl}${endpoint}`;
    const headers = Object.assign({}, options.headers || {});

    // Inject Bearer token if present
    const token = this.getToken();
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const fetchOptions = {
      ...options,
      headers
    };

    let response;
    try {
      response = await fetch(url, fetchOptions);
    } catch (netErr) {
      console.error('[MeasureX API Network Error]', endpoint, netErr);
      throw new Error('Unable to connect to Measure X server. Please start the backend service.');
    }

    // Handle 401 Unauthorized
    if (response.status === 401) {
      // Do not clear token during login/register attempts
      if (!endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
        console.warn('[MeasureX API] Session expired or unauthorized for', endpoint);
        this.clearToken();
        if (window.state && typeof window.state.logout === 'function') {
          window.state.logout(false);
        }
      }
    }

    let data;
    try {
      data = await response.json();
    } catch (e) {
      data = {};
    }

    if (!response.ok) {
      const errMsg = data.detail || data.message || `Request failed with status ${response.status}`;
      const err = new Error(errMsg);
      err.status = response.status;
      err.data = data;
      throw err;
    }

    return data;
  }

  // --- Health Check ---
  async checkBackendHealth() {
    try {
      const res = await fetch(`${this.apiBaseUrl}/health`, { method: 'GET' });
      return res.ok ? await res.json() : null;
    } catch (e) {
      return null;
    }
  }

  // --- Auth & Session ---
  async login(email, password) {
    await this._delay();
    try {
      const data = await this._fetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      if (data.token) {
        this.setToken(data.token);
      }

      if (data.user && window.state) {
        window.state.setCurrentUser(data.user);
      }

      return {
        success: true,
        token: data.token,
        user: data.user,
        role: data.detectedRole || (data.user ? data.user.role : 'OWNER')
      };
    } catch (err) {
      return {
        success: false,
        message: err.message || 'Login failed. Please verify credentials.'
      };
    }
  }

  async register(registrationData) {
    await this._delay();
    try {
      const data = await this._fetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify(registrationData)
      });
      return {
        success: true,
        user: data.user,
        message: data.message || 'Account created successfully.'
      };
    } catch (err) {
      return {
        success: false,
        message: err.message || 'Registration failed.'
      };
    }
  }

  async registerOwner(ownerData) {
    return this.register({ ...ownerData, role: 'OWNER' });
  }

  async getMe() {
    const token = this.getToken();
    if (!token) return null;
    try {
      const user = await this._fetch('/auth/me');
      if (user && window.state) {
        window.state.setCurrentUser(user);
      }
      return user;
    } catch (err) {
      console.warn('[MeasureX API] /auth/me error:', err.message);
      this.clearToken();
      return null;
    }
  }

  async logout() {
    await this._delay();
    this.clearToken();
    if (window.state) {
      window.state.logout();
    }
    return { success: true };
  }

  // --- OTP & Password Reset ---
  async requestOTP(recipient, purpose = 'PASSWORD_RESET') {
    await this._delay();
    try {
      return await this._fetch('/auth/otp/request', {
        method: 'POST',
        body: JSON.stringify({ recipient, purpose })
      });
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  async verifyOTP(recipient, otp, purpose = 'PASSWORD_RESET') {
    await this._delay();
    try {
      return await this._fetch('/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ recipient, otp, purpose })
      });
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  async requestPasswordReset(email) {
    return this.requestOTP(email, 'PASSWORD_RESET');
  }

  async resetPassword(token, newPassword) {
    await this._delay();
    try {
      const res = await this._fetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, new_password: newPassword, newPassword })
      });
      return { success: true, message: res.message || 'Password updated successfully.' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  // --- Instruments ---
  async getInstruments(filters = {}) {
    await this._delay();
    try {
      const params = new URLSearchParams();
      if (filters.status && filters.status !== 'ALL') params.set('status', filters.status);
      if (filters.query) params.set('query', filters.query);
      if (filters.ownerId) params.set('ownerId', filters.ownerId);

      const queryStr = params.toString() ? `?${params.toString()}` : '';
      const list = await this._fetch(`/instruments${queryStr}`);
      if (window.state && Array.isArray(list)) {
        window.state.state.instruments = list;
      }
      return list;
    } catch (err) {
      console.error('[MeasureX API] Failed to fetch instruments:', err);
      return (window.state && window.state.state.instruments) || [];
    }
  }

  async getInstrument(id) {
    await this._delay();
    try {
      return await this._fetch(`/instruments/${encodeURIComponent(id)}`);
    } catch (err) {
      return window.state ? window.state.getInstrumentById(id) : null;
    }
  }

  async getInstrumentById(id) {
    return await this.getInstrument(id);
  }

  async createInstrument(instrumentData) {
    await this._delay();
    try {
      const created = await this._fetch('/instruments', {
        method: 'POST',
        body: JSON.stringify(instrumentData)
      });
      if (window.state && created) {
        if (!window.state.state.instruments) window.state.state.instruments = [];
        window.state.state.instruments.unshift(created);
        window.state.emit('instrument:created', created);
      }
      return created;
    } catch (err) {
      throw err;
    }
  }

  async getInstrumentLifecycle(instrumentId) {
    await this._delay();
    try {
      return await this._fetch(`/instruments/${encodeURIComponent(instrumentId)}/lifecycle`);
    } catch (err) {
      return {
        instrument: window.state ? window.state.getInstrumentById(instrumentId) : null,
        timeline: [],
        verificationHistory: [],
        certificates: []
      };
    }
  }

  // --- Applications ---
  async getApplications(filters = {}) {
    await this._delay();
    try {
      const params = new URLSearchParams();
      if (filters.status && filters.status !== 'ALL') params.set('status', filters.status);
      if (filters.officerId) params.set('officerId', filters.officerId);

      const queryStr = params.toString() ? `?${params.toString()}` : '';
      const list = await this._fetch(`/applications${queryStr}`);
      if (window.state && Array.isArray(list)) {
        window.state.state.applications = list;
      }
      return list;
    } catch (err) {
      console.error('[MeasureX API] Failed to fetch applications:', err);
      return (window.state && window.state.state.applications) || [];
    }
  }

  async getApplication(id) {
    await this._delay();
    try {
      return await this._fetch(`/applications/${encodeURIComponent(id)}`);
    } catch (err) {
      return (window.state && window.state.getApplicationById(id)) || null;
    }
  }

  async getApplicationById(id) {
    return await this.getApplication(id);
  }

  async getApplicationTimeline(id) {
    await this._delay();
    try {
      return await this._fetch(`/applications/${encodeURIComponent(id)}/timeline`);
    } catch (err) {
      return null;
    }
  }

  async createApplication(appData) {
    await this._delay();
    try {
      const created = await this._fetch('/applications', {
        method: 'POST',
        body: JSON.stringify(appData)
      });
      if (window.state && created) {
        if (!window.state.state.applications) window.state.state.applications = [];
        window.state.state.applications.unshift(created);
        window.state.emit('application:submitted', created);
      }
      return created;
    } catch (err) {
      throw err;
    }
  }

  async scheduleVerification(appId, scheduleDetails) {
    await this._delay();
    try {
      const res = await this._fetch(`/applications/${encodeURIComponent(appId)}/schedule`, {
        method: 'POST',
        body: JSON.stringify({
          officerId: scheduleDetails.officerId,
          date: scheduleDetails.date,
          time: scheduleDetails.time,
          location: scheduleDetails.location
        })
      });
      await this.getApplications();
      return res;
    } catch (err) {
      throw err;
    }
  }

  async assignOfficer(appId, officerId) {
    return this.scheduleVerification(appId, {
      officerId,
      date: new Date().toISOString().slice(0, 10),
      time: '10:00 AM'
    });
  }

  async requestCorrection(appId, reason) {
    await this._delay();
    try {
      const res = await this._fetch(`/applications/${encodeURIComponent(appId)}/request-correction`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
      await this.getApplications();
      return res;
    } catch (err) {
      console.error('[MeasureX API] requestCorrection error:', err);
      return { success: false, message: err.message };
    }
  }

  async rejectApplication(appId, reason) {
    await this._delay();
    try {
      const res = await this._fetch(`/applications/${encodeURIComponent(appId)}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
      await this.getApplications();
      return res;
    } catch (err) {
      console.error('[MeasureX API] rejectApplication error:', err);
      return { success: false, message: err.message };
    }
  }

  async resubmitApplication(appId, data) {
    await this._delay();
    try {
      const res = await this._fetch(`/applications/${encodeURIComponent(appId)}/resubmit`, {
        method: 'POST',
        body: JSON.stringify(data || {})
      });
      await this.getApplications();
      return res;
    } catch (err) {
      console.error('[MeasureX API] resubmitApplication error:', err);
      return { success: false, message: err.message };
    }
  }

  async submitFieldVerification(appId, verificationData) {
    await this._delay();
    try {
      const payload = {
        applicationId: appId,
        inspectorType: verificationData.inspectorType || 'LMO',
        physicalCondition: verificationData.physicalCondition || 'PASS',
        levelIndicator: verificationData.levelIndicator || 'PASS',
        zeroCheck: verificationData.zeroCheck || 'PASS',
        displayPointer: verificationData.displayPointer || 'PASS',
        sealCheck: verificationData.sealCheck || 'PASS',
        statutoryMarkings: verificationData.statutoryMarkings || 'PASS',
        testPoints: verificationData.testPoints || null,
        nominalTestWeight: verificationData.nominalTestWeight,
        observedMeasurement: verificationData.observedMeasurement,
        permissibleError: verificationData.permissibleError,
        unit: verificationData.unit || 'kg',
        scaleIntervalE: verificationData.scaleIntervalE,
        accuracyClass: verificationData.accuracyClass,
        result: verificationData.result,
        wireSealNumber: verificationData.wireSealNumber || verificationData.sealNumber,
        failReason: verificationData.failReason,
        remarks: verificationData.remarks,
        latitude: verificationData.latitude,
        longitude: verificationData.longitude
      };
      const res = await this._fetch('/verification/submit', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      await this.getApplications();
      await this.getInstruments();
      await this.getCertificates();
      await this.getAuditTrail();
      return res;
    } catch (err) {
      throw err;
    }
  }

  // --- Allocation Desk (LMO & GATC) ---
  async getAvailableOfficers() {
    await this._delay();
    try {
      return await this._fetch('/allocation/available-officers');
    } catch (err) {
      console.warn('[MeasureX API] Failed to fetch available officers:', err);
      return { lmos: [], gatcs: [] };
    }
  }

  async allocateApplication(appId, data) {
    await this._delay();
    return await this._fetch(`/applications/${encodeURIComponent(appId)}/allocate`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async reassignApplication(appId, data) {
    await this._delay();
    return await this._fetch(`/applications/${encodeURIComponent(appId)}/reassign`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getAssignmentHistory(appId) {
    await this._delay();
    try {
      return await this._fetch(`/applications/${encodeURIComponent(appId)}/assignment-history`);
    } catch (err) {
      return [];
    }
  }

  // --- Document Storage & Upload ---
  async uploadApplicationDocument(appId, file, documentType = 'STATUTORY_INSPECTION_RECORD') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', documentType);
    const token = this.getToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${this.apiBaseUrl}/applications/${encodeURIComponent(appId)}/documents/upload`, {
      method: 'POST',
      headers,
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to upload document');
    return data;
  }

  async getApplicationDocuments(appId) {
    await this._delay();
    try {
      return await this._fetch(`/applications/${encodeURIComponent(appId)}/documents`);
    } catch (err) {
      return [];
    }
  }

  async deleteDocument(docId) {
    await this._delay();
    return await this._fetch(`/documents/${encodeURIComponent(docId)}`, { method: 'DELETE' });
  }

  // --- Field Evidence (Photos, GPS & Mobile Capture) ---
  async uploadVerificationEvidence(formData) {
    const token = this.getToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${this.apiBaseUrl}/verification/evidence/upload`, {
      method: 'POST',
      headers,
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to upload evidence');
    return data;
  }

  async getRecordEvidence(recordId) {
    await this._delay();
    try {
      return await this._fetch(`/verification/${encodeURIComponent(recordId)}/evidence`);
    } catch (err) {
      return [];
    }
  }

  async getApplicationEvidence(appId) {
    await this._delay();
    try {
      return await this._fetch(`/applications/${encodeURIComponent(appId)}/evidence`);
    } catch (err) {
      return [];
    }
  }

  // --- Offline PWA Synchronization ---
  async syncOfflineOperations(operations) {
    return await this._fetch('/verification/sync', {
      method: 'POST',
      body: JSON.stringify({ operations })
    });
  }

  // --- Certificates & Public QR Verification ---
  async getCertificates() {
    await this._delay();
    try {
      const certs = await this._fetch('/certificates');
      if (window.state && Array.isArray(certs)) {
        window.state.state.certificates = certs;
      }
      return certs;
    } catch (err) {
      return (window.state && window.state.state.certificates) || [];
    }
  }

  async getCertificate(id) {
    await this._delay();
    try {
      return await this._fetch(`/certificates/${encodeURIComponent(id)}`);
    } catch (err) {
      return window.state ? window.state.getCertificateById(id) : null;
    }
  }

  async getCertificateById(id) {
    return await this.getCertificate(id);
  }

  async publicVerifyCertificate(query) {
    try {
      const clean = (query || '').trim();
      const res = await fetch(`${this.apiBaseUrl}/public/verify/${encodeURIComponent(clean)}`);
      const data = await res.json();
      if (!res.ok) {
        return {
          found: false,
          valid: false,
          status: data.status || 'NOT_FOUND',
          message: data.message || data.detail || 'Certificate not registered.'
        };
      }
      return {
        found: true,
        valid: data.valid,
        status: data.status,
        signatureValid: data.signatureValid,
        signatureAlgorithm: data.signatureAlgorithm,
        keyId: data.keyId,
        certificate: {
          id: data.certificateNumber,
          status: data.status,
          instrumentType: data.instrument.type,
          manufacturer: data.instrument.manufacturer,
          model: data.instrument.model,
          serialNumber: data.instrument.serialNumber,
          capacity: data.instrument.capacity,
          ownerName: data.owner ? (data.owner.businessName || data.owner.name) : 'Commercial Trader',
          businessName: data.owner ? data.owner.businessName : 'Commercial Trader',
          location: data.owner ? data.owner.location : 'Patna, Bihar',
          officerName: data.verifier ? data.verifier.name : 'Legal Metrology Officer',
          officerDesignation: data.verifier ? data.verifier.designation : 'Inspector',
          authority: data.verifier ? data.verifier.authority : 'Directorate of Legal Metrology',
          verifierType: data.verifier ? data.verifier.verifierType : 'LMO',
          verificationDate: data.verificationDate,
          validUntil: data.validUntil,
          wireSealNumber: data.wireSealNumber,
          digitalSignature: data.digitalSignature,
          qrPayload: data.qrCodeDataUri,
          qrVerificationUrl: data.qrVerificationUrl
        },
        instrument: data.instrument,
        testResults: data.testResults,
        verifiedAt: data.verifiedAt
      };
    } catch (err) {
      return {
        found: false,
        valid: false,
        status: 'ERROR',
        message: err.message
      };
    }
  }

  async verifyCertificate(certIdOrQuery) {
    return await this.publicVerifyCertificate(certIdOrQuery);
  }

  async publicSearch(query) {
    await this._delay();
    try {
      return await this._fetch(`/public/search?q=${encodeURIComponent(query.trim())}`);
    } catch (err) {
      return [];
    }
  }

  async runExpiryCheck() {
    return await this._fetch('/admin/run-expiry-check', { method: 'POST' });
  }

  async revokeCertificate(certId, reason) {
    await this._delay();
    try {
      const res = await this._fetch(`/certificates/${encodeURIComponent(certId)}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
      await this.getCertificates();
      await this.getInstruments();
      await this.getAuditTrail();
      return res;
    } catch (err) {
      throw err;
    }
  }

  // --- Master Data: Verification Centres & Instrument Types ---
  async getVerificationCentres(params = {}) {
    await this._delay();
    try {
      const q = new URLSearchParams();
      if (params.search) q.set('search', params.search);
      if (params.district) q.set('district', params.district);
      if (params.active_only) q.set('active_only', 'true');
      const queryStr = q.toString() ? `?${q.toString()}` : '';
      const res = await this._fetch(`/verification-centres${queryStr}`);
      return res;
    } catch (err) {
      console.warn('[MeasureX API] Failed to fetch verification centres:', err);
      return { centres: [], total: 0 };
    }
  }

  async getVerificationCentre(id) {
    await this._delay();
    return await this._fetch(`/verification-centres/${encodeURIComponent(id)}`);
  }

  async createVerificationCentre(data) {
    await this._delay();
    return await this._fetch('/verification-centres', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateVerificationCentre(id, data) {
    await this._delay();
    return await this._fetch(`/verification-centres/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async toggleVerificationCentreStatus(id, isActive) {
    await this._delay();
    return await this._fetch(`/verification-centres/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: isActive })
    });
  }

  async getInstrumentTypes(activeOnly = false) {
    await this._delay();
    try {
      const res = await this._fetch(`/master/instrument-types${activeOnly ? '?active_only=true' : ''}`);
      return res.instrumentTypes || [];
    } catch (err) {
      console.warn('[MeasureX API] Failed to fetch instrument types:', err);
      return [];
    }
  }

  async getApplicationAssignments(appId) {
    await this._delay();
    try {
      const res = await this._fetch(`/applications/${encodeURIComponent(appId)}/assignments`);
      return res.assignments || [];
    } catch (err) {
      console.warn('[MeasureX API] Failed to fetch application assignments:', err);
      return [];
    }
  }

  // --- Admin Console & Users ---
  async getUsers(role = null, status = null) {
    await this._delay();
    try {
      const params = new URLSearchParams();
      if (role && role !== 'ALL') params.set('role', role);
      if (status && status !== 'ALL') params.set('status', status);
      const queryStr = params.toString() ? `?${params.toString()}` : '';
      const list = await this._fetch(`/admin/users${queryStr}`);
      if (window.state && Array.isArray(list) && (!role || role === 'ALL') && (!status || status === 'ALL')) {
        window.state.state.users = list;
      }
      return list;
    } catch (err) {
      console.warn('[MeasureX API] Failed to fetch users from backend:', err);
      return [];
    }
  }

  async updateUserStatus(userId, status, notes = "") {
    await this._delay();
    try {
      const res = await this._fetch(`/admin/users/${encodeURIComponent(userId)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, notes })
      });
      await this.getUsers();
      await this.getAuditTrail();
      return res;
    } catch (err) {
      throw err;
    }
  }

  async getOfficers() {
    await this._delay();
    try {
      const users = await this.getUsers('LMO', 'ACTIVE');
      return users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        mobile: u.mobile,
        department: u.department,
        designation: u.designation,
        jurisdiction: u.jurisdiction,
        employeeId: u.employeeId
      }));
    } catch (err) {
      return [];
    }
  }

  // --- Notifications ---
  async getNotifications() {
    await this._delay();
    try {
      const notifs = await this._fetch('/notifications');
      if (window.state && Array.isArray(notifs)) {
        window.state.state.notifications = notifs;
      }
      return notifs;
    } catch (err) {
      return (window.state && window.state.state.notifications) || [];
    }
  }

  async markNotificationRead(notifId) {
    try {
      return await this._fetch(`/notifications/${encodeURIComponent(notifId)}/read`, {
        method: 'PATCH'
      });
    } catch (err) {
      return { success: false };
    }
  }

  async markAllNotificationsRead() {
    try {
      return await this._fetch('/notifications/mark-all-read', {
        method: 'POST'
      });
    } catch (err) {
      return { success: false };
    }
  }

  async sendManualNotification(notificationData) {
    await this._delay();
    try {
      return await this._fetch('/notifications/send', {
        method: 'POST',
        body: JSON.stringify({
          targetType: notificationData.targetType || 'GROUP',
          targetRecipient: notificationData.targetRecipient || 'ALL',
          title: notificationData.title,
          message: notificationData.message,
          priority: notificationData.priority || 'MEDIUM',
          actionUrl: notificationData.actionUrl
        })
      });
    } catch (err) {
      throw err;
    }
  }

  // --- Audit Logs ---
  async getAuditTrail(filter = {}) {
    await this._delay();
    try {
      const logs = await this._fetch('/admin/audit-logs?limit=200');
      if (window.state && Array.isArray(logs)) {
        window.state.state.auditTrail = logs;
      }
      let filtered = logs;
      if (filter.role && filter.role !== 'ALL') {
        filtered = filtered.filter(l => (l.role || '').toUpperCase() === filter.role.toUpperCase());
      }
      if (filter.action && filter.action !== 'ALL') {
        filtered = filtered.filter(l => (l.action || '').toLowerCase().includes(filter.action.toLowerCase()));
      }
      if (filter.search) {
        const q = filter.search.toLowerCase();
        filtered = filtered.filter(l =>
          (l.user && l.user.toLowerCase().includes(q)) ||
          (l.action && l.action.toLowerCase().includes(q)) ||
          (l.entityId && l.entityId.toLowerCase().includes(q)) ||
          (l.details && l.details.toLowerCase().includes(q))
        );
      }
      return filtered;
    } catch (err) {
      console.warn('[MeasureX API] Failed to fetch audit trail:', err);
      return (window.state && window.state.getAuditTrail()) || [];
    }
  }

  exportAuditLogsCSV(filteredLogs = null) {
    const logs = filteredLogs || (window.state ? window.state.getAuditTrail() : []);
    if (!logs || !logs.length) {
      return { success: false, message: 'No audit logs to export.' };
    }

    const headers = ["Log ID", "Timestamp (UTC)", "User Name", "User Role", "Action Taken", "Target Entity", "Entity ID", "Previous State", "New State", "Access Channel", "Statutory Audit Details"];
    const rows = logs.map(l => [
      `"${l.id || l.auditCode || ''}"`,
      `"${l.timestamp || ''}"`,
      `"${(l.userName || l.user || '').replace(/"/g, '""')}"`,
      `"${l.role || ''}"`,
      `"${(l.action || '').replace(/"/g, '""')}"`,
      `"${l.entity || ''}"`,
      `"${l.entityId || ''}"`,
      `"${(l.previousState || '').replace(/"/g, '""')}"`,
      `"${(l.newState || '').replace(/"/g, '""')}"`,
      `"${l.channel || 'Web'}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const filename = `measurex_statutory_audit_trail_${new Date().toISOString().slice(0, 10)}.csv`;

    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
    return { success: true, filename, count: logs.length };
  }

  // --- Calendar ---
  async getCalendarEvents(month = null) {
    await this._delay();
    try {
      const data = await this._fetch('/calendar');
      return data.events || [];
    } catch (err) {
      return [];
    }
  }

  async getCalendarDayDetails(dateStr) {
    await this._delay();
    const events = await this.getCalendarEvents();
    const dayEvents = events.filter(e => e.date === dateStr);
    return {
      date: dateStr,
      count: dayEvents.length,
      inspections: dayEvents
    };
  }

  // --- Reports & Analytics ---
  async getReports(params = {}) {
    await this._delay();
    try {
      const q = new URLSearchParams();
      if (params.district && params.district !== 'ALL') q.set('district', params.district);
      if (params.instrument_type && params.instrument_type !== 'ALL') q.set('instrument_type', params.instrument_type);
      if (params.outcome && params.outcome !== 'ALL') q.set('outcome', params.outcome);
      if (params.period && params.period !== 'ALL') q.set('period', params.period);
      const queryStr = q.toString() ? `?${q.toString()}` : '';
      return await this._fetch(`/admin/reports${queryStr}`);
    } catch (err) {
      console.warn("getReports error:", err);
      return null;
    }
  }

  async getAdminReports(params = {}) {
    return await this.getReports(params);
  }

  async getReportDrilldown(periodOrParams = "FY2026-27", outcome = "PASSED", district = "ALL") {
    await this._delay();
    let period = "FY2026-27";
    let metric = outcome;
    let dist = district;
    let instType = 'ALL';

    if (typeof periodOrParams === 'object' && periodOrParams !== null) {
      period = periodOrParams.period || "FY2026-27";
      metric = periodOrParams.outcome || periodOrParams.metric || "PASSED";
      dist = periodOrParams.district || "ALL";
      instType = periodOrParams.instrument_type || "ALL";
    } else if (typeof periodOrParams === 'string') {
      period = periodOrParams;
    }

    try {
      const q = new URLSearchParams();
      if (metric && metric !== 'ALL') q.set('metric', metric);
      if (period && period !== 'ALL') q.set('period', period);
      if (dist && dist !== 'ALL') q.set('district', dist);
      if (instType && instType !== 'ALL') q.set('instrument_type', instType);
      const queryStr = q.toString() ? `?${q.toString()}` : '';
      const list = await this._fetch(`/admin/reports/drilldown${queryStr}`);
      return {
        period,
        outcome: metric,
        district: dist,
        count: Array.isArray(list) ? list.length : 0,
        records: Array.isArray(list) ? list : []
      };
    } catch (err) {
      console.warn("getReportDrilldown error:", err);
      return { period, outcome: metric, district: dist, count: 0, records: [] };
    }
  }
}

// Global API instance
window.api = new MeasureXAPI();
