// ===== Zeutica — Promociones Meli (solo lectura: consulta webhook n8n) =====
const { useState: pm_uS, useEffect: pm_uE, useMemo: pm_uM } = React;

// Shape del webhook: { message: string, ofertas_meli: [ {...} ] }
// Los campos id / name / suggested_discounted_price son opcionales (no vienen
// en todas las ofertas), así que todo el render tolera ausencias.
function pmOfertas(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw?.ofertas_meli)) return raw.ofertas_meli;
  if (Array.isArray(raw)) return raw;
  // Fallback: primera propiedad que sea arreglo de objetos.
  for (const v of Object.values(raw || {})) {
    if (Array.isArray(v) && v.some((x) => x && typeof x === 'object')) return v;
  }
  return [];
}

// Precio con el que realmente queda la publicación: algunas ofertas traen
// price 0 y el valor real en suggested_discounted_price.
const pmPrecioFinal = (o) => (Number(o?.price) > 0 ? Number(o.price) : Number(o?.suggested_discounted_price) || 0);

const pmDescuentoPct = (o) => {
  const orig = Number(o?.original_price) || 0;
  const fin = pmPrecioFinal(o);
  if (!orig || !fin) return null;
  return ((orig - fin) / orig) * 100;
};

const pmNombre = (o) => (o?.name || '').trim() || (o?.id ? String(o.id) : 'Sin campaña');

const pmPct = (n) => (n == null ? '—' : `${Number(n).toLocaleString('es-MX', { maximumFractionDigits: 1 })}%`);

const PM_ESTADOS = {
  candidate: { label: 'Candidata', cls: 'badge-info' },
  started:   { label: 'Activa',    cls: 'badge-success' },
  finished:  { label: 'Finalizada',cls: '' },
  pending:   { label: 'Pendiente', cls: 'badge-warn' },
};

const PM_COLUMNAS_CSV = [
  ['id', 'ID Promoción'],
  ['name', 'Campaña'],
  ['status', 'Estado'],
  ['original_price', 'Precio original'],
  ['price', 'Precio promo'],
  ['suggested_discounted_price', 'Precio sugerido'],
  ['meli_percentage', '% Meli'],
  ['seller_percentage', '% Vendedor'],
];

function pmCsvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function pmDescargarCsv(lista) {
  const filas = [
    [...PM_COLUMNAS_CSV.map(([, l]) => l), 'Descuento %'].map(pmCsvCell).join(','),
    ...lista.map((o) => {
      const d = pmDescuentoPct(o);
      return [
        ...PM_COLUMNAS_CSV.map(([k]) => o?.[k]),
        d == null ? '' : d.toFixed(2),
      ].map(pmCsvCell).join(',');
    }),
  ];
  // BOM para que Excel abra UTF-8 con acentos correctos.
  const blob = new Blob(['﻿' + filas.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `promociones-meli-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function pmFetchPromociones() {
  try {
    const res = await fetch(window.N8N_PROMOS_MELI_HOOK, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    const texto = await res.text();
    let cuerpo = null;
    try { cuerpo = texto ? JSON.parse(texto) : null; } catch { cuerpo = texto; }
    if (!res.ok) {
      // Mismo criterio que el resto del panel: el cuerpo del webhook se muestra
      // tal cual, no un "HTTP 500" pelón que no dice qué pasó en n8n.
      const r = await window.api.interpretarRespuesta(
        { ok: false, status: res.status, statusText: res.statusText, url: res.url, text: async () => texto },
        { metodo: 'GET', ruta: 'webhook promociones MELI' }
      );
      return { ok: false, error: r.error, raw: cuerpo };
    }
    return { ok: true, raw: cuerpo };
  } catch (e) {
    return { ok: false, error: `No se pudo consultar el webhook de promociones — ${e.message}` };
  }
}

function PmKpi({ label, valor, sub }) {
  return (
    <div className="card" style={{ padding: '14px 16px', flex: '1 1 160px', minWidth: 150 }}>
      <div className="td-muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, marginTop: 4 }}>{valor}</div>
      {sub && <div className="td-muted" style={{ fontSize: 11, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function PagePromocionesMeli() {
  const [raw, setRaw]           = pm_uS(null);
  const [loading, setLoading]   = pm_uS(true);
  const [error, setError]       = pm_uS(null);
  const [busqueda, setBusqueda] = pm_uS('');
  const [campana, setCampana]   = pm_uS('');
  const [verJson, setVerJson]   = pm_uS(false);
  const [actualizado, setActualizado] = pm_uS(null);

  const cargar = async () => {
    setLoading(true);
    setError(null);
    const r = await pmFetchPromociones();
    setLoading(false);
    setActualizado(new Date());
    setRaw(r.raw ?? null);
    if (!r.ok) setError(r.error);
  };

  pm_uE(() => { cargar(); }, []);

  const ofertas = pm_uM(() => (error ? [] : pmOfertas(raw)), [raw, error]);
  const mensaje = pm_uM(() => (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw.message : null), [raw]);

  const campanas = pm_uM(() => {
    const set = new Set(ofertas.map(pmNombre));
    return [...set].sort((a, b) => a.localeCompare(b, 'es'));
  }, [ofertas]);

  const filtrados = pm_uM(() => {
    const q = busqueda.trim().toLowerCase();
    return ofertas.filter((o) => {
      if (campana && pmNombre(o) !== campana) return false;
      if (!q) return true;
      return [o?.id, o?.name, o?.status, o?.price, o?.original_price, o?.suggested_discounted_price]
        .some((v) => String(v ?? '').toLowerCase().includes(q));
    });
  }, [ofertas, busqueda, campana]);

  // Ahorro potencial: cuánto baja el precio si se aceptan las ofertas filtradas.
  const resumen = pm_uM(() => {
    const conDesc = filtrados.map(pmDescuentoPct).filter((d) => d != null && d > 0);
    const prom = conDesc.length ? conDesc.reduce((a, b) => a + b, 0) / conDesc.length : null;
    const max = conDesc.length ? Math.max(...conDesc) : null;
    return { total: filtrados.length, campanas: new Set(filtrados.map(pmNombre)).size, prom, max };
  }, [filtrados]);

  return (
    <div className="page">
      <div className="section-header">
        <div>
          <h2 className="section-title">Promociones Meli</h2>
          <p className="section-subtitle">Ofertas disponibles en Mercado Libre. Datos en vivo desde n8n.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setVerJson((v) => !v)} disabled={raw == null}>
            <Icon name="doc" size={13}/> {verJson ? 'Ver tabla' : 'Ver JSON'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={cargar} disabled={loading}>
            <Icon name="refresh" size={13} style={loading ? { animation: 'spin 1s linear infinite' } : undefined}/> Actualizar
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => pmDescargarCsv(filtrados)}
            disabled={loading || filtrados.length === 0}
            title={busqueda || campana ? 'Descarga solo los resultados filtrados' : 'Descarga todas las ofertas'}
          >
            <Icon name="download" size={13}/> Descargar CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="card" style={{ marginTop: 16, borderColor: 'var(--danger)' }}>
          <div style={{ padding: 16, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Icon name="alert" size={16} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 2 }}/>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>No se pudieron cargar las promociones</div>
              <div className="td-muted" style={{ fontSize: 12, marginTop: 4 }}>{error}</div>
            </div>
          </div>
        </div>
      )}

      {!error && mensaje && (
        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'center' }}>
            <Icon name="info" size={15} style={{ color: 'var(--info)', flexShrink: 0 }}/>
            <span style={{ fontSize: 13 }}>{mensaje}</span>
          </div>
        </div>
      )}

      {!error && !loading && ofertas.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
          <PmKpi label="Ofertas" valor={window.fmt.int(resumen.total)} sub={busqueda || campana ? `de ${ofertas.length} totales` : 'disponibles'}/>
          <PmKpi label="Campañas" valor={window.fmt.int(resumen.campanas)}/>
          <PmKpi label="Descuento promedio" valor={pmPct(resumen.prom)}/>
          <PmKpi label="Descuento máximo" valor={pmPct(resumen.max)}/>
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              className="input"
              type="search"
              placeholder="Buscar por ID, campaña o precio…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              disabled={verJson}
              style={{ minWidth: 240 }}
            />
            <select
              className="input"
              value={campana}
              onChange={(e) => setCampana(e.target.value)}
              disabled={verJson || campanas.length === 0}
              style={{ minWidth: 200 }}
            >
              <option value="">Todas las campañas</option>
              {campanas.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {(busqueda || campana) && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setBusqueda(''); setCampana(''); }}>
                <Icon name="x" size={13}/> Limpiar
              </button>
            )}
          </div>
          {actualizado && (
            <span className="td-muted" style={{ fontSize: 12 }}>
              Actualizado {actualizado.toLocaleTimeString('es-MX')}
            </span>
          )}
        </div>

        {verJson ? (
          <pre style={{
            margin: 0, padding: 16, overflowX: 'auto', maxHeight: '60vh',
            fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--fg-1)',
          }}>{JSON.stringify(raw, null, 2)}</pre>
        ) : (
          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Campaña</th>
                  <th>ID Promoción</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Precio original</th>
                  <th style={{ textAlign: 'right' }}>Precio promo</th>
                  <th style={{ textAlign: 'right' }}>Descuento</th>
                  <th style={{ textAlign: 'right' }}>% Meli</th>
                  <th style={{ textAlign: 'right' }}>% Vendedor</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="empty">Cargando promociones…</td></tr>
                ) : error ? (
                  <tr><td colSpan={8} className="empty" style={{ color: 'var(--danger)' }}>{error}</td></tr>
                ) : filtrados.length === 0 ? (
                  <tr><td colSpan={8} className="empty">{busqueda || campana ? 'Sin resultados para el filtro aplicado' : 'Sin ofertas disponibles'}</td></tr>
                ) : filtrados.map((o, i) => {
                  const est = PM_ESTADOS[o?.status] || { label: o?.status || '—', cls: '' };
                  const desc = pmDescuentoPct(o);
                  const fin = pmPrecioFinal(o);
                  const sugerido = !(Number(o?.price) > 0) && Number(o?.suggested_discounted_price) > 0;
                  return (
                    <tr key={`${o?.id ?? 's/id'}-${i}`}>
                      <td style={{ fontSize: 13 }}>{pmNombre(o)}</td>
                      <td className="td-muted" style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}>{o?.id || '—'}</td>
                      <td><span className={`badge ${est.cls}`}>{est.label}</span></td>
                      <td style={{ textAlign: 'right', fontSize: 13 }}>{window.fmt.mxn(o?.original_price)}</td>
                      <td style={{ textAlign: 'right', fontSize: 13 }}>
                        {fin ? window.fmt.mxn(fin) : '—'}
                        {sugerido && <span className="td-muted" style={{ fontSize: 10, marginLeft: 6 }}>sugerido</span>}
                      </td>
                      <td style={{ textAlign: 'right', fontSize: 13, color: desc > 0 ? 'var(--success)' : undefined }}>{pmPct(desc)}</td>
                      <td style={{ textAlign: 'right', fontSize: 13 }}>{pmPct(o?.meli_percentage)}</td>
                      <td style={{ textAlign: 'right', fontSize: 13 }}>{pmPct(o?.seller_percentage)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && !verJson && filtrados.length > 0 && (
          <div className="card-footer td-muted" style={{ fontSize: 12, padding: '10px 16px' }}>
            {filtrados.length} oferta{filtrados.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}

window.PagePromocionesMeli = PagePromocionesMeli;
