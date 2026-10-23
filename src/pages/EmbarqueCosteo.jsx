// ===== Zeutica — Rastreo de Importaciones: Costeo de importación (Landed Cost) =====
// Sección de EmbarqueDetail (que solo ve gerencia). El backend calcula todo; mientras se
// edita, la vista previa sale de /landed-cost/simular. Formulario ↔ payload y formato en
// src/landed-cost-logica.js. Con la etapa HL_LIQUIDADA completada el costeo queda cerrado
// (foto guardada) y no se edita.
const { useState: ec_uS, useEffect: ec_uE, useRef: ec_uR } = React;

// Entradas capturadas a mano: fondo amarillo, como en la plantilla de Excel.
const EC_ENTRADA = { background: 'var(--warn-bg)', borderColor: 'var(--warn-edge)' };

// Columnas calculadas que se ven en la tabla; el resto va en el detalle de la fila.
const EC_COLUMNAS = [
  ['total_paquetes_venta', 'Paquetes', 'num'],
  ['costo_paq_venta_china_mxn_sin_igi', 'Paq. China MXN', 'mxn'],
  ['costo_envio_paq_venta_c_iva', 'Envío paq. c/IVA', 'mxn'],
  ['costo_por_paquete_c_iva_bodega', 'Paq. c/IVA bodega', 'mxn'],
  ['costo_por_paquete_sin_iva_bodega', 'Paq. s/IVA bodega', 'mxn'],
  ['zeutica_paga_total', 'Zeutica paga', 'mxn'],
];

const EC_DETALLE = [
  ['Material China', [
    ['total_usd_sin_igi', 'Total USD sin IGI', 'usd'],
    ['costo_paq_venta_china_mxn_sin_igi', 'Costo paquete China MXN sin IGI', 'mxn'],
    ['costo_paq_venta_china_usd', 'Costo paquete China USD', 'usd'],
    ['piezas_m2', 'Piezas M2', 'num'],
  ]],
  ['Distribución y aduana', [
    ['porc_cbm_en_barco', '% CBM en barco', 'pct'],
    ['incremental_proporcional', 'Incremental proporcional USD', 'usd'],
    ['valor_mercancia_aduana_total', 'Valor mercancía en aduana USD', 'usd'],
    ['igi_correspondiente_item', 'IGI del item', 'mxn'],
    ['igi_por_paquete', 'IGI por paquete', 'mxn'],
    ['iva_item_aduana', 'IVA del item en aduana', 'mxn'],
    ['iva_item_por_paquete', 'IVA por paquete', 'mxn'],
  ]],
  ['Envío y logística', [
    ['costo_envio_item_sin_iva_igi', 'Envío del item sin IVA ni IGI', 'mxn'],
    ['costo_envio_paquete_sin_iva_igi', 'Envío por paquete sin IVA ni IGI', 'mxn'],
    ['igi_mas_iva_por_paquete', 'IGI + IVA por paquete', 'mxn'],
    ['costo_envio_paq_venta_c_iva', 'Envío por paquete c/IVA', 'mxn'],
    ['costo_envio_paq_venta_sin_iva', 'Envío por paquete s/IVA', 'mxn'],
    ['comprobacion', 'Comprobación', 'mxn'],
  ]],
  ['Costo en bodega', [
    ['relacion_costo_material_vs_envio', 'Relación envío vs material', 'pct'],
    ['costo_por_paquete_c_iva_bodega', 'Costo por paquete c/IVA', 'mxn'],
    ['costo_por_paquete_sin_iva_bodega', 'Costo por paquete s/IVA', 'mxn'],
    ['qty_paq_primario', 'Qty paquete primario', 'num'],
    ['zeutica_paga_total', 'Zeutica paga (IVA inc.)', 'mxn'],
  ]],
];

function EcInput({ def, valor, onChange, editando, invoices }) {
  const comun = { className: 'input mono', disabled: !editando, style: editando ? EC_ENTRADA : undefined };
  if (def.tipo === 'invoice') {
    const opciones = valor && !invoices.includes(valor) ? [...invoices, valor] : invoices;
    return (
      <select {...comun} className="select" value={valor} onChange={e => onChange(e.target.value)}>
        <option value="">—</option>
        {opciones.map(i => <option key={i} value={i}>{i}</option>)}
      </select>
    );
  }
  if (def.tipo === 'fecha') return <input {...comun} type="date" value={valor} onChange={e => onChange(e.target.value)}/>;
  if (def.tipo === 'texto') return <input {...comun} className="input" value={valor} onChange={e => onChange(e.target.value)}/>;
  return <input {...comun} type="number" min="0" step="any" value={valor} onChange={e => onChange(e.target.value)}/>;
}

