// ===== Lógica pura de Ubicaciones: total de piezas = cantidad * múltiplo según SKU =====
// Dual: global en el navegador (window.ubicacionesLogica) y CommonJS en tests.
(function (root) {
  const MULTIPLO_DEFAULT = 10;
  const MULTIPLOS_POR_SKU = {
    CUBMANBLA: 20,
    CUBBARBLA: 20,
    BOLECO17: 20,
    BOLECO38: 5,
  };

  // Regla: en la ubicación "Oficina" (sin importar mayúsculas) la cantidad se multiplica por 1.
  function esOficina(warehouseId) {
    return String(warehouseId ?? '').trim().toLowerCase() === 'oficina';
  }

  function obtenerMultiplo(sku, warehouseId) {
    if (esOficina(warehouseId)) return 1;
    const clave = String(sku ?? '').trim().toUpperCase();
    return Object.prototype.hasOwnProperty.call(MULTIPLOS_POR_SKU, clave)
      ? MULTIPLOS_POR_SKU[clave]
      : MULTIPLO_DEFAULT;
  }

  function calcularTotalPiezas(cantidad, sku, warehouseId) {
    const n = Number(cantidad);
    if (!Number.isFinite(n) || n < 0) return 0;
    return n * obtenerMultiplo(sku, warehouseId);
  }

  function sumarTotalPiezas(ubicaciones, sku) {
    return (ubicaciones || []).reduce(
      (acc, ub) => acc + calcularTotalPiezas(ub?.cantidad, ub?.sku || sku, ub?.warehouse_id), 0);
  }

  const mod = { MULTIPLO_DEFAULT, MULTIPLOS_POR_SKU, obtenerMultiplo, calcularTotalPiezas, sumarTotalPiezas };

  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else root.ubicacionesLogica = mod;
})(typeof self !== 'undefined' ? self : this);
