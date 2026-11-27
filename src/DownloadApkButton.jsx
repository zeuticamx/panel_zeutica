// ===== Botón «Descargar app Android» =====
// Pide al backend una URL prefirmada de S3 (5 min) y redirige a ella: el navegador descarga el
// APK directo de S3 (sin fetch, sin CORS, sin cargar el archivo en memoria). Lógica pura en
// src/apk-descarga.js. Variantes: 'boton' (tarjeta/página) y 'menu' (desplegable de la Topbar).
const { useState: apk_uS, useRef: apk_uR, useEffect: apk_uE } = React;

function DownloadApkButton({ variante = 'boton' }) {
  const toast = window.useToast();
  const A = window.apkDescarga;
  const [cargando, setCargando] = apk_uS(false);
  const timer = apk_uR(null);
  const android = A.esAndroid(navigator.userAgent);

  apk_uE(() => () => clearTimeout(timer.current), []);

  const descargar = async (e) => {
    if (e) e.stopPropagation(); // en el menú no debe cerrarse antes de terminar
    if (cargando) return;
    setCargando(true);
    const r = await api.appDescargaUrl();
    if (!r.ok) {
      setCargando(false);
      toast.error('No se pudo descargar la app', A.mensajeError(r));
      return;
    }
    const leida = A.leerRespuesta(r.data);
    if (leida.error) {
      setCargando(false);
      toast.error('No se pudo descargar la app', leida.error);
      return;
    }
    const tam = A.formatoTamano(r.data.tamano_bytes);
    toast.info('Descarga iniciada', `${leida.filename}${tam !== '—' ? ` · ${tam}` : ''}`);
    window.location.href = leida.url;
    // La página no se va (Content-Disposition: attachment): se libera el botón tras un momento.
    timer.current = setTimeout(() => setCargando(false), 3000);
  };

  const etiqueta = cargando ? 'Preparando descarga…' : 'Descargar app Android';
  const nota = (
    <div className="apk-nota" style={{ fontSize: 11, lineHeight: 1.4, color: 'var(--fg-3)', marginTop: 4 }}>
      {!android && <div style={{ color: 'var(--warn, var(--fg-2))', marginBottom: 2 }}>{A.AVISO_NO_ANDROID}</div>}
      <div>{A.NOTA_INSTALACION}</div>
    </div>
  );

  if (variante === 'menu') {
    return (
      <div style={{ padding: '4px 16px 8px', borderTop: '1px solid var(--border)', marginTop: 4, maxWidth: 260 }}>
        <button
          onClick={descargar}
          disabled={cargando}
          aria-busy={cargando}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 0', background: 'none', border: 'none',
                   cursor: cargando ? 'wait' : 'pointer', color: 'var(--fg-1)', fontSize: 13, opacity: cargando ? 0.6 : 1 }}
        >
          <Icon name="download" size={14}/> {etiqueta}
        </button>
        {nota}
      </div>
    );
  }

  return (
    <div className="apk-descarga" style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', maxWidth: 360 }}>
      <button className="btn btn-primary" onClick={descargar} disabled={cargando} aria-busy={cargando}>
        <Icon name="download" size={14}/> {etiqueta}
      </button>
      {nota}
    </div>
  );
}

window.DownloadApkButton = DownloadApkButton;
