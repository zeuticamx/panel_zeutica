// ===== Usuarios a quienes se asignan pendientes (Monitor Gerencia) =====
// La lista sale de la BD (GET /usuarios/lista, api.cuentasUsuarios): aquí solo se ordena y se arma el selector.
// Dual: global en el navegador (window.pendientesUsuarios) y require() en los tests.
// El nombre NO termina en «-logica» a propósito: así `logica:sync` no lo copia a app_movil
// (la app tiene su propia versión en core/monitorGerencia.js).
(function (root) {
  const texto = (v) => String(v ?? '').trim();
  const clave = (v) => texto(v).toLowerCase();

  /**
   * Opciones del selector: todas las cuentas por orden alfabético y, si `actual` (el dueño de una tarea
   * que se edita) ya no existe en la BD, se conserva al final con `existe: false` para no reasignarla sin querer.
   * Un `actual` que solo difiere en mayúsculas de una cuenta se toma como esa cuenta.
   * Devuelve [{ valor, etiqueta, existe }].
   */
  function opcionesUsuarios(cuentas, actual) {
    const vistos = new Set();
    const opciones = [];
    (Array.isArray(cuentas) ? cuentas : []).forEach((c) => {
      const nombre = texto(c && typeof c === 'object' ? c.nombre_usuario : c);
      if (!nombre || vistos.has(clave(nombre))) return;
      vistos.add(clave(nombre));
      opciones.push({ valor: nombre, etiqueta: nombre, existe: true });
    });
    opciones.sort((a, b) => a.valor.localeCompare(b.valor, 'es', { sensitivity: 'base' }));
    const dueno = texto(actual);
    if (dueno && !vistos.has(clave(dueno))) opciones.push({ valor: dueno, etiqueta: `${dueno} (ya no existe)`, existe: false });
    return opciones;
  }

  /** Valor del selector para una tarea: el nombre canónico de la cuenta si solo cambia el casing. */
  function usuarioCanonico(cuentas, actual) {
    const k = clave(actual);
    if (!k) return '';
    const hallada = opcionesUsuarios(cuentas, '').find((o) => clave(o.valor) === k);
    return hallada ? hallada.valor : texto(actual);
  }

  const mod = { opcionesUsuarios, usuarioCanonico };
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else root.pendientesUsuarios = mod;
})(typeof self !== 'undefined' ? self : this);
