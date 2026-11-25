// ===== Lógica pura del bloque «Cotizaciones» de la ficha del cliente (CRM) =====
// Dual: global en el navegador (window.cotizacionesCliente) y CommonJS en tests.
// Se apoya en cotizacion-logica.js (no se modifica). `hoy` siempre llega como parámetro 'AAAA-MM-DD'.
(function (root) {
  const cotLogica = (typeof module !== 'undefined' && module.exports)
    ? require('./cotizacion-logica.js')
    : root.cotizacionLogica;

  // Estados excluyentes (a diferencia de las pestañas de Cotizaciones, que se solapan).
  const ESTADOS = ['abierta', 'vendida', 'vencida', 'cancelada'];
  const ETIQUETAS_ESTADO = { abierta: 'Abierta', vendida: 'Vendida', vencida: 'Vencida', cancelada: 'Cancelada' };
  const FILTROS = [
    { key: 'todas', label: 'Todas' },
    { key: 'abierta', label: 'Abiertas' },
    { key: 'vendida', label: 'Vendidas' },
    { key: 'vencida', label: 'Vencidas' },
    { key: 'cancelada', label: 'Canceladas' },
  ];

  const etiquetaEstado = (estado) => ETIQUETAS_ESTADO[estado] || '';

  // Cancelada > Vendida > Vencida > Abierta. Sin fecha_vencimiento se considera vigente.
  function estadoDe(c, hoy) {
    if (cotLogica.estaCancelada(c)) return 'cancelada';
    if (c && c.vendido) return 'vendida';
    if (!cotLogica.esVigente(c, hoy)) return 'vencida';
    return 'abierta';
  }

  function contarPorEstado(lista, hoy) {
    const cuenta = { todas: 0, abierta: 0, vendida: 0, vencida: 0, cancelada: 0 };
    (Array.isArray(lista) ? lista : []).forEach((c) => {
      cuenta.todas += 1;
      cuenta[estadoDe(c, hoy)] += 1;
    });
    return cuenta;
  }

  function filtrarPorEstado(lista, filtro, hoy) {
    const l = Array.isArray(lista) ? lista : [];
    if (!ESTADOS.includes(filtro)) return l.slice();
    return l.filter((c) => estadoDe(c, hoy) === filtro);
  }

  // Sin acentos, minúsculas y espacios colapsados (misma idea que normalizar_nombre del backend).
  const normalizarNombre = (t) =>
    String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .split(/\s+/).filter(Boolean).join(' ');

  // Id del cliente por nombre, solo si hay uno único (no adivina con homónimos).
  // motivo: 'ok' | 'homonimos' | 'no_encontrado' | 'sin_nombre'
  function resolverClienteId(clientes, nombre) {
    const buscado = normalizarNombre(nombre);
    if (!buscado) return { id: null, motivo: 'sin_nombre' };
    const coincidencias = (Array.isArray(clientes) ? clientes : []).filter((c) => {
      const id = Number(c && c.id);
      return c && !Number(c.eliminado) && Number.isInteger(id) && id > 0 && normalizarNombre(c.nombre) === buscado;
    });
    if (coincidencias.length === 0) return { id: null, motivo: 'no_encontrado' };
    if (coincidencias.length > 1) return { id: null, motivo: 'homonimos' };
    return { id: Number(coincidencias[0].id), motivo: 'ok' };
  }

  function textoVacio(filtro, totalCliente) {
    if (filtro === 'todas' && !totalCliente) return 'Este cliente aún no tiene cotizaciones ligadas';
    return 'Sin cotizaciones en este estado';
  }

  // Dato faltante o no numérico = «—», nunca 0.
  function formatearTotal(valor) {
    if (valor === null || valor === undefined || String(valor).trim() === '') return '—';
    const n = Number(valor);
    if (!Number.isFinite(n)) return '—';
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Tooltip de la insignia «Cancelada»: motivo, quién y cuándo; omite lo que falte (nunca «null»).
  function tituloCancelada(c, formatearFecha) {
    if (!c) return '';
    const texto = (v) => (v === null || v === undefined ? '' : String(v).trim());
    const motivo = texto(c.motivo_cancelacion);
    const por = texto(c.cancelada_por);
    const fecha = texto(c.fecha_cancelada);
    const partes = [];
    if (motivo) partes.push(`Motivo: ${motivo}`);
    if (por && por !== '0') partes.push(`Cancelada por ${por}`);
    if (fecha && fecha !== '0') partes.push(typeof formatearFecha === 'function' ? formatearFecha(fecha) : fecha);
    return partes.join(' · ');
  }

  const mod = {
    tituloCancelada, ESTADOS, FILTROS, etiquetaEstado, estadoDe, contarPorEstado, filtrarPorEstado,
    normalizarNombre, resolverClienteId, textoVacio, formatearTotal,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else root.cotizacionesCliente = mod;
})(typeof self !== 'undefined' ? self : this);
