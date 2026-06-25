'use strict';

// Flat config (ESLint 9+). The site is vanilla browser JS in IIFEs with a few
// shared window.RTL3D* globals and vendored libraries (Leaflet, Plotly, GSAP).
// Rules are intentionally light so the existing codebase adopts cleanly.
const globals = {
  // browser
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  location: 'readonly',
  console: 'readonly',
  fetch: 'readonly',
  sessionStorage: 'readonly',
  localStorage: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly',
  URL: 'readonly',
  IntersectionObserver: 'readonly',
  ResizeObserver: 'readonly',
  matchMedia: 'readonly',
  getComputedStyle: 'readonly',
  performance: 'readonly',
  history: 'readonly',
  CustomEvent: 'readonly',
  Event: 'readonly',
  MutationObserver: 'readonly',
  URLSearchParams: 'readonly',
  Blob: 'readonly',
  Image: 'readonly',
  requestIdleCallback: 'readonly',
  cancelIdleCallback: 'readonly',
  // vendored libraries
  L: 'readonly',
  Plotly: 'readonly',
  gsap: 'readonly',
  QRCode: 'readonly',
  // cross-file project globals (defined in one module, used in another)
  toggle3dRepeat: 'readonly',
};

module.exports = [
  {
    ignores: [
      'js/leaflet.js',
      'js/leaflet.fullscreen.js',
      'js/gsap.min.js',
      'js/qrcode.min.js',
      'js/vendor/**',
      '**/*.min.js',
      'data/**',
      'node_modules/**',
    ],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals,
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'none' }],
      'no-undef': 'error',
      'no-var': 'warn',
      'prefer-const': 'warn',
      eqeqeq: ['warn', 'smart'],
    },
  },
  {
    // Node-context files (this config, build helpers)
    files: ['eslint.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { module: 'writable', require: 'readonly', __dirname: 'readonly' },
    },
  },
];
