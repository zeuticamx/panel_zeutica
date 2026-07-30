// ===== Zeutica — Conversaciones Sofi (historial del agente, solo lectura) =====
const { useState: cs_uS, useEffect: cs_uE, useMemo: cs_uM } = React;

// El backend entrega `message` como string JSON de LangChain:
// { type: 'human'|'ai'|'tool'|'system', content, tool_calls, additional_kwargs, response_metadata }
function csParseMensaje(raw) {
  if (raw == null) return { tipo: 'desconocido', contenido: '', toolCalls: [], crudo: '' };
  if (typeof raw === 'object') return csNormalizar(raw, raw);
  let obj = null;
  try { obj = JSON.parse(raw); } catch { obj = null; }
  if (!obj || typeof obj !== 'object') return { tipo: 'desconocido', contenido: String(raw), toolCalls: [], crudo: String(raw) };
  return csNormalizar(obj, raw);
}

function csNormalizar(obj, crudo) {
  let contenido = obj.content;
  // content puede venir como arreglo de bloques ({ type: 'text', text }).
  if (Array.isArray(contenido)) {
    contenido = contenido.map((b) => (typeof b === 'string' ? b : (b?.text ?? JSON.stringify(b)))).join('\n');
  } else if (contenido != null && typeof contenido === 'object') {
    contenido = JSON.stringify(contenido);
  }
  return {
    tipo: obj.type || obj.role || 'desconocido',
    contenido: contenido == null ? '' : String(contenido),
    toolCalls: Array.isArray(obj.tool_calls) ? obj.tool_calls : [],
    crudo: typeof crudo === 'string' ? crudo : JSON.stringify(crudo),
  };
}

const CS_ETIQUETA_TIPO = { human: 'Cliente', ai: 'Sofi', tool: 'Herramienta', system: 'Sistema' };

// Agrupa preservando el orden de llegada del backend (es el orden cronológico).
function csAgrupar(lista) {
  const mapa = new Map();
  lista.forEach((row, i) => {
    const sid = row?.session_id ?? row?.sessionId ?? 'sin-sesion';
    if (!mapa.has(sid)) mapa.set(sid, { session_id: sid, mensajes: [] });
    mapa.get(sid).mensajes.push({ ...csParseMensaje(row?.message), idx: i });
  });
  return [...mapa.values()];
}

function csCsvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csDescargarCsv(sesiones) {
  const filas = ['session_id,orden,tipo,contenido'];
  for (const s of sesiones) {
    s.mensajes.forEach((m, i) => {
      filas.push([s.session_id, i + 1, m.tipo, m.contenido].map(csCsvCell).join(','));
    });
  }
  // BOM para que Excel abra UTF-8 con acentos correctos.
  const blob = new Blob(['﻿' + filas.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `conversaciones-sofi-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function CsBurbuja({ msg }) {
  const esCliente = msg.tipo === 'human';
  const esSofi = msg.tipo === 'ai';
  const fondo = esCliente ? 'var(--bg-2)' : esSofi ? 'var(--info-bg)' : 'var(--warn-bg)';
  const color = esCliente ? 'var(--fg-1)' : esSofi ? 'var(--fg-1)' : 'var(--warn)';
  return (
    <div style={{ display: 'flex', justifyContent: esCliente ? 'flex-start' : 'flex-end', marginBottom: 10 }}>
      <div style={{ maxWidth: '78%', minWidth: 0 }}>
        <div className="td-muted" style={{ fontSize: 11, marginBottom: 3, textAlign: esCliente ? 'left' : 'right' }}>
          {CS_ETIQUETA_TIPO[msg.tipo] || msg.tipo}
        </div>
        <div style={{
          background: fondo, color, border: '1px solid var(--border)',
          borderRadius: 10, padding: '8px 12px', fontSize: 13, lineHeight: 1.45,
          whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
        }}>
          {msg.contenido || <span className="td-muted">(sin contenido)</span>}
          {msg.toolCalls.length > 0 && (
            <div className="td-muted" style={{ fontSize: 11, marginTop: 6, fontFamily: 'var(--font-mono, monospace)' }}>
              tool_calls: {msg.toolCalls.map((t) => t?.name || t?.function?.name || 'tool').join(', ')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PageConversacionesSofi() {
  const [lista, setLista]       = cs_uS([]);
  const [loading, setLoading]   = cs_uS(true);
  const [error, setError]       = cs_uS(null);
  const [filtroSid, setFiltroSid] = cs_uS('');
  const [seleccion, setSeleccion] = cs_uS(null);

  const cargar = async () => {
    setLoading(true);
    setError(null);
    const r = await window.api.conversacionesSofi();
    setLoading(false);
    if (!r.ok) {
      setError(r.error || 'No se pudieron cargar las conversaciones');
      setLista([]);
      return;
    }
    setLista(r.data);
  };

  cs_uE(() => { cargar(); }, []);

  const sesiones = cs_uM(() => csAgrupar(lista), [lista]);

  const filtradas = cs_uM(() => {
    const q = filtroSid.trim().toLowerCase();
    if (!q) return sesiones;
    return sesiones.filter((s) => String(s.session_id).toLowerCase().includes(q));
  }, [sesiones, filtroSid]);

  // Si la sesión activa desaparece del filtro, cae a la primera visible.
  const activa = cs_uM(
    () => filtradas.find((s) => s.session_id === seleccion) || filtradas[0] || null,
    [filtradas, seleccion]
  );

  const totalMensajes = cs_uM(() => filtradas.reduce((a, s) => a + s.mensajes.length, 0), [filtradas]);

  return (
    <div className="page">
      <div className="section-header">
        <div>
          <h2 className="section-title">Conversaciones Sofi</h2>
          <p className="section-subtitle">Historial de chats del agente comercial. Filtra por session_id y revisa el hilo completo.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={cargar} disabled={loading}>
            <Icon name="refresh" size={13} style={loading ? { animation: 'spin 1s linear infinite' } : undefined}/> Actualizar
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => csDescargarCsv(filtradas)}
            disabled={loading || filtradas.length === 0}
            title={filtroSid ? 'Descarga solo las sesiones filtradas' : 'Descarga todas las sesiones'}
          >
            <Icon name="download" size={13}/> Descargar CSV
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div className="field" style={{ minWidth: 260, flex: '0 1 340px' }}>
            <input
              className="input"
              type="search"
              placeholder="Filtrar por session_id…"
              value={filtroSid}
              onChange={(e) => setFiltroSid(e.target.value)}
            />
          </div>
          <span className="td-muted" style={{ fontSize: 12 }}>
            {filtradas.length} sesión{filtradas.length !== 1 ? 'es' : ''} · {totalMensajes} mensaje{totalMensajes !== 1 ? 's' : ''}
            {filtroSid ? ` (de ${sesiones.length})` : ''}
          </span>
        </div>

        {loading ? (
          <div className="empty" style={{ padding: 40 }}>Cargando conversaciones…</div>
        ) : error ? (
          <div className="empty" style={{ padding: 40, color: 'var(--danger)' }}>{error}</div>
        ) : filtradas.length === 0 ? (
          <div className="empty" style={{ padding: 40 }}>
            {filtroSid ? `Sin sesiones para "${filtroSid}"` : 'Sin conversaciones registradas'}
          </div>
        ) : (
          <div className="cs-layout">
            <div className="cs-sesiones">
              {filtradas.map((s) => {
                const ultimo = s.mensajes[s.mensajes.length - 1];
                const act = activa && activa.session_id === s.session_id;
                return (
                  <button
                    key={s.session_id}
                    onClick={() => setSeleccion(s.session_id)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                      background: act ? 'var(--bg-2)' : 'transparent',
                      border: 'none', borderLeft: `3px solid ${act ? 'var(--brand)' : 'transparent'}`,
                      borderBottom: '1px solid var(--border)', padding: '10px 12px', color: 'var(--fg-1)',
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600, overflowWrap: 'anywhere' }}>{s.session_id}</div>
                    <div className="td-muted" style={{ fontSize: 11, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.mensajes.length} msj · {(ultimo?.contenido || '').slice(0, 60)}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="cs-hilo">
              {!activa ? (
                <div className="empty" style={{ padding: 40 }}>Selecciona una sesión</div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflowWrap: 'anywhere' }}>
                      <Icon name="chat" size={14}/> {activa.session_id}
                    </div>
                    <span className="td-muted" style={{ fontSize: 12 }}>{activa.mensajes.length} mensajes</span>
                  </div>
                  {activa.mensajes.map((m) => <CsBurbuja key={m.idx} msg={m}/>)}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

window.PageConversacionesSofi = PageConversacionesSofi;
