// ===== Lógica pura de la cotización nueva (payload de /genera-cotizacion) =====
// Dual: global en el navegador (window.cotizacionLogica) y CommonJS en tests.
(function (root) {
  const r2 = n => Math.round((Number(n) || 0) * 100) / 100;

  // Textos de relleno que el equipo captura cuando no hay dato real en contacto/empresa.
  const PLACEHOLDERS = ['NO REQUERIDO', 'NO PROPORCIONO', 'NO APLICA', 'N/A', 'NA', 'S/N', '-'];
  const dato = v => {
    const t = String(v == null ? '' : v).trim();
    return PLACEHOLDERS.includes(t.toUpperCase()) ? '' : t;
  };

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
      // NOMBRE en el PDF: el contacto del cliente; si no hay (o es relleno tipo
      // "NO REQUERIDO"), el propio nombre del cliente.
      atencion: dato(c.atencion) || dato(c.contacto) || clienteNombre || '',
      // EMPRESA en el PDF: la empresa registrada del cliente (solo impresión; en BD
      // `empresa` sigue siendo el nombre). Vacío si el cliente no tiene empresa.
      empresa_pdf: dato(c.empresa),
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

  // Registro de POST /relacionFactura para UNA cotización, o null si no cambió nada
  // respecto a `original` (mismas claves: relacion_factura, forma_pago, fecha_pago).
  function armarRegistroRelacion(cot, editado, original) {
    const e = editado || {};
    const o = original || {};
    const sinCambios = (e.relacion_factura || '') === (o.relacion_factura || '')
      && (e.forma_pago || '') === (o.forma_pago || '')
      && (e.fecha_pago || '') === (o.fecha_pago || '');
    if (sinCambios) return null;
    return {
      id: cot?.id ?? null,
      nombre: cot?.empresa || null,
      codigo_cotizacion: cot?.codigo_cotizacion,
      relacion_factura: String(e.relacion_factura || '').trim() || null,
      forma_pago: e.forma_pago || null,
      // Alias: el endpoint aún espera metodo_pago para esta columna.
      metodo_pago: e.forma_pago || null,
      fecha_pago: e.fecha_pago || null,
    };
  }

  // ---- Cancelación (borrado lógico). Solo anticipa: manda el backend (409/403/404). ----
  const estaCancelada = c => !!c && Number(c.cancelada) === 1;
  const esAutor = (c, usuario) =>
    !!usuario && !!c?.usuario && String(c.usuario).trim().toLowerCase() === String(usuario).trim().toLowerCase();

  // Espejo de POST /cotizaciones/{codigo}/cancelar: autor o gerencia, y ni cancelada, ni
  // vendida, ni con factura relacionada. `motivo` explica por qué no (para el tooltip).
  function puedeCancelar(c, usuario, gerencia) {
    if (estaCancelada(c)) return { ok: false, motivo: 'Ya está cancelada' };
    if (c?.vendido) return { ok: false, motivo: 'Ya está vendida' };
    if (String(c?.relacion_factura || '').trim()) return { ok: false, motivo: 'Tiene factura relacionada' };
    if (!gerencia && !esAutor(c, usuario)) return { ok: false, motivo: 'Solo su autor o gerencia puede cancelarla' };
    return { ok: true, motivo: '' };
  }

  // Espejo de POST /cotizaciones/{codigo}/reactivar.
  function puedeReactivar(c, usuario, gerencia) {
    if (!estaCancelada(c)) return { ok: false, motivo: 'No está cancelada' };
    if (!gerencia && !esAutor(c, usuario)) return { ok: false, motivo: 'Solo su autor o gerencia puede reactivarla' };
    return { ok: true, motivo: '' };
  }

  // Una cancelada no cotiza envíos ni compra guías con Skydropx.
  const puedeEnviar = c => !estaCancelada(c);

  // Sin fecha de vencimiento se considera vigente (no se esconde por un dato faltante).
  const esVigente = (c, hoy) => !c?.fecha_vencimiento || String(c.fecha_vencimiento).slice(0, 10) >= hoy;

  // Pestañas de la tabla. Las canceladas salen de todas menos de «Canceladas» y «Todas».
  function coincideConPestana(c, pestana, hoy) {
    const cancelada = estaCancelada(c);
    switch (pestana) {
      case 'canceladas': return cancelada;
      case 'todos': return true;
      case 'vigentes': return !cancelada && esVigente(c, hoy);
      // Una vendida ya se cerró: no cuenta como vencida aunque pase su fecha.
      case 'vencidas': return !cancelada && !c.vendido && !esVigente(c, hoy);
      case 'abiertas': return !cancelada && !c.vendido;
      case 'vendidas': return !cancelada && !!c.vendido;
      default: return !cancelada;
    }
  }

  // Cotizaciones que siguen vivas: no vendidas, no canceladas y vigentes (KPIs y pipeline).
  const esAbiertaVigente = (c, hoy) => !estaCancelada(c) && !c.vendido && esVigente(c, hoy);

  // Seguimiento: catálogo cerrado (espejo de servicios/cotizacion_seguimiento.py; manda el backend).
  // «OTROS» lleva un detalle de texto libre en seguimiento_otros.
  const SEGUIMIENTOS = ['ESPERANDO', 'PAGADO', 'ENVIADO', 'ENTREGADO', 'OTROS'];
  const SEGUIMIENTO_OTROS_MAX = 255;
  const limpiarDetalle = t => String(t == null ? '' : t).split(/\s+/).filter(Boolean).join(' ');

  // Estado de seguimiento de una cotización como {valor, otros}. Un texto libre anterior al
  // catálogo se muestra como OTROS con ese texto (sin migrar la BD).
  function seguimientoDe(c) {
    const crudo = String(c?.seguimiento ?? '').trim();
    if (!crudo) return { valor: '', otros: '' };
    const mayus = crudo.toUpperCase();
    if (SEGUIMIENTOS.includes(mayus)) {
      return { valor: mayus, otros: mayus === 'OTROS' ? limpiarDetalle(c?.seguimiento_otros) : '' };
    }
    return { valor: 'OTROS', otros: limpiarDetalle(crudo).slice(0, SEGUIMIENTO_OTROS_MAX) };
  }

  function validarSeguimiento(valor, otros) {
    if (!valor) return { ok: true, motivo: '' };
    if (!SEGUIMIENTOS.includes(valor)) return { ok: false, motivo: 'Seguimiento inválido' };
    if (valor !== 'OTROS') return { ok: true, motivo: '' };
    const d = limpiarDetalle(otros);
    if (!d) return { ok: false, motivo: 'Con OTROS escribe el detalle' };
    if (d.length > SEGUIMIENTO_OTROS_MAX) return { ok: false, motivo: `Máximo ${SEGUIMIENTO_OTROS_MAX} caracteres` };
    return { ok: true, motivo: '' };
  }

  const mismoSeguimiento = (a, b) =>
    (a?.valor || '') === (b?.valor || '') &&
    (a?.valor === 'OTROS' ? limpiarDetalle(a.otros) === limpiarDetalle(b?.otros) : true);

  // Cuerpo para api.actualizarSeguimiento: sin valor = null (sin seguimiento).
  const armarPayloadSeguimiento = (valor, otros) => ({
    seguimiento: valor || null,
    seguimiento_otros: valor === 'OTROS' ? limpiarDetalle(otros) : null,
  });

  const mod = {
    SEGUIMIENTOS, SEGUIMIENTO_OTROS_MAX, seguimientoDe, validarSeguimiento, mismoSeguimiento, armarPayloadSeguimiento,
    armarPayloadCotizacion, nombreArchivoCotizacion, armarRegistroRelacion,
    estaCancelada, puedeCancelar, puedeReactivar, puedeEnviar, esVigente, coincideConPestana, esAbiertaVigente,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else root.cotizacionLogica = mod;
})(typeof self !== 'undefined' ? self : this);
