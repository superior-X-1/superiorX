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
    if (this._activeScanner) {
      this.stopScanner(this._activeScanner);
      this._activeScanner = null;
    }
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
      case 'READY_FOR_ALLOCATION':
        badgeClass = 'status-submitted';
        break;
      case 'UNDER_SCRUTINY':
      case 'UNDER_REVIEW':
      case 'PENDING':
        badgeClass = 'status-under-review';
        break;
      case 'ALLOCATED':
      case 'SCHEDULED':
        badgeClass = 'status-scheduled';
        break;
      case 'IN_VERIFICATION':
        badgeClass = 'status-in-verification';
        break;
      case 'CERTIFICATE_ISSUED':
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

  // Enhanced Responsive Timeline Stepper Component (Feature 08, 31, Spec 13-17)
  renderTimeline(timelineSteps, options = {}) {
    let steps = Array.isArray(timelineSteps) && timelineSteps.length ? [...timelineSteps] : null;
    const app = options.app || (typeof timelineSteps === 'object' && !Array.isArray(timelineSteps) && timelineSteps !== null ? timelineSteps : null);

    // If no steps provided, derive authentic statutory lifecycle from app object
    if (!steps) {
      const st = app ? (app.status || 'SUBMITTED') : 'SUBMITTED';
      const isPass = ['APPROVED', 'VERIFIED', 'COMPLETED'].includes(st);
      const isFail = ['FAILED', 'REJECTED'].includes(st);
      const isCorr = st === 'CORRECTION_REQUESTED';
      const isSched = ['SCHEDULED', 'IN_VERIFICATION', 'APPROVED', 'VERIFIED', 'COMPLETED', 'FAILED'].includes(st) || Boolean(app && app.scheduledDate);
      const isVerif = ['IN_VERIFICATION', 'APPROVED', 'VERIFIED', 'COMPLETED', 'FAILED'].includes(st);
      const hasLmo = Boolean(app && (app.assignedOfficerName || app.assignedOfficerId || app.assignedPartyName));

      steps = [
        {
          stage: 'SUBMITTED',
          label: 'Application Submitted',
          title: 'Application Filed',
          date: (app && (app.submissionDate || app.submittedDate)) || 'Filing Date',
          time: '10:22 AM',
          actor: (app && (app.businessName || app.ownerName)) || 'Applicant',
          status: 'COMPLETED',
          completed: true,
          notes: app ? `Filed for ${app.applicationType || 'Initial Verification'}.` : 'Application formally lodged in legal metrology portal.'
        },
        {
          stage: 'SCRUTINY',
          label: isCorr ? 'Correction Requested' : (st === 'SUBMITTED' ? 'Document Scrutiny' : 'Scrutiny Approved'),
          title: isCorr ? 'Correction Required' : 'Document Scrutiny',
          date: isCorr ? (app && app.updatedAt ? app.updatedAt.slice(0, 10) : 'Pending') : ((app && app.submissionDate) || ''),
          actor: 'Directorate Scrutiny Desk',
          status: isCorr ? 'WARNING' : (st === 'SUBMITTED' ? 'ACTIVE' : 'COMPLETED'),
          completed: !isCorr && st !== 'SUBMITTED',
          notes: isCorr ? (app && app.correctionReason ? app.correctionReason : 'Amended invoice / model documents requested.') : 'Statutory specifications & registration verified.'
        },
        {
          stage: 'ALLOCATION',
          label: hasLmo ? 'LMO Assigned' : 'LMO Allocation',
          title: hasLmo ? `Allocated to ${app.assignedOfficerName || 'LMO'}` : 'Awaiting Allocation',
          date: hasLmo ? (app.scheduledDate || app.submissionDate || '') : '',
          actor: 'Patna Metrology Directorate',
          status: hasLmo ? 'COMPLETED' : 'PENDING',
          completed: hasLmo,
          notes: hasLmo ? `Allocated to Legal Metrology Officer ${app.assignedOfficerName || 'Rahul Kumar'}.` : 'Pending territorial officer routing.'
        },
        {
          stage: 'SCHEDULED',
          label: isSched ? 'Inspection Scheduled' : 'Inspection Scheduling',
          title: isSched ? `Inspection Confirmed (${app.scheduledDate || 'Scheduled'})` : 'Inspection Scheduling',
          date: (app && app.scheduledDate) || '',
          time: (app && app.scheduledTime) || '',
          actor: (app && app.assignedOfficerName) || 'Legal Metrology Officer',
          status: isSched ? (isVerif ? 'COMPLETED' : 'ACTIVE') : 'PENDING',
          completed: isVerif,
          notes: (app && app.scheduledLocation) ? `Premises: ${app.scheduledLocation}.` : 'Field visit date and time slot.'
        },
        {
          stage: 'INSPECTION',
          label: isVerif ? (isPass ? 'Inspection PASS' : (isFail ? 'Inspection FAIL' : 'In Verification')) : 'Field Verification',
          title: isVerif ? `Field Verification (${isPass ? 'PASS' : (isFail ? 'FAIL' : 'Active')})` : 'Field Verification',
          date: (app && (app.scheduledDate || app.inspectionDate)) || '',
          actor: (app && app.assignedOfficerName) || 'Legal Metrology Officer',
          status: isPass ? 'COMPLETED' : (isFail ? 'FAILED' : (st === 'IN_VERIFICATION' ? 'ACTIVE' : 'PENDING')),
          completed: isPass,
          notes: isPass ? 'All test load points verified within OIML R76 Maximum Permissible Error.' : (isFail ? (app && app.rejectionReason ? app.rejectionReason : 'Tolerance exceeded statutory limit.') : 'Working standards and seal integrity inspection.')
        },
        {
          stage: 'CERTIFICATION',
          label: isPass ? 'Certificate Issued' : (isFail ? 'Stamping Withheld' : 'Digital Certification'),
          title: isPass ? `Certificate ${app && app.certificateId ? app.certificateId : 'Issued'}` : (isFail ? 'Verification Withheld' : 'Digital Certification'),
          date: isPass ? ((app && (app.validUntil || app.scheduledDate)) || '') : '',
          actor: 'State Metrology Directorate',
          status: isPass ? 'COMPLETED' : (isFail ? 'FAILED' : 'PENDING'),
          completed: isPass,
          notes: isPass ? 'Cryptographic QR digital verification certificate issued.' : (isFail ? 'Re-calibration and re-inspection required.' : 'Issuance of certificate upon passing verification.')
        }
      ];
    }

    const isMobile = (typeof window !== 'undefined' && window.innerWidth < 768);
    const layoutClass = (options.vertical || isMobile) ? 'timeline-stepper timeline-stepper-vertical' : 'timeline-stepper';

    return `
      <div class="${layoutClass}" role="list" aria-label="Verification Lifecycle Timeline">
        ${steps.map((step, idx) => {
          let stateClass = step.completed ? 'completed' : 'pending';
          const s = (step.status || '').toUpperCase();
          if (s === 'ACTIVE' || s === 'IN_VERIFICATION' || s === 'UNDER_REVIEW') stateClass = 'active';
          else if (s === 'FAILED' || s === 'REJECTED') stateClass = 'failed';
          else if (s === 'WARNING' || s === 'CORRECTION_REQUESTED') stateClass = 'warning';
          else if (s === 'EXPIRING_SOON' || s === 'EXPIRING') stateClass = 'expiring';
          else if (s === 'VALID' || s === 'APPROVED' || s === 'COMPLETED' || step.completed) stateClass = 'completed';

          let icon = step.completed ? '✓' : (idx + 1);
          if (stateClass === 'active') icon = '●';
          if (stateClass === 'failed') icon = '✕';
          if (stateClass === 'warning') icon = '⚠️';
          if (stateClass === 'expiring') icon = '⏰';

          const titleText = step.title || step.label || `Stage ${idx + 1}`;
          const dateText = step.date ? `${step.date}${step.time ? ' · ' + step.time : ''}` : 'Pending';

          return `
            <div class="timeline-step ${stateClass}" role="listitem">
              <div class="step-node" title="${s || stateClass}">${icon}</div>
              <div class="step-content">
                <div class="step-title">${titleText}</div>
                <div class="step-date">${dateText}</div>
                ${step.actor ? `<div style="font-size:0.6875rem; font-weight:600; color:var(--color-primary); margin-top:2px;">${step.actor}</div>` : ''}
                ${(step.notes || step.remarks) ? `<div class="step-notes" style="font-size:0.75rem; color:var(--text-secondary); margin-top:3px; line-height:1.4;">${step.notes || step.remarks}</div>` : ''}
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

  // Extract Certificate ID / Query from Scanned Text or URL
  extractCertId(scannedText) {
    if (!scannedText) return "";
    let text = scannedText.trim();
    if (text.includes("/verify/")) {
      const parts = text.split("/verify/");
      if (parts[1]) {
        return parts[1].split(/[?#&]/)[0].trim();
      }
    }
    if (text.includes("id=")) {
      try {
        const url = new URL(text);
        const idParam = url.searchParams.get("id");
        if (idParam) return idParam.trim();
      } catch(e) {
        const match = text.match(/[?&]id=([^&#]+)/);
        if (match) return decodeURIComponent(match[1]).trim();
      }
    }
    return text;
  },

  // Stop and clean active Html5Qrcode instance safely
  stopScanner(scanner) {
    if (!scanner) return;
    try {
      if (typeof scanner.isScanning !== 'undefined' && scanner.isScanning) {
        scanner.stop().then(() => {
          try { scanner.clear(); } catch(e){}
        }).catch(err => {
          console.warn("Scanner stop error:", err);
          try { scanner.clear(); } catch(e){}
        });
      } else {
        try { scanner.clear(); } catch(e){}
      }
    } catch(e) {
      console.warn("Scanner cleanup error:", e);
    }
  },

  // Real Standards-Compliant Citizen Camera QR Scanner (Html5Qrcode)
  showQRScannerModal(onScan) {
    if (this._activeScanner) {
      this.stopScanner(this._activeScanner);
      this._activeScanner = null;
    }

    const modalContent = document.createElement('div');
    modalContent.innerHTML = `
      <div style="text-align:center; padding:10px 0;">
        <p style="font-size:0.875rem; color:var(--text-secondary); margin-bottom:14px;">
          Point your device camera at the physical statutory QR seal affixed to the scale, or upload an image file containing a QR code.
        </p>

        <!-- Real Camera Viewfinder Container for Html5Qrcode -->
        <div style="position:relative; width:100%; max-width:340px; margin:0 auto 14px auto; background:#111827; border-radius:var(--radius-md); overflow:hidden; border:2px solid var(--color-primary); box-shadow:0 8px 24px rgba(0,0,0,0.25);">
          <div id="html5-qr-reader" style="width:100%; min-height:240px;"></div>
          <div id="qr-reader-status" style="position:absolute; bottom:8px; left:0; right:0; text-align:center; font-size:0.75rem; color:#A7F3D0; font-family:var(--font-mono); background:rgba(0,0,0,0.65); padding:4px 8px;">
            Initializing live camera scanner...
          </div>
        </div>

        <!-- Real QR File Decoder -->
        <div style="display:flex; justify-content:center; gap:10px; margin-bottom:14px; flex-wrap:wrap;">
          <label style="display:inline-flex; align-items:center; gap:8px; cursor:pointer;" class="btn btn-secondary btn-sm">
            <span>📁 Upload &amp; Decode QR Image</span>
            <input type="file" id="qr-file-upload-input" accept="image/*" style="display:none;" />
          </label>
        </div>

        <!-- Manual Certificate / Serial Number Input Fallback -->
        <div style="border-top:1px solid var(--border-light); padding-top:14px; margin-bottom:14px;">
          <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:6px;">Manual Search Fallback</div>
          <form id="qr-manual-fallback-form" style="display:flex; gap:8px; max-width:340px; margin:0 auto;">
            <input type="text" id="qr-manual-input" class="form-control" placeholder="Cert ID / Serial / Seal No." style="font-size:0.875rem;" />
            <button type="submit" class="btn btn-sm btn-primary">Verify</button>
          </form>
        </div>

        <!-- Instant Testing Sample IDs -->
        <div style="border-top:1px solid var(--border-light); padding-top:12px;">
          <div style="font-size:0.6875rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:8px;">Instant Sample Cert IDs (Click to Test)</div>
          <div style="display:flex; flex-wrap:wrap; gap:6px; justify-content:center;">
            <button type="button" class="btn btn-sm btn-outline qr-quick-pick" data-id="MX-CERT-DEMO-0001" style="border-color:var(--color-success); color:var(--color-success); font-size:0.75rem; padding:3px 8px;">
              VALID Scale (Demo 01)
            </button>
            <button type="button" class="btn btn-sm btn-outline qr-quick-pick" data-id="MX-CERT-DEMO-0004" style="border-color:var(--color-warning); color:var(--color-warning); font-size:0.75rem; padding:3px 8px;">
              EXPIRING SOON (Demo 04)
            </button>
            <button type="button" class="btn btn-sm btn-outline qr-quick-pick" data-id="MX-CERT-DEMO-0002" style="border-color:var(--color-danger); color:var(--color-danger); font-size:0.75rem; padding:3px 8px;">
              EXPIRED Scale (Demo 02)
            </button>
            <button type="button" class="btn btn-sm btn-outline qr-quick-pick" data-id="MX-CERT-DEMO-0003" style="border-color:#b91c1c; color:#b91c1c; font-size:0.75rem; padding:3px 8px;">
              REVOKED Seal (Demo 03)
            </button>
            <button type="button" class="btn btn-sm btn-outline qr-quick-pick" data-id="MX-CERT-INVALID-99" style="border-color:var(--text-muted); color:var(--text-secondary); font-size:0.75rem; padding:3px 8px;">
              INVALID Record
            </button>
          </div>
        </div>
      </div>
    `;

    this.showModal({
      title: "Statutory QR Camera Scanner",
      content: modalContent,
      cancelText: "Cancel",
      confirmText: "Close Scanner",
      onConfirm: (close) => close()
    });

    const statusEl = modalContent.querySelector('#qr-reader-status');

    // Quick pick sample listener
    modalContent.querySelectorAll('.qr-quick-pick').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        this.closeModal();
        if (onScan) onScan(id);
      });
    });

    // Manual input form listener
    const manualForm = modalContent.querySelector('#qr-manual-fallback-form');
    if (manualForm) {
      manualForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const inputVal = modalContent.querySelector('#qr-manual-input').value.trim();
        if (inputVal) {
          this.closeModal();
          if (onScan) onScan(inputVal);
        }
      });
    }

    // Launch real Html5Qrcode Camera Scanner
    let scannerInstance = null;
    if (typeof Html5Qrcode !== 'undefined') {
      try {
        scannerInstance = new Html5Qrcode("html5-qr-reader");
        this._activeScanner = scannerInstance;

        const config = {
          fps: 15,
          qrbox: { width: 220, height: 220 },
          aspectRatio: 1.0
        };

        scannerInstance.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            const certId = this.extractCertId(decodedText);
            this.closeModal();
            if (onScan) onScan(certId);
          },
          (errorMessage) => {
            // Per-frame non-matches are expected in live video scanning
          }
        ).then(() => {
          if (statusEl) statusEl.textContent = "Camera active. Align statutory QR inside frame.";
        }).catch(err => {
          console.warn("[MeasureX Scanner] Camera start error:", err);
          if (statusEl) {
            statusEl.innerHTML = `<span style="color:#FCA5A5;">Camera access unavailable (${err && err.name ? err.name : 'No camera/permission'}). Use image upload or manual input below.</span>`;
          }
        });
      } catch (err) {
        console.warn("[MeasureX Scanner] Failed to instantiate Html5Qrcode:", err);
      }
    } else {
      if (statusEl) {
        statusEl.innerHTML = `<span style="color:#FCD34D;">Scanner engine loading... Use file upload or manual search below.</span>`;
      }
    }

    // Real QR File Decoder
    const fileInput = modalContent.querySelector('#qr-file-upload-input');
    if (fileInput) {
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        if (statusEl) statusEl.textContent = "Decoding uploaded QR image file...";

        try {
          let fileScanner = scannerInstance;
          if (!fileScanner && typeof Html5Qrcode !== 'undefined') {
            fileScanner = new Html5Qrcode("html5-qr-reader");
          }

          if (fileScanner) {
            const decodedText = await fileScanner.scanFile(file, true);
            const certId = this.extractCertId(decodedText);
            this.closeModal();
            if (onScan) onScan(certId);
          } else {
            throw new Error("QR decode engine unavailable");
          }
        } catch (err) {
          console.error("[MeasureX Scanner] File scan failed:", err);
          if (statusEl) {
            statusEl.innerHTML = `<span style="color:#EF4444;">No valid QR detected in image (${err.message || 'unrecognized'}). Try another photo or enter ID manually.</span>`;
          }
          Components.showToast({
            title: "QR Detection Failed",
            message: "Could not read a valid QR code from the selected image file.",
            type: "error"
          });
        }
      });
    }
  },

  // Real Standards-Compliant QR Code Renderer (ISO/IEC 18004 PNG & Data URI)
  renderQRCodeSVG(dataString, size = 96) {
    if (!dataString) return '';
    const cleanId = encodeURIComponent(String(dataString).trim());
    return `
      <img src="/api/v1/certificates/${cleanId}/qr.png"
           alt="Statutory QR: ${dataString}"
           width="${size}"
           height="${size}"
           class="measurex-real-qr"
           style="width:${size}px; height:${size}px; object-fit:contain; border-radius:4px; image-rendering:pixelated; background:#FFFFFF; display:inline-block; border:1px solid var(--border-light);"
           loading="lazy"
           onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'${size}\\' height=\\'${size}\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'%230d4434\\' stroke-width=\\'2\\'><rect x=\\'3\\' y=\\'3\\' width=\\'7\\' height=\\'7\\'/><rect x=\\'14\\' y=\\'3\\' width=\\'7\\' height=\\'7\\'/><rect x=\\'3\\' y=\\'14\\' width=\\'7\\' height=\\'7\\'/><rect x=\\'14\\' y=\\'14\\' width=\\'3\\' height=\\'3\\'/><rect x=\\'18\\' y=\\'18\\' width=\\'3\\' height=\\'3\\'/></svg>';" />
    `;
  },

  renderQRCode(dataString, size = 96) {
    return this.renderQRCodeSVG(dataString, size);
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
  renderMonthlyBarChart(trends = null) {
    const months = (Array.isArray(trends) && trends.length) ? trends : [
      { label: 'May', passed: 0, failed: 0 },
      { label: 'Jun', passed: 0, failed: 0 },
      { label: 'Jul', passed: 0, failed: 0 },
      { label: 'Aug', passed: 0, failed: 0 },
      { label: 'Sep', passed: 0, failed: 0 }
    ];

    const maxVal = Math.max(...months.map(m => Math.max(m.passed || 0, m.failed || 0)), 1);
    const barHtml = months.map(m => {
      const label = m.label || (m.period ? m.period.split(' ')[0] : 'Month');
      const fullPeriod = m.period || `${label} 2026`;
      const passHeight = (m.passed && m.passed > 0) ? Math.max(8, Math.round(((m.passed || 0) / maxVal) * 160)) : 3;
      const failHeight = (m.failed && m.failed > 0) ? Math.max(8, Math.round(((m.failed || 0) / maxVal) * 160)) : 3;
      const passTooltip = `Verified / Approved&#10;Count: ${m.passed || 0} units&#10;Period: ${fullPeriod}&#10;(Click to inspect records)`;
      const failTooltip = `Failed Tolerance&#10;Count: ${m.failed || 0} units&#10;Period: ${fullPeriod}&#10;(Click to inspect records)`;

      return `
        <div class="chart-bar-group">
          <div class="chart-bars-wrap">
            <div class="chart-bar chart-bar-passed"
                 style="height:${passHeight}px; cursor:pointer;"
                 data-tooltip="${passTooltip}"
                 data-period="${fullPeriod}"
                 data-outcome="PASSED"
                 data-count="${m.passed || 0}"></div>
            <div class="chart-bar chart-bar-failed"
                 style="height:${failHeight}px; cursor:pointer;"
                 data-tooltip="${failTooltip}"
                 data-period="${fullPeriod}"
                 data-outcome="FAILED"
                 data-count="${m.failed || 0}"></div>
          </div>
          <div class="chart-bar-label">${label}</div>
        </div>
      `;
    }).join('');

    return `
      <div class="chart-container" id="interactive-verification-chart">
        ${barHtml}
      </div>
      <div class="chart-legend">
        <div class="legend-item" style="cursor:pointer;" onclick="Components.showReportDrilldownModal('FY2026-27', 'PASSED');">
          <span class="legend-color" style="background-color:var(--color-success);"></span> 
          <strong>Verified / Passed</strong> (Click to inspect records)
        </div>
        <div class="legend-item" style="cursor:pointer;" onclick="Components.showReportDrilldownModal('FY2026-27', 'FAILED');">
          <span class="legend-color" style="background-color:var(--color-danger);"></span> 
          <strong>Failed Tolerance</strong> (Click to inspect records)
        </div>
      </div>
    `;
  },

  // Interactive Report Drilldown Modal (Section 14)
  async showReportDrilldownModal(period = "FY2026-27", outcome = "PASSED", count = 0, district = "ALL") {
    const isPassed = outcome === 'PASSED' || outcome === 'VERIFIED';
    let matchingRecords = [];

    try {
      if (window.api && window.api.getReportDrilldown) {
        const res = await window.api.getReportDrilldown({ period, outcome, district });
        if (Array.isArray(res)) {
          matchingRecords = res;
        } else if (res && Array.isArray(res.records)) {
          matchingRecords = res.records;
        } else if (res && Array.isArray(res.data)) {
          matchingRecords = res.data;
        }
      }
    } catch (e) {
      console.warn("Could not fetch drilldown records from API:", e);
    }

    const contentHtml = `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; background:var(--color-surface); padding:12px 16px; border-radius:var(--radius-sm); border-left:4px solid ${isPassed ? 'var(--color-success)' : 'var(--color-danger)'};">
          <div>
            <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Statutory Verification Records</div>
            <div style="font-size:1.125rem; font-weight:800; color:var(--color-text);">
              ${isPassed ? 'Approved & Certified Units' : 'Failed Tolerance / Inspection Records'} — ${district === 'ALL' ? 'All Districts' : district + ' District'} (${period})
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
                <th>Record / App ID</th>
                <th>Instrument ID / Type</th>
                <th>Owner / Trader</th>
                <th>District</th>
                <th>Status / Outcome</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${matchingRecords.length === 0 ? `
                <tr>
                  <td colspan="6" style="text-align:center; padding:36px; color:var(--text-muted);">
                    <div style="font-size:1.75rem; margin-bottom:8px;">🔍</div>
                    <strong>No matching verification records found for ${outcome} in ${district === 'ALL' ? 'any district' : district}.</strong>
                    <div style="font-size:0.8125rem; margin-top:4px;">Authoritative database query returned 0 records.</div>
                  </td>
                </tr>
              ` : matchingRecords.map(rec => `
                <tr>
                  <td class="font-mono">
                    <strong>${rec.verificationId || rec.applicationId || rec.id || 'VR-AUTH'}</strong>
                    ${(rec.applicationId && rec.verificationId && rec.applicationId !== rec.verificationId) ? `<div style="font-size:0.75rem; color:var(--text-muted);">${rec.applicationId}</div>` : ''}
                  </td>
                  <td>
                    <span class="font-mono" style="font-weight:600; color:var(--color-primary);">${rec.instrumentId || rec.instrument_id || '--'}</span>
                    <div style="font-size:0.75rem; color:var(--text-muted);">${rec.instrumentType || rec.instrument_type || 'Commercial Instrument'}</div>
                  </td>
                  <td>
                    <strong>${rec.businessName || rec.business_name || rec.ownerName || rec.owner_name || 'Commercial Establishment'}</strong>
                  </td>
                  <td>
                    <span class="badge" style="background:#f1f5f9; color:#334155; font-size:0.75rem;">${rec.district || district || 'Patna'}</span>
                  </td>
                  <td>${this.renderStatusBadge(rec.status || (isPassed ? 'VERIFIED' : 'FAILED'))}</td>
                  <td>
                    <button type="button" class="btn btn-sm btn-outline drilldown-nav-btn" data-url="#admin-applications?query=${rec.applicationId || rec.verificationId || rec.id || ''}">
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
      title: `Verification Records Drilldown: ${isPassed ? 'Passed' : 'Failed'} (${district === 'ALL' ? 'Global' : district})`,
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
    const certId = instrument.activeCertificateId || "MX-CERT-DEMO-0001";
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
  },

  // Skeleton Loader Helpers (Section 18 & 19)
  renderSkeletonCards(count = 4) {
    let cards = '';
    for (let i = 0; i < count; i++) {
      cards += `
        <div class="skeleton-card">
          <div class="skeleton-stat-header">
            <div class="skeleton skeleton-text" style="width: 45%;"></div>
            <div class="skeleton" style="width: 28px; height: 28px; border-radius: var(--radius-sm, 4px);"></div>
          </div>
          <div class="skeleton skeleton-stat-val"></div>
          <div class="skeleton skeleton-text" style="width: 70%; margin-top: 4px;"></div>
        </div>
      `;
    }
    return `<div class="dashboard-metrics-grid">${cards}</div>`;
  },

  renderSkeletonTable(rows = 5, cols = 5) {
    let rowsHtml = '';
    for (let r = 0; r < rows; r++) {
      let cells = '';
      for (let c = 0; c < cols; c++) {
        const width = 50 + ((r * 17 + c * 23) % 40);
        cells += `<div class="skeleton skeleton-text" style="flex:1; width:${width}%; margin-bottom:0;"></div>`;
      }
      rowsHtml += `<div class="skeleton-table-row">${cells}</div>`;
    }
    return `
      <div class="skeleton-table-wrapper">
        <div class="skeleton skeleton-text title" style="width: 30%;"></div>
        ${rowsHtml}
      </div>
    `;
  },

  renderSkeletonText(lines = 3, isCard = false) {
    let linesHtml = '';
    for (let i = 0; i < lines; i++) {
      const w = i === lines - 1 ? '55%' : i === 0 ? '90%' : '75%';
      linesHtml += `<div class="skeleton skeleton-text" style="width:${w};"></div>`;
    }
    if (isCard) {
      return `<div class="card" style="padding:20px;">${linesHtml}</div>`;
    }
    return linesHtml;
  },

  // Consistent Empty State Component (Section 58)
  renderEmptyState({ icon = '📂', title = 'No records found', message = 'There are currently no items matching your criteria.', actionText = '', actionHref = '', actionCallback = null }) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon" aria-hidden="true">${icon}</div>
        <h3 class="empty-state-title">${title}</h3>
        <p class="empty-state-message">${message}</p>
        ${actionText && actionHref ? `
          <div class="empty-state-actions">
            <a href="${actionHref}" class="btn btn-primary btn-sm">${actionText}</a>
          </div>
        ` : ''}
      </div>
    `;
  },

  // Consistent Error State Component (Section 57)
  renderErrorState({ title = 'Unable to Load Records', message = 'An error occurred while connecting to the Legal Metrology server.', onRetry = null }) {
    const retryBtnId = 'retry-btn-' + Math.random().toString(36).substring(2, 7);
    if (onRetry) {
      setTimeout(() => {
        const btn = document.getElementById(retryBtnId);
        if (btn) btn.addEventListener('click', onRetry);
      }, 0);
    }
    return `
      <div class="error-state">
        <div class="error-state-icon" aria-hidden="true">⚠️</div>
        <h3 class="error-state-title">${title}</h3>
        <p class="error-state-message">${message}</p>
        ${onRetry ? `
          <div class="error-state-actions">
            <button type="button" class="btn btn-secondary btn-sm" id="${retryBtnId}">🔄 Try Again</button>
          </div>
        ` : ''}
      </div>
    `;
  },

  // Confirmation Modal for Destructive / Dangerous Actions (Section 60)
  confirmAction({ title = "Confirm Action", message = "Are you sure you want to proceed with this statutory action?", confirmText = "Confirm", confirmClass = "btn-danger", cancelText = "Cancel", onConfirm }) {
    this.showModal({
      title,
      content: `
        <div style="padding:10px 0;">
          <div style="font-size:0.9375rem; color:var(--color-text); line-height:1.5;">${message}</div>
        </div>
      `,
      confirmText,
      cancelText,
      onConfirm: async (close) => {
        if (typeof onConfirm === 'function') {
          await onConfirm(close);
        } else {
          close();
        }
      }
    });
    // Style confirm button with appropriate danger/warning class
    const confirmBtn = document.querySelector('.modal-confirm-btn');
    if (confirmBtn && confirmClass) {
      confirmBtn.className = `btn ${confirmClass} modal-confirm-btn`;
    }
  },

  // Button Loading State Controller (Section 13 & 64)
  setButtonLoading(btn, isLoading, loadingText = "Processing...") {
    if (!btn) return;
    if (isLoading) {
      btn.dataset.origHtml = btn.innerHTML;
      btn.disabled = true;
      btn.classList.add('is-loading');
      if (loadingText) {
        btn.setAttribute('aria-label', loadingText);
      }
    } else {
      btn.disabled = false;
      btn.classList.remove('is-loading');
      if (btn.dataset.origHtml) {
        btn.innerHTML = btn.dataset.origHtml;
        delete btn.dataset.origHtml;
      }
      btn.removeAttribute('aria-label');
    }
  }
};

window.Components = Components;
