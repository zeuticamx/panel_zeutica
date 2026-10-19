// ===== Escape de HTML para plantillas con innerHTML (ticket de venta, etc.) =====
// Dual: global en el navegador (window.htmlSeguro) y CommonJS en tests.
// Todo texto que venga de datos (nombres de producto o cliente, usuario...) se escapa antes de
// interpolarlo en un template string que termina en innerHTML.
(function (root) {
  const MAPA = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };

  function esc(valor) {
    return String(valor ?? '').replace(/[&<>"'`]/g, c => MAPA[c]);
  }

  const mod = { esc };
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else root.htmlSeguro = mod;
})(typeof self !== 'undefined' ? self : this);
