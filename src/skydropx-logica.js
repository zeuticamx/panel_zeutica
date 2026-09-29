// ===== Zeutica — Lógica del envío Skydropx =====
// Lógica pura (sin JSX) del modal de skydropx_envio.jsx, para poder probarla en
// Node y reutilizarla en la página. En el navegador queda en window.skydropxLogica.

(function (root) {
  // Un solo lugar para armar el paquete: cotizar y generar guía deben mandar
  // exactamente los mismos campos, o el rate_id de la cotización podría no
  // coincidir con lo que se está empaquetando de verdad.
  //
  // consignment_note viaja como string con solo el código SAT: el formulario
  // muestra "53103200 - Ropa Desechable" pero el payload lleva "53103200".
  function construirParcela(paquete) {
    return {
      length: Number(paquete.length),
      width: Number(paquete.width),
      height: Number(paquete.height),
      weight: Number(paquete.weight),
      consignment_note: paquete.consignment_note ? String(paquete.consignment_note).trim() : undefined,
      package_type: (paquete.package_type || '').trim() || undefined,
      package_protected: true,
      declared_value: 2000.0,
    };
  }

  // Un renglón por guía a partir de `paquetes` de POST /skydropx/envios (V2).
  // Con una tarifa "multishipment" cada guía trae su propio shipmentId; con
  // "multipackage" varias guías comparten el mismo.
  function bultosDesdePaquetes(paquetes) {
    return (Array.isArray(paquetes) ? paquetes : []).map((p, i) => ({
      numero: p.package_number || (i + 1),
      tracking: p.tracking_number || '',
      etiqueta: p.etiqueta_url || '',
      shipmentId: p.shipment_id || '',
      packageId: p.package_id || '',
    }));
  }

  // Mismo renglón pero desde GET /skydropx/envios (lo guardado en BD). El
  // backend los devuelve por id DESC; se voltean para numerar en el orden en
  // que se crearon.
  function bultosDesdeEnviosGuardados(envios) {
    return [...(Array.isArray(envios) ? envios : [])].reverse().map((e, i) => ({
      numero: i + 1,
      tracking: e.tracking_number || '',
      etiqueta: e.etiqueta_url || '',
      shipmentId: e.shipment_id || '',
      packageId: e.package_id || '',
    }));
  }

  // La recolección se agenda por shipment. `listo` = todas sus guías ya tienen
  // tracking: antes de eso Skydropx rechaza la recolección ("El estado del
  // envío no es exitoso").
  function shipmentsDeBultos(bultos) {
    const grupos = new Map();
    (bultos || []).forEach((b) => {
      if (!b.shipmentId) return;
      if (!grupos.has(b.shipmentId)) grupos.set(b.shipmentId, []);
      grupos.get(b.shipmentId).push(b);
    });
    return [...grupos.entries()].map(([shipmentId, lista]) => ({
      shipmentId,
      bultos: lista,
      listo: lista.every(b => !!b.tracking),
    }));
  }

  const CAMPOS_DIRECCION = ['country_code', 'postal_code', 'area_level1', 'area_level2', 'area_level3',
    'street1', 'apartment_number', 'name', 'company', 'phone', 'email', 'reference'];

  // El número interior es de ESA dirección: si la plantilla no lo trae, no debe
  // quedarse el de la dirección que estaba antes en el formulario.
  const CAMPOS_SIEMPRE_DE_LA_PLANTILLA = ['apartment_number'];

  // Aplica una dirección de la libreta de Skydropx sobre el formulario. Solo
  // pisa los campos que la plantilla trae con valor: lo que el usuario ya
  // capturó y la plantilla no tiene (p. ej. la referencia) se conserva.
  function aplicarDireccion(formulario, direccion) {
    const out = { ...formulario };
    CAMPOS_DIRECCION.forEach((k) => {
      const v = direccion ? direccion[k] : undefined;
      if (v !== undefined && v !== null && String(v).trim() !== '') out[k] = String(v);
      else if (CAMPOS_SIEMPRE_DE_LA_PLANTILLA.includes(k)) out[k] = '';
    });
    return out;
  }

  // Lo que Skydropx exige para guardar una plantilla (medido en sandbox), con
  // el nombre que ve el usuario en el formulario.
  const REQUERIDOS_PLANTILLA = [
    ['postal_code', 'Código postal'], ['area_level1', 'Estado'], ['area_level2', 'Municipio'],
    ['area_level3', 'Colonia'], ['street1', 'Calle y número'], ['name', 'Nombre'],
    ['phone', 'Teléfono'], ['email', 'Email'], ['reference', 'Referencia'],
  ];

  function faltantesParaGuardarDireccion(direccion) {
    return REQUERIDOS_PLANTILLA
      .filter(([k]) => !String((direccion || {})[k] || '').trim())
      .map(([, etiqueta]) => etiqueta);
  }

  // Payload de POST /skydropx/direcciones a partir del formulario.
  function armarPlantillaDireccion({ alias, tipo, direccion, usuario }) {
    const address = {};
    CAMPOS_DIRECCION.forEach((k) => {
      const v = (direccion || {})[k];
      if (v !== undefined && v !== null && String(v).trim() !== '') address[k] = String(v).trim();
    });
    if (!address.country_code) address.country_code = 'MX';
    return { alias_name: String(alias || '').trim(), address_type: tipo, default: false, address, usuario };
  }

  // ---------- Cajas (presets de medidas) ----------
  // Botones del paquete: los del catálogo propio (GET /skydropx/cajas) o, si
  // no se pudo leer, los fijos de siempre para no dejar el modal sin presets.
  function cajasParaBotones(cajasApi, respaldo) {
    const lista = Array.isArray(cajasApi) ? cajasApi : [];
    if (lista.length === 0) return (respaldo || []).map(p => ({ ...p, package_type: p.package_type || null }));
    return lista.map(c => ({
      id: String(c.id),
      label: c.nombre,
      length: Number(c.length),
      width: Number(c.width),
      height: Number(c.height),
      weight: Number(c.weight),
      package_type: c.package_type || null,
    }));
  }

  function cajaActiva(cajas, paquete) {
    return (cajas || []).find(c =>
      c.length === Number(paquete.length) && c.width === Number(paquete.width) &&
      c.height === Number(paquete.height) && c.weight === Number(paquete.weight)
    ) || null;
  }

  // Aplica una caja al paquete: medidas siempre; package_type solo si la caja lo trae.
  function aplicarCaja(paquete, caja) {
    const out = { ...paquete, length: caja.length, width: caja.width, height: caja.height, weight: caja.weight };
    if (caja.package_type) out.package_type = caja.package_type;
    return out;
  }

  // Payload de POST /skydropx/cajas, o { error } si algo no cuadra.
  function armarCaja(form, usuario) {
    const nombre = String(form.nombre || '').trim().replace(/\s+/g, ' ');
    if (!nombre) return { error: 'Ponle nombre a la caja.' };
    const medidas = {};
    for (const k of ['length', 'width', 'height', 'weight']) {
      const n = Number(form[k]);
      if (!(n > 0)) return { error: 'Largo, ancho, alto y peso deben ser mayores a 0.' };
      medidas[k] = n;
    }
    return { payload: { nombre, ...medidas, package_type: String(form.package_type || '4G').trim() || '4G', usuario } };
  }

  // Opciones del <select> de embalaje. Si el valor actual (p. ej. uno guardado
  // en localStorage) no está en el catálogo, se agrega para no perderlo.
  function opcionesEmbalaje(embalajes, actual) {
    const lista = (Array.isArray(embalajes) ? embalajes : [])
      .filter(e => e && e.code)
      .map(e => ({ code: String(e.code), label: `${e.code} - ${e.name || e.code}` }));
    if (actual && !lista.some(o => o.code === actual)) lista.unshift({ code: actual, label: `${actual} - (no está en el catálogo)` });
    return lista;
  }

  // Mismo criterio que skydropx_service.ventana_en_cobertura() en el backend:
  // la ventana elegida debe caber completa dentro de la que ofrece el carrier.
  function ventanaValida(horario, inicio, fin) {
    if (!horario || !/^\d{2}:\d{2}$/.test(inicio || '') || !/^\d{2}:\d{2}$/.test(fin || '')) return false;
    return inicio < fin && horario.hora_inicio <= inicio && fin <= horario.hora_fin;
  }

  // Payload de POST /skydropx/recolecciones. El peso total sale de las guías
  // de ESE shipment (todas los bultos llevan la misma medida en este modal).
  function armarRecoleccion({ shipment, fecha, inicio, fin, pesoPorBulto, usuario }) {
    const paquetes = shipment.bultos.length || 1;
    return {
      shipment_id: shipment.shipmentId,
      fecha,
      hora_inicio: inicio,
      hora_fin: fin,
      paquetes,
      peso_total: Math.round(paquetes * Number(pesoPorBulto) * 100) / 100,
      usuario,
    };
  }

  const mod = {
    construirParcela,
    bultosDesdePaquetes,
    bultosDesdeEnviosGuardados,
    shipmentsDeBultos,
    aplicarDireccion,
    faltantesParaGuardarDireccion,
    armarPlantillaDireccion,
    cajasParaBotones,
    cajaActiva,
    aplicarCaja,
    armarCaja,
    opcionesEmbalaje,
    ventanaValida,
    armarRecoleccion,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else root.skydropxLogica = mod;
})(typeof self !== 'undefined' ? self : this);
