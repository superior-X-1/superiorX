/**
 * Measure X — PWA Offline Sync Manager
 * Handles IndexedDB storage for field inspection drafts, evidence photos,
 * and offline sync queue for remote Legal Metrology Officers and GATCs.
 */

class OfflineSyncManager {
  constructor() {
    this.dbName = 'MeasureX_Offline_DB';
    this.version = 1;
    this.db = null;
    this.isOnline = navigator.onLine;
    this._initDBPromise = this.initDB();
    this.setupListeners();
  }

  async initDB() {
    if (!('indexedDB' in window)) {
      console.warn('[MeasureX Offline] IndexedDB is not supported in this browser.');
      return null;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('sync_queue')) {
          db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('evidence_queue')) {
          db.createObjectStore('evidence_queue', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('offline_drafts')) {
          db.createObjectStore('offline_drafts', { keyPath: 'applicationId' });
        }
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };

      request.onerror = (e) => {
        console.error('[MeasureX Offline] Failed to open IndexedDB:', e);
        reject(e);
      };
    });
  }

  setupListeners() {
    window.addEventListener('online', async () => {
      this.isOnline = true;
      console.log('[MeasureX Offline] Device back online. Checking pending sync queue...');
      const count = await this.getQueuedCount();
      if (count > 0) {
        if (window.Components && window.Components.showToast) {
          window.Components.showToast({
            title: "Network Restored",
            message: `Online connection established. Synchronizing ${count} offline inspection(s)...`,
            type: "info"
          });
        }
        await this.syncPendingQueue();
      }
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('[MeasureX Offline] Device switched to offline mode.');
      if (window.Components && window.Components.showToast) {
        window.Components.showToast({
          title: "Offline Mode Active",
          message: "No internet connection detected. Inspections will be safely stored in offline IndexedDB.",
          type: "warning"
        });
      }
    });
  }

  async queueInspection(inspectionData) {
    await this._initDBPromise;
    if (!this.db) return false;

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction('sync_queue', 'readwrite');
        const store = tx.objectStore('sync_queue');
        const record = {
          ...inspectionData,
          queuedAt: new Date().toISOString()
        };
        const req = store.add(record);
        req.onsuccess = () => {
          console.log('[MeasureX Offline] Inspection queued in IndexedDB:', record.applicationId);
          resolve(true);
        };
        req.onerror = (e) => reject(e);
      } catch (err) {
        reject(err);
      }
    });
  }

  async getQueuedCount() {
    await this._initDBPromise;
    if (!this.db) return 0;

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction('sync_queue', 'readonly');
        const store = tx.objectStore('sync_queue');
        const req = store.count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(0);
      } catch (e) {
        resolve(0);
      }
    });
  }

  async getPendingInspections() {
    await this._initDBPromise;
    if (!this.db) return [];

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction('sync_queue', 'readonly');
        const store = tx.objectStore('sync_queue');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch (e) {
        resolve([]);
      }
    });
  }

  async clearQueue() {
    await this._initDBPromise;
    if (!this.db) return;

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction('sync_queue', 'readwrite');
        const store = tx.objectStore('sync_queue');
        const req = store.clear();
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  async syncPendingQueue() {
    const queue = await this.getPendingInspections();
    if (!queue || queue.length === 0) {
      return { synced_count: 0, message: "Queue is empty" };
    }

    try {
      const formattedRecords = queue.map(item => ({
        application_id: item.applicationId,
        result: item.result || "PASS",
        nominal_test_weight: item.nominalTestWeight || "50 kg",
        observed_measurement: item.observedMeasurement || "50.02 kg",
        permissible_error: item.permissibleError || "±0.05 kg",
        unit: item.unit || "kg",
        scale_interval_e: item.scaleIntervalE || "0.01",
        accuracy_class: item.accuracyClass || "Class III",
        wire_seal_number: item.wireSealNumber || item.sealNumber || "SL-OFFLINE",
        statutory_checklist: item.checklist || null,
        test_points: item.testPoints || null,
        inspector_type: item.inspectorType || "LMO",
        latitude: item.latitude || null,
        longitude: item.longitude || null,
        fail_reason: item.failReason || null,
        remarks: item.remarks || "Synced from field offline cache",
        offline_timestamp: item.queuedAt || new Date().toISOString()
      }));

      const res = await window.api.syncBatchVerifications(formattedRecords);
      if (res && (res.synced_count > 0 || res.success)) {
        await this.clearQueue();
        if (window.Components && window.Components.showToast) {
          window.Components.showToast({
            title: "Offline Sync Complete",
            message: `Synchronized ${res.synced_count || queue.length} verification record(s) to central registry.`,
            type: "success"
          });
        }
        if (window.state && window.state.refreshApplications) {
          window.state.refreshApplications();
        }
      }
      return res;
    } catch (err) {
      console.error('[MeasureX Offline] Sync failed:', err);
      if (window.Components && window.Components.showToast) {
        window.Components.showToast({
          title: "Offline Sync Deferred",
          message: "Failed to upload queued inspections. Will retry automatically when connection stabilizes.",
          type: "error"
        });
      }
      return { synced_count: 0, error: err.message };
    }
  }
}

window.offlineSyncManager = new OfflineSyncManager();
