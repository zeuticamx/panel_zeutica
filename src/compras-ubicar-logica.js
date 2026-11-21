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
  // `multiplo` (piezas por caja de la celda elegida, opcional) anticipa el 422 del backend:
  // la cantidad va en piezas y debe ser múltiplo exacto. Manda el backend.
  function validarReparto(form, pendiente, multiplo) {
    const celda = String(form?.warehouse_id ?? '').trim();
    if (!celda) return { error: 'Indica la ubicación' };
    const cantidad = Number(form?.cantidad);
    if (!Number.isInteger(cantidad) || cantidad <= 0) return { error: 'La cantidad debe ser un entero mayor a 0' };
    if (cantidad > Number(pendiente)) return { error: `Solo quedan ${pendiente} por ubicar` };
    const m = Number(multiplo);
    if (Number.isInteger(m) && m > 1 && cantidad % m !== 0) {
      return { error: `Las piezas deben ser múltiplo de ${m} (piezas por caja de este SKU)` };
    }
    const cama = form?.cama === '' || form?.cama == null ? 0 : Number(form.cama);
    if (!Number.isInteger(cama) || cama < 0) return { error: 'La cama debe ser un entero de 0 o más' };
    return { datos: { warehouse_id: celda, cantidad, cama } };
  }

  // Texto «= X cajas × M» para mostrar bajo el campo; null si no hay cantidad válida o el múltiplo es 1.
  function equivalenteCajas(cantidad, multiplo) {
    const n = Number(cantidad);
    const m = Number(multiplo);
    if (!Number.isInteger(n) || n <= 0 || !Number.isInteger(m) || m <= 1) return null;
    if (n % m !== 0) return `No es múltiplo de ${m}`;
    return `= ${n / m} ${n / m === 1 ? 'caja' : 'cajas'} × ${m} pzas`;
  }

  // Venta directa: mercancía comprada para mandarse al cliente sin tarjeta de ubicación.
  function formularioVentaDirecta(item) {
    return { cliente_id: '', cantidad: String(item?.pendiente ?? ''), referencia: '', nota: '' };
  }

  // Valida y arma el body de POST /compras/{id}/venta-directa (mismos límites que el backend; manda el backend).
  function validarVentaDirecta(form, pendiente) {
    const clienteId = Number(form?.cliente_id);
    if (form?.cliente_id === '' || form?.cliente_id == null || !Number.isInteger(clienteId) || clienteId <= 0) {
      return { error: 'Elige el cliente del catálogo' };
    }
    const cantidad = Number(form?.cantidad);
    if (!Number.isInteger(cantidad) || cantidad <= 0) return { error: 'La cantidad debe ser un entero mayor a 0' };
    if (cantidad > Number(pendiente)) return { error: `Solo quedan ${pendiente} por asignar` };
    const referencia = String(form?.referencia ?? '').trim();
    const nota = String(form?.nota ?? '').trim();
    if (referencia.length > 255) return { error: 'La referencia admite máximo 255 caracteres' };
    if (nota.length > 500) return { error: 'La nota admite máximo 500 caracteres' };
    const datos = { cantidad, cliente_id: clienteId };
    if (referencia) datos.referencia = referencia;
    if (nota) datos.nota = nota;
    return { datos };
  }

  const mod = { contarPendientes, formularioInicial, validarReparto, equivalenteCajas, formularioVentaDirecta, validarVentaDirecta };
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else root.comprasUbicarLogica = mod;
})(typeof self !== 'undefined' ? self : this);
