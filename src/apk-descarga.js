// ===== Descarga del APK de la app móvil =====
// Dual: global en el navegador (window.apkDescarga) y CommonJS en tests.
// El backend (GET /app/download-url) firma una URL de S3 de 5 minutos; aquí solo se valida
// que la URL sea de S3 antes de redirigir (no se sigue a cualquier host que llegue en la
// respuesta), se detecta Android para el aviso y se traducen los errores.
// A propósito NO termina en «-logica.js»: así `logica:sync` no lo copia a app_movil.
(function (root) {
  const NOTA_INSTALACION = 'Si es tu primera instalación, Android te pedirá permitir «Instalar aplicaciones desconocidas» para tu navegador.';
  const AVISO_NO_ANDROID = 'Este instalador es solo para teléfonos Android. Ábrelo desde el navegador del teléfono para instalarlo.';

  // Solo https y hosts de S3 (bucket.s3.region.amazonaws.com o s3.region.amazonaws.com).
  function urlDescargaValida(url) {
    if (typeof url !== 'string' || !url) return false;
    let u;
    try { u = new URL(url); } catch { return false; }
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return false;
    const host = u.hostname.toLowerCase();
    return /(^|\.)s3[.-]([a-z0-9-]+\.)?amazonaws\.com$/.test(host);
  }

  function esAndroid(userAgent) {
    return /android/i.test(String(userAgent || ''));
  }

  // Tamaño legible; sin dato = '—' (nunca 0).
  function formatoTamano(bytes) {
    const n = Number(bytes);
    if (bytes === null || bytes === undefined || bytes === '' || !Number.isFinite(n) || n < 0) return '—';
    if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  // Mensaje para el toast a partir de la respuesta de api.jsx ({ ok, status, detalle }).
  function mensajeError(r) {
    const status = r && r.status;
    if (status === 0) return 'Sin conexión con el servidor. Intenta de nuevo.';
    if (status === 404) return 'El instalador de la app no está disponible por ahora.';
    if (status === 503) return 'La descarga de la app no está configurada en el servidor.';
    if (status === 401) return 'Tu sesión terminó. Vuelve a iniciar sesión.';
    return (r && r.detalle) || 'No se pudo generar el enlace de descarga.';
  }

  // Revisa la respuesta del backend: { url, filename } o { error }.
  function leerRespuesta(data) {
    const url = data && data.download_url;
    if (!urlDescargaValida(url)) return { error: 'El servidor devolvió un enlace de descarga no válido.' };
    return { url, filename: (data && data.filename) || 'app-zeutica.apk' };
  }

  const mod = { urlDescargaValida, esAndroid, formatoTamano, mensajeError, leerRespuesta, NOTA_INSTALACION, AVISO_NO_ANDROID };
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else root.apkDescarga = mod;
})(typeof self !== 'undefined' ? self : this);
