/**
 * Measure X — Runtime Configuration & Environment Resolver
 * Dynamically resolves API Base URL, Environment, and Feature Flags.
 * Pure MySQL 8+ and FastAPI production client configuration.
 */

(function (window) {
  // 1. Resolve default API URL based on current host context
  function resolveDefaultApiUrl() {
    // 1. Check window global override (e.g. injected by runtime)
    if (typeof window !== 'undefined' && window.__MEASUREX_API_URL__) {
      return window.__MEASUREX_API_URL__;
    }

    if (typeof window !== 'undefined' && window.location) {
      const { hostname, protocol, port, origin } = window.location;

      // If running frontend on FastAPI port 8000
      if (port === '8000') {
        return `${origin}/api/v1`;
      }

      // If running frontend on dev server (localhost / 127.0.0.1 on port 3000, 5000, 5500, etc.)
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        if (port === '3000') {
          return `${origin}/api/v1`;
        }
        return 'http://127.0.0.1:8000/api/v1';
      }

      // Local network IP (e.g. mobile testing on LAN)
      if (/^192\.168\./.test(hostname) || /^10\./.test(hostname) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)) {
        return `${protocol}//${hostname}:8000/api/v1`;
      }

      // Production deployment (Vercel or custom domain)
      // Same-origin /api/v1 leverages Vercel Edge proxy and eliminates CORS OPTIONS preflight overhead
      return `${origin}/api/v1`;
    }

    return 'http://127.0.0.1:8000/api/v1';
  }

  const userOverrideUrl = (typeof localStorage !== 'undefined') ? localStorage.getItem('measurex_api_url') : null;

  const MEASUREX_CONFIG = {
    // API endpoint (localStorage override > window.__MEASUREX_API_URL__ > host-resolved default)
    API_BASE_URL: userOverrideUrl || resolveDefaultApiUrl(),

    // STRICT RULE: Real FastAPI + MySQL backend is ALWAYS the source of truth. NO MOCK.
    USE_MOCK: false,
    BACKEND_AVAILABLE: true,

    // Zero simulated latency for instantaneous, smooth UI feedback
    SIMULATE_LATENCY_MS: 0,

    // Platform release version
    VERSION: '2.4.0-PROD',

    // Environment
    ENV: (function () {
      if (typeof window === 'undefined' || !window.location) return 'production';
      const h = window.location.hostname;
      if (h === 'localhost' || h === '127.0.0.1') return 'development';
      return 'production';
    })(),

    setApiUrl: function (url) {
      this.API_BASE_URL = url;
      localStorage.setItem('measurex_api_url', url);
      console.info('[MeasureX] API Base URL set to:', url);
    }
  };

  // Expose globally
  window.MEASUREX_CONFIG = MEASUREX_CONFIG;
  console.info(`[MeasureX] Configuration initialized. API Base: ${MEASUREX_CONFIG.API_BASE_URL} (USE_MOCK: false)`);

  // Probe live backend API health
  if (typeof window !== 'undefined' && window.fetch) {
    fetch(`${MEASUREX_CONFIG.API_BASE_URL}/health`, { method: 'GET' })
      .then(res => {
        if (res.ok) {
          MEASUREX_CONFIG.BACKEND_AVAILABLE = true;
          console.info('[MeasureX] Statutory Legal Metrology Backend connected.');
        } else {
          MEASUREX_CONFIG.BACKEND_AVAILABLE = false;
        }
      })
      .catch(() => {
        MEASUREX_CONFIG.BACKEND_AVAILABLE = false;
        console.warn('[MeasureX] Backend server is unreachable at', MEASUREX_CONFIG.API_BASE_URL);
      });
  }
})(typeof window !== 'undefined' ? window : this);
