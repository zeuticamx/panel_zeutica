// ===== Zeutica — Conteo de Inventario =====
const { useState: co_uS, useEffect: co_uE, useMemo: co_uM } = React;

function PageConteo({ user }) {
  const toast = window.useToast();
  const [askConfirm, ConfirmModal] = window.useConfirm();
  const [loading, setLoading] = co_uS(true);
  const [productos, setProductos] = co_uS([]);
  const [q, setQ] = co_uS('');
  const [cat, setCat] = co_uS('Todas');
  const [conteos, setConteos] = co_uS({});
  const [ubicaciones, setUbicaciones] = co_uS({});
  const [fase, setFase] = co_uS('conteo');
  const [fechaConteo, setFechaConteo] = co_uS(null);

  co_uE(() => { (async () => {
    setLoading(true);
    const data = await window.api.productos();
    setProductos(Array.isArray(data) ? data : []);
    setLoading(false);
  })(); }, []);

  const cats = co_uM(() => ['Todas', ...Array.from(new Set(productos.map(p => p.categoria)))], [productos]);

  const filtered = co_uM(() => productos.filter(p => {
    if (cat !== 'Todas' && p.categoria !== cat) return false;
    if (q && !`${p.sku} ${p.nombre} ${p.categoria}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [productos, q, cat]);

  const contados = co_uM(() =>
    Object.values(conteos).filter(v => v !== '' && v !== null && v !== undefined).length,
    [conteos]
  );

  const resultados = co_uM(() => productos.map(p => {
    const val = conteos[p.sku];
    const contado = (val === '' || val === null || val === undefined) ? null : Number(val);
    const diferencia = contado !== null ? contado - p.stock_bodega : null;
    return { ...p, contado, diferencia };
  }), [productos, conteos]);

  const terminarConteo = () => {
    if (contados === 0) {
      toast.warn('Sin conteos', 'Ingresa al menos un conteo antes de finalizar');
      return;
    }
    setFechaConteo(new Date());
    setFase('resultado');
  };

  const reiniciarConteo = () => {
    setConteos({});
    setUbicaciones({});
    setFase('conteo');
    setFechaConteo(null);
  };

  if (fase === 'resultado') {
    return (
      <ResultadoConteo
        resultados={resultados}
        fecha={fechaConteo}
        onReiniciar={reiniciarConteo}
        user={user}
        ubicaciones={ubicaciones}
      />
    );
  }

  return (
    <div className="page">
      {ConfirmModal}
      <div className="section-header">
        <div>
          <h2 className="section-title">Conteo de Inventario</h2>
          <p className="section-subtitle">Ingresa las cantidades físicas contadas para comparar contra el stock en sistema.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="badge">{contados} / {productos.length} contados</span>
          <button className="btn btn-primary btn-sm" onClick={() => askConfirm(`¿Finalizar el conteo con ${contados} producto(s) registrados? Pasarás a la pantalla de resultados.`, terminarConteo)}>
            <Icon name="check" size={13}/> Terminar conteo
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header" style={{ gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8, flex: 1, flexWrap: 'wrap' }}>
            <div className="input-group" style={{ flex: 1, maxWidth: 320 }}>
              <span className="input-group-icon"><Icon name="search" size={14}/></span>
              <input
                className="input"
                placeholder="Buscar por SKU, nombre..."
                value={q}
                onChange={e => setQ(e.target.value)}
              />
            </div>
            <select className="select" style={{ width: 160 }} value={cat} onChange={e => setCat(e.target.value)}>
              {cats.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <span className="badge">{filtered.length} productos</span>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Ubicación</th>
                <th className="td-right">Stock DB</th>
                <th className="td-right" style={{ minWidth: 120 }}>Conteo físico</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40 }}><span className="spinner"/></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="empty">Sin resultados</td></tr>
              ) : filtered.map(p => {
                const val = conteos[p.sku];
                const hasConteo = val !== '' && val !== null && val !== undefined;
                return (
                  <tr key={p.sku} style={hasConteo ? { background: 'oklch(0.22 0.012 240 / 0.3)' } : undefined}>
                    <td className="mono" style={{ fontSize: 12 }}>{p.sku}</td>
                    <td>{p.nombre}</td>
                    <td><span className="badge">{p.categoria}</span></td>
                    <td>
                      <input
                        className="input"
                        type="text"
                        placeholder={p.ubicacion || 'Ubicación...'}
                        value={ubicaciones[p.sku] ?? ''}
                        aria-label={`Ubicación para ${p.nombre}`}
                        style={{ width: 110, padding: '4px 8px', height: 30 }}
                        onChange={e => setUbicaciones(prev => ({ ...prev, [p.sku]: e.target.value }))}
                      />
                    </td>
                    <td className="td-right mono">{p.stock_bodega}</td>
                    <td className="td-right">
                      <input
                        className="input"
                        type="number"
                        min="0"
                        placeholder="—"
                        value={val ?? ''}
                        aria-label={`Conteo para ${p.nombre}`}
                        style={{ width: 90, textAlign: 'right', padding: '4px 8px', height: 30 }}
                        onChange={e => setConteos(prev => ({
                          ...prev,
                          [p.sku]: e.target.value === '' ? '' : Number(e.target.value),
                        }))}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ResultadoConteo({ resultados, fecha, onReiniciar, user, ubicaciones = {} }) {
  const toast = window.useToast();
  const [askConfirm, ConfirmModal] = window.useConfirm();
  const [q, setQ] = co_uS('');
  const [filtro, setFiltro] = co_uS('todos');
  const [sending, setSending] = co_uS(false);
  const [enviado, setEnviado] = co_uS(false);

  const stats = co_uM(() => {
    const counted = resultados.filter(r => r.contado !== null);
    const faltantes = counted.filter(r => r.diferencia < 0);
    const sobrantes = counted.filter(r => r.diferencia > 0);
    const exactos = counted.filter(r => r.diferencia === 0);
    const valorFaltante = faltantes.reduce((s, r) => s + (Math.abs(r.diferencia) * r.costo_total), 0);
    return { counted: counted.length, faltantes: faltantes.length, sobrantes: sobrantes.length, exactos: exactos.length, valorFaltante };
  }, [resultados]);

  const filtered = co_uM(() => resultados.filter(r => {
    if (filtro === 'diferencias' && (r.contado === null || r.diferencia === 0)) return false;
    if (filtro === 'faltantes' && (r.contado === null || r.diferencia >= 0)) return false;
    if (filtro === 'sobrantes' && (r.contado === null || r.diferencia <= 0)) return false;
    if (filtro === 'nocontados' && r.contado !== null) return false;
    if (q && !`${r.sku} ${r.nombre}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [resultados, filtro, q]);

  const descargarReporte = () => {
    const fechaStr = fecha ? fecha.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    const rows = [
      ['SKU', 'Producto', 'Categoría', 'Ubicación', 'Stock DB', 'Conteo Físico', 'Diferencia', 'Valor Diferencia MXN'],
      ...resultados
        .filter(r => r.contado !== null)
        .map(r => [
          r.sku,
          r.nombre,
          r.categoria,
          r.ubicacion || '',
          r.stock_bodega,
          r.contado,
          r.diferencia > 0 ? `+${r.diferencia}` : r.diferencia,
          r.diferencia !== 0 ? (Math.abs(r.diferencia) * r.costo_total).toFixed(2) : '0.00',
        ]),
    ];
    const csv = rows
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conteo-zeutica-${fechaStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleEnviar = async () => {
    setSending(true);
    const counted = resultados.filter(r => r.contado !== null);
    const payload = {
      usuario: user,
      productos: counted.map(r => ({ sku: r.sku, conteo: r.contado })),
    };
    const r = await window.api.registrarConteo(payload);
    if (r.ok) {
      const conUbic = counted.filter(r => ubicaciones[r.sku]);
      await Promise.all(conUbic.map(r =>
        window.api.editarUbicacion(r.sku, { cantidad: r.contado, warehouse_id: ubicaciones[r.sku] })
      ));
      setEnviado(true);
      toast.success('Conteo guardado', `${payload.productos.length} productos registrados`);
      window.fireConfetti();
    } else {
      toast.error('Error al enviar', r.error);
    }
    setSending(false);
  };

  return (
    <div className="page">
      {ConfirmModal}
      <div className="section-header">
        <div>
          <h2 className="section-title">Resultado del Conteo</h2>
          <p className="section-subtitle">
            Conteo realizado el {fecha ? window.fmt.datetime(fecha.toISOString()) : '—'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={descargarReporte}>
            <Icon name="download" size={13}/> Descargar CSV
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => askConfirm('¿Iniciar un nuevo conteo? Se perderán todos los datos del conteo actual.', onReiniciar)}>
            <Icon name="refresh" size={13}/> Nuevo conteo
          </button>
          <button
            className="btn btn-primary btn-sm"
            disabled={sending || enviado}
            onClick={() => askConfirm(`¿Enviar conteo al sistema? Esto actualizará el stock de ${resultados.filter(r => r.contado !== null).length} producto(s). Esta acción no se puede deshacer.`, handleEnviar)}
          >
            {sending
              ? <span className="spinner"/>
              : enviado
                ? <><Icon name="check" size={13}/> Enviado</>
                : <><Icon name="send" size={13}/> Enviar conteo</>
            }
          </button>
        </div>
      </div>

      <div className="dash-kpis" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <window.MiniStat label="Productos contados" value={window.fmt.int(stats.counted)} icon="box"/>
        <window.MiniStat label="Sin diferencia" value={stats.exactos} icon="ok" tone="success"/>
        <window.MiniStat label="Faltantes" value={stats.faltantes} icon="alert" tone="danger"/>
        <window.MiniStat label="Valor faltante" value={window.fmt.mxn(stats.valorFaltante)} icon="wallet" tone="danger"/>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header" style={{ gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8, flex: 1, flexWrap: 'wrap' }}>
            <div className="input-group" style={{ flex: 1, maxWidth: 260 }}>
              <span className="input-group-icon"><Icon name="search" size={14}/></span>
              <input
                className="input"
                placeholder="Buscar..."
                value={q}
                onChange={e => setQ(e.target.value)}
              />
            </div>
            <div className="tabs" style={{ flexWrap: 'wrap' }}>
              <button className={`tab ${filtro === 'todos' ? 'active' : ''}`} onClick={() => setFiltro('todos')}>Todos</button>
              <button className={`tab ${filtro === 'diferencias' ? 'active' : ''}`} onClick={() => setFiltro('diferencias')}>Con diferencia</button>
              <button className={`tab ${filtro === 'faltantes' ? 'active' : ''}`} onClick={() => setFiltro('faltantes')}>Faltantes</button>
              <button className={`tab ${filtro === 'sobrantes' ? 'active' : ''}`} onClick={() => setFiltro('sobrantes')}>Sobrantes</button>
              <button className={`tab ${filtro === 'nocontados' ? 'active' : ''}`} onClick={() => setFiltro('nocontados')}>Sin contar</button>
            </div>
          </div>
          <span className="badge">{filtered.length} productos</span>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Ubicación</th>
                <th className="td-right">Stock DB</th>
                <th className="td-right">Conteo</th>
                <th className="td-right">Diferencia</th>
                <th className="td-right">Valor dif.</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="empty">Sin resultados</td></tr>
              ) : filtered.map(r => {
                const noContado = r.contado === null;
                const dif = r.diferencia;
                const difTone = noContado ? '' : dif < 0 ? 'danger' : dif > 0 ? 'warn' : 'success';
                const difLabel = noContado ? '—' : dif > 0 ? `+${dif}` : String(dif);
                const valorDif = noContado || dif === 0 ? null : window.fmt.mxn(Math.abs(dif) * r.costo_total);
                return (
                  <tr key={r.sku}>
                    <td className="mono" style={{ fontSize: 12 }}>{r.sku}</td>
                    <td>{r.nombre}</td>
                    <td><span className="badge">{r.categoria}</span></td>
                    <td className="td-muted mono" style={{ fontSize: 12 }}>{ubicaciones[r.sku] || r.ubicacion}</td>
                    <td className="td-right mono">{r.stock_bodega}</td>
                    <td className="td-right mono">
                      {noContado
                        ? <span style={{ color: 'var(--fg-3)' }}>—</span>
                        : r.contado
                      }
                    </td>
                    <td className="td-right">
                      {noContado
                        ? <span style={{ color: 'var(--fg-3)' }}>—</span>
                        : <span className={`badge badge-${difTone}`}>
                            {dif === 0 && <span className="badge-dot"/>}
                            {difLabel}
                          </span>
                      }
                    </td>
                    <td className="td-right mono">
                      {noContado
                        ? <span style={{ color: 'var(--fg-3)' }}>—</span>
                        : valorDif
                          ? <span style={{ color: dif < 0 ? 'var(--danger)' : 'var(--warn)' }}>{valorDif}</span>
                          : <span style={{ color: 'var(--success)' }}>✓</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

window.PageConteo = PageConteo;
