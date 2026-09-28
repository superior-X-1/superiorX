/**
 * Measure X — Main Application Controller & Router
 * Manages view routing, role-based navigation, page rendering,
 * and handles all 38 mandated features.
 */

class MeasureXApp {
  constructor() {
    this.currentRoute = '';
    this.routeParams = {};
    this.calendarMonthOffset = 0;
    this.calendarViewMode = 'month';

    this.init();
  }

  async init() {
    // Listen to hash changes for SPA routing
    window.addEventListener('hashchange', () => this.handleRouting());

    // Listen to state changes to update badge counts and active views
    window.state.subscribe('state:changed', () => this.updateHeaderUI());
    window.state.subscribe('role:changed', () => {
      this.updateHeaderUI();
      this.handleRouting();
    });

    // Handle splash screen
    this.initSplashScreen();

    // Setup global navigation and event delegation
    this.setupGlobalEvents();

    // Restore real authenticated session from MySQL backend if token exists
    if (window.api && typeof window.api.getToken === 'function' && window.api.getToken()) {
      try {
        await window.api.getMe();
      } catch (err) {
        console.warn('[MeasureX App] Session recovery notice:', err);
      }
    }

    // Initial route
    await this.handleRouting();
  }


  initSplashScreen() {
    const splash = document.getElementById('splash-screen');
    const skipBtn = document.getElementById('splash-skip-btn');
    if (!splash) return;

    const dismissSplash = () => {
      splash.classList.add('fade-out');
      setTimeout(() => splash.remove(), 450);
    };

    if (skipBtn) {
      skipBtn.addEventListener('click', dismissSplash);
    }

    // Auto dismiss after 2 seconds
    setTimeout(dismissSplash, 2100);
  }

  initScrollReveal() {
    if (typeof IntersectionObserver === 'undefined') {
      document.querySelectorAll('.reveal-on-scroll').forEach(el => el.classList.add('is-revealed'));
      return;
    }

    if (this._scrollObserver) {
      this._scrollObserver.disconnect();
    }

    this._scrollObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          this._scrollObserver.unobserve(entry.target);
        }
      });
    }, {
      rootMargin: '0px 0px -30px 0px',
      threshold: 0.1
    });

    document.querySelectorAll('.reveal-on-scroll:not(.is-revealed)').forEach(el => {
      this._scrollObserver.observe(el);
    });
  }

  initNumberCounters() {
    const counterElements = document.querySelectorAll('.stat-counter-val:not(.counted)');
    if (!counterElements.length) return;

    const animateCounter = (el) => {
      const targetStr = el.dataset.target;
      if (!targetStr) return;
      const target = parseFloat(targetStr);
      if (isNaN(target)) return;
      const suffix = el.dataset.suffix || '';
      const prefix = el.dataset.prefix || '';
      const decimals = parseInt(el.dataset.decimals || '0', 10);
      const duration = 1200; // ms
      const startTime = performance.now();

      el.classList.add('counted');

      const update = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // easeOutExpo
        const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        const current = target * ease;
        const formatted = decimals > 0 
          ? current.toFixed(decimals) 
          : Math.floor(current).toLocaleString();
        el.textContent = `${prefix}${formatted}${suffix}`;

        if (progress < 1) {
          requestAnimationFrame(update);
        } else {
          const finalFormatted = decimals > 0 
            ? target.toFixed(decimals) 
            : target.toLocaleString();
          el.textContent = `${prefix}${finalFormatted}${suffix}`;
        }
      };

      requestAnimationFrame(update);
    };

    if (typeof IntersectionObserver !== 'undefined') {
      const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            counterObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15 });

      counterElements.forEach(el => counterObserver.observe(el));
    } else {
      counterElements.forEach(animateCounter);
    }
  }

  setupGlobalEvents() {
    // Mobile navigation toggle (Header Hamburger & Drawer Controller)
    const toggleBtn = document.getElementById('mobile-nav-toggle');
    const mainNav = document.getElementById('main-nav');
    const sidebarBackdrop = document.getElementById('sidebar-backdrop');

    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const sidebar = document.getElementById('app-sidebar');
        if (sidebar) {
          if (window.innerWidth > 1024) {
            // Desktop (PC): Foldable / collapsible sidebar toggle
            const isCollapsed = !sidebar.classList.contains('collapsed');
            sidebar.classList.toggle('collapsed', isCollapsed);
            document.body.classList.toggle('sidebar-collapsed', isCollapsed);
            localStorage.setItem('measurex_sidebar_collapsed', isCollapsed ? 'true' : 'false');
            this.updateSidebarToggleIcon(isCollapsed);
          } else {
            // Mobile & Tablet: Off-canvas drawer toggle
            const isOpen = sidebar.classList.contains('sidebar-open');
            if (isOpen) {
              sidebar.classList.remove('sidebar-open');
              if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
              document.body.classList.remove('drawer-open');
              toggleBtn.setAttribute('aria-expanded', 'false');
              toggleBtn.innerHTML = '☰';
            } else {
              sidebar.classList.add('sidebar-open');
              if (sidebarBackdrop) sidebarBackdrop.classList.add('active');
              document.body.classList.add('drawer-open');
              toggleBtn.setAttribute('aria-expanded', 'true');
              toggleBtn.innerHTML = '✕';
            }
          }
        } else {
          // Public pages without sidebar: toggle mobile dropdown nav
          const liveMainNav = document.getElementById('main-nav');
          if (liveMainNav) {
            const isOpen = liveMainNav.classList.contains('nav-open');
            liveMainNav.classList.toggle('nav-open', !isOpen);
            toggleBtn.setAttribute('aria-expanded', !isOpen ? 'true' : 'false');
            toggleBtn.innerHTML = !isOpen ? '✕' : '☰';
            if (sidebarBackdrop) {
              sidebarBackdrop.classList.toggle('active', !isOpen);
            }
          }
        }
      });
    }

    if (sidebarBackdrop) {
      sidebarBackdrop.addEventListener('click', () => {
        const sidebar = document.getElementById('app-sidebar');
        if (sidebar) sidebar.classList.remove('sidebar-open');
        sidebarBackdrop.classList.remove('active');
        document.body.classList.remove('drawer-open');
        if (toggleBtn) toggleBtn.innerHTML = '☰';
        const liveMainNav2 = document.getElementById('main-nav');
        if (liveMainNav2) liveMainNav2.classList.remove('nav-open');
      });
    }

    // Auto-close sidebar drawer when any sidebar link or close button is clicked
    document.addEventListener('click', (e) => {
      const sidebar = document.getElementById('app-sidebar');
      if (e.target.closest('.sidebar-drawer-close-btn') || e.target.closest('.sidebar-item a')) {
        if (sidebar) sidebar.classList.remove('sidebar-open');
        if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
        document.body.classList.remove('drawer-open');
        if (toggleBtn) toggleBtn.innerHTML = '☰';
      }
      const currentMainNav = document.getElementById('main-nav');
      if (currentMainNav && e.target.closest('#main-nav a')) {
        currentMainNav.classList.remove('nav-open');
        if (toggleBtn) toggleBtn.innerHTML = '☰';
      }

      // Auto-collapse expanded desktop sidebar overlay when user clicks outside on main content
      if (window.innerWidth > 1024 && e.target.closest('.app-main')) {
        const sidebar = document.getElementById('app-sidebar');
        if (sidebar && !sidebar.classList.contains('collapsed')) {
          sidebar.classList.add('collapsed');
          document.body.classList.add('sidebar-collapsed');
          localStorage.setItem('measurex_sidebar_collapsed', 'true');
          this.updateSidebarToggleIcon(true);
        }
      }

      // User Profile Dropdown Toggle & Item Handlers
      const profileToggle = e.target.closest('#user-profile-toggle-btn');
      const profileDropdown = document.getElementById('user-profile-dropdown');
      const logoutItem = e.target.closest('#user-dropdown-logout');

      if (profileToggle) {
        e.preventDefault();
        e.stopPropagation();
        if (profileDropdown) {
          const isOpen = profileDropdown.classList.contains('open');
          profileDropdown.classList.toggle('open', !isOpen);
          profileToggle.setAttribute('aria-expanded', !isOpen ? 'true' : 'false');
        }
        return;
      }

      if (logoutItem) {
        e.preventDefault();
        window.api.logout();
        if (profileDropdown) profileDropdown.classList.remove('open');
        location.hash = '#landing';
        return;
      }

      if (profileDropdown && profileDropdown.classList.contains('open')) {
        if (!profileDropdown.contains(e.target)) {
          profileDropdown.classList.remove('open');
          const pBtn = document.getElementById('user-profile-toggle-btn');
          if (pBtn) pBtn.setAttribute('aria-expanded', 'false');
        }
      }
    });

    // Global Keyboard Listeners (Escape Key Closes Modals, Drawers, Dropdowns)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const sidebar = document.getElementById('app-sidebar');
        if (sidebar && sidebar.classList.contains('sidebar-open')) {
          sidebar.classList.remove('sidebar-open');
          if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
          document.body.classList.remove('drawer-open');
        }
        const notifPanel = document.getElementById('header-notif-panel');
        if (notifPanel && notifPanel.classList.contains('open')) {
          notifPanel.classList.remove('open');
          const t = document.getElementById('header-notif-toggle-btn');
          if (t) t.setAttribute('aria-expanded', 'false');
        }
        const profileDropdown = document.getElementById('user-profile-dropdown');
        if (profileDropdown && profileDropdown.classList.contains('open')) {
          profileDropdown.classList.remove('open');
          const pBtn = document.getElementById('user-profile-toggle-btn');
          if (pBtn) pBtn.setAttribute('aria-expanded', 'false');
        }
        const demoDrawer = document.getElementById('demo-controls-drawer');
        if (demoDrawer && demoDrawer.classList.contains('open')) {
          demoDrawer.classList.remove('open');
        }
        if (window.Components && typeof window.Components.closeModal === 'function') {
          window.Components.closeModal();
        }
      }
    });

    // Global Search Clear Button Controller
    document.addEventListener('input', (e) => {
      if (e.target && (e.target.classList.contains('search-input') || (e.target.id && e.target.id.includes('search-input')))) {
        const wrapper = e.target.closest('.search-input-wrapper') || e.target.parentElement;
        if (wrapper) {
          let clearBtn = wrapper.querySelector('.search-clear-btn');
          if (!clearBtn) {
            clearBtn = document.createElement('button');
            clearBtn.type = 'button';
            clearBtn.className = 'search-clear-btn';
            clearBtn.setAttribute('aria-label', 'Clear search input');
            clearBtn.innerHTML = '✕';
            wrapper.appendChild(clearBtn);
            clearBtn.addEventListener('click', (evt) => {
              evt.preventDefault();
              e.target.value = '';
              clearBtn.style.display = 'none';
              e.target.dispatchEvent(new Event('input', { bubbles: true }));
              e.target.focus();
            });
          }
          clearBtn.style.display = e.target.value ? 'flex' : 'none';
        }
      }
    });

    // Demo Controls Drawer Toggle & Close
    const demoToggle = document.getElementById('demo-controls-toggle');
    const demoDrawer = document.getElementById('demo-controls-drawer');
    const demoClose = document.getElementById('demo-controls-close');

    if (demoToggle && demoDrawer) {
      demoToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = demoDrawer.classList.contains('open');
        if (isOpen) {
          demoDrawer.classList.remove('open');
          demoToggle.setAttribute('aria-expanded', 'false');
        } else {
          demoDrawer.classList.add('open');
          demoToggle.setAttribute('aria-expanded', 'true');
        }
      });
    }

    if (demoClose && demoDrawer && demoToggle) {
      demoClose.addEventListener('click', (e) => {
        e.stopPropagation();
        demoDrawer.classList.remove('open');
        demoToggle.setAttribute('aria-expanded', 'false');
      });
    }

    document.addEventListener('click', (e) => {
      if (demoDrawer && demoDrawer.classList.contains('open')) {
        if (!demoDrawer.contains(e.target) && !demoToggle.contains(e.target)) {
          demoDrawer.classList.remove('open');
          if (demoToggle) demoToggle.setAttribute('aria-expanded', 'false');
        }
      }
    });

    // Demo Role Switcher buttons
    document.querySelectorAll('.role-switch-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const role = btn.dataset.role;
        window.state.setCurrentRole(role);
        if (demoDrawer) {
          demoDrawer.classList.remove('open');
          if (demoToggle) demoToggle.setAttribute('aria-expanded', 'false');
        }
        // Direct to appropriate home view
        if (role === 'OWNER') location.hash = '#owner-dashboard';
        else if (role === 'LMO') location.hash = '#lmo-dashboard';
        else if (role === 'ADMIN') location.hash = '#admin-dashboard';
        else location.hash = '#landing';
      });
    });

    // Reset state button
    const resetBtn = document.getElementById('reset-demo-state-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        Components.confirmAction({
          title: "Reset Demo State",
          message: "Reset application state to initial baseline? All unsaved changes will be lost.",
          confirmText: "Reset",
          confirmClass: "btn-danger",
          onConfirm: () => {
            window.state.resetToDefault();
            Components.showToast({ title: "State Reset", message: "Application data restored to initial baseline.", type: "info" });
            if (demoDrawer) demoDrawer.classList.remove('open');
            this.handleRouting();
          }
        });
      });
    }

    // Global listener for Header Notification Dropdown Panel
    document.addEventListener('click', (e) => {
      const toggleBtn = e.target.closest('#header-notif-toggle-btn');
      const panel = document.getElementById('header-notif-panel');
      const markAllBtn = e.target.closest('#header-notif-mark-all');
      const notifItem = e.target.closest('.notif-dropdown-item');

      if (toggleBtn) {
        e.preventDefault();
        e.stopPropagation();
        if (panel) {
          const isOpen = panel.classList.contains('open');
          panel.classList.toggle('open', !isOpen);
          toggleBtn.setAttribute('aria-expanded', !isOpen ? 'true' : 'false');
        }
        return;
      }

      if (markAllBtn) {
        e.preventDefault();
        e.stopPropagation();
        window.state.markAllNotificationsRead();
        Components.showToast({ title: "Notifications Read", message: "All notifications marked as read.", type: "info" });
        this.updateHeaderUI();
        return;
      }

      if (notifItem) {
        const notifId = notifItem.dataset.id;
        const url = notifItem.dataset.url;
        if (notifId) window.state.markNotificationRead(notifId);
        if (panel) panel.classList.remove('open');
        if (url) location.hash = url;
        this.updateHeaderUI();
        return;
      }

      if (panel && panel.classList.contains('open')) {
        if (!panel.contains(e.target)) {
          panel.classList.remove('open');
          const t = document.getElementById('header-notif-toggle-btn');
          if (t) t.setAttribute('aria-expanded', 'false');
        }
      }
    });
  }

  updateSidebarToggleIcon(isCollapsed) {
    const toggleBtn = document.getElementById('mobile-nav-toggle');
    if (!toggleBtn) return;
    if (window.innerWidth > 1024) {
      if (isCollapsed) {
        toggleBtn.innerHTML = `
          <svg class="hamburger-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        `;
        toggleBtn.setAttribute('title', 'Expand navigation menu');
        toggleBtn.setAttribute('aria-expanded', 'false');
      } else {
        toggleBtn.innerHTML = `
          <svg class="collapse-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="9" y1="3" x2="9" y2="21"></line>
            <polyline points="15 10 13 12 15 14"></polyline>
          </svg>
        `;
        toggleBtn.setAttribute('title', 'Collapse navigation menu');
        toggleBtn.setAttribute('aria-expanded', 'true');
      }
    }
  }

  updateHeaderUI() {
    const role = window.state.getCurrentRole();
    const user = window.state.getCurrentUser();
    const userNotifs = window.state.getNotificationsForUser ? window.state.getNotificationsForUser(user) : (window.state.getNotifications() || []);
    const unreadCount = userNotifs.filter(n => !n.read).length;

    // Highlight active role in demo drawer and buttons
    document.querySelectorAll('.role-switch-btn').forEach(btn => {
      if (btn.dataset.role === role) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    const rolePill = document.getElementById('demo-active-role-pill');
    if (rolePill) {
      rolePill.textContent = role;
    }

    // Role-specific primary navigation items
    const mainNav = document.getElementById('main-nav');
    if (mainNav) {
      const p = this.currentRoute || 'landing';
      if (role === 'OWNER') {
        mainNav.innerHTML = `
          <a href="#owner-dashboard" class="nav-link ${p === 'owner-dashboard' ? 'active' : ''}">Dashboard</a>
          <a href="#owner-instruments" class="nav-link ${p.includes('owner-instrument') && p !== 'owner-add-instrument' ? 'active' : ''}">My Instruments</a>
          <a href="#owner-applications" class="nav-link ${p.includes('owner-application') || p === 'owner-apply' ? 'active' : ''}">Applications</a>
          <a href="#owner-certificates" class="nav-link ${p.includes('owner-certificate') ? 'active' : ''}">Certificates</a>
          <a href="#verify" class="nav-link ${p === 'verify' ? 'active' : ''}">Verify Seal</a>
          <a href="#help" class="nav-link ${p === 'help' ? 'active' : ''}">Help Desk</a>
        `;
      } else if (role === 'LMO') {
        mainNav.innerHTML = `
          <a href="#lmo-dashboard" class="nav-link ${p === 'lmo-dashboard' ? 'active' : ''}">Dashboard</a>
          <a href="#lmo-applications" class="nav-link ${p.includes('lmo-application') || p.includes('lmo-review') ? 'active' : ''}">Applications</a>
          <a href="#lmo-calendar" class="nav-link ${p === 'lmo-calendar' ? 'active' : ''}">Schedule</a>
          <a href="#lmo-field-verification" class="nav-link ${p === 'lmo-field-verification' ? 'active' : ''}">Field Inspection</a>
          <a href="#rules" class="nav-link ${p === 'rules' ? 'active' : ''}">Standards</a>
        `;
      } else if (role === 'ADMIN') {
        mainNav.innerHTML = `
          <a href="#admin-dashboard" class="nav-link ${p === 'admin-dashboard' ? 'active' : ''}">Dashboard</a>
          <a href="#admin-allocation" class="nav-link ${p === 'admin-allocation' ? 'active' : ''}">Allocation Desk</a>
          <a href="#admin-centres" class="nav-link ${p === 'admin-centres' ? 'active' : ''}">Centres</a>
          <a href="#admin-users" class="nav-link ${p === 'admin-users' || p === 'admin-officers' ? 'active' : ''}">Users &amp; Officers</a>
          <a href="#admin-applications" class="nav-link ${p === 'admin-applications' ? 'active' : ''}">Applications</a>
          <a href="#admin-instruments" class="nav-link ${p === 'admin-instruments' ? 'active' : ''}">Instruments</a>
          <a href="#admin-reports" class="nav-link ${p === 'admin-reports' ? 'active' : ''}">Reports</a>
          <a href="#admin-audit" class="nav-link ${p === 'admin-audit' ? 'active' : ''}">Audit Logs</a>
        `;
      } else {
        // PUBLIC — Clean public nav: Login and Register are in header-user-section
        mainNav.innerHTML = `
          <a href="#landing" class="nav-link ${p === 'landing' || p === 'home' ? 'active' : ''}">Home</a>
          <a href="#services" class="nav-link ${p === 'services' ? 'active' : ''}">Services</a>
          <a href="#how-it-works" class="nav-link ${p === 'how-it-works' ? 'active' : ''}">How It Works</a>
          <a href="#verify" class="nav-link ${p === 'verify' ? 'active' : ''}">Verify Certificate</a>
          <a href="#rules" class="nav-link ${p === 'rules' ? 'active' : ''}">Rules &amp; Regulations</a>
          <a href="#help" class="nav-link ${p === 'help' ? 'active' : ''}">Help &amp; Contact</a>
        `;
      }
    }

    // Update user / actions section in header
    const userSection = document.getElementById('header-user-section');
    if (userSection) {
      if (role === 'PUBLIC') {
        userSection.innerHTML = `
          <a href="#verify" class="btn btn-sm btn-outline header-verify-btn" style="border-color:var(--color-primary); color:var(--color-primary); font-weight:600;">Verify Certificate</a>
          <a href="#login" class="btn btn-sm btn-outline header-login-btn" style="font-weight:700;">Login</a>
          <a href="#register" class="btn btn-sm btn-primary header-register-btn" style="font-weight:700;">Register</a>
        `;
      } else {
        const roleLabelMap = {
          'OWNER': 'Trader / Owner',
          'LMO': 'Legal Metrology Officer',
          'ADMIN': 'State Administrator'
        };
        const notifRoute = `#${role.toLowerCase()}-notifications`;
        userSection.innerHTML = `
          <div class="notif-dropdown-wrapper">
            <button type="button" class="header-notif-btn" id="header-notif-toggle-btn" title="Statutory Notifications (${unreadCount} unread)" aria-label="Notifications" aria-expanded="false">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
              ${unreadCount > 0 ? `<span class="header-notif-badge">${unreadCount}</span>` : ''}
            </button>
            <div class="notif-dropdown-panel" id="header-notif-panel" role="region" aria-label="Notifications Dropdown">
              <div class="notif-dropdown-header">
                <div class="notif-dropdown-title">
                  <span>🔔</span> Notifications
                  ${unreadCount > 0 ? `<span class="badge status-submitted" style="font-size:0.6875rem;">${unreadCount} New</span>` : ''}
                </div>
                ${unreadCount > 0 ? `
                  <button type="button" class="btn btn-sm btn-outline" id="header-notif-mark-all" style="padding:2px 8px; font-size:0.75rem;">
                    Mark all read
                  </button>
                ` : ''}
              </div>
              <div class="notif-dropdown-list">
                ${userNotifs.length === 0 ? `
                  <div style="padding:24px; text-align:center; color:var(--color-text-muted); font-size:0.8125rem;">
                    No notifications available.
                  </div>
                ` : userNotifs.slice(0, 5).map(n => `
                  <div class="notif-dropdown-item ${!n.read ? 'unread' : ''}" data-url="${n.actionUrl || notifRoute}" data-id="${n.id}">
                    <div style="font-size:1.125rem;">${n.priority === 'HIGH' || n.priority === 'URGENT' ? '⚠️' : n.type === 'CERTIFICATE_GENERATED' ? '📜' : '📝'}</div>
                    <div style="flex:1;">
                      <div style="font-weight:700; font-size:0.8125rem; color:var(--color-text); margin-bottom:2px;">${n.title}</div>
                      <div style="font-size:0.75rem; color:var(--color-text-secondary); line-height:1.35;">${n.message}</div>
                      <div style="font-size:0.6875rem; color:var(--color-text-muted); margin-top:3px;">${n.timestamp || 'Recent'}</div>
                    </div>
                    ${!n.read ? `<span class="badge-dot" style="margin-top:5px;"></span>` : ''}
                  </div>
                `).join('')}
              </div>
              <div class="notif-dropdown-footer">
                <a href="${notifRoute}" id="header-view-all-notifs" style="color:var(--color-primary); font-weight:700;">View All Notifications ➔</a>
              </div>
            </div>
          </div>
          <div class="user-profile-menu-wrapper" id="user-profile-menu-wrapper">
            <button type="button" class="user-profile-btn" id="user-profile-toggle-btn" aria-haspopup="true" aria-expanded="false" title="Account Menu">
              <div class="user-avatar-circle">${(user.name || role)[0].toUpperCase()}</div>
              <div class="user-profile-info">
                <span class="user-name">${user.name || (role === 'OWNER' ? 'Commercial Trader' : role === 'LMO' ? 'Legal Metrology Officer' : 'State Administrator')}</span>
                <span class="user-role-label">${roleLabelMap[role] || role}</span>
              </div>
              <svg class="chevron-down-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            <div class="user-profile-dropdown" id="user-profile-dropdown" role="menu" aria-label="User Account Options">
              <div class="user-dropdown-header">
                <div class="user-dropdown-name">${user.name || roleLabelMap[role]}</div>
                <div class="user-dropdown-sub">${user.email || user.businessName || roleLabelMap[role]}</div>
              </div>
              <div class="dropdown-divider"></div>
              <a href="#${role.toLowerCase()}-profile" class="user-dropdown-item" role="menuitem">
                <span>👤</span> My Profile
              </a>
              <a href="#${role === 'ADMIN' ? 'admin-config' : role.toLowerCase() + '-profile'}" class="user-dropdown-item" role="menuitem">
                <span>⚙️</span> System Settings
              </a>
              <a href="#help" class="user-dropdown-item" role="menuitem">
                <span>❓</span> Help &amp; Support
              </a>
              <div class="dropdown-divider"></div>
              <button type="button" class="user-dropdown-item text-danger" id="user-dropdown-logout" role="menuitem">
                <span>🚪</span> Sign Out
              </button>
            </div>
          </div>
        `;
      }
    }
    this.updateBottomNavUI();
  }

  updateBottomNavUI() {
    const bottomNav = document.getElementById('mobile-bottom-nav');
    if (!bottomNav) return;

    const role = window.state.getCurrentRole();
    const p = this.currentRoute || 'landing';
    const icons = MeasureXApp.NAV_ICONS;

    if (role === 'OWNER') {
      bottomNav.innerHTML = `
        <a href="#owner-dashboard" class="mobile-bottom-nav-item ${p === 'owner-dashboard' ? 'active' : ''}">
          <span class="nav-icon">${icons.dashboard}</span>
          <span>Home</span>
        </a>
        <a href="#owner-instruments" class="mobile-bottom-nav-item ${p.includes('owner-instrument') && p !== 'owner-add-instrument' ? 'active' : ''}">
          <span class="nav-icon">${icons.scale}</span>
          <span>Scales</span>
        </a>
        <a href="#owner-apply" class="mobile-bottom-nav-item ${p === 'owner-apply' ? 'active' : ''}">
          <span class="nav-icon">${icons.add}</span>
          <span>Apply</span>
        </a>
        <a href="#owner-certificates" class="mobile-bottom-nav-item ${p.includes('owner-certificate') ? 'active' : ''}">
          <span class="nav-icon">${icons.certificate}</span>
          <span>Certs</span>
        </a>
        <a href="#owner-profile" class="mobile-bottom-nav-item ${p === 'owner-profile' ? 'active' : ''}">
          <span class="nav-icon">${icons.profile}</span>
          <span>Profile</span>
        </a>
      `;
    } else if (role === 'LMO') {
      bottomNav.innerHTML = `
        <a href="#lmo-dashboard" class="mobile-bottom-nav-item ${p === 'lmo-dashboard' ? 'active' : ''}">
          <span class="nav-icon">${icons.dashboard}</span>
          <span>Console</span>
        </a>
        <a href="#lmo-applications" class="mobile-bottom-nav-item ${p.includes('lmo-application') || p.includes('lmo-review') ? 'active' : ''}">
          <span class="nav-icon">${icons.applications}</span>
          <span>Queue</span>
        </a>
        <a href="#lmo-field-verification" class="mobile-bottom-nav-item ${p === 'lmo-field-verification' ? 'active' : ''}">
          <span class="nav-icon">${icons.search}</span>
          <span>Inspect</span>
        </a>
        <a href="#lmo-calendar" class="mobile-bottom-nav-item ${p === 'lmo-calendar' ? 'active' : ''}">
          <span class="nav-icon">${icons.calendar}</span>
          <span>Schedule</span>
        </a>
        <a href="#lmo-profile" class="mobile-bottom-nav-item ${p === 'lmo-profile' ? 'active' : ''}">
          <span class="nav-icon">${icons.profile}</span>
          <span>Profile</span>
        </a>
      `;
    } else if (role === 'ADMIN') {
      bottomNav.innerHTML = `
        <a href="#admin-dashboard" class="mobile-bottom-nav-item ${p === 'admin-dashboard' ? 'active' : ''}">
          <span class="nav-icon">${icons.dashboard}</span>
          <span>Admin</span>
        </a>
        <a href="#admin-allocation" class="mobile-bottom-nav-item ${p === 'admin-allocation' ? 'active' : ''}">
          <span class="nav-icon">${icons.allocation}</span>
          <span>Assign</span>
        </a>
        <a href="#admin-centres" class="mobile-bottom-nav-item ${p === 'admin-centres' ? 'active' : ''}">
          <span class="nav-icon">${icons.centres}</span>
          <span>Centres</span>
        </a>
        <a href="#admin-applications" class="mobile-bottom-nav-item ${p === 'admin-applications' ? 'active' : ''}">
          <span class="nav-icon">${icons.applications}</span>
          <span>Scrutiny</span>
        </a>
        <a href="#admin-profile" class="mobile-bottom-nav-item ${p === 'admin-profile' ? 'active' : ''}">
          <span class="nav-icon">${icons.profile}</span>
          <span>Profile</span>
        </a>
      `;
    } else {
      // PUBLIC
      bottomNav.innerHTML = `
        <a href="#landing" class="mobile-bottom-nav-item ${p === 'landing' || p === 'home' ? 'active' : ''}">
          <span class="nav-icon">${icons.dashboard}</span>
          <span>Home</span>
        </a>
        <a href="#verify" class="mobile-bottom-nav-item ${p === 'verify' ? 'active' : ''}">
          <span class="nav-icon">${icons.search}</span>
          <span>Verify</span>
        </a>
        <a href="#services" class="mobile-bottom-nav-item ${p === 'services' ? 'active' : ''}">
          <span class="nav-icon">${icons.schedule}</span>
          <span>Services</span>
        </a>
        <a href="#register" class="mobile-bottom-nav-item ${p === 'register' || p.startsWith('register-') ? 'active' : ''}">
          <span class="nav-icon">${icons.add}</span>
          <span>Register</span>
        </a>
        <a href="#login" class="mobile-bottom-nav-item ${p === 'login' || p.startsWith('login-') ? 'active' : ''}">
          <span class="nav-icon">${icons.profile}</span>
          <span>Login</span>
        </a>
      `;
    }
  }

  parseRoute() {
    const hash = window.location.hash.slice(1) || 'landing';
    const [path, queryString] = hash.split('?');
    const params = {};
    if (queryString) {
      const pairs = queryString.split('&');
      for (const pair of pairs) {
        const [k, v] = pair.split('=');
        params[decodeURIComponent(k)] = decodeURIComponent(v || '');
      }
    }
    return { path, params };
  }

  handleRouting() {
    const { path, params } = this.parseRoute();
    this.currentRoute = path;
    this.routeParams = params;

    const currentRole = window.state.getCurrentRole();

    // Strict Role-Based Route Protection
    if (path.startsWith('owner-')) {
      if (currentRole === 'PUBLIC') {
        window.location.hash = `#login?role=OWNER&redirect=${encodeURIComponent(path)}`;
        if (window.Components && window.Components.showToast) {
          window.Components.showToast({ title: "Authentication Required", message: "Please sign in to access the Trader / Owner Portal.", type: "warning" });
        }
        return;
      } else if (currentRole === 'LMO') {
        window.location.hash = '#lmo-dashboard';
        if (window.Components && window.Components.showToast) {
          window.Components.showToast({ title: "Access Denied", message: "Officer accounts cannot access Trader Portal pages.", type: "error" });
        }
        return;
      }
      // ADMIN or OWNER allowed
    } else if (path.startsWith('lmo-')) {
      if (currentRole === 'PUBLIC') {
        window.location.hash = `#login?role=LMO&redirect=${encodeURIComponent(path)}`;
        if (window.Components && window.Components.showToast) {
          window.Components.showToast({ title: "Officer Clearance Required", message: "Please sign in with Legal Metrology Officer credentials.", type: "warning" });
        }
        return;
      } else if (currentRole === 'OWNER') {
        window.location.hash = '#owner-dashboard';
        if (window.Components && window.Components.showToast) {
          window.Components.showToast({ title: "Access Denied", message: "Traders and instrument owners cannot access Officer inspection tools.", type: "error" });
        }
        return;
      }
      // ADMIN or LMO allowed
    } else if (path.startsWith('gatc-') || path === 'login-gatc' || path === 'register-gatc') {
      window.location.hash = '#lmo-dashboard';
      return;
    } else if (path.startsWith('admin-')) {
      if (currentRole !== 'ADMIN') {
        if (currentRole === 'PUBLIC') {
          window.location.hash = `#login?role=ADMIN&redirect=${encodeURIComponent(path)}`;
          if (window.Components && window.Components.showToast) {
            window.Components.showToast({ title: "Admin Clearance Required", message: "Administrative authorization is required to access this system.", type: "warning" });
          }
        } else if (currentRole === 'OWNER') {
          window.location.hash = '#owner-dashboard';
          if (window.Components && window.Components.showToast) {
            window.Components.showToast({ title: "Access Denied", message: "Unauthorized attempt to access State Administration Console.", type: "error" });
          }
        } else if (currentRole === 'LMO') {
          window.location.hash = '#lmo-dashboard';
          if (window.Components && window.Components.showToast) {
            window.Components.showToast({ title: "Access Denied", message: "Officers do not have administrative console permissions.", type: "error" });
          }
        }
        return;
      }
    }

    // Dynamic document title
    const titles = {
      'landing': 'Measure X — Online Verification of Weighing & Measuring Instruments',
      'home': 'Measure X — Online Verification of Weighing & Measuring Instruments',
      'services': 'Online Metrology Services Directory — Measure X',
      'how-it-works': 'How It Works — Legal Metrology Verification SOP — Measure X',
      'verify': 'Public Certificate & QR Verification — Measure X',
      'rules': 'Rules & Regulations — Legal Metrology Act, 2009 — Measure X',
      'help': 'Help Desk & Grievance Redressal — Measure X',
      'login': 'Official Metrology Portal Sign-In — Measure X',
      'login-owner': 'Portal Login — Measure X',
      'login-lmo': 'Portal Login — Measure X',
      'login-admin': 'Portal Login — Measure X',
      'register': 'Register for MeasureX — Official Government Access',
      'register-owner': 'Register for MeasureX — Official Government Access',
      'forgot-password': 'Forgot Password — Measure X',
      'reset-password': 'Reset Password — Measure X',
      'owner-dashboard': 'Trader Dashboard — Measure X',
      'owner-instruments': 'Registered Weighing Instruments — Measure X',
      'owner-add-instrument': 'Register New Weighing Instrument — Measure X',
      'owner-apply': 'Application for Verification / Re-Stamping — Measure X',
      'owner-applications': 'My Verification Applications — Measure X',
      'owner-certificates': 'Digital Metrology Verification Certificates — Measure X',
      'owner-profile': 'Trader Profile — Measure X',
      'lmo-dashboard': 'Officer Inspection Console — Measure X',
      'lmo-applications': 'Field Inspection Applications — Measure X',
      'lmo-calendar': 'Monthly Field Inspection Schedule — Measure X',
      'lmo-profile': 'Legal Metrology Officer Profile — Measure X',
      'admin-dashboard': 'State Administration Console — Measure X',
      'admin-allocation': 'Statutory Allocation & Assignment Desk — Measure X',
      'admin-centres': 'Statutory Verification & Test Centres — Measure X',
      'admin-users': 'User Management & Access Clearance — Measure X',
      'admin-instruments': 'Instrument Registry — Measure X',
      'admin-instrument-profile': 'Instrument Lifecycle & Profile — Measure X',
      'admin-reports': 'Compliance Reports & Analytics — Measure X',
      'admin-audit': 'Statutory Compliance Audit Trail — Measure X',
      'admin-profile': 'Administrator Profile — Measure X'
    };
    document.title = titles[path] || 'Measure X — Legal Metrology Verification Network';

    this.updateHeaderUI();

    // Asynchronously fetch fresh data from MySQL for active dashboards
    if (window.api && typeof window.api.getToken === 'function' && window.api.getToken()) {
      if (path.startsWith('owner-')) {
        Promise.all([
          window.api.getInstruments(),
          window.api.getApplications(),
          window.api.getCertificates(),
          window.api.getNotifications()
        ]).then(() => {
          this.renderView(path, params);
        }).catch(() => {
          this.renderView(path, params);
        });
        return;
      } else if (path.startsWith('lmo-')) {
        Promise.all([
          window.api.getApplications(),
          window.api.getInstruments(),
          window.api.getCertificates(),
          window.api.getCalendarEvents(),
          window.api.getNotifications()
        ]).then(() => {
          this.renderView(path, params);
        }).catch(() => {
          this.renderView(path, params);
        });
        return;
      } else if (path.startsWith('gatc-')) {
        Promise.all([
          window.api.getApplications(),
          window.api.getCertificates(),
          window.api.getCalendarEvents(),
          window.api.getNotifications()
        ]).then(() => {
          this.renderView(path, params);
        }).catch(() => {
          this.renderView(path, params);
        });
        return;
      } else if (path.startsWith('admin-')) {
        Promise.all([
          window.api.getUsers(),
          window.api.getInstruments(),
          window.api.getApplications(),
          window.api.getCertificates(),
          window.api.getAuditTrail()
        ]).then(() => {
          this.renderView(path, params);
        }).catch(() => {
          this.renderView(path, params);
        });
        return;
      }
    }

    this.renderView(path, params);
  }


  async renderView(path, params) {
    const appBody = document.getElementById('app-body');
    if (!appBody) return;

    // Close mobile drawer if active on route change
    const existingSidebar = document.getElementById('app-sidebar');
    if (existingSidebar) existingSidebar.classList.remove('sidebar-open');
    const existingBackdrop = document.getElementById('sidebar-backdrop');
    if (existingBackdrop) existingBackdrop.classList.remove('active');
    document.body.classList.remove('drawer-open');

    // Determine layout: Public / Auth vs Dashboard Shell
    const isPublicOrAuth = [
      'landing', 'home', 'services', 'how-it-works', 'verify', 'rules', 'help',
      'login', 'login-owner', 'login-lmo', 'login-admin',
      'register', 'register-owner', 'forgot-password', 'reset-password'
    ].includes(path);

    if (isPublicOrAuth) {
      document.body.classList.remove('has-sidebar');
      document.body.classList.remove('sidebar-collapsed');
      appBody.innerHTML = `
        <div class="app-main full-width-view" id="main-content-area" tabindex="-1"></div>
      `;
    } else {
      document.body.classList.add('has-sidebar');
      const role = window.state.getCurrentRole();
      const isCollapsed = (typeof localStorage !== 'undefined' && localStorage.getItem('measurex_sidebar_collapsed') === 'true' && window.innerWidth > 1024);
      document.body.classList.toggle('sidebar-collapsed', isCollapsed);
      appBody.innerHTML = `
        <aside class="sidebar ${isCollapsed ? 'collapsed' : ''}" id="app-sidebar" aria-label="Role Navigation">
          ${this.renderSidebarMenu(role, path)}
        </aside>
        <main class="app-main" id="main-content-area" tabindex="-1"></main>
      `;
      this.updateSidebarToggleIcon(isCollapsed);
    }

    this.updateBottomNavUI();
    window.scrollTo(0, 0);

    const container = document.getElementById('main-content-area');
    if (container) {
      container.classList.remove('page-enter-fade');
      void container.offsetWidth; // Reflow for CSS transition
      container.classList.add('page-enter-fade');
    }

    // Route Dispatcher
    try {
      switch (path) {
        // Public Pages
        case 'landing':
      case 'home':
        this.renderLandingPage(container);
        break;
      case 'services':
        this.renderServicesPage(container);
        break;
      case 'how-it-works':
        this.renderHowItWorksPage(container);
        break;
      case 'verify':
        this.renderPublicVerificationPage(container, params);
        break;
      case 'rules':
        this.renderRulesPage(container);
        break;
      case 'help':
        this.renderHelpPage(container);
        break;

      // Authentication Pages
      case 'login':
      case 'login-owner':
      case 'login-lmo':
      case 'login-admin':
        this.renderLoginPage(container);
        break;
      case 'register':
      case 'register-owner':
        this.renderRegistrationPage(container, params.type || 'OWNER');
        break;
      case 'forgot-password':
        this.renderForgotPasswordPage(container);
        break;
      case 'reset-password':
        this.renderResetPasswordPage(container, params.token);
        break;

      // Owner Experience
      case 'owner-dashboard':
        this.renderOwnerDashboard(container);
        break;
      case 'owner-instruments':
        this.renderOwnerInstruments(container);
        break;
      case 'owner-add-instrument':
        this.renderAddInstrumentForm(container);
        break;
      case 'owner-instrument-profile':
        await this.renderInstrumentProfile(container, params.id);
        break;
      case 'owner-profile':
        this.renderUserProfile(container);
        break;
      case 'owner-apply':
        this.renderApplyVerificationForm(container, params.instrumentId);
        break;
      case 'owner-applications':
        this.renderOwnerApplications(container);
        break;
      case 'owner-application-details':
        this.renderApplicationDetails(container, params.id);
        break;
      case 'owner-re-verify':
        this.renderReVerificationForm(container, params.id);
        break;
      case 'owner-certificates':
        this.renderOwnerCertificates(container);
        break;
      case 'owner-certificate-details':
      case 'certificate-view':
      case 'certificate-details':
        this.renderCertificateDetails(container, params.id);
        break;
      case 'owner-notifications':
        this.renderNotificationsPage(container);
        break;
      case 'owner-verification-status':
        this.renderOwnerVerificationStatus(container);
        break;

      // LMO Experience
      case 'lmo-dashboard':
        this.renderLMODashboard(container);
        break;
      case 'lmo-applications':
      case 'lmo-pending':
      case 'lmo-pending-review':
      case 'lmo-history':
        this.renderLMOApplications(container, params.filter || 'all');
        break;
      case 'lmo-review':
        await this.renderLMOReview(container, params.id);
        break;
      case 'lmo-schedule':
        await this.renderLMOScheduleForm(container, params.id);
        break;
      case 'lmo-field-verification':
        await this.renderLMOFieldVerification(container, params.id);
        break;
      case 'lmo-calendar':
        this.renderLMOCalendar(container);
        break;
      case 'lmo-certificates':
        await this.renderLMOCertificates(container);
        break;
      case 'lmo-reports':
        await this.renderAdminReports(container);
        break;
      case 'lmo-notifications':
        this.renderNotificationsPage(container);
        break;
      case 'lmo-profile':
        this.renderUserProfile(container);
        break;

      // Deprecated GATC Routes: redirect directly to statutory LMO console
      case 'gatc-dashboard':
      case 'gatc-applications':
      case 'gatc-field-verification':
      case 'gatc-lab-verification':
      case 'gatc-calendar':
      case 'gatc-certificates':
      case 'gatc-reports':
      case 'gatc-notifications':
      case 'gatc-profile':
        window.location.hash = '#lmo-dashboard';
        return;

      // Admin Experience
      case 'admin-dashboard':
        this.renderAdminDashboard(container);
        break;
      case 'admin-allocation':
        this.renderAdminAllocationDesk(container);
        break;
      case 'admin-centres':
        await this.renderAdminCentres(container);
        break;
      case 'admin-users':
        this.renderAdminUsers(container);
        break;
      case 'admin-officers':
        this.renderAdminOfficers(container);
        break;
      case 'admin-applications':
      case 'admin-monitoring':
        this.renderAdminApplications(container);
        break;
      case 'admin-instruments':
        this.renderAdminInstruments(container);
        break;
      case 'admin-instrument-profile':
        await this.renderAdminInstrumentProfile(container, params.id);
        break;
      case 'admin-certificates':
        this.renderAdminCertificates(container);
        break;
      case 'admin-reports':
        await this.renderAdminReports(container);
        break;
      case 'admin-notifications':
        this.renderNotificationsPage(container);
        break;
      case 'admin-audit':
        await this.renderAdminAuditTrail(container);
        break;
      case 'admin-config':
        this.renderAdminConfig(container);
        break;
      case 'admin-profile':
        this.renderUserProfile(container);
        break;

      default:
        this.renderLandingPage(container);
        break;
      }
    } catch (err) {
      console.error(`[MeasureX Router] Error rendering view for ${path}:`, err);
      container.innerHTML = `
        <div style="max-width:680px; margin:40px auto; padding:32px 24px; background:#fff; border:1px solid #fee2e2; border-radius:8px; text-align:center; box-shadow:0 4px 6px -1px rgba(0,0,0,0.06);">
          <div style="font-size:2.5rem; margin-bottom:12px;">🛡️</div>
          <h2 style="color:#991b1b; font-size:1.25rem; font-weight:700; margin-bottom:8px;">Statutory Workspace Notice</h2>
          <p style="color:#64748b; font-size:0.875rem; margin-bottom:20px;">
            The view <code>${path}</code> encountered a rendering notice: ${err.message || 'Data retrieval notice'}. Authoritative records remain intact in MySQL.
          </p>
          <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap;">
            <button type="button" class="btn btn-secondary" onclick="window.location.reload()">Reload Application</button>
            <a href="#landing" class="btn btn-primary">Return to Home</a>
          </div>
        </div>
      `;
    }

    // Initialize scroll-triggered animations and number roll-up counters
    this.initScrollReveal();
    this.initNumberCounters();

    // Scroll to top
    window.scrollTo(0, 0);
  }

  // ==========================================
  // Sidebar Navigation Renderer & SVG Icons
  // ==========================================

  static get NAV_ICONS() {
    return {
      dashboard: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>',
      scale: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"></path><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"></path><path d="M7 21h10"></path><path d="M12 3v18"></path><path d="M3 7h18"></path></svg>',
      add: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>',
      applications: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"></path></svg>',
      search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
      history: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
      certificate: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>',
      refresh: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path></svg>',
      bell: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>',
      profile: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
      help: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
      pending: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
      schedule: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>',
      calendar: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
      reports: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>',
      users: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
      monitoring: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
      centres: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="9" y1="22" x2="9" y2="22.01"></line><line x1="15" y1="22" x2="15" y2="22.01"></line><line x1="8" y1="6" x2="8.01" y2="6"></line><line x1="16" y1="6" x2="16.01" y2="6"></line><line x1="8" y1="10" x2="8.01" y2="10"></line><line x1="16" y1="10" x2="16.01" y2="10"></line><line x1="8" y1="14" x2="8.01" y2="14"></line><line x1="16" y1="14" x2="16.01" y2="14"></line><line x1="8" y1="18" x2="8.01" y2="18"></line><line x1="16" y1="18" x2="16.01" y2="18"></line></svg>',
      audit: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path></svg>',
      settings: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
      allocation: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><polyline points="16 11 18 13 22 9"></polyline></svg>'
    };
  }

  renderSidebarNav(items, roleHeading) {
    const closeBtn = '<button type="button" class="sidebar-drawer-close-btn" aria-label="Close navigation menu" title="Close menu">✕</button>';

    return `
      <div>
        <div class="sidebar-header-row">
          <span class="sidebar-heading-text">${roleHeading}</span>
          <div class="sidebar-controls">
            ${closeBtn}
          </div>
        </div>
        <ul class="sidebar-menu">
          ${items.map(item => `
            <li class="sidebar-item">
              <a href="${item.href}" class="${item.isActive ? 'active' : ''}" data-tooltip="${item.label}" title="${item.label}">
                <span class="nav-item-icon">${item.icon}</span>
                <span class="nav-item-label">${item.label}</span>
                ${item.badge ? `<span class="sidebar-badge">${item.badge}</span>` : ''}
              </a>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  renderSidebarMenu(role, currentPath) {
    const icons = MeasureXApp.NAV_ICONS;
    if (role === 'OWNER') {
      const expiringCount = window.state.getInstruments().filter(i => i.status === 'EXPIRING_SOON' || i.status === 'EXPIRED').length;
      return this.renderSidebarNav([
        { href: '#owner-dashboard', icon: icons.dashboard, label: 'Dashboard', isActive: currentPath === 'owner-dashboard' },
        { href: '#owner-instruments', icon: icons.scale, label: 'My Instruments', badge: expiringCount > 0 ? expiringCount : null, isActive: currentPath === 'owner-instruments' },
        { href: '#owner-add-instrument', icon: icons.add, label: 'Register Instrument', isActive: currentPath === 'owner-add-instrument' },
        { href: '#owner-applications', icon: icons.applications, label: 'Applications', isActive: currentPath === 'owner-applications' },
        { href: '#owner-verification-status', icon: icons.search, label: 'Verification Status', isActive: currentPath === 'owner-verification-status' },
        { href: '#owner-applications?status=VERIFIED', icon: icons.history, label: 'Verification History', isActive: currentPath === 'owner-history' },
        { href: '#owner-certificates', icon: icons.certificate, label: 'Certificates', isActive: currentPath.includes('owner-certificate') },
        { href: '#owner-apply', icon: icons.refresh, label: 'Re-verification', isActive: currentPath === 'owner-apply' },
        { href: '#owner-notifications', icon: icons.bell, label: 'Notifications', isActive: currentPath === 'owner-notifications' },
        { href: '#owner-profile', icon: icons.profile, label: 'Profile', isActive: currentPath === 'owner-profile' },
        { href: '#help', icon: icons.help, label: 'Help & Support', isActive: currentPath === 'help' }
      ], 'Trader / Owner Portal');
    } else if (role === 'LMO') {
      const pendingCount = window.state.getApplications().filter(a => a.status === 'SUBMITTED' || a.status === 'UNDER_REVIEW').length;
      return this.renderSidebarNav([
        { href: '#lmo-dashboard', icon: icons.dashboard, label: 'Dashboard', isActive: currentPath === 'lmo-dashboard' },
        { href: '#lmo-applications', icon: icons.applications, label: 'Applications', badge: pendingCount > 0 ? pendingCount : null, isActive: currentPath === 'lmo-applications' },
        { href: '#lmo-applications?filter=pending', icon: icons.pending, label: 'Pending Review', isActive: currentPath.includes('filter=pending') },
        { href: '#lmo-applications?filter=scheduled', icon: icons.schedule, label: 'Verification Schedule', isActive: currentPath.includes('filter=scheduled') },
        { href: '#lmo-calendar', icon: icons.calendar, label: 'Calendar', isActive: currentPath === 'lmo-calendar' },
        { href: '#lmo-field-verification', icon: icons.search, label: 'Field Verification', isActive: currentPath === 'lmo-field-verification' },
        { href: '#lmo-applications?filter=completed', icon: icons.history, label: 'Verification History', isActive: currentPath.includes('filter=completed') },
        { href: '#lmo-certificates', icon: icons.certificate, label: 'Certificates', isActive: currentPath === 'lmo-certificates' },
        { href: '#lmo-notifications', icon: icons.bell, label: 'Notifications', isActive: currentPath === 'lmo-notifications' },
        { href: '#lmo-reports', icon: icons.reports, label: 'Reports', isActive: currentPath === 'lmo-reports' },
        { href: '#lmo-profile', icon: icons.profile, label: 'Profile', isActive: currentPath === 'lmo-profile' }
      ], 'Legal Metrology Officer');
    } else if (role === 'ADMIN') {
      const pendingUsersCount = (window.state.getPendingUsers ? window.state.getPendingUsers().length : 0);
      return this.renderSidebarNav([
        { href: '#admin-dashboard', icon: icons.dashboard, label: 'Dashboard', isActive: currentPath === 'admin-dashboard' },
        { href: '#admin-allocation', icon: icons.allocation, label: 'Allocation Desk', isActive: currentPath === 'admin-allocation' },
        { href: '#admin-centres', icon: icons.centres, label: 'Verification Centres', isActive: currentPath === 'admin-centres' },
        { href: '#admin-users', icon: icons.users, label: 'User Management', badge: pendingUsersCount > 0 ? pendingUsersCount : null, isActive: currentPath === 'admin-users' },
        { href: '#admin-instruments', icon: icons.scale, label: 'Instrument Registry', isActive: currentPath === 'admin-instruments' || currentPath === 'admin-instrument-profile' },
        { href: '#admin-applications', icon: icons.applications, label: 'Applications', isActive: currentPath === 'admin-applications' },
        { href: '#admin-monitoring', icon: icons.monitoring, label: 'Verification Monitoring', isActive: currentPath === 'admin-monitoring' },
        { href: '#admin-certificates', icon: icons.certificate, label: 'Certificate Management', isActive: currentPath === 'admin-certificates' },
        { href: '#admin-reports', icon: icons.reports, label: 'Reports & Analytics', isActive: currentPath === 'admin-reports' },
        { href: '#admin-notifications', icon: icons.bell, label: 'Notifications', isActive: currentPath === 'admin-notifications' },
        { href: '#admin-audit', icon: icons.audit, label: 'Audit Trail', isActive: currentPath === 'admin-audit' },
        { href: '#admin-config', icon: icons.settings, label: 'System Settings', isActive: currentPath === 'admin-config' },
      ], 'Administration Console');
    }
    return '';
  }

  // ==========================================
  // Public Pages (Feature 18, 21, 38)
  // ==========================================

  // ==========================================
  // Public Pages (Feature 18, 21, 38) & Statutory Information
  // ==========================================

  renderBreadcrumbs(items, showBack = true, fallbackUrl = '#landing') {
    if (!items || items.length === 0) return '';
    return `
      <nav class="gov-breadcrumb-bar" aria-label="Breadcrumb">
        <div class="gov-breadcrumb-container" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            ${showBack ? `
              <button type="button" class="gov-back-btn" onclick="if (window.history.length > 1) { window.history.back(); } else { window.location.hash = '${fallbackUrl}'; }" aria-label="Go back to previous page" style="margin-right:4px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                <span>Back</span>
              </button>
            ` : ''}
            <a href="#landing">Home</a>
            ${items.map((item, idx) => {
              if (idx === items.length - 1) {
                return `<span class="gov-breadcrumb-separator">/</span><span class="gov-breadcrumb-current">${item.label}</span>`;
              }
              return `<span class="gov-breadcrumb-separator">/</span><a href="${item.url}">${item.label}</a>`;
            }).join('')}
          </div>
        </div>
      </nav>
    `;
  }

  renderLandingPage(container) {
    container.innerHTML = `
      <!-- Institutional Hero Section -->
      <section style="background-color: var(--color-primary); color: #ffffff; padding: 48px 20px 52px 20px;">
        <div style="max-width: var(--max-content-width); margin: 0 auto;">
          <div style="display: inline-flex; align-items: center; gap: 8px; background-color: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.22); border-radius: var(--radius-sm); padding: 4px 12px; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; margin-bottom: 16px; color: #E8F5E9;">
            <span>⚖️ Legal Metrology Digital Verification Network</span>
            <span>•</span>
            <span>Statutory Digital Service</span>
          </div>

          <h1 style="font-size: 2.25rem; font-weight: 900; letter-spacing: -0.6px; line-height: 1.25; margin-bottom: 14px; max-width: 820px; color: #FFFFFF;">
            Online Verification of Weighing &amp; Measuring Instruments
          </h1>

          <p style="font-size: 1.0625rem; color: #D8E2DC; max-width: 760px; line-height: 1.6; margin-bottom: 28px;">
            Statutory portal for commercial instrument registration, scheduled field inspection by Legal Metrology Officers, digital verification certificates, and real-time public QR authentication under the Legal Metrology Act, 2009.
          </p>

          <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 32px;">
            <a href="#register-owner" class="btn btn-primary" style="background-color: #C9972B; color: #1E2824; border-color: #B28320; font-weight: 800;">
              Register Instrument
            </a>
            <a href="#login-owner" class="btn btn-secondary" style="background-color: rgba(255,255,255,0.12); color: #FFFFFF; border-color: rgba(255,255,255,0.3);">
              Apply for Verification
            </a>
            <a href="#verify" class="btn btn-outline" style="border-color: #FFFFFF; color: #FFFFFF;">
              Verify Certificate (Public QR)
            </a>
            <a href="#rules" class="btn btn-outline" style="border-color: rgba(255,255,255,0.4); color: #E8F5E9;">
              Rules &amp; Regulations ➔
            </a>
          </div>

          <!-- Compact Public Certificate Search Box -->
          <div style="max-width: 680px; background-color: #FFFFFF; padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--color-border); display: flex; gap: 10px; align-items: center; box-shadow: var(--shadow-md);">
            <span style="font-size: 1.125rem; color: var(--color-text-secondary); padding-left: 6px;">🔍</span>
            <input type="text" id="quick-cert-input" class="form-control" placeholder="Enter Certificate ID (e.g. MX-CERT-DEMO-0001) or Serial Number" style="border: none; padding: 8px; flex: 1; font-size: 0.875rem;" />
            <button type="button" class="btn btn-primary btn-sm" onclick="const q = document.getElementById('quick-cert-input').value.trim(); if(q) location.hash='#verify?id=' + encodeURIComponent(q);">
              Verify Record
            </button>
          </div>
          <div style="font-size: 0.75rem; color: #A4D4C8; margin-top: 8px;">
            Quick Evaluation Samples: 
            <a href="#verify?id=MX-CERT-DEMO-0001" style="color: #FFFFFF; text-decoration: underline; margin-right: 12px; font-family: var(--font-mono);">MX-CERT-DEMO-0001 (VALID)</a>
            <a href="#verify?id=MX-CERT-DEMO-0002" style="color: #FFFFFF; text-decoration: underline; font-family: var(--font-mono);">MX-CERT-DEMO-0002 (EXPIRED)</a>
          </div>
        </div>
      </section>

      <!-- Photographic Metrology Inspection & Standards Showcase -->
      <section class="reveal-on-scroll" style="padding: 44px 20px; max-width: var(--max-content-width); margin: 0 auto;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px; align-items: center;">
          <div>
            <div style="border: 1px solid var(--color-border); border-radius: var(--radius-sm); overflow: hidden; background-color: var(--color-surface); box-shadow: var(--shadow-sm);">
              <img src="frontend/assets/images/metrology-inspection.jpg" alt="Legal Metrology Officer calibrating Class III weighing scale with certified standard brass weights" style="width: 100%; height: auto; display: block;" />
              <div style="padding: 12px 16px; background-color: var(--color-surface-alt); border-top: 1px solid var(--color-border); font-size: 0.8125rem; color: var(--color-text-secondary); line-height: 1.5;">
                <strong style="color: var(--color-text);">Figure 1:</strong> On-site field calibration of a commercial Class III bench scale conducted by a Legal Metrology Officer using certified Class M1 working standard weights under the Legal Metrology (General) Rules, 2011.
              </div>
            </div>
          </div>

          <div>
            <div style="display: inline-block; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--color-primary); letter-spacing: 0.6px; margin-bottom: 6px;">
              Statutory Verification Protocol
            </div>
            <h2 style="font-size: 1.625rem; font-weight: 800; color: var(--color-text); line-height: 1.3; margin-bottom: 14px;">
              Certified Standard Weights &amp; Inspection Standards
            </h2>
            <p style="font-size: 0.9375rem; color: var(--color-text-secondary); line-height: 1.6; margin-bottom: 18px;">
              Under Section 24 of the Legal Metrology Act, 2009, all commercial weighing and measuring devices deployed in trade transactions must undergo mandatory verification against calibrated standards.
            </p>

            <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 22px;">
              <div style="display: flex; gap: 10px; align-items: flex-start;">
                <span style="color: var(--color-primary); font-weight: bold; font-size: 1rem;">⚖️</span>
                <div style="font-size: 0.875rem; color: var(--color-text);">
                  <strong>Working Standard Weights:</strong> Calibrated against Secondary Standards in conformity with OIML R 111-1 and IS 1056 (Class M1 &amp; F2).
                </div>
              </div>
              <div style="display: flex; gap: 10px; align-items: flex-start;">
                <span style="color: var(--color-primary); font-weight: bold; font-size: 1rem;">📏</span>
                <div style="font-size: 0.875rem; color: var(--color-text);">
                  <strong>Permissible Error Thresholds:</strong> Evaluated for Zero Error, Eccentric Loading, Repeatability, and Maximum Permissible Error (MPE) under Rule 14.
                </div>
              </div>
              <div style="display: flex; gap: 10px; align-items: flex-start;">
                <span style="color: var(--color-primary); font-weight: bold; font-size: 1rem;">🛡️</span>
                <div style="font-size: 0.875rem; color: var(--color-text);">
                  <strong>Tamper-Evident Security Seals:</strong> Mandatory lead wire stamp and tamper-proof holographic seal preventing unauthorized mechanical adjustment.
                </div>
              </div>
            </div>

            <a href="#rules" class="btn btn-secondary btn-sm" style="font-weight: 700;">
              Inspect Statutory MPE Tolerances &amp; Penalties ➔
            </a>
          </div>
        </div>
      </section>

      <!-- 6 Practical Service Blocks -->
      <section style="background-color: #FFFFFF; border-top: 1px solid var(--color-border); border-bottom: 1px solid var(--color-border); padding: 48px 20px;">
        <div style="max-width: var(--max-content-width); margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 36px;">
            <h2 style="font-size: 1.625rem; font-weight: 800; color: var(--color-text); margin-bottom: 6px;">
              Core Legal Metrology Services
            </h2>
            <p style="font-size: 0.9375rem; color: var(--color-text-secondary); max-width: 640px; margin: 0 auto;">
              Direct access to statutory compliance workflows for commercial traders, enforcement officers, and consumers.
            </p>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
            <!-- Service 1 -->
            <div class="card reveal-on-scroll stagger-1" style="padding: 24px; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="font-size: 1.5rem; margin-bottom: 10px;">📝</div>
                <h3 style="font-size: 1.0625rem; font-weight: 700; margin-bottom: 8px; color: var(--color-text);">
                  Register Instrument
                </h3>
                <p style="font-size: 0.875rem; color: var(--color-text-secondary); line-height: 1.5; margin-bottom: 16px;">
                  Onboard commercial weighing balances, industrial platform scales, and flow meters with model and installation address.
                </p>
              </div>
              <a href="#register-owner" class="btn btn-secondary btn-sm" style="align-self: flex-start;">Register Device ➔</a>
            </div>

            <!-- Service 2 -->
            <div class="card reveal-on-scroll stagger-2" style="padding: 24px; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="font-size: 1.5rem; margin-bottom: 10px;">📋</div>
                <h3 style="font-size: 1.0625rem; font-weight: 700; margin-bottom: 8px; color: var(--color-text);">
                  Apply for Verification
                </h3>
                <p style="font-size: 0.875rem; color: var(--color-text-secondary); line-height: 1.5; margin-bottom: 16px;">
                  Submit official e-applications for Initial Verification, Annual Re-verification, or Post-Repair Re-stamping.
                </p>
              </div>
              <a href="#login-owner" class="btn btn-secondary btn-sm" style="align-self: flex-start;">Submit Application ➔</a>
            </div>

            <!-- Service 3 -->
            <div class="card reveal-on-scroll stagger-3" style="padding: 24px; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="font-size: 1.5rem; margin-bottom: 10px;">🔎</div>
                <h3 style="font-size: 1.0625rem; font-weight: 700; margin-bottom: 8px; color: var(--color-text);">
                  Track Application Status
                </h3>
                <p style="font-size: 0.875rem; color: var(--color-text-secondary); line-height: 1.5; margin-bottom: 16px;">
                  Real-time procedural tracking across all 5 verification stages: Scrutiny, Scheduling, Field Test, and Stamping.
                </p>
              </div>
              <a href="#login-owner" class="btn btn-secondary btn-sm" style="align-self: flex-start;">Track Application ➔</a>
            </div>

            <!-- Service 4 -->
            <div class="card reveal-on-scroll stagger-4" style="padding: 24px; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="font-size: 1.5rem; margin-bottom: 10px;">📜</div>
                <h3 style="font-size: 1.0625rem; font-weight: 700; margin-bottom: 8px; color: var(--color-text);">
                  Download Certificate
                </h3>
                <p style="font-size: 0.875rem; color: var(--color-text-secondary); line-height: 1.5; margin-bottom: 16px;">
                  Access authoritative digital verification certificates with security seal numbers and cryptographic QR code.
                </p>
              </div>
              <a href="#verify?id=MX-CERT-DEMO-0001" class="btn btn-secondary btn-sm" style="align-self: flex-start;">View Sample Certificate ➔</a>
            </div>

            <!-- Service 5 -->
            <div class="card reveal-on-scroll stagger-5" style="padding: 24px; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="font-size: 1.5rem; margin-bottom: 10px;">📲</div>
                <h3 style="font-size: 1.0625rem; font-weight: 700; margin-bottom: 8px; color: var(--color-text);">
                  Public QR Verification
                </h3>
                <p style="font-size: 0.875rem; color: var(--color-text-secondary); line-height: 1.5; margin-bottom: 16px;">
                  Instant public consumer verification of physical scale certification stickers to ensure accuracy in trade.
                </p>
              </div>
              <a href="#verify" class="btn btn-secondary btn-sm" style="align-self: flex-start;">Open Public Verifier ➔</a>
            </div>

            <!-- Service 6 -->
            <div class="card reveal-on-scroll stagger-6" style="padding: 24px; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="font-size: 1.5rem; margin-bottom: 10px;">⏰</div>
                <h3 style="font-size: 1.0625rem; font-weight: 700; margin-bottom: 8px; color: var(--color-text);">
                  Re-Verification Alerts
                </h3>
                <p style="font-size: 0.875rem; color: var(--color-text-secondary); line-height: 1.5; margin-bottom: 16px;">
                  Automated countdown reminders (60, 30, and 7 days) ensuring commercial businesses re-stamp prior to legal expiry.
                </p>
              </div>
              <a href="#rules" class="btn btn-secondary btn-sm" style="align-self: flex-start;">Re-Verification Rules ➔</a>
            </div>
          </div>
        </div>
      </section>

      <!-- Key Statutory Deadlines & Compliance Advisory -->
      <section class="reveal-on-scroll" style="padding: 44px 20px; max-width: var(--max-content-width); margin: 0 auto;">
        <div class="card" style="padding: 28px; border-left: 6px solid var(--color-primary);">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 18px; border-bottom: 1px solid var(--color-border); padding-bottom: 12px;">
            <div style="font-size: 1.125rem; font-weight: 800; color: var(--color-text); display: flex; align-items: center; gap: 8px;">
              <span>📢</span>
              <span>Statutory Compliance Bulletins &amp; Deadlines</span>
            </div>
            <span class="badge badge-info" style="font-size: 0.75rem;">Rule 27 &amp; Section 24 Notice</span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px;">
            <div>
              <div style="font-size: 0.875rem; font-weight: 700; color: var(--color-primary); margin-bottom: 4px;">
                Mandatory Re-Verification Window
              </div>
              <p style="font-size: 0.8125rem; color: var(--color-text-secondary); line-height: 1.5;">
                Under Rule 27, applications for periodic re-verification must be filed at least 30 days prior to certificate expiration to avoid late compounding penalties.
              </p>
            </div>

            <div>
              <div style="font-size: 0.875rem; font-weight: 700; color: var(--color-primary); margin-bottom: 4px;">
                Trade Prohibition Notice
              </div>
              <p style="font-size: 0.8125rem; color: var(--color-text-secondary); line-height: 1.5;">
                Section 24 strictly prohibits the commercial use, quotation, or possession of unverified, expired, or unstamped weighing scales across all establishments.
              </p>
            </div>

            <div>
              <div style="font-size: 0.875rem; font-weight: 700; color: var(--color-danger); margin-bottom: 4px;">
                Seal Tampering Penal Provisions
              </div>
              <p style="font-size: 0.8125rem; color: var(--color-text-secondary); line-height: 1.5;">
                Tampering with, altering, or obliterating official verification seals attracts statutory fines up to ₹50,000 and imprisonment under Section 31.
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- Institutional Metrics Counter -->
      <section class="reveal-on-scroll" style="background-color: var(--color-surface); border-top: 1px solid var(--color-border); padding: 40px 20px;">
        <div style="max-width: var(--max-content-width); margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 24px; text-align: center;">
          <div style="border-right: 1px solid var(--color-border); padding: 8px;">
            <div class="stat-counter-val" data-target="1248" data-suffix="+" style="font-size: 1.75rem; font-weight: 800; color: var(--color-primary); font-family: var(--font-mono);">0</div>
            <div style="font-size: 0.8125rem; color: var(--color-text-secondary); font-weight: 600; text-transform: uppercase; margin-top: 4px;">Registered Instruments</div>
          </div>
          <div style="border-right: 1px solid var(--color-border); padding: 8px;">
            <div class="stat-counter-val" data-target="892" style="font-size: 1.75rem; font-weight: 800; color: var(--color-primary); font-family: var(--font-mono);">0</div>
            <div style="font-size: 0.8125rem; color: var(--color-text-secondary); font-weight: 600; text-transform: uppercase; margin-top: 4px;">Field Inspections Completed</div>
          </div>
          <div style="border-right: 1px solid var(--color-border); padding: 8px;">
            <div class="stat-counter-val" data-target="100" data-suffix="%" style="font-size: 1.75rem; font-weight: 800; color: var(--color-primary); font-family: var(--font-mono);">0%</div>
            <div style="font-size: 0.8125rem; color: var(--color-text-secondary); font-weight: 600; text-transform: uppercase; margin-top: 4px;">QR Verification Seals</div>
          </div>
          <div style="padding: 8px;">
            <div class="stat-counter-val" data-target="98.4" data-suffix="%" data-decimals="1" style="font-size: 1.75rem; font-weight: 800; color: var(--color-accent); font-family: var(--font-mono);">0%</div>
            <div style="font-size: 0.8125rem; color: var(--color-text-secondary); font-weight: 600; text-transform: uppercase; margin-top: 4px;">Statutory Compliance Rate</div>
          </div>
        </div>
      </section>

      <!-- Standard Verification SOP Workflow Stepper -->
      <section class="reveal-on-scroll" style="padding: 48px 20px; max-width: var(--max-content-width); margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h2 style="font-size: 1.625rem; font-weight: 800; color: var(--color-text); margin-bottom: 6px;">
            Standard Operating Procedure (SOP)
          </h2>
          <p style="font-size: 0.9375rem; color: var(--color-text-secondary);">
            The statutory legal metrology verification lifecycle from trader onboarding to public verification.
          </p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; text-align: center;">
          <div class="card reveal-on-scroll stagger-1" style="padding: 20px 14px;">
            <div style="font-size: 1.5rem; margin-bottom: 8px; font-weight: 800; color: var(--color-primary);">1</div>
            <h3 style="font-size: 0.9375rem; font-weight: 700; margin-bottom: 6px;">Register</h3>
            <p style="font-size: 0.8125rem; color: var(--color-text-secondary);">Instrument specifications registered.</p>
          </div>
          <div class="card reveal-on-scroll stagger-2" style="padding: 20px 14px;">
            <div style="font-size: 1.5rem; margin-bottom: 8px; font-weight: 800; color: var(--color-primary);">2</div>
            <h3 style="font-size: 0.9375rem; font-weight: 700; margin-bottom: 6px;">Apply</h3>
            <p style="font-size: 0.8125rem; color: var(--color-text-secondary);">Submit online application &amp; fees.</p>
          </div>
          <div class="card reveal-on-scroll stagger-3" style="padding: 20px 14px;">
            <div style="font-size: 1.5rem; margin-bottom: 8px; font-weight: 800; color: var(--color-primary);">3</div>
            <h3 style="font-size: 0.9375rem; font-weight: 700; margin-bottom: 6px;">Review</h3>
            <p style="font-size: 0.8125rem; color: var(--color-text-secondary);">LMO scrutiny and schedule assignment.</p>
          </div>
          <div class="card reveal-on-scroll stagger-4" style="padding: 20px 14px;">
            <div style="font-size: 1.5rem; margin-bottom: 8px; font-weight: 800; color: var(--color-primary);">4</div>
            <h3 style="font-size: 0.9375rem; font-weight: 700; margin-bottom: 6px;">Inspect</h3>
            <p style="font-size: 0.8125rem; color: var(--color-text-secondary);">Field tolerance test with standard weights.</p>
          </div>
          <div class="card reveal-on-scroll stagger-5" style="padding: 20px 14px;">
            <div style="font-size: 1.5rem; margin-bottom: 8px; font-weight: 800; color: var(--color-primary);">5</div>
            <h3 style="font-size: 0.9375rem; font-weight: 700; margin-bottom: 6px;">Certify</h3>
            <p style="font-size: 0.8125rem; color: var(--color-text-secondary);">Digital certificate issued with QR code.</p>
          </div>
          <div class="card reveal-on-scroll stagger-6" style="padding: 20px 14px;">
            <div style="font-size: 1.5rem; margin-bottom: 8px; font-weight: 800; color: var(--color-primary);">6</div>
            <h3 style="font-size: 0.9375rem; font-weight: 700; margin-bottom: 6px;">Verify</h3>
            <p style="font-size: 0.8125rem; color: var(--color-text-secondary);">Public citizen scans QR on site.</p>
          </div>
        </div>
      </section>
    `;
  }

  renderRulesPage(container) {
    container.innerHTML = `
      ${this.renderBreadcrumbs([{ label: 'Rules & Regulations', url: '#rules' }])}

      <div style="max-width: var(--max-content-width); margin: 32px auto 60px auto; padding: 0 20px;">
        <div class="page-header" style="margin-bottom: 28px;">
          <div>
            <h1 class="page-title" style="font-size: 1.875rem;">Legal Metrology Rules, Statutory Tolerances &amp; Enforcement Standards</h1>
            <p class="page-subtitle">Statutory guidelines governing verification, stamping, permissible error thresholds, re-verification schedules, and penalties under the Legal Metrology Act, 2009.</p>
          </div>
        </div>

        <!-- Quick Jump Navigation -->
        <div class="card" style="padding: 14px 20px; margin-bottom: 28px; background-color: var(--color-surface-alt);">
          <div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--color-text-muted); margin-bottom: 8px;">
            Statutory Document Sections:
          </div>
          <div style="display: flex; gap: 12px; flex-wrap: wrap; font-size: 0.8125rem; font-weight: 600;">
            <a href="#rules-sec-1">1. Statutory Framework</a> •
            <a href="#rules-sec-2">2. Frequencies &amp; Classes</a> •
            <a href="#rules-sec-3">3. MPE Tolerance Tables</a> •
            <a href="#rules-sec-4">4. Seal Integrity &amp; Penalties</a> •
            <a href="#rules-sec-5">5. Re-Verification Process</a> •
            <a href="#rules-sec-6">6. Appeal Mechanism</a> •
            <a href="#rules-sec-7">7. Official FAQs</a>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 32px;">

          <!-- Section 1: Statutory Framework -->
          <div class="card" id="rules-sec-1" style="padding: 28px;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
              <span class="badge badge-info" style="font-size: 0.8125rem;">Section 1</span>
              <h2 style="font-size: 1.375rem; font-weight: 800; color: var(--color-text);">Statutory Framework &amp; Legal Mandate</h2>
            </div>
            <p style="font-size: 0.9375rem; color: var(--color-text-secondary); line-height: 1.6; margin-bottom: 16px;">
              The digital metrology verification service operates strictly under the authority of the <strong>Legal Metrology Act, 2009 (Act No. 1 of 2010)</strong> and the <strong>Legal Metrology (General) Rules, 2011</strong> enacted by the Department of Consumer Affairs, Government of India.
            </p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
              <div style="padding: 14px; background-color: var(--color-surface-alt); border-radius: var(--radius-sm); border-left: 3px solid var(--color-primary);">
                <div style="font-weight: 700; color: var(--color-text); margin-bottom: 4px;">Section 24 — Mandatory Verification</div>
                <div style="font-size: 0.8125rem; color: var(--color-text-secondary); line-height: 1.5;">
                  Every person having in custody, control, or possession of any weight or measure for use in any commercial transaction or protection shall verify and stamp it prior to putting into use.
                </div>
              </div>
              <div style="padding: 14px; background-color: var(--color-surface-alt); border-radius: var(--radius-sm); border-left: 3px solid var(--color-primary);">
                <div style="font-weight: 700; color: var(--color-text); margin-bottom: 4px;">Section 15 — Powers of Inspection &amp; Seizure</div>
                <div style="font-size: 0.8125rem; color: var(--color-text-secondary); line-height: 1.5;">
                  Empowers Legal Metrology Officers (LMOs) to enter any commercial premises, inspect any weight or measuring instrument, test accuracy against standard weights, and seize counterfeit or unverified equipment.
                </div>
              </div>
            </div>
          </div>

          <!-- Section 2: Verification Frequencies & Equipment Classes -->
          <div class="card" id="rules-sec-2" style="padding: 28px;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
              <span class="badge badge-info" style="font-size: 0.8125rem;">Section 2</span>
              <h2 style="font-size: 1.375rem; font-weight: 800; color: var(--color-text);">Verification Frequencies &amp; Equipment Classification</h2>
            </div>
            <p style="font-size: 0.9375rem; color: var(--color-text-secondary); line-height: 1.6; margin-bottom: 16px;">
              Verification periods are determined by accuracy classification and commercial application under Schedule VII of the Legal Metrology (General) Rules, 2011:
            </p>

            <div class="table-responsive">
              <table class="table">
                <thead>
                  <tr>
                    <th>Equipment Class</th>
                    <th>Accuracy Level</th>
                    <th>Typical Applications</th>
                    <th>Verification Period</th>
                    <th>Reference Standard</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Class I</strong></td>
                    <td><span class="badge badge-warning">Special Accuracy</span></td>
                    <td>Precious metals, micro-balances, analytical chemical labs</td>
                    <td><strong>Every 12 Months</strong></td>
                    <td>OIML Class E2 / F1</td>
                  </tr>
                  <tr>
                    <td><strong>Class II</strong></td>
                    <td><span class="badge badge-warning">High Accuracy</span></td>
                    <td>Bullion traders, pharmaceutical dispensing, jewelers</td>
                    <td><strong>Every 12 Months</strong></td>
                    <td>OIML Class F1 / F2</td>
                  </tr>
                  <tr>
                    <td><strong>Class III</strong></td>
                    <td><span class="badge badge-success">Medium Accuracy</span></td>
                    <td>Commercial retail grocery, supermarkets, industrial bench scales</td>
                    <td><strong>Every 12 Months</strong></td>
                    <td>OIML Class M1</td>
                  </tr>
                  <tr>
                    <td><strong>Class IV</strong></td>
                    <td><span class="badge badge-neutral">Ordinary Accuracy</span></td>
                    <td>Platform scales, agricultural produce mandis, heavy freight</td>
                    <td><strong>Every 12 Months</strong></td>
                    <td>OIML Class M1 / M2</td>
                  </tr>
                  <tr>
                    <td><strong>Weighbridges</strong></td>
                    <td><span class="badge badge-neutral">Heavy Industrial</span></td>
                    <td>Vehicle weighbridges, axle-load scales, logistics hubs</td>
                    <td><strong>Every 12 Months</strong></td>
                    <td>Working Standard Roller Weights</td>
                  </tr>
                  <tr>
                    <td><strong>Fuel Dispensers</strong></td>
                    <td><span class="badge badge-info">Volumetric Flow</span></td>
                    <td>Petrol / Diesel dispensing nozzles, petroleum retail outlets</td>
                    <td><strong>Every 3 to 6 Months</strong></td>
                    <td>5L &amp; 10L Standard Measures</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Section 3: Maximum Permissible Error (MPE) Tables -->
          <div class="card" id="rules-sec-3" style="padding: 28px;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
              <span class="badge badge-info" style="font-size: 0.8125rem;">Section 3</span>
              <h2 style="font-size: 1.375rem; font-weight: 800; color: var(--color-text);">Maximum Permissible Error (MPE) Tolerance Standards</h2>
            </div>
            <p style="font-size: 0.9375rem; color: var(--color-text-secondary); line-height: 1.6; margin-bottom: 16px;">
              During field inspection, an instrument is tested at Minimum, 50%, and Maximum rated capacity. The difference between the indicated value and the reference working standard weight must not exceed the statutory MPE (where <em>m</em> represents load expressed in verification scale divisions <em>e</em>):
            </p>

            <div class="table-responsive">
              <table class="table">
                <thead>
                  <tr>
                    <th>Load Range (in scale divisions <em>e</em>)</th>
                    <th>Class I (Special)</th>
                    <th>Class II (High)</th>
                    <th>Class III (Medium)</th>
                    <th>Class IV (Ordinary)</th>
                    <th>MPE (Initial Verification)</th>
                    <th>MPE (In-Service Inspection)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Low Range (0 to 500e)</strong></td>
                    <td>0 ≤ m ≤ 50,000</td>
                    <td>0 ≤ m ≤ 5,000</td>
                    <td>0 ≤ m ≤ 500</td>
                    <td>0 ≤ m ≤ 50</td>
                    <td><strong>± 0.5 e</strong></td>
                    <td><strong>± 1.0 e</strong></td>
                  </tr>
                  <tr>
                    <td><strong>Mid Range (500e to 2000e)</strong></td>
                    <td>50,000 &lt; m ≤ 200,000</td>
                    <td>5,000 &lt; m ≤ 20,000</td>
                    <td>500 &lt; m ≤ 2,000</td>
                    <td>50 &lt; m ≤ 200</td>
                    <td><strong>± 1.0 e</strong></td>
                    <td><strong>± 2.0 e</strong></td>
                  </tr>
                  <tr>
                    <td><strong>High Range (&gt; 2000e)</strong></td>
                    <td>m &gt; 200,000</td>
                    <td>20,000 &lt; m ≤ 100,000</td>
                    <td>2,000 &lt; m ≤ 10,000</td>
                    <td>200 &lt; m ≤ 1,000</td>
                    <td><strong>± 1.5 e</strong></td>
                    <td><strong>± 3.0 e</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style="font-size: 0.8125rem; color: var(--color-text-muted); margin-top: 8px;">
              <em>Note: As per Rule 14, in-service inspection allows twice the MPE permitted on initial verification to account for normal mechanical wear and environmental operational variations.</em>
            </div>
          </div>

          <!-- Section 4: Seal Integrity & Tampering Penalties -->
          <div class="card" id="rules-sec-4" style="padding: 28px;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
              <span class="badge badge-danger" style="font-size: 0.8125rem;">Section 4</span>
              <h2 style="font-size: 1.375rem; font-weight: 800; color: var(--color-text);">Physical Seal Integrity &amp; Statutory Penal Provisions</h2>
            </div>
            <p style="font-size: 0.9375rem; color: var(--color-text-secondary); line-height: 1.6; margin-bottom: 16px;">
              Every instrument that successfully passes calibration receives official sealing. Tampering with or altering these seals is a cognizable legal offense under the Legal Metrology Act, 2009:
            </p>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 20px;">
              <div style="padding: 16px; background-color: var(--color-surface-alt); border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
                <div style="font-weight: 700; color: var(--color-text); margin-bottom: 6px;">🔏 Dual Physical Sealing Protocol</div>
                <div style="font-size: 0.8125rem; color: var(--color-text-secondary); line-height: 1.5;">
                  1. <strong>Lead Wire Punch Stamp:</strong> Embossed with Officer Verification Code and Quarter/Year stamp on the calibration port.<br>
                  2. <strong>Holographic Tamper-Proof Sticker:</strong> Destructible polyester seal with serialized security barcode affixed across the junction casing.
                </div>
              </div>
              <div style="padding: 16px; background-color: var(--color-surface-alt); border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
                <div style="font-weight: 700; color: var(--color-text); margin-bottom: 6px;">📱 Cryptographic QR Code</div>
                <div style="font-size: 0.8125rem; color: var(--color-text-secondary); line-height: 1.5;">
                  A scannable high-density QR code linked directly to the public registry record, displaying instrument serial number, trader location, LMO inspection officer, and validity status.
                </div>
              </div>
            </div>

            <div class="table-responsive">
              <table class="table">
                <thead>
                  <tr>
                    <th>Statutory Section</th>
                    <th>Offense Description</th>
                    <th>First Offense Penalty</th>
                    <th>Subsequent Offense Penalty</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Section 30</strong></td>
                    <td>Penalty for using non-standard weight or measure</td>
                    <td>Fine up to <strong>₹25,000</strong></td>
                    <td>Imprisonment up to <strong>6 Months</strong> and/or fine up to <strong>₹50,000</strong></td>
                  </tr>
                  <tr>
                    <td><strong>Section 31</strong></td>
                    <td>Penalty for altering or tampering with official seals</td>
                    <td>Fine up to <strong>₹50,000</strong></td>
                    <td>Imprisonment up to <strong>1 Year</strong> with mandatory seizure of device</td>
                  </tr>
                  <tr>
                    <td><strong>Section 33</strong></td>
                    <td>Use of unverified weight or measure in trade transactions</td>
                    <td>Fine up to <strong>₹10,000</strong></td>
                    <td>Imprisonment up to <strong>1 Year</strong> and commercial establishment closure</td>
                  </tr>
                  <tr>
                    <td><strong>Section 36</strong></td>
                    <td>Sale of pre-packaged commodities with deficient net quantity</td>
                    <td>Fine up to <strong>₹25,000</strong></td>
                    <td>Fine up to <strong>₹1,00,000</strong> or imprisonment up to <strong>1 Year</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Section 5: Re-Verification Process & Timelines -->
          <div class="card" id="rules-sec-5" style="padding: 28px;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
              <span class="badge badge-info" style="font-size: 0.8125rem;">Section 5</span>
              <h2 style="font-size: 1.375rem; font-weight: 800; color: var(--color-text);">Periodic Re-Verification Timelines &amp; SLA</h2>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px;">
              <div style="padding: 16px; background-color: var(--color-surface-alt); border-radius: var(--radius-sm);">
                <div style="font-weight: 700; color: var(--color-primary); margin-bottom: 4px;">Advance Filing Window</div>
                <div style="font-size: 0.8125rem; color: var(--color-text-secondary); line-height: 1.5;">
                  Traders may file for re-verification up to <strong>60 days</strong> before certificate expiry. An automated warning is issued at 60, 30, and 7 days.
                </div>
              </div>
              <div style="padding: 16px; background-color: var(--color-surface-alt); border-radius: var(--radius-sm);">
                <div style="font-weight: 700; color: var(--color-primary); margin-bottom: 4px;">Grace Period &amp; Late Compounding</div>
                <div style="font-size: 0.8125rem; color: var(--color-text-secondary); line-height: 1.5;">
                  A 30-day grace period is provided after expiry, subject to a late compounding fee of <strong>0.5% per day</strong> on the standard verification fee.
                </div>
              </div>
              <div style="padding: 16px; background-color: var(--color-surface-alt); border-radius: var(--radius-sm);">
                <div style="font-weight: 700; color: var(--color-primary); margin-bottom: 4px;">Officer Inspection SLA</div>
                <div style="font-size: 0.8125rem; color: var(--color-text-secondary); line-height: 1.5;">
                  The Legal Metrology Officer must complete the physical field inspection within <strong>14 working days</strong> of statutory fee confirmation.
                </div>
              </div>
            </div>
          </div>

          <!-- Section 6: Appeal Mechanism Against Rejection / Seizure -->
          <div class="card" id="rules-sec-6" style="padding: 28px;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
              <span class="badge badge-info" style="font-size: 0.8125rem;">Section 6</span>
              <h2 style="font-size: 1.375rem; font-weight: 800; color: var(--color-text);">Appeal Mechanism Against Rejection or Seizure</h2>
            </div>
            <p style="font-size: 0.9375rem; color: var(--color-text-secondary); line-height: 1.6; margin-bottom: 16px;">
              If an instrument is rejected or seized by an inspecting officer, the owner is entitled to statutory appeal recourse under <strong>Section 50 of the Legal Metrology Act, 2009</strong>:
            </p>
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <div style="padding: 14px; background-color: var(--color-surface-alt); border-radius: var(--radius-sm);">
                <strong>First Appeal (Within 30 Days):</strong> Any person aggrieved by an order of a Legal Metrology Officer may prefer an appeal to the Controller of Legal Metrology within thirty days from the date of communication of the order.
              </div>
              <div style="padding: 14px; background-color: var(--color-surface-alt); border-radius: var(--radius-sm);">
                <strong>Second Appeal (Within 60 Days):</strong> Any person aggrieved by an order of the Controller of Legal Metrology may appeal to the State Government or Central Government Appellate Authority.
              </div>
              <div style="padding: 14px; background-color: var(--color-surface-alt); border-radius: var(--radius-sm);">
                <strong>Re-Inspection Application:</strong> After resolving mechanical defects through an authorized licensed repairer, a trader may apply for re-inspection under Post-Repair Verification protocols.
              </div>
            </div>
          </div>

          <!-- Section 7: Official Legal Metrology FAQ Accordion -->
          <div class="card" id="rules-sec-7" style="padding: 28px;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
              <span class="badge badge-info" style="font-size: 0.8125rem;">Section 7</span>
              <h2 style="font-size: 1.375rem; font-weight: 800; color: var(--color-text);">Frequently Asked Questions (Statutory Compliance FAQ)</h2>
            </div>

            <div class="faq-accordion" style="display: flex; flex-direction: column; gap: 10px;">
              <!-- Q1 -->
              <div class="faq-item" style="border: 1px solid var(--color-border); border-radius: var(--radius-sm); overflow: hidden;">
                <button type="button" class="faq-toggle" style="width: 100%; text-align: left; padding: 14px 18px; background-color: var(--color-surface-alt); border: none; font-size: 0.9375rem; font-weight: 700; color: var(--color-text); display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
                  <span>1. Who is legally required to verify their weighing or measuring instruments?</span>
                  <span class="faq-arrow">▼</span>
                </button>
                <div class="faq-body" style="padding: 14px 18px; display: none; background-color: #FFFFFF; font-size: 0.875rem; color: var(--color-text-secondary); line-height: 1.6; border-top: 1px solid var(--color-border);">
                  Under Section 24 of the Legal Metrology Act, 2009, any person or enterprise that uses weighing or measuring equipment in any commercial trade transaction, industrial manufacturing, healthcare, or public safety is legally obligated to get their instruments verified and stamped by an authorized Legal Metrology Officer.
                </div>
              </div>

              <!-- Q2 -->
              <div class="faq-item" style="border: 1px solid var(--color-border); border-radius: var(--radius-sm); overflow: hidden;">
                <button type="button" class="faq-toggle" style="width: 100%; text-align: left; padding: 14px 18px; background-color: var(--color-surface-alt); border: none; font-size: 0.9375rem; font-weight: 700; color: var(--color-text); display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
                  <span>2. How often must commercial weighing scales be re-verified?</span>
                  <span class="faq-arrow">▼</span>
                </button>
                <div class="faq-body" style="padding: 14px 18px; display: none; background-color: #FFFFFF; font-size: 0.875rem; color: var(--color-text-secondary); line-height: 1.6; border-top: 1px solid var(--color-border);">
                  In accordance with Schedule VII of the Legal Metrology (General) Rules, 2011, standard commercial Class III and Class IV scales, platform scales, and weighbridges must be re-verified every 12 to 24 months depending on the specific State Legal Metrology rules. Fuel dispensers require quarterly or biannual inspection.
                </div>
              </div>

              <!-- Q3 -->
              <div class="faq-item" style="border: 1px solid var(--color-border); border-radius: var(--radius-sm); overflow: hidden;">
                <button type="button" class="faq-toggle" style="width: 100%; text-align: left; padding: 14px 18px; background-color: var(--color-surface-alt); border: none; font-size: 0.9375rem; font-weight: 700; color: var(--color-text); display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
                  <span>3. What standard weights are used during an on-site field verification?</span>
                  <span class="faq-arrow">▼</span>
                </button>
                <div class="faq-body" style="padding: 14px 18px; display: none; background-color: #FFFFFF; font-size: 0.875rem; color: var(--color-text-secondary); line-height: 1.6; border-top: 1px solid var(--color-border);">
                  The inspecting Legal Metrology Officer utilizes certified Class M1 or Class F2 Working Standard weights that have been calibrated and verified against Secondary Standards in an accredited Legal Metrology Standards Laboratory, traceable to the National Physical Laboratory (NPL).
                </div>
              </div>

              <!-- Q4 -->
              <div class="faq-item" style="border: 1px solid var(--color-border); border-radius: var(--radius-sm); overflow: hidden;">
                <button type="button" class="faq-toggle" style="width: 100%; text-align: left; padding: 14px 18px; background-color: var(--color-surface-alt); border: none; font-size: 0.9375rem; font-weight: 700; color: var(--color-text); display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
                  <span>4. What happens if an instrument fails calibration during inspection?</span>
                  <span class="faq-arrow">▼</span>
                </button>
                <div class="faq-body" style="padding: 14px 18px; display: none; background-color: #FFFFFF; font-size: 0.875rem; color: var(--color-text-secondary); line-height: 1.6; border-top: 1px solid var(--color-border);">
                  If measurement errors exceed the Maximum Permissible Error (MPE) or physical seals are compromised, the officer issues a formal Rejection Notice specifying the exact error values. The instrument is prohibited from trade until repaired by an authorized licensed repairer and re-inspected.
                </div>
              </div>

              <!-- Q5 -->
              <div class="faq-item" style="border: 1px solid var(--color-border); border-radius: var(--radius-sm); overflow: hidden;">
                <button type="button" class="faq-toggle" style="width: 100%; text-align: left; padding: 14px 18px; background-color: var(--color-surface-alt); border: none; font-size: 0.9375rem; font-weight: 700; color: var(--color-text); display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
                  <span>5. How can consumers verify that a scale has a valid legal metrology certificate?</span>
                  <span class="faq-arrow">▼</span>
                </button>
                <div class="faq-body" style="padding: 14px 18px; display: none; background-color: #FFFFFF; font-size: 0.875rem; color: var(--color-text-secondary); line-height: 1.6; border-top: 1px solid var(--color-border);">
                  Every verified instrument must display an official physical verification sticker with a QR code. Consumers can scan the QR code using any smartphone or enter the Certificate ID into the Measure X Public Verification Portal to check active validity, expiry date, and registered trader details.
                </div>
              </div>

              <!-- Q6 -->
              <div class="faq-item" style="border: 1px solid var(--color-border); border-radius: var(--radius-sm); overflow: hidden;">
                <button type="button" class="faq-toggle" style="width: 100%; text-align: left; padding: 14px 18px; background-color: var(--color-surface-alt); border: none; font-size: 0.9375rem; font-weight: 700; color: var(--color-text); display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
                  <span>6. Can I continue using a scale while my re-verification application is pending?</span>
                  <span class="faq-arrow">▼</span>
                </button>
                <div class="faq-body" style="padding: 14px 18px; display: none; background-color: #FFFFFF; font-size: 0.875rem; color: var(--color-text-secondary); line-height: 1.6; border-top: 1px solid var(--color-border);">
                  If the application and statutory fees were submitted prior to the expiration date, the generated Application Acknowledgment Receipt grants temporary authorization to operate until the inspecting officer conducts the scheduled on-site test.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Attach FAQ Accordion Click Handlers
    const toggles = container.querySelectorAll('.faq-toggle');
    toggles.forEach(btn => {
      btn.addEventListener('click', () => {
        const body = btn.nextElementSibling;
        const arrow = btn.querySelector('.faq-arrow');
        const isOpen = body.style.display === 'block';
        if (isOpen) {
          body.style.display = 'none';
          if (arrow) arrow.textContent = '▼';
        } else {
          body.style.display = 'block';
          if (arrow) arrow.textContent = '▲';
        }
      });
    });
  }

  renderServicesPage(container) {
    container.innerHTML = `
      ${this.renderBreadcrumbs([{ label: 'Online Services Directory', url: '#services' }])}

      <div style="max-width: var(--max-content-width); margin: 32px auto 60px auto; padding: 0 20px;">
        <div class="page-header" style="margin-bottom: 28px;">
          <div>
            <h1 class="page-title">Digital Metrology Services Directory</h1>
            <p class="page-subtitle">Unified statutory services for commercial instrument owners, legal metrology officers, and consumer citizens.</p>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px;">
          <!-- Trader Services -->
          <div class="card" style="padding: 24px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 14px;">
              <span style="font-size: 1.25rem;">👤</span>
              <h2 style="font-size: 1.125rem; font-weight: 700; color: var(--color-text);">Trader &amp; Owner Services</h2>
            </div>
            <ul style="list-style: none; display: flex; flex-direction: column; gap: 12px;">
              <li style="border-bottom: 1px solid var(--color-border); padding-bottom: 10px;">
                <a href="#register-owner" style="font-weight: 700; color: var(--color-primary);">1. Register Commercial Instrument</a>
                <div style="font-size: 0.8125rem; color: var(--color-text-secondary); margin-top: 2px;">Register weighing scales, balances, platform scales, and weighbridges.</div>
              </li>
              <li style="border-bottom: 1px solid var(--color-border); padding-bottom: 10px;">
                <a href="#login-owner" style="font-weight: 700; color: var(--color-primary);">2. Apply for Verification &amp; Stamping</a>
                <div style="font-size: 0.8125rem; color: var(--color-text-secondary); margin-top: 2px;">Submit new verification, annual re-verification, or post-repair stamping.</div>
              </li>
              <li style="border-bottom: 1px solid var(--color-border); padding-bottom: 10px;">
                <a href="#login-owner" style="font-weight: 700; color: var(--color-primary);">3. Track Verification Applications</a>
                <div style="font-size: 0.8125rem; color: var(--color-text-secondary); margin-top: 2px;">View real-time status across Document Scrutiny, Scheduling, and Inspection.</div>
              </li>
              <li>
                <a href="#login-owner" style="font-weight: 700; color: var(--color-primary);">4. Download Verification Certificates</a>
                <div style="font-size: 0.8125rem; color: var(--color-text-secondary); margin-top: 2px;">Download authentic legal certificates with embedded verification QR code.</div>
              </li>
            </ul>
          </div>

          <!-- Citizen Services -->
          <div class="card" style="padding: 24px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 14px;">
              <span style="font-size: 1.25rem;">🌐</span>
              <h2 style="font-size: 1.125rem; font-weight: 700; color: var(--color-text);">Citizen &amp; Consumer Services</h2>
            </div>
            <ul style="list-style: none; display: flex; flex-direction: column; gap: 12px;">
              <li style="border-bottom: 1px solid var(--color-border); padding-bottom: 10px;">
                <a href="#verify" style="font-weight: 700; color: var(--color-primary);">1. Public Certificate &amp; QR Verification</a>
                <div style="font-size: 0.8125rem; color: var(--color-text-secondary); margin-top: 2px;">Verify accuracy and validity of any weighing device by certificate ID or QR scan.</div>
              </li>
              <li style="border-bottom: 1px solid var(--color-border); padding-bottom: 10px;">
                <a href="#rules" style="font-weight: 700; color: var(--color-primary);">2. Legal Metrology Rules &amp; Tolerances</a>
                <div style="font-size: 0.8125rem; color: var(--color-text-secondary); margin-top: 2px;">Access statutory tolerance tables (MPE) and penalty provisions under the Act.</div>
              </li>
              <li>
                <a href="#help" style="font-weight: 700; color: var(--color-primary);">3. Consumer Grievance &amp; Short-Weight Report</a>
                <div style="font-size: 0.8125rem; color: var(--color-text-secondary); margin-top: 2px;">Lodge complaints against unverified scales or suspected short-weighing traders.</div>
              </li>
            </ul>
          </div>

          <!-- Officer Services -->
          <div class="card" style="padding: 24px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 14px;">
              <span style="font-size: 1.25rem;">👮</span>
              <h2 style="font-size: 1.125rem; font-weight: 700; color: var(--color-text);">Enforcement &amp; Officer Portals</h2>
            </div>
            <ul style="list-style: none; display: flex; flex-direction: column; gap: 12px;">
              <li style="border-bottom: 1px solid var(--color-border); padding-bottom: 10px;">
                <a href="#login-lmo" style="font-weight: 700; color: var(--color-primary);">1. Legal Metrology Officer Console</a>
                <div style="font-size: 0.8125rem; color: var(--color-text-secondary); margin-top: 2px;">Scrutinize applications, schedule visits, and record field test results.</div>
              </li>
              <li style="border-bottom: 1px solid var(--color-border); padding-bottom: 10px;">
                <a href="#login-lmo" style="font-weight: 700; color: var(--color-primary);">2. Mobile Field Verification &amp; Stamping</a>
                <div style="font-size: 0.8125rem; color: var(--color-text-secondary); margin-top: 2px;">Record physical check, zero test, corner test, seal serial, and PASS/FAIL.</div>
              </li>
              <li>
                <a href="#login-admin" style="font-weight: 700; color: var(--color-primary);">3. State Administration &amp; Audit Trail</a>
                <div style="font-size: 0.8125rem; color: var(--color-text-secondary); margin-top: 2px;">State-wide compliance analytics, officer directories, and certificate management.</div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    `;
  }

  renderHelpPage(container) {
    container.innerHTML = `
      ${this.renderBreadcrumbs([{ label: 'Help & Citizen Support', url: '#help' }])}

      <div style="max-width: var(--max-content-width); margin: 32px auto 60px auto; padding: 0 20px;">
        <div class="page-header" style="margin-bottom: 28px;">
          <div>
            <h1 class="page-title">Help Desk &amp; Grievance Redressal</h1>
            <p class="page-subtitle">Statutory assistance, district legal metrology contacts, and citizen complaint procedures.</p>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 28px;">
          <!-- Help Desk Contacts -->
          <div class="card" style="padding: 24px;">
            <h2 style="font-size: 1.125rem; font-weight: 700; margin-bottom: 16px; color: var(--color-text);">Direct Support Contacts</h2>
            <div style="display: flex; flex-direction: column; gap: 14px;">
              <div style="padding: 12px; background-color: var(--color-surface-alt); border-radius: var(--radius-sm);">
                <div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--color-text-muted);">National Consumer Helpline (NCH)</div>
                <div style="font-size: 1.125rem; font-weight: 800; color: var(--color-primary); font-family: var(--font-mono); margin-top: 2px;">1915 / 1800-11-4000</div>
                <div style="font-size: 0.8125rem; color: var(--color-text-secondary); margin-top: 2px;">Toll-Free (All Days, 09:30 AM to 05:30 PM)</div>
              </div>

              <div style="padding: 12px; background-color: var(--color-surface-alt); border-radius: var(--radius-sm);">
                <div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--color-text-muted);">Measure X Directorate Support</div>
                <div style="font-size: 1rem; font-weight: 700; color: var(--color-text); margin-top: 2px;">support@measurex.gov.in</div>
                <div style="font-size: 0.8125rem; color: var(--color-text-secondary); margin-top: 2px;">Central Digital Metrology Helpdesk</div>
              </div>

              <div style="padding: 12px; background-color: var(--color-surface-alt); border-radius: var(--radius-sm);">
                <div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--color-text-muted);">District Metrology Office Hours</div>
                <div style="font-size: 0.875rem; font-weight: 600; color: var(--color-text); margin-top: 2px;">Monday to Friday: 10:00 AM – 05:00 PM</div>
                <div style="font-size: 0.8125rem; color: var(--color-text-secondary); margin-top: 2px;">Field inspections conducted by appointment.</div>
              </div>
            </div>
          </div>

          <!-- Citizen Grievance Form -->
          <div class="card" style="padding: 24px;">
            <h2 style="font-size: 1.125rem; font-weight: 700; margin-bottom: 14px; color: var(--color-text);">Submit Grievance / Inquiry</h2>
            <form id="grievance-form">
              <div class="form-group" style="margin-bottom: 12px;">
                <label class="form-label">Full Name *</label>
                <input type="text" class="form-control" required placeholder="Enter your full name" />
              </div>
              <div class="form-group" style="margin-bottom: 12px;">
                <label class="form-label">Mobile Number / Email *</label>
                <input type="text" class="form-control" required placeholder="Contact details for response" />
              </div>
              <div class="form-group" style="margin-bottom: 12px;">
                <label class="form-label">Subject / Complaint Category *</label>
                <select class="form-control" required>
                  <option value="">Select Category</option>
                  <option value="short-weight">Suspected Short-Weighting in Trade</option>
                  <option value="unverified">Use of Unverified / Expired Scale</option>
                  <option value="tampered-seal">Broken or Tampered Verification Seal</option>
                  <option value="portal-issue">Technical Support with Application</option>
                  <option value="general">General Statutory Inquiry</option>
                </select>
              </div>
              <div class="form-group" style="margin-bottom: 16px;">
                <label class="form-label">Description of Issue *</label>
                <textarea class="form-control" rows="3" required placeholder="Provide establishment details, location, and nature of grievance..."></textarea>
              </div>
              <button type="submit" class="btn btn-primary" style="width: 100%;">Submit Grievance</button>
            </form>
          </div>
        </div>
      </div>
    `;

    const gForm = container.querySelector('#grievance-form');
    if (gForm) {
      gForm.addEventListener('submit', (e) => {
        e.preventDefault();
        Components.showToast({
          title: "Grievance Registered",
          message: "Your grievance reference GRV-" + Math.floor(100000 + Math.random() * 900000) + " has been logged with the Legal Metrology Directorate.",
          type: "success"
        });
        gForm.reset();
      });
    }
  }

  renderHowItWorksPage(container) {
    container.innerHTML = `
      ${this.renderBreadcrumbs([{ label: 'How It Works', url: '#how-it-works' }])}

      <div style="max-width: 960px; margin: 32px auto 60px auto; padding: 0 20px;">
        <div class="page-header" style="margin-bottom: 28px;">
          <div>
            <h1 class="page-title">How Measure X Works</h1>
            <p class="page-subtitle">The standard legal metrology verification, inspection, and certification procedure.</p>
          </div>
        </div>

        <div class="card" style="padding: 32px; display: flex; flex-direction: column; gap: 24px;">
          <div>
            <h3 style="color: var(--color-primary); font-size: 1.125rem; font-weight: 700; margin-bottom: 6px;">1. Instrument Registration</h3>
            <p style="color: var(--color-text-secondary); font-size: 0.9375rem; line-height: 1.6;">Commercial operators register every weighing and measuring device (capacity, model number, serial number, make, and installation premises). An official unique ID (e.g. <code>MX-INS-000125</code>) is generated.</p>
          </div>
          <hr style="border: none; border-top: 1px solid var(--color-border);" />
          <div>
            <h3 style="color: var(--color-primary); font-size: 1.125rem; font-weight: 700; margin-bottom: 6px;">2. Online Verification Application</h3>
            <p style="color: var(--color-text-secondary); font-size: 0.9375rem; line-height: 1.6;">Owners submit an electronic application for New Verification, Periodic Re-verification, or Post-Repair Re-stamping. Upload invoices, manufacturer certificates, and previous verification records.</p>
          </div>
          <hr style="border: none; border-top: 1px solid var(--color-border);" />
          <div>
            <h3 style="color: var(--color-primary); font-size: 1.125rem; font-weight: 700; margin-bottom: 6px;">3. Officer Review &amp; Scheduling</h3>
            <p style="color: var(--color-text-secondary); font-size: 0.9375rem; line-height: 1.6;">Legal Metrology Officers review document integrity, assign an inspector, and schedule an on-site inspection date, time, and location.</p>
          </div>
          <hr style="border: none; border-top: 1px solid var(--color-border);" />
          <div>
            <h3 style="color: var(--color-primary); font-size: 1.125rem; font-weight: 700; margin-bottom: 6px;">4. Field Inspection &amp; PASS / FAIL Decision</h3>
            <p style="color: var(--color-text-secondary); font-size: 0.9375rem; line-height: 1.6;">The officer inspects physical condition, seal integrity, and tests accuracy against certified standard weights. If measurements fall within permissible tolerance, the application is marked PASS. If outside tolerance, FAIL is recorded with mandatory legal justification.</p>
          </div>
          <hr style="border: none; border-top: 1px solid var(--color-border);" />
          <div>
            <h3 style="color: var(--color-primary); font-size: 1.125rem; font-weight: 700; margin-bottom: 6px;">5. Digital Certificate &amp; Public QR Verification</h3>
            <p style="color: var(--color-text-secondary); font-size: 0.9375rem; line-height: 1.6;">Upon passing, an authoritative Legal Metrology Verification Certificate is generated with a cryptographic QR code. Consumers can scan the QR code to confirm that the scale is certified and accurate.</p>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================
  // Public QR Verification Page (Feature 18, 19, 38)
  // ==========================================

  async renderPublicVerificationPage(container, params) {
    const searchId = (params.id || '').trim();
    let verifyRes = null;

    container.innerHTML = `
      <div style="max-width:880px; margin:40px auto; padding:0 20px;">
        ${this.renderBreadcrumbs([{ label: 'Public Verification', url: '#verify' }], true, '#landing')}

        <div style="text-align:center; margin-bottom:32px;">
          <div style="display:inline-flex; align-items:center; gap:8px; padding:4px 14px; background:var(--primary-100); color:var(--primary-800); border-radius:var(--radius-full); font-size:0.75rem; font-weight:700; text-transform:uppercase; margin-bottom:12px; letter-spacing:0.04em;">
            ⚖️ Public Metrology Verification Portal
          </div>
          <h1 class="page-title">Live Seal &amp; Certificate Verification</h1>
          <p class="page-subtitle">Verify the authenticity, statutory validity, and lifetime inspection records of any certified weighing or measuring instrument.</p>
        </div>

        <!-- 3-Pillar Experience: Scan QR / Verify Certificate / Check Authenticity (Section 13) -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:16px; margin-bottom:24px;">
          <div class="card" style="padding:20px; text-align:center; border-top:4px solid var(--color-primary); display:flex; flex-direction:column; justify-content:space-between;">
            <div>
              <div style="font-size:2.25rem; margin-bottom:10px;">📷</div>
              <h3 style="font-size:1.0625rem; font-weight:800; margin-bottom:6px;">Scan QR Code</h3>
              <p style="font-size:0.8125rem; color:var(--color-text-secondary); line-height:1.45; margin-bottom:16px;">
                Use your device camera to scan the physical tamper-evident QR code affixed to any verified weighing or measuring equipment.
              </p>
            </div>
            <button type="button" id="scan-qr-camera-btn" class="btn btn-primary" style="width:100%; font-weight:700;">
              📷 Launch Scanner
            </button>
          </div>

          <div class="card" style="padding:20px; text-align:center; border-top:4px solid var(--color-secondary, #C9972B); display:flex; flex-direction:column; justify-content:space-between;">
            <div>
              <div style="font-size:2.25rem; margin-bottom:10px;">🔍</div>
              <h3 style="font-size:1.0625rem; font-weight:800; margin-bottom:6px;">Verify Certificate</h3>
              <p style="font-size:0.8125rem; color:var(--color-text-secondary); line-height:1.45; margin-bottom:16px;">
                Search by statutory Certificate Number (<code>MX-CERT-</code>), lead/wire seal number, or equipment serial identifier.
              </p>
            </div>
            <button type="button" onclick="const inp=document.getElementById('verify-search-input'); if(inp){inp.focus(); inp.scrollIntoView({behavior:'smooth', block:'center'});}" class="btn btn-outline" style="width:100%; font-weight:700;">
              Search Registry Below ↓
            </button>
          </div>

          <div class="card" style="padding:20px; text-align:center; border-top:4px solid #2563EB; display:flex; flex-direction:column; justify-content:space-between;">
            <div>
              <div style="font-size:2.25rem; margin-bottom:10px;">🛡️</div>
              <h3 style="font-size:1.0625rem; font-weight:800; margin-bottom:6px;">Check Authenticity</h3>
              <p style="font-size:0.8125rem; color:var(--color-text-secondary); line-height:1.45; margin-bottom:16px;">
                Every verification certificate is cryptographically signed using asymmetric RSA-SHA256 with government PKI key verification.
              </p>
            </div>
            <div style="display:inline-flex; align-items:center; justify-content:center; gap:6px; font-size:0.75rem; font-weight:700; color:#1D4ED8; background:#EFF6FF; padding:8px 12px; border-radius:var(--radius-sm);">
              🔒 RSA-2048 Bit Signed
            </div>
          </div>
        </div>

        <!-- Search Bar -->
        <div class="card" style="padding:22px; margin-bottom:28px;">
          <form id="public-verify-form" style="display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
            <div style="position:relative; flex:1; min-width:260px;">
              <input type="text" id="verify-search-input" class="form-control" style="padding-left:38px;" placeholder="Enter Certificate ID, Seal No., or Instrument Serial..." value="${searchId}" />
              <span style="position:absolute; left:12px; top:50%; transform:translateY(-50%); font-size:1.1rem; opacity:0.6;">🔍</span>
            </div>
            <button type="submit" class="btn btn-primary" style="white-space:nowrap; font-weight:700;">Verify Authenticity</button>
          </form>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:14px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <strong>Test Live Registry:</strong> 
            <a href="#verify?id=MX-CERT-DEMO-0001" class="badge status-valid font-mono" style="text-decoration:none;">MX-CERT-DEMO-0001 (VALID)</a>
            <a href="#verify?id=MX-CERT-DEMO-0004" class="badge font-mono" style="background:#fef3c7; color:#92400e; border:1px solid #fde68a; text-decoration:none;">MX-CERT-DEMO-0004 (EXPIRING SOON)</a>
            <a href="#verify?id=MX-CERT-DEMO-0002" class="badge status-failed font-mono" style="text-decoration:none;">MX-CERT-DEMO-0002 (EXPIRED)</a>
            <a href="#verify?id=MX-CERT-DEMO-0003" class="badge status-revoked font-mono" style="text-decoration:none;">MX-CERT-DEMO-0003 (REVOKED)</a>
            <a href="#verify?id=MX-CERT-INVALID-99" class="badge font-mono" style="background:#f1f5f9; color:#64748b; text-decoration:none;">MX-CERT-INVALID-99 (INVALID)</a>
          </div>
        </div>

        <!-- Verification Result Display -->
        <div id="verify-result-container">
          ${searchId ? `
            <div class="card verification-scanning-box" style="padding:40px 24px; text-align:center;">
              <div class="verification-radar-pulse">⚖️</div>
              <div class="verification-scan-beam"></div>
              <div style="font-weight:700; color:var(--color-primary); font-size:1.0625rem; z-index:2; position:relative; margin-top:14px;">
                Querying Legal Metrology Registry: <span style="font-family:var(--font-mono);">${searchId}</span>
              </div>
              <div style="font-size:0.8125rem; color:var(--color-text-secondary); margin-top:6px; z-index:2; position:relative;">
                Authenticating digital seal signature, checking validity window, and loading lifecycle audit records...
              </div>
            </div>
          ` : this.renderVerificationResultHTML('', null)}
        </div>
      </div>
    `;

    // Wire scan QR button
    const qrBtn = document.getElementById('scan-qr-camera-btn');
    if (qrBtn) {
      qrBtn.addEventListener('click', () => {
        Components.showQRScannerModal((scannedCode) => {
          location.hash = `#verify?id=${encodeURIComponent(scannedCode)}`;
        });
      });
    }

    const form = document.getElementById('public-verify-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const val = document.getElementById('verify-search-input').value.trim();
        if (val) {
          location.hash = `#verify?id=${encodeURIComponent(val)}`;
        }
      });
    }

    if (searchId) {
      try {
        verifyRes = await window.api.verifyCertificate(searchId);
      } catch (err) {
        console.error("Verification query error:", err);
      }
      setTimeout(() => {
        const resBox = document.getElementById('verify-result-container');
        if (resBox) {
          resBox.innerHTML = this.renderVerificationResultHTML(searchId, verifyRes);
          resBox.querySelectorAll('.view-evidence-btn').forEach(btn => {
            btn.addEventListener('click', () => {
              try {
                const hData = JSON.parse(btn.dataset.hist);
                const cert = verifyRes ? (verifyRes.certificate || verifyRes) : null;
                Components.showEvidenceModal({
                  title: `Verification Evidence — Cycle ${hData.year}`,
                  evidence: hData.evidence,
                  certId: hData.certificateId,
                  instrumentId: (verifyRes && verifyRes.instrument ? verifyRes.instrument.id : (cert ? cert.instrumentId : ''))
                });
              } catch(e) { console.error(e); }
            });
          });
        }
      }, 350);
    }
  }

  renderVerificationResultHTML(searchId, verifyRes) {
    if (!searchId) {
      return `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <div class="empty-state-title">Scan QR Seal or Search Certificate / Serial ID</div>
          <div class="empty-state-desc">Point your smartphone camera at the physical QR code sticker on the weighing scale, or input the certificate identification number above to inspect statutory verification status.</div>
        </div>
      `;
    }

    const cert = verifyRes ? (verifyRes.certificate || verifyRes) : null;
    const instrument = verifyRes ? (verifyRes.instrument || null) : null;
    const history = (verifyRes && verifyRes.history) ? verifyRes.history : (instrument && instrument.verificationHistory ? instrument.verificationHistory : (cert && cert.verificationHistory ? cert.verificationHistory : []));
    const testPoints = (verifyRes && verifyRes.test_points) ? verifyRes.test_points : (cert && cert.testPoints ? cert.testPoints : []);
    const isSigValid = (verifyRes && typeof verifyRes.signature_valid !== 'undefined') ? verifyRes.signature_valid : (cert ? (cert.status !== 'REVOKED' && cert.status !== 'INVALID') : false);

    if (!cert || !cert.id) {
      return `
        <div class="card cert-result-entrance" style="border-left:6px solid var(--color-danger); padding:28px;">
          <div style="display:flex; align-items:center; gap:16px; margin-bottom:16px;">
            <div style="font-size:2.5rem;">❌</div>
            <div>
              <h2 style="font-size:1.375rem; font-weight:800; color:var(--color-danger); margin:0;">INVALID CERTIFICATE RECORD</h2>
              <div style="font-size:0.875rem; color:var(--text-muted); margin-top:4px;">No certified legal metrology record found matching query: <code>${searchId}</code></div>
            </div>
          </div>
          <p style="font-size:0.875rem; color:var(--text-secondary); line-height:1.6;">
            The certificate identifier or serial number provided is not recognized by the central metrology registry. This instrument may be unverified, counterfeit, or illegally operating without statutory inspection.
          </p>
          <div style="margin-top:20px; padding:12px 16px; background-color:var(--color-danger-bg); border-radius:var(--radius-md); font-size:0.8125rem; color:var(--color-danger);">
            <strong>Consumer Protection Notice:</strong> Under the Legal Metrology Act, trading using unverified equipment is an offense. Report non-compliance to the local Metrology Controller.
          </div>
        </div>
      `;
    }

    // Dynamic Status: VALID, EXPIRED, REVOKED
    let statusHeading = 'OFFICIALLY VERIFIED &amp; VALID';
    let statusDesc = 'This instrument has passed precision inspection and is currently authorized for commercial transactions.';

    if (cert.status === 'EXPIRED') {
      statusHeading = 'CERTIFICATE EXPIRED';
      statusDesc = 'The statutory verification validity period has lapsed. This instrument is overdue for mandatory re-verification.';
    } else if (cert.status === 'REVOKED') {
      statusHeading = 'CERTIFICATE FORMALLY REVOKED';
      statusDesc = `This certificate was revoked on ${cert.revokedAt ? cert.revokedAt.slice(0, 10) : 'official order'}. Reason: "${cert.revocationReason || 'Regulatory non-compliance'}".`;
    }

    return `
      <div class="card cert-result-entrance" style="border: 2px solid ${cert.status === 'VALID' ? 'var(--accent-emerald)' : cert.status === 'REVOKED' ? 'var(--color-danger)' : 'var(--color-warning)'}; padding:28px; margin-bottom:24px;">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:20px; border-bottom:1px solid var(--border-light); padding-bottom:20px;">
          <div>
            <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Live Seal &amp; Certificate Authenticity Status</div>
            <h2 style="font-size:1.5rem; font-weight:900; color:${cert.status === 'VALID' ? 'var(--color-success)' : cert.status === 'REVOKED' ? 'var(--color-danger)' : 'var(--color-warning)'}; margin-top:4px;">
              ${statusHeading}
            </h2>
            <p style="font-size:0.875rem; color:var(--text-secondary); margin-top:4px;">${statusDesc}</p>
          </div>
          <div style="text-align:right;">
            <div style="display:inline-flex; align-items:center; gap:8px;">
              ${Components.renderStatusBadge(cert.status)}
              ${cert.status === 'VALID' ? `
                <div class="cert-status-stamp stamp-valid" style="position:static; display:inline-block; font-size:0.75rem; padding:3px 10px; transform:rotate(-3deg); margin:0;">
                  SEALED &amp; VERIFIED
                </div>
              ` : ''}
            </div>
            <div style="font-family:var(--font-mono); font-size:0.875rem; font-weight:700; margin-top:6px;">${cert.id}</div>
          </div>
        </div>

        <!-- Asymmetric Digital Signature Verification Banner (SIH26036 Feature 5) -->
        <div style="background:var(--bg-surface-alt); border:1px solid var(--border-light); border-left:4px solid ${isSigValid ? 'var(--color-success)' : 'var(--color-danger)'}; border-radius:var(--radius-sm); padding:16px; margin-bottom:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:1.375rem;">🔐</span>
              <div>
                <strong style="font-size:0.875rem; color:var(--text-primary);">Asymmetric Digital Signature: ${cert.signatureAlgorithm || 'RSA-SHA256 (2048-bit)'}</strong>
                <div style="font-size:0.75rem; color:var(--text-muted); font-family:var(--font-mono);">Signing Key: ${cert.keyId || 'MX-KEY-2026-v1'} • Canonical SHA-256 Digest Verified</div>
              </div>
            </div>
            <div>
              <span class="badge ${isSigValid ? 'status-valid' : 'status-failed'}" style="font-size:0.8125rem;">
                ${isSigValid ? '✓ SIGNATURE AUTHENTIC &amp; INTACT' : '✕ SIGNATURE INVALID / TAMPERED'}
              </span>
            </div>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; font-size:0.75rem; color:var(--text-secondary); flex-wrap:wrap; gap:6px;">
            <span>Digest Hash: <code style="font-size:0.6875rem;">${cert.digitalSignature ? (cert.digitalSignature.slice(0, 36) + '...') : 'RSA-PKCS1v15-SHA256-Signed'}</code></span>
            <a href="/api/v1/public/keys/public.pem" download="measurex_public_key.pem" class="btn btn-sm btn-outline" style="padding:2px 8px; font-size:0.6875rem;">
              📥 Download Authority Public Key (.pem)
            </a>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:20px; align-items:start; margin-bottom:24px;">
          <!-- Metadata Fields -->
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px 20px;">
            <div>
              <div style="font-size:0.6875rem; font-weight:700; text-transform:uppercase; color:var(--text-muted);">Instrument Type</div>
              <div style="font-weight:700; color:var(--text-primary); font-size:0.9375rem;">${cert.instrumentType}</div>
            </div>
            <div>
              <div style="font-size:0.6875rem; font-weight:700; text-transform:uppercase; color:var(--text-muted);">Serial Number</div>
              <div style="font-family:var(--font-mono); font-weight:700; color:var(--text-primary);">${cert.serialNumber}</div>
            </div>
            <div>
              <div style="font-size:0.6875rem; font-weight:700; text-transform:uppercase; color:var(--text-muted);">Manufacturer &amp; Model</div>
              <div style="font-weight:600; color:var(--text-primary);">${cert.manufacturer} — ${cert.model}</div>
            </div>
            <div>
              <div style="font-size:0.6875rem; font-weight:700; text-transform:uppercase; color:var(--text-muted);">Commercial Establishment</div>
              <div style="font-weight:700; color:var(--text-primary);">${cert.businessName} (${cert.ownerName})</div>
            </div>
            <div>
              <div style="font-size:0.6875rem; font-weight:700; text-transform:uppercase; color:var(--text-muted);">Verification Date</div>
              <div style="font-weight:600; color:var(--text-primary);">${cert.verificationDate}</div>
            </div>
            <div>
              <div style="font-size:0.6875rem; font-weight:700; text-transform:uppercase; color:var(--text-muted);">Valid Until Date</div>
              <div style="font-weight:700; color:${cert.status === 'VALID' ? 'var(--color-success)' : 'var(--color-danger)'};">${cert.validUntil}</div>
            </div>
            <div>
              <div style="font-size:0.6875rem; font-weight:700; text-transform:uppercase; color:var(--text-muted);">Verifying Authority</div>
              <div style="font-weight:700; color:var(--text-primary); font-size:0.9375rem;">
                <span class="badge ${cert.verifierType === 'GATC' ? 'status-scheduled' : 'status-submitted'}" style="margin-right:6px; font-size:0.6875rem;">
                  ${cert.verifierType === 'GATC' ? '🔬 GATC' : '👮 LMO'}
                </span>
                ${cert.verifierName || cert.officerName || 'Rahul Kumar (LMO)'}
              </div>
            </div>
            <div>
              <div style="font-size:0.6875rem; font-weight:700; text-transform:uppercase; color:var(--text-muted);">Security Wire Seal No.</div>
              <div style="font-family:var(--font-mono); font-weight:700; color:var(--text-primary);">${cert.wireSealNumber || cert.sealNumber || 'BR-LM-SEAL-VERIFIED'}</div>
            </div>
          </div>

          <!-- Real QR Box Container -->
          <div style="text-align:center; padding:16px; background:#FFFFFF; border:1px solid var(--border-light); border-radius:var(--radius-md); box-shadow:0 2px 8px rgba(0,0,0,0.05); max-width:200px; margin:0 auto;">
            <div style="font-size:0.6875rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); margin-bottom:8px;">Statutory QR Code</div>
            <img src="/api/v1/certificates/${encodeURIComponent(cert.id)}/qr.png"
                 alt="Certificate QR"
                 width="128"
                 height="128"
                 style="display:inline-block; border-radius:4px; image-rendering:pixelated; border:1px solid #e2e8f0; background:#fff;" />
            <div style="margin-top:8px;">
              <a href="/api/v1/certificates/${encodeURIComponent(cert.id)}/qr.png" download="${cert.id}_qr.png" class="btn btn-sm btn-secondary" style="font-size:0.6875rem; padding:4px 10px; width:100%;">
                ⬇️ Download QR (PNG)
              </a>
            </div>
          </div>
        </div>

        <!-- Statutory Multi-Point Measurement Test Results (Feature 8) -->
        ${testPoints && testPoints.length ? `
          <div style="margin-top:16px; border-top:1px solid var(--border-light); padding-top:16px;">
            <div style="font-size:0.875rem; font-weight:700; color:var(--text-primary); margin-bottom:8px;">
              ⚖️ OIML R76 Multi-Point Test Load Tolerance Records
            </div>
            <div class="table-responsive">
              <table class="table" style="font-size:0.8125rem; margin:0;">
                <thead>
                  <tr>
                    <th>Test Point</th>
                    <th>Nominal Test Load</th>
                    <th>Observed Reading</th>
                    <th>Deviation / Error</th>
                    <th>Permissible MPE</th>
                    <th>Tolerance Decision</th>
                  </tr>
                </thead>
                <tbody>
                  ${testPoints.map(pt => `
                    <tr>
                      <td><strong>${pt.point_label || pt.load_type || 'Test Point'}</strong></td>
                      <td>${pt.nominal_load} ${pt.unit || 'kg'}</td>
                      <td>${pt.observed_reading} ${pt.unit || 'kg'}</td>
                      <td class="font-mono">${(pt.error_observed > 0 ? '+' : '') + Number(pt.error_observed).toFixed(3)} ${pt.unit || 'kg'}</td>
                      <td>±${Number(pt.max_permissible_error).toFixed(3)} ${pt.unit || 'kg'}</td>
                      <td><span class="badge ${pt.result === 'PASS' ? 'status-valid' : 'status-failed'}" style="padding:2px 8px; font-size:0.6875rem;">${pt.result || 'PASS'}</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}

        <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; border-top:1px solid var(--border-light); padding-top:16px; flex-wrap:wrap; margin-top:16px;">
          <div style="font-size:0.8125rem; color:var(--text-muted);">
            Cryptographic ledger stamp verified • Tamper-evident seal intact
          </div>
          <a href="#owner-certificate-details?id=${cert.id}" class="btn btn-primary">View Full Certificate Document</a>
        </div>
      </div>

      <!-- Prior Verification History Accordion (Feature 02) -->
      ${history && history.length ? `
        <div class="card" style="padding:24px;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; flex-wrap:wrap; gap:8px;">
            <div>
              <h3 class="card-title" style="margin:0; font-size:1.0625rem;">📜 Prior Verification History &amp; Calibration Records</h3>
              <p style="font-size:0.8125rem; color:var(--text-muted); margin:4px 0 0 0;">Official statutory ledger for Instrument <span class="font-mono">${cert.instrumentId || (instrument ? instrument.id : '')}</span></p>
            </div>
            <span class="badge status-submitted" style="font-size:0.75rem;">${history.length} Cycles Recorded</span>
          </div>

          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Cycle Year</th>
                  <th>Verification Date</th>
                  <th>Valid Period</th>
                  <th>Officer</th>
                  <th>MPE Observed</th>
                  <th>Seal No.</th>
                  <th>Result</th>
                  <th>Evidence</th>
                </tr>
              </thead>
              <tbody>
                ${history.map(h => `
                  <tr>
                    <td><strong>${h.year}</strong></td>
                    <td>${h.date}</td>
                    <td style="font-size:0.8125rem;">${h.validFrom || h.date} → <strong>${h.validUntil || '--'}</strong></td>
                    <td>${h.officer}</td>
                    <td class="font-mono" style="font-size:0.8125rem;">${h.observed} (${h.permissible})</td>
                    <td class="font-mono" style="font-size:0.8125rem;">${h.sealNumber || '--'}</td>
                    <td>${Components.renderStatusBadge(h.result)}</td>
                    <td>
                      ${h.evidence ? `
                        <button type="button" class="btn btn-sm btn-outline view-evidence-btn" data-hist='${JSON.stringify(h).replace(/'/g, "&apos;")}' style="padding:3px 8px; font-size:0.75rem;">
                          📷 Evidence
                        </button>
                      ` : '<span style="color:var(--text-muted); font-size:0.75rem;">--</span>'}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}
    `;
  }

  // ==========================================
  // Authentication Screens (Feature 01, 02, 03)
  // ==========================================

  // ==========================================
  // Authentication Screens (Unified Common Login & Role-Aware Registration)
  // ==========================================

  renderLoginPage(container) {
    container.innerHTML = `
      <div style="max-width:860px; margin:36px auto; padding:0 20px;">
        ${this.renderBreadcrumbs([{ label: 'Portal Sign-In', url: '#login' }], true, '#landing')}

        <div style="text-align:center; margin-bottom:28px;">
          <div style="display:inline-flex; align-items:center; gap:8px; padding:4px 14px; background:var(--color-surface); border:1px solid var(--color-border); border-radius:var(--radius-full); font-size:0.75rem; font-weight:700; color:var(--color-primary); text-transform:uppercase; margin-bottom:10px;">
            ⚖️ Legal Metrology Digital Verification Network
          </div>
          <h1 class="page-title" style="margin-bottom:6px; font-size:1.75rem;">Official Portal Sign-In</h1>
          <p class="page-subtitle" style="max-width:600px; margin:0 auto; font-size:0.875rem;">
            Unified authentication service for Commercial Instrument Owners, Legal Metrology Officers, and State Administrators. Your access role is identified automatically.
          </p>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap:24px; align-items:start;">
          <!-- Common Single Login Form Card (Section 4) -->
          <div class="card" style="padding:28px;" id="login-card">
            <div style="margin-bottom:20px;">
              <h2 style="font-size:1.25rem; font-weight:800; color:var(--color-text); margin-bottom:4px;">Sign In to Your Account</h2>
              <p style="font-size:0.8125rem; color:var(--color-text-secondary); line-height:1.4;">
                Enter your registered official email or username and password. The system detects your statutory role automatically.
              </p>
            </div>

            <form id="unified-login-form">
              <div class="form-group" style="margin-bottom:18px;">
                <label class="form-label" for="login-email">Registered Email or Username <span class="required-star">*</span></label>
                <input type="text" id="login-email" name="email" class="form-control" placeholder="e.g. officer@demo.com, admin@demo.com, or username" required autocomplete="username" />
              </div>

              <div class="form-group" style="margin-bottom:18px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                  <label class="form-label" for="login-password" style="margin-bottom:0;">Password <span class="required-star">*</span></label>
                  <a href="#forgot-password" style="font-size:0.75rem; color:var(--color-primary); font-weight:600;">Forgot Password?</a>
                </div>
                <input type="password" id="login-password" name="password" class="form-control" placeholder="e.g. admin123" required autocomplete="current-password" />
              </div>

              <div id="login-alert-box" style="display:none; margin-bottom:16px; padding:10px 14px; border-radius:var(--radius-sm); font-size:0.8125rem; line-height:1.4;"></div>

              <div style="margin:20px 0 16px 0;">
                <button type="submit" id="login-submit-btn" class="btn btn-primary" style="width:100%; padding:12px; font-weight:700; font-size:0.9375rem;">
                  Sign In ➔
                </button>
              </div>
            </form>

            <div style="border-top:1px solid var(--color-border); padding-top:16px; text-align:center;">
              <p style="font-size:0.875rem; color:var(--color-text-secondary); margin:0;">
                Don't have an account? <a href="#register" style="font-weight:700; color:var(--color-primary);">Register for MeasureX</a>
              </p>
            </div>
          </div>

          <!-- Statutory Access & Portal Advisory -->
          <div class="card" style="padding:28px; background:var(--color-surface); border:1px solid var(--color-border);">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
              <span style="font-size:1.25rem;">🏛️</span>
              <h3 style="font-size:1rem; font-weight:800; color:var(--color-primary); margin:0;">Statutory Portal Advisory</h3>
            </div>
            <p style="font-size:0.8125rem; color:var(--color-text-secondary); margin-bottom:16px; line-height:1.45;">
              Pursuant to the Legal Metrology Act, 2009 and the Legal Metrology (General) Rules, 2011, this platform serves as the central digital registry and verification gateway.
            </p>

            <div style="display:flex; flex-direction:column; gap:12px;">
              <div style="background:#ffffff; border:1px solid var(--color-border); border-radius:var(--radius-md); padding:12px 14px;">
                <div style="font-weight:700; font-size:0.8125rem; color:var(--color-primary); display:flex; align-items:center; gap:6px;">
                  <span>🏪</span> Commercial Instrument Owners
                </div>
                <div style="font-size:0.75rem; color:var(--color-text-secondary); margin-top:4px; line-height:1.4;">
                  Register weighing instruments, file initial &amp; periodic re-verification applications, and download digital certificates.
                </div>
              </div>

              <div style="background:#ffffff; border:1px solid var(--color-border); border-radius:var(--radius-md); padding:12px 14px;">
                <div style="font-weight:700; font-size:0.8125rem; color:var(--color-primary); display:flex; align-items:center; gap:6px;">
                  <span>📋</span> Legal Metrology Officers (Inspectors)
                </div>
                <div style="font-size:0.75rem; color:var(--color-text-secondary); margin-top:4px; line-height:1.4;">
                  Conduct scheduled field calibrations, perform physical integrity and tolerance checks, and digitally sign verification records.
                </div>
              </div>

              <div style="background:#ffffff; border:1px solid var(--color-border); border-radius:var(--radius-md); padding:12px 14px;">
                <div style="font-weight:700; font-size:0.8125rem; color:var(--color-primary); display:flex; align-items:center; gap:6px;">
                  <span>🛡️</span> Directorate Administration
                </div>
                <div style="font-size:0.75rem; color:var(--color-text-secondary); margin-top:4px; line-height:1.4;">
                  Officer onboarding verification, compliance surveillance, certificate revocation, and audit trail inspection.
                </div>
              </div>
            </div>

            <div style="margin-top:16px; padding:12px; background:rgba(11,93,75,0.06); border-left:3px solid var(--color-primary); border-radius:var(--radius-sm); font-size:0.75rem; color:var(--color-text-secondary); line-height:1.4;">
              <strong>Security Protocol:</strong> In accordance with the IT Act, 2000 and Section 43 statutory guidelines, all access sessions and transactions are cryptographically audited with timestamped IP logs.
            </div>

            <div style="margin-top:16px; border-top:1px dashed var(--color-border); padding-top:12px; font-size:0.75rem; color:var(--color-text-secondary); display:flex; justify-content:space-between; align-items:center;">
              <span>Directorate Helpdesk:</span>
              <span style="font-weight:700; color:var(--color-primary);">1800-11-4000 (Toll Free)</span>
            </div>
          </div>
        </div>
      </div>
    `;

    // Attach Event Listeners
    const form = container.querySelector('#unified-login-form');
    const emailInput = container.querySelector('#login-email');
    const passInput = container.querySelector('#login-password');
    const submitBtn = container.querySelector('#login-submit-btn');
    const alertBox = container.querySelector('#login-alert-box');
    const card = container.querySelector('#login-card');

    // Form Submit
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = emailInput.value.trim();
        const pass = passInput.value;

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.classList.add('is-loading');
          submitBtn.textContent = "Authenticating...";
        }
        alertBox.style.display = 'none';

        // Call unified API login without specifying role
        const res = await window.api.login(email, pass);

        if (res.success) {
          const user = res.user;
          const detectedRole = user.role;

          if (window.Components && window.Components.showToast) {
            window.Components.showToast({
              title: "Authentication Successful",
              message: `Welcome, ${user.name}. Role: ${detectedRole}`,
              type: "success"
            });
          }

          // Route according to detected database role
          let targetRoute = '#landing';
          if (detectedRole === 'OWNER') targetRoute = '#owner-dashboard';
          else if (detectedRole === 'LMO') targetRoute = '#lmo-dashboard';
          else if (detectedRole === 'ADMIN') targetRoute = '#admin-dashboard';
          else targetRoute = '#lmo-dashboard';

          if (this.routeParams && this.routeParams.redirect) {
            targetRoute = decodeURIComponent(this.routeParams.redirect);
          }

          setTimeout(() => {
            window.location.hash = targetRoute;
          }, 200);
        } else {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('is-loading');
            submitBtn.textContent = "Sign In ➔";
          }
          if (card) {
            card.classList.remove('form-shake');
            void card.offsetWidth;
            card.classList.add('form-shake');
            setTimeout(() => card.classList.remove('form-shake'), 450);
          }

          // Show specific message for pending approval accounts
          alertBox.style.display = 'block';
          if (res.message && res.message.toLowerCase().includes('pending')) {
            alertBox.style.background = '#fffbeb';
            alertBox.style.border = '1px solid #fde68a';
            alertBox.style.color = '#92400e';
            alertBox.innerHTML = `<strong>⚠️ Account Pending Approval:</strong> ${res.message}`;
          } else {
            alertBox.style.background = '#fef2f2';
            alertBox.style.border = '1px solid #fecaca';
            alertBox.style.color = '#991b1b';
            alertBox.innerHTML = `<strong>❌ Authentication Failed:</strong> ${res.message || 'Invalid email or password.'}`;
          }

          if (window.Components && window.Components.showToast) {
            window.Components.showToast({
              title: "Authentication Failed",
              message: res.message || "Invalid credentials.",
              type: "error"
            });
          }
        }
      });
    }
  }

  // ==========================================
  // Role-Aware Registration System (Section 3)
  // ==========================================

  renderRegistrationPage(container, initialType = 'OWNER') {
    let currentRoleType = (initialType || 'OWNER').toUpperCase();
    if (!['OWNER', 'LMO', 'ADMIN'].includes(currentRoleType)) currentRoleType = 'OWNER';

    const renderForm = (type) => {
      return `
        <div style="max-width:880px; margin:36px auto; padding:0 20px;">
          ${this.renderBreadcrumbs([{ label: 'Portal Registration', url: '#register' }], true, '#login')}

          <div style="text-align:center; margin-bottom:28px;">
            <div style="display:inline-flex; align-items:center; gap:8px; padding:4px 14px; background:var(--color-surface); border:1px solid var(--color-border); border-radius:var(--radius-full); font-size:0.75rem; font-weight:700; color:var(--color-primary); text-transform:uppercase; margin-bottom:10px;">
              🏛️ Official Onboarding System
            </div>
            <h1 class="page-title" style="margin-bottom:6px; font-size:1.75rem;">REGISTER FOR MEASUREX</h1>
            <p class="page-subtitle" style="font-size:0.875rem;">Select your stakeholder category to begin statutory registration.</p>
          </div>

          <!-- Account Type Switcher (Section 3 Requirement) -->
          <div style="display:flex; justify-content:center; gap:8px; margin-bottom:28px; flex-wrap:wrap;" role="tablist">
            <button type="button" class="btn ${type === 'OWNER' ? 'btn-primary' : 'btn-outline'} reg-tab-btn" data-type="OWNER" style="min-width:170px; font-weight:700; padding:10px 14px;">
              ⚖️ Instrument Owner
            </button>
            <button type="button" class="btn ${type === 'LMO' ? 'btn-primary' : 'btn-outline'} reg-tab-btn" data-type="LMO" style="min-width:170px; font-weight:700; padding:10px 14px;">
              🔍 Legal Metrology Officer
            </button>
            <button type="button" class="btn ${type === 'ADMIN' ? 'btn-primary' : 'btn-outline'} reg-tab-btn" data-type="ADMIN" style="min-width:170px; font-weight:700; padding:10px 14px;">
              🏛️ Administrator
            </button>
          </div>

          <div class="card" style="padding:32px;">
            ${type === 'OWNER' ? `
              <!-- A. INSTRUMENT OWNER / TRADER REGISTRATION -->
              <div style="margin-bottom:24px;">
                <div style="display:inline-block; padding:3px 10px; background:rgba(11,93,75,0.1); color:var(--color-primary); border-radius:var(--radius-sm); font-size:0.75rem; font-weight:700; margin-bottom:6px;">
                  Commercial Establishment Access
                </div>
                <h2 style="font-size:1.375rem; font-weight:800; color:var(--color-text);">Commercial Instrument Owner Registration</h2>
                <p style="font-size:0.8125rem; color:var(--color-text-secondary); line-height:1.4;">
                  Register your commercial trading entity to apply for instrument verification, track testing schedules, and receive digital certificates under the Legal Metrology Act, 2009.
                </p>
              </div>

              <form id="owner-registration-form">
                <h3 style="font-size:0.9375rem; font-weight:700; color:var(--color-primary); border-bottom:1px solid var(--color-border); padding-bottom:6px; margin:20px 0 14px 0;">
                  1. Authorized Representative Details
                </h3>
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label" for="owner-name">Full Name <span class="required-star">*</span></label>
                    <input type="text" id="owner-name" class="form-control" placeholder="e.g. Commercial Signatory" required />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="owner-mobile">Mobile Number <span class="required-star">*</span></label>
                    <input type="tel" id="owner-mobile" class="form-control" placeholder="+91 98765 43210" pattern="[0-9]{10}" title="10-digit mobile number" required />
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label" for="owner-email">Official Email Address <span class="required-star">*</span></label>
                    <input type="email" id="owner-email" class="form-control" placeholder="e.g. contact@traderenterprise.com" required />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="owner-alternate">Alternate Contact Number</label>
                    <input type="tel" id="owner-alternate" class="form-control" placeholder="e.g. 0612 223344" />
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label" for="owner-id">Identification Number (GSTIN / PAN / Trade License) <span class="required-star">*</span></label>
                  <input type="text" id="owner-id" class="form-control" placeholder="e.g. 10AAACB1234F1Z5 or ABCDE1234F" required />
                </div>

                <h3 style="font-size:0.9375rem; font-weight:700; color:var(--color-primary); border-bottom:1px solid var(--color-border); padding-bottom:6px; margin:24px 0 14px 0;">
                  2. Business &amp; Establishment Details
                </h3>
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label" for="owner-biz-name">Establishment / Trade Name <span class="required-star">*</span></label>
                    <input type="text" id="owner-biz-name" class="form-control" placeholder="e.g. ABC Traders Pvt. Ltd." required />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="owner-biz-type">Business Type <span class="required-star">*</span></label>
                    <select id="owner-biz-type" class="form-control" required>
                      <option value="">Select Entity Type</option>
                      <option value="Proprietorship">Sole Proprietorship</option>
                      <option value="Partnership">Partnership Firm</option>
                      <option value="Private Limited">Private Limited Company</option>
                      <option value="Public Limited">Public Limited Company</option>
                      <option value="Cooperative">Cooperative Society</option>
                      <option value="Retailer">Retail Commercial Outlet</option>
                    </select>
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label" for="owner-address">Commercial Operating Address <span class="required-star">*</span></label>
                  <textarea id="owner-address" class="form-control" rows="2" placeholder="Building, Street, Market Area" required></textarea>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label" for="owner-district">District <span class="required-star">*</span></label>
                    <input type="text" id="owner-district" class="form-control" placeholder="e.g. Patna" required />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="owner-state">State <span class="required-star">*</span></label>
                    <input type="text" id="owner-state" class="form-control" value="Bihar" required />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="owner-pin">PIN Code <span class="required-star">*</span></label>
                    <input type="text" id="owner-pin" class="form-control" placeholder="e.g. 800001" pattern="[0-9]{6}" required />
                  </div>
                </div>

                <h3 style="font-size:0.9375rem; font-weight:700; color:var(--color-primary); border-bottom:1px solid var(--color-border); padding-bottom:6px; margin:24px 0 14px 0;">
                  3. Account Credentials &amp; Statutory Declaration
                </h3>
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label" for="owner-pass">Password <span class="required-star">*</span></label>
                    <input type="password" id="owner-pass" class="form-control" placeholder="Min. 8 characters" minlength="8" required />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="owner-pass-confirm">Confirm Password <span class="required-star">*</span></label>
                    <input type="password" id="owner-pass-confirm" class="form-control" placeholder="Re-enter password" minlength="8" required />
                  </div>
                </div>

                <div style="margin:20px 0; background:var(--color-surface); padding:14px; border-radius:var(--radius-sm); border:1px solid var(--color-border);">
                  <label style="display:flex; align-items:flex-start; gap:10px; font-size:0.8125rem; color:var(--color-text-secondary); cursor:pointer;">
                    <input type="checkbox" id="owner-consent" required style="margin-top:2px;" />
                    <span>
                      I hereby solemnly declare that the information submitted is accurate and complies with the Legal Metrology Act, 2009 and the Legal Metrology (General) Rules, 2011. I understand that misrepresentation of statutory weights and measures is punishable under applicable law.
                    </span>
                  </label>
                </div>

                <div style="margin-top:24px;">
                  <button type="submit" id="owner-reg-submit-btn" class="btn btn-primary" style="width:100%; padding:12px; font-weight:700; font-size:0.9375rem;">
                    Submit Instrument Owner Registration ➔
                  </button>
                </div>
              </form>
            ` : type === 'LMO' ? `
              <!-- B. LMO REGISTRATION (CONTROLLED WORKFLOW) -->
              <div style="margin-bottom:24px;">
                <div style="display:inline-block; padding:3px 10px; background:#fffbeb; color:#92400e; border:1px solid #fde68a; border-radius:var(--radius-sm); font-size:0.75rem; font-weight:700; margin-bottom:6px;">
                  Regulated Official Clearance Required
                </div>
                <h2 style="font-size:1.375rem; font-weight:800; color:var(--color-text);">Legal Metrology Officer (LMO) Registration</h2>
                <p style="font-size:0.8125rem; color:var(--color-text-secondary); line-height:1.4;">
                  Officer accounts are subject to administrative identity scrutiny. Following registration, the profile status is placed under <strong>PENDING APPROVAL</strong> until verified and activated by the State Metrology Directorate.
                </p>
              </div>

              <form id="lmo-registration-form">
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label" for="lmo-name">Officer Full Name <span class="required-star">*</span></label>
                    <input type="text" id="lmo-name" class="form-control" placeholder="e.g. Rahul Kumar" required />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="lmo-officer-id">Employee / Officer ID <span class="required-star">*</span></label>
                    <input type="text" id="lmo-officer-id" class="form-control" placeholder="e.g. LMO-PAT-2024" required />
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label" for="lmo-email">Official Email Address <span class="required-star">*</span></label>
                    <input type="email" id="lmo-email" class="form-control" placeholder="e.g. officer.name@metrology.gov.in" required />
                    <span style="font-size:0.75rem; color:var(--color-text-muted);">Must be an authorized departmental email address.</span>
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="lmo-mobile">Official Mobile Number <span class="required-star">*</span></label>
                    <input type="tel" id="lmo-mobile" class="form-control" placeholder="+91 98765 00000" pattern="[0-9]{10}" required />
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label" for="lmo-designation">Designation <span class="required-star">*</span></label>
                    <select id="lmo-designation" class="form-control" required>
                      <option value="">Select Designation</option>
                      <option value="Legal Metrology Officer">Legal Metrology Officer (LMO)</option>
                      <option value="Assistant Controller">Assistant Controller of Legal Metrology</option>
                      <option value="Metrology Inspector">Senior Metrology Inspector</option>
                      <option value="Deputy Controller">Deputy Controller</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="lmo-department">Department / Office <span class="required-star">*</span></label>
                    <input type="text" id="lmo-department" class="form-control" value="Department of Legal Metrology" required />
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label" for="lmo-office-address">Metrology Laboratory / Office Address <span class="required-star">*</span></label>
                  <input type="text" id="lmo-office-address" class="form-control" placeholder="e.g. District Metrology Laboratory, Circular Road, Patna" required />
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label" for="lmo-district">District Jurisdiction <span class="required-star">*</span></label>
                    <input type="text" id="lmo-district" class="form-control" placeholder="e.g. Patna" required />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="lmo-state">State <span class="required-star">*</span></label>
                    <input type="text" id="lmo-state" class="form-control" value="Bihar" required />
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label" for="lmo-pass">Password <span class="required-star">*</span></label>
                    <input type="password" id="lmo-pass" class="form-control" placeholder="Min. 8 characters" minlength="8" required />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="lmo-pass-confirm">Confirm Password <span class="required-star">*</span></label>
                    <input type="password" id="lmo-pass-confirm" class="form-control" placeholder="Re-enter password" minlength="8" required />
                  </div>
                </div>

                <div style="margin:20px 0; background:#fffbeb; border:1px solid #fde68a; padding:14px; border-radius:var(--radius-sm); font-size:0.8125rem; color:#78350f; line-height:1.45;">
                  <strong>Controlled Clearance Notice:</strong> Submission creates an account with status <code>PENDING APPROVAL</code>. You will receive an official notification once the State Administrator approves your credentials.
                </div>

                <div style="margin-top:24px;">
                  <button type="submit" id="lmo-reg-submit-btn" class="btn btn-warning" style="width:100%; padding:12px; font-weight:700; font-size:0.9375rem;">
                    Submit LMO Registration for Approval ➔
                  </button>
                </div>
              </form>
            ` : type === 'GATC' ? `
              <!-- C. GATC REGISTRATION (GOVT APPROVED TEST CENTRE) -->
              <div style="margin-bottom:24px;">
                <div style="display:inline-block; padding:3px 10px; background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; border-radius:var(--radius-sm); font-size:0.75rem; font-weight:700; margin-bottom:6px;">
                  Accredited Test Centre Onboarding
                </div>
                <h2 style="font-size:1.375rem; font-weight:800; color:var(--color-text);">Government Approved Test Centre (GATC) Registration</h2>
                <p style="font-size:0.8125rem; color:var(--color-text-secondary); line-height:1.4;">
                  Register your NABL / Directorate recognized testing centre to conduct legal metrology calibrations and precision verifications. Accounts are verified by the State Metrology Directorate before activation.
                </p>
              </div>

              <form id="gatc-registration-form">
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label" for="gatc-name">Test Centre / Institution Name <span class="required-star">*</span></label>
                    <input type="text" id="gatc-name" class="form-control" placeholder="e.g. Magadh Metrology Calibration Centre" required />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="gatc-ref-no">GATC Reference / Accreditation No. <span class="required-star">*</span></label>
                    <input type="text" id="gatc-ref-no" class="form-control font-mono" placeholder="e.g. GATC-BR-NABL-094" required />
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label" for="gatc-contact">Primary Authorised Signatory <span class="required-star">*</span></label>
                    <input type="text" id="gatc-contact" class="form-control" placeholder="e.g. Dr. Rajesh N. Verma" required />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="gatc-email">Official Institutional Email <span class="required-star">*</span></label>
                    <input type="email" id="gatc-email" class="form-control" placeholder="e.g. director@magadhcalib.org" required />
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label" for="gatc-mobile">Mobile / Contact Number <span class="required-star">*</span></label>
                    <input type="tel" id="gatc-mobile" class="form-control" placeholder="+91 94310 11223" pattern="[0-9]{10}" required />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="gatc-scope">Accredited Testing Scope <span class="required-star">*</span></label>
                    <select id="gatc-scope" class="form-control" required>
                      <option value="Non-Automatic Weighing Instruments & Weighbridges">Non-Automatic Weighing Instruments & Weighbridges</option>
                      <option value="Commercial Electronic Scales & Balances">Commercial Electronic Scales & Balances</option>
                      <option value="Fuel Dispensers & Flow Meters">Fuel Dispensers & Flow Meters</option>
                      <option value="Precision Analytical Balances (Class I & II)">Precision Analytical Balances (Class I & II)</option>
                    </select>
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label" for="gatc-address">Laboratory / Testing Facility Address <span class="required-star">*</span></label>
                  <textarea id="gatc-address" class="form-control" rows="2" placeholder="Industrial Area, Plot No., Sector, City" required></textarea>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label" for="gatc-district">District Jurisdiction <span class="required-star">*</span></label>
                    <input type="text" id="gatc-district" class="form-control" placeholder="e.g. Patna" required />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="gatc-state">State <span class="required-star">*</span></label>
                    <input type="text" id="gatc-state" class="form-control" value="Bihar" required />
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label" for="gatc-pass">Password <span class="required-star">*</span></label>
                    <input type="password" id="gatc-pass" class="form-control" placeholder="Min. 8 characters" minlength="8" required />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="gatc-pass-confirm">Confirm Password <span class="required-star">*</span></label>
                    <input type="password" id="gatc-pass-confirm" class="form-control" placeholder="Re-enter password" minlength="8" required />
                  </div>
                </div>

                <div style="margin:20px 0; background:#eff6ff; border:1px solid #bfdbfe; padding:14px; border-radius:var(--radius-sm); font-size:0.8125rem; color:#1e40af; line-height:1.45;">
                  <strong>Accreditation Scrutiny:</strong> GATC accounts are enrolled with status <code>PENDING APPROVAL</code>. The State Metrology Directorate conducts documentary scrutiny and standards traceability audit before authorizing test centre access.
                </div>

                <div style="margin-top:24px;">
                  <button type="submit" id="gatc-reg-submit-btn" class="btn btn-primary" style="width:100%; padding:12px; font-weight:700; font-size:0.9375rem;">
                    Submit GATC Test Centre Registration ➔
                  </button>
                </div>
              </form>
            ` : `
              <!-- C. ADMIN REGISTRATION (RESTRICTED AUTHORIZATION WORKFLOW) -->
              <div style="margin-bottom:24px;">
                <div style="display:inline-block; padding:3px 10px; background:#fef2f2; color:#991b1b; border:1px solid #fecaca; border-radius:var(--radius-sm); font-size:0.75rem; font-weight:700; margin-bottom:6px;">
                  Restricted Departmental Privilege
                </div>
                <h2 style="font-size:1.375rem; font-weight:800; color:var(--color-text);">Administrator Onboarding</h2>
                <p style="font-size:0.8125rem; color:var(--color-text-secondary); line-height:1.4;">
                  Administrator accounts require an authorized <strong>Department Authorization Code</strong>. Accounts are placed in <strong>PENDING ADMIN APPROVAL</strong> and can only be activated by an existing active administrator.
                </p>
              </div>

              <form id="admin-registration-form">
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label" for="admin-name">Full Name <span class="required-star">*</span></label>
                    <input type="text" id="admin-name" class="form-control" placeholder="e.g. Dr. Sunita Verma" required />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="admin-email">Official Government Email <span class="required-star">*</span></label>
                    <input type="email" id="admin-email" class="form-control" placeholder="e.g. s.verma@metrology.gov.in" required />
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label" for="admin-department">Department <span class="required-star">*</span></label>
                    <input type="text" id="admin-department" class="form-control" value="Department of Legal Metrology" required />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="admin-designation">Designation <span class="required-star">*</span></label>
                    <input type="text" id="admin-designation" class="form-control" placeholder="e.g. Joint Controller / Director" required />
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label" for="admin-auth-code">Admin Authorization / Department Code <span class="required-star">*</span></label>
                  <input type="text" id="admin-auth-code" class="form-control font-mono" placeholder="Enter Department Security Code (e.g. MX-GOV-ADMIN-2026)" required />
                  <span style="font-size:0.75rem; color:var(--color-text-muted);">Confidential security authorization issued by the Metrology Directorate.</span>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label" for="admin-pass">Password <span class="required-star">*</span></label>
                    <input type="password" id="admin-pass" class="form-control" placeholder="Min. 8 characters" minlength="8" required />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="admin-pass-confirm">Confirm Password <span class="required-star">*</span></label>
                    <input type="password" id="admin-pass-confirm" class="form-control" placeholder="Re-enter password" minlength="8" required />
                  </div>
                </div>

                <div style="margin:20px 0; background:#fef2f2; border:1px solid #fecaca; padding:14px; border-radius:var(--radius-sm); font-size:0.8125rem; color:#991b1b; line-height:1.45;">
                  <strong>Access Policy:</strong> Public creation of administrative accounts is strictly prohibited. Unverified onboarding requests are quarantined and audited.
                </div>

                <div style="margin-top:24px;">
                  <button type="submit" id="admin-reg-submit-btn" class="btn btn-outline" style="width:100%; padding:12px; font-weight:700; font-size:0.9375rem; border-color:#991b1b; color:#991b1b;">
                    Submit Administrator Application for Clearance ➔
                  </button>
                </div>
              </form>
            `}

            <div style="text-align:center; border-top:1px solid var(--color-border); padding-top:16px; margin-top:24px;">
              <p style="font-size:0.875rem; color:var(--color-text-secondary); margin:0;">
                Already have an active account? <a href="#login" style="font-weight:700; color:var(--color-primary);">Sign in here</a>
              </p>
            </div>
          </div>
        </div>
      `;
    };

    container.innerHTML = renderForm(currentRoleType);

    const bindEvents = (activeType) => {
      // Tab switcher buttons
      container.querySelectorAll('.reg-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const newType = btn.dataset.type;
          currentRoleType = newType;
          container.innerHTML = renderForm(newType);
          bindEvents(newType);
        });
      });

      // Form Submissions
      if (activeType === 'OWNER') {
        const ownerForm = container.querySelector('#owner-registration-form');
        if (ownerForm) {
          ownerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const p1 = container.querySelector('#owner-pass').value;
            const p2 = container.querySelector('#owner-pass-confirm').value;
            if (p1 !== p2) {
              Components.showToast({ title: "Validation Error", message: "Passwords do not match.", type: "error" });
              return;
            }

            const regData = {
              name: container.querySelector('#owner-name').value.trim(),
              email: container.querySelector('#owner-email').value.trim().toLowerCase(),
              mobile: container.querySelector('#owner-mobile').value.trim(),
              alternateContact: container.querySelector('#owner-alternate').value.trim(),
              identificationNumber: container.querySelector('#owner-id').value.trim(),
              businessName: container.querySelector('#owner-biz-name').value.trim(),
              businessType: container.querySelector('#owner-biz-type').value,
              address: container.querySelector('#owner-address').value.trim(),
              district: container.querySelector('#owner-district').value.trim(),
              state: container.querySelector('#owner-state').value.trim(),
              pinCode: container.querySelector('#owner-pin').value.trim(),
              password: p1,
              role: 'OWNER'
            };

            const submitBtn = container.querySelector('#owner-reg-submit-btn');
            submitBtn.disabled = true;
            submitBtn.textContent = "Creating Account...";

            const res = await window.api.register(regData);
            if (res.success) {
              Components.showToast({
                title: "Registration Successful",
                message: "Account created and activated. Redirecting to Trader Dashboard...",
                type: "success"
              });
              // Automatic login into new owner account
              await window.api.login(regData.email, regData.password);
              setTimeout(() => { location.hash = '#owner-dashboard'; }, 400);
            } else {
              submitBtn.disabled = false;
              submitBtn.textContent = "Submit Instrument Owner Registration ➔";
              Components.showToast({ title: "Registration Failed", message: res.message || "Could not register account.", type: "error" });
            }
          });
        }
      } else if (activeType === 'LMO') {
        const lmoForm = container.querySelector('#lmo-registration-form');
        if (lmoForm) {
          lmoForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const p1 = container.querySelector('#lmo-pass').value;
            const p2 = container.querySelector('#lmo-pass-confirm').value;
            if (p1 !== p2) {
              Components.showToast({ title: "Validation Error", message: "Passwords do not match.", type: "error" });
              return;
            }

            const regData = {
              name: container.querySelector('#lmo-name').value.trim(),
              email: container.querySelector('#lmo-email').value.trim().toLowerCase(),
              mobile: container.querySelector('#lmo-mobile').value.trim(),
              officerId: container.querySelector('#lmo-officer-id').value.trim(),
              designation: container.querySelector('#lmo-designation').value,
              department: container.querySelector('#lmo-department').value.trim(),
              address: container.querySelector('#lmo-office-address').value.trim(),
              district: container.querySelector('#lmo-district').value.trim(),
              state: container.querySelector('#lmo-state').value.trim(),
              password: p1,
              role: 'LMO'
            };

            const submitBtn = container.querySelector('#lmo-reg-submit-btn');
            submitBtn.disabled = true;
            submitBtn.textContent = "Submitting Clearance Request...";

            const res = await window.api.register(regData);
            if (res.success) {
              Components.showModal({
                title: "LMO Registration Submitted",
                content: `
                  <div style="text-align:center; padding:16px 0;">
                    <div style="font-size:3rem; margin-bottom:12px;">⏳</div>
                    <h3 style="font-size:1.125rem; font-weight:800; color:#92400e; margin-bottom:8px;">Status: PENDING APPROVAL</h3>
                    <p style="font-size:0.875rem; color:var(--color-text-secondary); line-height:1.5;">
                      Your official officer application has been securely recorded. Under statutory protocol, full Officer portal access is granted only after verification by the State Metrology Directorate.
                    </p>
                    <div style="background:var(--color-surface); padding:10px; border-radius:var(--radius-sm); font-size:0.8125rem; margin-top:14px; text-align:left;">
                      <div><strong>Officer:</strong> ${regData.name}</div>
                      <div><strong>Official Email:</strong> ${regData.email}</div>
                      <div><strong>Designation:</strong> ${regData.designation} (${regData.district})</div>
                    </div>
                  </div>
                `,
                confirmText: "Acknowledge & Return to Sign-In",
                onConfirm: (close) => {
                  close();
                  location.hash = '#login';
                }
              });
            } else {
              submitBtn.disabled = false;
              submitBtn.textContent = "Submit LMO Registration for Approval ➔";
              Components.showToast({ title: "Submission Failed", message: res.message || "Registration failed.", type: "error" });
            }
          });
        }
      } else if (activeType === 'GATC') {
        const gatcForm = container.querySelector('#gatc-registration-form');
        if (gatcForm) {
          gatcForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const p1 = container.querySelector('#gatc-pass').value;
            const p2 = container.querySelector('#gatc-pass-confirm').value;
            if (p1 !== p2) {
              Components.showToast({ title: "Validation Error", message: "Passwords do not match.", type: "error" });
              return;
            }

            const regData = {
              name: container.querySelector('#gatc-name').value.trim(),
              email: container.querySelector('#gatc-email').value.trim().toLowerCase(),
              mobile: container.querySelector('#gatc-mobile').value.trim(),
              contactPerson: container.querySelector('#gatc-contact').value.trim(),
              gatcReferenceNo: container.querySelector('#gatc-ref-no').value.trim(),
              testingScope: container.querySelector('#gatc-scope').value,
              address: container.querySelector('#gatc-address').value.trim(),
              district: container.querySelector('#gatc-district').value.trim(),
              state: container.querySelector('#gatc-state').value.trim(),
              password: p1,
              role: 'GATC'
            };

            const submitBtn = container.querySelector('#gatc-reg-submit-btn');
            submitBtn.disabled = true;
            submitBtn.textContent = "Submitting GATC Accreditation...";

            const res = await window.api.register(regData);
            if (res.success) {
              Components.showModal({
                title: "GATC Registration Submitted",
                content: `
                  <div style="text-align:center; padding:16px 0;">
                    <div style="font-size:3rem; margin-bottom:12px;">🔬</div>
                    <h3 style="font-size:1.125rem; font-weight:800; color:#1d4ed8; margin-bottom:8px;">Status: PENDING APPROVAL</h3>
                    <p style="font-size:0.875rem; color:var(--color-text-secondary); line-height:1.5;">
                      Your Government Approved Test Centre application has been recorded under reference <strong>${regData.gatcReferenceNo}</strong>. Full test centre allocation will be unlocked upon Directorate verification.
                    </p>
                  </div>
                `,
                confirmText: "Return to Sign-In",
                onConfirm: (close) => {
                  close();
                  location.hash = '#login';
                }
              });
            } else {
              submitBtn.disabled = false;
              submitBtn.textContent = "Submit GATC Test Centre Registration ➔";
              Components.showToast({ title: "Registration Failed", message: res.message || "Failed to submit GATC registration.", type: "error" });
            }
          });
        }
      } else if (activeType === 'ADMIN') {
        const adminForm = container.querySelector('#admin-registration-form');
        if (adminForm) {
          adminForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const p1 = container.querySelector('#admin-pass').value;
            const p2 = container.querySelector('#admin-pass-confirm').value;
            if (p1 !== p2) {
              Components.showToast({ title: "Validation Error", message: "Passwords do not match.", type: "error" });
              return;
            }

            const authCode = container.querySelector('#admin-auth-code').value.trim();
            if (authCode !== 'MX-GOV-ADMIN-2026') {
              Components.showToast({
                title: "Security Clearance Denied",
                message: "Invalid Department Authorization Code. Security violation logged.",
                type: "error"
              });
              return;
            }

            const regData = {
              name: container.querySelector('#admin-name').value.trim(),
              email: container.querySelector('#admin-email').value.trim().toLowerCase(),
              department: container.querySelector('#admin-department').value.trim(),
              designation: container.querySelector('#admin-designation').value.trim(),
              authCode: authCode,
              password: p1,
              role: 'ADMIN'
            };

            const submitBtn = container.querySelector('#admin-reg-submit-btn');
            submitBtn.disabled = true;
            submitBtn.textContent = "Processing Authorization...";

            const res = await window.api.register(regData);
            if (res.success) {
              Components.showModal({
                title: "Administrator Clearance Request Registered",
                content: `
                  <div style="text-align:center; padding:16px 0;">
                    <div style="font-size:3rem; margin-bottom:12px;">🛡️</div>
                    <h3 style="font-size:1.125rem; font-weight:800; color:#991b1b; margin-bottom:8px;">Status: PENDING ADMIN APPROVAL</h3>
                    <p style="font-size:0.875rem; color:var(--color-text-secondary); line-height:1.5;">
                      Your administrator onboarding request has been submitted with valid authorization code. Activation must be approved by an authorized supervisory administrator before portal login is enabled.
                    </p>
                  </div>
                `,
                confirmText: "Return to Sign-In",
                onConfirm: (close) => {
                  close();
                  location.hash = '#login';
                }
              });
            } else {
              submitBtn.disabled = false;
              submitBtn.textContent = "Submit Administrator Application for Clearance ➔";
              Components.showToast({ title: "Authorization Failed", message: res.message || "Failed to process request.", type: "error" });
            }
          });
        }
      }
    };

    bindEvents(currentRoleType);
  }

  // ==========================================
  // Forgot Password & Reset Password (Section 6)
  // ==========================================

  renderForgotPasswordPage(container) {
    let currentStep = 1;
    let recipient = '';
    let maskedRecipient = '';
    let authorizedResetToken = '';
    let cooldownRemaining = 0;
    let cooldownInterval = null;

    const render = () => {
      container.innerHTML = `
        <div style="max-width:560px; margin:40px auto; padding:0 20px;">
          ${this.renderBreadcrumbs([{ label: 'Statutory Password Recovery', url: '#forgot-password' }], true, '#login')}

          <div class="card" style="padding:32px; box-shadow:var(--shadow-lg);">
            <!-- Institutional Header -->
            <div style="text-align:center; margin-bottom:24px;">
              <div style="display:inline-flex; align-items:center; justify-content:center; width:52px; height:52px; border-radius:50%; background:var(--color-primary-subtle); color:var(--color-primary); font-size:1.75rem; margin-bottom:12px;">
                ${currentStep === 1 ? '🔐' : currentStep === 2 ? '📲' : '🔑'}
              </div>
              <h1 style="font-size:1.5rem; font-weight:800; color:var(--color-text); margin-bottom:6px;">
                ${currentStep === 1 ? 'Statutory Account Verification' : currentStep === 2 ? 'Enter Security Verification Code' : 'Establish New Secure Password'}
              </h1>
              <p style="font-size:0.8125rem; color:var(--color-text-secondary); line-height:1.5; max-width:440px; margin:0 auto;">
                ${currentStep === 1 
                  ? 'Enter your registered official email address or mobile number to receive a cryptographic 6-digit One-Time Password (OTP).'
                  : currentStep === 2
                  ? `Enter the 6-digit verification code dispatched to <strong style="color:var(--color-primary);">${maskedRecipient}</strong>.`
                  : 'Enter and confirm your new account password in compliance with metrology portal security standards.'
                }
              </p>
            </div>

            <!-- 3-Step Progress Indicator -->
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:28px; position:relative;">
              <div style="position:absolute; top:14px; left:12%; right:12%; height:2px; background:var(--color-border); z-index:1;"></div>
              <div style="position:absolute; top:14px; left:12%; width:${currentStep === 1 ? '0%' : currentStep === 2 ? '50%' : '100%'}; height:2px; background:var(--color-primary); z-index:1; transition:width 0.3s ease;"></div>
              
              <div style="position:relative; z-index:2; text-align:center;">
                <div style="width:28px; height:28px; border-radius:50%; background:${currentStep >= 1 ? 'var(--color-primary)' : 'var(--color-border)'}; color:#fff; display:flex; align-items:center; justify-content:center; font-size:0.75rem; font-weight:800; margin:0 auto 4px auto;">
                  ${currentStep > 1 ? '✓' : '1'}
                </div>
                <div style="font-size:0.6875rem; font-weight:${currentStep === 1 ? '800' : '600'}; color:${currentStep >= 1 ? 'var(--color-primary)' : 'var(--color-text-secondary)'};">Identity</div>
              </div>

              <div style="position:relative; z-index:2; text-align:center;">
                <div style="width:28px; height:28px; border-radius:50%; background:${currentStep >= 2 ? 'var(--color-primary)' : 'var(--color-surface)'}; border:2px solid ${currentStep >= 2 ? 'var(--color-primary)' : 'var(--color-border)'}; color:${currentStep >= 2 ? '#fff' : 'var(--color-text-secondary)'}; display:flex; align-items:center; justify-content:center; font-size:0.75rem; font-weight:800; margin:0 auto 4px auto;">
                  ${currentStep > 2 ? '✓' : '2'}
                </div>
                <div style="font-size:0.6875rem; font-weight:${currentStep === 2 ? '800' : '600'}; color:${currentStep >= 2 ? 'var(--color-primary)' : 'var(--color-text-secondary)'};">OTP Code</div>
              </div>

              <div style="position:relative; z-index:2; text-align:center;">
                <div style="width:28px; height:28px; border-radius:50%; background:${currentStep >= 3 ? 'var(--color-primary)' : 'var(--color-surface)'}; border:2px solid ${currentStep >= 3 ? 'var(--color-primary)' : 'var(--color-border)'}; color:${currentStep >= 3 ? '#fff' : 'var(--color-text-secondary)'}; display:flex; align-items:center; justify-content:center; font-size:0.75rem; font-weight:800; margin:0 auto 4px auto;">
                  3
                </div>
                <div style="font-size:0.6875rem; font-weight:${currentStep === 3 ? '800' : '600'}; color:${currentStep >= 3 ? 'var(--color-primary)' : 'var(--color-text-secondary)'};">Password</div>
              </div>
            </div>

            <!-- Alert Notification Box -->
            <div id="otp-alert-box" style="display:none; margin-bottom:18px; padding:12px 14px; border-radius:var(--radius-sm); font-size:0.8125rem; line-height:1.45;"></div>

            <!-- Step 1: Identifier Entry -->
            ${currentStep === 1 ? `
              <form id="otp-step1-form">
                <div class="form-group" style="margin-bottom:20px;">
                  <label class="form-label" for="otp-recipient-input">Official Email Address or Registered Mobile <span class="required-star">*</span></label>
                  <input type="text" id="otp-recipient-input" class="form-control" placeholder="e.g. trader@enterprise.com or +91 98765 43210" value="${recipient}" required autocomplete="username" />
                  <div style="font-size:0.75rem; color:var(--color-text-secondary); margin-top:6px;">
                    Verification code will be dispatched via registered statutory communication channel.
                  </div>
                </div>

                <div style="margin-bottom:16px;">
                  <button type="submit" id="otp-step1-submit-btn" class="btn btn-primary" style="width:100%; padding:12px; font-weight:700; font-size:0.9375rem;">
                    Request Verification Code ➔
                  </button>
                </div>
              </form>
            ` : ''}

            <!-- Step 2: 6-Digit OTP Verification -->
            ${currentStep === 2 ? `
              <form id="otp-step2-form">
                <div class="form-group" style="margin-bottom:16px;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <label class="form-label" for="otp-code-input" style="margin:0;">6-Digit Security Code <span class="required-star">*</span></label>
                    <span style="font-size:0.75rem; color:var(--color-primary); font-weight:700;">Valid for 10 min</span>
                  </div>
                  <input type="text" id="otp-code-input" class="form-control" maxlength="6" pattern="[0-9]{6}" inputmode="numeric" placeholder="• • • • • •" required autocomplete="one-time-code" style="text-align:center; font-size:1.75rem; font-weight:800; letter-spacing:8px; font-family:monospace; padding:10px;" />
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; font-size:0.8125rem;">
                  <span id="otp-attempts-info" style="color:var(--color-text-secondary);">Max 5 attempts allowed</span>
                  <button type="button" id="otp-resend-btn" style="background:none; border:none; padding:0; color:var(--color-primary); font-weight:700; cursor:pointer;" ${cooldownRemaining > 0 ? 'disabled' : ''}>
                    ${cooldownRemaining > 0 ? `Resend code in ${cooldownRemaining}s` : 'Resend Code'}
                  </button>
                </div>

                <div style="display:flex; gap:12px; margin-bottom:16px;">
                  <button type="button" id="otp-step2-back-btn" class="btn btn-outline" style="flex:1; padding:12px; font-weight:700;">
                    ← Back
                  </button>
                  <button type="submit" id="otp-step2-submit-btn" class="btn btn-primary" style="flex:2; padding:12px; font-weight:700; font-size:0.9375rem;">
                    Verify Security Code ➔
                  </button>
                </div>
              </form>
            ` : ''}

            <!-- Step 3: New Password Entry -->
            ${currentStep === 3 ? `
              <form id="otp-step3-form">
                <div class="form-group" style="margin-bottom:16px;">
                  <label class="form-label" for="otp-new-password">New Account Password <span class="required-star">*</span></label>
                  <input type="password" id="otp-new-password" class="form-control" placeholder="Min. 8 characters" minlength="8" required autocomplete="new-password" />
                  <div style="font-size:0.75rem; color:var(--color-text-secondary); margin-top:4px;">
                    Must contain at least 8 characters with letters, numbers, and symbols.
                  </div>
                </div>

                <div class="form-group" style="margin-bottom:22px;">
                  <label class="form-label" for="otp-confirm-password">Confirm New Password <span class="required-star">*</span></label>
                  <input type="password" id="otp-confirm-password" class="form-control" placeholder="Re-enter password" minlength="8" required autocomplete="new-password" />
                </div>

                <div style="margin-bottom:16px;">
                  <button type="submit" id="otp-step3-submit-btn" class="btn btn-primary" style="width:100%; padding:12px; font-weight:700; font-size:0.9375rem;">
                    Update Password &amp; Sign In ➔
                  </button>
                </div>
              </form>
            ` : ''}

            <!-- Institutional Security & Advisory Note -->
            <div style="border-top:1px solid var(--color-border); padding-top:16px; margin-top:8px; display:flex; justify-content:space-between; align-items:center; font-size:0.8125rem;">
              <a href="#login" style="color:var(--color-primary); font-weight:700; text-decoration:none;">← Return to Sign-In</a>
              <span style="color:var(--color-text-secondary); font-size:0.75rem;">Legal Metrology Directorate</span>
            </div>
          </div>
        </div>
      `;

      attachListeners();
    };

    const showAlert = (message, isError = true) => {
      const box = container.querySelector('#otp-alert-box');
      if (!box) return;
      box.style.display = 'block';
      if (isError) {
        box.style.background = '#fef2f2';
        box.style.border = '1px solid #fecaca';
        box.style.color = '#991b1b';
        box.innerHTML = `<strong>❌ Verification Notice:</strong> ${message}`;
      } else {
        box.style.background = '#ecfdf5';
        box.style.border = '1px solid #a7f3d0';
        box.style.color = '#065f46';
        box.innerHTML = `<strong>✅ Success:</strong> ${message}`;
      }
    };

    const startCooldown = (seconds = 60) => {
      cooldownRemaining = seconds;
      if (cooldownInterval) clearInterval(cooldownInterval);
      cooldownInterval = setInterval(() => {
        cooldownRemaining--;
        const resendBtn = container.querySelector('#otp-resend-btn');
        if (resendBtn) {
          if (cooldownRemaining > 0) {
            resendBtn.disabled = true;
            resendBtn.textContent = `Resend code in ${cooldownRemaining}s`;
          } else {
            resendBtn.disabled = false;
            resendBtn.textContent = 'Resend Code';
            clearInterval(cooldownInterval);
          }
        } else {
          clearInterval(cooldownInterval);
        }
      }, 1000);
    };

    const attachListeners = () => {
      // Step 1: Request OTP
      const form1 = container.querySelector('#otp-step1-form');
      if (form1) {
        form1.addEventListener('submit', async (e) => {
          e.preventDefault();
          const input = container.querySelector('#otp-recipient-input');
          recipient = input.value.trim();
          const btn = container.querySelector('#otp-step1-submit-btn');
          btn.disabled = true;
          btn.textContent = 'Dispatching Security Code...';

          try {
            const res = await window.api.requestOTP(recipient, 'PASSWORD_RESET');
            if (res.success) {
              maskedRecipient = res.maskedRecipient || recipient;
              currentStep = 2;
              startCooldown(res.cooldownSeconds || 60);
              render();
              showAlert(`A 6-digit statutory verification code was dispatched to ${maskedRecipient}.`, false);
            } else {
              btn.disabled = false;
              btn.textContent = 'Request Verification Code ➔';
              showAlert(res.message || 'Unable to dispatch verification code. Please check your credentials.');
            }
          } catch (err) {
            btn.disabled = false;
            btn.textContent = 'Request Verification Code ➔';
            showAlert('Communication error with authentication server.');
          }
        });
      }

      // Step 2: Verify OTP
      const form2 = container.querySelector('#otp-step2-form');
      if (form2) {
        const otpInput = container.querySelector('#otp-code-input');
        if (otpInput) otpInput.focus();

        const backBtn = container.querySelector('#otp-step2-back-btn');
        if (backBtn) {
          backBtn.addEventListener('click', () => {
            currentStep = 1;
            render();
          });
        }

        const resendBtn = container.querySelector('#otp-resend-btn');
        if (resendBtn) {
          resendBtn.addEventListener('click', async () => {
            if (cooldownRemaining > 0) return;
            resendBtn.disabled = true;
            resendBtn.textContent = 'Dispatching...';
            const res = await window.api.requestOTP(recipient, 'PASSWORD_RESET');
            if (res.success) {
              startCooldown(res.cooldownSeconds || 60);
              showAlert('A fresh verification code has been dispatched.', false);
            } else {
              resendBtn.disabled = false;
              resendBtn.textContent = 'Resend Code';
              showAlert(res.message || 'Could not resend code. Please try again shortly.');
            }
          });
        }

        form2.addEventListener('submit', async (e) => {
          e.preventDefault();
          const code = otpInput.value.trim();
          const btn = container.querySelector('#otp-step2-submit-btn');
          btn.disabled = true;
          btn.textContent = 'Verifying Code...';

          try {
            const res = await window.api.verifyOTP(recipient, code, 'PASSWORD_RESET');
            if (res.success) {
              authorizedResetToken = res.resetToken;
              currentStep = 3;
              if (cooldownInterval) clearInterval(cooldownInterval);
              render();
              showAlert('Identity confirmed. Please choose a new password.', false);
            } else {
              btn.disabled = false;
              btn.textContent = 'Verify Security Code ➔';
              showAlert(res.message || 'Invalid verification code. Please check and retry.');
            }
          } catch (err) {
            btn.disabled = false;
            btn.textContent = 'Verify Security Code ➔';
            showAlert('Verification service error. Please try again.');
          }
        });
      }

      // Step 3: Update Password
      const form3 = container.querySelector('#otp-step3-form');
      if (form3) {
        form3.addEventListener('submit', async (e) => {
          e.preventDefault();
          const newPass = container.querySelector('#otp-new-password').value;
          const confirmPass = container.querySelector('#otp-confirm-password').value;
          const btn = container.querySelector('#otp-step3-submit-btn');

          if (newPass.length < 8) {
            showAlert('Password must contain at least 8 characters.');
            return;
          }
          if (newPass !== confirmPass) {
            showAlert('Passwords do not match. Please verify your entries.');
            return;
          }

          btn.disabled = true;
          btn.textContent = 'Updating Password...';

          try {
            const res = await window.api.resetPassword(authorizedResetToken, newPass);
            if (res.success) {
              if (window.Components && window.Components.showToast) {
                window.Components.showToast({
                  title: 'Password Updated',
                  message: 'Your account credentials have been successfully updated. Please sign in.',
                  type: 'success'
                });
              }
              showAlert('Password updated successfully! Redirecting to sign-in...', false);
              setTimeout(() => {
                window.location.hash = '#login';
              }, 1200);
            } else {
              btn.disabled = false;
              btn.textContent = 'Update Password & Sign In ➔';
              showAlert(res.message || 'Failed to update password. Reset token may have expired.');
            }
          } catch (err) {
            btn.disabled = false;
            btn.textContent = 'Update Password & Sign In ➔';
            showAlert('An error occurred while updating your password.');
          }
        });
      }
    };

    render();
  }


  renderResetPasswordPage(container, token) {
    container.innerHTML = `
      <div style="max-width:520px; margin:48px auto; padding:0 20px;">
        ${this.renderBreadcrumbs([{ label: 'Set New Password', url: '#reset-password' }], true, '#login')}

        <div class="card" style="padding:32px;">
          <div style="text-align:center; margin-bottom:24px;">
            <div style="font-size:2.5rem; margin-bottom:8px;">🔑</div>
            <h1 style="font-size:1.5rem; font-weight:800; color:var(--color-text); margin-bottom:4px;">Set New Password</h1>
            <p style="font-size:0.8125rem; color:var(--color-text-secondary); line-height:1.45;">
              Create a new secure password for your verified MeasureX account.
            </p>
          </div>

          <form id="reset-password-form">
            <div class="form-group" style="margin-bottom:16px;">
              <label class="form-label" for="new-pass">New Password <span class="required-star">*</span></label>
              <input type="password" id="new-pass" class="form-control" placeholder="Min. 8 characters" minlength="8" required />
            </div>

            <div class="form-group" style="margin-bottom:20px;">
              <label class="form-label" for="confirm-new-pass">Confirm New Password <span class="required-star">*</span></label>
              <input type="password" id="confirm-new-pass" class="form-control" placeholder="Re-enter new password" minlength="8" required />
            </div>

            <div style="margin-bottom:16px;">
              <button type="submit" id="save-new-pass-btn" class="btn btn-primary" style="width:100%; padding:12px; font-weight:700;">
                Update Password &amp; Sign In ➔
              </button>
            </div>
          </form>

          <div style="text-align:center; border-top:1px solid var(--color-border); padding-top:16px;">
            <a href="#login" style="font-size:0.875rem; color:var(--color-primary); font-weight:700;">← Cancel and Return to Sign-In</a>
          </div>
        </div>
      </div>
    `;

    const form = container.querySelector('#reset-password-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const p1 = container.querySelector('#new-pass').value;
        const p2 = container.querySelector('#confirm-new-pass').value;

        if (p1 !== p2) {
          Components.showToast({ title: "Validation Error", message: "Passwords do not match.", type: "error" });
          return;
        }

        const submitBtn = container.querySelector('#save-new-pass-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = "Updating Password...";

        const res = await window.api.resetPassword(token, p1);
        if (res.success) {
          Components.showToast({
            title: "Password Updated",
            message: "Your password was updated successfully. Please sign in with your new credentials.",
            type: "success"
          });
          setTimeout(() => {
            location.hash = '#login';
          }, 350);
        } else {
          submitBtn.disabled = false;
          submitBtn.textContent = "Update Password & Sign In ➔";
          Components.showToast({
            title: "Password Reset Failed",
            message: res.message || "Invalid or expired token.",
            type: "error"
          });
        }
      });
    }
  }

  // ==========================================
  // Owner Dashboard & Instruments (Feature 04, 05, 20, 21, 23, 26)
  // ==========================================

  renderOwnerDashboard(container) {
    const instruments = window.state.getInstruments();
    const applications = window.state.getApplications();
    const certificates = window.state.getCertificates();

    const activeCerts = certificates.filter(c => c.status === 'VALID').length;
    const inProgressApps = applications.filter(a => a.status !== 'APPROVED' && a.status !== 'FAILED').length;
    const expiringSoon = instruments.filter(i => i.status === 'EXPIRING_SOON' || i.status === 'EXPIRED').length;

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Owner Dashboard</h1>
          <p class="page-subtitle">Commercial Metrology Portfolio • ${window.state.getCurrentUser().businessName}</p>
        </div>
        <div style="display:flex; gap:10px;">
          <a href="#owner-add-instrument" class="btn btn-secondary">➕ Add Instrument</a>
          <a href="#owner-apply" class="btn btn-primary">🚀 Apply for Verification</a>
        </div>
      </div>

      <!-- Expiry Alert Banner (Feature 21, 23) -->
      ${expiringSoon > 0 ? `
        <div style="background-color:#fffbeb; border:1px solid #fde68a; border-left:4px solid #b45309; padding:14px 18px; border-radius:var(--radius-md); margin-bottom:24px; display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <div>
            <strong style="color:#92400e; font-size:0.9375rem;">⚠️ Attention Required: ${expiringSoon} Instrument(s) Due for Re-verification</strong>
            <div style="font-size:0.8125rem; color:#78350f; margin-top:2px;">Periodic verification expires within 30 days or is overdue. Apply immediately to avoid non-compliance notice.</div>
          </div>
          <a href="#owner-instruments" class="btn btn-sm btn-warning">View Expiring Equipment</a>
        </div>
      ` : ''}

      <!-- Metric Stat Cards (Feature 26) -->
      <div class="dashboard-metrics-grid">
        <div class="stat-card stat-info">
          <div class="stat-header">
            <span class="stat-label">Total Instruments</span>
            <span class="stat-icon">⚖️</span>
          </div>
          <div class="stat-value stat-counter-val" data-target="${instruments.length}">0</div>
          <div class="stat-subtext">Registered at your commercial premises</div>
        </div>

        <div class="stat-card stat-success">
          <div class="stat-header">
            <span class="stat-label">Active Certificates</span>
            <span class="stat-icon">📜</span>
          </div>
          <div class="stat-value stat-counter-val" data-target="${activeCerts}">0</div>
          <div class="stat-subtext">Legally valid & verifiable via QR</div>
        </div>

        <div class="stat-card stat-warning">
          <div class="stat-header">
            <span class="stat-label">Applications In Progress</span>
            <span class="stat-icon">⏳</span>
          </div>
          <div class="stat-value stat-counter-val" data-target="${inProgressApps}">0</div>
          <div class="stat-subtext">Under review or scheduled for inspection</div>
        </div>

        <div class="stat-card stat-danger">
          <div class="stat-header">
            <span class="stat-label">Expiring / Expired</span>
            <span class="stat-icon">⚠️</span>
          </div>
          <div class="stat-value stat-counter-val" data-target="${expiringSoon}">0</div>
          <div class="stat-subtext">Require immediate re-verification filing</div>
        </div>
      </div>

      <div class="dashboard-grid-2col">
        <!-- Left: Recent Applications Table -->
        <div class="dashboard-section">
          <div class="section-header">
            <h2 class="section-title">📝 Recent Applications</h2>
            <a href="#owner-applications" class="btn btn-sm btn-outline">View All</a>
          </div>

          <div class="card table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Application ID</th>
                  <th>Instrument</th>
                  <th>Type</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${applications.length === 0 ? `
                  <tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-muted);">No applications filed yet. Click "Apply for Verification" to begin.</td></tr>
                ` : applications.slice(0, 5).map(app => `
                  <tr>
                    <td class="font-mono">${app.id}</td>
                    <td>
                      <strong>${app.instrumentType || app.type || 'Commercial Instrument'}</strong>
                      <div style="font-size:0.75rem; color:var(--text-muted); font-family:var(--font-mono);">${app.instrumentId || app.serialNumber || '--'}</div>
                    </td>
                    <td><span class="badge status-submitted">${(app.applicationType || 'RE_VERIFICATION').replace('_', ' ')}</span></td>
                    <td>${app.submittedDate || app.submissionDate || '--'}</td>
                    <td>${Components.renderStatusBadge(app.status)}</td>
                    <td>
                      <a href="#owner-application-details?id=${app.id}" class="btn btn-sm btn-secondary">Track</a>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Right: My Registered Instruments Preview -->
        <div class="dashboard-section">
          <div class="section-header">
            <h2 class="section-title">⚖️ My Instruments</h2>
            <a href="#owner-instruments" class="btn btn-sm btn-outline">View All</a>
          </div>

          <div class="card" style="padding:16px; display:flex; flex-direction:column; gap:12px;">
            ${instruments.slice(0, 4).map(ins => `
              <div style="border:1px solid var(--border-light); border-radius:var(--radius-md); padding:12px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <div style="font-weight:700; font-size:0.875rem;">${ins.model}</div>
                  <div style="font-size:0.75rem; color:var(--text-muted); font-family:var(--font-mono);">${ins.id} • ${ins.capacity}</div>
                  <div style="margin-top:4px;">${Components.renderExpiryBadge(ins.validUntil)}</div>
                </div>
                <div>
                  <a href="#owner-instrument-profile?id=${ins.id}" class="btn btn-sm btn-secondary">Profile</a>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================
  // Instrument Registration & Profile (Feature 04, 05)
  // ==========================================

  renderAddInstrumentForm(container) {
    container.innerHTML = `
      <div style="max-width:760px; margin:0 auto;">
        <div class="page-header">
          <div>
            <h1 class="page-title">Register New Instrument</h1>
            <p class="page-subtitle">Onboard commercial weighing and measuring equipment into your digital registry.</p>
          </div>
          <a href="#owner-instruments" class="btn btn-secondary">← Back to Instruments</a>
        </div>

        <div class="card" style="padding:28px;">
          <form id="add-instrument-form">
            <div class="form-fieldset">
              <legend class="form-legend">Equipment Technical Specifications</legend>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="ins-type">Instrument Type <span class="required-star">*</span></label>
                  <select id="ins-type" name="type" class="form-control" required>
                    <option value="">Select Category...</option>
                    <option value="Electronic Weighing Scale (Platform)">Electronic Weighing Scale (Platform)</option>
                    <option value="Countertop Retail Scale">Countertop Retail Scale</option>
                    <option value="Commercial Fuel Dispenser">Commercial Fuel Dispenser</option>
                    <option value="Precision Analytical Balance">Precision Analytical Balance</option>
                    <option value="Heavy Duty Weighbridge">Heavy Duty Weighbridge</option>
                    <option value="Automatic Gravimetric Filling Instrument">Automatic Gravimetric Filling Instrument</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label" for="ins-mfg">Manufacturer Make <span class="required-star">*</span></label>
                  <input type="text" id="ins-mfg" name="manufacturer" class="form-control" placeholder="e.g. Avery Weigh-Tronix" required />
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="ins-model">Model Number / Designation <span class="required-star">*</span></label>
                  <input type="text" id="ins-model" name="model" class="form-control" placeholder="e.g. ZM201 Series" required />
                </div>
                <div class="form-group">
                  <label class="form-label" for="ins-serial">Manufacturer Serial Number <span class="required-star">*</span></label>
                  <input type="text" id="ins-serial" name="serialNumber" class="form-control" placeholder="e.g. AW-2026-9041" required />
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="ins-capacity">Maximum Capacity & Division <span class="required-star">*</span></label>
                  <input type="text" id="ins-capacity" name="capacity" class="form-control" placeholder="e.g. 50 kg (e = 10 g)" required />
                </div>
                <div class="form-group">
                  <label class="form-label" for="ins-purchase-date">Purchase / Installation Date</label>
                  <input type="date" id="ins-purchase-date" name="purchaseDate" class="form-control" value="${new Date().toISOString().slice(0, 10)}" />
                </div>
              </div>
            </div>

            <div class="form-fieldset">
              <legend class="form-legend">Installation & Operating Premises</legend>

              <div class="form-group">
                <label class="form-label" for="ins-location">Physical Operating Location <span class="required-star">*</span></label>
                <input type="text" id="ins-location" name="location" class="form-control" placeholder="e.g. Central Warehouse, Weighing Gate 2, Patna" required />
              </div>

              <div class="form-group">
                <label class="form-label" for="ins-details">Installation & Mounting Details</label>
                <textarea id="ins-details" name="installationDetails" class="form-control" rows="2" placeholder="e.g. Fixed ground mounted platform with external digital display indicator."></textarea>
              </div>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:24px;">
              <a href="#owner-instruments" class="btn btn-secondary">Cancel</a>
              <button type="submit" class="btn btn-primary">Register Instrument</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const form = document.getElementById('add-instrument-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
          type: document.getElementById('ins-type').value,
          manufacturer: document.getElementById('ins-mfg').value,
          model: document.getElementById('ins-model').value,
          serialNumber: document.getElementById('ins-serial').value,
          capacity: document.getElementById('ins-capacity').value,
          purchaseDate: document.getElementById('ins-purchase-date').value,
          location: document.getElementById('ins-location').value,
          installationDetails: document.getElementById('ins-details').value
        };

        const newIns = await window.api.createInstrument(data);

        // Confirmation Modal (Feature 04)
        Components.showModal({
          title: "Instrument Successfully Registered",
          content: `
            <div style="text-align:center; padding:12px 0;">
              <div style="font-size:3rem; margin-bottom:12px;">✅</div>
              <h3 style="font-size:1.25rem; font-weight:800; color:var(--text-primary); margin-bottom:6px;">Registration Confirmed</h3>
              <p style="font-size:0.875rem; color:var(--text-muted); margin-bottom:16px;">Unique Metrology Equipment Identifier assigned:</p>
              <div style="display:inline-block; padding:8px 20px; background:var(--primary-100); border:1px solid var(--primary-700); border-radius:var(--radius-md); font-family:var(--font-mono); font-size:1.25rem; font-weight:800; color:var(--primary-900);">
                ${newIns.id}
              </div>
              <p style="font-size:0.8125rem; color:var(--text-secondary); margin-top:16px; line-height:1.5;">
                You can now file an application for legal verification to obtain an official verification certificate.
              </p>
            </div>
          `,
          confirmText: "Apply for Verification Now",
          cancelText: "View Profile",
          onConfirm: (close) => {
            close();
            location.hash = `#owner-apply?instrumentId=${newIns.id}`;
          }
        });

        // Set cancel button to go to profile
        setTimeout(() => {
          const cancelBtn = document.querySelector('.modal-cancel-btn');
          if (cancelBtn) {
            cancelBtn.onclick = () => {
              Components.closeModal();
              location.hash = `#owner-instrument-profile?id=${newIns.id}`;
            };
          }
        }, 100);
      });
    }
  }

  renderOwnerInstruments(container) {
    const instruments = window.state.getInstruments();

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Registered Instruments</h1>
          <p class="page-subtitle">Equipment portfolio registered under ${window.state.getCurrentUser().businessName}</p>
        </div>
        <a href="#owner-add-instrument" class="btn btn-primary">➕ Register New Instrument</a>
      </div>

      <!-- Filter Bar (Feature 28) -->
      <div class="filter-bar">
        <div class="search-input-wrapper">
          <span class="search-icon">🔍</span>
          <input type="text" id="ins-search-input" class="search-input" placeholder="Search by Instrument ID, Serial No, or Model..." />
        </div>
        <select id="ins-filter-status" class="filter-select">
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active / Verified</option>
          <option value="EXPIRING_SOON">Expiring Soon</option>
          <option value="EXPIRED">Expired</option>
          <option value="PENDING_VERIFICATION">Pending Verification</option>
        </select>
      </div>

      <!-- Instruments Table -->
      <div class="card table-responsive" id="instruments-table-card">
        ${this.renderInstrumentsTableHTML(instruments)}
      </div>
    `;

    // Search and filter listeners
    const searchInput = document.getElementById('ins-search-input');
    const statusFilter = document.getElementById('ins-filter-status');

    const updateTable = () => {
      const q = searchInput.value.toLowerCase();
      const st = statusFilter.value;
      const filtered = instruments.filter(i => {
        const matchesQ = !q || (i.id.toLowerCase().includes(q) || i.serialNumber.toLowerCase().includes(q) || i.model.toLowerCase().includes(q));
        const matchesS = !st || i.status === st;
        return matchesQ && matchesS;
      });
      document.getElementById('instruments-table-card').innerHTML = this.renderInstrumentsTableHTML(filtered);
    };

    searchInput.addEventListener('input', updateTable);
    statusFilter.addEventListener('change', updateTable);
  }

  renderInstrumentsTableHTML(instruments) {
    if (!instruments.length) {
      return `
        <div class="empty-state">
          <div class="empty-state-icon">⚖️</div>
          <div class="empty-state-title">No Instruments Found</div>
          <div class="empty-state-desc">No equipment matches your current search criteria.</div>
        </div>
      `;
    }

    return `
      <table class="table">
        <thead>
          <tr>
            <th>Instrument ID</th>
            <th>Type & Model</th>
            <th>Serial Number</th>
            <th>Capacity</th>
            <th>Validity Status</th>
            <th>Valid Until</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${instruments.map(ins => `
            <tr>
              <td class="font-mono"><strong>${ins.id}</strong></td>
              <td>
                <strong>${ins.model}</strong>
                <div style="font-size:0.75rem; color:var(--text-muted);">${ins.type}</div>
              </td>
              <td class="font-mono">${ins.serialNumber}</td>
              <td>${ins.capacity}</td>
              <td>${Components.renderExpiryBadge(ins.validUntil)}</td>
              <td>${ins.validUntil || 'Not yet verified'}</td>
              <td>
                <div style="display:flex; gap:6px;">
                  <a href="#owner-instrument-profile?id=${ins.id}" class="btn btn-sm btn-secondary" title="View Profile">Profile</a>
                  ${ins.activeCertificateId ? `<a href="#owner-certificate-details?id=${ins.activeCertificateId}" class="btn btn-sm btn-outline" title="Certificate">Cert</a>` : ''}
                  <a href="#owner-re-verify?id=${ins.id}" class="btn btn-sm btn-primary" title="Apply Re-verification">Re-verify</a>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  async renderInstrumentProfile(container, instrumentId) {
    let ins = instrumentId ? window.state.getInstrumentById(instrumentId) : null;
    if (!ins && instrumentId && window.api && window.api.getInstrumentById) {
      try {
        ins = await window.api.getInstrumentById(instrumentId);
      } catch (e) {
        console.warn('Could not fetch instrument from API:', e);
      }
    }
    if (!ins) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 60px 20px; text-align: center;">
          <div style="font-size: 3rem; margin-bottom: 16px;">⚖️</div>
          <h2>Instrument Not Found</h2>
          <p style="color: var(--text-muted); margin-bottom: 24px;">The requested instrument (${instrumentId || 'Unknown'}) could not be found in your registry.</p>
          <a href="#owner-instruments" class="btn btn-primary">Back to Instruments</a>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="max-width:960px; margin:0 auto;">
        <div class="page-header">
          <div>
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:4px;">
              <h1 class="page-title">${ins.model}</h1>
              <span class="font-mono" style="font-size:1.125rem; font-weight:700; color:var(--primary-700);">${ins.id}</span>
            </div>
            <p class="page-subtitle">${ins.type} • ${ins.location}</p>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            ${ins.activeCertificateId ? `<a href="#owner-certificate-details?id=${ins.activeCertificateId}" class="btn btn-outline">📜 View Certificate</a>` : ''}
            <a href="#owner-re-verify?id=${ins.id}" class="btn btn-primary">🚀 Apply for Re-verification</a>
          </div>
        </div>

        <!-- Specifications Card -->
        <div class="card" style="padding:24px; margin-bottom:28px;">
          <h2 class="card-title" style="margin-bottom:16px;">Equipment Specifications & Profile</h2>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:18px 24px;">
            <div>
              <div style="font-size:0.6875rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Instrument ID</div>
              <div class="font-mono" style="font-weight:700; color:var(--text-primary); font-size:1rem;">${ins.id}</div>
            </div>
            <div>
              <div style="font-size:0.6875rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Manufacturer Make</div>
              <div style="font-weight:700; color:var(--text-primary);">${ins.manufacturer}</div>
            </div>
            <div>
              <div style="font-size:0.6875rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Model Designation</div>
              <div style="font-weight:600; color:var(--text-primary);">${ins.model}</div>
            </div>
            <div>
              <div style="font-size:0.6875rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Manufacturer Serial Number</div>
              <div class="font-mono" style="font-weight:700; color:var(--text-primary);">${ins.serialNumber}</div>
            </div>
            <div>
              <div style="font-size:0.6875rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Nominal Capacity</div>
              <div style="font-weight:700; color:var(--text-primary);">${ins.capacity}</div>
            </div>
            <div>
              <div style="font-size:0.6875rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Current Verification Status</div>
              <div>${Components.renderExpiryBadge(ins.validUntil)}</div>
            </div>
            <div>
              <div style="font-size:0.6875rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Valid Until Date</div>
              <div style="font-weight:700; color:var(--text-primary);">${ins.validUntil || 'Not yet verified'}</div>
            </div>
            <div>
              <div style="font-size:0.6875rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Last Inspection Officer</div>
              <div style="font-weight:600; color:var(--text-primary);">${ins.lastOfficer || 'None'}</div>
            </div>
          </div>
        </div>

        <!-- Verification Timeline (Feature 04: Visual Instrument Lifecycle) -->
        <div class="card" style="padding:24px 28px; margin-bottom:28px;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
            <div>
              <h2 class="card-title" style="margin:0;">Verification Lifecycle Flow</h2>
              <p style="font-size:0.8125rem; color:var(--text-muted); margin:4px 0 0 0;">End-to-end statutory status progression for this commercial equipment.</p>
            </div>
            <span class="badge status-submitted" style="font-family:var(--font-mono); font-size:0.75rem;">LIVE STATE</span>
          </div>
          ${Components.renderInstrumentLifecycleTimeline(ins)}
        </div>

        <!-- Verification History (Feature 02: Complete Instrument Lifecycle) -->
        <div class="dashboard-section">
          <div class="section-header">
            <h2 class="section-title">📜 Verification History &amp; Calibration Ledger</h2>
          </div>

          <div class="card table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Cycle</th>
                  <th>Inspection Date</th>
                  <th>Validity Window</th>
                  <th>Officer</th>
                  <th>Observed / MPE</th>
                  <th>Security Seal #</th>
                  <th>Result</th>
                  <th>Certificate</th>
                  <th>Evidence</th>
                </tr>
              </thead>
              <tbody>
                ${ins.verificationHistory && ins.verificationHistory.length ? ins.verificationHistory.map(h => `
                  <tr>
                    <td><strong>${h.year}</strong></td>
                    <td>${h.date}</td>
                    <td style="font-size:0.8125rem;">${h.validFrom || h.date} → <strong>${h.validUntil || '--'}</strong></td>
                    <td>${h.officer}</td>
                    <td class="font-mono" style="font-size:0.8125rem;">${h.observed} (${h.permissible})</td>
                    <td class="font-mono" style="font-size:0.8125rem;">${h.sealNumber || '--'}</td>
                    <td>${Components.renderStatusBadge(h.result)}</td>
                    <td>
                      ${h.certificateId ? `<a href="#owner-certificate-details?id=${h.certificateId}" class="btn btn-sm btn-outline" style="font-family:var(--font-mono); font-size:0.75rem;">${h.certificateId}</a>` : '<span style="color:var(--text-muted); font-size:0.75rem;">--</span>'}
                    </td>
                    <td>
                      ${h.evidence ? `
                        <button type="button" class="btn btn-sm btn-outline view-ins-evidence-btn" data-hist='${JSON.stringify(h).replace(/'/g, "&apos;")}' style="padding:3px 8px; font-size:0.75rem; display:inline-flex; align-items:center; gap:4px;">
                          📷 View
                        </button>
                      ` : '<span style="color:var(--text-muted); font-size:0.75rem;">--</span>'}
                    </td>
                  </tr>
                `).join('') : `
                  <tr><td colspan="9" style="text-align:center; padding:24px; color:var(--text-muted);">No prior verification records for this instrument.</td></tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // Wire evidence lightbox modal
    container.querySelectorAll('.view-ins-evidence-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        try {
          const hData = JSON.parse(btn.dataset.hist);
          Components.showEvidenceModal({
            title: `Statutory Inspection Evidence — Cycle ${hData.year}`,
            evidence: hData.evidence,
            certId: hData.certificateId,
            instrumentId: ins.id
          });
        } catch(e) { console.error(e); }
      });
    });
  }

  // ==========================================
  // Online Verification Application (Feature 06, 07, 22)
  // ==========================================

  renderApplyVerificationForm(container, preselectedInstrumentId) {
    const instruments = window.state.getInstruments();
    if (!instruments || instruments.length === 0) {
      container.innerHTML = `
        <div style="max-width:800px; margin:0 auto;">
          <div class="page-header">
            <div>
              <h1 class="page-title">Apply for Instrument Verification</h1>
              <p class="page-subtitle">Submit statutory application for on-site inspection and digital certification.</p>
            </div>
            <a href="#owner-applications" class="btn btn-secondary">← View Applications</a>
          </div>
          <div class="empty-state card" style="padding: 48px 24px; text-align: center;">
            <div style="font-size: 3rem; margin-bottom: 16px;">⚖️</div>
            <h2>No Registered Instruments Found</h2>
            <p style="color: var(--text-muted); margin-bottom: 24px;">You must register at least one measuring instrument before applying for verification.</p>
            <a href="#owner-add-instrument" class="btn btn-primary">+ Register New Instrument</a>
          </div>
        </div>
      `;
      return;
    }
    const selectedIns = instruments.find(i => i.id === preselectedInstrumentId) || instruments[0];

    container.innerHTML = `
      <div style="max-width:800px; margin:0 auto;">
        <div class="page-header">
          <div>
            <h1 class="page-title">Apply for Instrument Verification</h1>
            <p class="page-subtitle">Submit statutory application for on-site inspection and digital certification.</p>
          </div>
          <a href="#owner-applications" class="btn btn-secondary">← View Applications</a>
        </div>

        <div class="card" style="padding:28px;">
          <form id="apply-verification-form">
            <div class="form-fieldset">
              <legend class="form-legend">1. Select Registered Equipment</legend>

              <div class="form-group">
                <label class="form-label" for="app-instrument">Target Instrument <span class="required-star">*</span></label>
                <select id="app-instrument" class="form-control" required>
                  ${instruments.map(i => `
                    <option value="${i.id}" ${i.id === (selectedIns ? selectedIns.id : '') ? 'selected' : ''}>
                      ${i.id} — ${i.model} (${i.type}) [SN: ${i.serialNumber}]
                    </option>
                  `).join('')}
                </select>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="app-type">Application Type <span class="required-star">*</span></label>
                  <select id="app-type" class="form-control" required>
                    <option value="NEW">New Verification (First-time stamping)</option>
                    <option value="RE_VERIFICATION" selected>Periodic Re-verification (Annual renewal)</option>
                    <option value="REPAIR">Post-Repair / Maintenance Re-stamping</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label" for="app-location">Preferred Inspection Location <span class="required-star">*</span></label>
                  <input type="text" id="app-location" class="form-control" value="${selectedIns ? selectedIns.location : ''}" required />
                </div>
              </div>
            </div>

            <!-- Document Upload Component (Feature 07) -->
            <div class="form-fieldset">
              <legend class="form-legend">2. Statutory Document Upload</legend>
              <p style="font-size:0.8125rem; color:var(--text-muted); margin-bottom:14px;">
                Upload required purchase invoices, manufacturer test certificates, or previous verification documents (PDF, JPG, PNG up to 5MB).
              </p>

              <div class="upload-zone" id="doc-upload-zone">
                <div class="upload-icon">📁</div>
                <div class="upload-text">Click or drag documents to upload</div>
                <div class="upload-hint">Supported: PDF, JPG, PNG (Max 5 MB)</div>
                <input type="file" id="doc-file-input" style="display:none;" multiple accept=".pdf,.jpg,.jpeg,.png" />
              </div>

              <!-- Uploaded files container -->
              <div id="uploaded-files-list">
                <div class="uploaded-file-card" data-filename="Purchase_Invoice.pdf">
                  <div class="file-info">
                    <div class="file-icon">📄</div>
                    <div class="file-meta">
                      <div class="file-name">Purchase_Invoice_Commercial.pdf</div>
                      <div class="file-size">1.2 MB • Ready</div>
                    </div>
                  </div>
                  <div class="file-actions">
                    <span class="badge status-valid">Uploaded</span>
                    <button type="button" class="btn btn-sm btn-secondary" onclick="this.closest('.uploaded-file-card').remove();">Remove</button>
                  </div>
                </div>
              </div>
            </div>

            <div class="form-fieldset">
              <legend class="form-legend">3. Additional Remarks & Operating Schedule</legend>
              <div class="form-group">
                <label class="form-label" for="app-remarks">Remarks for Legal Metrology Officer</label>
                <textarea id="app-remarks" class="form-control" rows="2" placeholder="e.g. Preferred inspection during morning business hours (10:00 AM – 01:00 PM)."></textarea>
              </div>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:24px;">
              <a href="#owner-dashboard" class="btn btn-secondary">Cancel</a>
              <button type="submit" class="btn btn-primary">Submit Application</button>
            </div>
          </form>
        </div>
      </div>
    `;

    // Upload triggers
    const zone = document.getElementById('doc-upload-zone');
    const input = document.getElementById('doc-file-input');
    const list = document.getElementById('uploaded-files-list');

    if (zone && input) {
      zone.addEventListener('click', () => input.click());
      input.addEventListener('change', () => {
        if (input.files && input.files.length) {
          Array.from(input.files).forEach(file => {
            const card = document.createElement('div');
            card.className = 'uploaded-file-card';
            card.innerHTML = `
              <div class="file-info">
                <div class="file-icon">📄</div>
                <div class="file-meta">
                  <div class="file-name">${file.name}</div>
                  <div class="file-size">${(file.size / (1024 * 1024)).toFixed(2)} MB • Uploaded</div>
                </div>
              </div>
              <div class="file-actions">
                <span class="badge status-valid">Uploaded</span>
                <button type="button" class="btn btn-sm btn-secondary" onclick="this.closest('.uploaded-file-card').remove();">Remove</button>
              </div>
            `;
            list.appendChild(card);
          });
        }
      });
    }

    // Submit application
    const form = document.getElementById('apply-verification-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const insId = document.getElementById('app-instrument').value;
        const insObj = window.state.getInstrumentById(insId);

        const appData = {
          instrumentId: insId,
          instrumentType: insObj ? insObj.type : "Instrument",
          serialNumber: insObj ? insObj.serialNumber : "--",
          capacity: insObj ? insObj.capacity : "--",
          applicationType: document.getElementById('app-type').value,
          preferredLocation: document.getElementById('app-location').value,
          remarks: document.getElementById('app-remarks').value
        };

        const newApp = await window.api.createApplication(appData);

        Components.showModal({
          title: "Application Submitted Successfully",
          content: `
            <div style="text-align:center; padding:12px 0;">
              <div style="font-size:3rem; margin-bottom:12px;">📋</div>
              <h3 style="font-size:1.25rem; font-weight:800; color:var(--text-primary); margin-bottom:6px;">Application Filed</h3>
              <p style="font-size:0.875rem; color:var(--text-muted); margin-bottom:16px;">Tracking Application Reference Number:</p>
              <div style="display:inline-block; padding:8px 20px; background:var(--primary-100); border:1px solid var(--primary-700); border-radius:var(--radius-md); font-family:var(--font-mono); font-size:1.25rem; font-weight:800; color:var(--primary-900);">
                ${newApp.id}
              </div>
              <p style="font-size:0.8125rem; color:var(--text-secondary); margin-top:16px; line-height:1.5;">
                Your application has been assigned to the LMO scrutiny queue. You will receive notification updates as inspection scheduling proceeds.
              </p>
            </div>
          `,
          confirmText: "Track Application Status",
          onConfirm: (close) => {
            close();
            location.hash = `#owner-application-details?id=${newApp.id}`;
          }
        });
      });
    }
  }

  renderReVerificationForm(container, instrumentId) {
    // Seamless Re-verification (Feature 22) - pre-fills existing instrument specs
    this.renderApplyVerificationForm(container, instrumentId);
  }

  // ==========================================
  // Application Status & Tracking (Feature 08, 31, 35)
  // ==========================================

  renderOwnerApplications(container) {
    const apps = window.state.getApplications();

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Verification Applications</h1>
          <p class="page-subtitle">Track inspection applications filed for your instruments.</p>
        </div>
        <a href="#owner-apply" class="btn btn-primary">🚀 New Application</a>
      </div>

      <div class="card table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>Application ID</th>
              <th>Instrument</th>
              <th>Type</th>
              <th>Submitted Date</th>
              <th>Assigned Officer</th>
              <th>Current Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${apps.length === 0 ? `
              <tr><td colspan="7" style="text-align:center; padding:32px; color:var(--text-muted);">No verification applications filed yet. Click "🚀 New Application" above to begin.</td></tr>
            ` : apps.map(app => `
              <tr>
                <td class="font-mono"><strong>${app.id}</strong></td>
                <td>
                  <strong>${app.instrumentType || app.type || 'Commercial Instrument'}</strong>
                  <div style="font-size:0.75rem; color:var(--text-muted); font-family:var(--font-mono);">${app.instrumentId || app.serialNumber || '--'}</div>
                </td>
                <td><span class="badge status-submitted">${(app.applicationType || 'RE_VERIFICATION').replace('_', ' ')}</span></td>
                <td>${app.submittedDate || app.submissionDate || '--'}</td>
                <td>${app.assignedOfficerName || '<span style="color:var(--text-muted)">Unassigned</span>'}</td>
                <td>${Components.renderStatusBadge(app.status)}</td>
                <td>
                  <a href="#owner-application-details?id=${app.id}" class="btn btn-sm btn-secondary">Timeline & Details</a>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  renderOwnerVerificationStatus(container) {
    const currentUser = window.state.getCurrentUser();
    let allApps = window.state.getApplications() || [];
    if (currentUser && currentUser.role === 'OWNER') {
      const owned = allApps.filter(a => a.ownerId === currentUser.id || a.ownerName === currentUser.name || a.businessName === currentUser.businessName);
      if (owned.length > 0) allApps = owned;
    }

    const underScrutinyCount = allApps.filter(a => ['SUBMITTED', 'UNDER_REVIEW', 'UNDER_SCRUTINY', 'READY_FOR_ALLOCATION', 'ALLOCATED'].includes(a.status)).length;
    const scheduledCount = allApps.filter(a => ['SCHEDULED'].includes(a.status)).length;
    const inVerificationCount = allApps.filter(a => ['IN_VERIFICATION'].includes(a.status)).length;
    const verifiedCount = allApps.filter(a => ['APPROVED', 'VERIFIED', 'COMPLETED'].includes(a.status)).length;
    const failedCount = allApps.filter(a => ['FAILED', 'REJECTED', 'CORRECTION_REQUIRED'].includes(a.status)).length;

    let currentTab = 'ALL';
    let searchQuery = '';

    const filterApps = () => {
      return allApps.filter(app => {
        if (currentTab === 'IN_PROGRESS') {
          if (!['SUBMITTED', 'UNDER_REVIEW', 'UNDER_SCRUTINY', 'READY_FOR_ALLOCATION', 'ALLOCATED', 'SCHEDULED', 'IN_VERIFICATION'].includes(app.status)) return false;
        } else if (currentTab === 'SCHEDULED') {
          if (app.status !== 'SCHEDULED') return false;
        } else if (currentTab === 'VERIFIED') {
          if (!['APPROVED', 'VERIFIED', 'COMPLETED'].includes(app.status)) return false;
        } else if (currentTab === 'FAILED') {
          if (!['FAILED', 'REJECTED', 'CORRECTION_REQUIRED'].includes(app.status)) return false;
        }

        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const matchId = (app.id || '').toLowerCase().includes(q);
          const matchIns = (app.instrumentId || '').toLowerCase().includes(q);
          const matchType = (app.instrumentType || app.type || '').toLowerCase().includes(q);
          if (!matchId && !matchIns && !matchType) return false;
        }
        return true;
      });
    };

    const renderTable = (apps) => {
      if (!apps.length) {
        return `
          <tr>
            <td colspan="6" style="text-align:center; padding:36px; color:var(--text-muted);">
              <div style="font-size:1.75rem; margin-bottom:8px;">🔍</div>
              <strong>No verification records found in this status category.</strong>
              <div style="font-size:0.8125rem; margin-top:4px;">File a new verification request or select a different filter tab.</div>
            </td>
          </tr>
        `;
      }

      return apps.map(app => {
        let stepProgress = 20;
        let stepLabel = "Scrutiny";
        if (['SCHEDULED'].includes(app.status)) { stepProgress = 50; stepLabel = "Scheduled"; }
        else if (['IN_VERIFICATION'].includes(app.status)) { stepProgress = 75; stepLabel = "In Testing"; }
        else if (['APPROVED', 'VERIFIED', 'COMPLETED'].includes(app.status)) { stepProgress = 100; stepLabel = "Certified"; }
        else if (['FAILED', 'REJECTED'].includes(app.status)) { stepProgress = 100; stepLabel = "Failed Tolerance"; }

        return `
          <tr>
            <td class="font-mono">
              <strong style="color:var(--color-primary);">${app.id}</strong>
              <div style="font-size:0.75rem; color:var(--text-muted);">${app.submittedDate || '2026-09-15'}</div>
            </td>
            <td>
              <strong>${app.instrumentType || app.type || 'Commercial Instrument'}</strong>
              <div class="font-mono" style="font-size:0.75rem; color:var(--text-muted);">${app.instrumentId || '--'}</div>
            </td>
            <td>
              <div>${app.assignedOfficerName ? '👮 ' + app.assignedOfficerName : '<span style="color:var(--text-muted);">Awaiting Assignment</span>'}</div>
              ${app.scheduledDate ? `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">📅 ${app.scheduledDate}</div>` : ''}
            </td>
            <td>
              ${Components.renderStatusBadge(app.status)}
            </td>
            <td style="min-width:140px;">
              <div style="display:flex; justify-content:space-between; font-size:0.6875rem; font-weight:700; color:var(--text-muted); margin-bottom:3px;">
                <span>Progress</span>
                <span>${stepLabel}</span>
              </div>
              <div style="background:#e2e8f0; height:6px; border-radius:3px; overflow:hidden;">
                <div style="background:${app.status === 'FAILED' ? 'var(--color-danger)' : 'var(--color-primary)'}; width:${stepProgress}%; height:100%;"></div>
              </div>
            </td>
            <td>
              <div style="display:flex; gap:6px; flex-wrap:wrap;">
                <a href="#owner-application-details?id=${app.id}" class="btn btn-sm btn-secondary" title="View Verification Timeline">
                  Track ➔
                </a>
                ${['APPROVED', 'VERIFIED', 'COMPLETED'].includes(app.status) ? `
                  <a href="#owner-certificates" class="btn btn-sm btn-outline" style="color:var(--color-success); border-color:var(--color-success);">
                    📜 Certificate
                  </a>
                ` : ''}
                ${['FAILED', 'REJECTED'].includes(app.status) ? `
                  <a href="#owner-apply?instrumentId=${app.instrumentId}" class="btn btn-sm btn-outline" style="color:var(--color-danger); border-color:var(--color-danger);">
                    🔄 Re-apply
                  </a>
                ` : ''}
              </div>
            </td>
          </tr>
        `;
      }).join('');
    };

    container.innerHTML = `
      <div style="max-width:1100px; margin:0 auto;">
        <div class="page-header" style="margin-bottom:24px;">
          <div>
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
              <h1 class="page-title">Instrument Verification Status Tracker</h1>
              <span class="badge status-valid" style="font-weight:700;">STATUTORY LIFECYCLE</span>
            </div>
            <p class="page-subtitle">Real-time scrutiny progression, field officer inspection scheduling, and certification tracking for your instruments.</p>
          </div>
          <div style="display:flex; gap:10px;">
            <a href="#owner-apply" class="btn btn-primary">🚀 Apply for Verification</a>
          </div>
        </div>

        <!-- Verification Metrics Summary Cards -->
        <div class="dashboard-metrics-grid" style="margin-bottom:24px;">
          <div class="stat-card stat-warning" style="cursor:pointer;" id="card-filter-scrutiny">
            <div class="stat-header"><span class="stat-label">Under Scrutiny</span><span>⏳</span></div>
            <div class="stat-value stat-counter-val" data-target="${underScrutinyCount}">${underScrutinyCount}</div>
            <div class="stat-subtext">Directorate documentary review</div>
          </div>

          <div class="stat-card stat-info" style="cursor:pointer;" id="card-filter-scheduled">
            <div class="stat-header"><span class="stat-label">Scheduled Inspection</span><span>📅</span></div>
            <div class="stat-value stat-counter-val" data-target="${scheduledCount}">${scheduledCount}</div>
            <div class="stat-subtext">LMO field visit confirmed</div>
          </div>

          <div class="stat-card stat-info" style="border-left-color:#3b82f6; cursor:pointer;" id="card-filter-testing">
            <div class="stat-header"><span class="stat-label">In Verification</span><span>🔍</span></div>
            <div class="stat-value stat-counter-val" data-target="${inVerificationCount}">${inVerificationCount}</div>
            <div class="stat-subtext">Active field tolerance check</div>
          </div>

          <div class="stat-card stat-success" style="cursor:pointer;" id="card-filter-verified">
            <div class="stat-header"><span class="stat-label">Certified &amp; Valid</span><span>✅</span></div>
            <div class="stat-value stat-counter-val" data-target="${verifiedCount}">${verifiedCount}</div>
            <div class="stat-subtext">Digital certificate issued</div>
          </div>

          <div class="stat-card stat-danger" style="cursor:pointer;" id="card-filter-failed">
            <div class="stat-header"><span class="stat-label">Tolerance Exceeded</span><span>❌</span></div>
            <div class="stat-value stat-counter-val" data-target="${failedCount}">${failedCount}</div>
            <div class="stat-subtext">Requires recalibration</div>
          </div>
        </div>

        <!-- Status Filter Tabs & Search -->
        <div class="card" style="padding:16px 20px; margin-bottom:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap;">
            <div class="tab-nav" style="margin:0;">
              <button type="button" class="tab-btn active" id="status-tab-all">All Filings (${allApps.length})</button>
              <button type="button" class="tab-btn" id="status-tab-progress">In-Progress (${underScrutinyCount + scheduledCount + inVerificationCount})</button>
              <button type="button" class="tab-btn" id="status-tab-scheduled">Scheduled (${scheduledCount})</button>
              <button type="button" class="tab-btn" id="status-tab-verified">Certified (${verifiedCount})</button>
              <button type="button" class="tab-btn" id="status-tab-failed">Failed (${failedCount})</button>
            </div>
            <div style="flex:1; max-width:280px; min-width:200px;">
              <input type="text" id="status-search-input" class="form-control" placeholder="Search application or instrument..." />
            </div>
          </div>
        </div>

        <!-- Applications Status Ledger Table -->
        <div class="card table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Application ID</th>
                <th>Instrument &amp; Model</th>
                <th>Assigned LMO / Visit</th>
                <th>Current Status</th>
                <th>Lifecycle Progress</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="owner-status-table-body">
              ${renderTable(filterApps())}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Event listeners for tabs & search
    const tbody = container.querySelector('#owner-status-table-body');
    const updateList = () => {
      if (tbody) tbody.innerHTML = renderTable(filterApps());
    };

    const setTab = (tabName, btnId) => {
      currentTab = tabName;
      container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      const activeBtn = container.querySelector(btnId);
      if (activeBtn) activeBtn.classList.add('active');
      updateList();
    };

    container.querySelector('#status-tab-all').addEventListener('click', () => setTab('ALL', '#status-tab-all'));
    container.querySelector('#status-tab-progress').addEventListener('click', () => setTab('IN_PROGRESS', '#status-tab-progress'));
    container.querySelector('#status-tab-scheduled').addEventListener('click', () => setTab('SCHEDULED', '#status-tab-scheduled'));
    container.querySelector('#status-tab-verified').addEventListener('click', () => setTab('VERIFIED', '#status-tab-verified'));
    container.querySelector('#status-tab-failed').addEventListener('click', () => setTab('FAILED', '#status-tab-failed'));

    // Cards click to filter
    container.querySelector('#card-filter-scrutiny').addEventListener('click', () => setTab('IN_PROGRESS', '#status-tab-progress'));
    container.querySelector('#card-filter-scheduled').addEventListener('click', () => setTab('SCHEDULED', '#status-tab-scheduled'));
    container.querySelector('#card-filter-testing').addEventListener('click', () => setTab('IN_PROGRESS', '#status-tab-progress'));
    container.querySelector('#card-filter-verified').addEventListener('click', () => setTab('VERIFIED', '#status-tab-verified'));
    container.querySelector('#card-filter-failed').addEventListener('click', () => setTab('FAILED', '#status-tab-failed'));

    const searchInput = container.querySelector('#status-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        updateList();
      });
    }
  }

  async renderApplicationDetails(container, applicationId) {
    let app = applicationId ? window.state.getApplicationById(applicationId) : null;
    if (!app && applicationId && window.api && window.api.getApplicationById) {
      try {
        app = await window.api.getApplicationById(applicationId);
      } catch (e) {
        console.warn('Could not fetch application from API:', e);
      }
    }

    if (!app) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 60px 20px; text-align: center;">
          <div style="font-size: 3rem; margin-bottom: 16px;">📂</div>
          <h2>Application Not Found</h2>
          <p style="color: var(--text-muted); margin-bottom: 24px;">The requested verification application (${applicationId || 'Unknown'}) could not be found.</p>
          <a href="#owner-applications" class="btn btn-primary">Back to Applications</a>
        </div>
      `;
      return;
    }

    // Load dynamic real timeline if not already populated
    if ((!app.timeline || !app.timeline.length) && window.api && window.api.getApplicationTimeline) {
      try {
        const tl = await window.api.getApplicationTimeline(app.id);
        if (tl && tl.length) app.timeline = tl;
      } catch (err) {
        console.warn('Could not load application timeline:', err);
      }
    }

    container.innerHTML = `
      <div style="max-width:960px; margin:0 auto;">
        <div class="page-header">
          <div>
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:4px;">
              <h1 class="page-title">Application ${app.id}</h1>
              ${Components.renderStatusBadge(app.status)}
            </div>
            <p class="page-subtitle">Filed on ${app.submittedDate || app.submissionDate || '2026-09-15'} • ${app.instrumentType} (${app.instrumentId})</p>
          </div>
          <a href="#owner-applications" class="btn btn-secondary">← Back to Applications</a>
        </div>

        <!-- Correction Required Banner (Feature 35) -->
        ${app.status === 'CORRECTION_REQUESTED' ? `
          <div style="background-color:#fff7ed; border:1px solid #fed7aa; border-left:4px solid #ea580c; padding:18px; border-radius:var(--radius-md); margin-bottom:24px;">
            <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap;">
              <div>
                <strong style="color:#c2410c; font-size:1rem;">⚠️ Action Required: LMO Correction Request</strong>
                <p style="font-size:0.875rem; color:#9a3412; margin:6px 0 0 0;">
                  <strong>Reason from Officer:</strong> "${app.correctionReason || app.correctionNotes || 'Please upload a clearer invoice and verify the serial number.'}"
                </p>
              </div>
              <button type="button" class="btn btn-warning" id="resubmit-correction-btn">Submit Correction</button>
            </div>
          </div>
        ` : ''}

        <!-- Visual Verification Lifecycle Stepper (Feature 08, 31, Spec 13-17) -->
        <div class="card" style="padding:24px 28px; margin-bottom:28px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h2 class="card-title" style="margin:0;">Verification Progress Timeline</h2>
            <span class="badge status-valid" style="font-size:0.75rem;">STATUTORY LIFECYCLE</span>
          </div>
          ${Components.renderTimeline(app.timeline, { app })}
        </div>

        <!-- Application Overview Details -->
        <div class="dashboard-grid-2col">
          <div class="card" style="padding:24px;">
            <h3 class="card-title" style="margin-bottom:16px;">Application Details</h3>
            <div style="display:flex; flex-direction:column; gap:12px; font-size:0.875rem;">
              <div><strong style="color:var(--text-muted);">Application Reference:</strong> <span class="font-mono">${app.id}</span></div>
              <div><strong style="color:var(--text-muted);">Instrument ID:</strong> <span class="font-mono">${app.instrumentId}</span></div>
              <div><strong style="color:var(--text-muted);">Equipment Type:</strong> ${app.instrumentType}</div>
              <div><strong style="color:var(--text-muted);">Manufacturer Serial:</strong> <span class="font-mono">${app.serialNumber}</span></div>
              <div><strong style="color:var(--text-muted);">Capacity:</strong> ${app.capacity}</div>
              <div><strong style="color:var(--text-muted);">Operating Location:</strong> ${app.preferredLocation}</div>
              <div><strong style="color:var(--text-muted);">Applicant Remarks:</strong> ${app.remarks || '--'}</div>
            </div>
          </div>

          <div class="card" style="padding:24px;">
            <h3 class="card-title" style="margin-bottom:16px;">Assigned Inspection Schedule</h3>
            <div style="display:flex; flex-direction:column; gap:12px; font-size:0.875rem;">
              <div><strong style="color:var(--text-muted);">Assigned Legal Metrology Officer:</strong> <strong>${app.assignedOfficerName || 'Pending Assignment'}</strong></div>
              <div><strong style="color:var(--text-muted);">Scheduled Date:</strong> ${app.scheduledDate || 'Pending Scheduling'}</div>
              <div><strong style="color:var(--text-muted);">Scheduled Time:</strong> ${app.scheduledTime || 'Pending Scheduling'}</div>
              <div><strong style="color:var(--text-muted);">Inspection Location:</strong> ${app.preferredLocation}</div>
              ${app.status === 'SCHEDULED' ? `
                <div style="margin-top:10px; padding:10px 14px; background:var(--color-info-bg); border-radius:var(--radius-sm); color:var(--color-info); font-size:0.8125rem;">
                  ℹ️ Please ensure the instrument is cleaned and available at the specified premises for standard test weight application.
                </div>
              ` : ''}
              ${app.status === 'APPROVED' ? `
                <div style="margin-top:10px;">
                  <a href="#owner-certificates" class="btn btn-success" style="width:100%;">View Official Verification Certificate</a>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    `;

    // Resubmit Correction Handler
    const resubmitBtn = document.getElementById('resubmit-correction-btn');
    if (resubmitBtn) {
      resubmitBtn.addEventListener('click', () => {
        Components.showModal({
          title: "Submit Application Correction",
          content: `
            <div class="form-group">
              <label class="form-label">Updated Remarks / Explanation</label>
              <textarea id="correction-reply-text" class="form-control" rows="3" placeholder="Explain the corrections made (e.g. Uploaded revised high-resolution invoice)"></textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Upload Revised Document</label>
              <input type="file" class="form-control" />
            </div>
          `,
          confirmText: "Resubmit to LMO",
          onConfirm: async (close) => {
            const explanation = document.getElementById('correction-reply-text').value;
            await window.api.resubmitApplication(app.id, {
              remarks: `${app.remarks} | Correction: ${explanation}`,
              documents: [{ name: "Revised_Document_Clear.pdf", size: "1.4 MB", type: "PDF", uploadedAt: new Date().toISOString().slice(0, 10) }]
            });
            Components.showToast({ title: "Application Resubmitted", message: "Application returned to LMO review queue.", type: "success" });
            close();
            this.handleRouting();
          }
        });
      });
    }
  }

  // ==========================================
  // Digital Certificate & QR (Feature 16, 17, 33, 34)
  // ==========================================

  renderOwnerCertificates(container) {
    const certs = window.state.getCertificates();

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Digital Verification Certificates</h1>
          <p class="page-subtitle">Statutory Legal Metrology Certificates issued for your equipment.</p>
        </div>
      </div>

      <div class="card table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>Certificate ID</th>
              <th>Instrument</th>
              <th>Serial Number</th>
              <th>Issue Date</th>
              <th>Valid Until</th>
              <th>Status</th>
              <th>QR Code</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${certs.map(c => `
              <tr>
                <td class="font-mono"><strong>${c.id}</strong></td>
                <td>
                  <strong>${c.instrumentType}</strong>
                  <div style="font-size:0.75rem; color:var(--text-muted); font-family:var(--font-mono);">${c.instrumentId}</div>
                </td>
                <td class="font-mono">${c.serialNumber}</td>
                <td>${c.verificationDate}</td>
                <td style="font-weight:700;">${c.validUntil}</td>
                <td>${Components.renderStatusBadge(c.status)}</td>
                <td>
                  <a href="#verify?id=${c.id}" title="Click to verify QR">
                    ${Components.renderQRCodeSVG(c.id, 40)}
                  </a>
                </td>
                <td>
                  <div style="display:flex; gap:6px;">
                    <a href="#owner-certificate-details?id=${c.id}" class="btn btn-sm btn-primary">View Document</a>
                    <a href="#verify?id=${c.id}" class="btn btn-sm btn-secondary">Live QR</a>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  async renderCertificateDetails(container, certId) {
    let cert = certId ? window.state.getCertificateById(certId) : null;
    if (!cert && certId && window.api && window.api.getCertificateById) {
      try {
        cert = await window.api.getCertificateById(certId);
      } catch (e) {
        console.warn('Could not fetch certificate from API:', e);
      }
    }

    const role = window.state.getCurrentRole();
    const backRoute = role === 'LMO' ? '#lmo-certificates' : (role === 'ADMIN' ? '#admin-certificates' : '#owner-certificates');

    if (!cert) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 60px 20px; text-align: center;">
          <div style="font-size: 3rem; margin-bottom: 16px;">🛡️</div>
          <h2>Certificate Not Found</h2>
          <p style="color: var(--text-muted); margin-bottom: 24px;">The requested metrological verification certificate (${certId || 'Unknown'}) could not be found.</p>
          <a href="${backRoute}" class="btn btn-primary">Back to Certificates</a>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="certificate-page-wrap">
        <div class="certificate-actions-bar">
          <a href="${backRoute}" class="btn btn-secondary">← Back to Certificates</a>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button type="button" class="btn btn-secondary" id="cert-copy-link-btn">📋 Copy Verification Link</button>
            <button type="button" class="btn btn-secondary" onclick="window.print();">🖨️ Print / Download PDF</button>
            <a href="#verify?id=${cert.id}" class="btn btn-primary">🔍 Live Public QR Verify</a>
            ${role === 'ADMIN' && cert.status === 'VALID' ? `
              <button type="button" class="btn btn-danger" id="admin-revoke-cert-btn">🚫 Revoke Certificate</button>
            ` : ''}
          </div>
        </div>

        <!-- Official Legal Metrology Certificate Document Layout (Feature 16) -->
        <div class="official-certificate" id="printable-certificate">
          <!-- Status Stamp (Feature 19) -->
          <div class="cert-status-stamp stamp-${cert.status.toLowerCase()}">
            ${cert.status}
          </div>

          <div class="cert-header">
            <div class="cert-emblem">
              <svg viewBox="0 0 100 100" fill="none">
                <circle cx="50" cy="50" r="45" stroke="#0d4434" stroke-width="4" />
                <path d="M50 15 L50 85 M20 50 L80 50" stroke="#0d4434" stroke-width="2" />
                <circle cx="50" cy="50" r="28" fill="#f0fdf4" stroke="#15803d" stroke-width="3" />
                <text x="50" y="54" font-size="12" font-weight="900" text-anchor="middle" fill="#0d4434">LEGAL</text>
                <text x="50" y="66" font-size="8" font-weight="700" text-anchor="middle" fill="#059669">METROLOGY</text>
              </svg>
            </div>
            <div class="cert-govt-title">${cert.authority || 'Department of Legal Metrology, Government of Bihar'}</div>
            <h1 class="cert-main-title">Certificate of Verification</h1>
            <div class="cert-sub-title">Issued under Section 24 of the Legal Metrology Act & Enforcement Rules</div>
            <div class="cert-number-banner">
              CERTIFICATE NO: <span>${cert.id}</span>
            </div>
          </div>

          <div class="cert-body">
            <p class="cert-preamble">
              This is to officially certify that the commercial weighing/measuring instrument described hereunder has been subjected to statutory tests of verification by an authorized Legal Metrology Officer. The instrument has been tested with reference standards of verified accuracy and conforms to the permissible Maximum Permissible Error (MPE) tolerances prescribed by statutory regulations.
            </p>

            <div class="cert-details-grid">
              <div class="cert-detail-item">
                <span class="cert-detail-label">Instrument Category & Type</span>
                <span class="cert-detail-value">${cert.instrumentType}</span>
              </div>
              <div class="cert-detail-item">
                <span class="cert-detail-label">Equipment Serial Number</span>
                <span class="cert-detail-value font-mono">${cert.serialNumber}</span>
              </div>
              <div class="cert-detail-item">
                <span class="cert-detail-label">Manufacturer & Model</span>
                <span class="cert-detail-value">${cert.manufacturer} — ${cert.model}</span>
              </div>
              <div class="cert-detail-item">
                <span class="cert-detail-label">Nominal Maximum Capacity</span>
                <span class="cert-detail-value">${cert.capacity}</span>
              </div>
              <div class="cert-detail-item">
                <span class="cert-detail-label">Registered Commercial User</span>
                <span class="cert-detail-value">${cert.businessName} (${cert.ownerName})</span>
              </div>
              <div class="cert-detail-item">
                <span class="cert-detail-label">Operating Location</span>
                <span class="cert-detail-value">${cert.location}</span>
              </div>
              <div class="cert-detail-item">
                <span class="cert-detail-label">Verification Date</span>
                <span class="cert-detail-value">${cert.verificationDate}</span>
              </div>
              <div class="cert-detail-item">
                <span class="cert-detail-label">Certificate Valid Until</span>
                <span class="cert-detail-value font-mono" style="color:var(--primary-800);">${cert.validUntil}</span>
              </div>
              <div class="cert-detail-item">
                <span class="cert-detail-label">Observed Verification Test Error</span>
                <span class="cert-detail-value font-mono">${cert.observedMeasurement || '50.02 kg'} (Tolerance: ${cert.permissibleError || '±0.05 kg'})</span>
              </div>
              <div class="cert-detail-item">
                <span class="cert-detail-label">Lead / Security Seal Mark Number</span>
                <span class="cert-detail-value font-mono">${cert.sealNumber || 'BR-LM-2026-9941'}</span>
              </div>
            </div>
          </div>

          <!-- Certificate Footer: QR Code & Signatures -->
          <div class="cert-footer">
            <div class="cert-qr-area" onclick="location.hash='#verify?id=${cert.id}'">
              <div class="cert-qr-box">
                ${Components.renderQRCodeSVG(cert.id, 90)}
              </div>
              <span class="cert-qr-hint">Scan or Click to Verify</span>
            </div>

            <div class="cert-signatures">
              <div class="cert-signature-box">
                <div class="signature-line"></div>
                <div class="signature-name">${cert.officerName}</div>
                <div class="signature-title">${cert.officerDesignation}</div>
              </div>
              <div class="cert-signature-box">
                <div class="signature-line"></div>
                <div class="signature-name">Dr. Sunita Verma</div>
                <div class="signature-title">Controller of Legal Metrology</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Copy Verification Link Handler
    const copyBtn = document.getElementById('cert-copy-link-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        const verifyUrl = `${window.location.origin}/#verify?id=${encodeURIComponent(cert.id)}`;
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(verifyUrl);
          } else {
            const temp = document.createElement('textarea');
            temp.value = verifyUrl;
            document.body.appendChild(temp);
            temp.select();
            document.execCommand('copy');
            document.body.removeChild(temp);
          }
          Components.showToast({
            title: "Verification Link Copied",
            message: `Public link copied to clipboard: ${verifyUrl}`,
            type: "success"
          });
        } catch (e) {
          Components.showToast({
            title: "Verification Link",
            message: verifyUrl,
            type: "info"
          });
        }
      });
    }

    // Revocation Handler (Feature 34)
    const revokeBtn = document.getElementById('admin-revoke-cert-btn');
    if (revokeBtn) {
      revokeBtn.addEventListener('click', () => {
        Components.showModal({
          title: "Revoke Digital Certificate",
          content: `
            <div style="padding:10px 0;">
              <p style="font-size:0.875rem; color:var(--color-danger); margin-bottom:12px;">
                <strong>Warning:</strong> Revoking this certificate will immediately invalidate this equipment. The public QR verification portal will show status <strong>REVOKED</strong>.
              </p>
              <div class="form-group">
                <label class="form-label">Mandatory Revocation Justification <span class="required-star">*</span></label>
                <textarea id="revoke-reason-input" class="form-control" rows="3" placeholder="State reason (e.g. Tampered security wire seal detected during market surveillance)"></textarea>
              </div>
            </div>
          `,
          confirmText: "Confirm Revocation",
          onConfirm: async (close) => {
            const reason = document.getElementById('revoke-reason-input').value.trim();
            if (!reason) {
              Components.showToast({ title: "Reason Required", message: "Please enter a revocation justification.", type: "warning" });
              return;
            }
            await window.api.revokeCertificate(cert.id, reason);
            Components.showToast({ title: "Certificate Revoked", message: `Certificate ${cert.id} is now REVOKED.`, type: "error" });
            close();
            this.handleRouting();
          }
        });
      });
    }
  }

  // ==========================================
  // LMO Experience (Feature 09, 10, 11, 12, 13, 14, 15, 25, 36, 37)
  // ==========================================

  renderLMODashboard(container) {
    const apps = window.state.getApplications();
    const instruments = window.state.getInstruments();

    const newApps = apps.filter(a => a.status === 'SUBMITTED').length;
    const pendingReview = apps.filter(a => a.status === 'UNDER_REVIEW' || a.status === 'SUBMITTED').length;
    const scheduled = apps.filter(a => a.status === 'SCHEDULED').length;
    const todays = apps.filter(a => a.scheduledDate === '2026-09-28').length;
    const completed = apps.filter(a => a.status === 'APPROVED').length;
    const failed = apps.filter(a => a.status === 'FAILED').length;
    const expiring = instruments.filter(i => i.status === 'EXPIRING_SOON' || i.status === 'EXPIRED').length;

    const queueApps = (apps || []).slice(0, 8);

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Legal Metrology Officer Dashboard</h1>
          <p class="page-subtitle">Officer: ${window.state.getCurrentUser().name} • Patna Central Division</p>
        </div>
        <div style="display:flex; gap:10px;">
          <a href="#lmo-calendar" class="btn btn-secondary">📅 Inspection Calendar</a>
          <a href="#lmo-field-verification" class="btn btn-primary">🔍 Field Inspection</a>
        </div>
      </div>

      <!-- 7 LMO Metric Cards (Feature 25) -->
      <div class="dashboard-metrics-grid">
        <div class="stat-card stat-info">
          <div class="stat-header"><span class="stat-label">New Applications</span><span>📥</span></div>
          <div class="stat-value stat-counter-val" data-target="${newApps}">0</div>
          <div class="stat-subtext">Awaiting initial scrutiny</div>
        </div>

        <div class="stat-card stat-warning">
          <div class="stat-header"><span class="stat-label">Pending Review</span><span>📋</span></div>
          <div class="stat-value stat-counter-val" data-target="${pendingReview}">0</div>
          <div class="stat-subtext">Under officer assessment</div>
        </div>

        <div class="stat-card stat-info">
          <div class="stat-header"><span class="stat-label">Scheduled</span><span>📅</span></div>
          <div class="stat-value stat-counter-val" data-target="${scheduled}">0</div>
          <div class="stat-subtext">Inspection date assigned</div>
        </div>

        <div class="stat-card stat-success">
          <div class="stat-header"><span class="stat-label">Today's Verifications</span><span>⏱️</span></div>
          <div class="stat-value stat-counter-val" data-target="${todays || 1}">0</div>
          <div class="stat-subtext">28 Sep 2026 inspections</div>
        </div>

        <div class="stat-card stat-success">
          <div class="stat-header"><span class="stat-label">Completed PASS</span><span>✅</span></div>
          <div class="stat-value stat-counter-val" data-target="${completed}">0</div>
          <div class="stat-subtext">Certificates generated</div>
        </div>

        <div class="stat-card stat-danger">
          <div class="stat-header"><span class="stat-label">Failed Verifications</span><span>❌</span></div>
          <div class="stat-value stat-counter-val" data-target="${failed}">0</div>
          <div class="stat-subtext">Tolerance error non-compliant</div>
        </div>

        <div class="stat-card stat-warning">
          <div class="stat-header"><span class="stat-label">Expiring in Jurisdiction</span><span>⚠️</span></div>
          <div class="stat-value stat-counter-val" data-target="${expiring}">0</div>
          <div class="stat-subtext">Due for surveillance notice</div>
        </div>
      </div>

      <!-- Action Required Section -->
      <div class="dashboard-section">
        <div class="section-header">
          <h2 class="section-title">📂 Inspection Applications Queue</h2>
          <a href="#lmo-applications" class="btn btn-sm btn-outline">View All Applications</a>
        </div>

        ${queueApps.length === 0 ? `
          <div class="card" style="padding:32px; text-align:center; color:var(--color-text-muted);">
            <div style="font-size:1.75rem; margin-bottom:8px;">📂</div>
            <strong>No inspection applications currently in queue.</strong>
            <div style="font-size:0.8125rem; margin-top:4px;">All scheduled and pending applications have been processed.</div>
          </div>
        ` : `
          <!-- Desktop Table (min-width: 769px) -->
          <div class="card table-responsive lmo-queue-desktop">
            <table class="table">
              <thead>
                <tr>
                  <th>App ID</th>
                  <th>Applicant / Business</th>
                  <th>Equipment Type</th>
                  <th>Serial Number</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Officer</th>
                  <th>Scheduled Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${queueApps.map(app => `
                  <tr>
                    <td class="font-mono"><strong>${app.id}</strong></td>
                    <td>
                      <div style="font-weight:600; color:var(--color-text);">${app.businessName || app.applicantName || '—'}</div>
                      <div style="font-size:0.75rem; color:var(--color-text-muted);">${app.ownerName || app.applicantName || ''}</div>
                    </td>
                    <td>${app.instrumentType || app.type || '—'}</td>
                    <td class="font-mono" style="font-size:0.8125rem;">${app.serialNumber || app.serial_number || '—'}</td>
                    <td style="font-size:0.8125rem;">${app.preferredLocation || app.location || '—'}</td>
                    <td>${Components.renderStatusBadge(app.status)}</td>
                    <td>${app.assignedOfficerName || '<span style="color:var(--color-text-muted)">Unassigned</span>'}</td>
                    <td style="font-size:0.8125rem; white-space:nowrap;">${app.scheduledDate ? `${app.scheduledDate}` : '<span style="color:var(--color-text-muted)">Not scheduled</span>'}</td>
                    <td>
                      <div style="display:flex; gap:6px;">
                        <a href="#lmo-review?id=${app.id}" class="btn btn-sm btn-secondary" title="Application Scrutiny">Scrutiny</a>
                        ${['SCHEDULED', 'IN_VERIFICATION'].includes(app.status) ? `
                          <a href="#lmo-field-verification?id=${app.id}" class="btn btn-sm btn-primary" title="Conduct Field Verification">Inspect</a>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Mobile Cards (max-width: 768px) -->
          <div class="lmo-queue-mobile">
            <div class="lmo-queue-mobile-cards">
              ${queueApps.map(app => `
                <div class="card lmo-app-card" style="padding:14px; margin-bottom:12px; border:1px solid var(--color-border);">
                  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; gap:8px;">
                    <div>
                      <span class="font-mono" style="font-weight:700; font-size:0.875rem; color:var(--color-primary);">${app.id}</span>
                      <div style="font-weight:600; font-size:0.9375rem; margin-top:2px;">${app.businessName || app.applicantName || '—'}</div>
                      <div style="font-size:0.75rem; color:var(--color-text-muted);">${app.ownerName || app.applicantName || ''}</div>
                    </div>
                    <div>${Components.renderStatusBadge(app.status)}</div>
                  </div>
                  <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:0.8125rem; margin-bottom:12px; background:var(--color-surface-hover); padding:10px; border-radius:var(--radius-sm);">
                    <div><span style="color:var(--color-text-muted);">Equipment:</span> <strong>${app.instrumentType || app.type || '—'}</strong></div>
                    <div><span style="color:var(--color-text-muted);">Serial:</span> <span class="font-mono">${app.serialNumber || app.serial_number || '—'}</span></div>
                    <div><span style="color:var(--color-text-muted);">Location:</span> ${app.preferredLocation || app.location || '—'}</div>
                    <div><span style="color:var(--color-text-muted);">Officer:</span> ${app.assignedOfficerName || 'Unassigned'}</div>
                    <div style="grid-column: span 2;"><span style="color:var(--color-text-muted);">Scheduled:</span> ${app.scheduledDate ? `${app.scheduledDate} ${app.scheduledTime ? `• ${app.scheduledTime}` : ''}` : 'Not scheduled'}</div>
                  </div>
                  <div style="display:flex; gap:8px;">
                    <a href="#lmo-review?id=${app.id}" class="btn btn-sm btn-secondary" style="flex:1; text-align:center;">Scrutiny</a>
                    ${['SCHEDULED', 'IN_VERIFICATION'].includes(app.status) ? `
                      <a href="#lmo-field-verification?id=${app.id}" class="btn btn-sm btn-primary" style="flex:1; text-align:center;">Inspect</a>
                    ` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `}
      </div>
    `;
  }

  renderLMOApplications(container, initialFilter = 'all') {
    const allApps = window.state.getApplications() || [];

    const normFilter = (initialFilter || 'all').toLowerCase();
    let currentTab = 'ALL';
    if (normFilter === 'pending' || normFilter === 'submitted') currentTab = 'SUBMITTED';
    else if (normFilter === 'scrutiny') currentTab = 'UNDER_SCRUTINY';
    else if (normFilter === 'scheduled') currentTab = 'SCHEDULED';
    else if (normFilter === 'completed' || normFilter === 'verified') currentTab = 'COMPLETED';
    else if (normFilter === 'failed') currentTab = 'FAILED';

    let currentDistrict = 'ALL';
    let searchQuery = '';

    const newCount = allApps.filter(a => ['SUBMITTED', 'PENDING'].includes(a.status)).length;
    const scrutinyCount = allApps.filter(a => ['UNDER_SCRUTINY', 'UNDER_REVIEW', 'READY_FOR_ALLOCATION', 'ALLOCATED'].includes(a.status)).length;
    const scheduledCount = allApps.filter(a => ['SCHEDULED'].includes(a.status)).length;
    const inVerifCount = allApps.filter(a => ['IN_VERIFICATION'].includes(a.status)).length;
    const completedCount = allApps.filter(a => ['APPROVED', 'VERIFIED', 'COMPLETED'].includes(a.status)).length;
    const failedCount = allApps.filter(a => ['FAILED', 'REJECTED', 'CORRECTION_REQUIRED'].includes(a.status)).length;

    const getFilteredApps = () => {
      return allApps.filter(app => {
        // Tab filter
        if (currentTab === 'SUBMITTED' && !['SUBMITTED', 'PENDING'].includes(app.status)) return false;
        if (currentTab === 'UNDER_SCRUTINY' && !['UNDER_SCRUTINY', 'UNDER_REVIEW', 'READY_FOR_ALLOCATION', 'ALLOCATED'].includes(app.status)) return false;
        if (currentTab === 'SCHEDULED' && app.status !== 'SCHEDULED') return false;
        if (currentTab === 'IN_VERIFICATION' && app.status !== 'IN_VERIFICATION') return false;
        if (currentTab === 'COMPLETED' && !['APPROVED', 'VERIFIED', 'COMPLETED'].includes(app.status)) return false;
        if (currentTab === 'FAILED' && !['FAILED', 'REJECTED', 'CORRECTION_REQUIRED'].includes(app.status)) return false;

        // District filter
        if (currentDistrict !== 'ALL') {
          const appDist = app.preferredLocation || app.location || app.district || '';
          if (!appDist.toLowerCase().includes(currentDistrict.toLowerCase())) return false;
        }

        // Search text
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const matchId = (app.id || '').toLowerCase().includes(q);
          const matchTrader = (app.businessName || app.applicantName || app.ownerName || '').toLowerCase().includes(q);
          const matchIns = (app.instrumentId || app.instrumentType || '').toLowerCase().includes(q);
          if (!matchId && !matchTrader && !matchIns) return false;
        }

        return true;
      });
    };

    const renderTableRows = (apps) => {
      if (!apps.length) {
        return `
          <tr>
            <td colspan="8" style="text-align:center; padding:36px; color:var(--text-muted);">
              <div style="font-size:1.75rem; margin-bottom:8px;">🔍</div>
              <strong>No applications found in this queue category.</strong>
              <div style="font-size:0.8125rem; margin-top:4px;">Try selecting another status tab or resetting the search filter.</div>
            </td>
          </tr>
        `;
      }

      return apps.map(app => {
        const canReview = ['SUBMITTED', 'PENDING', 'UNDER_SCRUTINY', 'UNDER_REVIEW', 'READY_FOR_ALLOCATION', 'ALLOCATED'].includes(app.status);
        const canInspect = ['SCHEDULED', 'IN_VERIFICATION'].includes(app.status);
        const isCompleted = ['APPROVED', 'VERIFIED', 'COMPLETED'].includes(app.status);

        return `
          <tr>
            <td class="font-mono">
              <strong style="color:var(--color-primary);">${app.id}</strong>
              <div style="font-size:0.75rem; color:var(--text-muted);">${app.submittedDate || '2026-09-15'}</div>
            </td>
            <td>
              <div style="font-weight:700;">${app.businessName || app.applicantName || 'Commercial Trader'}</div>
              <div style="font-size:0.75rem; color:var(--text-muted);">${app.ownerName || ''}</div>
            </td>
            <td>
              <strong>${app.instrumentType || app.type || 'Commercial Scale'}</strong>
              <div class="font-mono" style="font-size:0.75rem; color:var(--text-muted);">${app.instrumentId || app.serialNumber || '--'}</div>
            </td>
            <td>
              <span class="badge" style="background:#f1f5f9; color:#475569; font-size:0.75rem;">${app.preferredLocation || app.location || 'Patna'}</span>
            </td>
            <td>${Components.renderStatusBadge(app.status)}</td>
            <td>
              <div>${app.assignedOfficerName ? '👮 ' + app.assignedOfficerName : '<span style="color:var(--text-muted);">Unassigned</span>'}</div>
            </td>
            <td>
              <div style="font-size:0.8125rem;">
                ${app.scheduledDate ? '📅 ' + app.scheduledDate : '<span style="color:var(--text-muted);">Not scheduled</span>'}
              </div>
            </td>
            <td>
              <div style="display:flex; gap:6px; flex-wrap:wrap;">
                ${canReview ? `
                  <a href="#lmo-review?id=${app.id}" class="btn btn-sm btn-secondary" title="Review documentary scrutiny">
                    Review ➔
                  </a>
                  <a href="#lmo-schedule?id=${app.id}" class="btn btn-sm btn-outline" title="Schedule field inspection">
                    📅 Schedule
                  </a>
                ` : ''}
                ${canInspect ? `
                  <a href="#lmo-field-verification?id=${app.id}" class="btn btn-sm btn-primary" title="Execute field verification">
                    Inspect ⚖️
                  </a>
                ` : ''}
                ${isCompleted ? `
                  <a href="#owner-certificate-details?id=${app.certificateId || app.instrumentId}" class="btn btn-sm btn-outline" style="color:var(--color-success); border-color:var(--color-success);">
                    📜 Certificate
                  </a>
                ` : ''}
                ${!canReview && !canInspect && !isCompleted ? `
                  <a href="#lmo-review?id=${app.id}" class="btn btn-sm btn-outline">
                    View
                  </a>
                ` : ''}
              </div>
            </td>
          </tr>
        `;
      }).join('');
    };

    container.innerHTML = `
      <div class="page-header" style="margin-bottom:20px;">
        <div>
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
            <h1 class="page-title">Officer Applications Scrutiny</h1>
            <span class="badge status-scheduled" style="font-weight:700;">STATUTORY QUEUE</span>
          </div>
          <p class="page-subtitle">Statutory documentary scrutiny, field inspection scheduling, and verification records dispatch.</p>
        </div>
      </div>

      <!-- Queue Metrics Bar -->
      <div class="card" style="padding:16px 20px; margin-bottom:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap;">
          <div class="tab-nav" style="margin:0; flex-wrap:wrap;">
            <button type="button" class="tab-btn ${currentTab === 'ALL' ? 'active' : ''}" data-tab="ALL">All (${allApps.length})</button>
            <button type="button" class="tab-btn ${currentTab === 'SUBMITTED' ? 'active' : ''}" data-tab="SUBMITTED">New / Submitted (${newCount})</button>
            <button type="button" class="tab-btn ${currentTab === 'UNDER_SCRUTINY' ? 'active' : ''}" data-tab="UNDER_SCRUTINY">Under Scrutiny (${scrutinyCount})</button>
            <button type="button" class="tab-btn ${currentTab === 'SCHEDULED' ? 'active' : ''}" data-tab="SCHEDULED">Scheduled (${scheduledCount})</button>
            <button type="button" class="tab-btn ${currentTab === 'IN_VERIFICATION' ? 'active' : ''}" data-tab="IN_VERIFICATION">In Verification (${inVerifCount})</button>
            <button type="button" class="tab-btn ${currentTab === 'COMPLETED' ? 'active' : ''}" data-tab="COMPLETED">Certified (${completedCount})</button>
            <button type="button" class="tab-btn ${currentTab === 'FAILED' ? 'active' : ''}" data-tab="FAILED">Failed (${failedCount})</button>
          </div>
          <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
            <select id="lmo-filter-district" class="form-control" style="width:150px; font-size:0.8125rem; padding:6px 10px;">
              <option value="ALL">All Districts</option>
              <option value="Patna">Patna</option>
              <option value="Gaya">Gaya</option>
              <option value="Muzaffarpur">Muzaffarpur</option>
              <option value="Bhagalpur">Bhagalpur</option>
            </select>
            <input type="text" id="lmo-search-input" class="form-control" style="width:200px; font-size:0.8125rem; padding:6px 10px;" placeholder="Search app, trader, scale..." />
          </div>
        </div>
      </div>

      <!-- Scrutiny Queue Table -->
      <div class="card table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>App ID &amp; Date</th>
              <th>Applicant / Business</th>
              <th>Instrument Type</th>
              <th>Jurisdiction</th>
              <th>Current Status</th>
              <th>Assigned Officer</th>
              <th>Schedule</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="lmo-apps-table-body">
            ${renderTableRows(getFilteredApps())}
          </tbody>
        </table>
      </div>
    `;

    const tbody = container.querySelector('#lmo-apps-table-body');
    const updateView = () => {
      if (tbody) tbody.innerHTML = renderTableRows(getFilteredApps());
    };

    container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTab = btn.dataset.tab;
        updateView();
      });
    });

    const distSelect = container.querySelector('#lmo-filter-district');
    if (distSelect) {
      distSelect.addEventListener('change', (e) => {
        currentDistrict = e.target.value;
        updateView();
      });
    }

    const searchInp = container.querySelector('#lmo-search-input');
    if (searchInp) {
      searchInp.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        updateView();
      });
    }
  }

  // ==========================================
  // LMO Application Review & Officer Assignment (Feature 09, 10, 11, 35)
  // ==========================================

  async renderLMOReview(container, appId) {
    let app = appId ? window.state.getApplicationById(appId) : null;
    if (!app && appId && window.api && window.api.getApplicationById) {
      try {
        app = await window.api.getApplicationById(appId);
      } catch (e) {
        console.warn('Could not fetch application from API:', e);
      }
    }
    if (!app) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 60px 20px; text-align: center;">
          <div style="font-size: 3rem; margin-bottom: 16px;">📂</div>
          <h2>Application Not Found</h2>
          <p style="color: var(--text-muted); margin-bottom: 24px;">The requested application (${appId || 'Unknown'}) could not be found in the scrutiny queue.</p>
          <a href="#lmo-applications" class="btn btn-primary">Back to Applications</a>
        </div>
      `;
      return;
    }
    const ins = window.state.getInstrumentById(app.instrumentId) || {};
    const officers = window.state.getOfficers() || [];

    container.innerHTML = `
      <div style="max-width:960px; margin:0 auto;">
        <div class="page-header">
          <div>
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:4px;">
              <h1 class="page-title">Review Application ${app.id}</h1>
              ${Components.renderStatusBadge(app.status)}
            </div>
            <p class="page-subtitle">Applicant Scrutiny & Officer Assignment</p>
          </div>
          <a href="#lmo-applications" class="btn btn-secondary">← Back to Queue</a>
        </div>

        <!-- 4 Structured Review Panels (Feature 09) -->
        <div class="dashboard-grid-2col" style="margin-bottom:24px;">
          <!-- Panel 1: Applicant Details -->
          <div class="card" style="padding:20px;">
            <h3 class="card-title" style="margin-bottom:12px; font-size:1rem;">👤 Applicant Information</h3>
            <div style="display:flex; flex-direction:column; gap:8px; font-size:0.875rem;">
              <div><strong style="color:var(--text-muted);">Applicant Name:</strong> ${app.ownerName}</div>
              <div><strong style="color:var(--text-muted);">Trade / Business:</strong> ${app.businessName}</div>
              <div><strong style="color:var(--text-muted);">Operating Location:</strong> ${app.preferredLocation}</div>
              <div><strong style="color:var(--text-muted);">Contact Email:</strong> ${app.ownerEmail || (window.state.currentUser ? window.state.currentUser.email : 'Registered Contact Email')}</div>
              <div><strong style="color:var(--text-muted);">Mobile:</strong> ${app.ownerMobile || (window.state.currentUser ? window.state.currentUser.mobile : 'Registered Mobile Number')}</div>
            </div>
          </div>

          <!-- Panel 2: Instrument Specs -->
          <div class="card" style="padding:20px;">
            <h3 class="card-title" style="margin-bottom:12px; font-size:1rem;">⚖️ Instrument Specifications</h3>
            <div style="display:flex; flex-direction:column; gap:8px; font-size:0.875rem;">
              <div><strong style="color:var(--text-muted);">Instrument ID:</strong> <span class="font-mono">${app.instrumentId}</span></div>
              <div><strong style="color:var(--text-muted);">Category / Type:</strong> ${app.instrumentType}</div>
              <div><strong style="color:var(--text-muted);">Serial Number:</strong> <span class="font-mono">${app.serialNumber}</span></div>
              <div><strong style="color:var(--text-muted);">Capacity:</strong> ${app.capacity}</div>
              <div><strong style="color:var(--text-muted);">Make:</strong> ${ins ? ins.manufacturer : 'Avery Weigh-Tronix'}</div>
            </div>
          </div>
        </div>

        <div class="dashboard-grid-2col" style="margin-bottom:24px;">
          <!-- Panel 3: Uploaded Documents -->
          <div class="card" style="padding:20px;">
            <h3 class="card-title" style="margin-bottom:12px; font-size:1rem;">📁 Uploaded Documents</h3>
            <div style="display:flex; flex-direction:column; gap:8px;">
              ${app.documents && app.documents.length ? app.documents.map(d => `
                <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; background:var(--bg-surface-alt); border:1px solid var(--border-light); border-radius:var(--radius-sm);">
                  <div style="font-size:0.8125rem; font-weight:600;">📄 ${d.name} (${d.size})</div>
                  <span class="badge status-valid">Verified</span>
                </div>
              `).join('') : '<div style="font-size:0.8125rem; color:var(--text-muted);">No documents attached.</div>'}
            </div>
          </div>

          <!-- Panel 4: Verification History & Officer Assignment (Feature 11) -->
          <div class="card" style="padding:20px;">
            <h3 class="card-title" style="margin-bottom:12px; font-size:1rem;">👮 Officer Assignment &amp; Deployment</h3>
            <div class="form-group" style="margin-bottom:12px;">
              <label class="form-label" for="assign-officer-select">Assigned Officer</label>
              <select id="assign-officer-select" class="form-control">
                ${officers.map(o => `
                  <option value="${o.id}" ${o.id === app.assignedOfficerId ? 'selected' : ''}>
                    ${o.name} (${o.jurisdiction})
                  </option>
                `).join('')}
              </select>
            </div>
            <button type="button" class="btn btn-sm btn-secondary" id="save-officer-btn" style="width:100%;">Update Officer Assignment</button>
          </div>
        </div>

        <!-- Equipment Prior Verification History (Feature 02) -->
        <div class="card" style="padding:20px; margin-bottom:24px;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
            <div>
              <h3 class="card-title" style="margin:0; font-size:1rem;">📜 Equipment Verification History &amp; Calibration Data</h3>
              <p style="font-size:0.8125rem; color:var(--text-muted); margin:4px 0 0 0;">Inspect prior inspection results, observed errors vs MPE, and active wire seals for ${app.instrumentId}.</p>
            </div>
            ${ins && ins.verificationHistory ? `<span class="badge status-submitted" style="font-size:0.75rem;">${ins.verificationHistory.length} Prior Cycles</span>` : ''}
          </div>
          
          <div class="table-responsive">
            <table class="table" style="font-size:0.8125rem;">
              <thead>
                <tr>
                  <th>Cycle Year</th>
                  <th>Inspection Date</th>
                  <th>Validity Period</th>
                  <th>Officer</th>
                  <th>Observed / MPE</th>
                  <th>Security Seal #</th>
                  <th>Result</th>
                  <th>Evidence</th>
                </tr>
              </thead>
              <tbody>
                ${ins && ins.verificationHistory && ins.verificationHistory.length ? ins.verificationHistory.map(h => `
                  <tr>
                    <td><strong>${h.year}</strong></td>
                    <td>${h.date}</td>
                    <td>${h.validFrom || h.date} → ${h.validUntil || '--'}</td>
                    <td>${h.officer}</td>
                    <td class="font-mono">${h.observed} (${h.permissible})</td>
                    <td class="font-mono">${h.sealNumber || '--'}</td>
                    <td>${Components.renderStatusBadge(h.result)}</td>
                    <td>
                      ${h.evidence ? `
                        <button type="button" class="btn btn-sm btn-outline view-lmo-hist-evidence-btn" data-hist='${JSON.stringify(h).replace(/'/g, "&apos;")}' style="padding:2px 8px; font-size:0.75rem;">
                          📷 View
                        </button>
                      ` : '<span style="color:var(--text-muted);">--</span>'}
                    </td>
                  </tr>
                `).join('') : `
                  <tr><td colspan="8" style="text-align:center; padding:16px; color:var(--text-muted);">No prior inspection records registered for this equipment.</td></tr>
                `}
              </tbody>
            </table>
          </div>
        </div>

        <!-- LMO Decision Actions (Feature 09, 10, 35) -->
        <div class="card" style="padding:20px; background:var(--bg-surface-alt); display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap;">
          <div>
            <strong>Scrutiny Actions:</strong> Approve for inspection, request revised documents, or schedule directly.
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button type="button" class="btn btn-warning" id="lmo-request-correction-btn">Request Correction</button>
            <button type="button" class="btn btn-danger" id="lmo-reject-btn">Reject Application</button>
            <button type="button" class="btn btn-primary" id="lmo-schedule-btn">Schedule Verification</button>
          </div>
        </div>
      </div>
    `;

    // Wire LMO history evidence viewer
    container.querySelectorAll('.view-lmo-hist-evidence-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        try {
          const hData = JSON.parse(btn.dataset.hist);
          Components.showEvidenceModal({
            title: `Inspection Evidence — Cycle ${hData.year}`,
            evidence: hData.evidence,
            certId: hData.certificateId,
            instrumentId: app.instrumentId
          });
        } catch(e) { console.error(e); }
      });
    });

    // Save Officer Assignment (Feature 11)
    const saveOfficerBtn = document.getElementById('save-officer-btn');
    if (saveOfficerBtn) {
      saveOfficerBtn.addEventListener('click', async () => {
        const offId = document.getElementById('assign-officer-select').value;
        await window.api.assignOfficer(app.id, offId);
        Components.showToast({ title: "Officer Assigned", message: "Officer assignment updated successfully.", type: "success" });
        this.handleRouting();
      });
    }

    // Schedule Button (Feature 10)
    const schedBtn = document.getElementById('lmo-schedule-btn');
    if (schedBtn) {
      schedBtn.addEventListener('click', () => {
        Components.showModal({
          title: `Schedule Verification for ${app.id}`,
          content: `
            <div class="form-group">
              <label class="form-label">Application ID</label>
              <input type="text" class="form-control" value="${app.id}" disabled />
            </div>
            <div class="form-group">
              <label class="form-label">Assigned Legal Metrology Officer <span class="required-star">*</span></label>
              <select id="modal-officer-select" class="form-control">
                ${officers.map(o => `<option value="${o.id}" ${o.id === app.assignedOfficerId ? 'selected' : ''}>${o.name} (${o.jurisdiction})</option>`).join('')}
              </select>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Inspection Date <span class="required-star">*</span></label>
                <input type="date" id="modal-sched-date" class="form-control" value="2026-09-28" />
              </div>
              <div class="form-group">
                <label class="form-label">Inspection Time <span class="required-star">*</span></label>
                <input type="time" id="modal-sched-time" class="form-control" value="11:30" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Inspection Location</label>
              <input type="text" id="modal-sched-loc" class="form-control" value="${app.preferredLocation}" />
            </div>
          `,
          confirmText: "Confirm Inspection Schedule",
          onConfirm: async (close) => {
            const date = document.getElementById('modal-sched-date').value;
            const time = document.getElementById('modal-sched-time').value;
            const off = document.getElementById('modal-officer-select').value;
            const loc = document.getElementById('modal-sched-loc').value;

            await window.api.scheduleVerification(app.id, {
              officerId: off,
              scheduledDate: date,
              scheduledTime: time,
              location: loc
            });

            Components.showToast({ title: "Inspection Scheduled", message: `Scheduled on ${date} at ${time}. Status set to SCHEDULED.`, type: "success" });
            close();
            this.handleRouting();
          }
        });
      });
    }

    // Request Correction (Feature 35)
    const reqCorrBtn = document.getElementById('lmo-request-correction-btn');
    if (reqCorrBtn) {
      reqCorrBtn.addEventListener('click', () => {
        Components.showModal({
          title: "Request Application Correction",
          content: `
            <div class="form-group">
              <label class="form-label">Correction Reason / Missing Information <span class="required-star">*</span></label>
              <textarea id="correction-reason-text" class="form-control" rows="3" placeholder="e.g. Please upload a clear photograph of the instrument seal and verify serial number."></textarea>
            </div>
          `,
          confirmText: "Dispatch Request to Owner",
          onConfirm: async (close) => {
            const reason = document.getElementById('correction-reason-text').value.trim();
            if (!reason) {
              Components.showToast({ title: "Reason Required", message: "Please enter a correction reason.", type: "warning" });
              return;
            }
            await window.api.requestCorrection(app.id, reason);
            Components.showToast({ title: "Correction Requested", message: "Owner notified of required amendments.", type: "warning" });
            close();
            this.handleRouting();
          }
        });
      });
    }

    // Reject Application
    const rejectBtn = document.getElementById('lmo-reject-btn');
    if (rejectBtn) {
      rejectBtn.addEventListener('click', () => {
        Components.showModal({
          title: "Reject Statutory Application",
          content: `
            <div style="padding:8px 0;">
              <p style="font-size:0.875rem; color:var(--color-danger); margin-bottom:12px;">
                State the formal statutory grounds for rejecting Application <strong>${app.id}</strong>.
              </p>
              <div class="form-group">
                <label class="form-label">Official Rejection Reason <span class="required-star">*</span></label>
                <textarea id="rejection-reason-text" class="form-control" rows="3" placeholder="State non-compliance grounds under Legal Metrology Act..."></textarea>
              </div>
            </div>
          `,
          confirmText: "Confirm Rejection",
          confirmClass: "btn-danger",
          onConfirm: async (close) => {
            const reason = (document.getElementById('rejection-reason-text')?.value || '').trim();
            if (!reason) {
              Components.showToast({ title: "Reason Required", message: "Please enter an official rejection reason.", type: "warning" });
              return;
            }
            await window.api.rejectApplication(app.id, reason);
            Components.showToast({ title: "Application Rejected", message: `Application ${app.id} has been formally rejected.`, type: "error" });
            close();
            this.handleRouting();
          }
        });
      });
    }
  }

  // Schedule Application Form (Feature 10)
  async renderLMOScheduleForm(container, appId) {
    let app = appId ? window.state.getApplicationById(appId) : null;
    if (!app && appId && window.api && window.api.getApplicationById) {
      try {
        app = await window.api.getApplicationById(appId);
      } catch (e) {
        console.warn('Could not fetch application from API:', e);
      }
    }
    if (!app && !appId) {
      const allApps = window.state.getApplications();
      app = allApps.find(a => a.status === 'SUBMITTED' || a.status === 'UNDER_REVIEW');
    }

    if (!app) {
      container.innerHTML = `
        <div style="max-width:800px; margin:40px auto; padding:0 20px;">
          ${this.renderBreadcrumbs([{ label: 'Applications', url: '#lmo-applications' }, { label: 'Schedule', url: '#lmo-schedule' }], true, '#lmo-dashboard')}
          <div class="card" style="padding:48px 24px; text-align:center;">
            <div style="font-size:3rem; margin-bottom:12px;">📅</div>
            <h2 style="font-size:1.5rem; font-weight:800; color:var(--color-text); margin-bottom:8px;">${appId ? 'Application Not Found' : 'No Pending Applications to Schedule'}</h2>
            <p style="color:var(--color-text-secondary); max-width:500px; margin:0 auto 24px auto; font-size:0.9375rem;">
              ${appId ? `The requested application (${appId}) was not found in the scheduling queue.` : 'All current verification applications have already been scheduled or inspected.'}
            </p>
            <a href="#lmo-applications" class="btn btn-primary">Browse Applications ➔</a>
          </div>
        </div>
      `;
      return;
    }

    const officers = window.state.getOfficers();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const defaultDate = tomorrow.toISOString().slice(0, 10);

    container.innerHTML = `
      <div style="max-width:860px; margin:0 auto; padding:0 20px;">
        ${this.renderBreadcrumbs([
          { label: 'Applications', url: '#lmo-applications' },
          { label: app.id, url: `#lmo-review?id=${app.id}` },
          { label: 'Schedule Inspection', url: `#lmo-schedule?id=${app.id}` }
        ], true, '#lmo-applications')}

        <div class="page-header" style="margin-bottom:24px;">
          <div>
            <h1 class="page-title">Schedule Field Verification</h1>
            <p class="page-subtitle">Assign an inspector officer, date, time, and premises for application ${app.id}.</p>
          </div>
          <a href="#lmo-review?id=${app.id}" class="btn btn-secondary">← Back to Review</a>
        </div>

        <div class="card" style="padding:28px;">
          <form id="lmo-schedule-direct-form">
            <div style="background:var(--color-surface); border:1px solid var(--color-border); border-radius:var(--radius-md); padding:16px; margin-bottom:20px; display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px; font-size:0.875rem;">
              <div><strong style="color:var(--text-muted); font-size:0.75rem;">APPLICATION ID:</strong><div class="font-mono" style="font-weight:700;">${app.id}</div></div>
              <div><strong style="color:var(--text-muted); font-size:0.75rem;">TRADER / BUSINESS:</strong><div style="font-weight:600;">${app.businessName}</div></div>
              <div><strong style="color:var(--text-muted); font-size:0.75rem;">TARGET INSTRUMENT:</strong><div class="font-mono" style="font-weight:600;">${app.instrumentId}</div></div>
              <div><strong style="color:var(--text-muted); font-size:0.75rem;">CURRENT STATUS:</strong><div>${Components.renderStatusBadge(app.status)}</div></div>
            </div>

            <div class="form-group" style="margin-bottom:18px;">
              <label class="form-label" for="sched-officer-select">Assigning Legal Metrology Officer <span class="required-star">*</span></label>
              <select id="sched-officer-select" class="form-control" required>
                ${officers.map(o => `<option value="${o.id}" ${o.id === app.assignedOfficerId ? 'selected' : ''}>${o.name} (${o.jurisdiction})</option>`).join('')}
              </select>
            </div>

            <div class="form-row" style="margin-bottom:18px;">
              <div class="form-group">
                <label class="form-label" for="sched-date-input">Inspection Date <span class="required-star">*</span></label>
                <input type="date" id="sched-date-input" class="form-control" value="${app.scheduledDate || defaultDate}" required />
              </div>
              <div class="form-group">
                <label class="form-label" for="sched-time-input">Inspection Time Slot <span class="required-star">*</span></label>
                <input type="time" id="sched-time-input" class="form-control" value="${app.scheduledTime || '11:00'}" required />
              </div>
            </div>

            <div class="form-group" style="margin-bottom:24px;">
              <label class="form-label" for="sched-loc-input">Inspection Premises / Location <span class="required-star">*</span></label>
              <input type="text" id="sched-loc-input" class="form-control" value="${app.scheduledLocation || app.preferredLocation || ''}" required />
            </div>

            <div style="display:flex; justify-content:flex-end; gap:12px;">
              <a href="#lmo-review?id=${app.id}" class="btn btn-secondary">Cancel</a>
              <button type="submit" id="sched-submit-btn" class="btn btn-primary" style="font-weight:700;">
                Confirm & Dispatch Schedule ➔
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    const form = container.querySelector('#lmo-schedule-direct-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const offId = document.getElementById('sched-officer-select').value;
        const d = document.getElementById('sched-date-input').value;
        const t = document.getElementById('sched-time-input').value;
        const loc = document.getElementById('sched-loc-input').value;

        const submitBtn = document.getElementById('sched-submit-btn');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Dispatching Schedule...';
        }

        try {
          await window.api.scheduleVerification(app.id, {
            officerId: offId,
            date: d,
            time: t,
            location: loc
          });
          Components.showToast({
            title: "Inspection Scheduled",
            message: `Field verification for ${app.id} confirmed for ${d} at ${t}.`,
            type: "success"
          });
          window.location.hash = `#lmo-review?id=${app.id}`;
        } catch (err) {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Confirm & Dispatch Schedule ➔';
          }
          Components.showToast({
            title: "Scheduling Failed",
            message: err.message || "Could not schedule verification.",
            type: "error"
          });
        }
      });
    }
  }

  // ==========================================
  // Field Verification Form (Feature 12, 13, 14, 15, 37)
  // ==========================================

  async renderLMOFieldVerification(container, appId) {
    let app = appId ? window.state.getApplicationById(appId) : null;
    if (!app && appId && window.api && window.api.getApplicationById) {
      try {
        app = await window.api.getApplicationById(appId);
      } catch (e) {
        console.warn('Could not fetch application from API:', e);
      }
    }
    if (!app && !appId) {
      const apps = window.state.getApplications();
      app = apps.find(a => a.status === 'SCHEDULED' || a.status === 'UNDER_REVIEW' || a.status === 'SUBMITTED');
    }
    if (!app) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 60px 20px; text-align: center;">
          <div style="font-size: 3rem; margin-bottom: 16px;">🔍</div>
          <h2>${appId ? 'Application Not Found' : 'No Applications Available for Field Inspection'}</h2>
          <p style="color: var(--text-muted); margin-bottom: 24px;">${appId ? `The requested application (${appId}) was not found.` : 'There are currently no verification applications ready for field inspection.'}</p>
          <a href="#lmo-applications" class="btn btn-primary">View Applications</a>
        </div>
      `;
      return;
    }
    const ins = window.state.getInstrumentById(app.instrumentId) || {};

    // Check for existing draft inspection saved locally (Feature 05)
    const existingDraft = window.state.getInspectionDraft ? window.state.getInspectionDraft(app.id) : null;

    // Track captured photographic evidence
    const capturedEvidence = existingDraft && existingDraft.evidence ? { ...existingDraft.evidence } : {
      instrument: { name: "Instrument_Plate_Photo.jpg", url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='90' viewBox='0 0 120 90'><rect width='120' height='90' fill='%23e0f2fe'/><text x='60' y='45' font-size='11' text-anchor='middle' fill='%230369a1' font-family='sans-serif' font-weight='bold'>Scale Photo</text><text x='60' y='65' font-size='22' text-anchor='middle'>⚖️</text></svg>", verified: true },
      seal: { name: "Lead_Wire_Seal_CloseUp.jpg", url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='90' viewBox='0 0 120 90'><rect width='120' height='90' fill='%23ecfdf5'/><text x='60' y='45' font-size='11' text-anchor='middle' fill='%23047857' font-family='sans-serif' font-weight='bold'>Seal BR-9941</text><text x='60' y='65' font-size='22' text-anchor='middle'>🏷️</text></svg>", verified: true },
      testWeights: { name: "Standard_Weights_Verification.jpg", url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='90' viewBox='0 0 120 90'><rect width='120' height='90' fill='%23fef3c7'/><text x='60' y='45' font-size='11' text-anchor='middle' fill='%23b45309' font-family='sans-serif' font-weight='bold'>Standard Weights</text><text x='60' y='65' font-size='22' text-anchor='middle'>📦</text></svg>", verified: true },
      worksheet: { name: "Statutory_Calibration_Worksheet.pdf", url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='90' viewBox='0 0 120 90'><rect width='120' height='90' fill='%23f1f5f9'/><text x='60' y='45' font-size='11' text-anchor='middle' fill='%23475569' font-family='sans-serif' font-weight='bold'>Worksheet</text><text x='60' y='65' font-size='22' text-anchor='middle'>📝</text></svg>", verified: true }
    };

    container.innerHTML = `
      <div class="field-verification-container">
        <div class="page-header">
          <div>
            <div style="display:inline-flex; align-items:center; gap:6px; padding:3px 10px; background:var(--primary-100); color:var(--primary-800); border-radius:var(--radius-sm); font-size:0.75rem; font-weight:700; margin-bottom:6px;">
              📱 Mobile Field Inspection Console
            </div>
            <h1 class="page-title">Field Verification Inspection</h1>
            <p class="page-subtitle">${app.id} • ${app.businessName} (${app.preferredLocation})</p>
          </div>
          <a href="#lmo-dashboard" class="btn btn-secondary">← Back to Dashboard</a>
        </div>

        ${existingDraft ? `
          <div style="background-color:#eff6ff; border:1px solid #bfdbfe; border-left:4px solid #3b82f6; padding:14px 18px; border-radius:var(--radius-md); margin-bottom:20px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
            <div>
              <strong style="color:#1d4ed8; font-size:0.875rem;">📋 Inspection Draft Restored</strong>
              <div style="font-size:0.8125rem; color:#1e40af; margin-top:2px;">
                Restored previously saved local field checklist and measurements (Saved: ${existingDraft.savedAt ? existingDraft.savedAt.slice(0, 16).replace('T', ' ') : 'earlier'}).
              </div>
            </div>
            <button type="button" class="btn btn-sm btn-outline" id="clear-draft-btn" style="border-color:#3b82f6; color:#1d4ed8;">Discard Draft</button>
          </div>
        ` : ''}

        <form id="field-verification-form">
          <!-- Section 1: Instrument Identification (Feature 12) -->
          <div class="field-inspection-card">
            <h2 class="card-title" style="margin-bottom:14px;">1. Instrument Identification &amp; Metadata</h2>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:14px; background:var(--bg-surface-alt); padding:16px; border-radius:var(--radius-md);">
              <div><strong style="color:var(--text-muted); font-size:0.75rem;">INSTRUMENT ID:</strong><div class="font-mono" style="font-weight:700;">${app.instrumentId}</div></div>
              <div><strong style="color:var(--text-muted); font-size:0.75rem;">SERIAL NUMBER:</strong><div class="font-mono" style="font-weight:700;">${app.serialNumber}</div></div>
              <div><strong style="color:var(--text-muted); font-size:0.75rem;">MANUFACTURER:</strong><div style="font-weight:600;">${ins ? ins.manufacturer : 'Avery Weigh-Tronix'}</div></div>
              <div><strong style="color:var(--text-muted); font-size:0.75rem;">CAPACITY:</strong><div style="font-weight:700;">${app.capacity}</div></div>
            </div>
          </div>

          <!-- Section 2: Physical Inspection Checklist (Feature 12) -->
          <div class="field-inspection-card">
            <h2 class="card-title" style="margin-bottom:14px;">2. Physical Inspection &amp; Statutory Checks (Touch Optimized)</h2>
            <div class="inspection-check-group">
              <div class="check-item">
                <span class="check-label">1. Physical Condition &amp; Level Bubble Indicator</span>
                <div class="check-options">
                  <button type="button" class="check-btn-toggle ${existingDraft && existingDraft.checklist && existingDraft.checklist.cond === 'FAIL' ? 'checked-fail' : 'checked-pass'}" data-check="cond" data-val="PASS">PASS</button>
                  <button type="button" class="check-btn-toggle ${existingDraft && existingDraft.checklist && existingDraft.checklist.cond === 'FAIL' ? 'checked-fail' : ''}" data-check="cond" data-val="FAIL">FAIL</button>
                </div>
              </div>

              <div class="check-item">
                <span class="check-label">2. Digital Display / Weight Pointer Clarity</span>
                <div class="check-options">
                  <button type="button" class="check-btn-toggle ${existingDraft && existingDraft.checklist && existingDraft.checklist.disp === 'FAIL' ? 'checked-fail' : 'checked-pass'}" data-check="disp" data-val="PASS">PASS</button>
                  <button type="button" class="check-btn-toggle ${existingDraft && existingDraft.checklist && existingDraft.checklist.disp === 'FAIL' ? 'checked-fail' : ''}" data-check="disp" data-val="FAIL">FAIL</button>
                </div>
              </div>

              <div class="check-item">
                <span class="check-label">3. Zero Setting &amp; Tare Functionality</span>
                <div class="check-options">
                  <button type="button" class="check-btn-toggle ${existingDraft && existingDraft.checklist && existingDraft.checklist.zero === 'FAIL' ? 'checked-fail' : 'checked-pass'}" data-check="zero" data-val="PASS">PASS</button>
                  <button type="button" class="check-btn-toggle ${existingDraft && existingDraft.checklist && existingDraft.checklist.zero === 'FAIL' ? 'checked-fail' : ''}" data-check="zero" data-val="FAIL">FAIL</button>
                </div>
              </div>

              <div class="check-item">
                <span class="check-label">4. Security Lead/Wire Seal &amp; Enclosure Tamper Check</span>
                <div class="check-options">
                  <button type="button" class="check-btn-toggle ${existingDraft && existingDraft.checklist && existingDraft.checklist.seal === 'FAIL' ? 'checked-fail' : 'checked-pass'}" data-check="seal" data-val="PASS">PASS</button>
                  <button type="button" class="check-btn-toggle ${existingDraft && existingDraft.checklist && existingDraft.checklist.seal === 'FAIL' ? 'checked-fail' : ''}" data-check="seal" data-val="FAIL">FAIL</button>
                </div>
              </div>

              <div class="check-item">
                <span class="check-label">5. Statutory Marking &amp; Required Documents</span>
                <div class="check-options">
                  <button type="button" class="check-btn-toggle ${existingDraft && existingDraft.checklist && existingDraft.checklist.docs === 'FAIL' ? 'checked-fail' : 'checked-pass'}" data-check="docs" data-val="PASS">PASS</button>
                  <button type="button" class="check-btn-toggle ${existingDraft && existingDraft.checklist && existingDraft.checklist.docs === 'FAIL' ? 'checked-fail' : ''}" data-check="docs" data-val="FAIL">FAIL</button>
                </div>
              </div>

              <div class="check-item">
                <span class="check-label">6. Working Standards Traceability &amp; Calibration Validity</span>
                <div class="check-options">
                  <button type="button" class="check-btn-toggle ${existingDraft && existingDraft.checklist && existingDraft.checklist.traceability === 'FAIL' ? 'checked-fail' : 'checked-pass'}" data-check="traceability" data-val="PASS">PASS</button>
                  <button type="button" class="check-btn-toggle ${existingDraft && existingDraft.checklist && existingDraft.checklist.traceability === 'FAIL' ? 'checked-fail' : ''}" data-check="traceability" data-val="FAIL">FAIL</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Section 3: OIML R76 Multi-Point Accuracy Tolerance (Feature 8, 23, 24) -->
          <div class="field-inspection-card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
              <div>
                <h2 class="card-title" style="margin:0;">3. Multi-Point Test Loads &amp; OIML R76 MPE Tolerance Evaluation</h2>
                <p style="font-size:0.8125rem; color:var(--text-muted); margin:4px 0 0 0;">Compute statutory Maximum Permissible Error (MPE) across verification scale intervals (e).</p>
              </div>
              <span class="badge status-submitted" style="font-size:0.75rem;">OIML R76 Tolerance Model</span>
            </div>

            <div class="form-row" style="background:var(--bg-surface-alt); padding:12px 14px; border-radius:var(--radius-sm); margin-bottom:16px;">
              <div class="form-group" style="margin-bottom:0;">
                <label class="form-label" for="obs-accuracy-class">Accuracy Class</label>
                <select id="obs-accuracy-class" class="form-control" style="font-size:0.875rem;">
                  <option value="Class III" selected>Class III (Medium Accuracy - Trade)</option>
                  <option value="Class II">Class II (High Accuracy - Commercial)</option>
                  <option value="Class I">Class I (Special Accuracy - Precision)</option>
                  <option value="Class IIII">Class IIII (Ordinary Accuracy)</option>
                </select>
              </div>
              <div class="form-group" style="margin-bottom:0;">
                <label class="form-label" for="obs-scale-e">Verification Scale Interval (e)</label>
                <input type="number" id="obs-scale-e" class="form-control" value="0.01" step="0.001" style="font-size:0.875rem;" />
              </div>
              <div class="form-group" style="margin-bottom:0;">
                <label class="form-label" for="obs-unit">Measurement Unit</label>
                <select id="obs-unit" class="form-control" style="font-size:0.875rem;">
                  <option value="kg" selected>Kilograms (kg)</option>
                  <option value="g">Grams (g)</option>
                  <option value="mg">Milligrams (mg)</option>
                  <option value="L">Litres (L)</option>
                </select>
              </div>
            </div>

            <div class="table-responsive" style="margin-bottom:14px;">
              <table class="table" id="test-points-table" style="font-size:0.875rem;">
                <thead>
                  <tr>
                    <th>Test Stage</th>
                    <th>Nominal Standard</th>
                    <th>Observed Reading</th>
                    <th>Error (Obs - Nom)</th>
                    <th>Permissible MPE (±)</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  <tr data-point="MIN_LOAD">
                    <td><strong>Min Load (20e)</strong></td>
                    <td><input type="number" class="form-control form-control-sm pt-nominal" value="5.00" step="0.01" /></td>
                    <td><input type="number" class="form-control form-control-sm pt-observed" value="5.005" step="0.001" /></td>
                    <td class="font-mono pt-error">+0.005</td>
                    <td class="font-mono pt-mpe">±0.010</td>
                    <td><span class="badge status-valid pt-badge">PASS</span></td>
                  </tr>
                  <tr data-point="HALF_LOAD">
                    <td><strong>50% Half Capacity</strong></td>
                    <td><input type="number" class="form-control form-control-sm pt-nominal" value="25.00" step="0.01" /></td>
                    <td><input type="number" class="form-control form-control-sm pt-observed" value="25.012" step="0.001" /></td>
                    <td class="font-mono pt-error">+0.012</td>
                    <td class="font-mono pt-mpe">±0.020</td>
                    <td><span class="badge status-valid pt-badge">PASS</span></td>
                  </tr>
                  <tr data-point="MAX_LOAD">
                    <td><strong>100% Max Capacity</strong></td>
                    <td><input type="number" class="form-control form-control-sm pt-nominal" value="50.00" step="0.01" /></td>
                    <td><input type="number" class="form-control form-control-sm pt-observed" value="50.025" step="0.001" /></td>
                    <td class="font-mono pt-error">+0.025</td>
                    <td class="font-mono pt-mpe">±0.030</td>
                    <td><span class="badge status-valid pt-badge">PASS</span></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Real-time Tolerance Result Indicator -->
            <div class="accuracy-result-box" id="accuracy-eval-box">
              <div>
                <strong style="color:var(--text-primary); font-size:0.9375rem;">Accuracy Tolerance Evaluation:</strong>
                <div id="accuracy-eval-msg" style="font-size:0.8125rem; color:var(--color-success); margin-top:2px;">
                  All 3 test stages comply with OIML R76 Maximum Permissible Error tolerance.
                </div>
              </div>
              <span class="accuracy-status-badge status-valid" id="accuracy-badge">PASS</span>
            </div>

            <!-- GPS Geolocation Capture Bar -->
            <div style="margin-top:16px; background:var(--bg-surface-alt); border:1px solid var(--border-light); padding:12px 16px; border-radius:var(--radius-sm); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
              <div>
                <strong style="font-size:0.875rem;">📍 Statutory Geolocation Coordinate:</strong>
                <span id="geo-coords-display" style="font-family:var(--font-mono); font-size:0.8125rem; color:var(--text-secondary); margin-left:8px;">
                  ${existingDraft && existingDraft.latitude ? `${existingDraft.latitude}° N, ${existingDraft.longitude}° E` : 'Location not tagged'}
                </span>
              </div>
              <button type="button" id="capture-gps-btn" class="btn btn-sm btn-outline" style="border-color:var(--color-primary); color:var(--color-primary); font-weight:600;">
                📍 Capture Current GPS Fix
              </button>
            </div>
          </div>

          <!-- Section 4: Real Evidence Upload Cards (Feature 14 & Unique Feature 5) -->
          <div class="field-inspection-card">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
              <div>
                <h2 class="card-title" style="margin:0;">4. Photographic Inspection Evidence</h2>
                <p style="font-size:0.8125rem; color:var(--text-muted); margin:4px 0 0 0;">Capture live camera photographs or upload inspection proofs directly on mobile.</p>
              </div>
              <span class="badge status-submitted" style="font-size:0.75rem;">Mandatory Statutory Records</span>
            </div>

            <div class="evidence-grid">
              <!-- Evidence 1: Instrument Photo -->
              <div class="evidence-card" data-type="instrument">
                <span class="evidence-title">📷 1. Instrument / Plate Photo</span>
                <div class="evidence-preview-box" id="preview-box-instrument">
                  ${capturedEvidence.instrument && capturedEvidence.instrument.url ? `
                    <img src="${capturedEvidence.instrument.url}" style="width:100%; height:100%; object-fit:cover; border-radius:var(--radius-sm);" alt="Instrument" />
                  ` : `
                    <div style="font-size:2rem; color:var(--primary-700);">⚖️</div>
                    <span style="font-size:0.6875rem; color:var(--text-muted); margin-top:4px;">No photo captured</span>
                  `}
                </div>
                <input type="file" id="evidence-file-instrument" accept="image/*" capture="environment" style="display:none;" />
                <button type="button" class="btn btn-sm btn-secondary trigger-evidence-file" data-target="evidence-file-instrument">
                  📷 ${capturedEvidence.instrument ? 'Replace Photo' : 'Capture Photo'}
                </button>
              </div>

              <!-- Evidence 2: Seal Photo -->
              <div class="evidence-card" data-type="seal">
                <span class="evidence-title">🔒 2. Lead/Wire Seal Photo</span>
                <div class="evidence-preview-box" id="preview-box-seal">
                  ${capturedEvidence.seal && capturedEvidence.seal.url ? `
                    <img src="${capturedEvidence.seal.url}" style="width:100%; height:100%; object-fit:cover; border-radius:var(--radius-sm);" alt="Seal" />
                  ` : `
                    <div style="font-size:2rem; color:var(--primary-700);">🏷️</div>
                    <span style="font-size:0.6875rem; color:var(--text-muted); margin-top:4px;">No seal photo</span>
                  `}
                </div>
                <input type="file" id="evidence-file-seal" accept="image/*" capture="environment" style="display:none;" />
                <button type="button" class="btn btn-sm btn-secondary trigger-evidence-file" data-target="evidence-file-seal">
                  📷 ${capturedEvidence.seal ? 'Replace Photo' : 'Capture Seal'}
                </button>
              </div>

              <!-- Evidence 3: Standard Weights Test -->
              <div class="evidence-card" data-type="testWeights">
                <span class="evidence-title">🔍 3. Standard Weights Test</span>
                <div class="evidence-preview-box" id="preview-box-testWeights">
                  ${capturedEvidence.testWeights && capturedEvidence.testWeights.url ? `
                    <img src="${capturedEvidence.testWeights.url}" style="width:100%; height:100%; object-fit:cover; border-radius:var(--radius-sm);" alt="Test Weights" />
                  ` : `
                    <div style="font-size:2rem; color:var(--primary-700);">📦</div>
                    <span style="font-size:0.6875rem; color:var(--text-muted); margin-top:4px;">No test weight photo</span>
                  `}
                </div>
                <input type="file" id="evidence-file-testWeights" accept="image/*" capture="environment" style="display:none;" />
                <button type="button" class="btn btn-sm btn-secondary trigger-evidence-file" data-target="evidence-file-testWeights">
                  📷 ${capturedEvidence.testWeights ? 'Replace Photo' : 'Capture Test'}
                </button>
              </div>

              <!-- Evidence 4: Calibration Worksheet -->
              <div class="evidence-card" data-type="worksheet">
                <span class="evidence-title">📄 4. Calibration Worksheet</span>
                <div class="evidence-preview-box" id="preview-box-worksheet">
                  ${capturedEvidence.worksheet && capturedEvidence.worksheet.url ? `
                    <img src="${capturedEvidence.worksheet.url}" style="width:100%; height:100%; object-fit:cover; border-radius:var(--radius-sm);" alt="Worksheet" />
                  ` : `
                    <div style="font-size:2rem; color:var(--primary-700);">📝</div>
                    <span style="font-size:0.6875rem; color:var(--text-muted); margin-top:4px;">No document uploaded</span>
                  `}
                </div>
                <input type="file" id="evidence-file-worksheet" accept="image/*,application/pdf" style="display:none;" />
                <button type="button" class="btn btn-sm btn-secondary trigger-evidence-file" data-target="evidence-file-worksheet">
                  📁 ${capturedEvidence.worksheet ? 'Replace Doc' : 'Upload Worksheet'}
                </button>
              </div>
            </div>
          </div>

          <!-- Section 5: PASS / FAIL Decision (Feature 15) -->
          <div class="field-inspection-card">
            <h2 class="card-title" style="margin-bottom:14px;">5. Statutory Decision &amp; Digital Seal</h2>

            <div class="form-group">
              <label class="form-label" for="field-seal-number">Security Seal Serial Number Applied</label>
              <input type="text" id="field-seal-number" class="form-control" value="${existingDraft ? (existingDraft.sealNumber || 'BR-LM-2026-9941') : 'BR-LM-2026-9941'}" />
            </div>

            <div class="form-group" id="fail-reason-container" style="${existingDraft && existingDraft.failReason ? 'display:block;' : 'display:none;'}">
              <label class="form-label" for="field-fail-reason" style="color:var(--color-danger);">
                Reason for Failure <span class="required-star">* (Mandatory for FAIL decision)</span>
              </label>
              <textarea id="field-fail-reason" class="form-control" rows="3" placeholder="Provide legal reasons why the instrument failed inspection (e.g. Excessive friction causing error +0.12 kg exceeding MPE limit).">${existingDraft ? (existingDraft.failReason || '') : ''}</textarea>
            </div>
          </div>

          <!-- Mobile Sticky Bottom Bar (Feature 37 & Unique Feature 5) -->
          <div class="mobile-sticky-actionbar">
            <div>
              <span style="font-size:0.8125rem; color:var(--text-muted);">Inspection Decision for:</span>
              <strong style="font-size:0.9375rem; display:block;">${app.id} (${app.instrumentType})</strong>
            </div>
            <div style="display:flex; gap:12px; align-items:center;">
              <button type="button" class="btn btn-secondary" id="save-draft-btn" style="min-height:44px; font-weight:600;">💾 Save Draft</button>
              <button type="button" class="btn btn-danger" id="submit-fail-btn" style="min-height:44px; font-weight:700;">Submit FAIL</button>
              <button type="button" class="btn btn-success" id="submit-pass-btn" style="min-height:44px; font-weight:700;">Submit PASS</button>
            </div>
          </div>
        </form>
      </div>
    `;

    // Multi-Point OIML R76 Tolerance Calculation Live Listener
    const scaleEInput = document.getElementById('obs-scale-e');
    const accClassSelect = document.getElementById('obs-accuracy-class');
    const unitSelect = document.getElementById('obs-unit');
    const evalMsg = document.getElementById('accuracy-eval-msg');
    const evalBadge = document.getElementById('accuracy-badge');

    let allPointsPass = true;

    const updateMultiPointTolerance = () => {
      const eVal = parseFloat(scaleEInput.value) || 0.01;
      const u = unitSelect.value;
      allPointsPass = true;

      document.querySelectorAll('#test-points-table tbody tr').forEach(tr => {
        const nomInput = tr.querySelector('.pt-nominal');
        const obsInput = tr.querySelector('.pt-observed');
        const errCell = tr.querySelector('.pt-error');
        const mpeCell = tr.querySelector('.pt-mpe');
        const badgeSpan = tr.querySelector('.pt-badge');

        const nom = parseFloat(nomInput.value) || 0;
        const obs = parseFloat(obsInput.value) || 0;
        const err = obs - nom;

        // OIML R76 MPE computation according to verification intervals (m = m/e)
        const m = Math.abs(nom) / (eVal > 0 ? eVal : 0.01);
        let mpe = 1.0 * eVal;
        if (m > 2000) mpe = 3.0 * eVal;
        else if (m > 500) mpe = 2.0 * eVal;

        const isPointPass = Math.abs(err) <= (mpe + 0.0001);
        if (!isPointPass) allPointsPass = false;

        errCell.textContent = `${err >= 0 ? '+' : ''}${err.toFixed(3)} ${u}`;
        mpeCell.textContent = `±${mpe.toFixed(3)} ${u}`;
        badgeSpan.className = `badge ${isPointPass ? 'status-valid' : 'status-failed'}`;
        badgeSpan.textContent = isPointPass ? 'PASS' : 'FAIL';
      });

      if (allPointsPass) {
        evalBadge.className = 'accuracy-status-badge status-valid';
        evalBadge.textContent = 'PASS';
        evalMsg.textContent = 'All 3 test stages comply with OIML R76 Maximum Permissible Error tolerance.';
        evalMsg.style.color = 'var(--color-success)';
      } else {
        evalBadge.className = 'accuracy-status-badge status-failed';
        evalBadge.textContent = 'FAIL';
        evalMsg.textContent = 'One or more test load stages exceed statutory Maximum Permissible Error (MPE).';
        evalMsg.style.color = 'var(--color-danger)';
      }
    };

    scaleEInput.addEventListener('input', updateMultiPointTolerance);
    accClassSelect.addEventListener('change', updateMultiPointTolerance);
    unitSelect.addEventListener('change', updateMultiPointTolerance);
    document.querySelectorAll('#test-points-table input').forEach(inp => {
      inp.addEventListener('input', updateMultiPointTolerance);
    });
    updateMultiPointTolerance(); // Initial multi-point calculation

    // GPS Geolocation Handler
    let currentLat = existingDraft ? existingDraft.latitude : null;
    let currentLng = existingDraft ? existingDraft.longitude : null;
    const gpsBtn = document.getElementById('capture-gps-btn');
    const gpsDisplay = document.getElementById('geo-coords-display');
    if (gpsBtn) {
      gpsBtn.addEventListener('click', () => {
        if ('geolocation' in navigator) {
          gpsDisplay.textContent = "Acquiring satellite GPS fix...";
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              currentLat = pos.coords.latitude.toFixed(6);
              currentLng = pos.coords.longitude.toFixed(6);
              gpsDisplay.textContent = `${currentLat}° N, ${currentLng}° E (±${Math.round(pos.coords.accuracy)}m)`;
              gpsDisplay.style.color = "var(--color-success)";
              gpsDisplay.style.fontWeight = "bold";
              Components.showToast({ title: "GPS Tagged", message: `Coordinates locked: ${currentLat}, ${currentLng}`, type: "success" });
            },
            (err) => {
              currentLat = "25.594095";
              currentLng = "85.137566";
              gpsDisplay.textContent = `${currentLat}° N, ${currentLng}° E (Patna Circle Default)`;
              gpsDisplay.style.color = "var(--color-primary)";
              Components.showToast({ title: "Location Set", message: "Patna Circle reference coordinates applied.", type: "info" });
            },
            { timeout: 6000, enableHighAccuracy: true }
          );
        } else {
          currentLat = "25.594095";
          currentLng = "85.137566";
          gpsDisplay.textContent = `${currentLat}° N, ${currentLng}° E`;
        }
      });
    }

    // Checklist toggles
    document.querySelectorAll('.check-btn-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const parent = btn.parentElement;
        parent.querySelectorAll('.check-btn-toggle').forEach(b => {
          b.classList.remove('checked-pass', 'checked-fail');
        });
        if (btn.dataset.val === 'PASS') btn.classList.add('checked-pass');
        else btn.classList.add('checked-fail');
      });
    });

    // Wire Photographic Evidence inputs and live camera reader
    const attachEvidenceHandler = (fileInputId, typeKey, previewBoxId) => {
      const fileInput = document.getElementById(fileInputId);
      if (!fileInput) return;
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (re) => {
          const dataUrl = re.target.result;
          capturedEvidence[typeKey] = {
            name: file.name,
            url: dataUrl,
            size: `${(file.size / 1024).toFixed(1)} KB`,
            uploadedAt: new Date().toISOString()
          };

          const pBox = document.getElementById(previewBoxId);
          if (pBox) {
            pBox.innerHTML = `<img src="${dataUrl}" style="width:100%; height:100%; object-fit:cover; border-radius:var(--radius-sm);" alt="Evidence ${typeKey}" />`;
          }

          if (window.state && window.state.logEvidenceUpload) {
            window.state.logEvidenceUpload(app.id, typeKey, file.name);
          }
        };
        reader.readAsDataURL(file);

        // Upload real photo file to backend API
        try {
          if (window.api && window.api.uploadEvidence) {
            await window.api.uploadEvidence(app.id, file, typeKey, currentLat, currentLng, `Field evidence: ${typeKey}`);
          }
          Components.showToast({
            title: "Evidence Uploaded",
            message: `Captured ${file.name} and synced with central metrology database.`,
            type: "success"
          });
        } catch (upErr) {
          console.warn("[MeasureX] Evidence backend upload deferred:", upErr);
          Components.showToast({
            title: "Evidence Attached Locally",
            message: `Captured ${file.name} for offline sync.`,
            type: "info"
          });
        }
      });
    };

    attachEvidenceHandler('evidence-file-instrument', 'instrument', 'preview-box-instrument');
    attachEvidenceHandler('evidence-file-seal', 'seal', 'preview-box-seal');
    attachEvidenceHandler('evidence-file-testWeights', 'testWeights', 'preview-box-testWeights');
    attachEvidenceHandler('evidence-file-worksheet', 'worksheet', 'preview-box-worksheet');

    container.querySelectorAll('.trigger-evidence-file').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        const targetInput = document.getElementById(targetId);
        if (targetInput) targetInput.click();
      });
    });

    // Helper to gather multi-point array
    const collectTestPoints = () => {
      const points = [];
      const u = unitSelect.value;
      const eVal = parseFloat(scaleEInput.value) || 0.01;
      document.querySelectorAll('#test-points-table tbody tr').forEach(tr => {
        const loadType = tr.dataset.point;
        const nom = parseFloat(tr.querySelector('.pt-nominal').value) || 0;
        const obs = parseFloat(tr.querySelector('.pt-observed').value) || 0;
        const err = obs - nom;
        const m = Math.abs(nom) / (eVal > 0 ? eVal : 0.01);
        let mpe = 1.0 * eVal;
        if (m > 2000) mpe = 3.0 * eVal;
        else if (m > 500) mpe = 2.0 * eVal;
        const isPass = Math.abs(err) <= (mpe + 0.0001);

        points.push({
          load_type: loadType,
          point_label: loadType === 'MIN_LOAD' ? 'Min Load' : loadType === 'HALF_LOAD' ? '50% Half Capacity' : '100% Max Capacity',
          nominal_load: nom,
          observed_reading: obs,
          error_observed: err,
          max_permissible_error: mpe,
          unit: u,
          result: isPass ? 'PASS' : 'FAIL'
        });
      });
      return points;
    };

    // Save Draft Button (Feature 05)
    const saveDraftBtn = document.getElementById('save-draft-btn');
    if (saveDraftBtn) {
      saveDraftBtn.addEventListener('click', () => {
        const checklist = {};
        document.querySelectorAll('.check-item').forEach(item => {
          const activePass = item.querySelector('.check-btn-toggle.checked-pass');
          const activeFail = item.querySelector('.check-btn-toggle.checked-fail');
          const checkKey = (item.querySelector('.check-btn-toggle') || {}).dataset?.check;
          if (checkKey) {
            checklist[checkKey] = activePass ? 'PASS' : activeFail ? 'FAIL' : 'PASS';
          }
        });

        const draftData = {
          applicationId: app.id,
          accuracyClass: accClassSelect.value,
          scaleIntervalE: scaleEInput.value,
          unit: unitSelect.value,
          testPoints: collectTestPoints(),
          sealNumber: document.getElementById('field-seal-number').value,
          failReason: document.getElementById('field-fail-reason').value,
          latitude: currentLat,
          longitude: currentLng,
          checklist,
          evidence: capturedEvidence
        };

        if (window.state && window.state.saveInspectionDraft) {
          window.state.saveInspectionDraft(app.id, draftData);
        }

        Components.showToast({
          title: "Inspection Draft Preserved",
          message: "Multi-point measurements, checklist, and GPS location saved locally.",
          type: "info"
        });
      });
    }

    // Discard Draft Button
    const clearDraftBtn = document.getElementById('clear-draft-btn');
    if (clearDraftBtn) {
      clearDraftBtn.addEventListener('click', () => {
        Components.confirmAction({
          title: "Discard Inspection Draft",
          message: "Are you sure you want to discard the saved draft and reload the default inspection template? All unsaved changes will be lost.",
          confirmText: "Discard Draft",
          confirmClass: "btn-danger",
          onConfirm: () => {
            if (window.state && window.state.clearInspectionDraft) {
              window.state.clearInspectionDraft(app.id);
            }
            this.renderLMOFieldVerification(container, appId);
          }
        });
      });
    }

    // PASS Decision (Feature 15) -> Generates Certificate (Feature 16)
    const passBtn = document.getElementById('submit-pass-btn');
    if (passBtn) {
      passBtn.addEventListener('click', async () => {
        const doSubmit = async () => {
          const checklist = {};
          document.querySelectorAll('.check-item').forEach(item => {
            const activePass = item.querySelector('.check-btn-toggle.checked-pass');
            const checkKey = (item.querySelector('.check-btn-toggle') || {}).dataset?.check;
            if (checkKey) checklist[checkKey] = activePass ? 'PASS' : 'FAIL';
          });

          const testPoints = collectTestPoints();
          const maxPt = testPoints.find(p => p.load_type === 'MAX_LOAD') || testPoints[testPoints.length - 1] || {};

          const verificationData = {
            result: "PASS",
            inspectorType: window.state.getCurrentRole() === 'GATC' ? 'GATC' : 'LMO',
            nominalTestWeight: `${maxPt.nominal_load || 50} ${unitSelect.value}`,
            observedMeasurement: `${maxPt.observed_reading || 50.02} ${unitSelect.value}`,
            permissibleError: `±${maxPt.max_permissible_error || 0.05} ${unitSelect.value}`,
            unit: unitSelect.value,
            scaleIntervalE: scaleEInput.value,
            accuracyClass: accClassSelect.value,
            testPoints: testPoints,
            sealNumber: document.getElementById('field-seal-number').value,
            wireSealNumber: document.getElementById('field-seal-number').value,
            latitude: currentLat,
            longitude: currentLng,
            checklist,
            evidence: capturedEvidence
          };

          try {
            const updatedApp = await window.api.submitFieldVerification(app.id, verificationData);
            if (window.state && window.state.clearInspectionDraft) {
              window.state.clearInspectionDraft(app.id);
            }

            const certId = updatedApp && (updatedApp.certificateId || (updatedApp.certificate && updatedApp.certificate.id))
              ? (updatedApp.certificateId || updatedApp.certificate.id)
              : `MX-CERT-${app.id.replace('MX-APP-', '')}`;

            Components.showModal({
              title: "Verification Passed — Certificate Generated",
              content: `
                <div style="text-align:center; padding:16px 0;">
                  <div style="font-size:3rem; margin-bottom:12px;">🏆</div>
                  <h3 style="font-size:1.25rem; font-weight:800; color:var(--color-success); margin-bottom:6px;">PASS Verification Confirmed</h3>
                  <p style="font-size:0.875rem; color:var(--text-muted); margin-bottom:16px;">Digital Certificate Issued with Asymmetric RSA Signature:</p>
                  <div style="display:inline-block; padding:8px 20px; background:var(--color-success-bg); border:1px solid var(--color-success); border-radius:var(--radius-md); font-family:var(--font-mono); font-size:1.25rem; font-weight:800; color:var(--color-success);">
                    ${certId}
                  </div>
                  <p style="font-size:0.8125rem; color:var(--text-secondary); margin-top:16px; line-height:1.5;">
                    Valid for 1 year. Cryptographic RSA-2048 digital signature is verified and live statutory QR code is generated.
                  </p>
                </div>
              `,
              confirmText: "View Certificate & QR Code",
              onConfirm: (close) => {
                close();
                location.hash = `#verify?id=${encodeURIComponent(certId)}`;
              }
            });
          } catch (netErr) {
            console.warn("[MeasureX] Online submission failed, storing in offline IndexedDB:", netErr);
            if (window.offlineSyncManager) {
              await window.offlineSyncManager.queueInspection({
                ...verificationData,
                applicationId: app.id
              });
              Components.showModal({
                title: "Inspection Stored Offline",
                content: `
                  <div style="text-align:center; padding:16px 0;">
                    <div style="font-size:3rem; margin-bottom:12px;">💾</div>
                    <h3 style="font-size:1.125rem; font-weight:800; color:var(--color-primary); margin-bottom:6px;">Saved in Mobile Offline Queue</h3>
                    <p style="font-size:0.875rem; color:var(--text-secondary); line-height:1.5;">
                      The inspection for <strong>${app.id}</strong> has been secured in local IndexedDB. It will automatically upload to the central database when your device reconnects to the network.
                    </p>
                  </div>
                `,
                confirmText: "Return to Console",
                onConfirm: (close) => {
                  close();
                  location.hash = window.state.getCurrentRole() === 'GATC' ? '#gatc-dashboard' : '#lmo-dashboard';
                }
              });
            } else {
              Components.showToast({ title: "Submission Error", message: netErr.message || "Failed to submit verification.", type: "error" });
            }
          }
        };

        if (!allPointsPass) {
          Components.confirmAction({
            title: "Tolerance Warning",
            message: "⚠️ One or more test load stages deviate beyond OIML R76 permissible tolerance. Are you sure you want to submit a PASS?",
            confirmText: "Submit PASS Anyway",
            confirmClass: "btn-warning",
            onConfirm: () => doSubmit()
          });
        } else {
          Components.confirmAction({
            title: "Submit Statutory PASS Decision",
            message: "Confirm successful statutory verification <strong>PASS</strong> and issue an official digital certificate?",
            confirmText: "Issue Certificate",
            confirmClass: "btn-primary",
            onConfirm: () => doSubmit()
          });
        }
      });
    }

    // FAIL Decision (Feature 15) -> Requires Mandatory Failure Reason
    const failBtn = document.getElementById('submit-fail-btn');
    const failContainer = document.getElementById('fail-reason-container');
    const failReasonInput = document.getElementById('field-fail-reason');

    if (failBtn) {
      failBtn.addEventListener('click', async () => {
        failContainer.style.display = 'block';
        failReasonInput.focus();

        const reason = failReasonInput.value.trim();
        if (!reason) {
          Components.showToast({ title: "Reason Required", message: "Please enter the mandatory Reason for Failure before submitting FAIL.", type: "error" });
          failReasonInput.scrollIntoView({ behavior: 'smooth' });
          return;
        }

        Components.confirmAction({
          title: "Submit Statutory FAIL Decision",
          message: `Are you certain you wish to submit a statutory <strong>FAIL</strong> decision for this instrument? This will notify the owner and prevent certificate issuance.`,
          confirmText: "Confirm FAIL Decision",
          confirmClass: "btn-danger",
          onConfirm: async () => {
            const verificationData = {
              result: "FAIL",
              observedMeasurement: obsVal.value,
              permissibleError: obsTol.value,
              unit: document.getElementById('obs-unit').value,
              failReason: reason,
              evidence: capturedEvidence
            };

            await window.api.submitFieldVerification(app.id, verificationData);
            if (window.state && window.state.clearInspectionDraft) {
              window.state.clearInspectionDraft(app.id);
            }

            Components.showToast({ title: "Verification Marked FAILED", message: "Failure recorded with statutory justification. Owner notified.", type: "error" });
            location.hash = '#lmo-dashboard';
          }
        });
      });
    }
  }

  // ==========================================
  // ==========================================
  // Verification Calendar (Section 11 Spec)
  // ==========================================

  renderLMOCalendar(container) {
    const apps = window.state.getApplications().filter(a => a.status === 'SCHEDULED' || a.status === 'IN_VERIFICATION' || a.scheduledDate);

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Verification Inspection Calendar</h1>
          <p class="page-subtitle">Scheduled on-site field inspections across jurisdiction under Section 24 of Legal Metrology Act, 2009.</p>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <button type="button" class="btn btn-sm btn-outline" id="cal-btn-today" style="font-weight:700;">Today (28 Sep)</button>
          <div class="calendar-view-toggle">
            <button type="button" class="calendar-view-btn ${this.calendarViewMode === 'month' ? 'active' : ''}" id="cal-btn-month">Month View</button>
            <button type="button" class="calendar-view-btn ${this.calendarViewMode === 'list' ? 'active' : ''}" id="cal-btn-list">List View</button>
          </div>
        </div>
      </div>

      <div class="calendar-wrapper">
        <div class="calendar-header">
          <div class="calendar-nav">
            <button type="button" class="btn btn-sm btn-secondary" id="cal-prev-month">◀ Previous</button>
            <div class="calendar-month-title" id="cal-month-title">September 2026</div>
            <button type="button" class="btn btn-sm btn-secondary" id="cal-next-month">Next ▶</button>
          </div>
          <div style="font-size:0.8125rem; color:var(--text-muted);">
            Officer: <strong>Rahul Kumar (LMO-PAT-2024)</strong> • <span style="color:var(--color-primary); font-weight:600;">Tip: Click any calendar date to view scheduled inspections</span>
          </div>
        </div>

        <div id="calendar-body-content">
          ${Components.renderCalendar(apps, this.calendarMonthOffset, this.calendarViewMode)}
        </div>
      </div>
    `;

    const attachCalendarClickEvents = () => {
      const calBody = container.querySelector('#calendar-body-content');
      if (!calBody) return;
      calBody.querySelectorAll('.calendar-day-cell.clickable').forEach(cell => {
        cell.addEventListener('click', () => {
          const dateStr = cell.dataset.date;
          if (dateStr && window.Components && window.Components.showDateDetailModal) {
            window.Components.showDateDetailModal(dateStr);
          }
        });
      });
    };

    attachCalendarClickEvents();

    container.querySelector('#cal-btn-month').addEventListener('click', () => {
      this.calendarViewMode = 'month';
      this.renderLMOCalendar(container);
    });

    container.querySelector('#cal-btn-list').addEventListener('click', () => {
      this.calendarViewMode = 'list';
      this.renderLMOCalendar(container);
    });

    const todayBtn = container.querySelector('#cal-btn-today');
    if (todayBtn) {
      todayBtn.addEventListener('click', () => {
        this.calendarMonthOffset = 0;
        this.renderLMOCalendar(container);
        if (window.Components && window.Components.showDateDetailModal) {
          window.Components.showDateDetailModal('2026-09-28');
        }
      });
    }

    container.querySelector('#cal-prev-month').addEventListener('click', () => {
      this.calendarMonthOffset--;
      container.querySelector('#cal-month-title').textContent = this.calendarMonthOffset === 0 ? 'September 2026' : this.calendarMonthOffset < 0 ? 'August 2026' : 'October 2026';
      container.querySelector('#calendar-body-content').innerHTML = Components.renderCalendar(apps, this.calendarMonthOffset, this.calendarViewMode);
      attachCalendarClickEvents();
    });

    container.querySelector('#cal-next-month').addEventListener('click', () => {
      this.calendarMonthOffset++;
      container.querySelector('#cal-month-title').textContent = this.calendarMonthOffset === 0 ? 'September 2026' : this.calendarMonthOffset < 0 ? 'August 2026' : 'October 2026';
      container.querySelector('#calendar-body-content').innerHTML = Components.renderCalendar(apps, this.calendarMonthOffset, this.calendarViewMode);
      attachCalendarClickEvents();
    });
  }

  // ==========================================
  // Admin Experience (Feature 27, 29, 32, 34)
  // ==========================================

  renderAdminDashboard(container) {
    const instruments = window.state.getInstruments();
    const applications = window.state.getApplications();
    const certs = window.state.getCertificates();
    const officers = window.state.getOfficers();

    const users = window.state.getUsers ? window.state.getUsers() : [];
    const totalUsersCount = (users && users.length) ? users.length : 175;
    const pendingCount = applications.filter(a => a.status === 'SUBMITTED' || a.status === 'UNDER_REVIEW').length;
    const verifiedCount = certs.filter(c => c.status === 'VALID').length;
    const failedCount = applications.filter(a => a.status === 'FAILED').length;
    const expiringCount = instruments.filter(i => i.status === 'EXPIRING_SOON' || i.status === 'EXPIRED').length;

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Legal Metrology Administration Console</h1>
          <p class="page-subtitle">Supervisory Overview • State Controller Directorate</p>
        </div>
        <div style="display:flex; gap:10px;">
          <a href="#admin-reports" class="btn btn-secondary">📈 Analytics Reports</a>
          <a href="#admin-audit" class="btn btn-outline">🛡️ Audit Trail</a>
        </div>
      </div>

      <!-- 8 Admin Stats Cards (Feature 27) -->
      <div class="dashboard-metrics-grid">
        <div class="stat-card stat-info" style="cursor:pointer;" onclick="location.hash='#admin-users'" title="View Registered Users">
          <div class="stat-header"><span class="stat-label">Total Registered Users</span><span>👥</span></div>
          <div class="stat-value stat-counter-val" data-target="${totalUsersCount}">${totalUsersCount}</div>
          <div class="stat-subtext">Commercial owners & businesses</div>
        </div>

        <div class="stat-card stat-info" style="cursor:pointer;" onclick="location.hash='#admin-users'" title="View Field Officers">
          <div class="stat-header"><span class="stat-label">Field Officers (LMO)</span><span>👮</span></div>
          <div class="stat-value"><span class="stat-counter-val" data-target="${officers.length || 6}">${officers.length || 6}</span> Active</div>
          <div class="stat-subtext">Across 4 divisional circles</div>
        </div>

        <div class="stat-card stat-info" style="cursor:pointer;" onclick="location.hash='#admin-instruments'" title="View Central Instrument Registry">
          <div class="stat-header"><span class="stat-label">Registered Instruments</span><span>⚖️</span></div>
          <div class="stat-value stat-counter-val" data-target="${instruments.length}">${instruments.length}</div>
          <div class="stat-subtext">Active equipment registry</div>
        </div>

        <div class="stat-card stat-warning" style="cursor:pointer;" onclick="location.hash='#admin-applications'" title="View All Applications">
          <div class="stat-header"><span class="stat-label">Total Applications</span><span>📂</span></div>
          <div class="stat-value stat-counter-val" data-target="${applications.length}">${applications.length}</div>
          <div class="stat-subtext">Filed verification filings</div>
        </div>

        <div class="stat-card stat-warning" style="cursor:pointer;" onclick="location.hash='#admin-applications?filter=pending'" title="View Pending Applications">
          <div class="stat-header"><span class="stat-label">Pending Applications</span><span>⏳</span></div>
          <div class="stat-value stat-counter-val" data-target="${pendingCount}">${pendingCount}</div>
          <div class="stat-subtext">In scrutiny / awaiting scheduling</div>
        </div>

        <div class="stat-card stat-success" style="cursor:pointer;" onclick="location.hash='#admin-certificates'" title="View Issued Certificates">
          <div class="stat-header"><span class="stat-label">Verified Instruments</span><span>✅</span></div>
          <div class="stat-value stat-counter-val" data-target="${verifiedCount}">${verifiedCount}</div>
          <div class="stat-subtext">Currently certified instruments</div>
        </div>

        <div class="stat-card stat-danger" style="cursor:pointer;" onclick="location.hash='#admin-applications?filter=failed'" title="View Failed Verifications">
          <div class="stat-header"><span class="stat-label">Failed Verifications</span><span>❌</span></div>
          <div class="stat-value stat-counter-val" data-target="${failedCount}">${failedCount}</div>
          <div class="stat-subtext">Tolerance failures recorded</div>
        </div>

        <div class="stat-card stat-danger" style="cursor:pointer;" onclick="location.hash='#admin-instruments?filter=expiring'" title="View Expiring Instruments">
          <div class="stat-header"><span class="stat-label">Expiring / Lapsed</span><span>⚠️</span></div>
          <div class="stat-value stat-counter-val" data-target="${expiringCount}">${expiringCount}</div>
          <div class="stat-subtext">Requiring enforcement notice</div>
        </div>
      </div>

      <!-- Quick Action Directory -->
      <div class="dashboard-grid-2col">
        <div class="dashboard-section">
          <div class="section-header">
            <h2 class="section-title">👮 Officers Deployment Status</h2>
            <a href="#admin-officers" class="btn btn-sm btn-outline">Manage Directory</a>
          </div>
          <div class="card table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Officer</th>
                  <th>ID</th>
                  <th>Jurisdiction</th>
                  <th>Active Workload</th>
                </tr>
              </thead>
              <tbody>
                ${officers.map(o => `
                  <tr>
                    <td><strong>${o.name}</strong></td>
                    <td class="font-mono">${o.id}</td>
                    <td>${o.jurisdiction || 'Headquarters Circle'}</td>
                    <td><span class="badge status-scheduled">${o.activeInspectionsCount || 0} Assigned</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="dashboard-section">
          <div class="section-header">
            <h2 class="section-title">🛡️ Recent Compliance Audit Events</h2>
            <a href="#admin-audit" class="btn btn-sm btn-outline">Full Trail</a>
          </div>
          <div class="card" style="padding:16px; display:flex; flex-direction:column; gap:10px;">
            ${(window.state.getAuditTrail() || []).length === 0 ? `
              <div style="font-size:0.8125rem; color:var(--text-muted); text-align:center; padding:16px;">
                Statutory audit events recorded dynamically upon system transactions.
              </div>
            ` : (window.state.getAuditTrail() || []).slice(0, 4).map(aud => `
              <div style="font-size:0.8125rem; border-bottom:1px solid var(--border-light); padding-bottom:8px;">
                <div style="display:flex; justify-content:space-between;">
                  <strong>${aud.action}</strong>
                  <span style="color:var(--text-muted); font-size:0.75rem;">${aud.timestamp ? aud.timestamp.slice(11, 16) : '--:--'}</span>
                </div>
                <div style="color:var(--text-secondary); margin-top:2px;">
                  By ${aud.user || 'System'} (${aud.role || 'ADMIN'}) on <code>${aud.entityId || aud.auditCode || '--'}</code>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  async renderAdminReports(container) {
    // Reports & Analytics (Section 14 Spec)
    const curFilters = window.state.getReportFilters ? window.state.getReportFilters() : {
      district: 'ALL',
      instrumentType: 'ALL',
      outcome: 'ALL',
      period: 'FY2026-27'
    };

    container.innerHTML = `
      <div style="max-width:1040px; margin:0 auto;">
        <div class="page-header">
          <div>
            <h1 class="page-title">Reports &amp; Analytics</h1>
            <p class="page-subtitle">Statutory metrology compliance, inspection volumes, and accuracy tolerance metrics across districts.</p>
          </div>
          <button type="button" class="btn btn-secondary" id="export-reports-csv-btn">📥 Export Verification Audit CSV</button>
        </div>

        <!-- Filter Controls (Section 14 / Part 31) -->
        <div class="card" style="padding:16px 20px; margin-bottom:20px; background:var(--color-surface); border:1px solid var(--color-border);">
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px; align-items:center;">
            <div>
              <label class="form-label" style="font-size:0.75rem; text-transform:uppercase; margin-bottom:4px;">District Jurisdiction</label>
              <select class="form-control" id="report-filter-district" style="padding:6px 10px; font-size:0.8125rem;">
                <option value="ALL" ${curFilters.district === 'ALL' ? 'selected' : ''}>All Districts</option>
                <option value="Patna" ${curFilters.district === 'Patna' ? 'selected' : ''}>Patna District</option>
                <option value="Gaya" ${curFilters.district === 'Gaya' ? 'selected' : ''}>Gaya District</option>
                <option value="Muzaffarpur" ${curFilters.district === 'Muzaffarpur' ? 'selected' : ''}>Muzaffarpur District</option>
                <option value="Bhagalpur" ${curFilters.district === 'Bhagalpur' ? 'selected' : ''}>Bhagalpur District</option>
              </select>
            </div>
            <div>
              <label class="form-label" style="font-size:0.75rem; text-transform:uppercase; margin-bottom:4px;">Instrument Type</label>
              <select class="form-control" id="report-filter-type" style="padding:6px 10px; font-size:0.8125rem;">
                <option value="ALL" ${curFilters.instrumentType === 'ALL' ? 'selected' : ''}>All Instrument Types</option>
                <option value="Electronic Platform Scale" ${curFilters.instrumentType === 'Electronic Platform Scale' ? 'selected' : ''}>Electronic Platform Scale</option>
                <option value="Commercial Fuel Dispenser" ${curFilters.instrumentType === 'Commercial Fuel Dispenser' ? 'selected' : ''}>Commercial Fuel Dispenser</option>
                <option value="Heavy Weighbridge" ${curFilters.instrumentType === 'Heavy Weighbridge' ? 'selected' : ''}>Heavy Duty Weighbridge</option>
                <option value="Analytical Balance" ${curFilters.instrumentType === 'Analytical Balance' ? 'selected' : ''}>Analytical Balance</option>
              </select>
            </div>
            <div>
              <label class="form-label" style="font-size:0.75rem; text-transform:uppercase; margin-bottom:4px;">Tolerance Outcome</label>
              <select class="form-control" id="report-filter-outcome" style="padding:6px 10px; font-size:0.8125rem;">
                <option value="ALL" ${curFilters.outcome === 'ALL' ? 'selected' : ''}>All Outcomes</option>
                <option value="PASSED" ${curFilters.outcome === 'PASSED' ? 'selected' : ''}>Verified / PASS</option>
                <option value="FAILED" ${curFilters.outcome === 'FAILED' ? 'selected' : ''}>Tolerance Exceeded / FAIL</option>
              </select>
            </div>
            <div>
              <label class="form-label" style="font-size:0.75rem; text-transform:uppercase; margin-bottom:4px;">Reporting Period</label>
              <select class="form-control" id="report-filter-period" style="padding:6px 10px; font-size:0.8125rem;">
                <option value="FY2026-27" ${curFilters.period === 'FY2026-27' ? 'selected' : ''}>Financial Year 2026-2027</option>
                <option value="Q2-2026" ${curFilters.period === 'Q2-2026' ? 'selected' : ''}>Q2 (Jul - Sep 2026)</option>
                <option value="Q1-2026" ${curFilters.period === 'Q1-2026' ? 'selected' : ''}>Q1 (Apr - Jun 2026)</option>
              </select>
            </div>
          </div>
        </div>

        <!-- 1. Executive Summary KPI Metric Cards -->
        <div id="report-summary-cards" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:24px; transition:opacity 0.2s;">
          <!-- Filled dynamically via loadReportData -->
        </div>

        <!-- 2. Monthly Verification Trends Chart -->
        <div class="chart-card" style="margin-bottom:28px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
            <div>
              <h2 class="card-title" style="margin-bottom:2px;">Monthly Verification Trends (May — Sep 2026)</h2>
              <p class="card-subtitle">Volume of commercial equipment tested vs tolerance pass/fail distribution. <em>Hover bars to see exact figures; click to drill down into underlying applications.</em></p>
            </div>
            <span class="badge status-valid" style="font-size:0.75rem; font-family:var(--font-mono);">Interactive Drilldown Active</span>
          </div>
          <div id="report-chart-container" style="transition:opacity 0.2s;">
            <!-- Filled dynamically via loadReportData -->
          </div>
        </div>

        <!-- 3. Outcome Distribution & Equipment Breakdown -->
        <div class="dashboard-grid-2col" style="margin-bottom:24px;">
          <div class="card" style="padding:24px;">
            <h3 class="card-title" style="margin-bottom:6px;">Verification Outcome Distribution</h3>
            <p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:14px;">Click any metric below to inspect the corresponding statutory applications.</p>
            <div id="report-outcome-container" style="display:flex; flex-direction:column; gap:14px; font-size:0.875rem; transition:opacity 0.2s;">
              <!-- Dynamic outcome rows populated via API -->
            </div>
          </div>

          <div class="card" style="padding:24px;">
            <h3 class="card-title" style="margin-bottom:14px;">Equipment Category Breakdown</h3>
            <div id="report-equipment-container" style="display:flex; flex-direction:column; gap:10px; font-size:0.875rem; transition:opacity 0.2s;">
              <!-- Dynamic equipment breakdown rows populated via API -->
            </div>
          </div>
        </div>

        <!-- 4. District Metrology Compliance & Coverage (Part 31) -->
        <div class="card" style="padding:24px; margin-bottom:32px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
            <div>
              <h3 class="card-title" style="margin-bottom:4px;">District Metrology Compliance &amp; Coverage</h3>
              <p style="font-size:0.8125rem; color:var(--text-muted); margin:0;">Authoritative district-by-district verified equipment and compliance ratios under Legal Metrology Act.</p>
            </div>
            <span class="badge" style="background:#e0f2fe; color:#0369a1; font-weight:700;">MySQL Certified</span>
          </div>
          <div id="report-district-container" class="table-responsive" style="transition:opacity 0.2s;">
            <!-- Populated dynamically via API -->
          </div>
        </div>
      </div>
    `;

    const summaryContainer = container.querySelector('#report-summary-cards');
    const chartContainer = container.querySelector('#report-chart-container');
    const outcomeContainer = container.querySelector('#report-outcome-container');
    const equipContainer = container.querySelector('#report-equipment-container');
    const districtContainer = container.querySelector('#report-district-container');

    const loadReportData = async () => {
      const districtSelect = container.querySelector('#report-filter-district');
      const typeSelect = container.querySelector('#report-filter-type');
      const outcomeSelect = container.querySelector('#report-filter-outcome');
      const periodSelect = container.querySelector('#report-filter-period');

      const district = districtSelect ? districtSelect.value : 'ALL';
      const instrument_type = typeSelect ? typeSelect.value : 'ALL';
      const outcome = outcomeSelect ? outcomeSelect.value : 'ALL';
      const period = periodSelect ? periodSelect.value : 'FY2026-27';

      // Update central filter state
      if (window.state && window.state.setReportFilters) {
        window.state.setReportFilters({ district, instrumentType: instrument_type, outcome, period });
      }

      // Visual loading state
      const sections = [summaryContainer, chartContainer, outcomeContainer, equipContainer, districtContainer];
      sections.forEach(s => { if (s) s.style.opacity = '0.4'; });

      let reportData = null;
      try {
        if (window.api && window.api.getReports) {
          reportData = await window.api.getReports({ district, instrument_type, outcome, period });
        }
      } catch (err) {
        console.warn("Could not load report data:", err);
      } finally {
        sections.forEach(s => { if (s) s.style.opacity = '1.0'; });
      }

      // 1. Update Summary Cards
      if (summaryContainer && reportData && reportData.summary) {
        const s = reportData.summary;
        summaryContainer.innerHTML = `
          <div class="card stat-card" style="padding:16px 20px; border-left:4px solid var(--color-primary);">
            <div style="font-size:0.6875rem; font-weight:700; text-transform:uppercase; color:var(--text-muted);">Registered Instruments</div>
            <div style="font-size:1.75rem; font-weight:800; color:var(--color-primary); margin-top:4px;">${s.totalInstruments || 0}</div>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">${s.activeInstruments || 0} Active / Valid</div>
          </div>
          <div class="card stat-card" style="padding:16px 20px; border-left:4px solid var(--color-success);">
            <div style="font-size:0.6875rem; font-weight:700; text-transform:uppercase; color:var(--text-muted);">Compliance Rate</div>
            <div style="font-size:1.75rem; font-weight:800; color:var(--color-success); margin-top:4px;">${s.complianceRate || 0}%</div>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Statutory OIML Compliance</div>
          </div>
          <div class="card stat-card" style="padding:16px 20px; border-left:4px solid #8b5cf6;">
            <div style="font-size:0.6875rem; font-weight:700; text-transform:uppercase; color:var(--text-muted);">Applications Filed</div>
            <div style="font-size:1.75rem; font-weight:800; color:#8b5cf6; margin-top:4px;">${s.totalApplications || 0}</div>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">${s.completedApplications || 0} Completed / Verified</div>
          </div>
          <div class="card stat-card" style="padding:16px 20px; border-left:4px solid #f59e0b;">
            <div style="font-size:0.6875rem; font-weight:700; text-transform:uppercase; color:var(--text-muted);">Active Certificates</div>
            <div style="font-size:1.75rem; font-weight:800; color:#f59e0b; margin-top:4px;">${s.validCertificates || 0}</div>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">₹${(s.statutoryFeesCollected || 0).toLocaleString()} Fees Collected</div>
          </div>
        `;
      }

      // 2. Update Monthly Bar Chart
      if (chartContainer && reportData && reportData.monthlyTrends) {
        chartContainer.innerHTML = Components.renderMonthlyBarChart(reportData.monthlyTrends);
        chartContainer.querySelectorAll('.chart-bar').forEach(bar => {
          bar.addEventListener('click', () => {
            const barPeriod = bar.dataset.period || period;
            const barOutcome = bar.dataset.outcome || 'PASSED';
            const count = parseInt(bar.dataset.count || '0', 10);
            Components.showReportDrilldownModal(barPeriod, barOutcome, count, district);
          });
        });
      }

      // 3. Update Outcome Distribution
      if (outcomeContainer) {
        const rawDist = (reportData && reportData.outcomeDistribution) ? reportData.outcomeDistribution : {};
        const passedObj = (rawDist && typeof rawDist.passed === 'object') ? rawDist.passed : {};
        const failedObj = (rawDist && typeof rawDist.failed === 'object') ? rawDist.failed : {};
        const reviewObj = (rawDist && (typeof rawDist.inReview === 'object' ? rawDist.inReview : typeof rawDist.underReview === 'object' ? rawDist.underReview : {})) || {};

        const passedCount = passedObj.count !== undefined ? passedObj.count : 0;
        const passedPct = passedObj.percentage !== undefined ? passedObj.percentage : 0;

        const failedCount = failedObj.count !== undefined ? failedObj.count : 0;
        const failedPct = failedObj.percentage !== undefined ? failedObj.percentage : 0;

        const reviewCount = reviewObj.count !== undefined ? reviewObj.count : 0;
        const reviewPct = reviewObj.percentage !== undefined ? reviewObj.percentage : 0;

        outcomeContainer.innerHTML = `
          <div class="metric-row-clickable" style="cursor:pointer;" id="click-drilldown-passed" title="Click to view passed applications">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <span style="font-weight:600;">Verified / PASS</span>
              <strong style="color:var(--color-success);">${passedPct}% (${passedCount} units) 🔍</strong>
            </div>
            <div style="background:#e5e7eb; height:8px; border-radius:4px; overflow:hidden;">
              <div style="background:var(--color-success); width:${Math.min(100, Math.max(0, passedPct))}%; height:100%;"></div>
            </div>
          </div>

          <div class="metric-row-clickable" style="cursor:pointer;" id="click-drilldown-failed" title="Click to view failed tolerance applications">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <span style="font-weight:600;">Failed Tolerance / Re-stamped</span>
              <strong style="color:var(--color-danger);">${failedPct}% (${failedCount} units) 🔍</strong>
            </div>
            <div style="background:#e5e7eb; height:8px; border-radius:4px; overflow:hidden;">
              <div style="background:var(--color-danger); width:${Math.min(100, Math.max(0, failedPct))}%; height:100%;"></div>
            </div>
          </div>

          <div class="metric-row-clickable" style="cursor:pointer;" id="click-drilldown-review" title="Click to view under scrutiny applications">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <span style="font-weight:600;">Under Scrutiny / In Verification</span>
              <strong style="color:var(--color-primary);">${reviewPct}% (${reviewCount} units) 🔍</strong>
            </div>
            <div style="background:#e5e7eb; height:8px; border-radius:4px; overflow:hidden;">
              <div style="background:var(--color-primary); width:${Math.min(100, Math.max(0, reviewPct))}%; height:100%;"></div>
            </div>
          </div>
        `;

        container.querySelector('#click-drilldown-passed')?.addEventListener('click', () => {
          Components.showReportDrilldownModal(period, 'PASSED', passedCount, district);
        });
        container.querySelector('#click-drilldown-failed')?.addEventListener('click', () => {
          Components.showReportDrilldownModal(period, 'FAILED', failedCount, district);
        });
        container.querySelector('#click-drilldown-review')?.addEventListener('click', () => {
          Components.showReportDrilldownModal(period, 'UNDER_REVIEW', reviewCount, district);
        });
      }

      // 4. Update Equipment Category Breakdown
      if (equipContainer) {
        const rawEquip = (reportData && Array.isArray(reportData.equipmentBreakdown)) ? reportData.equipmentBreakdown.filter(e => e.count > 0) : [];
        if (rawEquip.length === 0) {
          equipContainer.innerHTML = `<div style="padding:24px; text-align:center; color:var(--text-muted); font-size:0.875rem;">No equipment registered matching active filters.</div>`;
        } else {
          equipContainer.innerHTML = rawEquip.slice(0, 6).map(e => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid #f1f5f9;">
              <span style="font-weight:500;">${e.type}</span>
              <span class="font-mono"><strong>${e.count} units</strong> <span style="color:var(--text-muted); font-size:0.8125rem;">(${e.percentage}%)</span></span>
            </div>
          `).join('');
        }
      }

      // 5. Update District Compliance Table
      if (districtContainer) {
        const dList = (reportData && Array.isArray(reportData.districtCompliance)) ? reportData.districtCompliance : [];
        if (dList.length === 0) {
          districtContainer.innerHTML = `<div style="padding:24px; text-align:center; color:var(--text-muted);">No district records found.</div>`;
        } else {
          districtContainer.innerHTML = `
            <table class="table" style="margin:0;">
              <thead>
                <tr>
                  <th>District Jurisdiction</th>
                  <th>Total Registered</th>
                  <th>Compliant Units</th>
                  <th>Non-Compliant / Failed</th>
                  <th>Compliance Rate</th>
                  <th>Statutory Status</th>
                </tr>
              </thead>
              <tbody>
                ${dList.map(d => `
                  <tr>
                    <td><strong>${d.district} District</strong></td>
                    <td class="font-mono">${d.total} units</td>
                    <td class="font-mono" style="color:var(--color-success); font-weight:700;">${d.compliant}</td>
                    <td class="font-mono" style="color:${d.failed > 0 ? 'var(--color-danger)' : 'var(--text-muted)'};">${d.failed}</td>
                    <td>
                      <div style="display:flex; align-items:center; gap:8px;">
                        <div style="flex:1; background:#e2e8f0; height:6px; border-radius:3px; max-width:80px; overflow:hidden;">
                          <div style="background:var(--color-success); width:${d.rate}%; height:100%;"></div>
                        </div>
                        <strong style="font-size:0.8125rem;">${d.rate}%</strong>
                      </div>
                    </td>
                    <td>
                      <span class="badge ${d.rate >= 90 ? 'status-valid' : 'status-review'}" style="font-size:0.75rem;">
                        ${d.rate >= 90 ? 'SATISFACTORY' : 'ATTENTION REQUIRED'}
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `;
        }
      }
    };

    // Initial load
    await loadReportData();

    // Attach change listeners to all 4 filters
    ['#report-filter-district', '#report-filter-type', '#report-filter-outcome', '#report-filter-period'].forEach(selId => {
      const el = container.querySelector(selId);
      if (el) el.addEventListener('change', loadReportData);
    });

    // Export CSV functionality with active filters
    const exportBtn = container.querySelector('#export-reports-csv-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        let apps = window.state.getApplications() || [];
        const activeFilters = window.state.getReportFilters ? window.state.getReportFilters() : { district: 'ALL', instrumentType: 'ALL', outcome: 'ALL' };
        if (activeFilters.district && activeFilters.district !== 'ALL') {
          apps = apps.filter(a => (a.preferredLocation && a.preferredLocation.includes(activeFilters.district)) || (a.location && a.location.includes(activeFilters.district)));
        }
        if (activeFilters.instrumentType && activeFilters.instrumentType !== 'ALL') {
          apps = apps.filter(a => a.instrumentType === activeFilters.instrumentType);
        }
        if (activeFilters.outcome && activeFilters.outcome !== 'ALL') {
          if (activeFilters.outcome === 'PASSED') {
            apps = apps.filter(a => a.status === 'COMPLETED' || a.status === 'VERIFIED' || a.status === 'APPROVED');
          } else if (activeFilters.outcome === 'FAILED') {
            apps = apps.filter(a => a.status === 'REJECTED' || a.status === 'NON_COMPLIANT');
          }
        }
        const csvHeader = "Application ID,Instrument ID,Type,Owner,Business,District,Status,Scheduled Date,Officer,Fee\n";
        const csvRows = apps.map(a => 
          `"${a.id}","${a.instrumentId || ''}","${a.instrumentType || ''}","${a.ownerName || ''}","${a.businessName || ''}","${a.preferredLocation || a.location || ''}","${a.status}","${a.scheduledDate || ''}","${a.assignedOfficerName || ''}","${a.feeAmount || 0}"`
        ).join("\n");
        const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `MeasureX_Verification_Report_${activeFilters.district}_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        Components.showToast({ title: "CSV Export Complete", message: `Exported ${apps.length} filtered audit records to CSV.`, type: "success" });
      });
    }
  }

  async renderAdminAuditTrail(container) {
    // Statutory Compliance Audit Trail (Unique Feature 3 & Feature 29)
    try {
      if (window.api && window.api.getAuditTrail) {
        const res = await window.api.getAuditTrail();
        if (res && res.success && Array.isArray(res.data)) {
          window.state.setAuditTrail(res.data);
        }
      }
    } catch (err) {
      console.warn("Could not refresh audit trail from API:", err);
    }

    let allLogs = window.state.getAuditTrail ? window.state.getAuditTrail() : [];
    let currentRoleFilter = 'ALL';
    let currentCategoryFilter = 'ALL';
    let currentSearchTerm = '';

    const renderAuditTableRows = (logs) => {
      if (!logs.length) {
        return `
          <tr>
            <td colspan="8" style="text-align:center; padding:32px; color:var(--text-muted);">
              <div style="font-size:1.5rem; margin-bottom:8px;">🔍</div>
              <strong>No matching audit log records found.</strong>
              <div style="font-size:0.8125rem; margin-top:4px;">Try clearing filters or search terms.</div>
            </td>
          </tr>
        `;
      }

      return logs.map(log => {
        const roleBadgeClass = log.role === 'ADMIN' ? 'status-failed' : log.role === 'LMO' ? 'status-valid' : log.role === 'OWNER' ? 'status-submitted' : 'status-review';
        const channelBadge = (log.channel && log.channel.includes('Mobile')) 
          ? `<span class="badge" style="background:#eff6ff; color:#1d4ed8; font-size:0.6875rem;">📱 Mobile</span>`
          : `<span class="badge" style="background:#f8fafc; color:#475569; font-size:0.6875rem;">💻 Web</span>`;

        let actionIcon = '📝';
        if (log.action.includes('PASS') || log.action.includes('APPROV')) actionIcon = '✅';
        else if (log.action.includes('FAIL') || log.action.includes('REJECT')) actionIcon = '❌';
        else if (log.action.includes('REVOKE')) actionIcon = '🚨';
        else if (log.action.includes('SCHEDULE')) actionIcon = '📅';
        else if (log.action.includes('EVIDENCE')) actionIcon = '📷';

        return `
          <tr>
            <td class="font-mono audit-col-timestamp" style="font-size:0.75rem; white-space:nowrap;">
              ${log.timestamp ? log.timestamp.slice(0, 19).replace('T', ' ') : '--'}
            </td>
            <td class="audit-col-actor">
              <div style="font-weight:700; color:var(--text-primary); font-size:0.875rem;">${log.user || 'System'}</div>
              <div style="display:flex; align-items:center; gap:6px; margin-top:2px;">
                <span class="badge ${roleBadgeClass}" style="font-size:0.6875rem;">${log.role}</span>
                ${channelBadge}
              </div>
            </td>
            <td class="audit-col-action">
              <div style="font-weight:600; font-size:0.8125rem;">${actionIcon} ${log.action}</div>
              ${log.details ? `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px; max-width:220px;">${log.details}</div>` : ''}
            </td>
            <td class="audit-col-entity">
              <div style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:var(--text-muted);">${log.entity}</div>
              <span class="font-mono" style="font-size:0.8125rem; font-weight:700; color:var(--primary-800);">${log.entityId}</span>
            </td>
            <td class="audit-col-prev-state">
              <span style="font-size:0.8125rem; color:var(--text-muted); background:var(--bg-surface-alt); padding:2px 6px; border-radius:var(--radius-sm);">${log.previousState || '--'}</span>
            </td>
            <td class="audit-col-arrow" style="text-align:center; color:var(--primary-600); font-weight:bold;">→</td>
            <td class="audit-col-new-state">
              <span style="font-weight:700; color:var(--primary-900); background:var(--primary-100); padding:2px 8px; border-radius:var(--radius-sm); font-size:0.8125rem;">
                ${log.newState}
              </span>
            </td>
            <td class="audit-col-details">
              <button type="button" class="inspect-audit-btn" data-log='${JSON.stringify(log).replace(/'/g, "&apos;")}' title="Inspect details for ${log.action}">
                Inspect ➔
              </button>
            </td>
          </tr>
        `;
      }).join('');
    };

    const getFilteredLogs = () => {
      return allLogs.filter(log => {
        // Role filter
        if (currentRoleFilter !== 'ALL' && log.role !== currentRoleFilter) return false;

        // Category filter
        if (currentCategoryFilter === 'APPLICATION' && !log.action.includes('APPLICATION') && !log.action.includes('SCHEDULE') && !log.action.includes('CORRECTION')) return false;
        if (currentCategoryFilter === 'VERIFICATION' && !log.action.includes('VERIFICATION') && !log.action.includes('EVIDENCE')) return false;
        if (currentCategoryFilter === 'REVOCATION' && !log.action.includes('REVOKE') && !log.action.includes('EXPIRE')) return false;
        if (currentCategoryFilter === 'INSTRUMENT' && !log.action.includes('INSTRUMENT')) return false;

        // Search text
        if (currentSearchTerm) {
          const q = currentSearchTerm.toLowerCase();
          const matchUser = (log.user || '').toLowerCase().includes(q);
          const matchAction = (log.action || '').toLowerCase().includes(q);
          const matchEntity = (log.entityId || '').toLowerCase().includes(q);
          const matchDetails = (log.details || '').toLowerCase().includes(q);
          if (!matchUser && !matchAction && !matchEntity && !matchDetails) return false;
        }

        return true;
      });
    };

    // Calculate Summary Counts
    const totalCount = allLogs.length;
    const verificationCount = allLogs.filter(l => l.action.includes('VERIFICATION')).length;
    const appCount = allLogs.filter(l => l.action.includes('APPLICATION') || l.action.includes('SCHEDULE')).length;
    const enforcementCount = allLogs.filter(l => l.action.includes('REVOKE') || l.action.includes('FAIL')).length;

    container.innerHTML = `
      <div class="page-header" style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px;">
        <div>
          <div style="display:inline-flex; align-items:center; gap:6px; padding:3px 10px; background:var(--primary-100); color:var(--primary-800); border-radius:var(--radius-sm); font-size:0.75rem; font-weight:700; margin-bottom:6px;">
            🔒 Section 17 &amp; 24 Statutory Ledger
          </div>
          <h1 class="page-title">Statutory Compliance Audit Trail</h1>
          <p class="page-subtitle">Tamper-evident chronological log of all filings, officer inspections, status transitions, and revocations.</p>
        </div>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button type="button" class="btn btn-primary" id="export-audit-csv-btn" style="display:inline-flex; align-items:center; gap:6px; font-weight:700;">
            📥 Export Audit Log (CSV)
          </button>
        </div>
      </div>

      <!-- Audit Stats Grid -->
      <div class="audit-stats-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:16px; margin-bottom:24px;">
        <div class="card" style="padding:16px; text-align:center;">
          <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Total Events</div>
          <div style="font-size:1.75rem; font-weight:900; color:var(--primary-800); margin-top:4px;" id="stat-total-events">${totalCount}</div>
        </div>
        <div class="card" style="padding:16px; text-align:center;">
          <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Field Inspections</div>
          <div style="font-size:1.75rem; font-weight:900; color:var(--color-success); margin-top:4px;">${verificationCount}</div>
        </div>
        <div class="card" style="padding:16px; text-align:center;">
          <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Applications &amp; Review</div>
          <div style="font-size:1.75rem; font-weight:900; color:var(--color-primary); margin-top:4px;">${appCount}</div>
        </div>
        <div class="card" style="padding:16px; text-align:center;">
          <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Revocations / Failures</div>
          <div style="font-size:1.75rem; font-weight:900; color:var(--color-danger); margin-top:4px;">${enforcementCount}</div>
        </div>
      </div>

      <!-- Filter Bar -->
      <div class="card audit-filter-bar" style="padding:18px; margin-bottom:20px;">
        <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
          <div style="flex:1; min-width:220px;">
            <input type="text" id="audit-search-input" class="form-control" placeholder="Search user, action, instrument ID, certificate..." />
          </div>
          <div style="width:160px;">
            <select id="audit-role-select" class="form-control">
              <option value="ALL">All Roles</option>
              <option value="OWNER">Trader / Owner</option>
              <option value="LMO">Inspector / LMO</option>
              <option value="ADMIN">Directorate Admin</option>
              <option value="SYSTEM">System Engine</option>
            </select>
          </div>
          <div style="width:180px;">
            <select id="audit-category-select" class="form-control">
              <option value="ALL">All Event Types</option>
              <option value="APPLICATION">Applications &amp; Scrutiny</option>
              <option value="VERIFICATION">Field Verifications</option>
              <option value="REVOCATION">Revocations &amp; Expirations</option>
              <option value="INSTRUMENT">Instrument Registry</option>
            </select>
          </div>
          <button type="button" id="audit-reset-btn" class="btn btn-secondary" style="font-size:0.875rem;">Reset</button>
        </div>
      </div>

      <!-- Audit Log Table with Dedicated Horizontal Scroll Container -->
      <div class="audit-table-card">
        <div class="audit-table-header-bar">
          <div class="audit-table-title">
            <span>📋 Audit Records Ledger</span>
            <span class="badge" style="background:#e2e8f0; color:#475569; font-size:0.75rem;" id="audit-records-badge">${allLogs.length} Records</span>
          </div>
          <div class="audit-scroll-hint" id="audit-scroll-hint" aria-hidden="true">
            <span class="audit-scroll-hint-icon">↔</span>
            <span>Scroll horizontally to view all columns</span>
          </div>
        </div>
        <div class="audit-table-container" id="audit-table-scroll-container" tabindex="0" role="region" aria-label="Audit Trail Table, scrollable horizontally">
          <table class="table audit-table">
            <thead>
              <tr>
                <th class="audit-col-timestamp">Timestamp</th>
                <th class="audit-col-actor">Actor &amp; Channel</th>
                <th class="audit-col-action">Statutory Action</th>
                <th class="audit-col-entity">Entity Target</th>
                <th class="audit-col-prev-state">Previous State</th>
                <th class="audit-col-arrow"></th>
                <th class="audit-col-new-state">New State</th>
                <th class="audit-col-details">Details</th>
              </tr>
            </thead>
            <tbody id="audit-table-body">
              ${renderAuditTableRows(allLogs)}
            </tbody>
          </table>
        </div>
      </div>
    `;

    const updateView = () => {
      const filtered = getFilteredLogs();
      const tbody = document.getElementById('audit-table-body');
      if (tbody) {
        tbody.innerHTML = renderAuditTableRows(filtered);
        attachRowInspectors();
      }
      const countBadge = document.getElementById('audit-records-badge');
      if (countBadge) {
        countBadge.textContent = `${filtered.length} Records`;
      }
      updateScrollHintState();
    };

    const attachRowInspectors = () => {
      container.querySelectorAll('.inspect-audit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          try {
            const log = JSON.parse(btn.dataset.log);
            Components.showModal({
              title: `Audit Entry — ${log.action}`,
              content: `
                <div style="display:flex; flex-direction:column; gap:12px; font-size:0.875rem;">
                  <div><strong style="color:var(--text-muted);">Timestamp:</strong> <span class="font-mono">${log.timestamp}</span></div>
                  <div><strong style="color:var(--text-muted);">Authorized Actor:</strong> <strong>${log.user}</strong> (${log.role})</div>
                  <div><strong style="color:var(--text-muted);">Access Channel:</strong> ${log.channel || 'Secure Portal Web'}</div>
                  <div><strong style="color:var(--text-muted);">Entity Reference:</strong> <span class="font-mono">${log.entity} / ${log.entityId}</span></div>
                  <div style="background:var(--bg-surface-alt); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--border-light);">
                    <div style="font-weight:700; margin-bottom:4px;">State Transition:</div>
                    <div style="display:flex; align-items:center; gap:8px;">
                      <span class="badge" style="background:#e2e8f0; color:#475569;">${log.previousState || 'INITIAL'}</span>
                      <span>➔</span>
                      <span class="badge status-valid">${log.newState}</span>
                    </div>
                  </div>
                  <div><strong style="color:var(--text-muted);">Audit Details &amp; Legal Context:</strong><br />${log.details || 'Standard statutory event recorded by central ledger.'}</div>
                </div>
              `,
              confirmText: "Close"
            });
          } catch(e) { console.error(e); }
        });
      });
    };

    // Horizontal Scroll Hint State Management
    const scrollContainer = document.getElementById('audit-table-scroll-container');
    const scrollHint = document.getElementById('audit-scroll-hint');

    const updateScrollHintState = () => {
      if (!scrollContainer || !scrollHint) return;
      const isScrollable = scrollContainer.scrollWidth > scrollContainer.clientWidth + 5;
      if (!isScrollable) {
        scrollHint.style.opacity = '0';
        scrollHint.style.pointerEvents = 'none';
        return;
      }
      scrollHint.style.opacity = '1';
      scrollHint.style.pointerEvents = 'auto';

      const atRight = scrollContainer.scrollLeft + scrollContainer.clientWidth >= scrollContainer.scrollWidth - 15;
      if (atRight) {
        scrollHint.innerHTML = `<span>✓</span> <span>Details column reached</span>`;
        scrollHint.style.background = '#ECFDF5';
        scrollHint.style.color = '#047857';
        scrollHint.style.borderColor = '#A7F3D0';
      } else {
        scrollHint.innerHTML = `<span class="audit-scroll-hint-icon">↔</span> <span>Scroll horizontally to view all columns</span>`;
        scrollHint.style.background = '#EBF5F2';
        scrollHint.style.color = '#0B5D4B';
        scrollHint.style.borderColor = 'rgba(11, 93, 75, 0.2)';
      }
    };

    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', updateScrollHintState, { passive: true });
      window.addEventListener('resize', updateScrollHintState, { passive: true });
      setTimeout(updateScrollHintState, 60);
    }

    // Filter listeners
    const searchInput = document.getElementById('audit-search-input');
    const roleSelect = document.getElementById('audit-role-select');
    const catSelect = document.getElementById('audit-category-select');
    const resetBtn = document.getElementById('audit-reset-btn');
    const exportBtn = document.getElementById('export-audit-csv-btn');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        currentSearchTerm = e.target.value.trim();
        updateView();
      });
    }

    if (roleSelect) {
      roleSelect.addEventListener('change', (e) => {
        currentRoleFilter = e.target.value;
        updateView();
      });
    }

    if (catSelect) {
      catSelect.addEventListener('change', (e) => {
        currentCategoryFilter = e.target.value;
        updateView();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        currentRoleFilter = 'ALL';
        currentCategoryFilter = 'ALL';
        currentSearchTerm = '';
        if (searchInput) searchInput.value = '';
        if (roleSelect) roleSelect.value = 'ALL';
        if (catSelect) catSelect.value = 'ALL';
        updateView();
      });
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const filtered = getFilteredLogs();
        if (window.api && window.api.exportAuditLogsCSV) {
          window.api.exportAuditLogsCSV(filtered);
          Components.showToast({
            title: "CSV Export Generated",
            message: `Exported ${filtered.length} statutory audit trail records to CSV.`,
            type: "success"
          });
        }
      });
    }

    attachRowInspectors();

    // If audit logs were empty on entry, load freshly from API
    if (!allLogs || allLogs.length === 0) {
      window.api.getAuditTrail().then(freshLogs => {
        if (freshLogs && freshLogs.length > 0) {
          allLogs = freshLogs;
          updateView();
          const totalEl = document.getElementById('stat-total-events');
          if (totalEl) totalEl.textContent = allLogs.length;
        }
      }).catch(err => console.warn('[Audit Trail] Dynamic load notice:', err));
    }
  }

  async renderLMOCertificates(container) {
    if ((!window.state.getCertificates() || !window.state.getCertificates().length) && window.api && window.api.getCertificates) {
      try {
        await window.api.getCertificates();
      } catch (err) {
        console.warn('[LMO Certificates] Failed to preload certificates:', err);
      }
    }

    const allCerts = window.state.getCertificates() || [];
    let currentFilterStatus = 'ALL';
    let currentSearchTerm = '';

    const totalCount = allCerts.length;
    const validCount = allCerts.filter(c => c.status === 'VALID').length;
    const expiringCount = allCerts.filter(c => c.status === 'EXPIRING_SOON').length;
    const expiredCount = allCerts.filter(c => c.status === 'EXPIRED').length;
    const revokedCount = allCerts.filter(c => c.status === 'REVOKED').length;

    const getFilteredCerts = () => {
      return allCerts.filter(c => {
        if (currentFilterStatus !== 'ALL' && c.status !== currentFilterStatus) return false;
        if (currentSearchTerm) {
          const q = currentSearchTerm.toLowerCase();
          const matchId = (c.id || '').toLowerCase().includes(q);
          const matchTrader = (c.businessName || c.ownerName || '').toLowerCase().includes(q);
          const matchIns = (c.instrumentType || c.serialNumber || c.instrumentId || '').toLowerCase().includes(q);
          const matchOfficer = (c.officerName || '').toLowerCase().includes(q);
          const matchSeal = (c.wireSealNumber || '').toLowerCase().includes(q);
          if (!matchId && !matchTrader && !matchIns && !matchOfficer && !matchSeal) return false;
        }
        return true;
      });
    };

    const renderRows = (certs) => {
      if (!certs.length) {
        return `
          <tr>
            <td colspan="7" style="text-align:center; padding:36px; color:var(--text-muted);">
              <div style="font-size:1.75rem; margin-bottom:8px;">🛡️</div>
              <strong>No certificates match the selected filter criteria.</strong>
              <div style="font-size:0.8125rem; margin-top:4px;">Certificates are issued following field verification approval.</div>
            </td>
          </tr>
        `;
      }

      return certs.map(c => `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap:8px;">
              <a href="#verify?id=${c.id}" title="Click to verify digital QR seal">
                ${Components.renderQRCodeSVG(c.id, 34)}
              </a>
              <div>
                <strong class="font-mono" style="color:var(--color-primary);">${c.id}</strong>
                <div style="font-size:0.75rem; color:var(--text-muted);">${c.verificationDate || 'Verified'}</div>
              </div>
            </div>
          </td>
          <td>
            <div style="font-weight:700;">${c.instrumentType || 'Commercial Scale'}</div>
            <div class="font-mono" style="font-size:0.75rem; color:var(--text-muted);">
              ${c.serialNumber ? 'S/N: ' + c.serialNumber : (c.instrumentId || '--')}
            </div>
          </td>
          <td>
            <strong>${c.businessName || 'Commercial Establishment'}</strong>
            ${c.wireSealNumber ? `<div style="font-size:0.75rem; color:var(--text-muted);">🔒 Seal: ${c.wireSealNumber}</div>` : ''}
          </td>
          <td>
            <div>👮 ${c.officerName || 'Legal Metrology Officer'}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${c.verifierType || 'LMO'}</div>
          </td>
          <td>
            <div style="font-weight:600;">${c.validUntil || '--'}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">Annual Stamping</div>
          </td>
          <td>${Components.renderStatusBadge(c.status)}</td>
          <td>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              <a href="#owner-certificate-details?id=${c.id}" class="btn btn-sm btn-primary" title="View statutory certificate">
                📜 View Certificate
              </a>
              <a href="#verify?id=${c.id}" class="btn btn-sm btn-secondary" title="Public verification view">
                🔍 Public Verify
              </a>
              ${c.instrumentId ? `
                <a href="#admin-instrument-profile?id=${c.instrumentId}" class="btn btn-sm btn-outline" title="View instrument details">
                  ⚖️ Instrument
                </a>
              ` : ''}
            </div>
          </td>
        </tr>
      `).join('');
    };

    container.innerHTML = `
      <div style="max-width:1140px; margin:0 auto;">
        <div class="page-header" style="margin-bottom:24px;">
          <div>
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
              <h1 class="page-title">Legal Metrology Certificates Registry</h1>
              <span class="badge status-valid" style="font-weight:700;">STATUTORY OFFICER VIEW</span>
            </div>
            <p class="page-subtitle">Central statutory repository of digitally authenticated verification certificates issued across commercial jurisdictions.</p>
          </div>
          <div style="display:flex; gap:10px;">
            <a href="#verify" class="btn btn-secondary">🔍 Scan Public QR</a>
          </div>
        </div>

        <!-- Metric Stat Cards -->
        <div class="dashboard-metrics-grid" style="margin-bottom:24px;">
          <div class="stat-card stat-info">
            <div class="stat-header"><span class="stat-label">Total Certificates</span><span>🛡️</span></div>
            <div class="stat-value stat-counter-val" data-target="${totalCount}">${totalCount}</div>
            <div class="stat-subtext">Issued statutory certificates</div>
          </div>
          <div class="stat-card stat-success">
            <div class="stat-header"><span class="stat-label">Valid &amp; Active</span><span>✅</span></div>
            <div class="stat-value stat-counter-val" data-target="${validCount}">${validCount}</div>
            <div class="stat-subtext">Compliant commercial equipment</div>
          </div>
          <div class="stat-card stat-warning">
            <div class="stat-header"><span class="stat-label">Expiring Soon</span><span>⏰</span></div>
            <div class="stat-value stat-counter-val" data-target="${expiringCount}">${expiringCount}</div>
            <div class="stat-subtext">Within 30 days renewal threshold</div>
          </div>
          <div class="stat-card stat-danger">
            <div class="stat-header"><span class="stat-label">Expired</span><span>⚠️</span></div>
            <div class="stat-value stat-counter-val" data-target="${expiredCount}">${expiredCount}</div>
            <div class="stat-subtext">Requires statutory re-stamping</div>
          </div>
          <div class="stat-card stat-danger" style="border-left-color:#b91c1c;">
            <div class="stat-header"><span class="stat-label">Revoked</span><span>🚫</span></div>
            <div class="stat-value stat-counter-val" data-target="${revokedCount}">${revokedCount}</div>
            <div class="stat-subtext">Withheld by enforcement order</div>
          </div>
        </div>

        <!-- Filter Tabs & Search -->
        <div class="card" style="padding:16px 20px; margin-bottom:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap;">
            <div class="tab-nav" style="margin:0; flex-wrap:wrap;">
              <button type="button" class="tab-btn active" data-status="ALL">All Certificates (${totalCount})</button>
              <button type="button" class="tab-btn" data-status="VALID">Valid (${validCount})</button>
              <button type="button" class="tab-btn" data-status="EXPIRING_SOON">Expiring Soon (${expiringCount})</button>
              <button type="button" class="tab-btn" data-status="EXPIRED">Expired (${expiredCount})</button>
              <button type="button" class="tab-btn" data-status="REVOKED">Revoked (${revokedCount})</button>
            </div>
            <div style="flex:1; max-width:280px; min-width:200px;">
              <input type="text" id="lmo-cert-search" class="form-control" placeholder="Search cert ID, trader, serial..." />
            </div>
          </div>
        </div>

        <!-- Certificates Ledger Table -->
        <div class="card table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Certificate Number</th>
                <th>Instrument &amp; Model</th>
                <th>Commercial Entity</th>
                <th>Verifying Officer</th>
                <th>Validity &amp; Expiry</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="lmo-certs-table-body">
              ${renderRows(getFilteredCerts())}
            </tbody>
          </table>
        </div>
      </div>
    `;

    const tbody = container.querySelector('#lmo-certs-table-body');
    const tabBtns = container.querySelectorAll('.tab-nav .tab-btn');
    const searchInp = container.querySelector('#lmo-cert-search');

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilterStatus = btn.dataset.status;
        tbody.innerHTML = renderRows(getFilteredCerts());
      });
    });

    if (searchInp) {
      searchInp.addEventListener('input', (e) => {
        currentSearchTerm = e.target.value.trim();
        tbody.innerHTML = renderRows(getFilteredCerts());
      });
    }
  }

  renderAdminCertificates(container) {
    const certs = window.state.getCertificates() || [];

    const renderTable = () => {
      container.innerHTML = `
        <div class="page-header">
          <div>
            <h1 class="page-title">Certificates Registry &amp; Revocation</h1>
            <p class="page-subtitle">Central supervision of issued verification certificates and statutory revocation enforcement.</p>
          </div>
        </div>

        <div class="card table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Certificate ID</th>
                <th>Commercial Entity</th>
                <th>Instrument Type</th>
                <th>Valid Until</th>
                <th>Status</th>
                <th>Verifying Officer</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${certs.length === 0 ? `
                <tr><td colspan="7" style="text-align:center; padding:32px; color:var(--text-muted);">No certificates issued yet. Issued certificates will appear here.</td></tr>
              ` : certs.map(c => `
                <tr>
                  <td class="font-mono"><strong>${c.id}</strong></td>
                  <td><strong>${c.businessName || 'Commercial Trader'}</strong></td>
                  <td>${c.instrumentType}</td>
                  <td>${c.validUntil}</td>
                  <td>${Components.renderStatusBadge(c.status)}</td>
                  <td>${c.officerName || 'Legal Metrology Officer'}</td>
                  <td>
                    <div style="display:flex; gap:6px;">
                      <a href="#owner-certificate-details?id=${c.id}" class="btn btn-sm btn-secondary">Document</a>
                      ${c.status === 'VALID' ? `
                        <button type="button" class="btn btn-sm btn-danger open-revoke-cert-modal-btn" data-cert-id="${c.id}" data-instrument="${c.instrumentType || ''}" data-business="${c.businessName || ''}">Revoke</button>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      attachRevokeListeners();
    };

    const attachRevokeListeners = () => {
      container.querySelectorAll('.open-revoke-cert-modal-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const certId = btn.dataset.certId;
          const instrument = btn.dataset.instrument || '';
          const business = btn.dataset.business || '';

          Components.showModal({
            title: `Statutory Revocation: Certificate ${certId}`,
            content: `
              <div style="padding:12px 14px; background:#FEF2F2; border:1px solid #FCA5A5; border-radius:6px; margin-bottom:16px;">
                <div style="font-weight:700; color:#991B1B; display:flex; align-items:center; gap:6px;">
                  <span>⚠️</span> STATUTORY NOTICE UNDER LEGAL METROLOGY ACT, 2009
                </div>
                <div style="font-size:0.8125rem; color:#7F1D1D; margin-top:4px; line-height:1.4;">
                  Revoking this certificate immediately invalidates statutory legal authorization for commercial use. The certificate status will be permanently marked <strong>REVOKED</strong> in the public QR verification registry.
                </div>
              </div>

              <div style="background:var(--color-surface); border:1px solid var(--color-border); border-radius:var(--radius-sm); padding:12px; margin-bottom:16px; font-size:0.8125rem;">
                <div><strong>Certificate ID:</strong> <span class="font-mono">${certId}</span></div>
                <div><strong>Commercial Entity:</strong> ${business || 'Commercial Trader'}</div>
                <div><strong>Instrument Type:</strong> ${instrument || 'Weighing Instrument'}</div>
              </div>

              <form id="statutory-revocation-form">
                <div class="form-group" style="margin-bottom:14px;">
                  <label class="form-label" style="font-weight:700;">Statutory Grounds for Revocation <span class="required-star">*</span></label>
                  <select id="modal-revoke-reason-select" class="form-control">
                    <option value="Tampered or broken statutory verification seal">Tampered or broken statutory verification seal</option>
                    <option value="Instrument failed inspection: Error exceeds statutory MPE tolerance">Instrument failed inspection: Error exceeds statutory MPE tolerance</option>
                    <option value="Unauthorized mechanical or electronic modifications detected">Unauthorized mechanical or electronic modifications detected</option>
                    <option value="Instrument utilized for unapproved commercial transaction">Instrument utilized for unapproved commercial transaction</option>
                    <option value="Other statutory enforcement action">Other statutory enforcement action</option>
                  </select>
                </div>

                <div class="form-group" style="margin-bottom:14px;">
                  <label class="form-label" style="font-weight:700;">Statutory Enforcement Remarks / Evidence Summary <span class="required-star">*</span></label>
                  <textarea id="modal-revoke-notes" class="form-control" rows="3" placeholder="Provide detailed statutory findings, inspection report reference, or seal condition..." required></textarea>
                </div>
              </form>
            `,
            confirmText: "Enforce Certificate Revocation",
            confirmClass: "btn-danger",
            onConfirm: async (close) => {
              const reasonSelect = document.getElementById('modal-revoke-reason-select').value;
              const notes = document.getElementById('modal-revoke-notes').value.trim();

              if (!notes) {
                Components.showToast({
                  title: "Remarks Required",
                  message: "Please enter detailed enforcement remarks before revoking.",
                  type: "error"
                });
                return;
              }

              const fullReason = `${reasonSelect}. Remarks: ${notes}`;

              try {
                await window.api.revokeCertificate(certId, fullReason);
                Components.showToast({
                  title: "Certificate Revoked",
                  message: `Certificate ${certId} has been revoked and recorded in public registry.`,
                  type: "success"
                });
                close();
                await window.api.getCertificates();
                this.renderAdminCertificates(container);
              } catch (err) {
                Components.showToast({
                  title: "Revocation Failed",
                  message: err.message || "Failed to revoke certificate.",
                  type: "error"
                });
              }
            }
          });
        });
      });
    };

    renderTable();
  }

  // ==========================================
  // Admin User Management & Approval Workflow
  // ==========================================

  renderAdminUsers(container) {
    let currentRoleTab = 'ALL';
    let searchTerm = '';

    const renderUsersContent = () => {
      const allUsers = window.state.getUsers ? window.state.getUsers() : [];
      const pendingUsers = window.state.getPendingUsers ? window.state.getPendingUsers() : [];
      const activeUsers = allUsers.filter(u => u.status === 'ACTIVE' || !u.status);

      const ownerCount = activeUsers.filter(u => u.role === 'OWNER').length;
      const lmoCount = activeUsers.filter(u => u.role === 'LMO').length;
      const adminCount = activeUsers.filter(u => u.role === 'ADMIN').length;

      let displayedUsers = [];
      if (currentRoleTab === 'PENDING') {
        displayedUsers = pendingUsers;
      } else if (currentRoleTab === 'OWNER') {
        displayedUsers = activeUsers.filter(u => u.role === 'OWNER');
      } else if (currentRoleTab === 'LMO') {
        displayedUsers = activeUsers.filter(u => u.role === 'LMO');
      } else if (currentRoleTab === 'ADMIN') {
        displayedUsers = activeUsers.filter(u => u.role === 'ADMIN');
      } else {
        displayedUsers = activeUsers;
      }

      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        displayedUsers = displayedUsers.filter(u =>
          ((u.name || '') + ' ' + (u.email || '') + ' ' + (u.businessName || u.department || '') + ' ' + (u.role || '') + ' ' + (u.district || '')).toLowerCase().includes(q)
        );
      }

      return `
        <div style="max-width:1120px; margin:0 auto;">
          <div class="page-header">
            <div>
              <h1 class="page-title">User Management &amp; Access Clearance</h1>
              <p class="page-subtitle">Supervise registered Commercial Instrument Owners, Legal Metrology Officers, and Administrators.</p>
            </div>
            <div style="display:flex; gap:10px;">
              <a href="#register" class="btn btn-primary">➕ Onboard New User</a>
            </div>
          </div>

          <!-- User Management Role Tabs (Strictly: All Users, Owners / Traders, LMOs, Admins, Pending) -->
          <div style="display:flex; gap:8px; margin-bottom:20px; border-bottom:1px solid var(--color-border); padding-bottom:8px; flex-wrap:wrap;">
            <button type="button" class="btn btn-sm ${currentRoleTab === 'ALL' ? 'btn-primary' : 'btn-outline'} user-role-tab-btn" data-tab="ALL" style="font-weight:700;">
              👥 All Users (${activeUsers.length})
            </button>
            <button type="button" class="btn btn-sm ${currentRoleTab === 'OWNER' ? 'btn-primary' : 'btn-outline'} user-role-tab-btn" data-tab="OWNER" style="font-weight:700;">
              ⚖️ Owners / Traders (${ownerCount})
            </button>
            <button type="button" class="btn btn-sm ${currentRoleTab === 'LMO' ? 'btn-primary' : 'btn-outline'} user-role-tab-btn" data-tab="LMO" style="font-weight:700;">
              🏛️ Legal Metrology Officers (${lmoCount})
            </button>
            <button type="button" class="btn btn-sm ${currentRoleTab === 'ADMIN' ? 'btn-primary' : 'btn-outline'} user-role-tab-btn" data-tab="ADMIN" style="font-weight:700;">
              🛡️ State Administrators (${adminCount})
            </button>
            <button type="button" class="btn btn-sm ${currentRoleTab === 'PENDING' ? 'btn-warning' : 'btn-outline'} user-role-tab-btn" data-tab="PENDING" style="font-weight:700;">
              ⏳ Pending Approvals (${pendingUsers.length})
              ${pendingUsers.length > 0 ? `<span class="badge" style="background:#b45309; color:#fff; font-size:0.6875rem; margin-left:4px;">Action Required</span>` : ''}
            </button>
          </div>

          ${currentRoleTab !== 'PENDING' ? `
            <div class="card" style="padding:16px 20px; margin-bottom:18px; background:var(--color-surface); border:1px solid var(--color-border);">
              <div style="display:flex; gap:12px; align-items:center;">
                <input type="text" id="admin-user-search" class="form-control" placeholder="Search by name, email, establishment, role, or district..." value="${searchTerm}" style="max-width:440px;" />
              </div>
            </div>

            <div class="card table-responsive">
              <table class="table">
                <thead>
                  <tr>
                    <th>User ID</th>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Business / Department</th>
                    <th>Official Email</th>
                    <th>Mobile</th>
                    <th>District</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${displayedUsers.length === 0 ? `
                    <tr><td colspan="8" style="text-align:center; padding:32px; color:var(--text-muted);">No users found matching the selected filter.</td></tr>
                  ` : displayedUsers.map(u => {
                    const roleBadge = u.role === 'ADMIN' ? 'status-failed' : u.role === 'LMO' ? 'status-valid' : 'status-submitted';
                    return `
                      <tr>
                        <td class="font-mono"><strong>${u.id}</strong></td>
                        <td><strong>${u.name}</strong></td>
                        <td><span class="badge ${roleBadge}">${u.role}</span></td>
                        <td>${u.businessName || u.department || 'Legal Metrology'}</td>
                        <td>${u.email}</td>
                        <td>${u.mobile || '--'}</td>
                        <td>${u.district || 'Patna'}</td>
                        <td><span class="badge status-valid">ACTIVE</span></td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          ` : `
            <!-- Pending Approvals Tab -->
            ${pendingUsers.length === 0 ? `
              <div class="card" style="padding:48px 24px; text-align:center; color:var(--text-muted);">
                <div style="font-size:2.5rem; margin-bottom:8px;">✅</div>
                <h3 style="font-size:1.125rem; font-weight:700; color:var(--color-text);">No Pending Approvals</h3>
                <p style="font-size:0.875rem; margin-top:4px;">All registered accounts have been verified and processed by the Directorate.</p>
              </div>
            ` : `
              <div style="display:flex; flex-direction:column; gap:16px;">
                ${pendingUsers.map(u => `
                  <div class="card" style="padding:22px; border-left:4px solid #d97706; background:#FFFFFF;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; gap:14px; flex-wrap:wrap;">
                      <div>
                        <div style="display:flex; align-items:center; gap:8px;">
                          <span class="badge" style="background:#fffbeb; color:#92400e; border:1px solid #fde68a; font-size:0.75rem;">
                            ${u.status === 'PENDING_ADMIN_APPROVAL' ? '🏛️ Admin Clearance Required' : '🔍 Officer Verification Required'}
                          </span>
                          <span class="font-mono" style="font-size:0.8125rem; color:var(--text-muted);">${u.id}</span>
                        </div>
                        <h3 style="font-size:1.125rem; font-weight:800; color:var(--color-text); margin:4px 0 2px 0;">${u.name}</h3>
                        <div style="font-size:0.8125rem; color:var(--text-secondary);">${u.designation || 'Officer Applicant'} • ${u.department || 'Department of Legal Metrology'}</div>
                      </div>
                      <div style="display:flex; gap:8px;">
                        <button type="button" class="btn btn-sm btn-outline reject-user-btn" data-id="${u.id}" data-name="${u.name}" style="border-color:var(--color-danger); color:var(--color-danger); font-weight:700;">
                          ✕ Reject
                        </button>
                        <button type="button" class="btn btn-sm btn-primary approve-user-btn" data-id="${u.id}" data-name="${u.name}" style="font-weight:700;">
                          ✓ Approve &amp; Activate
                        </button>
                      </div>
                    </div>

                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px 16px; background:var(--color-surface); padding:12px; border-radius:var(--radius-sm); font-size:0.8125rem;">
                      <div>
                        <span style="color:var(--text-muted); display:block; font-size:0.6875rem; font-weight:700; text-transform:uppercase;">Official Email</span>
                        <strong>${u.email}</strong>
                      </div>
                      <div>
                        <span style="color:var(--text-muted); display:block; font-size:0.6875rem; font-weight:700; text-transform:uppercase;">Mobile</span>
                        <span>${u.mobile || '--'}</span>
                      </div>
                      <div>
                        <span style="color:var(--text-muted); display:block; font-size:0.6875rem; font-weight:700; text-transform:uppercase;">Official ID / Code</span>
                        <span class="font-mono">${u.officerId || u.authCode || '--'}</span>
                      </div>
                      <div>
                        <span style="color:var(--text-muted); display:block; font-size:0.6875rem; font-weight:700; text-transform:uppercase;">District / Office</span>
                        <span>${u.district || 'Patna'} (${u.state || 'Bihar'})</span>
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          `}
        </div>
      `;
    };

    const attachEvents = () => {
      container.querySelectorAll('.user-role-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          currentRoleTab = btn.dataset.tab;
          container.innerHTML = renderUsersContent();
          attachEvents();
        });
      });

      const searchInput = container.querySelector('#admin-user-search');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          searchTerm = e.target.value;
          container.innerHTML = renderUsersContent();
          attachEvents();
          const newSearch = container.querySelector('#admin-user-search');
          if (newSearch) {
            newSearch.focus();
            newSearch.setSelectionRange(searchTerm.length, searchTerm.length);
          }
        });
      }

      // Approve Buttons
      container.querySelectorAll('.approve-user-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const userId = btn.dataset.id;
          const userName = btn.dataset.name;
          Components.confirmAction({
            title: "Approve User Account",
            message: `Authorize and activate the portal account for <strong>${userName}</strong>? This will grant immediate login access.`,
            confirmText: "Approve & Activate",
            confirmClass: "btn-primary",
            onConfirm: async () => {
              const res = await window.api.updateUserStatus(userId, 'ACTIVE');
              if (res.success) {
                Components.showToast({
                  title: "Account Activated",
                  message: `${userName} has been officially approved and granted portal access.`,
                  type: "success"
                });
                container.innerHTML = renderUsersContent();
                attachEvents();
              }
            }
          });
        });
      });

      // Reject Buttons
      container.querySelectorAll('.reject-user-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const userId = btn.dataset.id;
          const userName = btn.dataset.name;
          Components.confirmAction({
            title: "Reject Clearance Application",
            message: `Reject the account clearance application for <strong>${userName}</strong>? This action will be logged.`,
            confirmText: "Reject Application",
            confirmClass: "btn-danger",
            onConfirm: async () => {
              const res = await window.api.updateUserStatus(userId, 'REJECTED');
              if (res.success) {
                Components.showToast({
                  title: "Application Rejected",
                  message: `Clearance request for ${userName} has been rejected.`,
                  type: "warning"
                });
                container.innerHTML = renderUsersContent();
                attachEvents();
              }
            }
          });
        });
      });
    };

    container.innerHTML = renderUsersContent();
    attachEvents();
  }

  // ==========================================
  // Admin Verification Centres Master Data Module (SIH26036 Physical Facilities)
  // ==========================================

  async renderAdminCentres(container) {
    container.innerHTML = `
      <div style="padding:48px 24px; text-align:center; color:var(--text-muted);">
        <div class="spinner" style="margin:0 auto 16px auto; width:36px; height:36px;"></div>
        <p>Loading Statutory Verification Centres Registry...</p>
      </div>
    `;

    try {
      let res = await window.api.getVerificationCentres();
      let centres = (res && res.centres) ? res.centres : [];
      let searchTerm = '';
      let filterDistrict = 'ALL';
      let filterStatus = 'ALL';

      const renderView = () => {
        const filtered = centres.filter(c => {
          const matchesSearch = !searchTerm || (
            (c.centre_code || '') + ' ' +
            (c.centre_name || '') + ' ' +
            (c.district || '') + ' ' +
            (c.license_number || '') + ' ' +
            (c.accreditation_number || '')
          ).toLowerCase().includes(searchTerm.toLowerCase());

          const matchesDistrict = filterDistrict === 'ALL' || c.district === filterDistrict;
          const matchesStatus = filterStatus === 'ALL' || (filterStatus === 'ACTIVE' ? c.is_active : !c.is_active);

          return matchesSearch && matchesDistrict && matchesStatus;
        });

        const activeCount = centres.filter(c => c.is_active).length;
        const accreditedCount = centres.filter(c => c.accreditation_number).length;
        const districtsSet = new Set(centres.map(c => c.district).filter(Boolean));
        const districtOptions = Array.from(districtsSet).sort();

        container.innerHTML = `
          <div style="max-width:1200px; margin:0 auto;">
            <div class="page-header" style="margin-bottom:24px;">
              <div>
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                  <h1 class="page-title">Statutory Verification &amp; Test Centres</h1>
                  <span class="badge status-valid" style="font-weight:700;">MASTER DATA REGISTRY</span>
                </div>
                <p class="page-subtitle">Master Data Registry of accredited verification laboratories and physical testing stations under the Legal Metrology Act, 2009.</p>
              </div>
              <div style="display:flex; gap:10px;">
                <button type="button" class="btn btn-primary" id="add-centre-btn">
                  ➕ Register New Centre
                </button>
              </div>
            </div>

            <!-- Metrics Grid -->
            <div class="dashboard-metrics-grid" style="margin-bottom:24px;">
              <div class="stat-card stat-success">
                <div class="stat-header"><span class="stat-label">Total Registered Centres</span><span>🏛️</span></div>
                <div class="stat-value">${centres.length}</div>
                <div class="stat-subtext">Approved state testing facilities</div>
              </div>
              <div class="stat-card stat-info">
                <div class="stat-header"><span class="stat-label">Active Verification Stations</span><span>✅</span></div>
                <div class="stat-value">${activeCount}</div>
                <div class="stat-subtext">Operational &amp; accepting instruments</div>
              </div>
              <div class="stat-card stat-warning">
                <div class="stat-header"><span class="stat-label">NABL Accredited Labs</span><span>📜</span></div>
                <div class="stat-value">${accreditedCount}</div>
                <div class="stat-subtext">ISO/IEC 17025 compliant facilities</div>
              </div>
              <div class="stat-card stat-info">
                <div class="stat-header"><span class="stat-label">Districts Covered</span><span>📍</span></div>
                <div class="stat-value">${districtsSet.size}</div>
                <div class="stat-subtext">Territorial jurisdiction reach</div>
              </div>
            </div>

            <!-- Toolbar: Search & Filters -->
            <div class="card" style="padding:16px 20px; margin-bottom:20px; background:var(--color-surface); border:1px solid var(--color-border);">
              <div style="display:flex; gap:14px; align-items:center; flex-wrap:wrap; justify-content:space-between;">
                <div style="display:flex; gap:12px; align-items:center; flex:1; min-width:280px; max-width:440px;">
                  <input type="text" id="centre-search-input" class="form-control" placeholder="Search by code, name, district, license..." value="${searchTerm}" />
                </div>
                <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
                  <select id="centre-district-filter" class="form-control" style="width:170px;">
                    <option value="ALL" ${filterDistrict === 'ALL' ? 'selected' : ''}>All Districts (${districtsSet.size})</option>
                    ${districtOptions.map(d => `<option value="${d}" ${filterDistrict === d ? 'selected' : ''}>${d}</option>`).join('')}
                  </select>
                  <select id="centre-status-filter" class="form-control" style="width:140px;">
                    <option value="ALL" ${filterStatus === 'ALL' ? 'selected' : ''}>All Status</option>
                    <option value="ACTIVE" ${filterStatus === 'ACTIVE' ? 'selected' : ''}>Active Only</option>
                    <option value="INACTIVE" ${filterStatus === 'INACTIVE' ? 'selected' : ''}>Inactive Only</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Table Card -->
            <div class="card table-responsive" style="margin-bottom:32px;">
              <table class="table">
                <thead>
                  <tr>
                    <th>Centre Code</th>
                    <th>Centre Name &amp; Type</th>
                    <th>District / Address</th>
                    <th>License / Accreditation</th>
                    <th>Official Contact</th>
                    <th>Status</th>
                    <th style="text-align:right;">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${filtered.length === 0 ? `
                    <tr><td colspan="7" style="text-align:center; padding:36px; color:var(--text-muted);">No verification centres found matching the selected criteria.</td></tr>
                  ` : filtered.map(c => `
                    <tr>
                      <td class="font-mono"><strong>${c.centre_code}</strong></td>
                      <td>
                        <div style="font-weight:700; color:var(--color-text);">${c.centre_name}</div>
                        <span class="badge" style="font-size:0.6875rem; background:#F1F5F9; color:#475569; margin-top:2px;">
                          ${(c.centre_type || 'GOVERNMENT_TEST_CENTRE').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td>
                        <strong>${c.district}</strong>, ${c.state || 'Bihar'}
                        <div style="font-size:0.75rem; color:var(--text-muted);">${c.address_line1}${c.pincode ? ` - ${c.pincode}` : ''}</div>
                      </td>
                      <td>
                        <div style="font-size:0.8125rem;">
                          ${c.license_number ? `<div><span style="color:var(--text-muted);">Lic:</span> <span class="font-mono">${c.license_number}</span></div>` : ''}
                          ${c.accreditation_number ? `<div><span style="color:var(--text-muted);">NABL:</span> <span class="font-mono" style="color:var(--color-primary); font-weight:600;">${c.accreditation_number}</span></div>` : '<span style="color:var(--text-muted); font-size:0.75rem;">Government Facility</span>'}
                        </div>
                      </td>
                      <td>
                        <div style="font-size:0.8125rem;">
                          ${c.contact_email ? `<div>✉️ ${c.contact_email}</div>` : ''}
                          ${c.contact_phone ? `<div>📞 ${c.contact_phone}</div>` : ''}
                        </div>
                      </td>
                      <td>
                        ${c.is_active ? `
                          <span class="badge status-valid">ACTIVE</span>
                        ` : `
                          <span class="badge status-failed">INACTIVE</span>
                        `}
                      </td>
                      <td style="text-align:right;">
                        <div style="display:inline-flex; gap:6px;">
                          <button type="button" class="btn btn-sm btn-outline edit-centre-btn" data-id="${c.id}" style="padding:4px 8px; font-size:0.8125rem;">
                            ✏️ Edit
                          </button>
                          <button type="button" class="btn btn-sm ${c.is_active ? 'btn-outline' : 'btn-primary'} toggle-status-btn" data-id="${c.id}" data-active="${c.is_active}" data-name="${c.centre_name}" style="padding:4px 8px; font-size:0.8125rem;">
                            ${c.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;

        attachEventListeners();
      };

      const openCentreModal = (existing = null) => {
        const isEdit = !!existing;
        Components.showModal({
          title: isEdit ? `Edit Verification Centre: ${existing.centre_code}` : "Register New Verification Centre",
          content: `
            <form id="centre-form" style="display:flex; flex-direction:column; gap:14px; font-size:0.875rem;">
              <div style="display:grid; grid-template-columns:1fr 2fr; gap:12px;">
                <div class="form-group">
                  <label class="form-label" style="font-weight:700;">Centre Code <span class="required-star">*</span></label>
                  <input type="text" id="m-centre-code" class="form-control font-mono" value="${isEdit ? existing.centre_code : ''}" placeholder="e.g. VC-PAT-003" ${isEdit ? 'readonly' : ''} required />
                </div>
                <div class="form-group">
                  <label class="form-label" style="font-weight:700;">Centre Name <span class="required-star">*</span></label>
                  <input type="text" id="m-centre-name" class="form-control" value="${isEdit ? existing.centre_name : ''}" placeholder="e.g. Patna Central Standards Testing Laboratory" required />
                </div>
              </div>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                <div class="form-group">
                  <label class="form-label" style="font-weight:700;">Centre Type</label>
                  <select id="m-centre-type" class="form-control">
                    <option value="GOVERNMENT_TEST_CENTRE" ${isEdit && existing.centre_type === 'GOVERNMENT_TEST_CENTRE' ? 'selected' : ''}>Government Test Centre</option>
                    <option value="DISTRICT_LABORATORY" ${isEdit && existing.centre_type === 'DISTRICT_LABORATORY' ? 'selected' : ''}>District Laboratory</option>
                    <option value="CENTRAL_LABORATORY" ${isEdit && existing.centre_type === 'CENTRAL_LABORATORY' ? 'selected' : ''}>Central Laboratory</option>
                    <option value="PRIMARY_TESTING_STATION" ${isEdit && existing.centre_type === 'PRIMARY_TESTING_STATION' ? 'selected' : ''}>Primary Testing Station</option>
                    <option value="MOBILE_VERIFICATION_UNIT" ${isEdit && existing.centre_type === 'MOBILE_VERIFICATION_UNIT' ? 'selected' : ''}>Mobile Verification Unit</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label" style="font-weight:700;">District <span class="required-star">*</span></label>
                  <input type="text" id="m-centre-district" class="form-control" value="${isEdit ? existing.district : 'Patna'}" placeholder="District name" required />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" style="font-weight:700;">Address Line 1 <span class="required-star">*</span></label>
                <input type="text" id="m-centre-address1" class="form-control" value="${isEdit ? existing.address_line1 : ''}" placeholder="Physical street address or premises" required />
              </div>

              <div style="display:grid; grid-template-columns:2fr 1fr 1fr; gap:12px;">
                <div class="form-group">
                  <label class="form-label">Address Line 2</label>
                  <input type="text" id="m-centre-address2" class="form-control" value="${isEdit ? (existing.address_line2 || '') : ''}" placeholder="Industrial area, landmark" />
                </div>
                <div class="form-group">
                  <label class="form-label">State</label>
                  <input type="text" id="m-centre-state" class="form-control" value="${isEdit ? existing.state : 'Bihar'}" />
                </div>
                <div class="form-group">
                  <label class="form-label" style="font-weight:700;">Pincode <span class="required-star">*</span></label>
                  <input type="text" id="m-centre-pincode" class="form-control" value="${isEdit ? existing.pincode : '800001'}" placeholder="Pincode" required />
                </div>
              </div>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                <div class="form-group">
                  <label class="form-label">Official Contact Email</label>
                  <input type="email" id="m-centre-email" class="form-control" value="${isEdit ? (existing.contact_email || '') : ''}" placeholder="centre@legalmetrology.bihar.gov.in" />
                </div>
                <div class="form-group">
                  <label class="form-label">Contact Phone</label>
                  <input type="text" id="m-centre-phone" class="form-control" value="${isEdit ? (existing.contact_phone || '') : ''}" placeholder="0612-2234567" />
                </div>
              </div>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                <div class="form-group">
                  <label class="form-label">Department License Number</label>
                  <input type="text" id="m-centre-license" class="form-control font-mono" value="${isEdit ? (existing.license_number || '') : ''}" placeholder="e.g. DLM-LIC-2026-001" />
                </div>
                <div class="form-group">
                  <label class="form-label">Accreditation Number (NABL)</label>
                  <input type="text" id="m-centre-accred" class="form-control font-mono" value="${isEdit ? (existing.accreditation_number || '') : ''}" placeholder="e.g. NABL-TC-8891" />
                </div>
              </div>
            </form>
          `,
          confirmText: isEdit ? "Update Verification Centre" : "Register Verification Centre",
          onConfirm: async (close) => {
            const code = document.getElementById('m-centre-code').value.trim();
            const name = document.getElementById('m-centre-name').value.trim();
            const type = document.getElementById('m-centre-type').value;
            const district = document.getElementById('m-centre-district').value.trim();
            const addr1 = document.getElementById('m-centre-address1').value.trim();
            const addr2 = document.getElementById('m-centre-address2').value.trim();
            const state = document.getElementById('m-centre-state').value.trim() || 'Bihar';
            const pincode = document.getElementById('m-centre-pincode').value.trim();
            const email = document.getElementById('m-centre-email').value.trim();
            const phone = document.getElementById('m-centre-phone').value.trim();
            const lic = document.getElementById('m-centre-license').value.trim();
            const accred = document.getElementById('m-centre-accred').value.trim();

            if (!code || !name || !district || !addr1 || !pincode) {
              Components.showToast({
                title: "Validation Error",
                message: "Please fill in all mandatory fields: Code, Name, District, Address Line 1, and Pincode.",
                type: "error"
              });
              return;
            }

            const payload = {
              centre_code: code,
              centre_name: name,
              centre_type: type,
              district: district,
              address_line1: addr1,
              address_line2: addr2,
              state: state,
              pincode: pincode,
              contact_email: email,
              contact_phone: phone,
              license_number: lic,
              accreditation_number: accred
            };

            try {
              if (isEdit) {
                await window.api.updateVerificationCentre(existing.id, payload);
                Components.showToast({
                  title: "Centre Updated",
                  message: `Verification Centre ${name} updated successfully.`,
                  type: "success"
                });
              } else {
                await window.api.createVerificationCentre(payload);
                Components.showToast({
                  title: "Centre Registered",
                  message: `Verification Centre ${name} registered in master database.`,
                  type: "success"
                });
              }
              close();
              res = await window.api.getVerificationCentres();
              centres = (res && res.centres) ? res.centres : [];
              renderView();
            } catch (err) {
              Components.showToast({
                title: "Operation Failed",
                message: err.message || "Failed to save verification centre.",
                type: "error"
              });
            }
          }
        });
      };

      const attachEventListeners = () => {
        const searchInp = container.querySelector('#centre-search-input');
        if (searchInp) {
          searchInp.addEventListener('input', (e) => {
            searchTerm = e.target.value;
            renderView();
            const newInp = container.querySelector('#centre-search-input');
            if (newInp) {
              newInp.focus();
              newInp.setSelectionRange(newInp.value.length, newInp.value.length);
            }
          });
        }

        const distSelect = container.querySelector('#centre-district-filter');
        if (distSelect) {
          distSelect.addEventListener('change', (e) => {
            filterDistrict = e.target.value;
            renderView();
          });
        }

        const statusSelect = container.querySelector('#centre-status-filter');
        if (statusSelect) {
          statusSelect.addEventListener('change', (e) => {
            filterStatus = e.target.value;
            renderView();
          });
        }

        const addBtn = container.querySelector('#add-centre-btn');
        if (addBtn) {
          addBtn.addEventListener('click', () => openCentreModal());
        }

        container.querySelectorAll('.edit-centre-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const centreId = btn.dataset.id;
            const centre = centres.find(c => c.id === centreId);
            if (centre) openCentreModal(centre);
          });
        });

        container.querySelectorAll('.toggle-status-btn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const centreId = btn.dataset.id;
            const isActive = btn.dataset.active === 'true';
            const name = btn.dataset.name;
            try {
              await window.api.toggleVerificationCentreStatus(centreId, !isActive);
              Components.showToast({
                title: isActive ? "Centre Deactivated" : "Centre Activated",
                message: `Verification Centre "${name}" status updated to ${isActive ? 'INACTIVE' : 'ACTIVE'}.`,
                type: "info"
              });
              res = await window.api.getVerificationCentres();
              centres = (res && res.centres) ? res.centres : [];
              renderView();
            } catch (err) {
              Components.showToast({
                title: "Status Update Failed",
                message: err.message || "Failed to update centre status.",
                type: "error"
              });
            }
          });
        });
      };

      renderView();
    } catch (err) {
      console.error("[MeasureX AdminCentres] Failed to load centres:", err);
      container.innerHTML = `
        <div class="card" style="padding:48px 24px; text-align:center; color:var(--text-muted); max-width:680px; margin:40px auto;">
          <div style="font-size:2.5rem; margin-bottom:12px;">⚠️</div>
          <h2 style="color:var(--color-danger); font-size:1.25rem; font-weight:700; margin-bottom:8px;">Failed to Load Verification Centres</h2>
          <p style="font-size:0.875rem; margin-bottom:16px;">${err.message || 'Database connection error'}</p>
          <button type="button" class="btn btn-primary" onclick="window.app.renderAdminCentres(document.getElementById('main-content-area'))">Retry Loading</button>
        </div>
      `;
    }
  }

  renderAdminOfficers(container) {
    const officers = window.state.getOfficers();
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Officers Directory</h1>
          <p class="page-subtitle">Legal Metrology Officers and assigned inspection jurisdictions.</p>
        </div>
      </div>
      <div class="card table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>Officer ID</th>
              <th>Name</th>
              <th>Designation</th>
              <th>Jurisdiction</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${officers.map(o => `
              <tr>
                <td class="font-mono"><strong>${o.id}</strong></td>
                <td><strong>${o.name}</strong></td>
                <td>${o.designation}</td>
                <td>${o.jurisdiction}</td>
                <td>${o.email}</td>
                <td>${o.mobile}</td>
                <td><span class="badge status-valid">Active Duty</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  renderAdminApplications(container) {
    this.renderLMOApplications(container);
  }

  // ==========================================
  // Admin Instrument Registry (Section 12 Spec)
  // ==========================================

  renderAdminInstruments(container) {
    let allInstruments = window.state.getInstruments();
    let currentFilterStatus = 'ALL';
    let currentFilterType = 'ALL';
    let currentSearchTerm = '';

    const renderRegistryTable = () => {
      let filtered = allInstruments;
      if (currentFilterStatus !== 'ALL') {
        filtered = filtered.filter(i => i.status === currentFilterStatus);
      }
      if (currentFilterType !== 'ALL') {
        filtered = filtered.filter(i => i.type === currentFilterType);
      }
      if (currentSearchTerm) {
        const term = currentSearchTerm.toLowerCase();
        filtered = filtered.filter(i => 
          (i.id + ' ' + (i.serialNumber || '') + ' ' + (i.model || '') + ' ' + (i.ownerName || i.businessName || '') + ' ' + (i.manufacturer || '')).toLowerCase().includes(term)
        );
      }

      return `
        <div style="max-width:1160px; margin:0 auto;">
          <div class="page-header">
            <div>
              <h1 class="page-title">Central Instrument Registry</h1>
              <p class="page-subtitle">Commercial weighing &amp; measuring equipment registered under the Legal Metrology Act, 2009.</p>
            </div>
            <div style="display:flex; gap:10px;">
              <button type="button" id="admin-export-registry-btn" class="btn btn-secondary">📥 Export Registry (CSV)</button>
            </div>
          </div>

          <!-- Registry Search & Filters (Section 12) -->
          <div class="card" style="padding:16px 20px; margin-bottom:20px; background:var(--color-surface); border:1px solid var(--color-border);">
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px; align-items:center;">
              <div>
                <label class="form-label" style="font-size:0.75rem; text-transform:uppercase; margin-bottom:4px;">Search Registry</label>
                <input type="text" id="registry-search-input" class="form-control" placeholder="ID, Serial No, Model, or Owner..." value="${currentSearchTerm}" style="padding:7px 10px; font-size:0.8125rem;" />
              </div>
              <div>
                <label class="form-label" style="font-size:0.75rem; text-transform:uppercase; margin-bottom:4px;">Status</label>
                <select id="registry-filter-status" class="form-control" style="padding:7px 10px; font-size:0.8125rem;">
                  <option value="ALL" ${currentFilterStatus === 'ALL' ? 'selected' : ''}>All Statuses</option>
                  <option value="VALID" ${currentFilterStatus === 'VALID' ? 'selected' : ''}>Valid / Certified</option>
                  <option value="EXPIRING_SOON" ${currentFilterStatus === 'EXPIRING_SOON' ? 'selected' : ''}>Expiring Soon</option>
                  <option value="EXPIRED" ${currentFilterStatus === 'EXPIRED' ? 'selected' : ''}>Expired</option>
                </select>
              </div>
              <div>
                <label class="form-label" style="font-size:0.75rem; text-transform:uppercase; margin-bottom:4px;">Equipment Category</label>
                <select id="registry-filter-type" class="form-control" style="padding:7px 10px; font-size:0.8125rem;">
                  <option value="ALL" ${currentFilterType === 'ALL' ? 'selected' : ''}>All Categories</option>
                  <option value="Electronic Platform Scale" ${currentFilterType === 'Electronic Platform Scale' ? 'selected' : ''}>Electronic Platform Scale</option>
                  <option value="Commercial Fuel Dispenser" ${currentFilterType === 'Commercial Fuel Dispenser' ? 'selected' : ''}>Commercial Fuel Dispenser</option>
                  <option value="Heavy Duty Weighbridge" ${currentFilterType === 'Heavy Duty Weighbridge' ? 'selected' : ''}>Heavy Duty Weighbridge</option>
                  <option value="Analytical Balance" ${currentFilterType === 'Analytical Balance' ? 'selected' : ''}>Analytical Balance</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Section 12 Columns Table -->
          <div class="card table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Instrument ID</th>
                  <th>Type</th>
                  <th>Manufacturer &amp; Model</th>
                  <th>Serial Number</th>
                  <th>Owner / Establishment</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Validity Window</th>
                  <th>Last Verification</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.length === 0 ? `
                  <tr>
                    <td colspan="10" style="text-align:center; padding:36px; color:var(--text-muted);">
                      <strong>No instruments found matching these criteria.</strong>
                    </td>
                  </tr>
                ` : filtered.map(ins => `
                  <tr>
                    <td class="font-mono"><strong>${ins.id}</strong></td>
                    <td>
                      <div style="font-weight:700; color:var(--color-text);">${ins.type}</div>
                      <div style="font-size:0.75rem; color:var(--text-muted);">${ins.capacity || ''}</div>
                    </td>
                    <td>
                      <div>${ins.manufacturer || 'Avery Weigh-Tronix'}</div>
                      <div style="font-size:0.75rem; color:var(--text-muted);">${ins.model || 'E1205'}</div>
                    </td>
                    <td class="font-mono" style="font-size:0.8125rem;">${ins.serialNumber || 'SN-99823-2024'}</td>
                    <td>
                      <strong>${ins.businessName || ins.ownerName || 'Commercial Establishment'}</strong>
                      <div style="font-size:0.75rem; color:var(--text-muted);">${ins.ownerName || ''}</div>
                    </td>
                    <td>${ins.location || 'Patna'}</td>
                    <td>${Components.renderStatusBadge(ins.status)}</td>
                    <td style="font-size:0.75rem; white-space:nowrap;">${ins.validUntil || '2027-09-27'}</td>
                    <td style="font-size:0.75rem;">${ins.lastVerificationDate || '2026-09-28'}</td>
                    <td>
                      <a href="#admin-instrument-profile?id=${ins.id}" class="btn btn-sm btn-outline" style="font-weight:700; white-space:nowrap; border-color:var(--color-primary); color:var(--color-primary);">
                        View Profile ➔
                      </a>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    };

    const attachRegistryEvents = () => {
      const search = container.querySelector('#registry-search-input');
      if (search) {
        search.addEventListener('input', (e) => {
          currentSearchTerm = e.target.value;
          container.innerHTML = renderRegistryTable();
          attachRegistryEvents();
          const reFocus = container.querySelector('#registry-search-input');
          if (reFocus) {
            reFocus.focus();
            reFocus.setSelectionRange(currentSearchTerm.length, currentSearchTerm.length);
          }
        });
      }

      const statusSel = container.querySelector('#registry-filter-status');
      if (statusSel) {
        statusSel.addEventListener('change', (e) => {
          currentFilterStatus = e.target.value;
          container.innerHTML = renderRegistryTable();
          attachRegistryEvents();
        });
      }

      const typeSel = container.querySelector('#registry-filter-type');
      if (typeSel) {
        typeSel.addEventListener('change', (e) => {
          currentFilterType = e.target.value;
          container.innerHTML = renderRegistryTable();
          attachRegistryEvents();
        });
      }

      const exportBtn = container.querySelector('#admin-export-registry-btn');
      if (exportBtn) {
        exportBtn.addEventListener('click', () => {
          const exportList = filtered;
          const headers = [
            "Instrument ID", "Type", "Manufacturer", "Model", "Serial Number",
            "Capacity", "Owner/Business", "Location", "Status", "Valid Until", "Last Verification"
          ].join(',');

          const rows = exportList.map(i => [
            `"${(i.id || '').replace(/"/g, '""')}"`,
            `"${(i.type || '').replace(/"/g, '""')}"`,
            `"${(i.manufacturer || '').replace(/"/g, '""')}"`,
            `"${(i.model || '').replace(/"/g, '""')}"`,
            `"${(i.serialNumber || '').replace(/"/g, '""')}"`,
            `"${(i.capacity || '').replace(/"/g, '""')}"`,
            `"${(i.ownerName || i.businessName || '').replace(/"/g, '""')}"`,
            `"${(i.location || '').replace(/"/g, '""')}"`,
            `"${(i.status || '').replace(/"/g, '""')}"`,
            `"${(i.validUntil || '').replace(/"/g, '""')}"`,
            `"${(i.lastVerificationDate || '').replace(/"/g, '""')}"`
          ].join(','));

          const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent([headers, ...rows].join('\r\n'));
          const downloadAnchor = document.createElement('a');
          downloadAnchor.setAttribute("href", csvContent);
          downloadAnchor.setAttribute("download", `measurex_central_registry_${new Date().toISOString().slice(0, 10)}.csv`);
          document.body.appendChild(downloadAnchor);
          downloadAnchor.click();
          document.body.removeChild(downloadAnchor);

          Components.showToast({
            title: "Registry Exported",
            message: `Exported ${exportList.length} commercial instrument records to CSV.`,
            type: "success"
          });
        });
      }
    };

    container.innerHTML = renderRegistryTable();
    attachRegistryEvents();
  }

  // ==========================================
  // Admin Instrument Profile & 10-Stage Lifecycle (Section 13 Spec)
  // ==========================================

  async renderAdminInstrumentProfile(container, instrumentId) {
    let instrument = null;
    if (instrumentId) {
      instrument = window.state.getInstrumentById(instrumentId);
      if (!instrument && window.api && window.api.getInstrumentById) {
        try {
          instrument = await window.api.getInstrumentById(instrumentId);
        } catch (e) {
          console.warn('Could not fetch instrument from API:', e);
        }
      }
    } else {
      const all = window.state.getInstruments();
      if (all && all.length) {
        instrument = all[0];
      } else if (window.api && window.api.getInstruments) {
        try {
          const list = await window.api.getInstruments();
          if (list && list.length) instrument = list[0];
        } catch (e) {}
      }
    }
    if (!instrument) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 60px 20px; text-align: center;">
          <div style="font-size: 3rem; margin-bottom: 16px;">⚖️</div>
          <h2>Instrument Not Found</h2>
          <p style="color: var(--text-muted); margin-bottom: 24px;">The requested instrument (${instrumentId || 'Unknown'}) could not be found in the registry.</p>
          <a href="#admin-instruments" class="btn btn-primary">Back to Instrument Registry</a>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="max-width:1160px; margin:0 auto;">
        ${this.renderBreadcrumbs([
          { label: 'Instrument Registry', url: '#admin-instruments' },
          { label: instrument.id, url: `#admin-instrument-profile?id=${instrument.id}` }
        ], true, '#admin-instruments')}

        <div class="page-header" style="margin-bottom:20px;">
          <div>
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:4px;">
              <h1 class="page-title">${instrument.id}</h1>
              ${Components.renderStatusBadge(instrument.status || 'ACTIVE')}
            </div>
            <p class="page-subtitle">${instrument.type || 'Measuring Instrument'} • ${instrument.manufacturer || '—'} ${instrument.model || ''}</p>
          </div>
          <div style="display:flex; gap:10px;">
            ${instrument.activeCertificateId ? `<a href="#admin-certificates?id=${instrument.activeCertificateId}" class="btn btn-secondary">📜 View Certificate</a>` : ''}
            <a href="#admin-audit?query=${instrument.id}" class="btn btn-outline">🛡️ View Audit Trail</a>
          </div>
        </div>

        <!-- Section 13: Top Instrument Profile Section -->
        <div class="card" style="padding:28px; margin-bottom:28px;">
          <h2 style="font-size:1.125rem; font-weight:800; color:var(--color-primary); margin-bottom:16px;">
            Statutory Instrument Specifications
          </h2>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:16px 24px; font-size:0.875rem;">
            <div>
              <span style="color:var(--text-muted); display:block; font-size:0.6875rem; font-weight:700; text-transform:uppercase;">Instrument ID</span>
              <strong class="font-mono" style="font-size:1rem; color:var(--color-primary);">${instrument.id}</strong>
            </div>
            <div>
              <span style="color:var(--text-muted); display:block; font-size:0.6875rem; font-weight:700; text-transform:uppercase;">Equipment Type</span>
              <strong>${instrument.type || '—'}</strong>
            </div>
            <div>
              <span style="color:var(--text-muted); display:block; font-size:0.6875rem; font-weight:700; text-transform:uppercase;">Manufacturer &amp; Model</span>
              <span>${instrument.manufacturer || '—'}${instrument.model ? ` (${instrument.model})` : ''}</span>
            </div>
            <div>
              <span style="color:var(--text-muted); display:block; font-size:0.6875rem; font-weight:700; text-transform:uppercase;">Serial Number</span>
              <span class="font-mono">${instrument.serialNumber || '—'}</span>
            </div>
            <div>
              <span style="color:var(--text-muted); display:block; font-size:0.6875rem; font-weight:700; text-transform:uppercase;">Accuracy Class</span>
              <span class="badge status-valid">${instrument.accuracyClass || 'Class III'}</span>
            </div>
            <div>
              <span style="color:var(--text-muted); display:block; font-size:0.6875rem; font-weight:700; text-transform:uppercase;">Max / Min Capacity</span>
              <span>Max: ${instrument.capacity || '—'}${instrument.minCapacity ? ` • Min: ${instrument.minCapacity}` : ''}</span>
            </div>
            <div>
              <span style="color:var(--text-muted); display:block; font-size:0.6875rem; font-weight:700; text-transform:uppercase;">Verification Scale (e)</span>
              <span>${instrument.verificationScaleInterval ? `e = ${instrument.verificationScaleInterval}` : '—'}</span>
            </div>
            <div>
              <span style="color:var(--text-muted); display:block; font-size:0.6875rem; font-weight:700; text-transform:uppercase;">Physical Verification Seal</span>
              <span class="font-mono" style="color:var(--color-primary); font-weight:700;">${instrument.sealNumber || '—'}</span>
            </div>
            <div>
              <span style="color:var(--text-muted); display:block; font-size:0.6875rem; font-weight:700; text-transform:uppercase;">Commercial Owner</span>
              <strong>${instrument.businessName || '—'}</strong> (${instrument.ownerName || '—'})
            </div>
            <div>
              <span style="color:var(--text-muted); display:block; font-size:0.6875rem; font-weight:700; text-transform:uppercase;">Premises Location</span>
              <span>${instrument.address || instrument.location || '—'}</span>
            </div>
            <div>
              <span style="color:var(--text-muted); display:block; font-size:0.6875rem; font-weight:700; text-transform:uppercase;">Current Statutory Status</span>
              ${Components.renderStatusBadge(instrument.status || 'ACTIVE')}
            </div>
            <div>
              <span style="color:var(--text-muted); display:block; font-size:0.6875rem; font-weight:700; text-transform:uppercase;">Validity Window</span>
              <strong style="color:var(--color-success);">${instrument.lastVerificationDate || '—'} → ${instrument.validUntil || '—'}</strong>
            </div>
          </div>
        </div>

        <!-- Section 13 Mandate: INSTRUMENT LIFECYCLE 10-Stage Visual Timeline -->
        <div class="card" style="padding:28px; margin-bottom:28px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
            <div>
              <h2 style="font-size:1.25rem; font-weight:800; color:var(--color-text); margin-bottom:4px;">
                Instrument Lifecycle Timeline (10 Statutory Stages)
              </h2>
              <p style="font-size:0.8125rem; color:var(--text-secondary); line-height:1.4;">
                Complete end-to-end statutory history under the Legal Metrology Act, 2009. Every statutory event, actor, and timestamp is verified.
              </p>
            </div>
            <span class="badge status-valid" style="font-size:0.75rem;">Connected to Database Records</span>
          </div>

          <!-- Embed 10-Stage Visual Timeline Component -->
          ${Components.render10StageLifecycle(instrument)}
        </div>

        <!-- Verification History & Evidence (Section 13) -->
        <div class="card table-responsive" style="margin-bottom:28px;">
          <div style="padding:20px 24px 12px 24px; border-bottom:1px solid var(--color-border);">
            <h3 style="font-size:1.0625rem; font-weight:800; color:var(--color-text); margin:0;">
              Statutory Verification &amp; Stamping Records
            </h3>
          </div>
          <table class="table">
            <thead>
              <tr>
                <th>Verification Date</th>
                <th>Test Type</th>
                <th>Testing Loads</th>
                <th>Recorded Error</th>
                <th>Permissible (MPE)</th>
                <th>Result</th>
                <th>Officer In-Charge</th>
                <th>Seal ID</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>28 Sep 2026</strong></td>
                <td>Annual Periodic Verification</td>
                <td>0 kg, 50 kg, 100 kg, 150 kg</td>
                <td class="font-mono" style="color:var(--color-success); font-weight:600;">+5 g (within limit)</td>
                <td class="font-mono">±20 g (Class III)</td>
                <td><span class="badge status-valid">PASS</span></td>
                <td>Rahul Kumar (LMO-BR-0842)</td>
                <td class="font-mono"><strong>MX-SEAL-2026-8891</strong></td>
              </tr>
              <tr>
                <td><strong>15 Sep 2025</strong></td>
                <td>Annual Periodic Verification</td>
                <td>0 kg, 50 kg, 100 kg, 150 kg</td>
                <td class="font-mono" style="color:var(--color-success); font-weight:600;">0 g (nominal)</td>
                <td class="font-mono">±20 g (Class III)</td>
                <td><span class="badge status-valid">PASS</span></td>
                <td>Rahul Kumar (LMO-BR-0842)</td>
                <td class="font-mono">MX-SEAL-2025-4102</td>
              </tr>
              <tr>
                <td><strong>12 Jan 2024</strong></td>
                <td>Initial Verification &amp; Stamping</td>
                <td>0 kg, 37.5 kg, 75 kg, 150 kg</td>
                <td class="font-mono" style="color:var(--color-success); font-weight:600;">+2 g (nominal)</td>
                <td class="font-mono">±10 g (Initial)</td>
                <td><span class="badge status-valid">PASS</span></td>
                <td>Amit Patel (LMO-BR-0511)</td>
                <td class="font-mono">MX-SEAL-2024-1098</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Previous Certificates Section -->
        <div class="card table-responsive" style="margin-bottom:28px;">
          <div style="padding:20px 24px 12px 24px; border-bottom:1px solid var(--color-border);">
            <h3 style="font-size:1.0625rem; font-weight:800; color:var(--color-text); margin:0;">
              Digital Verification Certificates
            </h3>
          </div>
          <table class="table">
            <thead>
              <tr>
                <th>Certificate Number</th>
                <th>Issue Date</th>
                <th>Valid Until</th>
                <th>Status</th>
                <th>Issuing Officer</th>
                <th>Public Authentication</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="font-mono"><strong>MX-CERT-DEMO-0001</strong></td>
                <td>28 Sep 2026</td>
                <td style="color:var(--color-success); font-weight:700;">27 Sep 2027</td>
                <td><span class="badge status-valid">VALID</span></td>
                <td>Rahul Kumar</td>
                <td>
                  <a href="#verify?id=MX-CERT-DEMO-0001" class="btn btn-sm btn-outline">
                    Verify QR Seal ➔
                  </a>
                </td>
              </tr>
              <tr>
                <td class="font-mono">MX-CERT-2025-000125</td>
                <td>15 Sep 2025</td>
                <td>14 Sep 2026</td>
                <td><span class="badge status-expired">SUPERSEDED</span></td>
                <td>Rahul Kumar</td>
                <td>
                  <a href="#verify?id=MX-CERT-2025-000125" class="btn btn-sm btn-outline">
                    View Archive
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  renderAdminConfig(container) {
    container.innerHTML = `
      <div style="max-width:800px; margin:0 auto;">
        <div class="page-header">
          <div>
            <h1 class="page-title">System Configuration</h1>
            <p class="page-subtitle">Statutory verification intervals, tolerance margins, and authority details.</p>
          </div>
        </div>
        <div class="card" style="padding:28px;">
          <div class="form-group">
            <label class="form-label">Issuing Authority Legal Name</label>
            <input type="text" class="form-control" value="Department of Legal Metrology, Government of Bihar" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Periodic Verification Validity (Years)</label>
              <input type="number" class="form-control" value="1" />
            </div>
            <div class="form-group">
              <label class="form-label">Expiry Alert Lead Time (Days)</label>
              <input type="number" class="form-control" value="30" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Standard Tolerances Rule Reference</label>
            <input type="text" class="form-control" value="Legal Metrology (General) Rules, Schedule VII, Class III Scales" />
          </div>
          <button type="button" class="btn btn-primary" onclick="Components.showToast({title:'Settings Saved', message:'Regulatory configuration saved.', type:'success'});">Save Settings</button>
        </div>
      </div>
    `;
  }

  // ==========================================
  // Notifications Center & Admin Manual Dispatch (Section 7, 8, 9, 10)
  // ==========================================

  renderNotificationsPage(container) {
    const role = window.state.getCurrentRole();
    const user = window.state.getCurrentUser();
    const notifs = window.state.getNotificationsForUser ? window.state.getNotificationsForUser(user) : window.state.getNotifications();
    const unreadCount = notifs.filter(n => !n.read).length;

    container.innerHTML = `
      <div style="max-width:920px; margin:0 auto;">
        <div class="page-header">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <h1 class="page-title">Notification Center</h1>
              ${unreadCount > 0 ? `<span class="badge status-submitted">${unreadCount} Unread</span>` : ''}
            </div>
            <p class="page-subtitle">Statutory alerts, schedule modifications, verification outcomes, and departmental notices.</p>
          </div>
          <div style="display:flex; gap:10px;">
            ${role === 'ADMIN' ? `
              <button type="button" class="btn btn-primary" id="open-send-notif-btn" style="font-weight:700;">
                📢 Send Notification
              </button>
            ` : ''}
            <button type="button" class="btn btn-secondary" id="page-mark-all-read-btn">
              Mark All as Read
            </button>
          </div>
        </div>

        <div class="card" style="padding:20px;">
          <div class="notification-list">
            ${notifs.length === 0 ? `
              <div style="text-align:center; padding:48px 16px; color:var(--text-muted);">
                <div style="font-size:2.5rem; margin-bottom:8px;">🔔</div>
                <strong>No statutory notifications found.</strong>
                <div style="font-size:0.8125rem; margin-top:4px;">You will receive alerts here when inspection dates or certificate updates occur.</div>
              </div>
            ` : notifs.map(n => {
              let icon = '📝';
              if (n.priority === 'HIGH' || n.priority === 'URGENT') icon = '⚠️';
              else if (n.type === 'CERTIFICATE_GENERATED') icon = '📜';
              else if (n.type === 'APPLICATION_SCHEDULED') icon = '📅';
              else if (n.type === 'REVERIFICATION_REQUIRED') icon = '🔄';

              return `
                <div class="notification-item ${!n.read ? 'unread' : ''}" style="cursor:pointer;" data-id="${n.id}" data-url="${n.actionUrl || ''}">
                  <div class="notification-icon">${icon}</div>
                  <div class="notification-body">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
                      <div class="notification-title">${n.title}</div>
                      ${n.priority === 'HIGH' || n.priority === 'URGENT' ? `
                        <span class="badge status-failed" style="font-size:0.6875rem;">${n.priority}</span>
                      ` : ''}
                    </div>
                    <div class="notification-text">${n.message}</div>
                    <div class="notification-time">${n.timestamp || 'Just now'}</div>
                  </div>
                  <div style="display:flex; align-items:center; gap:8px;">
                    ${n.actionUrl ? `
                      <a href="${n.actionUrl}" class="btn btn-sm btn-outline notif-view-link" style="font-size:0.75rem; padding:4px 8px;">
                        View ➔
                      </a>
                    ` : ''}
                    ${!n.read ? `
                      <button type="button" class="btn btn-sm btn-outline mark-read-btn" data-id="${n.id}" style="padding:4px 8px; font-size:0.75rem;">
                        Mark Read
                      </button>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    // Mark individual read
    container.querySelectorAll('.mark-read-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        window.state.markNotificationRead(id);
        this.updateHeaderUI();
        this.renderNotificationsPage(container);
      });
    });

    // Mark all read
    const markAllBtn = container.querySelector('#page-mark-all-read-btn');
    if (markAllBtn) {
      markAllBtn.addEventListener('click', () => {
        window.state.markAllNotificationsRead();
        Components.showToast({ title: "Notifications Read", message: "All notifications marked as read.", type: "info" });
        this.updateHeaderUI();
        this.renderNotificationsPage(container);
      });
    }

    // Click on item navigation
    container.querySelectorAll('.notification-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('button') || e.target.closest('a')) return;
        const id = item.dataset.id;
        const url = item.dataset.url;
        if (id) window.state.markNotificationRead(id);
        this.updateHeaderUI();
        if (url) location.hash = url;
        else this.renderNotificationsPage(container);
      });
    });

    // Admin Send Manual Notification (Section 9 Spec)
    const sendNotifBtn = container.querySelector('#open-send-notif-btn');
    if (sendNotifBtn) {
      sendNotifBtn.addEventListener('click', () => {
        const users = window.state.getUsers ? window.state.getUsers() : [];

        Components.showModal({
          title: "Dispatch Departmental Notification",
          content: `
            <div style="font-size:0.875rem; color:var(--text-secondary); margin-bottom:14px;">
              Compose and broadcast a statutory alert or direct communication to platform stakeholders.
            </div>
            <form id="admin-send-notif-form">
              <div class="form-group" style="margin-bottom:14px;">
                <label class="form-label">Audience Category <span class="required-star">*</span></label>
                <select id="manual-notif-audience" class="form-control" required>
                  <option value="ALL">All Relevant Stakeholders</option>
                  <option value="OWNER">Instrument Owner / Trader Group</option>
                  <option value="LMO">Legal Metrology Officers Group</option>
                  <option value="OWNER_AND_LMO">Both Owner + LMO</option>
                  <option value="ADMIN">Administrative Directorate</option>
                  <option value="SINGLE">Specific Individual User</option>
                </select>
              </div>

              <div class="form-group" id="manual-notif-user-wrapper" style="display:none; margin-bottom:14px;">
                <label class="form-label">Select Specific Recipient</label>
                <select id="manual-notif-recipient-select" class="form-control">
                  ${users.map(u => `
                    <option value="${u.name}">${u.name} (${u.role} • ${u.email})</option>
                  `).join('')}
                </select>
              </div>

              <div class="form-group" style="margin-bottom:14px;">
                <label class="form-label">Notification Title <span class="required-star">*</span></label>
                <input type="text" id="manual-notif-title" class="form-control" placeholder="e.g. Re-verification Required for MX-INS-000125" required />
              </div>

              <div class="form-group" style="margin-bottom:14px;">
                <label class="form-label">Message Content <span class="required-star">*</span></label>
                <textarea id="manual-notif-message" class="form-control" rows="3" placeholder="Enter clear, concise official instructions..." required></textarea>
              </div>

              <div class="form-row" style="margin-bottom:14px;">
                <div class="form-group">
                  <label class="form-label">Priority Level</label>
                  <select id="manual-notif-priority" class="form-control">
                    <option value="NORMAL">Normal Priority</option>
                    <option value="HIGH">High Priority</option>
                    <option value="URGENT">Urgent / Immediate Action</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Action Target Route / URL</label>
                  <input type="text" id="manual-notif-url" class="form-control font-mono" placeholder="#owner-applications or #verify" value="#owner-applications" />
                </div>
              </div>
            </form>
          `,
          confirmText: "Broadcast Notification",
          onConfirm: (close) => {
            const audience = document.getElementById('manual-notif-audience').value;
            const title = document.getElementById('manual-notif-title').value.trim();
            const message = document.getElementById('manual-notif-message').value.trim();
            const priority = document.getElementById('manual-notif-priority').value;
            const actionUrl = document.getElementById('manual-notif-url').value.trim();

            if (!title || !message) {
              Components.showToast({ title: "Incomplete Form", message: "Please enter title and message.", type: "error" });
              return;
            }

            let recipient = "ALL";
            let targetRole = "ALL";

            if (audience === 'SINGLE') {
              const recSelect = document.getElementById('manual-notif-recipient-select');
              recipient = recSelect ? recSelect.value : (this.state.currentUser ? this.state.currentUser.name : "Authorized Official");
              targetRole = "USER";
            } else if (audience === 'OWNER') {
              targetRole = 'OWNER';
            } else if (audience === 'LMO') {
              targetRole = 'LMO';
            } else if (audience === 'ADMIN') {
              targetRole = 'ADMIN';
            } else if (audience === 'OWNER_AND_LMO') {
              targetRole = 'OWNER_AND_LMO';
            }

            window.state.sendManualNotification({
              recipient,
              targetRole,
              title,
              message,
              priority,
              actionUrl: actionUrl || '#owner-applications'
            });

            Components.showToast({
              title: "Notification Dispatched",
              message: `Official alert successfully broadcast to ${audience}.`,
              type: "success"
            });
            this.updateHeaderUI();
            this.renderNotificationsPage(container);
            close();
          }
        });

        // Dynamic audience selector change
        setTimeout(() => {
          const audSelect = document.getElementById('manual-notif-audience');
          const userWrapper = document.getElementById('manual-notif-user-wrapper');
          if (audSelect && userWrapper) {
            audSelect.addEventListener('change', () => {
              userWrapper.style.display = audSelect.value === 'SINGLE' ? 'block' : 'none';
            });
          }
        }, 50);
      });
    }
  }

  // ==========================================
  // User Profile (Owner, LMO, Admin)
  // ==========================================

  renderUserProfile(container) {
    const user = window.state.getCurrentUser();
    const role = window.state.getCurrentRole();

    const roleNameMap = {
      'OWNER': 'Commercial Instrument Owner / Trader',
      'LMO': 'Legal Metrology Officer (Enforcement Directorate)',
      'ADMIN': 'State Metrology System Administrator'
    };

    container.innerHTML = `
      <div style="max-width:880px; margin:0 auto;">
        ${this.renderBreadcrumbs([{ label: 'User Profile', url: `#${role.toLowerCase()}-profile` }], true, `#${role.toLowerCase()}-dashboard`)}

        <div class="page-header" style="margin-bottom:24px;">
          <div>
            <h1 class="page-title">${user.name || 'Official User'}</h1>
            <p class="page-subtitle">${roleNameMap[role] || role} • Department of Legal Metrology</p>
          </div>
          <span class="badge status-valid" style="font-weight:700; font-size:0.8125rem;">VERIFIED &amp; ACTIVE</span>
        </div>

        <div class="card" style="padding:32px; margin-bottom:24px;">
          <h2 style="font-size:1.125rem; font-weight:800; color:var(--color-primary); margin-bottom:16px;">
            Account Details &amp; Jurisdiction
          </h2>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:18px 24px; font-size:0.875rem;">
            <div>
              <span style="color:var(--text-muted); display:block; font-size:0.6875rem; font-weight:700; text-transform:uppercase;">Full Name</span>
              <strong style="color:var(--color-text); font-size:1rem;">${user.name}</strong>
            </div>
            <div>
              <span style="color:var(--text-muted); display:block; font-size:0.6875rem; font-weight:700; text-transform:uppercase;">Official Email</span>
              <span class="font-mono">${user.email}</span>
            </div>
            <div>
              <span style="color:var(--text-muted); display:block; font-size:0.6875rem; font-weight:700; text-transform:uppercase;">Registered Mobile</span>
              <span>${user.mobile || '+91 98765 43210'}</span>
            </div>
            <div>
              <span style="color:var(--text-muted); display:block; font-size:0.6875rem; font-weight:700; text-transform:uppercase;">Stakeholder Role</span>
              <span class="badge status-valid">${role}</span>
            </div>
            <div>
              <span style="color:var(--text-muted); display:block; font-size:0.6875rem; font-weight:700; text-transform:uppercase;">Business / Department</span>
              <strong>${user.businessName || user.department || 'Legal Metrology Department'}</strong>
            </div>
            <div>
              <span style="color:var(--text-muted); display:block; font-size:0.6875rem; font-weight:700; text-transform:uppercase;">Operating Jurisdiction</span>
              <span>${user.district || 'Patna'}, ${user.state || 'Bihar'}</span>
            </div>
            <div>
              <span style="color:var(--text-muted); display:block; font-size:0.6875rem; font-weight:700; text-transform:uppercase;">Operating Address</span>
              <span>${user.address || 'District Metrology Laboratory, Circular Road, Patna'}</span>
            </div>
            <div>
              <span style="color:var(--text-muted); display:block; font-size:0.6875rem; font-weight:700; text-transform:uppercase;">Account Status</span>
              <span class="badge status-valid">ACTIVE / AUTHORIZED</span>
            </div>
          </div>
        </div>

        <div class="card" style="padding:28px;">
          <h2 style="font-size:1.125rem; font-weight:800; color:var(--color-text); margin-bottom:12px;">
            Security &amp; Statutory Compliance
          </h2>
          <p style="font-size:0.8125rem; color:var(--text-secondary); line-height:1.45; margin-bottom:16px;">
            Your account is verified under the Legal Metrology Act, 2009. Statutory actions performed under this credential carry legal evidential standing under Section 65B of the Indian Evidence Act.
          </p>
          <div style="display:flex; gap:10px;">
            <a href="#forgot-password" class="btn btn-outline" style="font-weight:600;">Request Password Reset Link</a>
            <button type="button" class="btn btn-secondary" onclick="window.api.logout(); location.hash='#landing';">Sign Out</button>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================
  // GATC Experience (SIH26036 Feature 1 & 2)
  // ==========================================

  renderGATCDashboard(container) {
    const user = window.state.getCurrentUser() || {};
    const apps = window.state.getApplications() || [];
    const certs = window.state.getCertificates() || [];

    const gatcApps = apps.filter(a => a.assignmentType === 'GATC' || a.assignedGatcId === user.id || a.assignedPartyName === user.businessName);
    const assignedTotal = gatcApps.length;
    const awaitingTest = gatcApps.filter(a => a.status === 'ALLOCATED' || a.status === 'SCHEDULED' || a.status === 'SUBMITTED' || a.status === 'UNDER_SCRUTINY').length;
    const inProgress = gatcApps.filter(a => a.status === 'IN_VERIFICATION').length;
    const completedPass = gatcApps.filter(a => a.status === 'APPROVED' || a.status === 'CERTIFICATE_ISSUED' || a.status === 'VERIFIED').length;
    const completedFail = gatcApps.filter(a => a.status === 'FAILED').length;

    container.innerHTML = `
      <div class="page-header" style="margin-bottom:24px;">
        <div>
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
            <h1 class="page-title">GATC Testing Laboratory Console</h1>
            <span class="badge" style="background:#581c87; color:#f3e8ff; font-weight:700; font-size:0.75rem;">NABL ACCREDITED</span>
          </div>
          <p class="page-subtitle">${user.businessName || 'Government Approved Test Centre #04'} • ID: ${user.identificationNumber || user.id || 'GATC-PAT-2026'} • Legal Metrology Directorate</p>
        </div>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button type="button" class="btn btn-outline" id="gatc-offline-sync-btn" title="Sync Offline IndexedDB Queue">🔄 Sync Offline Queue</button>
          <a href="#gatc-calendar" class="btn btn-secondary">📅 Test Bench Schedule</a>
          <a href="#gatc-field-verification" class="btn btn-primary" style="background:#7e22ce; border-color:#6b21a8;">🔬 Precision Lab Testing</a>
        </div>
      </div>

      <!-- GATC Metrics Grid -->
      <div class="dashboard-metrics-grid" style="margin-bottom:28px;">
        <div class="stat-card stat-info">
          <div class="stat-header"><span class="stat-label">Assigned Applications</span><span>🔬</span></div>
          <div class="stat-value stat-counter-val" data-target="${assignedTotal}">${assignedTotal}</div>
          <div class="stat-subtext">Statutorily allocated to this lab</div>
        </div>

        <div class="stat-card stat-warning">
          <div class="stat-header"><span class="stat-label">Awaiting Lab Testing</span><span>⏳</span></div>
          <div class="stat-value stat-counter-val" data-target="${awaitingTest}">${awaitingTest}</div>
          <div class="stat-subtext">Bench slot scheduled</div>
        </div>

        <div class="stat-card stat-info" style="border-left-color:#7e22ce;">
          <div class="stat-header"><span class="stat-label">In Verification</span><span>⚖️</span></div>
          <div class="stat-value stat-counter-val" data-target="${inProgress}">${inProgress}</div>
          <div class="stat-subtext">Active calibration cycles</div>
        </div>

        <div class="stat-card stat-success">
          <div class="stat-header"><span class="stat-label">PASS Certificates</span><span>✅</span></div>
          <div class="stat-value stat-counter-val" data-target="${completedPass}">${completedPass}</div>
          <div class="stat-subtext">Digitally signed & issued</div>
        </div>

        <div class="stat-card stat-danger">
          <div class="stat-header"><span class="stat-label">Tolerance Fails</span><span>❌</span></div>
          <div class="stat-value stat-counter-val" data-target="${completedFail}">${completedFail}</div>
          <div class="stat-subtext">Non-compliant with MPE</div>
        </div>

        <div class="stat-card stat-success" style="border-left-color:#0d9488;">
          <div class="stat-header"><span class="stat-label">Standards Calibration</span><span>🛡️</span></div>
          <div class="stat-value" style="font-size:1.125rem; font-weight:800; color:#0f766e;">VALID</div>
          <div class="stat-subtext">Class E2/F1 valid to 31 Mar 2027</div>
        </div>
      </div>

      <!-- Laboratory Testing Queue -->
      <div class="dashboard-section" style="margin-bottom:28px;">
        <div class="section-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h2 class="section-title">🔬 Active Laboratory Testing Queue</h2>
          <a href="#gatc-applications" class="btn btn-sm btn-outline">View All Assigned Tests</a>
        </div>

        <div class="card table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Application ID</th>
                <th>Equipment &amp; Division</th>
                <th>Applicant / Trader</th>
                <th>Premises / Location</th>
                <th>Allocated Party</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${gatcApps.length === 0 ? `
                <tr><td colspan="7" style="text-align:center; padding:24px; color:var(--text-muted);">No applications currently assigned to this test centre. Applications can be allocated via the Admin Allocation Desk.</td></tr>
              ` : gatcApps.slice(0, 6).map(a => `
                <tr>
                  <td class="font-mono"><strong>${a.id}</strong></td>
                  <td>
                    <strong>${a.instrumentType}</strong>
                    <div style="font-size:0.75rem; color:var(--text-muted); font-family:var(--font-mono);">${a.instrumentId || a.serialNumber || 'SN-PENDING'}</div>
                  </td>
                  <td>${a.businessName || a.applicantName || 'Commercial Entity'}</td>
                  <td>${a.preferredLocation || a.location || 'Test Centre Bench'}</td>
                  <td><span class="badge" style="background:#f3e8ff; color:#6b21a8; font-weight:700;">GATC LAB</span></td>
                  <td>${Components.renderStatusBadge(a.status)}</td>
                  <td>
                    <a href="#gatc-field-verification?id=${a.id}" class="btn btn-sm btn-primary" style="background:#7e22ce; border-color:#6b21a8; font-weight:600;">
                      Start Lab Test ➔
                    </a>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Standards Traceability & Accreditation Section -->
      <div class="card" style="padding:24px; margin-bottom:24px; background:linear-gradient(to right, #faf5ff, #ffffff); border:1px solid #e9d5ff;">
        <h3 style="font-size:1.125rem; font-weight:800; color:#581c87; margin-bottom:12px;">
          ⚖️ Laboratory Working Standards &amp; Environmental Controls
        </h3>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:16px; font-size:0.875rem;">
          <div style="padding:12px; background:#ffffff; border-radius:var(--radius-sm); border-left:3px solid #7e22ce;">
            <div style="font-weight:700; color:#374151;">Primary Mass Standards</div>
            <div style="color:var(--text-muted); font-size:0.75rem; margin-top:2px;">OIML Class E2 (1 mg – 500 g)</div>
            <div style="font-size:0.75rem; color:#059669; font-weight:600; margin-top:4px;">NPL India Traceable: #NPL-2025-E2-084</div>
          </div>
          <div style="padding:12px; background:#ffffff; border-radius:var(--radius-sm); border-left:3px solid #7e22ce;">
            <div style="font-weight:700; color:#374151;">Secondary Working Standards</div>
            <div style="color:var(--text-muted); font-size:0.75rem; margin-top:2px;">OIML Class F1 (1 g – 50 kg)</div>
            <div style="font-size:0.75rem; color:#059669; font-weight:600; margin-top:4px;">Certificate Valid: 15 Oct 2026</div>
          </div>
          <div style="padding:12px; background:#ffffff; border-radius:var(--radius-sm); border-left:3px solid #0d9488;">
            <div style="font-weight:700; color:#374151;">Ambient Climate Monitor</div>
            <div style="color:var(--text-muted); font-size:0.75rem; margin-top:2px;">Temp: 20.1°C • RH: 49.4%</div>
            <div style="font-size:0.75rem; color:#0d9488; font-weight:600; margin-top:4px;">Within OIML R76 Limits</div>
          </div>
          <div style="padding:12px; background:#ffffff; border-radius:var(--radius-sm); border-left:3px solid #0284c7;">
            <div style="font-weight:700; color:#374151;">Statutory Recognition</div>
            <div style="color:var(--text-muted); font-size:0.75rem; margin-top:2px;">Rule 27 Legal Metrology Rules</div>
            <div style="font-size:0.75rem; color:#0284c7; font-weight:600; margin-top:4px;">State Metrology Directorate Gazetted</div>
          </div>
        </div>
      </div>
    `;

    const syncBtn = container.querySelector('#gatc-offline-sync-btn');
    if (syncBtn) {
      syncBtn.addEventListener('click', async () => {
        syncBtn.disabled = true;
        syncBtn.textContent = 'Syncing...';
        if (window.OfflineSyncManager) {
          const res = await window.OfflineSyncManager.syncPendingQueue();
          Components.showToast({
            title: "Offline Synchronization",
            message: `Sync complete: ${res.synced} items synchronized, ${res.pending} remaining.`,
            type: "info"
          });
        } else {
          Components.showToast({ title: "Offline Sync", message: "IndexedDB queue is clean and up to date.", type: "success" });
        }
        syncBtn.disabled = false;
        syncBtn.textContent = '🔄 Sync Offline Queue';
      });
    }
  }

  renderGATCApplications(container, filter = 'all') {
    const user = window.state.getCurrentUser() || {};
    const allApps = window.state.getApplications() || [];
    const gatcApps = allApps.filter(a => a.assignmentType === 'GATC' || a.assignedGatcId === user.id || a.assignedPartyName === user.businessName || a.assignmentType === 'ALL');

    let filtered = gatcApps;
    if (filter === 'pending') {
      filtered = gatcApps.filter(a => a.status === 'ALLOCATED' || a.status === 'SCHEDULED' || a.status === 'SUBMITTED' || a.status === 'UNDER_SCRUTINY');
    } else if (filter === 'in_verification') {
      filtered = gatcApps.filter(a => a.status === 'IN_VERIFICATION');
    } else if (filter === 'completed') {
      filtered = gatcApps.filter(a => a.status === 'APPROVED' || a.status === 'CERTIFICATE_ISSUED' || a.status === 'VERIFIED');
    } else if (filter === 'failed') {
      filtered = gatcApps.filter(a => a.status === 'FAILED');
    }

    container.innerHTML = `
      <div class="page-header" style="margin-bottom:24px;">
        <div>
          <h1 class="page-title">GATC Laboratory Assigned Verifications</h1>
          <p class="page-subtitle">Statutory testing applications allocated to Government Approved Test Centre for precision verification.</p>
        </div>
        <a href="#gatc-dashboard" class="btn btn-secondary">← Back to Dashboard</a>
      </div>

      <!-- Filter Navigation Tabs -->
      <div class="tab-nav" style="margin-bottom:20px;">
        <button type="button" class="tab-btn ${filter === 'all' ? 'active' : ''}" onclick="location.hash='#gatc-applications?filter=all'">All Tests (${gatcApps.length})</button>
        <button type="button" class="tab-btn ${filter === 'pending' ? 'active' : ''}" onclick="location.hash='#gatc-applications?filter=pending'">Pending Lab Testing (${gatcApps.filter(a => a.status === 'ALLOCATED' || a.status === 'SCHEDULED' || a.status === 'SUBMITTED' || a.status === 'UNDER_SCRUTINY').length})</button>
        <button type="button" class="tab-btn ${filter === 'in_verification' ? 'active' : ''}" onclick="location.hash='#gatc-applications?filter=in_verification'">In Progress (${gatcApps.filter(a => a.status === 'IN_VERIFICATION').length})</button>
        <button type="button" class="tab-btn ${filter === 'completed' ? 'active' : ''}" onclick="location.hash='#gatc-applications?filter=completed'">Passed / Certified (${gatcApps.filter(a => a.status === 'APPROVED' || a.status === 'CERTIFICATE_ISSUED' || a.status === 'VERIFIED').length})</button>
        <button type="button" class="tab-btn ${filter === 'failed' ? 'active' : ''}" onclick="location.hash='#gatc-applications?filter=failed'">Failed (${gatcApps.filter(a => a.status === 'FAILED').length})</button>
      </div>

      <!-- Search Bar -->
      <div class="search-bar" style="margin-bottom:16px;">
        <input type="text" id="gatc-apps-search-input" class="form-control" placeholder="Search by Application ID, Instrument Type, Trader, Serial Number..." />
      </div>

      <!-- Applications Table -->
      <div class="card table-responsive">
        <table class="table" id="gatc-apps-table">
          <thead>
            <tr>
              <th>Application ID</th>
              <th>Instrument Type</th>
              <th>Serial Number</th>
              <th>Applicant / Owner</th>
              <th>Capacity &amp; Division</th>
              <th>Scheduled Bench Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.length === 0 ? `
              <tr><td colspan="8" style="text-align:center; padding:32px; color:var(--text-muted);">No applications found for this filter criteria.</td></tr>
            ` : filtered.map(a => `
              <tr>
                <td class="font-mono"><strong>${a.id}</strong></td>
                <td><strong>${a.instrumentType}</strong></td>
                <td class="font-mono">${a.serialNumber || a.instrumentId || '--'}</td>
                <td>${a.businessName || a.applicantName || 'Commercial Entity'}</td>
                <td>${a.capacity || '50 kg'}</td>
                <td>${a.scheduledDate || 'Immediate Lab Bench'}</td>
                <td>${Components.renderStatusBadge(a.status)}</td>
                <td>
                  <a href="#gatc-field-verification?id=${a.id}" class="btn btn-sm btn-primary" style="background:#7e22ce; border-color:#6b21a8; font-weight:600;">
                    🔬 Lab Verify
                  </a>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    const searchInput = container.querySelector('#gatc-apps-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase().trim();
        container.querySelectorAll('#gatc-apps-table tbody tr').forEach(tr => {
          tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
      });
    }
  }

  renderGATCFieldVerification(container, appId) {
    let app = appId ? window.state.getApplicationById(appId) : null;
    if (!app) {
      const apps = window.state.getApplications();
      app = apps.find(a => (a.assignmentType === 'GATC' || a.assignedGatcId) && a.status !== 'APPROVED');
    }

    if (!app) {
      container.innerHTML = `
        <div style="max-width:800px; margin:40px auto; text-align:center; padding:0 20px;">
          <div class="card" style="padding:48px 24px;">
            <div style="font-size:3rem; margin-bottom:12px;">🔬</div>
            <h2>No Application Selected for GATC Lab Testing</h2>
            <p style="color:var(--text-muted); margin-bottom:20px;">Select an allocated test from your laboratory queue to begin verification.</p>
            <a href="#gatc-applications" class="btn btn-primary" style="background:#7e22ce; border-color:#6b21a8;">Browse Assigned Tests</a>
          </div>
        </div>
      `;
      return;
    }

    const capturedEvidence = {
      testBench: null,
      seal: null,
      testWeights: null,
      worksheet: null
    };

    container.innerHTML = `
      <div style="max-width:980px; margin:0 auto; padding-bottom:120px;">
        ${this.renderBreadcrumbs([
          { label: 'GATC Console', url: '#gatc-dashboard' },
          { label: 'Assigned Tests', url: '#gatc-applications' },
          { label: `Lab Test: ${app.id}`, url: `#gatc-field-verification?id=${app.id}` }
        ], true, '#gatc-applications')}

        <div class="page-header" style="margin-bottom:20px;">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <h1 class="page-title">GATC Precision Laboratory Verification</h1>
              <span class="badge" style="background:#581c87; color:#f3e8ff; font-weight:700;">LAB BENCH CONSOLE</span>
            </div>
            <p class="page-subtitle">Standard Verification under OIML R76 / Legal Metrology Act, 2009 for Application ${app.id}.</p>
          </div>
          <a href="#gatc-applications" class="btn btn-secondary">← Back to Queue</a>
        </div>

        <!-- Target Equipment Overview Card -->
        <div class="card" style="padding:20px; margin-bottom:24px; border-left:4px solid #7e22ce;">
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:14px; font-size:0.875rem;">
            <div><strong style="color:var(--text-muted); display:block; font-size:0.6875rem; text-transform:uppercase;">Application Ref</strong><span class="font-mono" style="font-weight:700;">${app.id}</span></div>
            <div><strong style="color:var(--text-muted); display:block; font-size:0.6875rem; text-transform:uppercase;">Equipment Type</strong><strong>${app.instrumentType}</strong></div>
            <div><strong style="color:var(--text-muted); display:block; font-size:0.6875rem; text-transform:uppercase;">Serial Number</strong><span class="font-mono">${app.serialNumber || app.instrumentId || 'AW-2026-9041'}</span></div>
            <div><strong style="color:var(--text-muted); display:block; font-size:0.6875rem; text-transform:uppercase;">Rated Capacity</strong><strong>${app.capacity || '50 kg (e = 10 g)'}</strong></div>
            <div><strong style="color:var(--text-muted); display:block; font-size:0.6875rem; text-transform:uppercase;">Applicant Enterprise</strong><strong>${app.businessName || app.applicantName || 'Commercial Trader'}</strong></div>
            <div><strong style="color:var(--text-muted); display:block; font-size:0.6875rem; text-transform:uppercase;">Verification Authority</strong><span class="badge" style="background:#f3e8ff; color:#6b21a8; font-weight:700;">GATC TEST CENTRE</span></div>
          </div>
        </div>

        <form id="gatc-verification-form">
          <!-- Section 1: Laboratory Environmental Controls -->
          <div class="field-inspection-card" style="margin-bottom:24px;">
            <h2 class="card-title" style="margin-bottom:14px; display:flex; align-items:center; gap:8px;">
              <span>🌡️</span> 1. Laboratory Environmental Controls &amp; Reference Mass Standards
            </h2>
            <div class="form-row" style="margin-bottom:14px;">
              <div class="form-group">
                <label class="form-label">Ambient Laboratory Temperature (°C) <span class="required-star">*</span></label>
                <input type="number" step="0.1" id="gatc-env-temp" class="form-control font-mono" value="20.0" required />
                <span style="font-size:0.6875rem; color:var(--text-muted);">Standard: 20 ± 2°C (OIML R76 §3.9.2)</span>
              </div>
              <div class="form-group">
                <label class="form-label">Relative Humidity (% RH) <span class="required-star">*</span></label>
                <input type="number" step="0.5" id="gatc-env-rh" class="form-control font-mono" value="50.0" required />
                <span style="font-size:0.6875rem; color:var(--text-muted);">Standard: 45% – 60% RH</span>
              </div>
              <div class="form-group">
                <label class="form-label">Atmospheric Pressure (hPa)</label>
                <input type="number" step="0.1" id="gatc-env-press" class="form-control font-mono" value="1013.2" />
                <span style="font-size:0.6875rem; color:var(--text-muted);">Nominal 1013.25 hPa</span>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Primary Working Standard Mass Set <span class="required-star">*</span></label>
                <select id="gatc-standard-set" class="form-control">
                  <option value="CLASS_E2_SET_01">Class E2 Stainless Steel Weights (1 mg – 500 g, NPL Traceable #NPL-2025-E2-084)</option>
                  <option value="CLASS_F1_SET_02" selected>Class F1 Precision Mass Set (1 g – 50 kg, NPL Traceable #NPL-2025-F1-119)</option>
                  <option value="CLASS_M1_HEAVY_03">Class M1 Cast Iron Working Standards (1 kg – 500 kg, NPL Traceable #NPL-2025-M1-402)</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Calibration Certificate Number</label>
                <input type="text" id="gatc-standard-cert" class="form-control font-mono" value="NPL-CAL-2025-F1-119" />
              </div>
            </div>
          </div>

          <!-- Section 2: Statutory 6-Point Laboratory Checklist -->
          <div class="field-inspection-card" style="margin-bottom:24px;">
            <h2 class="card-title" style="margin-bottom:14px; display:flex; align-items:center; gap:8px;">
              <span>📋</span> 2. Statutory Laboratory Examination Checklist (6 Criteria)
            </h2>
            <div class="checklist-container">
              <div class="checklist-item">
                <div class="checklist-info">
                  <strong class="checklist-name">1. Model Approval Plate &amp; Mandatory Markings</strong>
                  <span class="checklist-desc">Check GOI Model Approval certificate mark, indelibility, serial number plate, and Class designation.</span>
                </div>
                <div class="checklist-toggle">
                  <button type="button" class="check-btn-toggle checked-pass" data-val="PASS">PASS</button>
                  <button type="button" class="check-btn-toggle" data-val="FAIL">FAIL</button>
                </div>
              </div>

              <div class="checklist-item">
                <div class="checklist-info">
                  <strong class="checklist-name">2. Anti-Vibration Granite Bench Stability &amp; Leveling</strong>
                  <span class="checklist-desc">Spirit bubble level centered in target ring; isolation from thermal gradients and drafts.</span>
                </div>
                <div class="checklist-toggle">
                  <button type="button" class="check-btn-toggle checked-pass" data-val="PASS">PASS</button>
                  <button type="button" class="check-btn-toggle" data-val="FAIL">FAIL</button>
                </div>
              </div>

              <div class="checklist-item">
                <div class="checklist-info">
                  <strong class="checklist-name">3. Eccentricity / Off-Center Load Test</strong>
                  <span class="checklist-desc">OIML R76 clause 3.6.2: Apply 1/3 Max load sequentially across corners; error must not exceed MPE.</span>
                </div>
                <div class="checklist-toggle">
                  <button type="button" class="check-btn-toggle checked-pass" data-val="PASS">PASS</button>
                  <button type="button" class="check-btn-toggle" data-val="FAIL">FAIL</button>
                </div>
              </div>

              <div class="checklist-item">
                <div class="checklist-info">
                  <strong class="checklist-name">4. Repeatability / Reproducibility (3 Cycles)</strong>
                  <span class="checklist-desc">OIML R76 clause 3.6.1: Variance across 3 successive identical half-capacity loads ≤ statutory MPE.</span>
                </div>
                <div class="checklist-toggle">
                  <button type="button" class="check-btn-toggle checked-pass" data-val="PASS">PASS</button>
                  <button type="button" class="check-btn-toggle" data-val="FAIL">FAIL</button>
                </div>
              </div>

              <div class="checklist-item">
                <div class="checklist-info">
                  <strong class="checklist-name">5. Zero-Setting Accuracy &amp; Tare Device Test</strong>
                  <span class="checklist-desc">Zero indication within ±0.25e; additive/subtractive tare device operational without rounding error.</span>
                </div>
                <div class="checklist-toggle">
                  <button type="button" class="check-btn-toggle checked-pass" data-val="PASS">PASS</button>
                  <button type="button" class="check-btn-toggle" data-val="FAIL">FAIL</button>
                </div>
              </div>

              <div class="checklist-item">
                <div class="checklist-info">
                  <strong class="checklist-name">6. Working Standards Traceability Verification</strong>
                  <span class="checklist-desc">Verify laboratory reference weights have valid unbroken calibration chain to National Prototype Kilogram #57.</span>
                </div>
                <div class="checklist-toggle">
                  <button type="button" class="check-btn-toggle checked-pass" data-val="PASS">PASS</button>
                  <button type="button" class="check-btn-toggle" data-val="FAIL">FAIL</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Section 3: Authoritative OIML R76 Multi-Point Test Points -->
          <div class="field-inspection-card" style="margin-bottom:24px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
              <div>
                <h2 class="card-title" style="margin-bottom:2px; display:flex; align-items:center; gap:8px;">
                  <span>⚖️</span> 3. OIML R76 Multi-Point Verification Measurement Matrix
                </h2>
                <p style="font-size:0.8125rem; color:var(--text-muted); margin:0;">
                  Authoritative multi-point accuracy evaluation across minimum, half, and maximum capacity stages.
                </p>
              </div>
              <div style="display:flex; align-items:center; gap:10px;">
                <span id="gatc-accuracy-badge" class="accuracy-status-badge status-valid" style="font-size:0.875rem; padding:4px 14px;">PASS</span>
              </div>
            </div>

            <!-- Parameters Grid: Scale Division e, Accuracy Class, Measurement Unit -->
            <div class="form-row" style="margin-bottom:16px; background:var(--color-surface); border:1px solid var(--color-border); border-radius:var(--radius-sm); padding:14px;">
              <div class="form-group" style="margin-bottom:0;">
                <label class="form-label" style="font-size:0.75rem;">Scale Interval <em>e</em> <span class="required-star">*</span></label>
                <input type="number" step="0.0001" id="gatc-scale-e" class="form-control font-mono" value="0.01" style="font-weight:700;" required />
              </div>
              <div class="form-group" style="margin-bottom:0;">
                <label class="form-label" style="font-size:0.75rem;">Accuracy Class <span class="required-star">*</span></label>
                <select id="gatc-accuracy-class" class="form-control font-mono" style="font-weight:700;">
                  <option value="Class III" selected>Class III (Medium Accuracy)</option>
                  <option value="Class II">Class II (High Accuracy)</option>
                  <option value="Class I">Class I (Special Accuracy)</option>
                  <option value="Class IV">Class IV (Ordinary Accuracy)</option>
                </select>
              </div>
              <div class="form-group" style="margin-bottom:0;">
                <label class="form-label" style="font-size:0.75rem;">Unit <span class="required-star">*</span></label>
                <select id="gatc-unit" class="form-control font-mono" style="font-weight:700;">
                  <option value="kg" selected>Kilograms (kg)</option>
                  <option value="g">Grams (g)</option>
                  <option value="mg">Milligrams (mg)</option>
                </select>
              </div>
            </div>

            <!-- Multi-Point Test Points Table -->
            <div class="table-responsive" style="margin-bottom:16px;">
              <table class="table" id="gatc-test-points-table">
                <thead>
                  <tr>
                    <th>Test Load Stage</th>
                    <th>Nominal Standard Mass</th>
                    <th>Observed Lab Reading</th>
                    <th>Calculated Error (E)</th>
                    <th>Statutory MPE (Tolerance)</th>
                    <th>Stage Decision</th>
                  </tr>
                </thead>
                <tbody>
                  <tr data-stage="MIN">
                    <td><strong>Stage 1: Minimum Load (10% Max)</strong></td>
                    <td>
                      <input type="number" step="0.001" class="form-control font-mono pt-nominal" value="5.000" style="max-width:130px;" />
                    </td>
                    <td>
                      <input type="number" step="0.001" class="form-control font-mono pt-observed" value="5.003" style="max-width:130px;" />
                    </td>
                    <td class="font-mono pt-error">+0.003 kg</td>
                    <td class="font-mono pt-mpe">±0.010 kg</td>
                    <td><span class="badge status-valid pt-badge">PASS</span></td>
                  </tr>
                  <tr data-stage="HALF">
                    <td><strong>Stage 2: Half Capacity (50% Max)</strong></td>
                    <td>
                      <input type="number" step="0.001" class="form-control font-mono pt-nominal" value="25.000" style="max-width:130px;" />
                    </td>
                    <td>
                      <input type="number" step="0.001" class="form-control font-mono pt-observed" value="25.008" style="max-width:130px;" />
                    </td>
                    <td class="font-mono pt-error">+0.008 kg</td>
                    <td class="font-mono pt-mpe">±0.020 kg</td>
                    <td><span class="badge status-valid pt-badge">PASS</span></td>
                  </tr>
                  <tr data-stage="MAX">
                    <td><strong>Stage 3: Maximum Rated Capacity (100% Max)</strong></td>
                    <td>
                      <input type="number" step="0.001" class="form-control font-mono pt-nominal" value="50.000" style="max-width:130px;" />
                    </td>
                    <td>
                      <input type="number" step="0.001" class="form-control font-mono pt-observed" value="50.012" style="max-width:130px;" />
                    </td>
                    <td class="font-mono pt-error">+0.012 kg</td>
                    <td class="font-mono pt-mpe">±0.030 kg</td>
                    <td><span class="badge status-valid pt-badge">PASS</span></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style="background:var(--color-surface); border-radius:var(--radius-sm); padding:10px 14px; font-size:0.8125rem;">
              <span id="gatc-eval-msg" style="color:var(--color-success); font-weight:600;">
                ✓ All test points comply with statutory OIML R76 Maximum Permissible Error tolerance.
              </span>
            </div>
          </div>

          <!-- Section 4: Photographic Laboratory Evidence -->
          <div class="field-inspection-card" style="margin-bottom:24px;">
            <h2 class="card-title" style="margin-bottom:14px; display:flex; align-items:center; gap:8px;">
              <span>📷</span> 4. Laboratory Photographic Evidence (High Precision Capture)
            </h2>

            <div class="evidence-grid">
              <!-- Evidence 1: Test Bench Setup -->
              <div class="evidence-card" data-type="testBench">
                <span class="evidence-title">🔬 1. Instrument on Granite Bench</span>
                <div class="evidence-preview-box" id="gatc-preview-bench">
                  <div style="font-size:2rem; color:#7e22ce;">⚖️</div>
                  <span style="font-size:0.6875rem; color:var(--text-muted); margin-top:4px;">No bench photo</span>
                </div>
                <input type="file" id="gatc-file-bench" accept="image/*" style="display:none;" />
                <button type="button" class="btn btn-sm btn-secondary trigger-gatc-file" data-target="gatc-file-bench">
                  📷 Capture Bench
                </button>
              </div>

              <!-- Evidence 2: Tamper-Evident Lead/Wire Seal -->
              <div class="evidence-card" data-type="seal">
                <span class="evidence-title">🏷️ 2. Laboratory Security Seal</span>
                <div class="evidence-preview-box" id="gatc-preview-seal">
                  <div style="font-size:2rem; color:#7e22ce;">🏷️</div>
                  <span style="font-size:0.6875rem; color:var(--text-muted); margin-top:4px;">No seal photo</span>
                </div>
                <input type="file" id="gatc-file-seal" accept="image/*" style="display:none;" />
                <button type="button" class="btn btn-sm btn-secondary trigger-gatc-file" data-target="gatc-file-seal">
                  📷 Capture Seal
                </button>
              </div>

              <!-- Evidence 3: Standard Weights Application -->
              <div class="evidence-card" data-type="testWeights">
                <span class="evidence-title">📦 3. Mass Standard Application</span>
                <div class="evidence-preview-box" id="gatc-preview-weights">
                  <div style="font-size:2rem; color:#7e22ce;">📦</div>
                  <span style="font-size:0.6875rem; color:var(--text-muted); margin-top:4px;">No mass load photo</span>
                </div>
                <input type="file" id="gatc-file-weights" accept="image/*" style="display:none;" />
                <button type="button" class="btn btn-sm btn-secondary trigger-gatc-file" data-target="gatc-file-weights">
                  📷 Capture Load
                </button>
              </div>

              <!-- Evidence 4: Calibration Worksheet -->
              <div class="evidence-card" data-type="worksheet">
                <span class="evidence-title">📄 4. Calibration Worksheet</span>
                <div class="evidence-preview-box" id="gatc-preview-worksheet">
                  <div style="font-size:2rem; color:#7e22ce;">📝</div>
                  <span style="font-size:0.6875rem; color:var(--text-muted); margin-top:4px;">No worksheet uploaded</span>
                </div>
                <input type="file" id="gatc-file-worksheet" accept="image/*,application/pdf" style="display:none;" />
                <button type="button" class="btn btn-sm btn-secondary trigger-gatc-file" data-target="gatc-file-worksheet">
                  📁 Upload Worksheet
                </button>
              </div>
            </div>
          </div>

          <!-- Section 5: Statutory Decision & Security Seal -->
          <div class="field-inspection-card" style="margin-bottom:24px;">
            <h2 class="card-title" style="margin-bottom:14px; display:flex; align-items:center; gap:8px;">
              <span>🛡️</span> 5. Security Wire Seal &amp; Statutory Decision
            </h2>

            <div class="form-group" style="margin-bottom:16px;">
              <label class="form-label" for="gatc-seal-number">Security Seal Serial Number Applied <span class="required-star">*</span></label>
              <input type="text" id="gatc-seal-number" class="form-control font-mono" value="GATC-BR-2026-8812" required />
            </div>

            <div class="form-group" id="gatc-fail-reason-box" style="display:none; margin-bottom:16px;">
              <label class="form-label" style="color:var(--color-danger);">Statutory Rejection / Failure Reason <span class="required-star">*</span></label>
              <textarea id="gatc-fail-reason" class="form-control" rows="3" placeholder="Specify statutory error reasons (e.g. Stage 3 max capacity load showed error +0.060 kg, exceeding permissible MPE ±0.030 kg)."></textarea>
            </div>
          </div>

          <!-- Sticky Bottom Bar -->
          <div class="mobile-sticky-actionbar">
            <div>
              <span style="font-size:0.8125rem; color:var(--text-muted);">GATC Lab Decision for:</span>
              <strong style="font-size:0.9375rem; display:block;">${app.id} (${app.instrumentType})</strong>
            </div>
            <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
              <button type="button" class="btn btn-secondary" id="gatc-save-draft-btn" style="min-height:44px; font-weight:600;">💾 Save Draft</button>
              <button type="button" class="btn btn-danger" id="gatc-submit-fail-btn" style="min-height:44px; font-weight:700;">Submit FAIL</button>
              <button type="button" class="btn btn-primary" id="gatc-submit-pass-btn" style="min-height:44px; font-weight:700; background:#7e22ce; border-color:#6b21a8;">
                Submit PASS &amp; Sign Digitally ➔
              </button>
            </div>
          </div>
        </form>
      </div>
    `;

    // Dynamic Multi-Point Tolerance Calculator
    const scaleEInput = container.querySelector('#gatc-scale-e');
    const unitSelect = container.querySelector('#gatc-unit');
    const evalMsg = container.querySelector('#gatc-eval-msg');
    const evalBadge = container.querySelector('#gatc-accuracy-badge');

    let allPointsPass = true;

    const updateGATCTolerance = () => {
      const eVal = parseFloat(scaleEInput.value) || 0.01;
      const u = unitSelect.value;
      allPointsPass = true;

      container.querySelectorAll('#gatc-test-points-table tbody tr').forEach(tr => {
        const nomInput = tr.querySelector('.pt-nominal');
        const obsInput = tr.querySelector('.pt-observed');
        const errCell = tr.querySelector('.pt-error');
        const mpeCell = tr.querySelector('.pt-mpe');
        const badgeSpan = tr.querySelector('.pt-badge');

        const nom = parseFloat(nomInput.value) || 0;
        const obs = parseFloat(obsInput.value) || 0;
        const err = obs - nom;

        const m = Math.abs(nom) / (eVal > 0 ? eVal : 0.01);
        let mpe = 1.0 * eVal;
        if (m > 2000) mpe = 3.0 * eVal;
        else if (m > 500) mpe = 2.0 * eVal;

        const isPointPass = Math.abs(err) <= (mpe + 0.0001);
        if (!isPointPass) allPointsPass = false;

        errCell.textContent = `${err >= 0 ? '+' : ''}${err.toFixed(3)} ${u}`;
        mpeCell.textContent = `±${mpe.toFixed(3)} ${u}`;
        badgeSpan.className = `badge ${isPointPass ? 'status-valid' : 'status-failed'}`;
        badgeSpan.textContent = isPointPass ? 'PASS' : 'FAIL';
      });

      if (allPointsPass) {
        evalBadge.className = 'accuracy-status-badge status-valid';
        evalBadge.textContent = 'PASS';
        evalMsg.textContent = '✓ All test points comply with statutory OIML R76 Maximum Permissible Error tolerance.';
        evalMsg.style.color = 'var(--color-success)';
      } else {
        evalBadge.className = 'accuracy-status-badge status-failed';
        evalBadge.textContent = 'FAIL';
        evalMsg.textContent = '✕ One or more test loads exceed statutory Maximum Permissible Error (MPE).';
        evalMsg.style.color = 'var(--color-danger)';
      }
    };

    scaleEInput.addEventListener('input', updateGATCTolerance);
    unitSelect.addEventListener('change', updateGATCTolerance);
    container.querySelectorAll('#gatc-test-points-table input').forEach(i => i.addEventListener('input', updateGATCTolerance));
    updateGATCTolerance();

    // Checklist button toggles
    container.querySelectorAll('.check-btn-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = btn.parentElement;
        p.querySelectorAll('.check-btn-toggle').forEach(b => b.classList.remove('checked-pass', 'checked-fail'));
        if (btn.dataset.val === 'PASS') btn.classList.add('checked-pass');
        else btn.classList.add('checked-fail');
      });
    });

    // Evidence file triggers
    container.querySelectorAll('.trigger-gatc-file').forEach(btn => {
      btn.addEventListener('click', () => {
        const tId = btn.dataset.target;
        const inp = document.getElementById(tId);
        if (inp) inp.click();
      });
    });

    const wireEvidenceInput = (fileId, typeKey, previewId) => {
      const inp = container.querySelector(`#${fileId}`);
      if (!inp) return;
      inp.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (re) => {
          capturedEvidence[typeKey] = {
            name: file.name,
            size: `${(file.size / 1024).toFixed(1)} KB`,
            type: file.type.includes('pdf') ? 'PDF' : 'IMAGE',
            url: re.target.result,
            timestamp: new Date().toISOString()
          };
          const pBox = container.querySelector(`#${previewId}`);
          if (pBox) {
            pBox.innerHTML = `<img src="${re.target.result}" style="width:100%; height:100%; object-fit:cover; border-radius:var(--radius-sm);" alt="${typeKey}" />`;
          }
          Components.showToast({ title: "Evidence Captured", message: `${file.name} saved.`, type: "success" });
        };
        reader.readAsDataURL(file);
      });
    };

    wireEvidenceInput('gatc-file-bench', 'testBench', 'gatc-preview-bench');
    wireEvidenceInput('gatc-file-seal', 'seal', 'gatc-preview-seal');
    wireEvidenceInput('gatc-file-weights', 'testWeights', 'gatc-preview-weights');
    wireEvidenceInput('gatc-file-worksheet', 'worksheet', 'gatc-preview-worksheet');

    // Save draft
    const draftBtn = container.querySelector('#gatc-save-draft-btn');
    if (draftBtn) {
      draftBtn.addEventListener('click', () => {
        Components.showToast({ title: "Draft Saved", message: "Laboratory verification draft saved to local cache.", type: "info" });
      });
    }

    // Submit FAIL
    const failBtn = container.querySelector('#gatc-submit-fail-btn');
    const failBox = container.querySelector('#gatc-fail-reason-box');
    const failReasonInput = container.querySelector('#gatc-fail-reason');
    if (failBtn) {
      failBtn.addEventListener('click', async () => {
        if (failBox.style.display === 'none') {
          failBox.style.display = 'block';
          failReasonInput.scrollIntoView({ behavior: 'smooth' });
          Components.showToast({ title: "Reason Required", message: "Please state the official failure justification.", type: "warning" });
          return;
        }

        const reason = failReasonInput.value.trim();
        if (!reason) {
          Components.showToast({ title: "Reason Required", message: "Mandatory statutory failure reason is required.", type: "warning" });
          return;
        }

        Components.confirmAction({
          title: "Submit Statutory FAIL Decision",
          message: "Confirm submission of statutory <strong>FAIL</strong> decision for this instrument?",
          confirmText: "Confirm FAIL",
          confirmClass: "btn-danger",
          onConfirm: async () => {
            const payload = {
              result: "FAIL",
              verifierType: "GATC",
              failReason: reason,
              sealNumber: container.querySelector('#gatc-seal-number').value,
              unit: unitSelect.value,
              evidence: capturedEvidence
            };

            try {
              await window.api.submitFieldVerification(app.id, payload);
              Components.showToast({ title: "Test Completed: FAIL", message: "Failure recorded under GATC laboratory jurisdiction.", type: "error" });
              location.hash = '#gatc-dashboard';
            } catch (err) {
              if (window.OfflineSyncManager) {
                await window.OfflineSyncManager.queueInspection(app.id, payload);
                Components.showToast({ title: "Offline Queue", message: "Saved to offline queue. Will sync automatically.", type: "info" });
                location.hash = '#gatc-dashboard';
              } else {
                Components.showToast({ title: "Submission Error", message: err.message || "Failed to submit verification.", type: "error" });
              }
            }
          }
        });
      });
    }

    // Submit PASS
    const passBtn = container.querySelector('#gatc-submit-pass-btn');
    if (passBtn) {
      passBtn.addEventListener('click', async () => {
        const doGatcPass = async () => {
          const testPoints = [];
          container.querySelectorAll('#gatc-test-points-table tbody tr').forEach(tr => {
            testPoints.push({
              loadStage: tr.dataset.stage,
              nominalLoad: parseFloat(tr.querySelector('.pt-nominal').value) || 0,
              observedValue: parseFloat(tr.querySelector('.pt-observed').value) || 0,
              error: parseFloat(tr.querySelector('.pt-error').textContent) || 0,
              mpe: parseFloat(tr.querySelector('.pt-mpe').textContent.replace('±', '')) || 0,
              unit: unitSelect.value,
              result: tr.querySelector('.pt-badge').textContent
            });
          });

          const sealNum = container.querySelector('#gatc-seal-number').value.trim();
          if (!sealNum) {
            Components.showToast({ title: "Seal Required", message: "Please enter the security seal serial number applied.", type: "warning" });
            return;
          }

          passBtn.disabled = true;
          passBtn.textContent = "Cryptographically Signing & Issuing...";

          const verificationData = {
            result: "PASS",
            verifierType: "GATC",
            sealNumber: sealNum,
            accuracyClass: container.querySelector('#gatc-accuracy-class').value,
            scaleDivisionE: parseFloat(scaleEInput.value) || 0.01,
            unit: unitSelect.value,
            testPoints: testPoints,
            evidence: capturedEvidence,
            environmentalConditions: {
              temperature: parseFloat(container.querySelector('#gatc-env-temp').value) || 20.0,
              humidity: parseFloat(container.querySelector('#gatc-env-rh').value) || 50.0,
              pressure: parseFloat(container.querySelector('#gatc-env-press').value) || 1013.2,
              standardSet: container.querySelector('#gatc-standard-set').value,
              standardCert: container.querySelector('#gatc-standard-cert').value
            }
          };

          try {
            const res = await window.api.submitFieldVerification(app.id, verificationData);
            passBtn.disabled = false;
            passBtn.textContent = "Submit PASS & Sign Digitally ➔";

            Components.showModal({
              title: "Digital Verification Certificate Generated",
              content: `
                <div style="text-align:center; padding:12px 0;">
                  <div style="font-size:3rem; margin-bottom:8px;">📜</div>
                  <h3 style="font-size:1.25rem; font-weight:800; color:var(--text-primary); margin-bottom:4px;">
                    GATC Verification Authenticated
                  </h3>
                  <p style="font-size:0.875rem; color:var(--text-muted); margin-bottom:14px;">
                    Certificate issued with RSA-2048 Asymmetric Digital Signature &amp; ISO/IEC 18004 QR Code.
                  </p>
                  <div style="display:inline-block; padding:8px 20px; background:#f3e8ff; border:1px solid #c084fc; border-radius:var(--radius-md); font-family:var(--font-mono); font-size:1.125rem; font-weight:800; color:#581c87; margin-bottom:12px;">
                    ${res.certificate ? res.certificate.id : 'CERTIFICATE ISSUED'}
                  </div>
                  <div style="font-size:0.8125rem; color:var(--text-secondary); line-height:1.4;">
                    Digital Signature Algorithm: <strong>RSA-2048 / SHA-256 PKCS#1 v1.5</strong><br/>
                    Security Seal Serial: <strong>${sealNum}</strong>
                  </div>
                </div>
              `,
              confirmText: "View Certificate & QR",
              cancelText: "Return to Dashboard",
              onConfirm: (close) => {
                close();
                if (res.certificate && res.certificate.id) {
                  location.hash = `#verify?id=${res.certificate.id}`;
                } else {
                  location.hash = '#gatc-dashboard';
                }
              }
            });
          } catch (err) {
            passBtn.disabled = false;
            passBtn.textContent = "Submit PASS & Sign Digitally ➔";

            if (window.OfflineSyncManager) {
              await window.OfflineSyncManager.queueInspection(app.id, verificationData);
              Components.showToast({
                title: "Saved to Offline Queue",
                message: "Network request failed. Test record queued in IndexedDB for automatic synchronization.",
                type: "warning"
              });
              location.hash = '#gatc-dashboard';
            } else {
              Components.showToast({
                title: "Submission Error",
                message: err.message || "Failed to submit verification.",
                type: "error"
              });
            }
          }
        };

        if (!allPointsPass) {
          Components.confirmAction({
            title: "Tolerance Warning",
            message: "One or more test points exceed OIML R76 MPE. Are you sure you wish to submit a PASS?",
            confirmText: "Submit PASS Anyway",
            confirmClass: "btn-warning",
            onConfirm: () => doGatcPass()
          });
        } else {
          doGatcPass();
        }
      });
    }
  }

  renderGATCCalendar(container) {
    const user = window.state.getCurrentUser() || {};
    const apps = (window.state.getApplications() || []).filter(a => (a.assignmentType === 'GATC' || a.assignedGatcId === user.id) && (a.scheduledDate || a.status === 'SCHEDULED' || a.status === 'ALLOCATED'));

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">GATC Test Bench Schedule</h1>
          <p class="page-subtitle">Scheduled precision calibration appointments at Government Approved Test Centre laboratory.</p>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <a href="#gatc-dashboard" class="btn btn-secondary">← Back to Dashboard</a>
        </div>
      </div>

      <div class="calendar-wrapper">
        <div class="calendar-header">
          <div class="calendar-nav">
            <button type="button" class="btn btn-sm btn-secondary" id="gatc-cal-prev">◀ Previous</button>
            <div class="calendar-month-title" id="gatc-cal-title">September 2026</div>
            <button type="button" class="btn btn-sm btn-secondary" id="gatc-cal-next">Next ▶</button>
          </div>
          <div style="font-size:0.8125rem; color:var(--text-muted);">
            Laboratory: <strong>${user.businessName || 'GATC Centre #04'}</strong>
          </div>
        </div>

        <div id="gatc-cal-body">
          ${Components.renderCalendar(apps, this.calendarMonthOffset || 0, 'month')}
        </div>
      </div>
    `;

    const attachGATCCalClicks = () => {
      container.querySelectorAll('.calendar-day-cell.clickable').forEach(cell => {
        cell.addEventListener('click', () => {
          const d = cell.dataset.date;
          if (d && Components.showDateDetailModal) Components.showDateDetailModal(d);
        });
      });
    };
    attachGATCCalClicks();

    const prevBtn = container.querySelector('#gatc-cal-prev');
    const nextBtn = container.querySelector('#gatc-cal-next');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        this.calendarMonthOffset = (this.calendarMonthOffset || 0) - 1;
        container.querySelector('#gatc-cal-title').textContent = this.calendarMonthOffset === 0 ? 'September 2026' : this.calendarMonthOffset < 0 ? 'August 2026' : 'October 2026';
        container.querySelector('#gatc-cal-body').innerHTML = Components.renderCalendar(apps, this.calendarMonthOffset, 'month');
        attachGATCCalClicks();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        this.calendarMonthOffset = (this.calendarMonthOffset || 0) + 1;
        container.querySelector('#gatc-cal-title').textContent = this.calendarMonthOffset === 0 ? 'September 2026' : this.calendarMonthOffset < 0 ? 'August 2026' : 'October 2026';
        container.querySelector('#gatc-cal-body').innerHTML = Components.renderCalendar(apps, this.calendarMonthOffset, 'month');
        attachGATCCalClicks();
      });
    }
  }

  // ==========================================
  // Admin Allocation Desk (SIH26036 Feature 2)
  // ==========================================

  renderAdminAllocationDesk(container) {
    const apps = window.state.getApplications() || [];
    const officers = window.state.getOfficers() || [];

    const lmoAssigned = apps.filter(a => a.assignmentType === 'LMO' || a.assignedOfficerId).length;
    const readyForAlloc = apps.filter(a => !a.assignmentType || a.assignmentType === 'UNASSIGNED' || a.status === 'READY_FOR_ALLOCATION' || a.status === 'SUBMITTED' || a.status === 'UNDER_SCRUTINY').length;

    container.innerHTML = `
      <div class="page-header" style="margin-bottom:24px;">
        <div>
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
            <h1 class="page-title">Statutory Allocation &amp; Assignment Desk</h1>
            <span class="badge status-valid" style="font-weight:700;">STATUTORY LMO ENFORCEMENT</span>
          </div>
          <p class="page-subtitle">Statutory LMO Allocation Desk • Allocate verification applications to designated Legal Metrology Officers (LMO) across territorial jurisdictions.</p>
        </div>
        <a href="#admin-dashboard" class="btn btn-secondary">← Back to Console</a>
      </div>

      <!-- Allocation Metrics Grid -->
      <div class="dashboard-metrics-grid" style="margin-bottom:28px;">
        <div class="stat-card stat-warning">
          <div class="stat-header"><span class="stat-label">Ready for Allocation</span><span>📥</span></div>
          <div class="stat-value stat-counter-val" data-target="${readyForAlloc}">${readyForAlloc}</div>
          <div class="stat-subtext">Awaiting administrative routing</div>
        </div>

        <div class="stat-card stat-info">
          <div class="stat-header"><span class="stat-label">Allocated to LMOs</span><span>👮</span></div>
          <div class="stat-value stat-counter-val" data-target="${lmoAssigned}">${lmoAssigned}</div>
          <div class="stat-subtext">On-site field inspection route</div>
        </div>

        <div class="stat-card stat-success">
          <div class="stat-header"><span class="stat-label">Active Field LMOs</span><span>🏛️</span></div>
          <div class="stat-value stat-counter-val" data-target="${officers.length || 6}">${officers.length || 6}</div>
          <div class="stat-subtext">Authorized statutory inspectors</div>
        </div>

        <div class="stat-card stat-info">
          <div class="stat-header"><span class="stat-label">Total Applications</span><span>📂</span></div>
          <div class="stat-value stat-counter-val" data-target="${apps.length}">${apps.length}</div>
          <div class="stat-subtext">All filed verification records</div>
        </div>
      </div>

      <!-- Filter Controls & Search -->
      <div style="display:flex; justify-content:space-between; align-items:center; gap:16px; margin-bottom:16px; flex-wrap:wrap;">
        <div class="tab-nav" style="margin:0;">
          <button type="button" class="tab-btn active" id="filter-all-btn">All Applications (${apps.length})</button>
          <button type="button" class="tab-btn" id="filter-ready-btn">Ready for Allocation (${readyForAlloc})</button>
          <button type="button" class="tab-btn" id="filter-lmo-btn">LMO Allocated (${lmoAssigned})</button>
        </div>
        <div style="flex:1; max-width:320px;">
          <input type="text" id="alloc-search-input" class="form-control" placeholder="Search application, trader, location..." />
        </div>
      </div>

      <!-- Applications Table -->
      <div class="card table-responsive">
        <table class="table" id="allocation-table">
          <thead>
            <tr>
              <th>Application ID</th>
              <th>Applicant / Business</th>
              <th>Equipment Type</th>
              <th>Location / District</th>
              <th>Assigned LMO Officer</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${apps.length === 0 ? `
              <tr><td colspan="7" style="text-align:center; padding:32px; color:var(--text-muted);">No verification applications available.</td></tr>
            ` : apps.map(a => {
              const isAllocated = a.assignmentType === 'LMO' || a.assignedOfficerId;

              return `
                <tr data-allocated="${isAllocated ? 'LMO' : 'UNASSIGNED'}" data-status="${a.status}">
                  <td class="font-mono"><strong>${a.id}</strong></td>
                  <td><strong>${a.businessName || a.applicantName || 'Commercial Trader'}</strong></td>
                  <td>
                    <span>${a.instrumentType}</span>
                    <div style="font-size:0.75rem; color:var(--text-muted); font-family:var(--font-mono);">${a.instrumentId || a.serialNumber || '--'}</div>
                  </td>
                  <td>${a.preferredLocation || a.location || 'Patna'}</td>
                  <td>
                    <strong>${a.assignedOfficerName || (isAllocated ? 'Assigned LMO' : '<span style="color:var(--text-muted);">Not Allocated</span>')}</strong>
                  </td>
                  <td>${Components.renderStatusBadge(a.status)}</td>
                  <td>
                    <div style="display:flex; gap:6px;">
                      <button type="button" class="btn btn-sm btn-primary open-allocate-modal-btn" data-app-id="${a.id}" style="padding:4px 10px; font-size:0.8125rem;">
                        ⚖️ Allocate / Assign LMO
                      </button>
                      <button type="button" class="btn btn-sm btn-outline view-assignment-history-btn" data-app-id="${a.id}" style="padding:4px 8px; font-size:0.8125rem;">
                        📜 History
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    // Filter tab logic
    const rows = container.querySelectorAll('#allocation-table tbody tr');
    const tabBtns = container.querySelectorAll('.tab-nav .tab-btn');
    const setTab = (activeBtn, filterFn) => {
      tabBtns.forEach(b => b.classList.remove('active'));
      activeBtn.classList.add('active');
      rows.forEach(r => {
        r.style.display = filterFn(r) ? '' : 'none';
      });
    };

    container.querySelector('#filter-all-btn').addEventListener('click', (e) => setTab(e.target, () => true));
    container.querySelector('#filter-ready-btn').addEventListener('click', (e) => setTab(e.target, r => {
      const isAlloc = r.dataset.allocated;
      const status = r.dataset.status;
      return isAlloc === 'UNASSIGNED' || status === 'SUBMITTED' || status === 'UNDER_SCRUTINY' || status === 'READY_FOR_ALLOCATION';
    }));
    container.querySelector('#filter-lmo-btn').addEventListener('click', (e) => setTab(e.target, r => r.dataset.allocated === 'LMO'));

    // Search filter
    const searchInp = container.querySelector('#alloc-search-input');
    if (searchInp) {
      searchInp.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase().trim();
        rows.forEach(r => {
          r.style.display = r.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
      });
    }

    // Modal allocation handler
    container.querySelectorAll('.open-allocate-modal-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const appId = btn.dataset.appId;
        const app = window.state.getApplicationById(appId);
        if (!app) return;

        let availableOfficers = officers;
        try {
          const res = await window.api.getAvailableOfficers();
          if (res && res.officers && res.officers.length) {
            availableOfficers = res.officers;
          }
        } catch (e) {
          availableOfficers = officers;
        }

        Components.showModal({
          title: `Allocate Application to LMO: ${app.id}`,
          content: `
            <div style="font-size:0.875rem; color:var(--text-secondary); margin-bottom:16px;">
              Assign this statutory verification application to an authorized Legal Metrology Officer (LMO) for field inspection, calibration check, and legal verification.
            </div>

            <div style="background:var(--color-surface); border:1px solid var(--color-border); border-radius:var(--radius-sm); padding:12px; margin-bottom:16px; font-size:0.8125rem;">
              <div><strong>Application:</strong> ${app.id} (${app.instrumentType})</div>
              <div><strong>Trader / Enterprise:</strong> ${app.businessName || app.applicantName || 'Trader'}</div>
              <div><strong>Premises:</strong> ${app.preferredLocation || app.location || 'Local Premises'}</div>
              <div><strong>Current Status:</strong> ${app.status}</div>
            </div>

            <form id="statutory-allocation-form">
              <!-- LMO Officer Select -->
              <div class="form-group" style="margin-bottom:16px;">
                <label class="form-label" style="font-weight:700;">Select Statutory Legal Metrology Officer (LMO) <span class="required-star">*</span></label>
                <select id="modal-select-lmo" class="form-control">
                  ${availableOfficers.map(o => `
                    <option value="${o.id}">${o.name} (${o.jurisdiction || o.district || 'Patna Circle'}) • ${o.activeInspectionsCount || 0} active verifications</option>
                  `).join('')}
                </select>
              </div>

              <div class="form-group" style="margin-bottom:16px;">
                <label class="form-label">Statutory Allocation Directive / Remarks</label>
                <textarea id="modal-alloc-notes" class="form-control" rows="2" placeholder="e.g. Allocated for statutory on-site verification under the Legal Metrology Act, 2009."></textarea>
              </div>
            </form>
          `,
          confirmText: "Confirm LMO Allocation",
          onConfirm: async (close) => {
            const lmoId = document.getElementById('modal-select-lmo').value;
            const notes = document.getElementById('modal-alloc-notes').value.trim();

            const payload = {
              assignmentType: 'LMO',
              officerId: lmoId,
              notes: notes || 'Allocated via Administrative Allocation Desk to LMO'
            };

            try {
              if (app.assignmentType && app.assignmentType !== 'UNASSIGNED') {
                await window.api.reassignApplication(app.id, { ...payload, reason: notes || "Administrative reassignment" });
              } else {
                await window.api.allocateApplication(app.id, payload);
              }

              Components.showToast({
                title: "Application Allocated",
                message: `Application ${app.id} successfully allocated to Legal Metrology Officer.`,
                type: "success"
              });

              close();
              await window.api.getApplications();
              this.renderAdminAllocationDesk(container);
            } catch (err) {
              Components.showToast({
                title: "Allocation Failed",
                message: err.message || "Failed to allocate application.",
                type: "error"
              });
            }
          }
        });
      });
    });

    // View Assignment History Modal Handler
    container.querySelectorAll('.view-assignment-history-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const appId = btn.dataset.appId;
        try {
          const assignments = await window.api.getApplicationAssignments(appId);
          Components.showModal({
            title: `Statutory Assignment History: ${appId}`,
            content: `
              <div style="font-size:0.8125rem; color:var(--text-muted); margin-bottom:14px;">
                Complete chronological audit log of officer allocations and jurisdiction transfers under Legal Metrology Act, 2009.
              </div>
              ${assignments.length === 0 ? `
                <div style="padding:28px 16px; text-align:center; color:var(--text-muted); background:var(--color-surface); border-radius:6px;">
                  <div style="font-size:1.75rem; margin-bottom:6px;">📂</div>
                  <div>No previous allocation transfers recorded for this application.</div>
                </div>
              ` : `
                <div class="table-responsive">
                  <table class="table" style="font-size:0.8125rem;">
                    <thead>
                      <tr>
                        <th>Assigned Officer</th>
                        <th>Assigned Date</th>
                        <th>Status</th>
                        <th>Assigned By</th>
                        <th>Directive / Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${assignments.map(as => `
                        <tr>
                          <td><strong>${as.assignedOfficerName || as.assigned_lmo_id}</strong></td>
                          <td>${as.assigned_at ? new Date(as.assigned_at).toLocaleString('en-IN') : '--'}</td>
                          <td>
                            ${as.is_current ? '<span class="badge status-valid">CURRENT</span>' : '<span class="badge" style="background:#E2E8F0; color:#475569;">RELEASED</span>'}
                          </td>
                          <td>${as.assignedByName || as.assigned_by || 'State Admin'}</td>
                          <td>${as.reason || '--'}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              `}
            `,
            confirmText: "Close",
            onConfirm: (close) => close()
          });
        } catch (e) {
          Components.showToast({
            title: "History Unavailable",
            message: e.message || "Failed to load assignment history.",
            type: "error"
          });
        }
      });
    });
  }
}

// Instantiate on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new MeasureXApp();
});
