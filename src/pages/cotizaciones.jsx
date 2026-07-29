// ===== Zeutica — Cotizaciones =====
const { useState: rp_uS, useEffect: rp_uE, useMemo: rp_uM, useRef: rp_uR } = React;

async function generarPDFCotizacion({ codigo, clienteObj, clienteNombre, items, descuentoPct, descuentoMonto, subtotalOriginal, subtotalDesc, costoEnvio, iva, totalFinal, formaPago, metodoPago, comentario }) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const PW = 210, M = 10;
  const fmt = v => `$${Number(v).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // -- Logo --
  try {
    const resp = await fetch('imagenes/logo.webp');
    if (resp.ok) {
      const blob = await resp.blob();
      const b64 = await new Promise(res => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width; canvas.height = img.height;
          canvas.getContext('2d').drawImage(img, 0, 0);
          res(canvas.toDataURL('image/png'));
          URL.revokeObjectURL(img.src);
        };
        img.src = URL.createObjectURL(blob);
      });
      doc.addImage(b64, 'PNG', M, 8, 40, 15);
    }
  } catch(_) {}

  // -- Company info --
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text([
    'Domicilio: Blvd De los Charros 1629 Belenes Norte Cp 45145, Zapopan, Jalisco.',
    'www.zeutica.com',
    'Teléfono: 33-1299-5688',
    'E-mail: ventas1@zeutica.com',
    'Asesor: Cecilia Parra',
  ], M, 28, { lineHeightFactor: 1.6 });

  // -- Cotizacion title + date boxes --
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(`COTIZACION ${codigo}`, PW - M, 15, { align: 'right' });

  const fecha = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
  doc.setFontSize(9);
  [['Fecha:', fecha], ['Válido Hasta:', '7 Días']].forEach(([label, val], idx) => {
    const yy = 24 + idx * 6;
    doc.rect(140, yy, 30, 6);
    doc.rect(170, yy, 30, 6);
    doc.setFont('helvetica', 'bold'); doc.text(label, 142, yy + 4.5);
    doc.setFont('helvetica', 'normal'); doc.text(val, 199, yy + 4.5, { align: 'right' });
  });

  // -- Client section --
  let y = 55;
  doc.setFillColor(0, 74, 153);
  doc.rect(M, y, PW - 2 * M, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('   CLIENTE', M, y + 5.5);
  doc.setTextColor(0, 0, 0);
  y += 12;

  const filaCliente = (label, valor) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text(label, M, y);
    doc.setFont('helvetica', 'normal'); doc.text(String(valor || 'N/A'), M + 26, y);
    y += 6;
  };
  filaCliente('NOMBRE:', clienteNombre);
  filaCliente('EMPRESA:', clienteObj.empresa || clienteNombre);
  filaCliente('EMAIL:', clienteObj.email || '');
  filaCliente('DOMICILIO:', clienteObj.direccion || clienteObj.domicilio || '');
  filaCliente('TELÉFONO:', clienteObj.telefono || '');
  y += 5;

  // -- Products table header --
  const colW = [30, 80, 20, 30, 30];
  const heads = ['CÓDIGO / SKU', 'DESCRIPCIÓN', 'CANTIDAD', 'PRECIO UNITARIO', 'TOTAL'];
  doc.setFillColor(0, 74, 153);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
  let x = M;
  heads.forEach((h, i) => { doc.rect(x, y, colW[i], 8, 'FD'); x += colW[i]; });
  doc.setTextColor(255, 255, 255);
  x = M;
  heads.forEach((h, i) => {
    doc.text(h, x + colW[i] / 2, y + 5.5, { align: 'center' });
    x += colW[i];
  });
  doc.setTextColor(0, 0, 0);
  y += 8;

  // -- Rows --
  const disc = 1 - descuentoPct / 100;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  items.forEach(item => {
    const rowH = 8;
    x = M;
    const pUnit = item.precio * disc;
    const pTot  = item.cantidad * pUnit;
    const cells = [
      { v: item.sku,                    align: 'center', w: colW[0] },
      { v: item.nombre.slice(0, 50),    align: 'left',   w: colW[1], offsetX: 2 },
      { v: String(item.cantidad),       align: 'center', w: colW[2] },
      { v: fmt(pUnit),                  align: 'right',  w: colW[3], offsetX: -2 },
      { v: fmt(pTot),                   align: 'right',  w: colW[4], offsetX: -2 },
    ];
    cells.forEach(c => {
      doc.rect(x, y, c.w, rowH, 'S');
      const tx = c.align === 'center' ? x + c.w / 2 : c.align === 'right' ? x + c.w + (c.offsetX || 0) : x + (c.offsetX || 0);
      doc.text(c.v, tx, y + 5, { align: c.align });
      x += c.w;
    });
    y += rowH;
  });
  y += 4;

  // -- Totals --
  const xT = 140;
  const filaTotal = (label, valor, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(9);
    if (bold) doc.setFillColor(220, 220, 220);
    doc.rect(xT, y, 30, 6, bold ? 'FD' : 'S');
    doc.rect(xT + 30, y, 30, 6, bold ? 'FD' : 'S');
    doc.text(label, xT + 28, y + 4.5, { align: 'right' });
    doc.text(valor, xT + 59, y + 4.5, { align: 'right' });
    y += 6;
  };
  filaTotal('Sub-Total:', fmt(subtotalOriginal));
  if (descuentoPct > 0) filaTotal(`Descuento (${descuentoPct}%):`, `-${fmt(descuentoMonto)}`);
  filaTotal('Costo del Envío:', fmt(costoEnvio));
  filaTotal('IVA (16%):', fmt(iva));
  filaTotal('TOTAL:', fmt(totalFinal), true);
  y += 8;

  // -- Terms --
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text('TÉRMINOS Y CONDICIONES', M, y); y += 7;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  const terms = [
    `1. FORMA DE PAGO: ${formaPago.toUpperCase()}`,
    `2. MÉTODO DE PAGO: ${metodoPago.toUpperCase()}`,
    '3. COTIZACIÓN EN: PESO MEXICANO (MXN)',
    '4. PRECIOS SUJETOS A CAMBIO SIN PREVIO AVISO.',
  ];
  terms.forEach(t => { doc.text(t, M, y); y += 5; });
  const coment4 = doc.splitTextToSize(`5. COMENTARIOS: ${comentario}`, PW - 2 * M);
  doc.text(coment4, M, y);
  y += coment4.length * 5 + 6;

  // -- Datos bancarios (cuadro) --
  const datosBanco = [
    'Clabe Interbancaria: 002320702110604152',
    'Banco: Banamex',
    'Nombre: Felipe Osvaldo Ruvalcaba Ayala',
  ];
  const boxW = 100;
  const boxH = 8 + datosBanco.length * 5 + 3;
  // El pie de página vive en y=272: si no cabe, el cuadro pasa a una hoja nueva.
  if (y + boxH > 262) { doc.addPage(); y = 20; }
  doc.setDrawColor(0, 74, 153);
  doc.setLineWidth(0.4);
  doc.rect(M, y, boxW, boxH, 'S');
  doc.setLineWidth(0.2);
  doc.setDrawColor(0, 0, 0);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text('DATOS BANCARIOS:', M + 3, y + 6);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  datosBanco.forEach((linea, i) => doc.text(linea, M + 3, y + 12 + i * 5));
  y += boxH;

  // -- Footer (all pages) --
  const total_pages = doc.getNumberOfPages();
  for (let p = 1; p <= total_pages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.text('Si tienes alguna pregunta por favor contáctanos', PW / 2, 272, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.text('Tel: 33-1299-5688 / E-mail: ventas1@zeutica.com', PW / 2, 277, { align: 'center' });
    doc.text(`Página ${p}`, PW - M, 282, { align: 'right' });
  }

  return doc.output('arraybuffer');
}

const COT_FORMAS_PAGO = [
  ['01', 'Efectivo'],
  ['02', 'Cheque nominativo'],
  ['03', 'Transferencia electrónica de fondos (SPEI)'],
  ['04', 'Tarjeta de crédito'],
  ['05', 'Monedero electrónico'],
  ['06', 'Dinero electrónico'],
  ['08', 'Vales de despensa'],
  ['12', 'Dación en pago'],
  ['13', 'Pago por subrogación'],
  ['14', 'Pago por consignación'],
  ['15', 'Condonación'],
  ['17', 'Compensación'],
  ['28', 'Tarjeta de débito'],
  ['29', 'Tarjeta de servicios'],
  ['30', 'Aplicación de anticipos'],
  ['31', 'Intermediario pagos'],
  ['99', 'Por definir'],
].map(([clave, desc]) => `${clave} - ${desc}`);

const METODO_PAGO = [
  ['PUE', 'Pago en Una sola Exhibición'],
  ['PPD', 'Pago en Parcialidades o Diferido'],
].map(([clave, desc]) => `${clave} - ${desc}`);
const COT_FORMA_PAGO_POR_DEFINIR = COT_FORMAS_PAGO.find(f => f.startsWith('99'));

// Registros viejos guardan texto libre ("TRANSFERENCIA", "EFECTIVO") en vez de la clave SAT.
const COT_ALIAS_FORMA_PAGO = {
  'EFECTIVO': '01',
  'CHEQUE': '02',
  'TRANSFERENCIA': '03',
  'SPEI': '03',
  'TRANSFERENCIA ELECTRONICA': '03',
  'TARJETA CREDITO': '04',
  'TARJETA DE CREDITO': '04',
  'TARJETA DEBITO': '28',
  'TARJETA DE DEBITO': '28',
};

// El API devuelve el pago como texto libre, como clave ("01") o como "01 - Efectivo":
// se normaliza al texto exacto del catálogo para que el <select> lo reconozca.
const cotNormalizaFormaPago = (valor) => {
  if (!valor) return '';
  const v = String(valor).trim();
  const low = v.toLowerCase();
  const clave = COT_ALIAS_FORMA_PAGO[v.toUpperCase()] || v.split('-')[0].trim();
  return COT_FORMAS_PAGO.find(f => f.toLowerCase() === low)
      || COT_FORMAS_PAGO.find(f => f.split(' - ')[1].toLowerCase() === low)
      || COT_FORMAS_PAGO.find(f => f.split(' - ')[0] === clave)
      || v;
};

const COT_COMENTARIOS = [
  'ENVIO GRATIS EN COMPRAS MAYORES A $7000.00 MAS IVA, TIEMPO DE ENTREGA DE 4-7 DIAS HABILES.',
  'EL ENVIO SE REALIZARA POR PAQUETERIA PAQUETE EXPRESS EN CASO DE REQUERIR UNA PAQUETERIA EN PARTICULAR ESTA SE COTIZARA DE MANERA ADICIONAL.',
  'ENTREGA EN BODEGA, HORARIO DE 10AM A 2PM',
  'OTROS...',
];

function CotFirmaCanvas({ onSave, onCancel, saving }) {
  const canvasRef = rp_uR(null);
  const drawing = rp_uR(false);
  const [confirmSave, setConfirmSave] = rp_uS(false);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };

  const startDraw = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawing.current = true;
    const ctx = canvas.getContext('2d');
    const { x, y } = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    const { x, y } = getPos(e, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDraw = () => { drawing.current = false; };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const b64 = canvas.toDataURL('image/png').split(',')[1];
    onSave(b64);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <canvas
        ref={canvasRef}
        width={460}
        height={160}
        style={{ border: '1px solid var(--line-strong)', borderRadius: 'var(--r-md)', background: '#fff', cursor: 'crosshair', touchAction: 'none', width: '100%' }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={stopDraw}
        onMouseLeave={stopDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={stopDraw}
      />
      {confirmSave && (
        <div style={{ fontSize: 12, color: 'var(--warn)', padding: '8px 12px', background: 'var(--warn-bg)', borderRadius: 'var(--r-md)', border: '1px solid var(--warn)' }}>
          ¿Confirmar guardar esta firma digital? Esta acción no se puede deshacer.
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => { clearCanvas(); setConfirmSave(false); }}>Limpiar</button>
        <button className="btn btn-secondary btn-sm" onClick={() => { setConfirmSave(false); onCancel(); }}>Cancelar</button>
        {confirmSave ? (
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmSave(false)}>No</button>
            <button className="btn btn-primary btn-sm" disabled={saving} onClick={save}>
              {saving ? <><span className="spinner"/> Guardando...</> : <><Icon name="check" size={13}/> Sí, guardar</>}
            </button>
          </>
        ) : (
          <button className="btn btn-primary btn-sm" disabled={saving} onClick={() => setConfirmSave(true)}>
            <Icon name="check" size={13}/> Guardar firma
          </button>
        )}
      </div>
    </div>
  );
}

function PageCotizaciones({ user }) {
  const toast = window.useToast();
  const [askConfirm, ConfirmModal] = window.useConfirm();
  const [cots, setCots] = rp_uS([]);
  const [q, setQ] = rp_uS('');
  const [estado, setEstado] = rp_uS('todos');

  const [showForm, setShowForm] = rp_uS(false);
  const [clientes, setClientes] = rp_uS([]);
  const [productos, setProductos] = rp_uS([]);
  const [nuevoCodigo, setNuevoCodigo] = rp_uS('');
  const [selectedCliente, setSelectedCliente] = rp_uS('');
  const [selectedSku, setSelectedSku] = rp_uS('');
  const [listaPrecio, setListaPrecio] = rp_uS('precio');
  const [cantidad, setCantidad] = rp_uS(1);
  const [precioManual, setPrecioManual] = rp_uS(0);
  const [items, setItems] = rp_uS([]);
  const [descuento, setDescuento] = rp_uS(0);
  const [incluirEnvio, setIncluirEnvio] = rp_uS(true);
  const [formaPago, setFormaPago] = rp_uS(COT_FORMAS_PAGO[0]);
  const [metodoPago, setMetodoPago] = rp_uS(METODO_PAGO[0]);
  const [comentario, setComentario] = rp_uS(COT_COMENTARIOS[0]);
  const [comentarioCustom, setComentarioCustom] = rp_uS('');
  const [submitting, setSubmitting] = rp_uS(false);
  const [verLoading, setVerLoading] = rp_uS(null);
  const [showConsultor, setShowConsultor] = rp_uS(false);
  const [editRelaciones, setEditRelaciones] = rp_uS({});
  const [savingRelacion, setSavingRelacion] = rp_uS(false);
  const [firmaModal, setFirmaModal] = rp_uS(null);
  const [verFirmaModal, setVerFirmaModal] = rp_uS(null);
  const [savingFirma, setSavingFirma] = rp_uS(false);
  const [complementoModal, setComplementoModal] = rp_uS(null);
  const [complementos, setComplementos] = rp_uS([]);
  const [loadingComplementos, setLoadingComplementos] = rp_uS(false);
  const [nuevoComplemento, setNuevoComplemento] = rp_uS('');
  const [nuevoPago, setNuevoPago] = rp_uS('');
  const [savingComplemento, setSavingComplemento] = rp_uS(false);

  rp_uE(() => { (async () => setCots(await window.api.cotizaciones()))(); }, []);

  rp_uE(() => {
    if (cots.length === 0) return;
    setEditRelaciones(prev => {
      const next = { ...prev };
      cots.forEach(c => {
        if (!next[c.codigo_cotizacion]) {
          next[c.codigo_cotizacion] = {
            relacion_factura: c.relacion_factura || '',
            forma_pago: cotNormalizaFormaPago(c.forma_pago),
            fecha_pago: c.fecha_pago ? c.fecha_pago.slice(0, 10) : '',
          };
        }
      });
      return next;
    });
  }, [cots]);

  rp_uE(() => {
    if (!showForm) return;
    (async () => {
      const [cls, prods, codigo] = await Promise.all([
        window.api.clientes(),
        window.api.productos(),
        window.api.nuevoCodigo(),
      ]);
      setClientes(cls);
      setProductos(prods);
      setNuevoCodigo(codigo);
      if (prods.length > 0) {
        setSelectedSku(prods[0].sku);
        setPrecioManual(Number(prods[0].precio) || 0);
      }
    })();
  }, [showForm]);

  const metodoPagoEsPPD = metodoPago.startsWith('PPD');

  rp_uE(() => {
    if (metodoPagoEsPPD) setFormaPago(COT_FORMA_PAGO_POR_DEFINIR);
  }, [metodoPagoEsPPD]);

  const prodObj = rp_uM(() => productos.find(p => p.sku === selectedSku), [productos, selectedSku]);

  rp_uE(() => {
    if (!prodObj) return;
    const map = { precio: prodObj.precio, precio_2: prodObj.precio_2, precio_3: prodObj.precio_3 };
    setPrecioManual(Number(map[listaPrecio]) || 0);
  }, [selectedSku, listaPrecio]);

  const subtotalOriginal = rp_uM(() => items.reduce((s, i) => s + i.total, 0), [items]);
  const descuentoMonto   = subtotalOriginal * (descuento / 100);
  const subtotalDesc     = subtotalOriginal - descuentoMonto;
  const envioBase        = (subtotalDesc * 1.16) > (7000 * 1.16) ? 0 : 250;
  const costoEnvio       = incluirEnvio ? envioBase : 0;
  const baseIva          = subtotalDesc + costoEnvio;
  const iva              = baseIva * 0.16;
  const totalFinal       = baseIva + iva;

  const agregarItem = () => {
    if (!selectedSku || cantidad < 1 || precioManual <= 0) return;
    setItems(prev => [...prev, {
      sku: selectedSku,
      nombre: prodObj?.nombre || selectedSku,
      cantidad,
      precio: precioManual,
      total: cantidad * precioManual,
    }]);
  };

  const removerItem = idx => setItems(prev => prev.filter((_, i) => i !== idx));

  const resetForm = () => {
    setShowForm(false); setItems([]); setDescuento(0);
    setSelectedCliente(''); setFormaPago(COT_FORMAS_PAGO[0]); setMetodoPago(METODO_PAGO[0]);
    setComentario(COT_COMENTARIOS[0]); setComentarioCustom('');
    setIncluirEnvio(true);
  };

  const guardar = async () => {
    if (!selectedCliente || items.length === 0) {
      toast.error('Formulario incompleto', 'Selecciona cliente y agrega al menos un producto');
      return;
    }
    setSubmitting(true);
    const clienteObj = clientes.find(c => c.nombre === selectedCliente) || {};
    const comentarioFinal = comentario === 'OTROS...' ? comentarioCustom : comentario;
    const disc = descuento / 100;

    let pdfBase64 = '';
    try {
      const buf = await generarPDFCotizacion({
        codigo: nuevoCodigo,
        clienteObj,
        clienteNombre: selectedCliente,
        items,
        descuentoPct: descuento,
        descuentoMonto,
        subtotalOriginal,
        subtotalDesc,
        costoEnvio,
        iva,
        totalFinal,
        formaPago,
        metodoPago,
        comentario: comentarioFinal,
      });
      const bytes = new Uint8Array(buf);
      let bin = '';
      bytes.forEach(b => bin += String.fromCharCode(b));
      pdfBase64 = btoa(bin);
    } catch(e) {
      toast.warn('PDF no generado', 'Se guardará sin archivo adjunto');
    }

    const payload = {
      codigo_cotizacion: nuevoCodigo,
      empresa: selectedCliente,
      atencion: clienteObj.atencion || '',
      email: clienteObj.email || '',
      domicilio: clienteObj.direccion || clienteObj.domicilio || '',
      telefono: clienteObj.telefono || '',
      subtotal: Math.round(subtotalDesc * 100) / 100,
      iva: Math.round(iva * 100) / 100,
      total: Math.round(totalFinal * 100) / 100,
      costo_envio: Math.round(costoEnvio * 100) / 100,
      forma_pago: formaPago,
      metodo_pago: metodoPago,
      comentarios: comentarioFinal,
      usuario: user || '',
      pdf: pdfBase64,
      items: items.map(i => ({
        sku: i.sku,
        nombre_producto: i.nombre,
        cantidad: i.cantidad,
        precio_unitario: Math.round(i.precio * (1 - disc) * 100) / 100,
        total_linea: Math.round(i.cantidad * i.precio * (1 - disc) * 100) / 100,
      })),
    };

    const r = await window.api.guardarCotizacion(payload);
    setSubmitting(false);
    if (r.ok) {
      toast.success('Cotización guardada', `${nuevoCodigo} · ${selectedCliente}`);
      window.fireConfetti();
      if (pdfBase64) {
        const a = document.createElement('a');
        a.href = `data:application/pdf;base64,${pdfBase64}`;
        a.download = `Cotizacion_${nuevoCodigo}_${selectedCliente}.pdf`;
        a.click();
      }
      setCots(await window.api.cotizaciones());
      resetForm();
      fetch(N8N_COTI_HOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => {});
    } else {
      toast.error('Error al guardar', 'Verifica conexión con el servidor');
    }
  };

  const guardarFirma = async (firma_base64) => {
    if (!firmaModal) return;
    setSavingFirma(true);
    const payload = {
      codigo_cotizacion: firmaModal.codigo,
      firma_base64,
      usuario: user || '',
      fecha_firma: new Date().toISOString(),
    };
    const r = await window.api.firmarCotizacion(payload);
    setSavingFirma(false);
    if (r.ok) {
      toast.success('Firma guardada', firmaModal.codigo);
      window.fireConfetti();
      fetch(N8N_FIRMA_HOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => {});
      setCots(prev => prev.map(c => c.codigo_cotizacion === firmaModal.codigo ? { ...c, firma_envio: firma_base64 } : c));
      setFirmaModal(null);
    } else {
      toast.error('Error al guardar firma', 'Verifica conexión con el servidor');
    }
  };

  rp_uE(() => {
    if (!complementoModal) { setComplementos([]); setNuevoComplemento(''); setNuevoPago(''); return; }
    setLoadingComplementos(true);
    (async () => {
      const data = await window.api.complementosPago(complementoModal.codigo_cotizacion);
      setComplementos(data);
      setLoadingComplementos(false);
    })();
  }, [complementoModal]);

  // El pago capturado no puede exceder el saldo: total menos lo ya registrado.
  const totalComplemento = Number(complementoModal?.total) || 0;
  const pagadoComplemento = rp_uM(
    () => complementos.reduce((s, c) => s + (Number(c.pago) || 0), 0),
    [complementos]
  );
  const saldoComplemento = totalComplemento - pagadoComplemento;
  const pagoNum = Math.round((Number(nuevoPago) || 0) * 100) / 100;
  const pagoExcedeTotal = pagoNum > saldoComplemento;

  const guardarComplemento = async () => {
    if (!complementoModal || !nuevoComplemento || !nuevoPago) return;
    if (pagoNum <= 0) {
      toast.error('Pago inválido', 'Ingresa un monto mayor a cero');
      return;
    }
    if (pagoExcedeTotal) {
      toast.error('Pago inválido', `El pago no puede superar el saldo de ${window.fmt.mxn(saldoComplemento)}`);
      return;
    }
    setSavingComplemento(true);
    const payload = {
      codigo_cotizacion: complementoModal.codigo_cotizacion,
      complemento: nuevoComplemento,
      pago: pagoNum,
      usuario: user || '',
    };
    const r = await window.api.registrarComplementoPago(payload);
    setSavingComplemento(false);
    if (r.ok) {
      toast.success('Complemento agregado', complementoModal.codigo_cotizacion);
      window.fireConfetti();
      setNuevoComplemento('');
      setNuevoPago('');
      const data = await window.api.complementosPago(complementoModal.codigo_cotizacion);
      setComplementos(data);
    } else {
      toast.error('Error', 'No se pudo guardar el complemento de pago');
    }
  };

  const guardarRelaciones = async () => {
    const records = Object.entries(editRelaciones)
      .filter(([, v]) => v.relacion_factura || v.forma_pago || v.fecha_pago)
      .map(([codigo, v]) => {
        // El id numérico y el nombre del cliente no viven en editRelaciones: se buscan en la cotización.
        const cot = cots.find(c => c.codigo_cotizacion === codigo);
        return {
          id: cot?.id ?? null,
          nombre: cot?.empresa || null,
          codigo_cotizacion: codigo,
          relacion_factura: v.relacion_factura || null,
          forma_pago: v.forma_pago || null,
          // Alias temporal: el endpoint viejo aún espera metodo_pago para esta columna.
          metodo_pago: v.forma_pago || null,
          fecha_pago: v.fecha_pago || null,
        };
      });
    if (records.length === 0) { toast.warn('Sin cambios', 'Ingresa al menos una relación'); return; }
    setSavingRelacion(true);
    const r = await window.api.relacionFactura(records);
    setSavingRelacion(false);
    if (r.ok) {
      toast.success('Relaciones guardadas', `${records.length} cotización(es) actualizadas`);
      window.fireConfetti();
      fetch(N8N_COTI_HOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(records) }).catch(() => {});
      setCots(await window.api.cotizaciones());
    } else {
      toast.error('Error', 'No se pudo guardar las relaciones');
    }
  };

  const verCotizacion = async (codigo) => {
    setVerLoading(codigo);
    try {
      const pdf = await window.api.cotizacionBase64(codigo);
      if (pdf) {
        const byteChars = atob(pdf);
        const byteArr = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
        const blob = new Blob([byteArr], { type: 'application/pdf' });
        window.open(URL.createObjectURL(blob), '_blank');
      } else {
        toast.warn('Sin PDF', 'Esta cotización no tiene PDF adjunto');
      }
    } catch(_) {
      toast.error('Error', 'No se pudo abrir el PDF');
    } finally {
      setVerLoading(null);
    }
  };

  const filtered = cots.filter(c => {
    if (estado === 'abiertas' && c.vendido) return false;
    if (estado === 'vendidas' && !c.vendido) return false;
    if (q && !`${c.codigo_cotizacion} ${c.empresa}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const abiertas = cots.filter(c => !c.vendido).length;
  const totalAbiertas = cots.filter(c => !c.vendido).reduce((s, c) => s + (parseFloat(c.subtotal) || 0), 0);

  return (
    <div className="page">
      {ConfirmModal}
      <div className="section-header">
        <div>
          <h2 className="section-title">Cotizaciones</h2>
          <p className="section-subtitle">Genera y da seguimiento a cotizaciones de clientes.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`btn btn-sm ${showConsultor ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setShowConsultor(v => !v)}>
            <Icon name="doc" size={13}/> {showConsultor ? 'Cerrar consultor' : 'Relacionar facturas'}
          </button>
          <button className={`btn btn-sm ${showForm ? 'btn-secondary' : 'btn-primary'}`} onClick={() => setShowForm(v => !v)}>
            <Icon name="plus" size={13}/> {showForm ? 'Cerrar' : 'Nueva cotización'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <div>
              <h3 className="card-title">Generador de cotizaciones</h3>
              <p className="card-subtitle mono" style={{ fontSize: 11 }}>{nuevoCodigo || '...'}</p>
            </div>
          </div>
          <div className="card-body" style={{ display: 'grid', gap: 20 }}>

            {/* 1. Cliente */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-2)', marginBottom: 10 }}>1. Datos del cliente</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label className="field-label">Cliente / Empresa</label>
                  <select className="select" value={selectedCliente} onChange={e => setSelectedCliente(e.target.value)}>
                    <option value="">Selecciona cliente...</option>
                    {clientes.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                  </select>
                </div>
                {selectedCliente && (() => {
                  const c = clientes.find(x => x.nombre === selectedCliente);
                  return c ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div className="field"><label className="field-label">Email</label><input className="input" value={c.email || ''} disabled/></div>
                      <div className="field"><label className="field-label">Teléfono</label><input className="input" value={c.telefono || ''} disabled/></div>
                    </div>
                  ) : null;
                })()}
              </div>
            </div>

            {/* 2. Productos */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-2)', marginBottom: 10 }}>2. Productos y precios</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="field">
                    <label className="field-label">Producto</label>
                    <select className="select" value={selectedSku} onChange={e => setSelectedSku(e.target.value)}>
                      {productos.map(p => <option key={p.sku} value={p.sku}>{p.sku} — {p.nombre} · Stock: {window.fmt.int(p.stock_bodega)}</option>)}
                    </select>
                    {prodObj && (() => {
                      // Indicador informativo de stock actual (no bloquea la cotización)
                      const stock = Number(prodObj.stock_bodega) || 0;
                      const minimo = Number(prodObj.stock_minimo) || 0;
                      const tone = stock <= 0 ? 'danger' : stock < minimo ? 'warn' : 'success';
                      return (
                        <div style={{ marginTop: 6 }}>
                          <span className={`badge badge-${tone}`}>
                            <span className="badge-dot"/>Stock bodega: {window.fmt.int(stock)} {prodObj.medida || 'uds.'}
                          </span>
                          {stock > 0 && stock < minimo && (
                            <span style={{ fontSize: 11, color: 'var(--fg-2)', marginLeft: 8 }}>debajo del mínimo ({window.fmt.int(minimo)})</span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  <div>
                    <label className="field-label">Lista de precios</label>
                    <div className="tabs" style={{ marginTop: 4 }}>
                      {[['precio','Precio A'],['precio_2','Precio B'],['precio_3','Precio C']].map(([k,v]) => (
                        <button key={k} className={`tab ${listaPrecio === k ? 'active' : ''}`} onClick={() => setListaPrecio(k)}>{v}</button>
                      ))}
                    </div>
                    {(() => {
                      const c = Number(cantidad) || 0;
                      const tier = c <= 3 ? 0 : c <= 7 ? 1 : 2;
                      const tiers = [
                        { label: '1-3', key: 'PRECIO A' },
                        { label: '4-7', key: 'PRECIO B' },
                        { label: '8+',  key: 'PRECIO C' },
                      ];
                      return (
                        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                          {tiers.map((t, i) => (
                            <span key={i} style={{
                              fontSize: 11, padding: '2px 7px', borderRadius: 4,
                              background: i === tier ? 'var(--primary)' : 'var(--bg-2)',
                              color: i === tier ? '#fff' : 'var(--text-muted)',
                              fontWeight: i === tier ? 700 : 400,
                              border: i === tier ? '1.5px solid var(--primary)' : '1.5px solid transparent',
                            }}>
                              {i === tier ? '→ ' : ''}{t.label} MASTER: {t.key}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="field">
                      <label className="field-label">Cantidad</label>
                      <input className="input" type="number" min="1" value={cantidad} onChange={e => setCantidad(e.target.value === '' ? '' : Math.max(1, Number(e.target.value) || 1))} onBlur={() => setCantidad(v => (v === '' || Number(v) < 1) ? 1 : Number(v))}/>
                    </div>
                    <div className="field">
                      <label className="field-label">Precio unitario</label>
                      <input className="input mono" type="number" step="0.01" value={precioManual} onChange={e => setPrecioManual(Number(e.target.value) || 0)}/>
                    </div>
                  </div>
                  <button className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={agregarItem}>
                    <Icon name="plus" size={13}/> Agregar producto
                  </button>
                </div>

                <div>
                  {items.length === 0 ? (
                    <div className="empty" style={{ padding: 24 }}>
                      <div className="empty-icon"><Icon name="doc"/></div>
                      <div>Sin productos agregados</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {items.map((i, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 10px', background: 'var(--bg-2)', borderRadius: 'var(--r-md)', border: '1px solid var(--line)' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>{i.sku}</div>
                            <div style={{ fontSize: 12, fontWeight: 500 }} className="truncate">{i.nombre}</div>
                            <div className="mono" style={{ fontSize: 11 }}>{i.cantidad} × {window.fmt.mxn(i.precio)}</div>
                          </div>
                          <div className="mono" style={{ fontWeight: 600, fontSize: 13 }}>{window.fmt.mxn(i.total)}</div>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => removerItem(idx)}><Icon name="x" size={12}/></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Descuento + Totales */}
            {items.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, alignItems: 'start' }}>
                <div className="field">
                  <label className="field-label">Descuento (%)</label>
                  <input className="input mono" type="number" min="0" max="100" value={descuento} onChange={e => setDescuento(Number(e.target.value) || 0)}/>
                </div>
                <div style={{ padding: 12, background: 'var(--bg-2)', borderRadius: 'var(--r-md)', border: '1px solid var(--line)', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--fg-2)' }}>Subtotal</span>
                    <span className="mono">{window.fmt.mxn(subtotalOriginal)}</span>
                  </div>
                  {descuento > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger)' }}>
                      <span>Descuento ({descuento}%)</span>
                      <span className="mono">-{window.fmt.mxn(descuentoMonto)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: 'var(--fg-2)', userSelect: 'none' }}>
                      <input type="checkbox" checked={incluirEnvio} onChange={e => setIncluirEnvio(e.target.checked)}/>
                      Envío{envioBase === 0 ? ' (gratis)' : ''}
                    </label>
                    <span className="mono">{window.fmt.mxn(costoEnvio)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--fg-2)' }}>IVA (16%)</span>
                    <span className="mono">{window.fmt.mxn(iva)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15, borderTop: '1px solid var(--line)', paddingTop: 6 }}>
                    <span>Total</span>
                    <span className="mono">{window.fmt.mxn(totalFinal)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 3. Condiciones */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-2)', marginBottom: 10 }}>3. Condiciones finales</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label className="field-label">Forma de pago</label>
                  <select className="select" value={formaPago} disabled={metodoPagoEsPPD} onChange={e => setFormaPago(e.target.value)}>
                    {COT_FORMAS_PAGO.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">Método de pago</label>
                  <select className="select" value={metodoPago} onChange={e => setMetodoPago(e.target.value)}>
                    {METODO_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">Comentarios / Envío</label>
                  <select className="select" value={comentario} onChange={e => setComentario(e.target.value)}>
                    {COT_COMENTARIOS.map(c => <option key={c} value={c}>{c.length > 55 ? c.slice(0, 55) + '…' : c}</option>)}
                  </select>
                </div>
              </div>
              {comentario === 'OTROS...' && (
                <div className="field" style={{ marginTop: 10 }}>
                  <label className="field-label">Comentario personalizado</label>
                  <textarea className="input" rows={2} value={comentarioCustom} onChange={e => setComentarioCustom(e.target.value)} style={{ height: 'auto', resize: 'vertical' }}/>
                </div>
              )}
            </div>
          </div>

          <div className="card-footer">
            <button className="btn btn-secondary btn-sm" onClick={resetForm}>Cancelar</button>
            <button className="btn btn-primary btn-sm" disabled={!selectedCliente || items.length === 0 || submitting} onClick={() => askConfirm(`¿Guardar cotización ${nuevoCodigo} para ${selectedCliente} por ${window.fmt.mxn(totalFinal)}?`, guardar)}>
              {submitting
                ? <><span className="spinner"/> Guardando...</>
                : <><Icon name="check" size={13}/> Guardar cotización{nuevoCodigo ? ` · ${nuevoCodigo}` : ''}</>}
            </button>
          </div>
        </div>
      )}

      {showConsultor && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <div>
              <h3 className="card-title">Relación de facturas</h3>
              <p className="card-subtitle">Vincula factura, método y fecha de pago a cotizaciones</p>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr>
                <th>Código</th><th>Cliente</th><th className="td-right">Total</th>
                <th>N° Factura</th><th>Forma de pago</th><th>Fecha de pago</th><th>Firma</th><th>Complementos</th><th></th>
              </tr></thead>
              <tbody>
                {cots.map(c => {
                  const ed = editRelaciones[c.codigo_cotizacion] || {};
                  const setEd = (k, v) => setEditRelaciones(prev => ({
                    ...prev,
                    [c.codigo_cotizacion]: { ...(prev[c.codigo_cotizacion] || {}), [k]: v },
                  }));
                  return (
                    <tr key={c.codigo_cotizacion}>
                      <td className="mono" style={{ fontSize: 12, fontWeight: 500 }}>{c.codigo_cotizacion}</td>
                      <td style={{ fontSize: 12 }}>{c.empresa}</td>
                      <td className="td-right mono" style={{ fontSize: 12 }}>{window.fmt.mxn(c.total)}</td>
                      <td style={{ minWidth: 130 }}>
                        <input className="input" style={{ fontSize: 12, padding: '4px 8px' }}
                          value={ed.relacion_factura || ''}
                          onChange={e => setEd('relacion_factura', e.target.value)}
                          placeholder="N° factura"/>
                      </td>
                      <td style={{ minWidth: 150 }}>
                        <select className="select" style={{ fontSize: 12, padding: '4px 8px' }}
                          value={ed.forma_pago || ''}
                          onChange={e => setEd('forma_pago', e.target.value)}>
                          <option value="">—</option>
                          {/* Valor fuera del catálogo (clave vieja o texto libre): se muestra tal cual en vez de quedar vacío. */}
                          {ed.forma_pago && !COT_FORMAS_PAGO.includes(ed.forma_pago) && (
                            <option value={ed.forma_pago}>{ed.forma_pago}</option>
                          )}
                          {COT_FORMAS_PAGO.map(f => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ minWidth: 140 }}>
                        <input className="input" type="date" style={{ fontSize: 12, padding: '4px 8px' }}
                          value={ed.fecha_pago || ''}
                          onChange={e => setEd('fecha_pago', e.target.value)}/>
                      </td>
                      <td style={{ minWidth: 130 }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}
                            onClick={() => setFirmaModal({ codigo: c.codigo_cotizacion })}>
                            <Icon name="edit" size={12}/> Firmar
                          </button>
                          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}
                            disabled={!c.firma_envio}
                            onClick={() => setVerFirmaModal({ codigo: c.codigo_cotizacion, firma_b64: c.firma_envio })}>
                            <Icon name="eye" size={12}/> Ver
                          </button>
                        </div>
                      </td>
                      <td>
                        <button className="btn btn-ghost btn-icon btn-sm" title="Complemento de pago"
                          onClick={() => setComplementoModal({ codigo_cotizacion: c.codigo_cotizacion, total: c.total })}>
                          <Icon name="plus" size={13}/>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="card-footer">
            <button className="btn btn-primary btn-sm" disabled={savingRelacion} onClick={() => askConfirm('¿Guardar las relaciones de facturas seleccionadas?', guardarRelaciones)}>
              {savingRelacion ? <><span className="spinner"/> Guardando...</> : <><Icon name="check" size={13}/> Guardar relaciones</>}
            </button>
          </div>
        </div>
      )}

      {firmaModal && (
        <div className="modal-backdrop" onClick={() => setFirmaModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="card-header" style={{ padding: '16px 20px 12px' }}>
              <div>
                <h3 className="card-title">Captura de firma digital</h3>
                <p className="card-subtitle mono" style={{ fontSize: 11 }}>{firmaModal.codigo}</p>
              </div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setFirmaModal(null)}><Icon name="x" size={14}/></button>
            </div>
            <div style={{ padding: '0 20px 20px' }}>
              <p style={{ fontSize: 12, color: 'var(--fg-2)', marginBottom: 10 }}>Dibuja la firma con el ratón o trackpad:</p>
              <CotFirmaCanvas
                onSave={guardarFirma}
                onCancel={() => setFirmaModal(null)}
                saving={savingFirma}
              />
            </div>
          </div>
        </div>
      )}

      {verFirmaModal && (
        <div className="modal-backdrop" onClick={() => setVerFirmaModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="card-header" style={{ padding: '16px 20px 12px' }}>
              <div>
                <h3 className="card-title">Firma digital</h3>
                <p className="card-subtitle mono" style={{ fontSize: 11 }}>{verFirmaModal.codigo}</p>
              </div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setVerFirmaModal(null)}><Icon name="x" size={14}/></button>
            </div>
            <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {verFirmaModal.firma_b64 ? (
                <>
                  <img
                    src={`data:image/png;base64,${verFirmaModal.firma_b64}`}
                    alt={`Firma ${verFirmaModal.codigo}`}
                    style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', background: '#fff' }}
                  />
                  <a
                    href={`data:image/png;base64,${verFirmaModal.firma_b64}`}
                    download={`firma_${verFirmaModal.codigo}.png`}
                    className="btn btn-ghost btn-sm"
                    style={{ alignSelf: 'flex-end' }}
                  >
                    <Icon name="doc" size={13}/> Descargar PNG
                  </a>
                </>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--fg-2)' }}>Esta cotización aún no tiene firma registrada.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {complementoModal && (
        <div className="modal-backdrop" onClick={() => setComplementoModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="card-header" style={{ padding: '16px 20px 12px' }}>
              <div>
                <h3 className="card-title">Complemento de pago</h3>
                <p className="card-subtitle mono" style={{ fontSize: 11 }}>
                  {complementoModal.codigo_cotizacion} · Total {window.fmt.mxn(totalComplemento)} · Pagado {window.fmt.mxn(pagadoComplemento)} · Saldo {window.fmt.mxn(saldoComplemento)}
                </p>
              </div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setComplementoModal(null)}><Icon name="x" size={14}/></button>
            </div>
            <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--fg-2)', marginBottom: 8 }}>Complementos registrados</div>
                {loadingComplementos ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--fg-2)' }}><span className="spinner"/> Cargando...</div>
                ) : complementos.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--fg-2)' }}>Sin complementos registrados.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {complementos.map((c, idx) => (
                      <div key={c.id || idx} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 10px', background: 'var(--bg-2)', borderRadius: 'var(--r-md)', border: '1px solid var(--line)', fontSize: 12 }}>
                        <span className="mono">{c.complemento ?? JSON.stringify(c)}</span>
                        <span style={{ display: 'flex', gap: 8 }}>
                          {c.pago != null && <span className="mono" style={{ fontWeight: 600 }}>{window.fmt.mxn(c.pago)}</span>}
                          {c.fecha && <span style={{ color: 'var(--fg-2)' }}>{window.fmt.date(c.fecha)}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10 }}>
                <div className="field">
                  <label className="field-label">Nuevo complemento</label>
                  <input className="input" value={nuevoComplemento} onChange={e => setNuevoComplemento(e.target.value)} placeholder="Ingresa el complemento de pago"/>
                </div>
                <div className="field">
                  <label className="field-label">Pago</label>
                  <input className="input mono" type="number" min="0" step="0.01" max={saldoComplemento}
                    value={nuevoPago}
                    onChange={e => setNuevoPago(e.target.value)}
                    placeholder="0.00"/>
                </div>
              </div>
              {pagoExcedeTotal && (
                <div style={{ fontSize: 12, color: 'var(--danger)' }}>
                  El pago no puede superar el saldo pendiente ({window.fmt.mxn(saldoComplemento)}) — total {window.fmt.mxn(totalComplemento)} menos {window.fmt.mxn(pagadoComplemento)} ya registrados.
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setComplementoModal(null)}>Cerrar</button>
                <button className="btn btn-primary btn-sm" disabled={!nuevoComplemento || !nuevoPago || pagoExcedeTotal || savingComplemento} onClick={guardarComplemento}>
                  {savingComplemento ? <><span className="spinner"/> Guardando...</> : <><Icon name="check" size={13}/> Agregar</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="dash-kpis">
        <window.MiniStat label="Total cotizaciones" value={cots.length} icon="doc"/>
        <window.MiniStat label="Abiertas" value={abiertas} icon="clock" tone="warn"/>
        <window.MiniStat label="Vendidas" value={cots.filter(c => c.vendido).length} icon="check" tone="success"/>
        <window.MiniStat label="Valor en pipeline" value={window.fmt.mxn(totalAbiertas)} icon="cash"/>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <div style={{ display: 'flex', gap: 8, flex: 1 }}>
            <div className="input-group" style={{ maxWidth: 320, flex: 1 }}>
              <span className="input-group-icon"><Icon name="search" size={14}/></span>
              <input className="input" placeholder="Buscar cotización o cliente..." value={q} onChange={e => setQ(e.target.value)}/>
            </div>
            <div className="tabs">
              <button className={`tab ${estado === 'todos' ? 'active' : ''}`} onClick={() => setEstado('todos')}>Todas</button>
              <button className={`tab ${estado === 'abiertas' ? 'active' : ''}`} onClick={() => setEstado('abiertas')}>Abiertas</button>
              <button className={`tab ${estado === 'vendidas' ? 'active' : ''}`} onClick={() => setEstado('vendidas')}>Vendidas</button>
            </div>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Código</th><th>Cliente</th><th>Fecha</th><th className="td-right">Items</th><th className="td-right">Subtotal</th><th className="td-right">Total</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.codigo_cotizacion}>
                  <td className="mono" style={{ fontSize: 12, fontWeight: 500 }}>{c.codigo_cotizacion}</td>
                  <td>{c.empresa}</td>
                  <td className="td-muted">{window.fmt.date(c.fecha)}</td>
                  <td className="td-right mono">{(c.items || []).map((item, index) => (
                    <li key={index}>
                        {item.nombre_producto}
                    </li>
                ))}</td>
                  <td className="td-right mono">{window.fmt.mxn(c.subtotal)}</td>
                  <td className="td-right mono" style={{ fontWeight: 500 }}>{window.fmt.mxn(c.total)}</td>
                  <td>
                    <span className={`badge badge-${c.vendido ? 'success' : c.estado === 'Seguimiento' ? 'warn' : 'info'}`}>
                      <span className="badge-dot"/>{c.estado}
                    </span>
                  </td>
                  <td className="td-right">
                    <button className="btn btn-ghost btn-sm" disabled={verLoading === c.codigo_cotizacion} onClick={() => verCotizacion(c.codigo_cotizacion)}>
                      {verLoading === c.codigo_cotizacion ? <span className="spinner"/> : <>Ver <Icon name="chevRight" size={12}/></>}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

window.PageCotizaciones = PageCotizaciones;