function EcAvisos({ lista }) {
  if (!lista || lista.length === 0) return null;
  return (
    <div style={{ ...EC_ENTRADA, border: '1px solid var(--warn-edge)', color: 'var(--warn)', borderRadius: 'var(--r-md)', padding: '8px 12px', fontSize: 12 }}>
      {lista.map((a, i) => <div key={i}>• {a}</div>)}
    </div>
  );
}

function EmbarqueCosteo({ id, embarque }) {
  const toast = window.useToast();
  const L = window.landedCostLogica;
  const [costeo, setCosteo] = ec_uS(null);
  const [cargando, setCargando] = ec_uS(true);
  const [error, setError] = ec_uS(null);
  const [editando, setEditando] = ec_uS(false);
  const [formLiq, setFormLiq] = ec_uS({});
  const [formsItems, setFormsItems] = ec_uS({});
  const [preview, setPreview] = ec_uS(null);
  const [guardando, setGuardando] = ec_uS(false);
  const [abiertas, setAbiertas] = ec_uS({});
  const consulta = ec_uR(0);

  const prepararFormularios = (data) => {
    setFormLiq(L.formularioLiquidacion(data.liquidacion));
    setFormsItems(Object.fromEntries((data.items || []).map(it => [it.item_id, L.formularioItem(it.entrada)])));
  };

  const cargar = async () => {
    setCargando(true); setError(null);
    const r = await window.api.landedCost(id);
    setCargando(false);
    if (!r.ok) { setError(r.error); setCosteo(null); return; }
    setCosteo(r.data);
    prepararFormularios(r.data);
    setEditando(false);
    setPreview(null);
  };

  // `embarque` cambia de objeto cada vez que el detalle recarga (SKUs, invoices, etapas):
  // marcar HL_LIQUIDADA cierra el costeo y hay que volver a leerlo.
  ec_uE(() => { cargar(); }, [id, embarque]);

  // Vista previa mientras se edita (con pausa para no pegarle al backend en cada tecla).
  ec_uE(() => {
    if (!editando || !costeo) return;
    const n = ++consulta.current;
    const t = setTimeout(async () => {
      const r = await window.api.landedCostSimular(L.armarSimulacion(costeo, formsItems, formLiq));
      if (n === consulta.current && r.ok) setPreview(r.data);
    }, 400);
    return () => clearTimeout(t);
  }, [editando, formLiq, formsItems]);

  const cambiarItem = (itemId, campo, valor) =>
    setFormsItems(prev => ({ ...prev, [itemId]: { ...prev[itemId], [campo]: valor } }));

  const cancelar = () => { prepararFormularios(costeo); setEditando(false); setPreview(null); };

  const guardar = async () => {
    const liq = L.armarPayloadLiquidacion(formLiq, costeo.liquidacion);
    if (liq.error) { toast.error('Revisa la liquidación', liq.error); return; }
    const cambiosItems = [];
    for (const it of costeo.items) {
      const r = L.armarPayloadItem(formsItems[it.item_id] || {}, it.entrada);
      if (r.error) { toast.error(`Revisa ${it.sku}`, r.error); return; }
      if (Object.keys(r.datos).length) cambiosItems.push([it, r.datos]);
    }
    if (!liq.cambio && cambiosItems.length === 0) { toast.info('Sin cambios'); setEditando(false); setPreview(null); return; }

    setGuardando(true);
    const fallos = [];
    let cerrado = false;
    if (liq.cambio) {
      const r = await window.api.landedCostGuardarLiquidacion(id, liq.datos);
      if (!r.ok) { fallos.push('liquidación'); cerrado = cerrado || r.status === 409; }
    }
    for (const [it, datos] of cambiosItems) {
      const r = await window.api.landedCostGuardarItem(id, it.item_id, datos);
      if (!r.ok) { fallos.push(it.sku); cerrado = cerrado || r.status === 409; }
    }
    setGuardando(false);
    if (cerrado) toast.warn('El costeo ya está cerrado', 'Se marcó la hoja de liquidación como liquidada; desmarca la etapa para editarlo');
    else if (fallos.length) toast.warn('Costeo guardado con avisos', `No se pudo guardar: ${fallos.join(', ')}`);
    else toast.success('Costeo guardado');
    await cargar();
  };

  if (cargando && !costeo) {
    return <div className="card" style={{ marginTop: 16 }}><div className="card-body" style={{ textAlign: 'center', padding: 30 }}><span className="spinner"/></div></div>;
  }
  if (error || !costeo) {
    return (
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header"><h3 className="card-title">Costeo de importación</h3></div>
        <div className="empty">
          <div>No se pudo cargar el costeo.</div>
          <div className="empty-detail">{error}</div>
          <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={cargar}>Reintentar</button>
        </div>
      </div>
    );
  }

  // Al editar se muestra el cálculo de la vista previa; si aún no llega, el guardado.
  const vista = editando && preview ? preview : costeo;
  const calculoPorItem = Object.fromEntries((vista.items || []).map(it => [it.item_id, it]));
  const res = vista.resumen || {};
  const cuadre = L.estadoCuadre(res);
  const invoices = costeo.embarque?.invoices || [];
  const fmt = L.fmt;

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-header" style={{ gap: 12, flexWrap: 'wrap' }}>
        <h3 className="card-title">Costeo de importación</h3>
        <span className={`badge badge-${vista.estado === 'completo' ? 'success' : 'warn'}`}>
          <span className="badge-dot"/>{vista.estado === 'completo' ? 'Completo' : 'Estimado (falta la hoja de liquidación)'}
        </span>
        {costeo.cerrado && (
          <span className="badge badge-info" title="Desmarca la etapa «HL liquidada» para editarlo">
            <Icon name="lock" size={12}/> Cerrado{costeo.cerrado_por ? ` por ${costeo.cerrado_por}` : ''}{costeo.cerrado_en ? ` · ${window.fmt.datetime(costeo.cerrado_en)}` : ''}
          </span>
        )}
        {editando && <span className="td-muted" style={{ fontSize: 12 }}>Vista previa: aún no se guarda</span>}
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          {!editando ? (
            <button className="btn btn-secondary btn-sm" disabled={costeo.cerrado} onClick={() => setEditando(true)}
              title={costeo.cerrado ? 'Costeo cerrado: desmarca la etapa «HL liquidada» para editarlo' : ''}>
              <Icon name="edit" size={13}/> Editar costeo
            </button>
          ) : (
            <>
              <button className="btn btn-secondary btn-sm" disabled={guardando} onClick={cancelar}>Cancelar</button>
              <button className="btn btn-primary btn-sm" disabled={guardando} onClick={guardar}>
                {guardando ? <span className="spinner"/> : <><Icon name="check" size={13}/> Guardar</>}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="dash-kpis">
          <window.MiniStat label="Zeutica paga (IVA inc.)" value={fmt.mxn(res.suma_zeutica_paga_total)} icon="cash"/>
          <window.MiniStat label={`Comprobación · hoja ${fmt.mxn(res.total_hoja_liquidacion)}`} value={fmt.mxn(res.suma_comprobacion)} icon={res.cuadra ? 'check' : 'alert'} tone={cuadre.tono === 'info' ? undefined : cuadre.tono}/>
          <window.MiniStat label={`CBM total (${res.origen_total_cbm === 'manual' ? 'capturado' : 'suma de items'})`} value={fmt.num(res.total_cbm_usado)} icon="pkg"/>
          <window.MiniStat label="Total pagado real (ASX + China)" value={fmt.mxn(res.total_pagado_real)} icon="wallet"/>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12 }} className="td-muted">
          <span className={`badge badge-${cuadre.tono}`}><span className="badge-dot"/>{cuadre.label}</span>
          {res.diferencia_comprobacion != null && <span>Diferencia: {fmt.mxn(res.diferencia_comprobacion)} (tolerancia {fmt.mxn(res.tolerancia)})</span>}
          <span>· IGI estimado {fmt.mxn(res.igi_estimado_total)} vs pedimento {fmt.mxn(res.igi_total_embarque)}</span>
          <span>· IVA estimado {fmt.mxn(res.iva_estimado_total)} vs pedimento {fmt.mxn(res.iva_total_aduana)}</span>
          {res.diferencia_pagado != null && <span>· Calculado vs pagado real: {fmt.mxn(res.diferencia_pagado)}</span>}
        </div>
        <EcAvisos lista={vista.advertencias}/>

        <div>
          <div className="field-label" style={{ marginBottom: 8 }}>Logística y aduana del embarque</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            <div className="field" style={{ margin: 0 }}><label className="field-label">Fecha tentativa puerto</label>
              <input className="input mono" disabled value={costeo.embarque?.llegada_manzanillo_tentativa ? window.fmt.date(costeo.embarque.llegada_manzanillo_tentativa) : '—'}/></div>
            <div className="field" style={{ margin: 0 }}><label className="field-label">Fecha arribo bodega</label>
              <input className="input mono" disabled value={costeo.embarque?.fecha_de_recibido ? window.fmt.date(costeo.embarque.fecha_de_recibido) : '—'}/></div>
            {L.CAMPOS_LIQUIDACION.map(def => (
              <div key={def.campo} className="field" style={{ margin: 0 }}>
                <label className="field-label">{def.label}</label>
                <EcInput def={def} valor={formLiq[def.campo] ?? ''} editando={editando} invoices={invoices}
                  onChange={v => setFormLiq(prev => ({ ...prev, [def.campo]: v }))}/>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th></th><th>SKU</th>
              {L.CAMPOS_ITEM.map(d => <th key={d.campo}>{d.label}</th>)}
              <th className="td-right">Qty</th><th className="td-right">CBM</th>
              {EC_COLUMNAS.map(([k, label]) => <th key={k} className="td-right">{label}</th>)}
            </tr>
          </thead>
          <tbody>
            {costeo.items.length === 0 ? (
              <tr><td colSpan={4 + L.CAMPOS_ITEM.length + EC_COLUMNAS.length} className="empty">Sin SKUs en el embarque</td></tr>
            ) : costeo.items.map(it => {
              const calc = calculoPorItem[it.item_id] || it;
              const abierta = !!abiertas[it.item_id];
              const form = formsItems[it.item_id] || {};
              return (
                <React.Fragment key={it.item_id}>
                  <tr>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => setAbiertas(p => ({ ...p, [it.item_id]: !abierta }))}
                        title="Ver todo el cálculo">
                        <Icon name={abierta ? 'chevDown' : 'chevRight'} size={13}/>
                      </button>
                    </td>
                    <td className="mono">
                      {it.sku}
                      {calc.advertencias?.length > 0 && <span title={calc.advertencias.join('\n')} style={{ color: 'var(--warn)', marginLeft: 4 }}><Icon name="alert" size={12}/></span>}
                    </td>
                    {L.CAMPOS_ITEM.map(def => (
                      <td key={def.campo} style={{ minWidth: def.tipo === 'fecha' || def.tipo === 'invoice' ? 130 : 90 }}>
                        <EcInput def={def} valor={form[def.campo] ?? ''} editando={editando} invoices={invoices}
                          onChange={v => cambiarItem(it.item_id, def.campo, v)}/>
                      </td>
                    ))}
                    <td className="td-right mono">{fmt.num(it.entrada.qty)}</td>
                    <td className="td-right mono">{fmt.num(it.entrada.cbm)}</td>
                    {EC_COLUMNAS.map(([k, , f]) => <td key={k} className="td-right mono">{fmt[f](calc.calculado?.[k])}</td>)}
                  </tr>
                  {abierta && (
                    <tr>
                      <td></td>
                      <td colSpan={3 + L.CAMPOS_ITEM.length + EC_COLUMNAS.length}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16, padding: '8px 0' }}>
                          {EC_DETALLE.map(([titulo, campos]) => (
                            <div key={titulo}>
                              <div className="field-label" style={{ marginBottom: 4 }}>{titulo}</div>
                              {campos.map(([k, label, f]) => (
                                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, padding: '2px 0' }}>
                                  <span className="td-muted">{label}</span><span className="mono">{fmt[f](calc.calculado?.[k])}</span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                        <EcAvisos lista={calc.advertencias}/>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="card-footer td-muted" style={{ fontSize: 12 }}>
        SKU, cantidad y CBM se editan en «SKUs del contenedor». El arancel se captura en % (35 = 35 %). Al marcar la etapa «HL liquidada» el costeo se cierra con las cifras de ese momento.
      </div>
    </div>
  );
}

window.EmbarqueCosteo = EmbarqueCosteo;
