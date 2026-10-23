// ===== Zeutica — Ubicaciones de Bodega =====
const { useState: rp_uS, useEffect: rp_uE, useMemo: rp_uM } = React;

const UBI_BLANK = { warehouse_id: '', cantidad: 0, cama: 0 };
// Valor de `celdaAud` cuando se audita el grupo de tarjetas cuyo warehouse_id no es ID de ninguna celda.
const UBI_SIN_CELDA = '\u0000sin-celda';

// Panel de auditoría global (sin SKU elegido): qué SKUs con stock hay en la celda elegida del mapa.
function PanelAuditoriaCelda({ estado, error, onReintentar, auditoria, celdaSel, onElegirCelda, onElegirSku }) {
  const A = window.anaquelesLogica;
  const tarjetaVacia = (icono, texto, extra) => (
    <div className="card">
      <div className="card-body">
        <div className="empty" style={{ padding: 40 }}>
          <div className="empty-icon"><Icon name={icono}/></div>
          <div>{texto}</div>
          {extra}
        </div>
      </div>
    </div>
  );
  if (estado === 'cargando') return tarjetaVacia('building', <span className="spinner"/>);
  if (estado === 'error') {
    return (
      <div className="card">
        <div className="card-body">
          <div className="crm-error">No se pudieron cargar las tarjetas de la bodega. {error}</div>
          <button className="btn btn-sm btn-primary" style={{ marginTop: 8 }} onClick={onReintentar}>
            <Icon name="refresh" size={12}/> Reintentar
          </button>
        </div>
      </div>
    );
  }
  if (!auditoria) return tarjetaVacia('building', 'Cargando el plano de anaqueles…');

  const sinCelda = auditoria.sinPosicion;
  const esSinCelda = celdaSel === UBI_SIN_CELDA;
  const datos = celdaSel && !esSinCelda ? auditoria.porCodigo.get(A.normalizarCodigo(celdaSel)) : null;
  const gruposSinCelda = esSinCelda ? A.skusEnCelda(sinCelda) : null;
  const grupo = esSinCelda ? gruposSinCelda : (datos || { conStock: [], sinStock: [] });

  const tabla = (filas, titulo, conId) => (
    <div style={{ overflowX: 'auto' }}>
      <table className="table ubi-aud-tabla">
        <thead>
          <tr><th>{titulo}</th><th>Cantidad</th><th>Cama</th>{conId && <th>ID guardado</th>}</tr>
        </thead>
        <tbody>
          {filas.map(s => (
            <tr key={s.sku}>
              <td>
                <button type="button" className="ubi-aud-sku" onClick={() => onElegirSku(s.sku)} title={`Ver ubicaciones de ${s.sku}`}>
                  <span className="mono">{s.sku}</span>
                  {s.nombre && <span className="td-muted">{s.nombre}</span>}
                </button>
              </td>
              <td className="mono">{s.cantidad}</td>
              <td className="mono">{s.tarjetas.map(t => t.cama ?? 0).join(' / ')}</td>
              {conId && <td className="mono td-muted">{[...new Set(s.tarjetas.map(t => t.warehouse_id || 'sin ID'))].join(', ')}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <div className="card">
        <div className="card-header"><h3 className="card-title">Auditoría de bodega</h3></div>
        <div className="card-body ubi-aud-resumen">
          <span className="badge">{auditoria.celdasConStock} celda{auditoria.celdasConStock !== 1 ? 's' : ''} con stock</span>
          {sinCelda.length > 0 && (
            <button type="button" className={`btn btn-sm ${esSinCelda ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => onElegirCelda(esSinCelda ? null : UBI_SIN_CELDA)}
              title="Tarjetas cuyo warehouse_id no es el ID de ninguna celda del plano">
              <Icon name="alert" size={12}/> {sinCelda.length} sin celda en el plano
            </button>
          )}
        </div>
      </div>

      {!celdaSel ? tarjetaVacia('building', 'Haz clic en una celda del mapa para ver qué SKUs tiene') : (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              {esSinCelda ? 'Sin celda en el plano' : <>Celda <span className="mono">{celdaSel}</span></>}
            </h3>
            <span className="badge">{grupo.conStock.length} SKU{grupo.conStock.length !== 1 ? 's' : ''} con stock</span>
          </div>
          {grupo.conStock.length === 0 && grupo.sinStock.length === 0 ? (
            <div className="card-body">
              <div className="empty" style={{ padding: 28 }}>
                <div className="empty-icon"><Icon name="box"/></div>
                <div>Sin tarjetas en esta celda</div>
              </div>
            </div>
          ) : (
            <>
              {grupo.conStock.length > 0
                ? tabla(grupo.conStock, 'SKU con stock', esSinCelda)
                : <div className="card-body td-muted" style={{ fontSize: 13 }}>Ningún SKU con stock en esta celda.</div>}
              {grupo.sinStock.length > 0 && (
                <>
                  <div className="card-body td-muted ubi-aud-subtitulo">Tarjetas sin stock (cantidad 0)</div>
                  {tabla(grupo.sinStock, 'SKU', esSinCelda)}
                </>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}

// Compras recién ingresadas con piezas aún sin tarjeta. Cada línea se reparte en una o varias celdas;
// al quedar todo ubicado (o marcarla «sin ubicación») deja de aparecer. El datalist #ubi-celdas lo pone la página.
function ComprasPorUbicar({ onCambio, onElegirSku, askConfirm }) {
  const toast = window.useToast();
  const L = window.comprasUbicarLogica;
  const [estado, setEstado] = rp_uS('cargando'); // 'cargando' | 'ok' | 'error'
  const [error, setError] = rp_uS('');
  const [facturas, setFacturas] = rp_uS([]);
  const [abierto, setAbierto] = rp_uS(null); // id de la línea con el formulario abierto
  const [form, setForm] = rp_uS(null);
  const [guardando, setGuardando] = rp_uS(false);

  const cargar = async () => {
    setEstado(e => (e === 'ok' ? 'ok' : 'cargando'));
    const r = await window.api.comprasPorUbicar();
    if (r.ok) {
      setFacturas(Array.isArray(r.data?.facturas) ? r.data.facturas : []);
      setEstado('ok');
      setError('');
    } else {
      setEstado('error');
      setError(r.error || 'Sin respuesta del servidor');
    }
  };
  rp_uE(() => { cargar(); }, []);

  const abrir = (item) => { setAbierto(item.id); setForm(L.formularioInicial(item)); };

  const ubicar = async (item) => {
    const v = L.validarReparto(form, item.pendiente);
    if (v.error) { toast.error('Revisa la ubicación', v.error); return; }
    setGuardando(true);
    const r = await window.api.ubicarCompra(item.id, v.datos);
    setGuardando(false);
    if (r.ok) {
      toast.success('Ubicación creada', `${v.datos.cantidad} de ${item.sku} en ${v.datos.warehouse_id}`);
      setAbierto(null);
      await cargar();
      onCambio(item.sku);
    } else {
      toast.error(`No se pudo ubicar ${item.sku}`, r.error);
      if (r.status === 409 || r.status === 404) { setAbierto(null); cargar(); } // ya la ubicó alguien más
    }
  };

  const sinUbicacion = (item) => askConfirm(
    `¿Marcar ${item.sku} (${item.pendiente} pendientes) como sin ubicación? Saldrá de esta lista y no se creará ninguna tarjeta.`,
    async () => {
      const r = await window.api.compraSinUbicacion(item.id);
      if (r.ok) { toast.success('Compra sin ubicación', item.sku); setAbierto(null); await cargar(); }
      else { toast.error(`No se pudo marcar ${item.sku}`, r.error); cargar(); }
    }
  );

  const cuenta = L.contarPendientes(facturas);
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <h3 className="card-title">Compras por ubicar</h3>
        {estado === 'ok' && cuenta.lineas > 0 && (
          <span className="badge badge-warning">{cuenta.lineas} SKU · {cuenta.piezas} pzas</span>
        )}
      </div>
      {estado === 'cargando' && <div className="card-body"><span className="spinner"/></div>}
      {estado === 'error' && (
        <div className="card-body">
          <div className="crm-error">No se pudieron cargar las compras por ubicar. {error}</div>
          <button className="btn btn-sm btn-primary" style={{ marginTop: 8 }} onClick={cargar}>
            <Icon name="refresh" size={12}/> Reintentar
          </button>
        </div>
      )}
      {estado === 'ok' && cuenta.lineas === 0 && (
        <div className="card-body td-muted" style={{ fontSize: 13 }}>Todo lo comprado ya está ubicado.</div>
      )}
      {estado === 'ok' && facturas.map(f => (
        <div key={`${f.num_factura}|${f.proveedor}`} className="card-body" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="td-muted" style={{ fontSize: 12, marginBottom: 6 }}>
            Factura <span className="mono">{f.num_factura || 's/n'}</span>{f.proveedor ? ` · ${f.proveedor}` : ''}
          </div>
          {f.items.map(item => (
            <div key={item.id} style={{ padding: '6px 0' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button type="button" className="ubi-aud-sku" onClick={() => onElegirSku(item.sku)} title={`Ver ubicaciones de ${item.sku}`}>
                  <span className="mono">{item.sku}</span>
                  {item.nombre && <span className="td-muted">{item.nombre}</span>}
                </button>
                <span className="mono" style={{ marginLeft: 'auto' }}>
                  {item.pendiente} por ubicar{item.cantidad_ubicada > 0 ? ` (de ${item.cantidad})` : ''}
                </span>
                <button className="btn btn-sm btn-primary" onClick={() => (abierto === item.id ? setAbierto(null) : abrir(item))}>
                  {abierto === item.id ? 'Cancelar' : 'Ubicar'}
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => sinUbicacion(item)}
                  title="Sacar de la lista sin crear tarjetas">Sin ubicación</button>
              </div>
              {abierto === item.id && form && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <label style={{ fontSize: 12 }}>Celda
                    <input className="input" list="ubi-celdas" value={form.warehouse_id} autoFocus
                      onChange={e => setForm({ ...form, warehouse_id: e.target.value })}/>
                  </label>
                  <label style={{ fontSize: 12 }}>Cantidad
                    <input className="input" type="number" min="1" max={item.pendiente} value={form.cantidad}
                      onChange={e => setForm({ ...form, cantidad: e.target.value })}/>
                  </label>
                  <label style={{ fontSize: 12 }}>Cama
                    <input className="input" type="number" min="0" value={form.cama}
                      onChange={e => setForm({ ...form, cama: e.target.value })}/>
                  </label>
                  <button className="btn btn-sm btn-primary" disabled={guardando} onClick={() => ubicar(item)}>
                    {guardando ? <><span className="spinner"/> Guardando...</> : 'Guardar ubicación'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function PageUbicaciones() {
  const toast = window.useToast();
  const [askConfirm, ConfirmModal] = window.useConfirm();
  const [productos, setProductos] = rp_uS([]);
  const [q, setQ] = rp_uS('');
  const [selSku, setSelSku] = rp_uS(null);
  const [ubicaciones, setUbicaciones] = rp_uS([]);
  const [loading, setLoading] = rp_uS(false);
  const [editIdx, setEditIdx] = rp_uS(null);
  const [form, setForm] = rp_uS(UBI_BLANK);
  const [saving, setSaving] = rp_uS(false);
  const [showNueva, setShowNueva] = rp_uS(false);
  const [nuevaForm, setNuevaForm] = rp_uS({ warehouse_id: '', cantidad: 0, cama: 0 });
  const [savingNueva, setSavingNueva] = rp_uS(false);
  const [registro, setRegistro] = rp_uS([]);
  const [loadingReg, setLoadingReg] = rp_uS(false);
  const [showRegistro, setShowRegistro] = rp_uS(false);
  const [trasOrigen, setTrasOrigen] = rp_uS('');
  const [trasDestino, setTrasDestino] = rp_uS('');
  const [trasCantidad, setTrasCantidad] = rp_uS('');
  const [trasSaving, setTrasSaving] = rp_uS(false);
  const [traspasos, setTraspasos] = rp_uS([]);
  const [repSaving, setRepSaving] = rp_uS(false);
  const [resaltarId, setResaltarId] = rp_uS(null);
  // Plano de anaqueles (GET /anaqueles): compartido por todos los SKUs.
  const [disposicion, setDisposicion] = rp_uS(null);
  const [dispEstado, setDispEstado] = rp_uS('cargando'); // 'cargando' | 'ok' | 'error'
  const [dispError, setDispError] = rp_uS('');
  const [editandoBodega, setEditandoBodega] = rp_uS(false);
  // Auditoría global (sin SKU elegido): todas las tarjetas de todos los SKUs + celda elegida en el mapa.
  const [tarjetas, setTarjetas] = rp_uS([]);
  const [tarjEstado, setTarjEstado] = rp_uS('cargando'); // 'cargando' | 'ok' | 'error'
  const [tarjError, setTarjError] = rp_uS('');
  const [celdaAud, setCeldaAud] = rp_uS(null);
  const tarjPeticion = React.useRef(0);

  rp_uE(() => {
    (async () => setProductos(await window.api.productos()))();
    cargarDisposicion();
  }, []);

  // Al abrir la página y cada vez que se vuelve a la vista global se releen las tarjetas
  // (pudieron cambiar al editar o traspasar un SKU).
  rp_uE(() => { if (!selSku) cargarTarjetas(); }, [selSku]);

  const cargarTarjetas = async () => {
    const n = ++tarjPeticion.current;
    setTarjEstado(e => (e === 'ok' ? 'ok' : 'cargando'));
    const r = await window.api.tarjetasBodega();
    if (n !== tarjPeticion.current) return; // llegó una respuesta más nueva
    if (r.ok) {
      const lista = Array.isArray(r.data) ? r.data : r.data?.tarjetas;
      setTarjetas(Array.isArray(lista) ? lista : []);
      setTarjEstado('ok');
      setTarjError('');
    } else {
      setTarjEstado('error');
      setTarjError(r.error || 'Sin respuesta del servidor');
    }
  };

  const volverGlobal = () => {
    setSelSku(null);
    setUbicaciones([]);
    setEditIdx(null);
    setShowNueva(false);
    setResaltarId(null);
  };

  const auditoria = rp_uM(
    () => (tarjEstado === 'ok' && disposicion ? window.anaquelesLogica.auditarBodega(disposicion.anaqueles, tarjetas) : null),
    [tarjEstado, tarjetas, disposicion]
  );

  const cargarDisposicion = async () => {
    setDispEstado(e => (e === 'ok' ? 'ok' : 'cargando'));
    const r = await window.api.disposicionBodega();
    if (r.ok && r.data) {
      setDisposicion(r.data);
      setDispEstado('ok');
      setDispError('');
    } else {
      setDispEstado('error');
      setDispError(r.error || 'Sin respuesta del servidor');
    }
  };

  // IDs de celda para autocompletar la ubicación en los formularios.
  const codigosCeldas = rp_uM(() => {
    const lista = [];
    (disposicion?.anaqueles || []).forEach(a => (a.celdas || []).forEach(c => c.codigo && lista.push(c.codigo)));
    return lista.sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
  }, [disposicion]);

  const filteredProds = rp_uM(() => {
    if (!q) return productos;
    const lq = q.toLowerCase();
    return productos.filter(p => p.sku.toLowerCase().includes(lq) || p.nombre.toLowerCase().includes(lq));
  }, [productos, q]);

  const eliminar = async (id) => {
    const r = await window.api.eliminarUbicacion(id);
    if (r.ok) {
      toast.success('Ubicación eliminada', `ID #${id}`);
      await cargarUbicaciones(selSku);
    } else {
      toast.error(`No se pudo eliminar la ubicación #${id}`, r.error);
    }
  };

  const guardarNueva = async () => {
    if (!selSku) return;
    if (!nuevaForm.warehouse_id.trim()) { toast.error('Campo requerido', 'Ingresa la ubicación'); return; }
    setSavingNueva(true);
    const r = await window.api.crearUbicacion(selSku, {
      sku: selSku,
      warehouse_id: nuevaForm.warehouse_id.trim(),
      cantidad: Number(nuevaForm.cantidad) || 0,
      cama: parseInt(nuevaForm.cama, 10) || 0,
    });
    setSavingNueva(false);
    if (r.ok) {
      toast.success('Ubicación creada', selSku);
      window.fireConfetti();
      setNuevaForm({ warehouse_id: '', cantidad: 0, cama: 0 });
      setShowNueva(false);
      await cargarUbicaciones(selSku);
    } else {
      toast.error(`No se pudo crear la ubicación de ${selSku}`, r.error);
    }
  };

  const cargarUbicaciones = async (sku) => {
    setSelSku(sku);
    setEditIdx(null);
    setShowNueva(false);
    setResaltarId(null);
    setTrasOrigen('');
    setTrasDestino('');
    setTrasCantidad('');
    setTraspasos([]);
    setLoading(true);
    const r = await window.api.ubicacionesSku(sku);
    setLoading(false);
    if (r.ok) {
      const data = Array.isArray(r.data) ? r.data : (r.data ? [r.data] : []);
      setUbicaciones(data);
    } else {
      setUbicaciones([]);
      toast.error(`No se pudieron cargar las ubicaciones de ${sku}`, r.error);
    }
    cargarRegistro(sku);
    cargarTraspasos(sku);
    cargarDisposicion(); // la ocupación por celda cambia con cada alta/edición/traspaso
  };

  const cargarRegistro = async (sku) => {
    setLoadingReg(true);
    const r = await window.api.registroUbicaciones(sku);
    setLoadingReg(false);
    if (r.ok) {
      setRegistro(Array.isArray(r.data) ? r.data : (r.data ? [r.data] : []));
    } else {
      setRegistro([]);
      toast.error(`No se pudo cargar el historial de ${sku}`, r.error);
    }
  };

  const cargarTraspasos = async (sku) => {
    const r = await window.api.traspasosUbicaciones(sku);
    setTraspasos(r.ok && Array.isArray(r.data) ? r.data : []);
  };

  const ubOrigenSel = rp_uM(() => ubicaciones.find(u => String(u.id) === String(trasOrigen)), [ubicaciones, trasOrigen]);
  const ubDestinoSel = rp_uM(() => ubicaciones.find(u => String(u.id) === String(trasDestino)), [ubicaciones, trasDestino]);
  const trasMult = window.ubicacionesLogica.obtenerMultiplo(selSku);
  const trasOrigenEsOficina = window.ubicacionesLogica.esOficina(ubOrigenSel?.warehouse_id);
  const trasDestinoEsOficina = window.ubicacionesLogica.esOficina(ubDestinoSel?.warehouse_id);
  const trasError = window.ubicacionesLogica.validarTraspaso({
    origenId: trasOrigen, destinoId: trasDestino, cantidad: trasCantidad, stockOrigen: ubOrigenSel?.cantidad,
    multiplo: trasMult, destinoEsOficina: trasDestinoEsOficina, origenEsOficina: trasOrigenEsOficina,
  });
  const trasN = Number(trasCantidad);
  const trasConv = !trasError ? window.ubicacionesLogica.convertirTraspaso({
    cantidad: trasCantidad, multiplo: trasMult,
    destinoEsOficina: trasDestinoEsOficina, origenEsOficina: trasOrigenEsOficina,
  }) : null;

  const ejecutarTraspaso = async () => {
    setTrasSaving(true);
    const r = await window.api.traspasarUbicacion({
      sku: selSku,
      origen_id: Number(trasOrigen),
      destino_id: Number(trasDestino),
      cantidad: Number(trasCantidad),
    });
    setTrasSaving(false);
    if (r.ok) {
      toast.success('Traspaso registrado', `${r.data?.cantidad ?? trasCantidad} de ${selSku}: ${r.data?.origen?.warehouse_id} → ${r.data?.destino?.warehouse_id}`);
      setTrasOrigen('');
      setTrasDestino('');
      setTrasCantidad('');
      await cargarUbicaciones(selSku);
    } else {
      toast.error(`No se pudo registrar el traspaso de ${selSku}`, r.error);
    }
  };

  const confirmarTraspaso = () => {
    if (trasError || !trasConv) { toast.error('Revisa el traspaso', trasError || 'Datos incompletos'); return; }
    const convTxt = trasConv.modo === 'desempaquetar'
      ? ` Se desempaquetan ${trasN}×${trasConv.factor}=${trasConv.sumaDestino} piezas.`
      : trasConv.modo === 'empaquetar'
        ? ` Se empaquetan ${trasN}÷${trasConv.factor}=${trasConv.sumaDestino} bultos.`
        : '';
    askConfirm(
      `¿Traspasar ${trasN} de ${selSku} de ${ubOrigenSel?.warehouse_id} (quedan ${(Number(ubOrigenSel?.cantidad) || 0) - trasConv.restaOrigen}) a ${ubDestinoSel?.warehouse_id}?${convTxt} Solo mueve tarjetas, no toca el stock de productos.`,
      ejecutarTraspaso
    );
  };

  const abrirEditar = (idx) => {
    const ub = ubicaciones[idx];
    setEditIdx(idx);
    setForm({ id: ub.id, warehouse_id: ub.warehouse_id || '', cantidad: ub.cantidad ?? 0, cama: ub.cama ?? 0 });
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Arrastre en el esquema: cambia solo la celda (warehouse_id), no la cantidad.
  const moverTarjeta = (ub, codigo) => {
    if (ub.id == null) { toast.error('No se puede mover', 'La tarjeta no tiene ID'); return; }
    const L = window.ubicacionesLogica;
    const clave = window.anaquelesLogica.normalizarCodigo(codigo);
    const oc = disposicion?.ocupacion?.[clave];
    const delSku = ubicaciones.filter(u => window.anaquelesLogica.normalizarCodigo(u.warehouse_id) === clave);
    const partes = [`¿Mover la tarjeta ${ub.warehouse_id || 'sin ID'} de ${selSku} (cantidad ${ub.cantidad ?? 0}) a la celda ${codigo}?`];
    if (oc?.tarjetas) {
      partes.push(`La celda ya tiene ${oc.tarjetas} tarjeta(s) de ${oc.skus} SKU(s)` +
        (delSku.length ? `, ${delSku.length} de ${selSku} (quedarán como tarjetas separadas).` : '.'));
    }
    const antes = L.calcularTotalPiezas(ub.cantidad, selSku, ub.warehouse_id);
    const despues = L.calcularTotalPiezas(ub.cantidad, selSku, codigo);
    if (antes !== despues) {
      partes.push(`Atención: entra o sale de «Oficina», el total pasa de ${antes} a ${despues} piezas. Para empaquetar o desempaquetar usa Traspasar.`);
    }
    partes.push('Solo cambia la ubicación; la cantidad no se toca.');
    askConfirm(partes.join(' '), () => ejecutarMover(ub, codigo));
  };

  const ejecutarMover = async (ub, codigo) => {
    const r = await window.api.moverUbicacion(ub.id, { sku: selSku, warehouse_id: codigo });
    if (r.ok) {
      toast.success('Tarjeta movida', `${selSku}: ${r.data?.origen ?? ub.warehouse_id} → ${r.data?.destino ?? codigo}`);
      await cargarUbicaciones(selSku);
      setResaltarId(ub.id);
    } else {
      toast.error(`No se pudo mover la tarjeta de ${selSku}`, r.error);
    }
  };

  const guardar = () => {
    if (!selSku) return;
    const L = window.ubicacionesLogica;
    const previo = ubicaciones.find(u => String(u.id) === String(form.id));
    if (previo && L.obtenerMultiplo(selSku, previo.warehouse_id) !== L.obtenerMultiplo(selSku, form.warehouse_id)) {
      askConfirm(
        `La ubicación entra o sale de «Oficina»: el múltiplo de piezas de esta tarjeta cambia (${L.obtenerMultiplo(selSku, previo.warehouse_id)} → ${L.obtenerMultiplo(selSku, form.warehouse_id)} pzas/unidad). ¿Guardar de todas formas?`,
        ejecutarGuardar
      );
      return;
    }
    ejecutarGuardar();
  };

  const ejecutarGuardar = async () => {
    setSaving(true);
    const r = await window.api.editarUbicacion(form.id, {
      sku: selSku,
      warehouse_id: form.warehouse_id,
      cantidad: Number(form.cantidad) || 0,
      cama: parseInt(form.cama, 10) || 0,
    });
    setSaving(false);
    if (r.ok) {
      toast.success('Ubicación actualizada', selSku);
      window.fireConfetti();
      await cargarUbicaciones(selSku);
      setEditIdx(null);
    } else {
      toast.error(`No se pudo guardar la ubicación de ${selSku}`, r.error);
    }
  };

  const prodSelObj = rp_uM(() => productos.find(p => p.sku === selSku), [productos, selSku]);

  // Clic en una celda del esquema: pulso + scroll a su tarjeta.
  const resaltarUbicacion = (ub) => {
    setResaltarId(ub.id);
    const el = ub.id != null ? document.getElementById(`ubi-card-${ub.id}`) : null;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Reporte Excel para conteo cíclico: respeta el SKU seleccionado, o todo si no hay.
  const descargarReporte = async () => {
    setRepSaving(true);
    const r = await window.api.ubicacionesReporteConteo(selSku || undefined);
    setRepSaving(false);
    if (!r.ok) { toast.error('No se pudo generar el reporte', r.error); return; }
    const url = URL.createObjectURL(r.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = r.nombre || 'conteo-ciclico.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast.success('Reporte generado', r.nombre || '');
  };

  const mapaCarga = (
    <div className="card ubi-mapa-card">
      <div className="card-body">
        <div className="empty" style={{ padding: 60 }}><span className="spinner"/></div>
      </div>
    </div>
  );

  return (
    <div className="page page-ubicaciones">
      {ConfirmModal}
      <datalist id="ubi-celdas">
        {codigosCeldas.map(c => <option key={c} value={c}/>)}
      </datalist>
      <div className="section-header">
        <div>
          <h2 className="section-title">Ubicaciones de Bodega</h2>
          <p className="section-subtitle">Consulta y edita las ubicaciones físicas por SKU.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {!editandoBodega && (
            <button className="btn btn-sm btn-secondary" onClick={() => setEditandoBodega(true)}
              title="Mover y dimensionar anaqueles y poner los IDs de sus celdas">
              <Icon name="edit" size={13}/> Editar bodega
            </button>
          )}
          <button
            className="btn btn-sm btn-secondary"
            disabled={repSaving}
            onClick={descargarReporte}
            title={selSku ? `Reporte de ${selSku}` : 'Reporte de todos los SKUs con ubicación'}
          >
            {repSaving ? <><span className="spinner"/> Generando...</> : <><Icon name="download" size={13}/> Reporte conteo</>}
          </button>
        {selSku && (
          <>
            <button className="btn btn-sm btn-secondary" onClick={volverGlobal}
              title="Quitar el SKU y auditar toda la bodega en el mapa">
              <Icon name="building" size={13}/> Vista global
            </button>
            <button
              className={`btn btn-sm ${showRegistro ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setShowRegistro(v => !v)}
            >
              <Icon name="list" size={13}/> {showRegistro ? 'Ocultar registro' : 'Ver registro'}
            </button>
            <button
              className={`btn btn-sm ${showNueva ? 'btn-secondary' : 'btn-primary'}`}
              onClick={() => { setShowNueva(v => !v); setNuevaForm({ warehouse_id: '', cantidad: 0, cama: 0 }); }}
            >
              <Icon name="plus" size={13}/> {showNueva ? 'Cancelar' : 'Nueva ubicación'}
            </button>
          </>
        )}
        </div>
      </div>

      <ComprasPorUbicar
        askConfirm={askConfirm}
        onElegirSku={cargarUbicaciones}
        onCambio={(sku) => { cargarDisposicion(); if (selSku === sku) cargarUbicaciones(sku); else if (!selSku) cargarTarjetas(); }}
      />

      <div className="ubi-layout">
        <aside className="ubi-col ubi-col-skus">
          <div className="card ubi-skus-card">
            <div className="card-header">
              <div className="input-group" style={{ flex: 1 }}>
                <span className="input-group-icon"><Icon name="search" size={14}/></span>
                <input className="input" placeholder="Buscar SKU o nombre..." value={q} onChange={e => setQ(e.target.value)}/>
              </div>
            </div>
            <div className="ubi-sku-list">
              {filteredProds.length === 0 ? (
                <div className="empty" style={{ padding: 32 }}>
                  <div className="empty-icon"><Icon name="box"/></div>
                  <div>Sin resultados</div>
                </div>
              ) : filteredProds.map(p => (
                <button
                  key={p.sku}
                  className={`ubi-sku-item${selSku === p.sku ? ' sel' : ''}`}
                  onClick={() => cargarUbicaciones(p.sku)}
                >
                  <span className="mono" style={{ fontSize: 11, color: 'var(--brand)', fontWeight: 600 }}>{p.sku}</span>
                  <span style={{ fontSize: 13, color: 'var(--fg-1)' }}>{p.nombre}</span>
                  {p.ubicacion && <span className="mono td-muted" style={{ fontSize: 11 }}>{p.ubicacion}</span>}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="ubi-col ubi-col-mapa">
          {editandoBodega ? (
            <div className="card ubi-mapa-card">
              <div className="card-header"><h3 className="card-title">Editar bodega — plano de anaqueles</h3></div>
              <div className="card-body">
                {dispEstado === 'ok' && disposicion ? (
                  window.EditorBodega
                    ? <window.EditorBodega key={disposicion.version} disposicion={disposicion}
                        onRecargar={cargarDisposicion} onCerrar={() => setEditandoBodega(false)}/>
                    : <div className="empty" style={{ padding: 32 }}>Editor no disponible (revisa la versión del archivo).</div>
                ) : dispEstado === 'error' ? (
                  <div className="empty" style={{ padding: 32 }}>
                    <div className="empty-icon"><Icon name="alert"/></div>
                    <div>No se pudo cargar el plano de anaqueles</div>
                    <div className="td-muted" style={{ fontSize: 12 }}>{dispError}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => setEditandoBodega(false)}>Volver</button>
                      <button className="btn btn-sm btn-primary" onClick={cargarDisposicion}><Icon name="refresh" size={12}/> Reintentar</button>
                    </div>
                  </div>
                ) : (
                  <div className="empty" style={{ padding: 60 }}><span className="spinner"/></div>
                )}
              </div>
            </div>
          ) : selSku && loading ? mapaCarga : (
            <>
              {selSku && (
                <div className="card ubi-sku-head">
                  <div className="card-body ubi-sku-head-body">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="mono" style={{ fontSize: 12, color: 'var(--brand)', fontWeight: 600 }}>{selSku}</div>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{prodSelObj?.nombre || ''}</div>
                    </div>
                    <span className="badge">{ubicaciones.length} ubicación{ubicaciones.length !== 1 ? 'es' : ''}</span>
                    <span className="badge" title={`Múltiplo: ${window.ubicacionesLogica.obtenerMultiplo(selSku)} pzas/unidad`}>
                      Total: {window.ubicacionesLogica.sumarTotalPiezas(ubicaciones, selSku).toLocaleString('es-MX')} pzas
                    </span>
                  </div>
                </div>
              )}
              <div className="card ubi-mapa-card">
                <div className="card-header">
                  <h3 className="card-title">{selSku ? 'Esquema de Ubicaciones de Bodega' : 'Esquema de Bodega — auditoría global'}</h3>
                </div>
                <div className="card-body ubi-mapa-body">
                  {dispEstado === 'error' && (
                    <div className="crm-error" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                      <span>No se pudo cargar el plano de anaqueles{selSku ? '; se muestra la vista provisional' : ''}. {dispError}</span>
                      <button className="btn btn-sm btn-secondary" onClick={cargarDisposicion}><Icon name="refresh" size={12}/> Reintentar</button>
                    </div>
                  )}
                  {!selSku && dispEstado !== 'ok' ? (
                    dispEstado === 'cargando' && <div className="empty" style={{ padding: 60 }}><span className="spinner"/></div>
                  ) : window.EsquemaBodega
                    ? <window.EsquemaBodega ubicaciones={selSku ? ubicaciones : []} selSku={selSku} resaltarId={resaltarId}
                        disposicion={dispEstado === 'ok' ? disposicion : null}
                        onCeldaClick={resaltarUbicacion} onMoverTarjeta={moverTarjeta}
                        auditoria={auditoria} celdaAud={celdaAud} onCeldaAuditar={setCeldaAud}/>
                    : <div className="empty" style={{ padding: 32 }}>Esquema no disponible (revisa la versión del archivo).</div>}
                </div>
              </div>
            </>
          )}
        </section>

        <aside className="ubi-col ubi-col-acciones">
          {!selSku ? (editandoBodega ? null :
            <PanelAuditoriaCelda
              estado={tarjEstado} error={tarjError} onReintentar={cargarTarjetas}
              auditoria={auditoria} celdaSel={celdaAud} onElegirCelda={setCeldaAud}
              onElegirSku={cargarUbicaciones}/>
          ) : loading ? (
            <div className="card">
              <div className="card-body">
                <div className="empty" style={{ padding: 40 }}>
                  <div className="empty-icon"><Icon name="building"/></div>
                  <div><span className="spinner"/></div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {ubicaciones.length >= 2 ? (
                <div className="card">
                  <div className="card-header"><h3 className="card-title">Traspasar entre ubicaciones — {selSku}</h3></div>
                  <div className="card-body ubi-tras-grid">
                    <div className="field"><label className="field-label">Origen *</label>
                      <select className="select" value={trasOrigen} onChange={e => setTrasOrigen(e.target.value)}>
                        <option value="">Seleccionar…</option>
                        {ubicaciones.filter(u => u.id != null).map(u => (
                          <option key={u.id} value={u.id}>{u.warehouse_id} — disp: {u.cantidad ?? 0}</option>
                        ))}
                      </select>
                    </div>
                    <div className="field"><label className="field-label">Destino *</label>
                      <select className="select" value={trasDestino} onChange={e => setTrasDestino(e.target.value)}>
                        <option value="">Seleccionar…</option>
                        {ubicaciones.filter(u => u.id != null).map(u => (
                          <option key={u.id} value={u.id}>{u.warehouse_id} — disp: {u.cantidad ?? 0}</option>
                        ))}
                      </select>
                    </div>
                    <div className="field"><label className="field-label">Cantidad *</label>
                      <input
                        className="input mono"
                        type="number"
                        min="1"
                        step="1"
                        value={trasCantidad}
                        onChange={e => setTrasCantidad(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  {!trasError && trasConv && ubOrigenSel && ubDestinoSel && (
                    <div className="card-body td-muted" style={{ fontSize: 12, paddingTop: 0 }}>
                      {ubOrigenSel.warehouse_id}: {(Number(ubOrigenSel.cantidad) || 0)} → {(Number(ubOrigenSel.cantidad) || 0) - trasConv.restaOrigen}
                      {' · '}
                      {ubDestinoSel.warehouse_id}: {(Number(ubDestinoSel.cantidad) || 0)} → {(Number(ubDestinoSel.cantidad) || 0) + trasConv.sumaDestino}
                      {trasConv.modo === 'desempaquetar' && ` · Se desempaquetan ${trasN}×${trasConv.factor}=${trasConv.sumaDestino} piezas`}
                      {trasConv.modo === 'empaquetar' && ` · Se empaquetan ${trasN}÷${trasConv.factor}=${trasConv.sumaDestino} bultos`}
                      {' · '}
                      Total en piezas sin cambio. Solo mueve tarjetas, no toca el stock de productos.
                    </div>
                  )}
                  {trasError && (trasOrigen || trasDestino || trasCantidad) && (
                    <div className="card-body" style={{ paddingTop: 0 }}><div className="crm-error">{trasError}</div></div>
                  )}
                  <div className="card-footer">
                    <button className="btn btn-primary btn-sm" disabled={trasSaving || !!trasError} onClick={confirmarTraspaso}>
                      {trasSaving ? <><span className="spinner"/> Registrando...</> : <><Icon name="transfer" size={13}/> Traspasar</>}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="card">
                  <div className="card-body td-muted" style={{ fontSize: 12 }}>
                    Para traspasar entre ubicaciones este SKU necesita al menos 2 tarjetas.
                  </div>
                </div>
              )}

              {traspasos.length > 0 && (
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">Traspasos registrados — {selSku} <span className="td-muted">({traspasos.length})</span></h3>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Origen</th>
                          <th>Destino</th>
                          <th>Cantidad</th>
                          <th>Usuario</th>
                        </tr>
                      </thead>
                      <tbody>
                        {traspasos.map(t => (
                          <tr key={t.id}>
                            <td className="mono td-muted" style={{ whiteSpace: 'nowrap' }}>{t.fecha ?? '—'}</td>
                            <td className="mono">{t.origen_warehouse_id ?? '—'}</td>
                            <td className="mono">{t.destino_warehouse_id ?? '—'}</td>
                            <td className="mono">{t.cantidad ?? '—'}</td>
                            <td className="td-muted">{t.usuario ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {showNueva && (
                <div className="card">
                  <div className="card-header"><h3 className="card-title">Nueva ubicación — {selSku}</h3></div>
                  <div className="card-body ubi-tras-grid">
                    <div className="field"><label className="field-label">Ubicación *</label>
                      <input
                        className="input mono"
                        list="ubi-celdas"
                        value={nuevaForm.warehouse_id}
                        onChange={e => setNuevaForm(f => ({ ...f, warehouse_id: e.target.value }))}
                        placeholder="CEDIS-E5"
                      />
                    </div>
                    <div className="field"><label className="field-label">Cantidad</label>
                      <input
                        className="input mono"
                        type="number"
                        min="0"
                        value={nuevaForm.cantidad}
                        onChange={e => setNuevaForm(f => ({ ...f, cantidad: e.target.value }))}
                        placeholder="0"
                      />
                    </div>
                    <div className="field"><label className="field-label">Cama</label>
                      <input
                        className="input mono"
                        type="number"
                        min="0"
                        step="1"
                        value={nuevaForm.cama}
                        onChange={e => setNuevaForm(f => ({ ...f, cama: e.target.value }))}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="card-footer">
                    <button className="btn btn-secondary btn-sm" onClick={() => setShowNueva(false)}>Cancelar</button>
                    <button className="btn btn-primary btn-sm" disabled={savingNueva || !nuevaForm.warehouse_id.trim()} onClick={guardarNueva}>
                      {savingNueva ? <><span className="spinner"/> Guardando...</> : <><Icon name="check" size={13}/> Crear ubicación</>}
                    </button>
                  </div>
                </div>
              )}

              {showRegistro && (
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Registro de movimientos — {selSku}</h3>
                </div>
                {loadingReg ? (
                  <div className="card-body"><div className="empty" style={{ padding: 40 }}><span className="spinner"/></div></div>
                ) : registro.length === 0 ? (
                  <div className="card-body">
                    <div className="empty" style={{ padding: 40 }}>
                      <div className="empty-icon"><Icon name="building"/></div>
                      <div>Sin registros para este SKU</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>SKU</th>
                          <th>Ubicación</th>
                          <th>Cama</th>
                          <th>Cantidad</th>
                          <th>Fecha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {registro.map((reg, i) => (
                          <tr key={i}>
                            <td className="mono">{reg.sku ?? '—'}</td>
                            <td className="mono">{reg.warehouse_id ?? '—'}</td>
                            <td className="mono">{reg.cama ?? '—'}</td>
                            <td className="mono">{reg.cantidad ?? '—'}</td>
                            <td className="mono td-muted">{reg.fecha ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              )}

              {ubicaciones.length === 0 ? (
                <div className="card">
                  <div className="card-body">
                    <div className="empty" style={{ padding: 40 }}>
                      <div className="empty-icon"><Icon name="building"/></div>
                      <div>Sin ubicaciones registradas para este SKU</div>
                    </div>
                  </div>
                </div>
              ) : ubicaciones.map((ub, idx) => (
                <div className={`card${ub.id != null && String(ub.id) === String(resaltarId) ? ' ubi-resaltada' : ''}`}
                  key={idx} id={ub.id != null ? `ubi-card-${ub.id}` : undefined}>
                  {editIdx === idx ? (
                    <>
                      <div className="card-header"><h3 className="card-title">Editar ubicación {idx + 1}</h3></div>
                      <div className="card-body ubi-tras-grid">
                        <div className="field"><label className="field-label">Ubicación</label>
                          <input className="input mono" list="ubi-celdas" value={form.warehouse_id} onChange={e => set('warehouse_id', e.target.value)} placeholder="CEDIS-E5"/></div>
                        <div className="field"><label className="field-label">Cantidad</label>
                          <input className="input mono" type="number" min="0" value={form.cantidad} onChange={e => set('cantidad', e.target.value)} placeholder="0"/></div>
                        <div className="field"><label className="field-label">Cama</label>
                          <input className="input mono" type="number" min="0" step="1" value={form.cama} onChange={e => set('cama', e.target.value)} placeholder="0"/></div>
                      </div>
                      <div className="card-footer">
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditIdx(null)}>Cancelar</button>
                        <button className="btn btn-primary btn-sm" disabled={saving} onClick={guardar}>
                          {saving ? <><span className="spinner"/> Guardando...</> : <><Icon name="check" size={13}/> Guardar cambios</>}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {ub.id != null && (
                        <div className="card-header" style={{ paddingTop: 10, paddingBottom: 10 }}>
                          <span className="mono td-muted" style={{ fontSize: 12 }}>ID #{ub.id}</span>
                        </div>
                      )}
                      <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 14 }}>
                        {Object.entries(ub).filter(([k]) => k !== 'sku' && k !== 'id').map(([k, v]) => (
                          <div key={k}>
                            <div className="field-label" style={{ textTransform: 'capitalize', marginBottom: 2 }}>{k.replace(/_/g, ' ')}</div>
                            <div className="mono" style={{ fontSize: 13, fontWeight: 500, color: v ? 'var(--fg-1)' : 'var(--fg-3)' }}>{v ?? '—'}</div>
                          </div>
                        ))}
                        {(() => {
                          const d = window.ubicacionesLogica.detalleTotalPiezas(ub.cantidad, ub.sku || selSku, ub.warehouse_id);
                          if (!d) return null;
                          return (
                            <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border, rgba(128,128,128,.25))', paddingTop: 10 }}>
                              <div className="field-label" style={{ marginBottom: 2 }}>Total de piezas</div>
                              <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--brand)' }}>
                                {d.total.toLocaleString('es-MX')} <span className="td-muted" style={{ fontSize: 12, fontWeight: 400 }}>({d.cantidad} × {d.multiplo})</span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                      <div className="card-footer" style={{ justifyContent: 'flex-end' }}>
                        {ub.id != null && (
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}
                            onClick={() => askConfirm(`¿Eliminar ubicación ID #${ub.id}? Esta acción no se puede deshacer.`, () => eliminar(ub.id))}>
                            <Icon name="trash" size={12}/> Eliminar
                          </button>
                        )}
                        <button className="btn btn-secondary btn-sm" onClick={() => abrirEditar(idx)}>
                          <Icon name="edit" size={12}/> Editar
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

window.PageUbicaciones = PageUbicaciones;
