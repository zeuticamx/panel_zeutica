// ===== Reversión de traspasos (Traspaso FULL / Clean) =====
// Dual: global en el navegador (window.traspasosRevertir) y CommonJS en tests.
// Qué se puede revertir lo decide el backend (api_zeutica1/traspaso_reversion_logica.py, plazo de
// 15 días con el reloj de la BD): aquí solo se traduce etiquetas, se explica por qué no se ofrece
// el botón y se arma el payload. A propósito NO termina en «-logica.js»: así `logica:sync` no lo
// copia a app_movil (la app no tiene esta pantalla).
(function (root) {
  const ETIQUETAS = {
    BAJA: 'FULL (baja)',
    CLEAN: 'Clean',
    'REV-BAJA': 'Reversión FULL',
    'REV-CLEAN': 'Reversión Clean',
  };
  const MOTIVO_MAX = 500;

  function etiquetaTipo(almacen) {
    const clave = String(almacen ?? '').trim();
    if (!clave) return '—';
    return ETIQUETAS[clave.toUpperCase()] || clave;
  }

  // { puede, motivo }: `motivo` es el texto del tooltip cuando el botón va deshabilitado.
  function estadoReversion(t) {
    if (t?.revertible === true) return { puede: true, motivo: '' };
    if (t?.revertido) return { puede: false, motivo: 'Ya fue revertido' };
    if (String(t?.almacen ?? '').toUpperCase().startsWith('REV-')) {
      return { puede: false, motivo: 'Es una reversión: no se revierte' };
    }
    return { puede: false, motivo: 'Fuera del plazo de 15 días o no es un traspaso revertible' };
  }

  function textoConfirmacion(t) {
    const piezas = Math.abs(Number(t?.cantidad) || 0);
    const clean = String(t?.almacen ?? '').toUpperCase() === 'CLEAN';
    return clean
      ? `¿Revertir el traspaso de ${piezas} uds. de ${t.sku} a Clean? Se restarán de Clean y volverán a bodega.`
      : `¿Revertir la baja a FULL de ${piezas} uds. de ${t.sku}? Las piezas volverán a bodega.`;
  }

  // Body de POST /traspasos/{id}/revertir: el motivo es opcional.
  function armarPayloadReversion(motivo) {
    const texto = String(motivo ?? '').trim();
    if (texto.length > MOTIVO_MAX) return { error: `El motivo admite máximo ${MOTIVO_MAX} caracteres` };
    return { datos: texto ? { motivo: texto } : {} };
  }

  const mod = { etiquetaTipo, estadoReversion, textoConfirmacion, armarPayloadReversion, MOTIVO_MAX };
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else root.traspasosRevertir = mod;
})(typeof self !== 'undefined' ? self : this);
