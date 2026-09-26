/**
 * Measure X — Runtime Configuration & Environment Resolver
 * Dynamically resolves API Base URL, Environment, and Feature Flags.
 * Pure MySQL 8+ and FastAPI production client configuration.
 */

(function (window) {
  // 1. Resolve default API URL based on current host context
  function resolveDefaultApiUrl() {
    if (typeof window !== 'undefined' && window.location) {
      const { hostname, protocol, port, origin } = window.location;

      // When frontend is served on port 8000, 80, or 443
      if (port === '8000' || port === '80' || port === '443') {
        return `${origin}/api/v1`;
      }

      // If running frontend locally on port 3000 or similar
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return `http://127.0.0.1:8000/api/v1`;
      }

      // Local network IP
      if (/^192\.168\./.test(hostname) || /^10\./.test(hostname) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)) {
        return `${protocol}//${hostname}:8000/api/v1`;
      }

      return `${origin}/api/v1`;
    }

    return 'http://127.0.0.1:8000/api/v1';
  }

  const userOverrideUrl = localStorage.getItem('measurex_api_url');

  const MEASUREX_CONFIG = {
    // API endpoint
    API_BASE_URL: userOverrideUrl || resolveDefaultApiUrl(),

    // STRICT RULE: Real FastAPI + MySQL backend is ALWAYS the source of truth. NO MOCK.
    USE_MOCK: false,
    BACKEND_AVAILABLE: true,

    // Simulated latency in milliseconds for UI feedback
    SIMULATE_LATENCY_MS: 50,

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
          console.info('[MeasureX] Statutory Legal Metrology MySQL Backend connected.');
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
