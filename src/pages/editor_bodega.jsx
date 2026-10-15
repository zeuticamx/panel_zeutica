// ===== Zeutica — Editor de Bodega: plano 2D de anaqueles =====
// Se edita en planta (vista superior con rejilla); el isométrico es solo lectura.
// Arrastrar un anaquel lo mueve, el tirador derecho cambia columnas y las flechas
// mueven el seleccionado. Niveles, código e IDs de celda van en el panel.
// Nada se guarda hasta «Guardar disposición» (una transacción con versión: 409
// si otro usuario guardó antes). Reglas en anaqueles-logica.js.
const { useState: ebe_uS, useMemo: ebe_uM, useRef: ebe_uR, useEffect: ebe_uE } = React;

const EBE_CELDA = 28;

function ebe_copiar(anaqueles) {
  return (anaqueles || []).map(a => ({
    id: a.id ?? null,
    clave: a.id != null ? `id-${a.id}` : a.clave,
    codigo: a.codigo, x: a.x, y: a.y, columnas: a.columnas, niveles: a.niveles,
    orientacion: a.orientacion === 'V' ? 'V' : 'H',
    celdas: (a.celdas || []).map(c => ({ nivel: c.nivel, columna: c.columna, codigo: c.codigo })),
  }));
}

// Forma que se compara y se envía: sin claves locales ni celdas sin ID.
function ebe_limpiar(anaqueles) {
  return anaqueles.map(a => ({
    id: a.id, codigo: String(a.codigo || '').trim(), x: a.x, y: a.y, columnas: a.columnas, niveles: a.niveles,
    orientacion: a.orientacion === 'V' ? 'V' : 'H',
    celdas: a.celdas
      .filter(c => String(c.codigo || '').trim())
      .map(c => ({ nivel: c.nivel, columna: c.columna, codigo: String(c.codigo).trim() }))
      .sort((p, q) => p.nivel - q.nivel || p.columna - q.columna),
  }));
}

