// ===== Compras por ubicar =====
// Dual: global en el navegador (window.comprasUbicarLogica) y CommonJS en tests.
// Qué falta por ubicar y cuándo queda ubicada una compra lo decide el backend
// (api_zeutica1/compras_ubicacion_logica.py): aquí solo se valida el formulario y se arma el payload.
(function (root) {
  // Piezas pendientes de todas las facturas devueltas por GET /compras/por-ubicar.
  function contarPendientes(facturas) {
    let lineas = 0;
    let piezas = 0;
    (facturas || []).forEach(f => (f.items || []).forEach(i => { lineas += 1; piezas += Number(i.pendiente) || 0; }));
    return { lineas, piezas };
  }

  // Valores iniciales del formulario de una línea: por defecto todo lo pendiente a una sola celda.
  function formularioInicial(item) {
    return { warehouse_id: '', cantidad: String(item?.pendiente ?? ''), cama: '0' };
  }

  // Valida lo capturado y arma el body de POST /compras/{id}/ubicar.
  function validarReparto(form, pendiente) {
    const celda = String(form?.warehouse_id ?? '').trim();
    if (!celda) return { error: 'Indica la ubicación' };
    const cantidad = Number(form?.cantidad);
    if (!Number.isInteger(cantidad) || cantidad <= 0) return { error: 'La cantidad debe ser un entero mayor a 0' };
    if (cantidad > Number(pendiente)) return { error: `Solo quedan ${pendiente} por ubicar` };
    const cama = form?.cama === '' || form?.cama == null ? 0 : Number(form.cama);
    if (!Number.isInteger(cama) || cama < 0) return { error: 'La cama debe ser un entero de 0 o más' };
    return { datos: { warehouse_id: celda, cantidad, cama } };
  }

  const mod = { contarPendientes, formularioInicial, validarReparto };
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else root.comprasUbicarLogica = mod;
})(typeof self !== 'undefined' ? self : this);
