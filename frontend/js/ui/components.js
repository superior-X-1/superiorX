/**
 * Measure X — Reusable UI Components
 * - Native Modal & Toast Controllers
 * - Authentic SVG QR Code Generator
 * - Timeline Stepper Renderer
 * - Status & Expiry Badges
 * - SVG Analytics Charts
 * - Verification Calendar
 */

const Components = {
  // Modal Controller
  showModal({ title, content, footer, onConfirm, confirmText = "Confirm", cancelText = "Cancel", isLarge = false }) {
    let backdrop = document.getElementById('app-modal-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'app-modal-backdrop';
      backdrop.className = 'modal-backdrop';
      backdrop.innerHTML = `
        <div class="modal-container" role="dialog" aria-modal="true">
          <div class="modal-header">
            <h3 class="modal-title" id="modal-title-text"></h3>
            <button type="button" class="modal-close-btn" aria-label="Close modal">&times;</button>
          </div>
          <div class="modal-body" id="modal-body-content"></div>
          <div class="modal-footer" id="modal-footer-content"></div>
        </div>
      `;
      document.body.appendChild(backdrop);

      // Close handlers
      backdrop.querySelector('.modal-close-btn').addEventListener('click', () => this.closeModal());
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) this.closeModal();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && backdrop.classList.contains('open')) {
          this.closeModal();
        }
      });
    }

    const container = backdrop.querySelector('.modal-container');
    if (isLarge) container.classList.add('modal-lg');
    else container.classList.remove('modal-lg');

    document.getElementById('modal-title-text').textContent = title;
    const bodyEl = document.getElementById('modal-body-content');
    if (typeof content === 'string') {
      bodyEl.innerHTML = content;
    } else {
      bodyEl.innerHTML = '';
      bodyEl.appendChild(content);
    }

    const footerEl = document.getElementById('modal-footer-content');
    if (footer) {
      footerEl.innerHTML = footer;
    } else {
      footerEl.innerHTML = `
        <button type="button" class="btn btn-secondary modal-cancel-btn">${cancelText}</button>
        <button type="button" class="btn btn-primary modal-confirm-btn">${confirmText}</button>
      `;
      footerEl.querySelector('.modal-cancel-btn').addEventListener('click', () => this.closeModal());
      const confirmBtn = footerEl.querySelector('.modal-confirm-btn');
      if (onConfirm) {
        confirmBtn.addEventListener('click', () => onConfirm(this.closeModal));
      }
    }

    backdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
  },

  closeModal() {
    const backdrop = document.getElementById('app-modal-backdrop');
    if (backdrop && backdrop.classList.contains('open')) {
      const modal = backdrop.querySelector('.modal-container');
      if (modal) modal.classList.add('closing');
      backdrop.classList.add('closing');
      setTimeout(() => {
        if (modal) modal.classList.remove('closing');
        backdrop.classList.remove('open', 'closing');
        document.body.style.overflow = '';
      }, 190);
    }
  },

  // Toast Notification Controller
  showToast({ title, message, type = "info", duration = 4000 }) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
      </div>
      <button type="button" class="toast-close" aria-label="Close notification">&times;</button>
    `;

    const dismiss = () => {
      if (toast.classList.contains('toast-hiding')) return;
      toast.classList.add('toast-hiding');
      setTimeout(() => {
        if (toast.parentElement) toast.remove();
      }, 210);
    };

    toast.querySelector('.toast-close').addEventListener('click', dismiss);
    container.appendChild(toast);

    if (duration > 0) {
      setTimeout(dismiss, duration);
    }
  },

  // Status Badge Renderer
  renderStatusBadge(status) {
    const s = (status || 'UNKNOWN').toUpperCase();
    let badgeClass = 'status-submitted';
    let label = s.replace(/_/g, ' ');

    switch (s) {
      case 'SUBMITTED':
        badgeClass = 'status-submitted';
        break;
      case 'UNDER_REVIEW':
      case 'PENDING':
        badgeClass = 'status-under-review';
        break;
      case 'SCHEDULED':
        badgeClass = 'status-scheduled';
        break;
      case 'IN_VERIFICATION':
        badgeClass = 'status-in-verification';
        break;
      case 'APPROVED':
      case 'PASS':
      case 'VALID':
      case 'ACTIVE':
        badgeClass = 'status-valid';
        break;
      case 'FAILED':
      case 'FAIL':
      case 'REJECTED':
      case 'EXPIRED':
        badgeClass = 'status-failed';
        break;
      case 'REVOKED':
      case 'INVALID':
        badgeClass = 'status-revoked';
        break;
      case 'CORRECTION_REQUESTED':
        badgeClass = 'status-correction';
        label = 'CORRECTION NEEDED';
        break;
    }

    return `<span class="badge ${badgeClass}"><span class="badge-dot"></span>${label}</span>`;
  },

  // Expiry Countdown Badge
  renderExpiryBadge(validUntilDate) {
    if (!validUntilDate) return `<span class="badge status-submitted">UNVERIFIED</span>`;
    const target = new Date(validUntilDate);
    const now = new Date();
    const diffDays = Math.ceil((target - now) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return `<span class="badge badge-expiry-expired"><span class="badge-dot"></span>EXPIRED</span>`;
    } else if (diffDays <= 7) {
      return `<span class="badge badge-expiry-7"><span class="badge-dot"></span>${diffDays} DAYS LEFT</span>`;
    } else if (diffDays <= 30) {
      return `<span class="badge badge-expiry-30"><span class="badge-dot"></span>${diffDays} DAYS REMAINING</span>`;
    } else if (diffDays <= 60) {
      return `<span class="badge badge-expiry-60"><span class="badge-dot"></span>${diffDays} DAYS REMAINING</span>`;
    } else {
      return `<span class="badge status-valid"><span class="badge-dot"></span>ACTIVE (${diffDays} DAYS)</span>`;
    }
  },

  // Enhanced Responsive Timeline Stepper Component (Feature 08, 31)
  renderTimeline(timelineSteps, options = {}) {
    if (!timelineSteps || !timelineSteps.length) return '';
    const isMobile = (typeof window !== 'undefined' && window.innerWidth < 768);
    const layoutClass = (options.vertical || isMobile) ? 'timeline-stepper timeline-stepper-vertical' : 'timeline-stepper';

    return `
      <div class="${layoutClass}" role="list" aria-label="Verification Lifecycle Timeline">
        ${timelineSteps.map((step, idx) => {
          let stateClass = step.completed ? 'completed' : 'pending';
          if (step.status === 'IN_VERIFICATION' || step.status === 'UNDER_REVIEW') stateClass = 'active';
          if (step.status === 'FAILED' || step.status === 'REJECTED') stateClass = 'failed';
          if (step.status === 'CORRECTION_REQUESTED') stateClass = 'warning';
          if (step.status === 'EXPIRING_SOON') stateClass = 'expiring';
          if (step.status === 'VALID' || step.status === 'APPROVED') stateClass = 'completed';

          let icon = step.completed ? '✓' : (idx + 1);
          if (stateClass === 'failed') icon = '✕';
          if (stateClass === 'warning') icon = '⚠️';
          if (stateClass === 'expiring') icon = '⏰';

          return `
            <div class="timeline-step ${stateClass}" role="listitem">
              <div class="step-node" title="${step.status}">${icon}</div>
              <div class="step-content">
                <div class="step-title">${step.label}</div>
                <div class="step-date">${step.date || '--'}</div>
                ${step.notes ? `<div class="step-notes" style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">${step.notes}</div>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  // Complete Instrument Lifecycle Timeline (Unique Feature 04 & PRD 09)
  // Renders the end-to-end statutory lifecycle from registration to periodic re-verifications
  renderInstrumentLifecycleTimeline(instrument) {
    if (!instrument) return '';
    const history = instrument.verificationHistory || [];
    const validUntil = instrument.validUntil ? new Date(instrument.validUntil) : null;
    const now = new Date();
    const diffDays = validUntil ? Math.ceil((validUntil - now) / (1000 * 60 * 60 * 24)) : null;

    let lifecycleStatus = 'UNVERIFIED';
    let statusNote = 'Initial verification filing required before commercial trade.';
    if (instrument.status === 'ACTIVE') {
      if (diffDays !== null && diffDays <= 30) {
        lifecycleStatus = 'EXPIRING';
        statusNote = `Statutory verification expiring in ${diffDays} days. Schedule re-verification.`;
      } else {
        lifecycleStatus = 'VALID';
        statusNote = `Certified under Legal Metrology Rules. Active until ${instrument.validUntil}.`;
      }
    } else if (instrument.status === 'EXPIRED') {
      lifecycleStatus = 'EXPIRED';
      statusNote = 'Validity expired. Equipment is legally prohibited from commercial trade until re-verified.';
    } else if (instrument.status === 'PENDING_VERIFICATION') {
      lifecycleStatus = 'IN_PROCESS';
      statusNote = 'Verification application filed and awaiting LMO field inspection.';
    }

    return `
      <div class="instrument-lifecycle-card card" style="padding:22px; margin-bottom:24px; border-left:5px solid var(--color-primary);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap; margin-bottom:16px;">
          <div>
            <div style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.5px;">Statutory Lifecycle Status</div>
            <h3 style="font-size:1.125rem; font-weight:800; color:var(--text-primary); margin-top:2px;">
              ${instrument.id} • ${lifecycleStatus}
            </h3>
            <p style="font-size:0.8125rem; color:var(--text-secondary); margin-top:4px;">${statusNote}</p>
          </div>
          <div>
            ${this.renderStatusBadge(instrument.status)}
            ${diffDays !== null ? `<div style="margin-top:6px;">${this.renderExpiryBadge(instrument.validUntil)}</div>` : ''}
          </div>
        </div>

        <!-- Sequential Visual Lifecycle Stepper -->
        <div class="lifecycle-flow-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:12px; margin-top:16px;">
          <!-- Stage 1: Registration -->
          <div class="lifecycle-milestone completed">
            <div class="milestone-badge">✓</div>
            <div class="milestone-year">Registered</div>
            <div class="milestone-title">${instrument.purchaseDate || '2024'}</div>
            <div class="milestone-desc">Asset Enrolled</div>
          </div>

          <!-- Dynamic Stages from Verification History -->
          ${history.slice().reverse().map((h, i) => `
            <div class="lifecycle-milestone completed">
              <div class="milestone-badge">✓</div>
              <div class="milestone-year">${h.year || 'Cycle'}</div>
              <div class="milestone-title">${h.result === 'PASS' ? (i === 0 ? 'Verified' : 'Re-verified') : 'Failed'}</div>
              <div class="milestone-desc">${h.date}</div>
            </div>
          `).join('')}

          <!-- Current / Next State -->
          <div class="lifecycle-milestone ${lifecycleStatus === 'EXPIRING' ? 'warning' : lifecycleStatus === 'EXPIRED' ? 'failed' : 'active'}">
            <div class="milestone-badge">${lifecycleStatus === 'EXPIRING' ? '⚠' : lifecycleStatus === 'EXPIRED' ? '🛑' : '⚖️'}</div>
            <div class="milestone-year">${new Date().getFullYear() + 1}</div>
            <div class="milestone-title">${lifecycleStatus === 'EXPIRING' ? 'Expiring Soon' : lifecycleStatus === 'EXPIRED' ? 'Re-verify Due' : 'Valid In-Service'}</div>
            <div class="milestone-desc">${lifecycleStatus === 'EXPIRED' ? 'Apply Now' : instrument.validUntil || 'Annual Audit'}</div>
          </div>
        </div>
      </div>
    `;
  },

  // Photographic Evidence Lightbox Modal (Unique Feature 02 & 05)
  showEvidenceModal({ title = "Inspection Photographic Evidence", evidence = {}, certId = null, instrumentId = null }) {
    const evidenceCards = [
      {
        key: 'instrument',
        label: '1. Instrument Physical Condition',
        icon: '⚖️',
        desc: 'Front and full platform scale display view showing serial number plate.',
        val: evidence.instrument || 'Platform scale photograph captured on site'
      },
      {
        key: 'seal',
        label: '2. Wire / Lead Security Seal',
        icon: '🔒',
        desc: 'Tamper-evident wire security seal fastened to prevent calibration adjustment.',
        val: evidence.seal || 'Official legal metrology wire seal attached'
      },
      {
        key: 'inspection',
        label: '3. Reference Working Standards Test',
        icon: '📦',
        desc: 'Class M1 certified working standard weights applied across min/mid/max load.',
        val: evidence.inspection || 'Tolerance error test verification weights'
      },
      {
        key: 'supporting',
        label: '4. Statutory Calibration Sheet',
        icon: '📝',
        desc: 'Field verification test worksheet signed by the Legal Metrology Officer.',
        val: evidence.supporting || 'Signed inspection ledger entry and receipt'
      }
    ];

    const contentHtml = `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <div style="font-size:0.875rem; color:var(--text-secondary); line-height:1.5;">
          Photographic evidence recorded under Section 24 of the Legal Metrology Act, 2009 for record
          <strong style="color:var(--text-primary); font-family:var(--font-mono);">${instrumentId || certId || 'Verification Inspection'}</strong>.
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:16px;">
          ${evidenceCards.map(item => `
            <div style="background:var(--bg-surface-alt); border:1px solid var(--border-light); border-radius:var(--radius-md); padding:16px; text-align:center;">
              <div style="font-size:2.25rem; margin-bottom:8px;">${item.icon}</div>
              <div style="font-weight:700; font-size:0.875rem; color:var(--text-primary);">${item.label}</div>
              <div style="font-size:0.75rem; color:var(--text-muted); margin:4px 0 10px 0;">${item.desc}</div>
              <div style="display:inline-block; padding:4px 10px; background:var(--primary-100); color:var(--primary-800); border-radius:var(--radius-sm); font-size:0.6875rem; font-weight:700; font-family:var(--font-mono);">
                VERIFIED EVIDENCE
              </div>
              <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:8px; font-style:italic;">
                "${item.val}"
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    this.showModal({
      title: title,
      content: contentHtml,
      confirmText: "Close Viewer",
      isLarge: true,
      onConfirm: (close) => close()
    });
  },

  // Interactive Citizen Camera QR Scanner Modal (Unique Feature 01)
  showQRScannerModal(onScan) {
    const modalContent = document.createElement('div');
    modalContent.innerHTML = `
      <div style="text-align:center; padding:10px 0;">
        <p style="font-size:0.875rem; color:var(--text-secondary); margin-bottom:16px;">
          Point your mobile camera at the QR code affixed to any commercial scale or enter a sample certificate ID.
        </p>

        <!-- Simulated Camera Viewfinder with Scanner Radar Animation -->
        <div class="qr-camera-viewport" style="position:relative; width:100%; max-width:320px; height:240px; margin:0 auto 20px auto; background:#111827; border-radius:var(--radius-md); overflow:hidden; display:flex; align-items:center; justify-content:center; border:2px solid var(--color-primary);">
          <div class="qr-reticle-corner top-left" style="position:absolute; top:16px; left:16px; width:24px; height:24px; border-top:3px solid #10B981; border-left:3px solid #10B981;"></div>
          <div class="qr-reticle-corner top-right" style="position:absolute; top:16px; right:16px; width:24px; height:24px; border-top:3px solid #10B981; border-right:3px solid #10B981;"></div>
          <div class="qr-reticle-corner bottom-left" style="position:absolute; bottom:16px; left:16px; width:24px; height:24px; border-bottom:3px solid #10B981; border-left:3px solid #10B981;"></div>
          <div class="qr-reticle-corner bottom-right" style="position:absolute; bottom:16px; right:16px; width:24px; height:24px; border-bottom:3px solid #10B981; border-right:3px solid #10B981;"></div>
          <div class="verification-scan-beam" style="position:absolute; width:100%; height:2px; background:linear-gradient(90deg, transparent, #10B981, transparent); animation:scanSweep 1.8s infinite ease-in-out;"></div>
          <div style="color:#FFFFFF; font-size:2.5rem; opacity:0.85;">📷</div>
          <div style="position:absolute; bottom:10px; font-size:0.6875rem; color:#A7F3D0; font-family:var(--font-mono); letter-spacing:0.5px;">ALIGN QR WITHIN FRAME</div>
        </div>

        <div style="margin-bottom:16px;">
          <label style="display:inline-flex; align-items:center; gap:8px; cursor:pointer;" class="btn btn-secondary btn-sm">
            <span>📁 Upload QR Image File</span>
            <input type="file" id="qr-file-upload-input" accept="image/*" style="display:none;" />
          </label>
        </div>

        <div style="border-top:1px solid var(--border-light); padding-top:14px;">
          <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:8px;">Instant Sample Cert IDs (Click to Test)</div>
          <div style="display:flex; flex-wrap:wrap; gap:8px; justify-content:center;">
            <button type="button" class="btn btn-sm btn-outline qr-quick-pick" data-id="MX-CERT-2026-000125" style="border-color:var(--color-success); color:var(--color-success);">
              VALID Scale (2026)
            </button>
            <button type="button" class="btn btn-sm btn-outline qr-quick-pick" data-id="MX-CERT-2025-000412" style="border-color:var(--color-warning); color:var(--color-warning);">
              EXPIRED Scale (2025)
            </button>
            <button type="button" class="btn btn-sm btn-outline qr-quick-pick" data-id="MX-CERT-2026-000889" style="border-color:var(--color-danger); color:var(--color-danger);">
              REVOKED Dispenser
            </button>
            <button type="button" class="btn btn-sm btn-outline qr-quick-pick" data-id="MX-CERT-INVALID-99" style="border-color:var(--text-muted); color:var(--text-secondary);">
              INVALID Record
            </button>
          </div>
        </div>
      </div>
    `;

    this.showModal({
      title: "Public QR Camera Scanner",
      content: modalContent,
      cancelText: "Cancel",
      confirmText: "Close Scanner",
      onConfirm: (close) => close()
    });

    // Attach listeners
    modalContent.querySelectorAll('.qr-quick-pick').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        this.closeModal();
        if (onScan) onScan(id);
      });
    });

    const fileInput = modalContent.querySelector('#qr-file-upload-input');
    if (fileInput) {
      fileInput.addEventListener('change', () => {
        this.closeModal();
        // Fallback to active valid certificate for simulated QR file recognition
        if (onScan) onScan("MX-CERT-2026-000125");
      });
    }
  },

  // Authentic Vector QR Code SVG Generator
  // Creates a clean, realistic QR code with distinct alignment and finder patterns
  renderQRCodeSVG(dataString, size = 96) {
    const idHash = (dataString || 'MX-QR').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    // 21x21 QR Grid matrix simulation
    const grid = Array(21).fill(0).map(() => Array(21).fill(0));

    // Finder patterns (3 corners)
    const placeFinder = (startX, startY) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
            grid[startY + r][startX + c] = 1;
          }
        }
      }
    };
    placeFinder(0, 0);   // Top-Left
    placeFinder(14, 0);  // Top-Right
    placeFinder(0, 14);  // Bottom-Left

    // Timing patterns
    for (let i = 8; i < 13; i++) {
      grid[6][i] = i % 2 === 0 ? 1 : 0;
      grid[i][6] = i % 2 === 0 ? 1 : 0;
    }

    // Pseudorandom pseudo-data bits based on idHash
    let seed = idHash;
    for (let r = 0; r < 21; r++) {
      for (let c = 0; c < 21; c++) {
        if ((r < 8 && c < 8) || (r < 8 && c > 13) || (r > 13 && c < 8)) continue;
        seed = (seed * 9301 + 49297) % 233280;
        grid[r][c] = seed % 3 === 0 ? 1 : 0;
      }
    }

    // Convert to SVG rects
    let rects = '';
    const cellSize = size / 21;
    for (let r = 0; r < 21; r++) {
      for (let c = 0; c < 21; c++) {
        if (grid[r][c] === 1) {
          rects += `<rect x="${(c * cellSize).toFixed(1)}" y="${(r * cellSize).toFixed(1)}" width="${cellSize.toFixed(1)}" height="${cellSize.toFixed(1)}" fill="#0d4434" />`;
        }
      }
    }

    return `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="QR Code: ${dataString}">
        <rect width="${size}" height="${size}" fill="#ffffff" />
        ${rects}
      </svg>
    `;
  },

  // Verification Calendar Renderer
  renderCalendar(scheduledApps, monthOffset = 0, viewMode = 'month') {
    const baseDate = new Date(2026, 8 + monthOffset, 1); // Sept 2026 default
    const monthName = baseDate.toLocaleString('default', { month: 'long', year: 'numeric' });

    if (viewMode === 'list') {
      const sorted = [...scheduledApps].sort((a, b) => (a.scheduledDate || '').localeCompare(b.scheduledDate || ''));
      return `
        <div class="calendar-list-view">
          ${sorted.length === 0 ? '<div class="empty-state">No scheduled inspections this period.</div>' : ''}
          ${sorted.map(app => `
            <div class="calendar-list-item" data-app-id="${app.id}">
              <div>
                <strong>${app.scheduledDate || 'Date Pending'} • ${app.scheduledTime || 'TBD'}</strong>
                <div style="font-size:0.875rem; color:var(--text-secondary); margin-top:2px;">
                  ${app.instrumentType} (${app.instrumentId}) — ${app.businessName}
                </div>
                <div style="font-size:0.75rem; color:var(--text-muted);">
                  📍 ${app.preferredLocation} | Officer: ${app.assignedOfficerName || 'Unassigned'}
                </div>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                ${this.renderStatusBadge(app.status)}
                <a href="#lmo-field-verification?id=${app.id}" class="btn btn-sm btn-primary">Start Inspection</a>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    // Month Grid Calculation
    const daysInMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0).getDate();
    const firstDayIndex = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1).getDay();

    let daysHtml = '';
    // Previous month filler days
    for (let i = 0; i < firstDayIndex; i++) {
      daysHtml += `<div class="calendar-day-cell other-month"></div>`;
    }

    // Active month days
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `2026-09-${day < 10 ? '0' + day : day}`;
      const isToday = day === 28; // demo day
      const dayApps = scheduledApps.filter(a => a.scheduledDate === dayStr);

      daysHtml += `
        <div class="calendar-day-cell clickable ${isToday ? 'today' : ''} ${dayApps.length ? 'has-events' : ''}" data-date="${dayStr}" title="Click to view scheduled inspections for ${dayStr}">
          <div class="calendar-day-top">
            <span class="calendar-day-num">${day}</span>
            ${dayApps.length > 0 ? `<span class="calendar-event-count-badge">${dayApps.length}</span>` : ''}
          </div>
          ${dayApps.map(app => `
            <div class="calendar-event-chip" data-app-id="${app.id}" title="${app.instrumentType} (${app.businessName}) • ${app.scheduledTime || '11:00 AM'}">
              ${app.scheduledTime ? app.scheduledTime.split(' ')[0] : '11:00'} ${app.instrumentType ? app.instrumentType.slice(0, 12) : 'Scale'}..
            </div>
          `).join('')}
        </div>
      `;
    }

    return `
      <div class="calendar-month-grid" id="lmo-calendar-month-grid">
        <div class="calendar-day-header">Sun</div>
        <div class="calendar-day-header">Mon</div>
        <div class="calendar-day-header">Tue</div>
        <div class="calendar-day-header">Wed</div>
        <div class="calendar-day-header">Thu</div>
        <div class="calendar-day-header">Fri</div>
        <div class="calendar-day-header">Sat</div>
        ${daysHtml}
      </div>
    `;
  },

  // Interactive Date Detail Modal (Section 11)
  showDateDetailModal(dateStr) {
    const allApps = window.state.getApplications ? window.state.getApplications() : [];
    const dayApps = allApps.filter(a => a.scheduledDate === dateStr);
    
    // Parse readable date format
    let dateLabel = dateStr;
    try {
      const parts = dateStr.split('-');
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      dateLabel = d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {}

    const contentHtml = `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; background:var(--color-surface); padding:12px 16px; border-radius:var(--radius-sm); border-left:4px solid var(--color-primary);">
          <div>
            <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Scheduled Inspections</div>
            <div style="font-size:1.125rem; font-weight:800; color:var(--color-primary);">${dateLabel}</div>
          </div>
          <div style="text-align:right;">
            <span class="badge status-scheduled" style="font-size:0.8125rem; padding:4px 10px;">
              ${dayApps.length} Inspection${dayApps.length === 1 ? '' : 's'} Total
            </span>
          </div>
        </div>

        ${dayApps.length === 0 ? `
          <div style="text-align:center; padding:32px 16px; color:var(--text-muted);">
            <div style="font-size:2rem; margin-bottom:8px;">📅</div>
            <strong>No upcoming verifications scheduled for this date.</strong>
            <div style="font-size:0.8125rem; margin-top:4px;">Select another date from the monthly calendar.</div>
          </div>
        ` : `
          <div style="display:flex; flex-direction:column; gap:12px; max-height:420px; overflow-y:auto; padding-right:4px;">
            ${dayApps.map((app, index) => `
              <div class="card" style="padding:16px; border:1px solid var(--color-border); border-radius:var(--radius-sm); background:#FFFFFF;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; gap:12px; flex-wrap:wrap;">
                  <div>
                    <span style="font-size:0.75rem; font-weight:700; color:var(--color-primary); background:var(--primary-100); padding:2px 8px; border-radius:var(--radius-xs); margin-right:6px;">#${index + 1}</span>
                    <strong style="font-family:var(--font-mono); font-size:0.9375rem; color:var(--color-text);">${app.id}</strong>
                    <span style="font-size:0.8125rem; color:var(--text-secondary); margin-left:6px;">(${app.instrumentId || 'New Instrument'})</span>
                  </div>
                  <div>${this.renderStatusBadge(app.status)}</div>
                </div>

                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px 16px; font-size:0.8125rem; margin-bottom:14px; background:var(--color-surface); padding:10px 12px; border-radius:var(--radius-xs);">
                  <div>
                    <span style="color:var(--text-muted); display:block; font-size:0.6875rem; font-weight:700; text-transform:uppercase;">Owner / Establishment</span>
                    <strong style="color:var(--text-primary);">${app.businessName || app.ownerName || 'Commercial Establishment'}</strong>
                  </div>
                  <div>
                    <span style="color:var(--text-muted); display:block; font-size:0.6875rem; font-weight:700; text-transform:uppercase;">Instrument Type</span>
                    <span style="color:var(--text-primary); font-weight:600;">${app.instrumentType || 'Weighing Instrument'}</span>
                  </div>
                  <div>
                    <span style="color:var(--text-muted); display:block; font-size:0.6875rem; font-weight:700; text-transform:uppercase;">Scheduled Time</span>
                    <span style="color:var(--color-primary); font-weight:700;">⏰ ${app.scheduledTime || '11:00 AM'}</span>
                  </div>
                  <div>
                    <span style="color:var(--text-muted); display:block; font-size:0.6875rem; font-weight:700; text-transform:uppercase;">Inspection Location</span>
                    <span style="color:var(--text-primary);">📍 ${app.preferredLocation || 'Patna'}</span>
                  </div>
                  <div>
                    <span style="color:var(--text-muted); display:block; font-size:0.6875rem; font-weight:700; text-transform:uppercase;">Assigned Officer</span>
                    <span style="color:var(--text-primary); font-weight:600;">👮 ${app.assignedOfficerName || 'Rahul Kumar'}</span>
                  </div>
                </div>

                <div style="display:flex; justify-content:flex-end; gap:8px;">
                  <button type="button" class="btn btn-sm btn-outline date-modal-nav-btn" data-url="#lmo-review?id=${app.id}">
                    Review Application
                  </button>
                  <button type="button" class="btn btn-sm btn-primary date-modal-nav-btn" data-url="#lmo-field-verification?id=${app.id}">
                    Start Field Verification ➔
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;

    this.showModal({
      title: `Scheduled Field Inspections • ${dateLabel}`,
      content: contentHtml,
      confirmText: "Close View",
      isLarge: true,
      onConfirm: (close) => close()
    });

    // Attach navigation handlers to modal buttons
    const backdrop = document.getElementById('app-modal-backdrop');
    if (backdrop) {
      backdrop.querySelectorAll('.date-modal-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const url = btn.dataset.url;
          this.closeModal();
          if (url) location.hash = url;
        });
      });
    }
  },

  // Monthly Verification Analytics Chart with Interactive Hover & Drilldown (Section 14)
  renderMonthlyBarChart() {
    const months = [
      { label: 'May', passed: 42, failed: 4, scheduled: 5 },
      { label: 'Jun', passed: 58, failed: 6, scheduled: 8 },
      { label: 'Jul', passed: 65, failed: 3, scheduled: 7 },
      { label: 'Aug', passed: 72, failed: 7, scheduled: 9 },
      { label: 'Sep', passed: 84, failed: 5, scheduled: 12 }
    ];

    const maxVal = 100;
    const barHtml = months.map(m => {
      const passHeight = Math.round((m.passed / maxVal) * 160);
      const failHeight = Math.round((m.failed / maxVal) * 160);
      const passTooltip = `Verified / Approved&#10;Count: ${m.passed} units&#10;Period: ${m.label} 2026&#10;(Click to inspect records)`;
      const failTooltip = `Failed Tolerance&#10;Count: ${m.failed} units&#10;Period: ${m.label} 2026&#10;(Click to inspect records)`;

      return `
        <div class="chart-bar-group">
          <div class="chart-bars-wrap">
            <div class="chart-bar chart-bar-passed" 
                 style="height:${passHeight}px;" 
                 data-tooltip="${passTooltip}"
                 data-period="${m.label} 2026"
                 data-outcome="PASSED"
                 data-count="${m.passed}"></div>
            <div class="chart-bar chart-bar-failed" 
                 style="height:${failHeight}px;" 
                 data-tooltip="${failTooltip}"
                 data-period="${m.label} 2026"
                 data-outcome="FAILED"
                 data-count="${m.failed}"></div>
          </div>
          <div class="chart-bar-label">${m.label}</div>
        </div>
      `;
    }).join('');

    return `
      <div class="chart-container" id="interactive-verification-chart">
        ${barHtml}
      </div>
      <div class="chart-legend">
        <div class="legend-item" style="cursor:pointer;" onclick="Components.showReportDrilldownModal('Sep 2026', 'PASSED', 84);">
          <span class="legend-color" style="background-color:var(--color-success);"></span> 
          <strong>Verified / Passed</strong> (Click to view)
        </div>
        <div class="legend-item" style="cursor:pointer;" onclick="Components.showReportDrilldownModal('Sep 2026', 'FAILED', 5);">
          <span class="legend-color" style="background-color:var(--color-danger);"></span> 
          <strong>Failed Tolerance</strong> (Click to view)
        </div>
      </div>
    `;
  },

  // Interactive Report Drilldown Modal (Section 14)
  showReportDrilldownModal(period = "Sep 2026", outcome = "FAILED", count = 5) {
    const isPassed = outcome === 'PASSED' || outcome === 'VERIFIED';
    const allApps = window.state.getApplications ? window.state.getApplications() : [];
    
    let matchingRecords = [];
    if (isPassed) {
      matchingRecords = allApps.filter(a => a.status === 'APPROVED');
    } else {
      matchingRecords = allApps.filter(a => a.status === 'FAILED' || a.status === 'REJECTED' || a.failReason);
      if (!matchingRecords.length) {
        matchingRecords = [
          {
            id: "MX-APP-10021",
            instrumentId: "MX-INS-000127",
            instrumentType: "Commercial Fuel Dispenser",
            businessName: "Highway Fuels & Logistics",
            ownerName: "Vikram Singh",
            status: "FAILED",
            failReason: "MPE error +0.12 L exceeds permissible tolerance ±0.05 L",
            date: "2026-09-18"
          },
          {
            id: "MX-APP-10031",
            instrumentId: "MX-INS-000128",
            instrumentType: "Heavy Weighbridge (50 Ton)",
            businessName: "Magadh Logistics Park",
            ownerName: "Sunil Yadav",
            status: "FAILED",
            failReason: "Eccentricity load corner 3 deviation -22 kg",
            date: "2026-09-12"
          }
        ];
      }
    }

    const contentHtml = `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; background:var(--color-surface); padding:12px 16px; border-radius:var(--radius-sm); border-left:4px solid ${isPassed ? 'var(--color-success)' : 'var(--color-danger)'};">
          <div>
            <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Underlying Verification Data</div>
            <div style="font-size:1.125rem; font-weight:800; color:var(--color-text);">
              ${isPassed ? 'Approved & Certified Records' : 'Failed Tolerance & Rejected Inspections'} — ${period}
            </div>
          </div>
          <div>
            <span class="badge ${isPassed ? 'status-valid' : 'status-failed'}" style="font-size:0.8125rem; padding:4px 10px;">
              Total: ${matchingRecords.length} Record${matchingRecords.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        <div style="max-height:380px; overflow-y:auto; border:1px solid var(--color-border); border-radius:var(--radius-sm);">
          <table class="table" style="margin:0;">
            <thead>
              <tr>
                <th>Application ID</th>
                <th>Instrument ID / Type</th>
                <th>Owner / Establishment</th>
                <th>Status</th>
                <th>Remarks / Outcome</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${matchingRecords.map(rec => `
                <tr>
                  <td class="font-mono"><strong>${rec.id}</strong></td>
                  <td>
                    <span class="font-mono" style="font-weight:600; color:var(--color-primary);">${rec.instrumentId}</span>
                    <div style="font-size:0.75rem; color:var(--text-muted);">${rec.instrumentType || 'Scale'}</div>
                  </td>
                  <td>
                    <strong>${rec.businessName || rec.ownerName || 'Commercial Trader'}</strong>
                    <div style="font-size:0.75rem; color:var(--text-muted);">${rec.ownerName || ''}</div>
                  </td>
                  <td>${this.renderStatusBadge(rec.status)}</td>
                  <td style="font-size:0.8125rem; max-width:240px; color:${isPassed ? 'var(--color-success)' : 'var(--color-danger)'}; font-weight:500;">
                    ${rec.failReason || (isPassed ? 'Field tolerance within limits; Digital certificate issued.' : 'Exceeded maximum permissible error.')}
                  </td>
                  <td>
                    <button type="button" class="btn btn-sm btn-outline drilldown-nav-btn" data-url="#admin-applications?query=${rec.id}">
                      View Record
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.showModal({
      title: `Verification Records Drilldown: ${isPassed ? 'Passed' : 'Failed'} (${period})`,
      content: contentHtml,
      confirmText: "Close Report Drilldown",
      isLarge: true,
      onConfirm: (close) => close()
    });

    const backdrop = document.getElementById('app-modal-backdrop');
    if (backdrop) {
      backdrop.querySelectorAll('.drilldown-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const url = btn.dataset.url;
          this.closeModal();
          if (url) location.hash = url;
        });
      });
    }
  },

  // Complete 10-Stage Statutory Instrument Lifecycle Timeline (Section 13)
  render10StageLifecycle(instrument) {
    if (!instrument) return '';
    const now = new Date();
    const regDate = instrument.purchaseDate || "2024-01-12";
    const lastVerDate = instrument.lastVerificationDate || "2026-09-28";
    const validUntil = instrument.validUntil || "2027-09-27";
    const certId = instrument.activeCertificateId || "MX-CERT-2026-000125";
    const officerName = instrument.lastOfficer || "Rahul Kumar (LMO-BR-0842)";

    const stages = [
      {
        num: 1,
        title: "1. Instrument Registration",
        status: "COMPLETED",
        date: regDate,
        time: "10:15 AM",
        actor: `${instrument.ownerName} (${instrument.businessName})`,
        action: "Commercial Equipment Registration",
        remarks: `Enrolled ${instrument.manufacturer} ${instrument.model} (S/N: ${instrument.serialNumber}) with nominal capacity ${instrument.capacity}.`,
        relatedId: instrument.id
      },
      {
        num: 2,
        title: "2. Verification Application Filed",
        status: "COMPLETED",
        date: "2026-09-23",
        time: "10:20 AM",
        actor: instrument.ownerName,
        action: "Statutory Verification Application Submission",
        remarks: "Submitted formal filing under Section 24 of Legal Metrology Act, 2009 for mandatory stamping.",
        relatedId: "MX-APP-10025"
      },
      {
        num: 3,
        title: "3. Document Review & Scrutiny",
        status: "COMPLETED",
        date: "2026-09-23",
        time: "02:30 PM",
        actor: "Rahul Kumar (Legal Metrology Officer)",
        action: "Document Scrutiny Clearance",
        remarks: "Verified manufacturer invoice, serial number plate marking, and class accuracy compliance.",
        relatedId: "MX-APP-10025"
      },
      {
        num: 4,
        title: "4. Officer Assignment",
        status: "COMPLETED",
        date: "2026-09-24",
        time: "11:00 AM",
        actor: "Central Metrology Directorate",
        action: "Field Inspector Assignment",
        remarks: `Assigned jurisdiction officer ${officerName} for on-site physical stamping test.`,
        relatedId: "LMO-BR-0842"
      },
      {
        num: 5,
        title: "5. Scheduled Inspection",
        status: "COMPLETED",
        date: "2026-09-28",
        time: "11:30 AM",
        actor: "Rahul Kumar (LMO)",
        action: "Field Verification Appointment Scheduled",
        remarks: `Appointment confirmed at ${instrument.location}. Standard weights mobilized.`,
        relatedId: "MX-APP-10025"
      },
      {
        num: 6,
        title: "6. Field Verification & Accuracy Test",
        status: "COMPLETED",
        date: "2026-09-28",
        time: "11:45 AM",
        actor: "Rahul Kumar (LMO)",
        action: "Physical Verification with Working Standards",
        remarks: "Tested across zero load, 50% capacity, and maximum capacity. Observed deviation within legal tolerance.",
        relatedId: "MX-APP-10025"
      },
      {
        num: 7,
        title: "7. Verification Result: PASS",
        status: "COMPLETED",
        date: "2026-09-28",
        time: "12:10 PM",
        actor: "Rahul Kumar (LMO)",
        action: "Statutory Verification Pass Concluded",
        remarks: "Permissible error ±0.05 kg; observed measurement deviation +0.02 kg. Tamper-evident lead seal SL-BR-2026-9041 attached.",
        relatedId: "SL-BR-2026-9041"
      },
      {
        num: 8,
        title: "8. Digital Certificate Issued",
        status: "COMPLETED",
        date: "2026-09-28",
        time: "12:15 PM",
        actor: "Department of Legal Metrology, Bihar",
        action: "Digital Verification Certificate Generated",
        remarks: `Official digital certificate ${certId} generated with secure QR code verification payload.`,
        relatedId: certId
      },
      {
        num: 9,
        title: "9. Current Validity Window",
        status: instrument.status === 'EXPIRED' ? 'EXPIRED' : 'ACTIVE',
        date: `${lastVerDate} → ${validUntil}`,
        time: "Active Period",
        actor: "Legal Metrology Enforcement Directorate",
        action: "Commercial In-Service Operation Authorized",
        remarks: `Instrument authorized for commercial transactions under valid certificate until ${validUntil}.`,
        relatedId: certId
      },
      {
        num: 10,
        title: "10. Expiry & Re-verification Due",
        status: instrument.status === 'EXPIRED' ? 'ACTION_REQUIRED' : 'PENDING',
        date: validUntil,
        time: "Annual Re-verification Cycle",
        actor: "Instrument Owner / State Enforcement",
        action: "Statutory Re-stamping & Renewal",
        remarks: "Mandatory annual re-verification filing required 30 days prior to expiry date under Section 24.",
        relatedId: "RE-VERIFY"
      }
    ];

    return `
      <div class="lifecycle-timeline-10stage" role="list" aria-label="10-Stage Statutory Instrument Lifecycle">
        ${stages.map(step => {
          let nodeClass = 'completed';
          let icon = '✓';
          if (step.status === 'ACTIVE') {
            nodeClass = 'active';
            icon = '⚖️';
          } else if (step.status === 'EXPIRED' || step.status === 'FAILED') {
            nodeClass = 'failed';
            icon = '✕';
          } else if (step.status === 'ACTION_REQUIRED') {
            nodeClass = 'active';
            icon = '⚠️';
          } else if (step.status === 'PENDING') {
            nodeClass = 'pending';
            icon = '⏰';
          }

          return `
            <div class="lifecycle-node ${nodeClass}" role="listitem">
              <div class="lifecycle-node-point" title="${step.status}">${icon}</div>
              <div class="lifecycle-card">
                <div class="lifecycle-card-header">
                  <div class="lifecycle-step-title">${step.title}</div>
                  <div>${this.renderStatusBadge(step.status === 'COMPLETED' ? 'VALID' : step.status)}</div>
                </div>
                <div style="font-size:0.875rem; color:var(--color-text); line-height:1.45; margin-bottom:8px;">
                  ${step.remarks}
                </div>
                <div class="lifecycle-meta-grid">
                  <div>
                    <span class="lifecycle-meta-label">Date & Time</span>
                    <div class="lifecycle-meta-value">${step.date} • ${step.time}</div>
                  </div>
                  <div>
                    <span class="lifecycle-meta-label">Authorizing Actor</span>
                    <div class="lifecycle-meta-value">${step.actor}</div>
                  </div>
                  <div>
                    <span class="lifecycle-meta-label">Statutory Action</span>
                    <div class="lifecycle-meta-value">${step.action}</div>
                  </div>
                  <div>
                    <span class="lifecycle-meta-label">Related Record</span>
                    <div class="lifecycle-meta-value font-mono">
                      ${step.relatedId.startsWith('MX-CERT') ? `<a href="#owner-certificate-details?id=${step.relatedId}" style="color:var(--color-primary); font-weight:700;">${step.relatedId}</a>` :
                        step.relatedId.startsWith('MX-APP') ? `<a href="#lmo-review?id=${step.relatedId}" style="color:var(--color-primary); font-weight:700;">${step.relatedId}</a>` :
                        step.relatedId}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }
};

window.Components = Components;
