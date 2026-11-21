// ===== Cronómetro de pendientes (fparra): formato y reglas de interfaz =====
// Lo calcula TODO el backend (api_zeutica1/pendientes_tiempo_logica.py); aquí solo se da formato.
// Dual: global en el navegador (window.pendientesTiempo) y require() en los tests.
// Sin dato (null) siempre es «—», nunca 0. Las marcas del backend son texto «AAAA-MM-DD HH:MM:SS»
// en hora de México: se leen del texto, sin pasar por Date (evita desfases de zona).
(function (root) {
  // Espejo de USUARIOS_CRONOMETRO del backend (manda el backend).
  const USUARIOS_CRONOMETRO = ['fparra'];

  const normal = (u) => String(u || '').trim().toLowerCase();
  const seCronometra = (usuario) => USUARIOS_CRONOMETRO.includes(normal(usuario));

  // La sección de tiempos es de gerencia, pero fparra (que también es gerencia) no revisa los suyos.
  const puedeRevisarTiempos = (usuario, esGerencia) => !!esGerencia && !seCronometra(usuario);

  // 55800 -> «15 h 30 min»; 90000 -> «1 d 1 h»; menos de un minuto -> «< 1 min».
  function formatearDuracion(segundos) {
    if (segundos == null || segundos === '' || !Number.isFinite(Number(segundos)) || Number(segundos) < 0) return '—';
    const total = Math.floor(Number(segundos));
    if (total < 60) return '< 1 min';
    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    if (d > 0) return h > 0 ? `${d} d ${h} h` : `${d} d`;
    if (h > 0) return m > 0 ? `${h} h ${m} min` : `${h} h`;
    return `${m} min`;
  }

  // Contador en vivo: lo que dijo el servidor + lo que ha pasado desde que llegó la respuesta.
  function segundosEnVivo(base, recibidoMs, ahoraMs) {
    if (base == null || !Number.isFinite(Number(base))) return null;
    const extra = Math.max(0, Math.floor((ahoraMs - recibidoMs) / 1000));
    return Number(base) + extra;
  }

  // «2026-11-20 18:00:00» -> «20/11/2026 18:00»
  function formatearMarca(texto) {
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(texto || ''));
    return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : '—';
  }

  // Texto del KPI: «15 h 30 min» + aviso de tareas sin dato o en curso.
  function notaKpi(kpi) {
    if (!kpi) return '';
    const partes = [];
    partes.push(`${kpi.tareas_sin_intercambiar || 0} tarea${kpi.tareas_sin_intercambiar === 1 ? '' : 's'} terminada${kpi.tareas_sin_intercambiar === 1 ? '' : 's'}`);
    if (kpi.tareas_sin_dato) partes.push(`${kpi.tareas_sin_dato} sin dato`);
    if (kpi.tareas_en_curso) partes.push(`${kpi.tareas_en_curso} en curso (no suman)`);
    return partes.join(' · ');
  }

  const mod = { USUARIOS_CRONOMETRO, seCronometra, puedeRevisarTiempos, formatearDuracion, segundosEnVivo, formatearMarca, notaKpi };
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else root.pendientesTiempo = mod;
})(typeof self !== 'undefined' ? self : this);
