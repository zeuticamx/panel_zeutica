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
      frecuencia: form.frecuencia,
      usuario: usuario || '',
      credito: !!form.credito,
      monto_credito: Number(form.monto_credito) || 0,
      dias_credito: Number(form.dias_credito) || 0,
    };
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

  const mod = { CLIENTE_BLANK, validarCliente, armarPayloadCliente, seleccionarClienteCreado };

  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else root.clienteAlta = mod;
})(typeof self !== 'undefined' ? self : this);
