// ===== Lógica pura de Gastos operativos: validación y payload de edición =====
// Dual: global en el navegador (window.gastosLogica) y CommonJS en tests.
(function (root) {
  // Devuelve null si es válido o el mensaje de error (mismas reglas que el backend).
  function validarGasto(form) {
    if (!String(form?.descripcion ?? '').trim()) return 'La descripción es obligatoria';
    const costo = Number(form?.costo);
    if (form?.costo === '' || form?.costo == null || !Number.isFinite(costo) || costo < 0) return 'El monto debe ser un número mayor o igual a 0';
    const cantidad = Number(form?.cantidad);
    if (form?.cantidad === '' || form?.cantidad == null || !Number.isInteger(cantidad) || cantidad < 1) return 'La cantidad debe ser un entero mayor o igual a 1';
    return null;
  }

  function armarPayloadGasto(form) {
    return {
      descripcion: String(form.descripcion).trim(),
      costo: Number(form.costo),
      cantidad: Number(form.cantidad),
    };
  }

  // Valores del formulario de edición a partir de una fila de la consulta.
  function formDesdeGasto(g) {
    return { id: g.id, descripcion: g.descripcion ?? '', costo: g.costo ?? '', cantidad: g.cantidad ?? '' };
  }

  const mod = { validarGasto, armarPayloadGasto, formDesdeGasto };

  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else root.gastosLogica = mod;
})(typeof self !== 'undefined' ? self : this);
