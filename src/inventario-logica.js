// ===== Inventario: eliminar SKU =====
// Dual: global en el navegador (window.inventarioLogica) y CommonJS en tests.
// La regla manda en el backend (DELETE /producto/{sku}, api_zeutica1/routers/productos.py);
// aquí solo se anticipa para deshabilitar el botón y armar el texto de la confirmación.
(function (root) {
  const CAMPOS_STOCK = ['stock_bodega', 'stock_fba', 'stock_clean', 'stock_total'];

  // stock_total es una columna autogenerada por las demás bodegas: se revisan las cuatro.
  // Cualquier existencia distinta de 0 (también negativa) impide eliminar.
  function puedeEliminar(p) {
    const con = CAMPOS_STOCK.filter(c => (Number(p?.[c]) || 0) !== 0);
    if (con.length === 0) return { ok: true, motivo: '' };
    return {
      ok: false,
      motivo: `Tiene inventario (bodega ${Number(p.stock_bodega) || 0}, FBA ${Number(p.stock_fba) || 0}, `
        + `Clean ${Number(p.stock_clean) || 0}, total ${Number(p.stock_total) || 0}): debe estar en 0`,
    };
  }

  // Texto del modal de confirmación; avisa que las tarjetas de ubicación también se borran.
  function mensajeConfirmarEliminar(p) {
    return `¿Eliminar el SKU ${p.sku} (${p.nombre})? Dejará de verse en el inventario y en los catálogos; `
      + 'el producto se conserva para consultas futuras y gerencia puede restaurarlo. '
      + 'Sus tarjetas de ubicación en bodega se eliminarán.';
  }

  function mensajeConfirmarRestaurar(p) {
    return `¿Restaurar el SKU ${p.sku} (${p.nombre})? Volverá a verse en el inventario; sus tarjetas de ubicación no se recuperan.`;
  }

  const mod = { puedeEliminar, mensajeConfirmarEliminar, mensajeConfirmarRestaurar };
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else root.inventarioLogica = mod;
})(typeof self !== 'undefined' ? self : this);
