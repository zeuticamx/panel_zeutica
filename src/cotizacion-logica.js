// ===== Lógica pura de la cotización nueva (payload de /genera-cotizacion) =====
// Dual: global en el navegador (window.cotizacionLogica) y CommonJS en tests.
(function (root) {
  const r2 = n => Math.round((Number(n) || 0) * 100) / 100;

  // Arma el body de POST /genera-cotizacion. El backend genera el PDF con estos
  // datos, así que lo que aquí se mande es lo que sale impreso.
  // - empresa es el nombre del cliente: Skydropx cruza la cotización con el cliente por ahí.
  // - items y subtotal llevan el descuento ya aplicado; descuento_* solo pinta la fila en el PDF.
  function armarPayloadCotizacion({
    clienteNombre, clienteObj, items, descuentoPct, descuentoMonto, subtotalDesc,
    costoEnvio, iva, totalFinal, formaPago, metodoPago, comentario, usuario,
  }) {
    const c = clienteObj || {};
    const factor = 1 - (Number(descuentoPct) || 0) / 100;
    return {
      empresa: clienteNombre,
      // NOMBRE en el PDF: el contacto del cliente; si no hay, el propio nombre.
      atencion: c.atencion || c.contacto || clienteNombre || '',
      email: c.email || '',
      domicilio: c.direccion || c.domicilio || '',
      // El esquema exige texto y la BD de clientes guarda el teléfono como número.
      telefono: c.telefono != null && c.telefono !== 0 ? String(c.telefono) : '',
      subtotal: r2(subtotalDesc),
      iva: r2(iva),
      total: r2(totalFinal),
      costo_envio: r2(costoEnvio),
      forma_pago: formaPago,
      metodo_pago: metodoPago,
      comentarios: comentario || '',
      usuario: usuario || '',
      descuento_porcentaje: Number(descuentoPct) || 0,
      descuento_monto: r2(descuentoMonto),
      items: (items || []).map(i => ({
        sku: i.sku,
        nombre_producto: i.nombre,
        cantidad: i.cantidad,
        precio_unitario: r2(i.precio * factor),
        total_linea: r2(i.cantidad * i.precio * factor),
      })),
    };
  }

  // Nombre del archivo descargado; se quitan caracteres que Windows no acepta.
  function nombreArchivoCotizacion(codigo, cliente) {
    const limpio = s => String(s || '').replace(/[\\/:*?"<>|]+/g, '').trim();
    const partes = ['Cotizacion', limpio(codigo), limpio(cliente)].filter(Boolean);
    return `${partes.join('_')}.pdf`;
  }

  const mod = { armarPayloadCotizacion, nombreArchivoCotizacion };

  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else root.cotizacionLogica = mod;
})(typeof self !== 'undefined' ? self : this);
