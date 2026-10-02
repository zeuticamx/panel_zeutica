// ===== Lógica pura del alta de clientes (la usan Clientes y Cotizaciones) =====
// Dual: global en el navegador (window.clienteAlta) y CommonJS en tests.
(function (root) {
  const CLIENTE_BLANK = {
    nombre: '', empresa: '', contacto: '', email: '', telefono: 0, direccion: '',
    rfc: '', cp: 0, regimen: '', uso_cfdi: '', frecuencia: '',
    credito: false, monto_credito: 0, dias_credito: 0,
  };

  // Devuelve null si es válido o el mensaje de error.
  function validarCliente(form) {
    if (!String(form?.nombre ?? '').trim()) return 'El nombre del cliente es obligatorio';
    return null;
  }

  function armarPayloadCliente(form, usuario) {
    return {
      nombre: String(form.nombre).trim(),
      email: form.email,
      empresa: form.empresa,
      contacto: form.contacto,
      telefono: Number(form.telefono) || 0,
      direccion: form.direccion,
      rfc: form.rfc,
      cp: Number(form.cp) || 0,
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
      email: c.email || '', telefono: c.telefono || 0, direccion: c.direccion || '',
      rfc: c.rfc || '', cp: c.cp || 0, regimen: c.regimen || '',
      // GET /clientes devuelve la columna de BD tal cual: usocfdi
      uso_cfdi: c.uso_cfdi || c.usocfdi || '', frecuencia: c.frecuencia || '',
      credito: !!c.credito, monto_credito: c.monto_credito || 0, dias_credito: c.dias_credito || 0,
    };
  }

  // Payload de POST /editcliente: el del alta más el id del cliente.
  function armarPayloadEdicion(form, id, usuario) {
    return { ...armarPayloadCliente(form, usuario), id };
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

  const mod = { CLIENTE_BLANK, validarCliente, armarPayloadCliente, clienteAFormulario, armarPayloadEdicion, seleccionarClienteCreado };

  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else root.clienteAlta = mod;
})(typeof self !== 'undefined' ? self : this);
