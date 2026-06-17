(function () {
  'use strict';

  var QR_URL = 'js/qrcode.min.js';
  var promise = null;

  window.ensureQRCode = function () {
    if (typeof QRCode !== 'undefined') return Promise.resolve(QRCode);
    if (!promise) {
      promise = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = QR_URL;
        s.defer = true;
        s.onload = function () { resolve(window.QRCode); };
        s.onerror = function () { reject(new Error('Failed to load QRCode')); };
        document.head.appendChild(s);
      });
    }
    return promise;
  };
})();
