// ===== Lógica pura del alta de clientes (la usan Clientes y Cotizaciones) =====
// Dual: global en el navegador (window.clienteAlta) y CommonJS en tests.
(function (root) {
  // Domicilio estructurado (calle, número, interior, colonia, CP, municipio, estado): lógica en domicilio-logica.js.
  const D = (typeof module !== 'undefined' && module.exports) ? require('./domicilio-logica.js') : root.domicilioLogica;

  const CLIENTE_BLANK = {
    nombre: '', empresa: '', contacto: '', email: '', telefono: 0, direccion: '',
    calle: '', numero: '', interior: '', colonia: '', municipio: '', estado: '',
    rfc: '', cp: '', regimen: '', uso_cfdi: '', frecuencia: '',
    credito: false, monto_credito: 0, dias_credito: 0,
  };

  const t = v => String(v ?? '').trim();

  // Campos del domicilio tal como se envían. `direccion` (texto libre anterior) solo viaja si el cliente
  // aún no tiene domicilio estructurado: con campos nuevos el backend compone `direccion` por su cuenta.
  function camposDomicilio(form) {
    return {
      calle: t(form.calle), numero: t(form.numero), interior: t(form.interior), colonia: t(form.colonia),
      municipio: t(form.municipio), estado: t(form.estado), cp: D.cpATexto(form.cp),
    };
  }

  // Devuelve null si es válido o el mensaje de error.
  function validarCliente(form) {
    if (!String(form?.nombre ?? '').trim()) return 'El nombre del cliente es obligatorio';
    return D.validarDomicilio(form);
  }

  function armarPayloadCliente(form, usuario) {
    return {
      nombre: String(form.nombre).trim(),
      email: form.email,
      empresa: form.empresa,
      contacto: form.contacto,
      telefono: Number(form.telefono) || 0,
      direccion: form.direccion || '',
      ...camposDomicilio(form),
      rfc: form.rfc,
      regimen: form.regimen,
      uso_cfdi: form.uso_cfdi,
      // Nombre histórico (con typo) que lee el backend desplegado antes de aceptar uso_cfdi.
      usocdfi: form.uso_cfdi,
      frecuencia: form.frecuencia,
      usuario: usuario || '',
      credito: !!form.credito,
      monto_credito: Number(form.monto_credito) || 0,
      dias_credito: Number(form.dias_credito) || 0,
    };
  }

  // Valores iniciales del formulario de edición a partir del cliente de la API.
  function clienteAFormulario(c) {
    c = c || {};
    return {
      nombre: c.nombre || '', empresa: c.empresa || '', contacto: c.contacto || '',
      email: c.email || '', telefono: c.telefono || 0,
      calle: c.calle || '', numero: c.numero || '', interior: c.interior || '', colonia: c.colonia || '',
      municipio: c.municipio || '', estado: c.estado || '',
      // El texto libre anterior solo se conserva (y se muestra como referencia) mientras no haya domicilio nuevo.
      direccion: D.tieneDomicilioEstructurado(c) ? '' : (c.direccion || ''),
      rfc: c.rfc || '', cp: D.cpATexto(c.cp), regimen: c.regimen || '',
      // GET /clientes devuelve la columna de BD tal cual: usocfdi
      uso_cfdi: c.uso_cfdi || c.usocfdi || '', frecuencia: c.frecuencia || '',
      credito: !!c.credito, monto_credito: c.monto_credito || 0, dias_credito: c.dias_credito || 0,
    };
  }

  // Payload de POST /editcliente: el del alta más el id del cliente.
  function armarPayloadEdicion(form, id, usuario) {
    return { ...armarPayloadCliente(form, usuario), id };
  }

  // Campos del formulario tal como se envían (números ya convertidos), para comparar contra el original.
  function camposDeFormulario(form) {
    return {
      nombre: String(form.nombre ?? '').trim(), email: form.email, empresa: form.empresa, contacto: form.contacto,
      telefono: Number(form.telefono) || 0, direccion: form.direccion || '', ...camposDomicilio(form), rfc: form.rfc,
      regimen: form.regimen, uso_cfdi: form.uso_cfdi, frecuencia: form.frecuencia,
      credito: !!form.credito, monto_credito: Number(form.monto_credito) || 0, dias_credito: Number(form.dias_credito) || 0,
    };
  }

  // Payload de PATCH /prospectos/{id}: solo lo que cambió respecto al prospecto original (así no se pisan
  // campos que otra persona editó). `vendedor` solo viaja si gerencia lo cambió. {} = sin cambios.
  function armarPayloadProspectoEdicion(form, original, vendedor) {
    const nuevo = camposDeFormulario(form);
    const base = camposDeFormulario(clienteAFormulario(original));
    const payload = {};
    Object.keys(nuevo).forEach(k => { if (nuevo[k] !== base[k]) payload[k] = nuevo[k]; });
    const v = String(vendedor ?? '').trim();
    if (v && v.toLowerCase() !== String(original?.vendedor ?? '').trim().toLowerCase()) payload.vendedor = v;
    return payload;
  }

  // Nombre que debe quedar seleccionado en el selector de cotizaciones (que usa
  // el nombre como valor). Se prefiere el id que devolvió el backend y se cae al
  // nombre enviado si la lista recargada aún no lo trae.
  function seleccionarClienteCreado(clientes, respuesta, nombreEnviado) {
    const lista = Array.isArray(clientes) ? clientes : [];
    const id = respuesta?.id ?? respuesta?.['id '];
    const porId = id != null ? lista.find(c => String(c.id) === String(id)) : null;
    if (porId) return porId.nombre;
    const nombre = String(respuesta?.nombre ?? nombreEnviado ?? '').trim();
    return nombre || '';
  }

  const mod = { CLIENTE_BLANK, validarCliente, armarPayloadCliente, clienteAFormulario, armarPayloadEdicion, armarPayloadProspectoEdicion, seleccionarClienteCreado };

  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else root.clienteAlta = mod;
})(typeof self !== 'undefined' ? self : this);
