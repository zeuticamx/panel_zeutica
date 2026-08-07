// ===== Zeutica — Clientes Potenciales (solo lectura: consulta, búsqueda y export CSV) =====
const { useState: cp_uS, useEffect: cp_uE, useMemo: cp_uM, useRef: cp_uR } = React;

// Columnas dinámicas: el shape del backend puede variar, así que las derivamos
// de la unión de llaves de todos los registros (orden de primera aparición).
function cpColumnas(lista) {
  const cols = [];
  const seen = new Set();
  for (const row of lista) {
    for (const k of Object.keys(row || {})) {
      if (!seen.has(k)) { seen.add(k); cols.push(k); }
    }
  }
  return cols;
}

// Encabezado legible: snake_case / camelCase a "Titulo Con Espacios".
const cpEtiqueta = (k) =>
  String(k)
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());

const cpValor = (v) => {
  if (v == null) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

// Escapado CSV estándar: comillas dobles si hay coma, comilla o salto de línea.
function cpCsvCell(v) {
  const s = cpValor(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function cpDescargarCsv(lista, columnas) {
  const filas = [
    columnas.map(cpEtiqueta).map(cpCsvCell).join(','),
    ...lista.map((row) => columnas.map((c) => cpCsvCell(row?.[c])).join(',')),
  ];
  // BOM para que Excel abra UTF-8 con acentos correctos.
  const blob = new Blob(['﻿' + filas.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `clientes-potenciales-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Columnas editables inline. Comparación normalizada (case/underscore-insensitive)
// porque el nombre exacto de la llave puede variar (CORREO ENCONTRADO, correo_encontrado, etc).
const cpNorm = (k) => String(k).trim().toUpperCase().replace(/_/g, ' ').replace(/\s+/g, ' ');
const CP_COL_NOTAS = 'NOTAS';
const CP_COL_CORREO = 'CORREO ENCONTRADO';
const CP_COL_REVISADO = 'REVISADO';
const cpEsNotas = (c) => cpNorm(c) === CP_COL_NOTAS;
const cpEsCorreo = (c) => cpNorm(c) === CP_COL_CORREO;
const cpEsRevisado = (c) => cpNorm(c) === CP_COL_REVISADO;
const cpEsTextoLibre = (c) => cpEsNotas(c) || cpEsCorreo(c);

// REVISADO se ancla al borde derecho de la tabla (checkbox de uso frecuente,
// no debe quedar oculto por el scroll horizontal de las columnas de texto).
const cpStickyBase = { position: 'sticky', right: 0, boxShadow: '-1px 0 0 var(--line)' };
const cpStickyDer = { ...cpStickyBase, background: 'var(--bg-0)' };   // thead
const cpStickyDerTd = { ...cpStickyBase, background: 'var(--bg-1)' }; // tbody

function PageClientesPotenciales() {
  const toast = window.useToast();
  const [lista, setLista]     = cp_uS([]);
  const [loading, setLoading] = cp_uS(true);
  const [error, setError]     = cp_uS(null);
  const [busqueda, setBusqueda] = cp_uS('');
  const [filtroRevisado, setFiltroRevisado] = cp_uS('todos'); // 'todos' | 'true' | 'false'
  const [sincronizando, setSincronizando] = cp_uS(false);
  const [version, setVersion] = cp_uS(0); // sube en cada recarga: remonta los inputs

  // Los textos (NOTAS / CORREO ENCONTRADO) se guardan en un ref, NO en estado:
  // un setState por tecleo re-renderiza la tabla completa y eso es lo que movía
  // las columnas y el scroll. El ref no dispara render; los inputs quedan
  // no controlados y conservan lo escrito. { [id]: { [columna]: texto } }
  const borrador = cp_uR({});
  // Snapshot de lo último cargado, para detectar qué filas cambiaron al sincronizar.
  const originales = cp_uR({});

  const editarTexto = (row, campo, valor) => {
    const id = row?.id;
    if (id == null) return;
    borrador.current[id] = { ...(borrador.current[id] || {}), [campo]: valor };
  };

  // Valor a mostrar: lo tecleado (si existe) tiene prioridad sobre lo del servidor.
  const valorEditable = (row, campo) => {
    const pendiente = borrador.current[row?.id]?.[campo];
    return pendiente !== undefined ? pendiente : cpValor(row?.[campo]);
  };

  // REVISADO sí va por estado porque el checkbox necesita reflejar el cambio.
  const editarRevisado = (row, campo, valor) => {
    const id = row?.id;
    if (id == null) return;
    setLista((l) => l.map((it) => (it.id === id ? { ...it, [campo]: valor } : it)));
  };

  // Único disparo al backend. Dos llamadas por diseño del API: PATCH /{id} para
  // revisado + correo_encontrado, y /notas-lote para las notas. Solo se envían
  // las filas que cambiaron respecto a lo cargado — con 1000 registros mandarlas
  // todas serían 1000 peticiones por cada clic.
  const sincronizar = async () => {
    const original = (id) => originales.current[id] || {};
    const cambioGeneral = lista.filter((r) => {
      if (r.id == null) return false;
      const orig = original(r.id);
      const revCambio = colRevisado && !!r[colRevisado] !== !!orig[colRevisado];
      const correoCambio = colCorreo && valorEditable(r, colCorreo) !== cpValor(orig[colCorreo]);
      return revCambio || correoCambio;
    });
    const cambioNotas = !colNotas ? [] : lista.filter(
      (r) => r.id != null && valorEditable(r, colNotas) !== cpValor(original(r.id)[colNotas])
    );

    if (cambioGeneral.length === 0 && cambioNotas.length === 0) {
      toast.success('Sin cambios por sincronizar', '');
      return;
    }

    setSincronizando(true);
    const [resGeneral, resNotas] = await Promise.all([
      Promise.all(cambioGeneral.map((r) => window.api.actualizarClientePotencial(r.id, {
        revisado: colRevisado ? !!r[colRevisado] : false,
        correo_encontrado: colCorreo ? valorEditable(r, colCorreo) : '',
      }))),
      cambioNotas.length > 0
        ? window.api.actualizarNotasClientesPotenciales(cambioNotas.map((r) => ({ id: r.id, notas: valorEditable(r, colNotas) })))
        : Promise.resolve({ ok: true }),
    ]);
    setSincronizando(false);
    if (resGeneral.some((r) => !r.ok) || !resNotas.ok) {
      toast.error('No se pudo sincronizar', 'Revisa la conexión e intenta de nuevo');
      return;
    }
    toast.success('Sincronizado', `${cambioGeneral.length + cambioNotas.length} cambio(s)`);
    cargar();
  };

  const cargar = async () => {
    setLoading(true);
    setError(null);
    const r = await window.api.clientesPotenciales();
    setLoading(false);
    if (!r.ok) {
      setError(r.error || 'No se pudo cargar clientes potenciales');
      setLista([]);
      return;
    }
    // Recargar descarta lo tecleado sin sincronizar. Los inputs son no controlados,
    // así que hay que forzar su remontaje para que tomen los valores del servidor.
    borrador.current = {};
    originales.current = Object.fromEntries(r.data.filter((it) => it?.id != null).map((it) => [it.id, it]));
    setVersion((v) => v + 1);
    setLista(r.data);
  };

  cp_uE(() => { cargar(); }, []);

  // Firma = llaves presentes, no los valores: marcar un checkbox no debe recalcular
  // las columnas. NOTAS se reubica siempre justo antes de CORREO ENCONTRADO,
  // exista o no en los datos, para que su posición nunca dependa del orden que
  // devuelva el backend ni de qué filas se hayan editado.
  const firmaColumnas = lista.map((r) => Object.keys(r || {}).join('|')).join(';');
  const columnas = cp_uM(() => {
    const cols = cpColumnas(lista);
    const llaveNotas = cols.find(cpEsNotas) ?? CP_COL_NOTAS;
    const resto = cols.filter((c) => !cpEsNotas(c));
    const idx = resto.findIndex(cpEsCorreo);
    idx === -1 ? resto.push(llaveNotas) : resto.splice(idx, 0, llaveNotas);
    return resto;
  }, [firmaColumnas]);
  const colRevisado = cp_uM(() => columnas.find(cpEsRevisado), [columnas]);
  const colCorreo = cp_uM(() => columnas.find(cpEsCorreo), [columnas]);
  const colNotas = cp_uM(() => columnas.find(cpEsNotas), [columnas]);

  // Búsqueda libre sobre todos los campos (case-insensitive) + filtro por REVISADO.
  const filtrados = cp_uM(() => {
    const q = busqueda.trim().toLowerCase();
    let out = lista;
    if (q) out = out.filter((row) => columnas.some((c) => cpValor(row?.[c]).toLowerCase().includes(q)));
    if (colRevisado && filtroRevisado !== 'todos') {
      const quiere = filtroRevisado === 'true';
      out = out.filter((row) => !!row?.[colRevisado] === quiere);
    }
    return out;
  }, [lista, columnas, busqueda, colRevisado, filtroRevisado]);

  return (
    <div className="page">
      <div className="section-header">
        <div>
          <h2 className="section-title">Clientes Potenciales</h2>
          <p className="section-subtitle">Prospectos captados. Consulta, busca y descarga la información.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={cargar} disabled={loading}>
            <Icon name="refresh" size={13} style={loading ? { animation: 'spin 1s linear infinite' } : undefined}/> Actualizar
          </button>
          <button className="btn btn-secondary btn-sm" onClick={sincronizar} disabled={sincronizando || lista.length === 0}>
            <Icon name="refresh-cw" size={13} style={sincronizando ? { animation: 'spin 1s linear infinite' } : undefined}/> SINCRONIZAR
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => cpDescargarCsv(filtrados, columnas)}
            disabled={loading || filtrados.length === 0}
            title={busqueda ? 'Descarga solo los resultados filtrados' : 'Descarga todos los registros'}
          >
            <Icon name="download" size={13}/> Descargar CSV
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div className="field" style={{ minWidth: 260, flex: '0 1 340px' }}>
              <input
                className="input"
                type="search"
                placeholder="Buscar en todos los campos…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            {colRevisado && (
              <div className="field" style={{ minWidth: 160 }}>
                <select
                  className="input"
                  value={filtroRevisado}
                  onChange={(e) => setFiltroRevisado(e.target.value)}
                >
                  <option value="todos">Revisado: todos</option>
                  <option value="true">Revisado: sí</option>
                  <option value="false">Revisado: no</option>
                </select>
              </div>
            )}
          </div>
          {(busqueda || filtroRevisado !== 'todos') && (
            <span className="td-muted" style={{ fontSize: 12 }}>
              {filtrados.length} de {lista.length} registros
            </span>
          )}
        </div>

        <div className="table-wrap" style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>{columnas.map((c) => (
                <th key={c} style={cpEsRevisado(c) ? cpStickyDer : undefined}>{cpEtiqueta(c)}</th>
              ))}</tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={columnas.length || 1} className="empty">Cargando clientes potenciales…</td></tr>
              ) : error ? (
                <tr><td colSpan={columnas.length || 1} className="empty" style={{ color: 'var(--danger)' }}>{error}</td></tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={columnas.length || 1} className="empty">{busqueda ? `Sin resultados para "${busqueda}"` : 'Sin clientes potenciales registrados'}</td></tr>
              ) : filtrados.map((row, i) => (
                <tr key={`${version}:${row.id ?? i}`}>
                  {columnas.map((c) => {
                    if (cpEsRevisado(c)) {
                      return (
                        <td key={c} style={{ ...cpStickyDerTd, fontSize: 13, textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={!!row?.[c]}
                            disabled={row.id == null}
                            onChange={(e) => editarRevisado(row, c, e.target.checked)}
                          />
                        </td>
                      );
                    }
                    if (cpEsTextoLibre(c)) {
                      return (
                        <td key={c} style={{ fontSize: 13 }}>
                          <input
                            className="input"
                            style={{ fontSize: 13, padding: '4px 8px', minWidth: 200 }}
                            defaultValue={valorEditable(row, c)}
                            disabled={row.id == null}
                            onChange={(e) => editarTexto(row, c, e.target.value)}
                          />
                        </td>
                      );
                    }
                    return <td key={c} style={{ fontSize: 13 }}>{cpValor(row?.[c]) || '—'}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && !error && filtrados.length > 0 && (
          <div className="card-footer td-muted" style={{ fontSize: 12, padding: '10px 16px' }}>
            {filtrados.length} registro{filtrados.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}

window.PageClientesPotenciales = PageClientesPotenciales;
