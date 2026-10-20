// ===== Facturación de ventas (Reportes) =====
// Dual: global en el navegador (window.facturacionLogica) y CommonJS en tests.
// ventasRegistro trae una fila por partida; facturable/facturada son iguales en
// todas las partidas de una venta (el backend las escribe por id_ventas).
(function (root) {
  const verdadero = (v) => v === true || v === 1 || v === '1';

  // 'no_aplica' (no requiere factura), 'pendiente' (requiere y no la tiene) o 'facturada'.
  // Una venta facturada sin haberla pedido (cotización facturada) cuenta como facturada.
  function estadoFactura(venta) {
    if (verdadero(venta?.facturada)) return 'facturada';
    if (verdadero(venta?.facturable)) return 'pendiente';
    return 'no_aplica';
  }

  // Ventas distintas (no partidas) por facturar, sin canceladas: lo mismo que alerta el job.
  function contarPorFacturar(ventas) {
    const ids = new Set();
    (ventas || []).forEach(v => {
      if ((v.estatus || 'activa') !== 'cancelada' && estadoFactura(v) === 'pendiente') ids.add(String(v.id_ventas));
    });
    return ids.size;
  }

  const mod = { estadoFactura, contarPorFacturar };
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else root.facturacionLogica = mod;
})(typeof self !== 'undefined' ? self : this);
