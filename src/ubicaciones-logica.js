// ===== Lógica pura de Ubicaciones: total de piezas = cantidad * múltiplo según SKU =====
// Dual: global en el navegador (window.ubicacionesLogica) y CommonJS en tests.
(function (root) {
  const MULTIPLO_DEFAULT = 10;
  const MULTIPLOS_POR_SKU = {
    CUBMANBLA: 20,
    CUBBARBLA: 20,
    BOLECO17: 20,
    BOLECO38: 5,
    BOLECO30: 5,
    ESPFARBLA: 1,
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

  // Valida un traspaso entre tarjetas del mismo SKU. null = válido.
  // stockOrigen es la cantidad actual de la tarjeta origen.
  // Si se empaqueta (origen Oficina -> anaquel), la cantidad debe ser
  // múltiplo exacto del múltiplo del SKU.
  function validarTraspaso({ origenId, destinoId, cantidad, stockOrigen, multiplo, destinoEsOficina, origenEsOficina }) {
    if (origenId == null || origenId === '') return 'Selecciona la ubicación origen';
    if (destinoId == null || destinoId === '') return 'Selecciona la ubicación destino';
    if (String(origenId) === String(destinoId)) return 'El origen y el destino deben ser diferentes';
    const n = Number(cantidad);
    if (!Number.isInteger(n) || n <= 0) return 'La cantidad debe ser un entero mayor a 0';
    const disp = Number(stockOrigen);
    if (!Number.isFinite(disp) || disp < n) return `Stock insuficiente en origen (disponible: ${Number.isFinite(disp) ? disp : 0})`;
    const m = Number(multiplo);
    if (origenEsOficina && !destinoEsOficina && Number.isInteger(m) && m > 1 && n % m !== 0) {
      return `Para empaquetar, la cantidad debe ser múltiplo de ${m}`;
    }
    return null;
  }

  // Detalle del total por tarjeta { cantidad, multiplo, total } o null si inválida.
  function detalleTotalPiezas(cantidad, sku, warehouseId) {
    const n = Number(cantidad);
    if (!Number.isFinite(n) || n < 0) return null;
    const mult = obtenerMultiplo(sku, warehouseId);
    return { cantidad: n, multiplo: mult, total: n * mult };
  }

  // Conversión de un traspaso según la regla Oficina (conserva piezas).
  // destino a Oficina = desempaquetar (×mult); desde Oficina = empaquetar (÷mult).
  // Devuelve { restaOrigen, sumaDestino, factor, modo } o null si inválido.
  // modo: 'directo' | 'desempaquetar' | 'empaquetar'.
  function convertirTraspaso({ cantidad, multiplo, destinoEsOficina, origenEsOficina }) {
    const n = Number(cantidad);
    const m = Number(multiplo);
    if (!Number.isInteger(n) || n <= 0 || !Number.isInteger(m) || m <= 0) return null;
    if (destinoEsOficina && !origenEsOficina) {
      return { restaOrigen: n, sumaDestino: n * m, factor: m, modo: 'desempaquetar' };
    }
    if (origenEsOficina && !destinoEsOficina) {
      return { restaOrigen: n, sumaDestino: n / m, factor: m, modo: 'empaquetar' };
    }
    return { restaOrigen: n, sumaDestino: n, factor: 1, modo: 'directo' };
  }

  const mod = { MULTIPLO_DEFAULT, MULTIPLOS_POR_SKU, esOficina, obtenerMultiplo, calcularTotalPiezas, sumarTotalPiezas, validarTraspaso, detalleTotalPiezas, convertirTraspaso };

  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else root.ubicacionesLogica = mod;
})(typeof self !== 'undefined' ? self : this);
