/**
 * Measure X — Centralized Reactive Client-Side State Store
 * Compliant with Pure FastAPI + MySQL 8.0 Architecture.
 * Features:
 * - Session state synchronization with signed JWT Bearer credentials
 * - Reactive Pub/Sub event bus for live UI updates
 * - NO mock database, NO localStorage user database, NO hardcoded default identities
 */

class MeasureXState {
  constructor() {
    this.STORAGE_KEY = 'measure_x_session_v2';
    this.listeners = {};
    this.state = this.loadState();
  }

  loadState() {
    const defaultState = {
      currentUser: null,
      instruments: [],
      applications: [],
      certificates: [],
      notifications: [],
      auditTrail: [],
      inspectionDrafts: {}
    };

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          if (parsed.currentUser && parsed.currentUser.id) {
            defaultState.currentUser = parsed.currentUser;
          }
          if (parsed.inspectionDrafts) {
            defaultState.inspectionDrafts = parsed.inspectionDrafts;
          }
        }
      }
    } catch (e) {
      console.warn('[MeasureX State] Could not parse stored session from localStorage:', e);
    }

    return defaultState;
  }

  saveState() {
    try {
      const minimalSession = {
        currentUser: this.state.currentUser,
        inspectionDrafts: this.state.inspectionDrafts || {}
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(minimalSession));
    } catch (e) {
      console.error('[MeasureX State] Failed to save session to localStorage', e);
    }
  }

  // Pub/Sub Event System
  subscribe(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => {
        try {
          cb(data);
        } catch (err) {
          console.error(`[MeasureX Event Bus Error in '${event}']`, err);
        }
      });
    }
    if (event !== 'state:changed') {
      this.saveState();
      if (this.listeners['state:changed']) {
        this.listeners['state:changed'].forEach(cb => {
          try {
            cb(this.state);
          } catch (e) {}
        });
      }
    }
  }

  // Getters
  getCurrentUser() {
    return this.state.currentUser;
  }

  getCurrentRole() {
    return (this.state.currentUser && this.state.currentUser.role) ? this.state.currentUser.role.toUpperCase() : 'PUBLIC';
  }

  getInstruments() {
    return this.state.instruments || [];
  }

  getInstrumentById(id) {
    return this.getInstruments().find(ins => ins.id === id);
  }

  getApplications() {
    return this.state.applications || [];
  }

  getApplicationById(id) {
    return this.getApplications().find(app => app.id === id);
  }

  getCertificates() {
    return this.state.certificates || [];
  }

  getCertificateById(id) {
    return this.getCertificates().find(c => c.id === id);
  }

  getNotifications() {
    return this.state.notifications || [];
  }

  getNotificationsForUser(user = null) {
    const u = user || this.state.currentUser;
    if (!u || u.role === 'PUBLIC') return [];
    const all = this.state.notifications || [];
    return all.filter(n => {
      if (n.recipientId && n.recipientId === u.id) return true;
      if (n.targetRole && (n.targetRole === u.role || n.targetRole === 'ALL')) return true;
      return false;
    });
  }

  getUnreadNotificationCount(user = null) {
    return this.getNotificationsForUser(user).filter(n => !n.read && !n.isRead).length;
  }

  getAuditTrail() {
    return this.state.auditTrail || [];
  }

  // Session & Identity Mutations
  setCurrentUser(user) {
    if (!user) {
      this.logout(false);
      return;
    }

    const role = (user.role || user.roleId || 'OWNER').toUpperCase();
    this.state.currentUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: role,
      status: user.status || 'ACTIVE',
      businessName: user.businessName || user.business_name || '',
      businessType: user.businessType || user.business_type || '',
      address: user.address || '',
      district: user.district || 'Patna',
      state: user.state || 'Bihar',
      pincode: user.pincode || '',
      idType: user.idType || user.id_type || '',
      idNumber: user.idNumber || user.id_number || '',
      department: user.department || '',
      designation: user.designation || '',
      employeeId: user.employeeId || user.employee_id || '',
      jurisdiction: user.jurisdiction || '',
      officeAddress: user.officeAddress || user.office_address || ''
    };

    this.saveState();
    this.emit('user:changed', this.state.currentUser);
    this.emit('role:changed', role);
  }

  setCurrentRole(role, extra = {}) {
    const targetRole = (role || 'PUBLIC').toUpperCase();

    if (!this.state.currentUser) {
      this.state.currentUser = {
        id: 'ANON',
        name: targetRole === 'PUBLIC' ? 'Public Citizen' : 'Portal User',
        role: targetRole,
        ...extra
      };
    } else {
      this.state.currentUser.role = targetRole;
      if (extra && typeof extra === 'object') {
        Object.assign(this.state.currentUser, extra);
      }
    }

    this.saveState();
    this.emit('role:changed', targetRole);
  }

  logout(clearToken = true) {
    if (clearToken && window.api && typeof window.api.clearToken === 'function') {
      window.api.clearToken();
    }
    this.state.currentUser = null;
    this.state.instruments = [];
    this.state.applications = [];
    this.state.certificates = [];
    this.state.notifications = [];
    this.state.auditTrail = [];
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      localStorage.removeItem('measurex_jwt_token');
    } catch (e) {}

    this.emit('user:logged_out', null);
    this.emit('role:changed', 'PUBLIC');
  }

  // Inspection Draft Persistence (Feature 37 Mobile Ergonomics)
  saveInspectionDraft(appId, draftData) {
    if (!this.state.inspectionDrafts) this.state.inspectionDrafts = {};
    this.state.inspectionDrafts[appId] = {
      ...draftData,
      savedAt: new Date().toISOString()
    };
    this.saveState();
    this.emit('draft:saved', { appId, draft: this.state.inspectionDrafts[appId] });
    return true;
  }

  getInspectionDraft(appId) {
    if (!this.state.inspectionDrafts) return null;
    return this.state.inspectionDrafts[appId] || null;
  }

  clearInspectionDraft(appId) {
    if (this.state.inspectionDrafts && this.state.inspectionDrafts[appId]) {
      delete this.state.inspectionDrafts[appId];
      this.saveState();
    }
  }

  // Legacy Bridge Methods (Safe Pass-Through to window.api)
  async authenticate(email, password) {
    if (window.api && typeof window.api.login === 'function') {
      return await window.api.login(email, password);
    }
    return { success: false, message: 'API service not initialized.' };
  }

  async registerUser(regData) {
    if (window.api && typeof window.api.register === 'function') {
      return await window.api.register(regData);
    }
    return { success: false, message: 'API service not initialized.' };
  }
}

// Global state instance
window.state = new MeasureXState();