function EditorBodega({ disposicion, onRecargar, onCerrar }) {
  const A = window.anaquelesLogica;
  const U = window.ubicacionesLogica;
  const toast = window.useToast();
  const [askConfirm, ConfirmModal] = window.useConfirm();
  const ocupacion = disposicion.ocupacion || {};
  const original = ebe_uM(() => ebe_limpiar(ebe_copiar(disposicion.anaqueles)), [disposicion]);
  const originalPorId = ebe_uM(() => new Map(original.map(a => [a.id, a])), [original]);
  const [borrador, setBorrador] = ebe_uS(() => ebe_copiar(disposicion.anaqueles));
  const [selClave, setSelClave] = ebe_uS(() => {
    const a = (disposicion.anaqueles || [])[0];
    return a ? `id-${a.id}` : null;
  });
  // { modo: 'mover' | 'ancho', idx, inicio: { cx, cy }, orig, cand, valido, motivo }
  const [arrastre, setArrastre] = ebe_uS(null);
  const [aviso, setAviso] = ebe_uS('');
  const [prefijo, setPrefijo] = ebe_uS('');
  const [guardando, setGuardando] = ebe_uS(false);
  const [conflicto, setConflicto] = ebe_uS(false);
  const contador = ebe_uR(0);
  const svgRef = ebe_uR(null);

  const limpio = ebe_uM(() => ebe_limpiar(borrador), [borrador]);
  const sucio = JSON.stringify(limpio) !== JSON.stringify(original);
  const plan = ebe_uM(() => A.planearDisposicion(original, limpio, ocupacion), [original, limpio, ocupacion]);
  const repetidos = ebe_uM(() => A.codigosRepetidos(borrador), [borrador]);
  const idxSel = borrador.findIndex(a => a.clave === selClave);
  const sel = idxSel >= 0 ? borrador[idxSel] : null;
  const arrastrando = !!arrastre;

  ebe_uE(() => {
    if (!arrastrando) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setArrastre(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [arrastrando]);

  const actualizar = (idx, cambios) => setBorrador(b => b.map((a, i) => (i === idx ? { ...a, ...cambios } : a)));

  // Las cajas están donde estaban al leer la disposición: la ocupación se mide
  // con el ID guardado en esa posición, no con el que se esté escribiendo.
  const codigoGuardado = (a, nivel, columna) => A.celdaEn(originalPorId.get(a.id), nivel, columna)?.codigo || '';
  const ocupadasFuera = (a, columnas, niveles) => A.celdasOcupadasFuera(originalPorId.get(a.id), columnas, niveles, ocupacion);

  const siguienteCodigo = () => {
    const usados = new Set(borrador.map(a => A.normalizarCodigo(a.codigo)));
    for (let i = 0; i < 26; i++) {
      const letra = String.fromCharCode(65 + i);
      if (!usados.has(letra.toLowerCase())) return letra;
    }
    return `A${borrador.length + 1}`;
  };

  const agregar = () => {
    for (let y = 0; y < A.PLANO_ALTO; y++) {
      for (let x = 0; x + 4 <= A.PLANO_ANCHO; x++) {
        const cand = { x, y, columnas: 4, niveles: 2, orientacion: 'H' };
        if (A.posicionLibre(borrador, -1, cand)) {
          contador.current += 1;
          const clave = `nuevo-${contador.current}`;
          setBorrador(b => [...b, { id: null, clave, codigo: siguienteCodigo(), ...cand, celdas: [] }]);
          setSelClave(clave);
          setAviso('');
          return;
        }
      }
    }
    setAviso('No hay espacio libre en el plano: mueve o achica un anaquel.');
  };

  const cambiarTamano = (idx, columnas, niveles) => {
    const a = borrador[idx];
    const cols = Math.max(1, Math.min(A.MAX_COLUMNAS, columnas));
    const nivs = Math.max(1, Math.min(A.MAX_NIVELES, niveles));
    const bloqueadas = ocupadasFuera(a, cols, nivs);
    if (bloqueadas.length) { setAviso(`No se puede achicar: ${bloqueadas.join(', ')} tiene(n) tarjetas. Muévelas antes.`); return; }
    if (!A.posicionLibre(borrador, idx, { ...a, columnas: cols, niveles: nivs })) {
      setAviso('No cabe: se encimaría con otro anaquel o saldría del plano.');
      return;
    }
    setAviso('');
    actualizar(idx, { columnas: cols, niveles: nivs, celdas: A.recortarCeldas(a.celdas, cols, nivs) });
  };

  // Horizontal <-> vertical conservando la esquina (x, y); las celdas y sus IDs no cambian.
  const girar = (idx) => {
    const a = borrador[idx];
    const orientacion = A.orientacionDe(a) === 'V' ? 'H' : 'V';
    if (!A.posicionLibre(borrador, idx, { ...a, orientacion })) {
      setAviso(`No se puede girar ${a.codigo}: se encimaría con otro anaquel o saldría del plano. Muévelo primero.`);
      return;
    }
    setAviso('');
    actualizar(idx, { orientacion });
  };

  const cambiarCelda = (idx, nivel, columna, codigo) => {
    setBorrador(b => b.map((a, i) => {
      if (i !== idx) return a;
      const otras = a.celdas.filter(c => !(c.nivel === nivel && c.columna === columna));
      return { ...a, celdas: [...otras, { nivel, columna, codigo }] };
    }));
  };

  const autonumerarSel = () => {
    const usados = new Set();
    borrador.forEach(a => a.celdas.forEach(c => {
      const k = A.normalizarCodigo(c.codigo);
      if (k) usados.add(k);
    }));
    actualizar(idxSel, { celdas: A.autonumerar(sel, prefijo, usados) });
  };

  const eliminarSel = () => {
    const guardado = originalPorId.get(sel.id);
    const conTarjetas = (guardado?.celdas || []).filter(c => A.tarjetasEn(ocupacion, c.codigo) > 0);
    const n = conTarjetas.reduce((s, c) => s + A.tarjetasEn(ocupacion, c.codigo), 0);
    const quitar = () => {
      setBorrador(b => b.filter(a => a.clave !== sel.clave));
      setSelClave(null);
    };
    if (!n) { quitar(); return; }
    askConfirm(
      `El anaquel ${sel.codigo} tiene ${n} tarjeta(s) en ${conTarjetas.map(c => c.codigo).join(', ')}. Al guardar quedarán sin celda (no se borran) y podrás colocarlas después. ¿Quitar el anaquel?`,
      quitar
    );
  };

  // ---- Arrastre en el plano (pointer events nativos + getScreenCTM) ----
  const aPlano = (e) => {
    const m = svgRef.current?.getScreenCTM();
    if (!m) return { cx: 0, cy: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { cx: p.x / EBE_CELDA, cy: A.PLANO_ALTO - p.y / EBE_CELDA };
  };

  const iniciar = (e, idx, modo) => {
    if (e.button > 0) return;
    e.preventDefault();
    e.stopPropagation();
    const a = borrador[idx];
    setSelClave(a.clave);
    try { svgRef.current.setPointerCapture(e.pointerId); } catch (err) { /* sin captura, funciona dentro del plano */ }
    setArrastre({ modo, idx, inicio: aPlano(e), orig: a, cand: a, valido: true, motivo: '' });
  };

  // Candidato y motivo de rechazo para la posición actual del puntero. Se calcula
  // con el propio evento (también al soltar) para no depender del último render.
  const evaluar = (e, arr) => {
    const p = aPlano(e);
    const { orig, idx, modo, inicio } = arr;
    let cand;
    let motivo = '';
    const vertical = A.orientacionDe(orig) === 'V';
    if (modo === 'mover') {
      const h = A.huella(orig);
      cand = {
        ...orig,
        x: Math.max(0, Math.min(A.PLANO_ANCHO - h.ancho, orig.x + Math.round(p.cx - inicio.cx))),
        y: Math.max(0, Math.min(A.PLANO_ALTO - h.fondo, orig.y + Math.round(p.cy - inicio.cy))),
      };
    } else {
      // El tirador alarga el anaquel: hacia la derecha si es horizontal, hacia el fondo si es vertical.
      const largo = vertical ? Math.round(p.cy - orig.y) : Math.round(p.cx - orig.x);
      const cupo = vertical ? A.PLANO_ALTO - orig.y : A.PLANO_ANCHO - orig.x;
      const columnas = Math.max(1, Math.min(A.MAX_COLUMNAS, cupo, largo));
      cand = { ...orig, columnas };
      const bloqueadas = ocupadasFuera(orig, columnas, orig.niveles);
      if (bloqueadas.length) motivo = `${bloqueadas.join(', ')} tiene(n) tarjetas`;
    }
    if (!motivo && !A.posicionLibre(borrador, idx, cand)) motivo = 'se encima con otro anaquel';
    return { cand, motivo };
  };

  const onPointerMove = (e) => {
    if (!arrastre) return;
    const { cand, motivo } = evaluar(e, arrastre);
    const previo = arrastre.cand;
    if (cand.x === previo.x && cand.y === previo.y && cand.columnas === previo.columnas) return;
    setArrastre({ ...arrastre, cand, valido: !motivo, motivo });
  };

  const soltar = (e) => {
    if (!arrastre) return;
    try { svgRef.current.releasePointerCapture(e.pointerId); } catch (err) { /* ya liberado */ }
    const { idx, orig } = arrastre;
    const { cand, motivo } = evaluar(e, arrastre);
    setArrastre(null);
    if (motivo) { setAviso(`No se aplicó: ${motivo}.`); return; }
    setAviso('');
    if (cand.x !== orig.x || cand.y !== orig.y || cand.columnas !== orig.columnas) {
      actualizar(idx, { x: cand.x, y: cand.y, columnas: cand.columnas, celdas: A.recortarCeldas(orig.celdas, cand.columnas, cand.niveles) });
    }
  };

  // Flechas: mueven el anaquel con foco (arriba = hacia el fondo).
  const teclas = (e, idx) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (!d) return;
    e.preventDefault();
    const a = borrador[idx];
    const cand = { ...a, x: a.x + d[0], y: a.y + d[1] };
    if (A.posicionLibre(borrador, idx, cand)) actualizar(idx, { x: cand.x, y: cand.y });
  };

  // ---- Guardar ----
  const ejecutar = async () => {
    setGuardando(true);
    const r = await window.api.guardarDisposicionBodega({ version: disposicion.version, anaqueles: limpio });
    setGuardando(false);
    if (r.ok) {
      toast.success('Disposición guardada', `${limpio.length} anaquel(es)`);
      onRecargar();
    } else if (r.status === 409) {
      setConflicto(true);
      toast.error('Otro usuario cambió la bodega', 'Tus cambios no se guardaron; recarga la disposición');
    } else {
      toast.error('No se pudo guardar la disposición', r.error);
    }
  };

  const guardar = () => {
    if (plan.errores.length) return;
    const partes = [`Se guardará la disposición con ${limpio.length} anaquel(es).`];
    const conTarjetas = plan.renombres.filter(r => r.tarjetas > 0);
    if (conTarjetas.length) {
      partes.push(`Cambian de ID celdas con tarjetas (todos los SKUs): ${conTarjetas.map(r => `${r.de} → ${r.a} (${r.tarjetas})`).join(', ')}.`);
    }
    const oficina = conTarjetas.filter(r => U.esOficina(r.de) !== U.esOficina(r.a));
    if (oficina.length) {
      partes.push(`Atención: ${oficina.map(r => `${r.de} → ${r.a}`).join(', ')} entra o sale de «Oficina»; cambia el múltiplo y el total de piezas de esas tarjetas.`);
    }
    if (plan.desasignadas.length) {
      partes.push(`Quedan sin celda: ${plan.desasignadas.map(d => `${d.codigo} (${d.tarjetas})`).join(', ')}.`);
    }
    askConfirm(partes.join(' '), ejecutar);
  };

  const cerrar = () => {
    if (!sucio) { onCerrar(); return; }
    askConfirm('Hay cambios sin guardar en la disposición. ¿Descartarlos?', onCerrar);
  };

  // ---- Render ----
  const W = A.PLANO_ANCHO * EBE_CELDA;
  const H = A.PLANO_ALTO * EBE_CELDA;
  const yPx = (y) => (A.PLANO_ALTO - 1 - y) * EBE_CELDA;
  const rejilla = [];
  for (let c = 0; c <= A.PLANO_ANCHO; c++) rejilla.push(<line key={`v${c}`} className="ebe-linea" x1={c * EBE_CELDA} y1={0} x2={c * EBE_CELDA} y2={H}/>);
  for (let f = 0; f <= A.PLANO_ALTO; f++) rejilla.push(<line key={`h${f}`} className="ebe-linea" x1={0} y1={f * EBE_CELDA} x2={W} y2={f * EBE_CELDA}/>);

  const celdasPanel = [];
  if (sel) {
    for (let n = sel.niveles - 1; n >= 0; n--) {
      for (let c = 0; c < sel.columnas; c++) {
        const cod = A.celdaEn(sel, n, c)?.codigo || '';
        const antes = codigoGuardado(sel, n, c);
        const t = A.tarjetasEn(ocupacion, antes);
        const rep = repetidos.has(A.normalizarCodigo(cod));
        const renombrada = t > 0 && A.normalizarCodigo(antes) !== A.normalizarCodigo(cod);
        celdasPanel.push(
          <label key={`${n}-${c}`} className={`ebe-celda${rep ? ' error' : ''}${t ? ' ocupada' : ''}`}
            title={`Nivel ${n + 1}, columna ${c + 1}${t ? ` · ${t} tarjeta(s) en ${antes}` : ''}`}>
            <input className="input mono" value={cod} maxLength={100} placeholder="—"
              onChange={e => cambiarCelda(idxSel, n, c, e.target.value)}/>
            {t > 0 && <span className="ebe-badge">{t}</span>}
            {renombrada && <span className="ebe-antes">antes {antes}</span>}
          </label>
        );
      }
    }
  }

  return (
    <div className="ebe">
      {ConfirmModal}
      <div className="ebe-barra">
        <button className="btn btn-sm btn-secondary" onClick={agregar}><Icon name="plus" size={13}/> Anaquel</button>
        <span className="td-muted ebe-ayuda">Arrastra para mover · el tirador del extremo alarga · «Orientación» gira · flechas mueven · Esc cancela</span>
      </div>

      <svg ref={svgRef} className="ebe-plano" viewBox={`0 0 ${W} ${H + 18}`}
        onPointerMove={onPointerMove} onPointerUp={soltar} onPointerCancel={() => setArrastre(null)}
        onPointerDown={(e) => { if (e.target.classList?.contains('ebe-fondo')) setSelClave(null); }}>
        <rect className="ebe-fondo" x={0} y={0} width={W} height={H}/>
        {rejilla}
        {borrador.map((a, i) => {
          const enArrastre = arrastre && arrastre.idx === i;
          const v = enArrastre ? arrastre.cand : a;
          const vertical = A.orientacionDe(v) === 'V';
          const hu = A.huella(v);
          const x = v.x * EBE_CELDA;
          const w = hu.ancho * EBE_CELDA;
          const h = hu.fondo * EBE_CELDA;
          const y = yPx(v.y + hu.fondo - 1); // borde superior (la fila más lejana del anaquel)
          const clases = ['ebe-anaquel', vertical && 'vertical', a.clave === selClave && 'sel', enArrastre && !arrastre.valido && 'invalido']
            .filter(Boolean).join(' ');
          return (
            <g key={a.clave} className={clases} tabIndex={0} role="button"
              aria-label={`Anaquel ${a.codigo}, ${v.columnas} columnas por ${a.niveles} niveles, ${vertical ? 'vertical' : 'horizontal'}`}
              onFocus={() => setSelClave(a.clave)} onKeyDown={(e) => teclas(e, i)}>
              <rect className="ebe-cuerpo" x={x} y={y} width={w} height={h} rx={3}
                onPointerDown={(e) => iniciar(e, i, 'mover')}/>
              {Array.from({ length: v.columnas - 1 }, (_, c) => vertical ? (
                <line key={c} className="ebe-division" x1={x + 4} y1={y + (c + 1) * EBE_CELDA} x2={x + EBE_CELDA - 4} y2={y + (c + 1) * EBE_CELDA}/>
              ) : (
                <line key={c} className="ebe-division" x1={x + (c + 1) * EBE_CELDA} y1={y + 4} x2={x + (c + 1) * EBE_CELDA} y2={y + EBE_CELDA - 4}/>
              ))}
              <text className="ebe-etiqueta" x={x + w / 2} y={y + h / 2 + 4}>
                {!vertical && v.columnas >= 3 ? `${a.codigo} · ${v.columnas}×${a.niveles}` : a.codigo}
              </text>
              {vertical ? (
                <rect className="ebe-tirador vertical" x={x + 5} y={y - 2} width={EBE_CELDA - 10} height={8} rx={2}
                  onPointerDown={(e) => iniciar(e, i, 'ancho')}/>
              ) : (
                <rect className="ebe-tirador" x={x + w - 6} y={y + 5} width={8} height={EBE_CELDA - 10} rx={2}
                  onPointerDown={(e) => iniciar(e, i, 'ancho')}/>
              )}
            </g>
          );
        })}
        <text className="ebe-frente" x={W / 2} y={H + 13}>FRENTE</text>
      </svg>

      {(aviso || (arrastre && !arrastre.valido)) && (
        <div className="crm-error">{arrastre && !arrastre.valido ? `No se puede: ${arrastre.motivo}` : aviso}</div>
      )}

      {sel ? (
        <div className="ebe-panel">
          <div className="ebe-campos">
            <div className="field"><label className="field-label">Código</label>
              <input className="input mono" value={sel.codigo} maxLength={50} onChange={e => actualizar(idxSel, { codigo: e.target.value })}/>
            </div>
            <div className="field"><label className="field-label">Columnas (máx. {A.MAX_COLUMNAS})</label>
              <div className="ebe-paso">
                <button className="btn btn-sm btn-secondary" aria-label="Quitar columna" onClick={() => cambiarTamano(idxSel, sel.columnas - 1, sel.niveles)}><Icon name="minus" size={12}/></button>
                <span className="mono">{sel.columnas}</span>
                <button className="btn btn-sm btn-secondary" aria-label="Agregar columna" onClick={() => cambiarTamano(idxSel, sel.columnas + 1, sel.niveles)}><Icon name="plus" size={12}/></button>
              </div>
            </div>
            <div className="field"><label className="field-label">Niveles (máx. {A.MAX_NIVELES})</label>
              <div className="ebe-paso">
                <button className="btn btn-sm btn-secondary" aria-label="Quitar nivel" onClick={() => cambiarTamano(idxSel, sel.columnas, sel.niveles - 1)}><Icon name="minus" size={12}/></button>
                <span className="mono">{sel.niveles}</span>
                <button className="btn btn-sm btn-secondary" aria-label="Agregar nivel" onClick={() => cambiarTamano(idxSel, sel.columnas, sel.niveles + 1)}><Icon name="plus" size={12}/></button>
              </div>
            </div>
            <div className="field"><label className="field-label">Orientación</label>
              <button className="btn btn-sm btn-secondary" onClick={() => girar(idxSel)}
                title="Gira el anaquel conservando su esquina: a lo ancho o hacia el fondo del plano">
                <Icon name="refresh" size={12}/> {A.orientacionDe(sel) === 'V' ? 'Vertical → horizontal' : 'Horizontal → vertical'}
              </button>
            </div>
            <div className="field"><label className="field-label">Posición</label>
              <span className="mono td-muted" style={{ fontSize: 12, lineHeight: '30px' }}>col {sel.x} · fila {sel.y}</span>
            </div>
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', alignSelf: 'flex-end' }} onClick={eliminarSel}>
              <Icon name="trash" size={12}/> Quitar anaquel
            </button>
          </div>

          <div className="ebe-celdas-head">
            <span className="field-label" style={{ margin: 0 }}>IDs de celda = ubicación de las tarjetas (nivel de arriba primero)</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input className="input mono" style={{ width: 90 }} value={prefijo} placeholder="Prefijo" onChange={e => setPrefijo(e.target.value)}/>
              <button className="btn btn-sm btn-secondary" onClick={autonumerarSel} title="Solo llena celdas sin ID: prefijo + nivel + columna (10, 11… 30, 31…)">
                <Icon name="tag" size={12}/> Autonumerar vacías
              </button>
            </div>
          </div>
          <div className="ebe-celdas" style={{ gridTemplateColumns: `repeat(${sel.columnas}, minmax(58px, 1fr))` }}>
            {celdasPanel}
          </div>
          <div className="td-muted" style={{ fontSize: 11 }}>
            Cambiar el ID de una celda con tarjetas les cambia la ubicación a todas (todos los SKUs). Una celda con tarjetas no se puede vaciar ni quitar al achicar.
          </div>
        </div>
      ) : (
        <div className="td-muted" style={{ fontSize: 12 }}>
          {borrador.length ? 'Selecciona un anaquel para editar su tamaño y los IDs de sus celdas.' : 'Aún no hay anaqueles: agrega uno con «Anaquel».'}
        </div>
      )}

      {sucio && plan.errores.length > 0 && (
        <div className="crm-error">
          {plan.errores.map((e, i) => <div key={i}>{e}</div>)}
        </div>
      )}
      {conflicto && (
        <div className="crm-error" style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
          <span>Otro usuario guardó la disposición mientras editabas. Recarga para ver su versión (se pierden tus cambios).</span>
          <button className="btn btn-sm btn-secondary" onClick={onRecargar}><Icon name="refresh" size={12}/> Recargar</button>
        </div>
      )}

      <div className="ebe-pie">
        <button className="btn btn-secondary btn-sm" onClick={cerrar}>{sucio ? 'Descartar' : 'Cerrar'}</button>
        <button className="btn btn-primary btn-sm" disabled={!sucio || guardando || plan.errores.length > 0 || conflicto} onClick={guardar}>
          {guardando ? <><span className="spinner"/> Guardando...</> : <><Icon name="check" size={13}/> Guardar disposición</>}
        </button>
      </div>
    </div>
  );
}

window.EditorBodega = EditorBodega;
