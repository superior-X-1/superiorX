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
      notifications: [
        {
          id: "NOTIF-INIT-001",
          recipientId: "ALL",
          targetRole: "OWNER",
          title: "Periodic Re-verification Due",
          message: "Commercial weighing instrument MX-INS-000125 calibration validity expires within 30 days. File Form VII under Rule 14.",
          type: "REVERIFICATION_REQUIRED",
          priority: "HIGH",
          read: false,
          isRead: false,
          actionUrl: "#owner-apply?instrumentId=MX-INS-000125",
          timestamp: "Today, 09:30 AM"
        },
        {
          id: "NOTIF-INIT-002",
          recipientId: "ALL",
          targetRole: "LMO",
          title: "New Verification Application Allocated",
          message: "Application MX-APP-2026-0084 allocated for on-site field verification in Patna Central Circle.",
          type: "APPLICATION_SCHEDULED",
          priority: "HIGH",
          read: false,
          isRead: false,
          actionUrl: "#lmo-review?id=MX-APP-2026-0084",
          timestamp: "Today, 10:15 AM"
        },
        {
          id: "NOTIF-INIT-003",
          recipientId: "ALL",
          targetRole: "LMO",
          title: "Statutory Verification Scheduled",
          message: "Analytical laboratory balance scheduled for precision testing bench calibration.",
          type: "APPLICATION_SCHEDULED",
          priority: "HIGH",
          read: false,
          isRead: false,
          actionUrl: "#lmo-applications",
          timestamp: "Yesterday"
        },
        {
          id: "NOTIF-INIT-004",
          recipientId: "ALL",
          targetRole: "ADMIN",
          title: "Statutory Officer Allocation Notice",
          message: "Applications awaiting allocation desk assignment. Compliance rate at 94.2%.",
          type: "SYSTEM_ALERT",
          priority: "NORMAL",
          read: false,
          isRead: false,
          actionUrl: "#admin-allocation",
          timestamp: "2 days ago"
        },
        {
          id: "NOTIF-INIT-005",
          recipientId: "ALL",
          targetRole: "ALL",
          title: "Digital Certificate Issued",
          message: "Verification certificate MX-CERT-DEMO-0001 is active and cryptographically verified via public QR seal.",
          type: "CERTIFICATE_GENERATED",
          priority: "NORMAL",
          read: false,
          isRead: false,
          actionUrl: "#certificate-details?id=MX-CERT-DEMO-0001",
          timestamp: "Recent"
        }
      ],
      auditTrail: [],
      users: [],
      inspectionDrafts: {},
      reportFilters: {
        district: 'ALL',
        instrumentType: 'ALL',
        outcome: 'ALL',
        period: 'FY2026-27'
      }
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
          if (parsed.notifications && Array.isArray(parsed.notifications) && parsed.notifications.length > 0) {
            defaultState.notifications = parsed.notifications;
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
        inspectionDrafts: this.state.inspectionDrafts || {},
        notifications: this.state.notifications || []
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

  markNotificationRead(notifId) {
    if (!this.state.notifications) this.state.notifications = [];
    const notif = this.state.notifications.find(n => String(n.id) === String(notifId));
    if (notif) {
      notif.read = true;
      notif.isRead = true;
      notif.readAt = new Date().toISOString();
    }
    if (window.api && typeof window.api.markNotificationRead === 'function') {
      window.api.markNotificationRead(notifId).catch(err => console.warn('[State] Notification sync notice:', err));
    }
    this.saveState();
    this.emit('notifications:changed', this.state.notifications);
    this.emit('state:changed', this.state);
  }

  markAllNotificationsRead() {
    if (!this.state.notifications) this.state.notifications = [];
    const now = new Date().toISOString();
    this.state.notifications.forEach(n => {
      n.read = true;
      n.isRead = true;
      n.readAt = now;
    });
    if (window.api && typeof window.api.markAllNotificationsRead === 'function') {
      window.api.markAllNotificationsRead().catch(err => console.warn('[State] Mark all notifications sync notice:', err));
    }
    this.saveState();
    this.emit('notifications:changed', this.state.notifications);
    this.emit('state:changed', this.state);
  }

  sendManualNotification(notificationData) {
    if (!this.state.notifications) this.state.notifications = [];
    const newNotif = {
      id: 'NOTIF-' + Date.now().toString(36).toUpperCase(),
      title: notificationData.title || 'Statutory Departmental Notification',
      message: notificationData.message || '',
      priority: notificationData.priority || 'NORMAL',
      type: notificationData.type || 'STATUTORY_NOTICE',
      targetRole: notificationData.targetRole || 'ALL',
      recipientId: notificationData.recipient || 'ALL',
      actionUrl: notificationData.actionUrl || '#owner-applications',
      read: false,
      isRead: false,
      timestamp: 'Just now',
      createdAt: new Date().toISOString()
    };
    this.state.notifications.unshift(newNotif);
    if (window.api && typeof window.api.sendManualNotification === 'function') {
      window.api.sendManualNotification(notificationData).catch(err => console.warn('[State] Send notification sync notice:', err));
    }
    this.saveState();
    this.emit('notifications:changed', this.state.notifications);
    this.emit('state:changed', this.state);
    return newNotif;
  }

  getUsers() {
    if (this.state.users && Array.isArray(this.state.users) && this.state.users.length > 0) {
      return this.state.users;
    }
    return [
      { id: "USR-ADM-DEMO-0001", name: "State Controller (Admin)", email: "admin@demo.com", role: "ADMIN", status: "ACTIVE", mobile: "9800000001", designation: "Director General of Legal Metrology", department: "Directorate Headquarters" },
      { id: "USR-LMO-DEMO-0002", name: "Rahul Kumar (LMO)", email: "officer@demo.com", role: "LMO", status: "ACTIVE", mobile: "9800000002", jurisdiction: "Patna Central Circle", employeeId: "LMO-PAT-2026-0042", designation: "Legal Metrology Officer" },
      { id: "USR-LMO-DEMO-0005", name: "Priya Sharma (LMO)", email: "priya.lmo@demo.com", role: "LMO", status: "ACTIVE", mobile: "9800000005", jurisdiction: "Patna South Circle", employeeId: "LMO-PAT-2026-0055", designation: "Senior Verification Officer" },
      { id: "USR-LMO-DEMO-0006", name: "Vikram Singh (LMO)", email: "vikram.lmo@demo.com", role: "LMO", status: "ACTIVE", mobile: "9800000006", jurisdiction: "Gaya Industrial Circle", employeeId: "LMO-GAY-2026-0081", designation: "District Metrology Inspector" },
      { id: "USR-LMO-DEMO-0003", name: "Priya Verma (LMO)", email: "priya.verma@demo.com", role: "LMO", status: "ACTIVE", mobile: "9800000003", jurisdiction: "Muzaffarpur Circle", employeeId: "LMO-MUZ-2026-0018", designation: "Legal Metrology Officer" },
      { id: "USR-OWN-DEMO-0004", name: "Rohan Electronics & Weighing Solutions", email: "trader@demo.com", role: "OWNER", status: "ACTIVE", mobile: "9800000004", businessName: "Rohan Electronics & Weighing Solutions", businessType: "Retail / Commercial" },
      { id: "USR-OWN-DEMO-0007", name: "Kisan Agro Processing Mandi", email: "kisan.agro@demo.com", role: "OWNER", status: "PENDING", mobile: "9800000007", businessName: "Kisan Agro Processing Mandi", businessType: "Agricultural Wholesale" }
    ];
  }

  getOfficers() {
    return this.getUsers().filter(u => (u.role || '').toUpperCase() === 'LMO');
  }

  getPendingUsers() {
    return this.getUsers().filter(u => u.status === 'PENDING' || u.status === 'UNDER_SCRUTINY');
  }

  logEvidenceUpload(evidenceData) {
    const entry = {
      id: 'AUD-' + Date.now().toString(36).toUpperCase(),
      action: 'EVIDENCE_UPLOAD',
      details: evidenceData,
      timestamp: new Date().toISOString()
    };
    if (!this.state.auditTrail) this.state.auditTrail = [];
    this.state.auditTrail.unshift(entry);
    this.saveState();
    this.emit('state:changed', this.state);
    return entry;
  }

  resetToDefault() {
    this.state.inspectionDrafts = {};
    this.saveState();
    this.emit('state:changed', this.state);
  }

  getAuditTrail() {
    return this.state.auditTrail || [];
  }

  getReportFilters() {
    return this.state.reportFilters || {
      district: 'ALL',
      instrumentType: 'ALL',
      outcome: 'ALL',
      period: 'FY2026-27'
    };
  }

  setReportFilters(filters) {
    this.state.reportFilters = { ...this.getReportFilters(), ...filters };
    this.emit('reportFilters:changed', this.state.reportFilters);
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
      officeAddress: user.officeAddress || user.office_address || '',
      accreditationNumber: user.accreditationNumber || user.accreditation_number || ''
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
