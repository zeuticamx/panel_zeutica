// ===== Zeutica — Envío Skydropx por cotización =====
// Modal que cuelga de cada renglón de Cotizaciones. Encadena los cuatro servicios
// del backend (skydropx_service.py): cotizar, leer tarifas, generar guía y rastrear.
//
// Por qué pide CP y medidas a mano: /consulta/cotizacion no devuelve domicilio ni
// código postal del cliente (solo empresa, totales e items), y el peso/volumen del
// pedido no vive en ninguna tabla. En vez de tocar ese endpoint en producción, el
// dato se captura aquí y se recuerda por cotización en localStorage.

const { useState: sk_uS, useEffect: sk_uE, useMemo: sk_uM, useRef: sk_uR } = React;

// Origen fijo: la bodega. Es el mismo domicilio que ya sale impreso en el PDF de
// la cotización (ver EMPRESA_DOMICILIO en api_zeutica1/pdf_cotizacion.py).
//
// `reference` es obligatorio para Skydropx al generar la guía (confirmado en
// sandbox: sin él, 422 "reference: no puede estar en blanco" en address_from Y
// address_to). Antes esta llave no existía aquí, así que nunca se mandaba.
const SKY_ORIGEN_DEFAULT = {
  country_code: 'MX',
  postal_code: '45145',
  area_level1: 'Jalisco',
  area_level2: 'Zapopan',
  area_level3: 'Belenes Norte',
  street1: 'Blvd. De los Charros 1629',
  name: 'Zeutica',
  company: 'Zeutica',
  phone: '3312995688',
  email: 'ventas1@zeutica.com',
  reference: 'Bodega Zeutica, portón gris',
};

// Medidas típicas de la operación. Evitan capturar 4 números en el caso común.
// Los botones salen del catálogo de cajas del backend (GET /skydropx/cajas,
// sembrado con estas mismas 4); esta lista solo se usa si no se pudo leer.
const SKY_PRESETS = [
  { id: 'sobre',   label: 'Sobre',        length: 30, width: 25, height: 2,  weight: 0.5 },
  { id: 'chica',   label: 'Caja chica',   length: 25, width: 20, height: 15, weight: 2 },
  { id: 'mediana', label: 'Caja mediana', length: 40, width: 30, height: 25, weight: 5 },
  { id: 'grande',  label: 'Caja grande',  length: 60, width: 40, height: 40, weight: 12 },
];

// package_type es un código del catálogo de embalaje de Skydropx que el
// sandbox exige al generar la guía ("package_type es requerido en todos los
// paquetes"). "4G" es el valor más citado para caja de cartón en integraciones
// de Skydropx, pero no está confirmado contra esta cuenta — si el sandbox lo
// rechaza, el mensaje de error normalmente lista los códigos válidos; ajusta
// el campo "Tipo de paquete" con ese valor.
// declared_value = monto asegurado por bulto (MXN); el usuario lo puede cambiar.
const SKY_PAQUETE_DEFAULT = {
  length: 25, width: 20, height: 15, weight: 2, package_type: '4G', consignment_note: 'Mercancía general',
  declared_value: window.skydropxLogica.VALOR_DECLARADO_DEFAULT,
};

// Código SAT por defecto para carta porte. Skydropx espera un string con el código.
// El formulario muestra "53103200 - Ropa Desechable" (label amigable) pero el
// payload viaja solo con el código como string: "53103200" (sin descripción).
const CONSIGNMENT_CODE_DEFAULT = '53103200';

// ---------- Memoria local por cotización ----------
// El backend quedó como passthrough (no guarda envíos en MySQL), así que el número
// de guía solo sobrevive aquí. Es por navegador: si se genera la guía en otra
// máquina, este panel no la verá. Ver nota en la conversación de implementación.
const skyClave = (codigo) => `zeutica.skydropx.${codigo}`;

function skyLeerEnvio(codigo) {
  try { return JSON.parse(localStorage.getItem(skyClave(codigo))) || null; } catch (_) { return null; }
}

function skyGuardarEnvio(codigo, datos) {
  try { localStorage.setItem(skyClave(codigo), JSON.stringify(datos)); } catch (_) {}
}

// Datos del cliente ya registrado (tabla `clientes`, cruzada por nombre desde
// cotizaciones.jsx) para no pedirle al usuario CP/teléfono/domicilio que ya
// existen. `direccion` es un solo campo de texto libre en esa tabla (no viene
// separado en calle/colonia/municipio/estado), así que solo se usa para
// precargar `street1`; el resto de las llaves de destino se dejan para que el
// usuario las llene o las traiga de un envío anterior (localStorage).
function skyDefaultsDeCliente(cliente) {
  if (!cliente) return {};
  return {
    postal_code: cliente.cp != null ? String(cliente.cp) : '',
    phone: cliente.telefono != null ? String(cliente.telefono) : '',
    email: cliente.email || '',
    street1: cliente.direccion || '',
  };
}

// Combina un objeto guardado en localStorage con los defaults actuales: un
// valor guardado se respeta si no está vacío; si falta la llave (objeto viejo,
// de antes de que existiera ese campo) o quedó en blanco, se usa el default.
//
// Necesario porque `guardado?.origen || SKY_ORIGEN_DEFAULT` tomaba el objeto
// completo del caché si existía, ignorando cualquier campo que se agregara a
// los defaults después de que el usuario ya hubiera cotizado esa cotización
// una vez — exactamente lo que pasó con reference/package_type/consignment_note:
// quedaron sin valor porque el caché era de antes de que existieran.
function skyConDefaults(base, guardadoParcial) {
  const out = { ...base };
  Object.entries(guardadoParcial || {}).forEach(([k, v]) => {
    if (v !== '' && v !== null && v !== undefined) out[k] = v;
  });
  return out;
}

// ---------- Normalizadores ----------
// Skydropx devuelve a veces plano y a veces estilo JSON:API (todo bajo `attributes`),
// y el nombre del carrier cambia de llave según el endpoint. Se lee defensivamente
// para que un cambio de forma no deje la tabla en blanco.
function skyCampo(obj, ...claves) {
  if (!obj) return null;
  const attrs = obj.attributes || {};
  for (const k of claves) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
    if (attrs[k] !== undefined && attrs[k] !== null && attrs[k] !== '') return attrs[k];
  }
  return null;
}

function skyNormalizaTarifa(t) {
  return {
    id: skyCampo(t, 'rate_id', 'id'),
    carrier: String(skyCampo(t, 'provider', 'carrier', 'carrier_name', 'provider_name') || 'Carrier'),
    servicio: String(skyCampo(t, 'service_level_name', 'service_level', 'provider_service_name', 'service') || ''),
    dias: skyCampo(t, 'days', 'estimated_delivery_days', 'delivery_estimate'),
    total: Number(skyCampo(t, 'total_pricing', 'total', 'amount', 'price') || 0),
    moneda: String(skyCampo(t, 'currency', 'currency_code') || 'MXN'),
    // Solo informativo para envíos multipaquete: si el carrier soporta
    // multipaquete nativo, Skydropx agrupa los bultos en una sola guía
    // ("multipackage"); si no, genera una guía independiente por bulto
    // ("multishipment"). No confirmado contra esta cuenta qué carriers
    // devuelven cada valor.
    tipoCreacion: skyCampo(t, 'shipment_creation_type') || null,
  };
}

function skyNormalizaGuia(envio) {
  const raiz = envio?.data || envio?.shipment || envio || {};
  const incluido = Array.isArray(envio?.included) ? envio.included : [];
  const deIncluido = (clave) => {
    for (const item of incluido) {
      const v = skyCampo(item, clave);
      if (v) return v;
    }
    return null;
  };
  return {
    tracking: skyCampo(raiz, 'tracking_number') || deIncluido('tracking_number') || '',
    carrier: String(skyCampo(raiz, 'provider', 'carrier', 'carrier_name') || deIncluido('provider') || ''),
    etiqueta: skyCampo(raiz, 'label_url', 'label', 'pdf_url') || deIncluido('label_url') || '',
    // PDF de remisión / packing slip, para la documentación que acompaña al envío.
    ordenDetalle: skyCampo(raiz, 'order_detail_url', 'order_detail') || deIncluido('order_detail_url') || '',
    id: skyCampo(raiz, 'id') || '',
  };
}

function skyNormalizaEventos(rastreo) {
  const raiz = rastreo?.data || rastreo || {};
  const lista = skyCampo(raiz, 'tracking_events', 'events', 'history', 'tracking_history');
  if (!Array.isArray(lista)) return [];
  return lista.map((e) => ({
    texto: String(skyCampo(e, 'description', 'status_details', 'message', 'status') || 'Actualización'),
    fecha: skyCampo(e, 'occurred_at', 'date', 'timestamp', 'created_at'),
    lugar: skyCampo(e, 'location', 'city'),
  }));
}

// Selector de la libreta de direcciones de Skydropx. Elegir una llena el
// formulario (origen o destino); los campos siguen siendo editables después.
function SkyDireccionGuardada({ id, direcciones, tipo, disabled, onElegir }) {
  const [sel, setSel] = sk_uS('');
  // Primero las del tipo de esta sección (origen = from, destino = to); las
  // otras quedan abajo por si una dirección se usa en los dos sentidos.
  const propias = direcciones.filter(d => d.tipo === tipo);
  const otras = direcciones.filter(d => d.tipo !== tipo);
  const opcion = (d) => (
    <option key={d.id} value={d.id}>
      {d.alias}{d.default ? ' (predeterminada)' : ''} · CP {d.direccion.postal_code}{d.direccion.area_level2 ? ` · ${d.direccion.area_level2}` : ''}
    </option>
  );
  return (
    <div className="field" style={{ marginBottom: 10 }}>
      <label className="field-label" htmlFor={id}>Dirección guardada en Skydropx</label>
      <select
        id={id}
        className="input"
        style={{ fontSize: 12 }}
        value={sel}
        disabled={disabled}
        onChange={e => {
          setSel(e.target.value);
          const d = direcciones.find(x => x.id === e.target.value);
          if (d) onElegir(d);
        }}
      >
        <option value="">Elegir de la libreta…</option>
        {propias.map(opcion)}
        {otras.length > 0 && (
          <optgroup label={tipo === 'from' ? 'Guardadas como destino' : 'Guardadas como origen'}>
            {otras.map(opcion)}
          </optgroup>
        )}
      </select>
    </div>
  );
}

// "Guardar esta dirección en mi libreta": da de alta lo que está capturado en
// el formulario como plantilla de la cuenta de Skydropx.
function SkyGuardarDireccion({ tipo, direccion, user, disabled, onGuardada }) {
  const toast = window.useToast();
  const [abierto, setAbierto] = sk_uS(false);
  const [alias, setAlias] = sk_uS('');
  const [guardando, setGuardando] = sk_uS(false);
  const faltan = window.skydropxLogica.faltantesParaGuardarDireccion(direccion);
  const idAlias = `sky-alias-${tipo}`;

  if (!abierto) {
    return (
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        style={{ marginTop: 8 }}
        disabled={disabled}
        onClick={() => { setAlias(direccion.company || direccion.name || ''); setAbierto(true); }}
      >
        <Icon name="plus" size={12} /> Guardar esta dirección en mi libreta
      </button>
    );
  }

  const guardar = async () => {
    setGuardando(true);
    const payload = window.skydropxLogica.armarPlantillaDireccion({ alias, tipo, direccion, usuario: user });
    const r = await window.api.skydropxGuardarDireccion(payload, user);
    setGuardando(false);
    if (!r.ok) {
      toast.error('No se pudo guardar la dirección', r.error);
      return;
    }
    toast.success('Dirección guardada', `"${r.data.direccion.alias}" ya aparece en tu libreta de Skydropx`);
    setAbierto(false);
    onGuardada?.(r.data.direccion);
  };

  return (
    <div className="sky-libreta-form">
      <div className="field" style={{ flex: 1, minWidth: 180 }}>
        <label className="field-label" htmlFor={idAlias}>Alias en la libreta</label>
        <input
          id={idAlias}
          className="input"
          maxLength={60}
          value={alias}
          onChange={e => setAlias(e.target.value)}
          placeholder={tipo === 'from' ? 'Bodega Zapopan' : 'Cliente – sucursal centro'}
          autoFocus
        />
        {faltan.length > 0 && (
          <span className="field-hint" style={{ color: 'var(--danger)' }} role="alert">
            Skydropx pide también: {faltan.join(', ')}.
          </span>
        )}
      </div>
      <div className="sky-guia-acciones">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAbierto(false)} disabled={guardando}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={guardar}
          disabled={guardando || !alias.trim() || faltan.length > 0}
        >
          {guardando ? <><span className="spinner" /> Guardando…</> : 'Guardar'}
        </button>
      </div>
    </div>
  );
}

// Diálogo simple para registrar una medida de caja nueva en el catálogo propio.
// Arranca con las medidas que ya están capturadas en el paquete.
function SkyNuevaCaja({ paquete, user, onGuardada, onCancelar }) {
  const toast = window.useToast();
  const [form, setForm] = sk_uS({
    nombre: '',
    length: paquete.length, width: paquete.width, height: paquete.height, weight: paquete.weight,
    package_type: paquete.package_type || '4G',
  });
  const [guardando, setGuardando] = sk_uS(false);
  const [error, setError] = sk_uS(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const guardar = async () => {
    const { payload, error: invalido } = window.skydropxLogica.armarCaja(form, user);
    if (invalido) { setError(invalido); return; }
    setGuardando(true);
    setError(null);
    const r = await window.api.skydropxGuardarCaja(payload, user);
    setGuardando(false);
    if (!r.ok) { setError(r.error || 'No se pudo guardar la caja'); return; }
    toast.success('Caja guardada', `"${r.data.caja.nombre}" ya aparece en los presets`);
    onGuardada(r.data.caja);
  };

  return (
    <div className="sky-libreta-form" role="group" aria-label="Nueva medida de caja"
      onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onCancelar(); } }}>
      <div className="sky-grid-3" style={{ width: '100%' }}>
        <div className="field">
          <label className="field-label" htmlFor="sky-caja-nombre">Nombre</label>
          <input id="sky-caja-nombre" className="input" maxLength={60} value={form.nombre}
            onChange={e => set('nombre', e.target.value)} placeholder="Caja tapetes" autoFocus />
        </div>
        {[['length', 'Largo (cm)'], ['width', 'Ancho (cm)'], ['height', 'Alto (cm)'], ['weight', 'Peso (kg)']].map(([k, label]) => (
          <div className="field" key={k}>
            <label className="field-label" htmlFor={`sky-caja-${k}`}>{label}</label>
            <input id={`sky-caja-${k}`} className="input mono" type="number" min="0.1"
              step={k === 'weight' ? '0.1' : '1'} value={form[k]} onChange={e => set(k, e.target.value)} />
          </div>
        ))}
      </div>
      {error && <span className="field-hint" style={{ color: 'var(--danger)', width: '100%' }} role="alert">{error}</span>}
      <div className="sky-guia-acciones" style={{ marginLeft: 'auto' }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancelar} disabled={guardando}>Cancelar</button>
        <button type="button" className="btn btn-primary btn-sm" onClick={guardar} disabled={guardando}>
          {guardando ? <><span className="spinner" /> Guardando…</> : 'Guardar caja'}
        </button>
      </div>
    </div>
  );
}

function SkydropxEnvioModal({ cot, user, envio, onClose, onGuiaGenerada }) {
  const toast = window.useToast();
  const [askConfirm, ConfirmModal] = window.useConfirm();
  const codigo = cot.codigo_cotizacion;
  const guardado = sk_uR(skyLeerEnvio(codigo)).current;
  const primerCampo = sk_uR(null);

  const [config, setConfig] = sk_uS(null);
  const [destino, setDestino] = sk_uS(() => skyConDefaults(
    skyConDefaults({
      country_code: 'MX', postal_code: '', area_level1: '', area_level2: '', area_level3: '',
      // Referencia obligatoria para generar la guía; se precarga con la empresa
      // para que nunca llegue en blanco, editable si hay una mejor seña.
      street1: '', name: cot.empresa || '', company: cot.empresa || '', phone: '', email: '', reference: cot.empresa || '',
    }, skyDefaultsDeCliente(cot.cliente)),
    // Lo guardado en un envío anterior de ESTA cotización manda sobre el
    // cliente: si el usuario ya corrigió algo aquí, no se lo pisa el maestro.
    guardado?.destino
  ));
  const [paquete, setPaquete] = sk_uS(() => skyConDefaults({
    ...SKY_PAQUETE_DEFAULT,
    consignment_note: CONSIGNMENT_CODE_DEFAULT,
  }, guardado?.paquete));
  const [origen, setOrigen] = sk_uS(() => skyConDefaults(SKY_ORIGEN_DEFAULT, guardado?.origen));
  const [verOrigen, setVerOrigen] = sk_uS(false);
  // Envío multipaquete: cuántos bultos idénticos lleva este ítem/pedido. Con 1
  // (default) el comportamiento es exactamente el de siempre.
  const [cantidadBultos, setCantidadBultos] = sk_uS(() => (Number(guardado?.cantidadBultos) > 0 ? Number(guardado.cantidadBultos) : 1));
  // Un renglón por guía generada (1 en el caso normal, varias en multipaquete).
  // Se completa al generar la guía o al usar "Actualizar", que ya trae todos
  // los renglones que el backend tiene guardados para esta cotización.
  const [bultos, setBultos] = sk_uS(() => guardado?.bultos || []);

  const [cotizando, setCotizando] = sk_uS(false);
  const [tarifas, setTarifas] = sk_uS([]);
  const [cotizacionId, setCotizacionId] = sk_uS(null);
  const [tarifaSel, setTarifaSel] = sk_uS(null);
  const [cotizado, setCotizado] = sk_uS(false);

  const [generando, setGenerando] = sk_uS(false);
  // La guía persistida en el backend manda sobre lo que quedó en localStorage:
  // el estatus solo existe del lado del servidor, que es quien recibe el webhook.
  const [guia, setGuia] = sk_uS(() => (
    envio
      ? {
          tracking: envio.tracking_number,
          carrier: envio.carrier,
          servicio: envio.servicio,
          etiqueta: envio.etiqueta_url,
          ordenDetalle: envio.orden_detalle_url,
          costo: envio.costo,
          estatus_texto: envio.estatus_texto,
          estatus_tono: envio.estatus_tono,
          estatus_descripcion: envio.estatus_descripcion,
        }
      : (guardado?.guia || null)
  ));

  const [rastreando, setRastreando] = sk_uS(false);
  const [actualizando, setActualizando] = sk_uS(false);
  const [eventos, setEventos] = sk_uS(null);
  // Línea de tiempo que dejó el webhook (histórico propio, no consulta al carrier).
  const [historial, setHistorial] = sk_uS([]);

  const [error, setError] = sk_uS(null);
  const [tocadoCP, setTocadoCP] = sk_uS(false);
  // Saldo de la cuenta: se muestra antes de generar para que el costo de la
  // guía no sea una sorpresa, y se recarga después porque la guía lo descuenta.
  const [saldo, setSaldo] = sk_uS(null);

  // Catálogos de la cuenta de Skydropx para autocompletar. Si fallan, el
  // formulario sigue funcionando a mano como siempre.
  // direcciones en null = todavía no se consulta la libreta.
  const [direcciones, setDirecciones] = sk_uS(null);
  const [embalajes, setEmbalajes] = sk_uS([]);
  // Catálogo propio de medidas de caja (botones de presets).
  const [cajasApi, setCajasApi] = sk_uS([]);
  const [nuevaCaja, setNuevaCaja] = sk_uS(false);

  // Recolecciones ya agendadas, por shipment_id, y el formulario de la que se
  // está agendando (una a la vez): { shipmentId, cargando, horarios, fecha, inicio, fin }.
  const [recolecciones, setRecolecciones] = sk_uS({});
  const [recForm, setRecForm] = sk_uS(null);
  const [agendando, setAgendando] = sk_uS(false);

  const cpValido = /^\d{5}$/.test(String(destino.postal_code || '').trim());
  const paqueteValido = ['length', 'width', 'height', 'weight'].every(k => Number(paquete[k]) > 0);
  const puedeCotizar = cpValido && paqueteValido && !cotizando;
  // Skydropx no exige reference/consignment_note/package_type para cotizar, solo
  // para generar la guía (confirmado en sandbox). Los defaults ya los dejan
  // llenos, así que esto casi siempre pasa; solo bloquea si el usuario los borró.
  const datosGuiaCompletos = !!(destino.reference || '').trim()
    && !!(paquete.package_type || '').trim()
    && !!(paquete.consignment_note || '').trim();
  // Mientras se genera la guía no se puede cerrar: la llamada ya salió y cerrar
  // dejaría al usuario sin el número de rastreo de un envío que ya se contrató.
  const cerrarBloqueado = generando;

  const cargarSaldo = async () => setSaldo(await window.api.skydropxSaldo());

  sk_uE(() => {
    (async () => {
      const cfg = await window.api.skydropxConfiguracion();
      setConfig(cfg);
    })();
    cargarSaldo();
    (async () => {
      const [dirs, embs, recs, cajas] = await Promise.all([
        window.api.skydropxDirecciones(),
        window.api.skydropxEmbalajes(),
        window.api.skydropxRecolecciones(codigo),
        window.api.skydropxCajas(),
      ]);
      setDirecciones(dirs);
      setEmbalajes(embs);
      setCajasApi(cajas);
      setRecolecciones(Object.fromEntries(recs.map(r => [r.shipment_id, r])));
    })();
    // El CP es el único dato que siempre falta: ahí arranca el foco.
    setTimeout(() => primerCampo.current?.focus(), 60);
  }, []);

  // Historial de estatus que dejó el webhook para esta guía.
  const cargarHistorial = async (tracking) => {
    if (!tracking) return;
    const lista = await window.api.skydropxEventosEnvio(tracking);
    if (lista.ok) setHistorial(lista);
  };

  sk_uE(() => { cargarHistorial(guia?.tracking); }, [guia?.tracking]);

  // ESC cierra, como el resto de modales del panel.
  sk_uE(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !cerrarBloqueado) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cerrarBloqueado, onClose]);

  const persistir = (extra = {}) => skyGuardarEnvio(codigo, { destino, paquete, origen, guia, cantidadBultos, bultos, ...extra });

  const setD = (k, v) => setDestino(prev => ({ ...prev, [k]: v }));
  const setP = (k, v) => setPaquete(prev => ({ ...prev, [k]: v }));

  const cajas = sk_uM(() => window.skydropxLogica.cajasParaBotones(cajasApi, SKY_PRESETS), [cajasApi]);
  const presetActivo = window.skydropxLogica.cajaActiva(cajas, paquete);
  // Una dirección recién guardada entra a la libreta sin volver a consultarla.
  const agregarALibreta = (d) => setDirecciones(prev => [d, ...(prev || []).filter(x => x.id !== d.id)]);

  const masBarata = sk_uM(() => {
    if (tarifas.length === 0) return null;
    return tarifas.reduce((min, t) => (t.total > 0 && t.total < min.total ? t : min), tarifas[0]);
  }, [tarifas]);

  const limpiarDireccion = (dir) => {
    const out = {};
    Object.entries(dir).forEach(([k, v]) => {
      const s = typeof v === 'string' ? v.trim() : v;
      if (s !== '' && s !== null && s !== undefined) out[k] = s;
    });
    return out;
  };
  
  const SAT_OPTIONS = [
  { code: '53103200', label: '53103200 - Ropa Desechable' },
  { code: '52101508', label: '52101508 - Tapetes de Entrada' },
];

  // Cotizar y generar guía mandan exactamente el mismo paquete (ver skydropx-logica.js).
  const construirParcela = () => window.skydropxLogica.construirParcela(paquete);

  const cotizar = async () => {
    setCotizando(true);
    setError(null);
    setTarifas([]);
    setTarifaSel(null);
    const payload = {
      address_from: limpiarDireccion(origen),
      address_to: limpiarDireccion(destino),
      parcels: [construirParcela()],
      cantidad_bultos: cantidadBultos,
    };
    const r = await window.api.skydropxCotizar(payload);
    setCotizando(false);
    setCotizado(true);
    if (!r.ok) {
      setError(r.error || 'No se pudo cotizar el envío');
      return;
    }
    const lista = (r.data?.tarifas || []).map(skyNormalizaTarifa).filter(t => t.id);
    setTarifas(lista);
    setCotizacionId(r.data?.cotizacion_id || null);
    persistir();
    if (lista.length === 0) {
      toast.warn('Sin tarifas disponibles', `Ningún carrier cotizó al CP ${destino.postal_code}`);
    } else {
      // Preselecciona la más barata: es la decisión habitual y ahorra un clic.
      const barata = lista.reduce((min, t) => (t.total > 0 && t.total < min.total ? t : min), lista[0]);
      setTarifaSel(barata.id);
    }
  };

  // Reconsulta la cotización ya creada (GET /skydropx/cotizaciones/{id}). Sirve
  // cuando la primera respuesta llegó sin tarifas porque algún carrier seguía
  // contestando: evita crear otra cotización desde cero.
  const reconsultar = async () => {
    if (!cotizacionId) return;
    setCotizando(true);
    setError(null);
    const r = await window.api.skydropxCotizacion(cotizacionId);
    setCotizando(false);
    if (!r.ok) {
      setError(r.error || 'No se pudo reconsultar la cotización');
      return;
    }
    const lista = (r.data?.tarifas || []).map(skyNormalizaTarifa).filter(t => t.id);
    setTarifas(lista);
    if (lista.length === 0) {
      toast.warn('Sigue sin tarifas', 'Los carriers todavía no devuelven precios para ese destino');
    } else {
      const barata = lista.reduce((min, t) => (t.total > 0 && t.total < min.total ? t : min), lista[0]);
      setTarifaSel(barata.id);
    }
  };

  const generarGuia = async () => {
    const tarifa = tarifas.find(t => t.id === tarifaSel);
    if (!tarifa) return;
    setGenerando(true);
    setError(null);
    const r = await window.api.skydropxGenerarGuia({
      rate_id: tarifa.id,
      address_from: limpiarDireccion(origen),
      address_to: limpiarDireccion(destino),
      parcels: [construirParcela()],
      cantidad_bultos: cantidadBultos,
      referencia: codigo,
      // Liga la guía con la cotización: es lo que permite que el estatus del
      // webhook caiga en el renglón correcto de la tabla.
      codigo_cotizacion: codigo,
      // Solo para guardarlos junto a la guía: Skydropx no los repite en la
      // respuesta del envío. NO van dentro de `extras`, que se reenvía tal cual
      // al API de Skydropx.
      servicio: tarifa.servicio,
      costo: tarifa.total,
    }, user);
    setGenerando(false);
    if (!r.ok) {
      setError(r.error || 'No se pudo generar la guía');
      toast.error(`No se pudo generar la guía de ${codigo}`, r.error);
      return;
    }
    const nueva = skyNormalizaGuia(r.data?.envio);
    // El carrier de la tarifa es más confiable que el del cuerpo del envío para rastrear.
    if (!nueva.carrier) nueva.carrier = tarifa.carrier;
    nueva.costo = tarifa.total;
    nueva.servicio = tarifa.servicio;
    nueva.fecha = new Date().toISOString();
    // Mismo estatus inicial con el que el backend acaba de guardar la fila, para
    // que el badge aparezca de una vez y no hasta reabrir el modal.
    nueva.estatus_texto = 'Guía creada';
    nueva.estatus_tono = 'info';

    // Skydropx V2: el backend arma `paquetes` con una entrada por guía, cada
    // una con su tracking/etiqueta y su shipment_id (2+ en multipaquete).
    const paquetesResp = window.skydropxLogica.bultosDesdePaquetes(r.data?.paquetes);
    const nuevosBultos = paquetesResp.length > 0
      ? paquetesResp
      : [{ numero: 1, tracking: nueva.tracking, etiqueta: nueva.etiqueta, shipmentId: nueva.id, packageId: '' }];
    // El shipment (nivel raíz del envío) no siempre trae tracking/etiqueta
    // propios en multipaquete -- viven en cada paquete. Se completa `nueva`
    // (la guía "principal" que usan rastreo/historial) con el primer bulto.
    if (!nueva.tracking && nuevosBultos[0]?.tracking) nueva.tracking = nuevosBultos[0].tracking;
    if (!nueva.etiqueta && nuevosBultos[0]?.etiqueta) nueva.etiqueta = nuevosBultos[0].etiqueta;

    setBultos(nuevosBultos);
    setGuia(nueva);
    persistir({ guia: nueva, bultos: nuevosBultos });
    cargarSaldo();   // la guía ya descontó saldo
    onGuiaGenerada?.(codigo, nueva);
    toast.success(
      cantidadBultos > 1 ? `${nuevosBultos.length} guías generadas` : 'Guía generada',
      `${nueva.carrier} · ${nueva.tracking || 'sin número de rastreo'}` +
        (cantidadBultos > 1 && nuevosBultos.length > 1 ? ` (+${nuevosBultos.length - 1} más)` : '')
    );
    window.fireConfetti();
  };

  const rastrear = async () => {
    if (!guia?.tracking) return;
    setRastreando(true);
    setError(null);
    const r = await window.api.skydropxRastreo(guia.tracking, guia.carrier);
    setRastreando(false);
    if (!r.ok) {
      setError(r.error || 'No se pudo consultar el rastreo');
      return;
    }
    const lista = skyNormalizaEventos(r.data?.rastreo);
    setEventos(lista);
    if (lista.length === 0) toast.info('Sin movimientos', 'El carrier aún no reporta eventos de esta guía');
  };

  // La guía casi siempre se crea SIN tracking_number/label_url: Skydropx la
  // genera con el carrier de forma asíncrona y los completa después (el backend
  // ya reconsulta un par de segundos, pero si el carrier tarda más, el dato
  // solo llega por webhook). Sin esto, quien deja el modal abierto nunca ve el
  // número de rastreo ni el botón de imprimir aparecer por sí solos.
  const actualizarGuia = async () => {
    setActualizando(true);
    const lista = await window.api.skydropxEnvios(codigo);
    setActualizando(false);
    if (!lista.ok || lista.length === 0) {
      toast.info('Sin novedades', 'Skydropx todavía no reporta datos nuevos para esta guía');
      return;
    }
    const ultimo = lista[0]; // el backend ya ordena por id DESC
    const actualizada = {
      ...guia,
      tracking: ultimo.tracking_number || guia?.tracking || '',
      carrier: ultimo.carrier || guia?.carrier || '',
      etiqueta: ultimo.etiqueta_url || guia?.etiqueta || '',
      ordenDetalle: ultimo.orden_detalle_url || guia?.ordenDetalle || '',
      estatus_texto: ultimo.estatus_texto || guia?.estatus_texto,
      estatus_tono: ultimo.estatus_tono || guia?.estatus_tono,
      estatus_descripcion: ultimo.estatus_descripcion || guia?.estatus_descripcion,
    };
    setGuia(actualizada);

    // Multipaquete: cada guía generada para esta cotización queda como su
    // propio renglón en skydropx_envios, y `lista` ya trae todos.
    const nuevosBultos = window.skydropxLogica.bultosDesdeEnviosGuardados(lista);
    setBultos(nuevosBultos);
    persistir({ guia: actualizada, bultos: nuevosBultos });
    cargarHistorial(actualizada.tracking);
    const huboNovedad = actualizada.tracking !== guia?.tracking || actualizada.etiqueta !== guia?.etiqueta
      || nuevosBultos.length !== bultos.length;
    if (huboNovedad) toast.success('Actualizado', 'Se encontraron datos nuevos de Skydropx');
    else toast.info('Sin novedades', 'Skydropx todavía no reporta datos nuevos para esta guía');
  };

  // ---------- Recolección (dos pasos) ----------
  // Paso 1: qué fechas/horarios ofrece el carrier para ESE shipment.
  const consultarHorarios = async (shipmentId) => {
    setRecForm({ shipmentId, cargando: true, horarios: [], fecha: '', inicio: '', fin: '' });
    setError(null);
    const r = await window.api.skydropxCoberturaRecoleccion(shipmentId);
    if (!r.ok) {
      setRecForm(null);
      setError(r.error || 'No se pudo consultar la cobertura de recolección');
      return;
    }
    if (r.data?.recoleccion) {
      setRecolecciones(prev => ({ ...prev, [shipmentId]: r.data.recoleccion }));
      setRecForm(null);
      return;
    }
    const horarios = r.data?.horarios || [];
    const primero = horarios[0];
    setRecForm({
      shipmentId,
      cargando: false,
      horarios,
      fecha: primero?.fecha || '',
      inicio: primero?.hora_inicio || '',
      fin: primero?.hora_fin || '',
    });
  };

  const shipments = sk_uM(() => window.skydropxLogica.shipmentsDeBultos(bultos), [bultos]);
  const horarioElegido = recForm?.horarios.find(h => h.fecha === recForm.fecha) || null;
  const ventanaOk = window.skydropxLogica.ventanaValida(horarioElegido, recForm?.inicio, recForm?.fin);

  // Paso 2: agenda la recolección ligada al shipment.
  const agendarRecoleccion = async (shipment) => {
    const payload = window.skydropxLogica.armarRecoleccion({
      shipment,
      fecha: recForm.fecha,
      inicio: recForm.inicio,
      fin: recForm.fin,
      pesoPorBulto: paquete.weight,
      usuario: user,
    });
    setAgendando(true);
    setError(null);
    const r = await window.api.skydropxAgendarRecoleccion(payload, user);
    setAgendando(false);
    if (!r.ok) {
      setError(r.error || 'No se pudo agendar la recolección');
      toast.error('No se pudo agendar la recolección', r.error);
      return;
    }
    const rec = r.data?.recoleccion || payload;
    setRecolecciones(prev => ({ ...prev, [shipment.shipmentId]: rec }));
    setRecForm(null);
    toast.success('Recolección agendada', `${rec.fecha} · ${rec.hora_inicio}–${rec.hora_fin}`);
  };

  const copiar = (texto) => {
    navigator.clipboard?.writeText(texto)
      .then(() => toast.success('Copiado', texto))
      .catch(() => toast.error('No se pudo copiar', texto));
  };

  const credencialesListas = !config || (config.client_id && config.client_secret);
  const esProduccion = config?.ambiente === 'produccion';

  return (
    <div className="modal-backdrop" onClick={() => { if (!cerrarBloqueado) onClose(); }}>
      {ConfirmModal}
      <div className="modal sky-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Envío Skydropx para ${codigo}`}>

        <div className="sky-head">
          <div>
            <h3 className="card-title">Envío Skydropx</h3>
            <div className="sky-head-meta">
              <span className="mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>{codigo}</span>
              <span style={{ fontSize: 12, color: 'var(--fg-1)' }}>{cot.empresa}</span>
              {config && (
                <span className={`badge badge-${esProduccion ? 'danger' : 'info'}`}>
                  <span className="badge-dot" />{esProduccion ? 'Producción' : 'Sandbox'}
                </span>
              )}
              {saldo && (
                <span style={{ fontSize: 11, color: 'var(--fg-2)' }}>
                  <Icon name="wallet" size={11} /> Saldo:{' '}
                  <span className="mono" style={{ color: saldo.saldo == null ? 'var(--fg-2)' : 'var(--fg-1)' }}>
                    {saldo.saldo != null ? window.fmt.mxn(saldo.saldo) : 'no disponible'}
                  </span>
                </span>
              )}
            </div>
          </div>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} disabled={cerrarBloqueado} aria-label="Cerrar">
            <Icon name="x" size={14} />
          </button>
        </div>

        <div className="sky-body">

          {config && !credencialesListas && (
            <div className="sky-aviso sky-aviso-danger" role="alert">
              <Icon name="alert" size={15} />
              <div>
                <strong>Faltan credenciales de Skydropx.</strong>{' '}
                Carga <code>SKYDROPX_CLIENT_ID</code> y <code>SKYDROPX_CLIENT_SECRET</code> en
                el <code>.env</code> de api_zeutica1 y reinicia el servicio.
              </div>
            </div>
          )}

          {esProduccion && !guia && (
            <div className="sky-aviso sky-aviso-warn" role="status">
              <Icon name="alert" size={15} />
              <div>
                <strong>Ambiente productivo.</strong> Generar la guía contrata el envío con el
                carrier y se cobra. Cotizar no cuesta nada.
              </div>
            </div>
          )}

          {error && (
            <div className="sky-aviso sky-aviso-danger" role="alert" aria-live="assertive">
              <Icon name="alert" size={15} />
              <div style={{ flex: 1 }}>{error}</div>
            </div>
          )}

          {/* ---------- 1. Destino ---------- */}
          <div>
            <div className="sky-seccion-titulo">
              <span className={`sky-paso ${cpValido ? 'sky-paso-ok' : ''}`}>1</span> Destino
            </div>

            {direcciones?.length > 0 && (
              <SkyDireccionGuardada
                id="sky-dir-destino"
                direcciones={direcciones}
                tipo="to"
                disabled={!!guia}
                onElegir={(d) => setDestino(prev => window.skydropxLogica.aplicarDireccion(prev, d.direccion))}
              />
            )}
            {direcciones && direcciones.ok && direcciones.length === 0 && (
              <div className="field-hint" style={{ marginBottom: 8 }}>
                Tu cuenta de Skydropx no tiene direcciones guardadas; captura el destino a mano.
              </div>
            )}

            <div className="sky-grid-3">
              <div className="field">
                <label className="field-label" htmlFor="sky-cp">Código postal *</label>
                <input
                  id="sky-cp"
                  ref={primerCampo}
                  className="input mono"
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="44100"
                  value={destino.postal_code}
                  onChange={e => setD('postal_code', e.target.value.replace(/\D/g, ''))}
                  onBlur={() => setTocadoCP(true)}
                  aria-invalid={tocadoCP && !cpValido}
                  aria-describedby="sky-cp-error"
                />
                {tocadoCP && !cpValido && (
                  <span id="sky-cp-error" className="field-hint" style={{ color: 'var(--danger)' }} role="alert">
                    Debe tener 5 dígitos.
                  </span>
                )}
              </div>
              <div className="field">
                <label className="field-label" htmlFor="sky-estado">Estado</label>
                <input id="sky-estado" className="input" value={destino.area_level1} onChange={e => setD('area_level1', e.target.value)} placeholder="Jalisco" />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="sky-municipio">Municipio</label>
                <input id="sky-municipio" className="input" value={destino.area_level2} onChange={e => setD('area_level2', e.target.value)} placeholder="Guadalajara" />
              </div>
            </div>

            <div className="sky-grid-3" style={{ marginTop: 10 }}>
              <div className="field">
                <label className="field-label" htmlFor="sky-colonia">Colonia</label>
                <input id="sky-colonia" className="input" value={destino.area_level3} onChange={e => setD('area_level3', e.target.value)} placeholder="Centro" />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="sky-calle">Calle y número</label>
                <input id="sky-calle" className="input" value={destino.street1} onChange={e => setD('street1', e.target.value)} placeholder="Av. Juárez 100" />
              </div>
              {/* Las plantillas de la libreta suelen traer aquí el número. */}
              <div className="field">
                <label className="field-label" htmlFor="sky-interior">Núm. interior</label>
                <input id="sky-interior" className="input" value={destino.apartment_number || ''} onChange={e => setD('apartment_number', e.target.value)} placeholder="4B" />
              </div>
            </div>

            <div className="sky-grid-3" style={{ marginTop: 10 }}>
              <div className="field">
                <label className="field-label" htmlFor="sky-nombre">Recibe</label>
                <input id="sky-nombre" className="input" value={destino.name} onChange={e => setD('name', e.target.value)} />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="sky-tel">Teléfono</label>
                <input id="sky-tel" className="input" type="tel" inputMode="tel" value={destino.phone} onChange={e => setD('phone', e.target.value)} placeholder="3312345678" />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="sky-email">Email</label>
                <input id="sky-email" className="input" type="email" value={destino.email} onChange={e => setD('email', e.target.value)} />
              </div>
            </div>

            <div className="field" style={{ marginTop: 10 }}>
              <label className="field-label" htmlFor="sky-referencia">Referencia para el repartidor</label>
              <input
                id="sky-referencia"
                className="input"
                value={destino.reference}
                onChange={e => setD('reference', e.target.value)}
                placeholder="Entre calles, color de fachada, portón negro…"
              />
              <span className="field-hint">Requerida por Skydropx para generar la guía; se precargó con el nombre del cliente.</span>
            </div>

            <div className="field-hint" style={{ marginTop: 8 }}>
              Para cotizar basta el código postal. El resto lo exige el carrier al generar la guía.
            </div>

            {direcciones && (
              <SkyGuardarDireccion tipo="to" direccion={destino} user={user} disabled={!!guia} onGuardada={agregarALibreta} />
            )}
          </div>

          {/* ---------- Origen (plegado: casi nunca cambia) ---------- */}
          <div>
            <div className="sky-origen">
              <span>
                <Icon name="building" size={12} /> Origen: {origen.area_level2}, {origen.area_level1} · CP {origen.postal_code}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => setVerOrigen(v => !v)} aria-expanded={verOrigen}>
                {verOrigen ? 'Ocultar' : 'Cambiar'}
              </button>
            </div>
            {verOrigen && direcciones?.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <SkyDireccionGuardada
                  id="sky-dir-origen"
                  direcciones={direcciones}
                  tipo="from"
                  disabled={!!guia}
                  onElegir={(d) => setOrigen(prev => window.skydropxLogica.aplicarDireccion(prev, d.direccion))}
                />
              </div>
            )}
            {verOrigen && (
              <div className="sky-grid-3" style={{ marginTop: 10 }}>
                <div className="field">
                  <label className="field-label" htmlFor="sky-ocp">CP origen</label>
                  <input id="sky-ocp" className="input mono" maxLength={5} value={origen.postal_code}
                    onChange={e => setOrigen(p => ({ ...p, postal_code: e.target.value.replace(/\D/g, '') }))} />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="sky-oestado">Estado</label>
                  <input id="sky-oestado" className="input" value={origen.area_level1}
                    onChange={e => setOrigen(p => ({ ...p, area_level1: e.target.value }))} />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="sky-omunicipio">Municipio</label>
                  <input id="sky-omunicipio" className="input" value={origen.area_level2}
                    onChange={e => setOrigen(p => ({ ...p, area_level2: e.target.value }))} />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="sky-oreferencia">Referencia</label>
                  <input id="sky-oreferencia" className="input" value={origen.reference}
                    onChange={e => setOrigen(p => ({ ...p, reference: e.target.value }))} />
                </div>
              </div>
            )}
            {verOrigen && direcciones && (
              <SkyGuardarDireccion tipo="from" direccion={origen} user={user} disabled={!!guia} onGuardada={agregarALibreta} />
            )}
          </div>

          {/* ---------- 2. Paquete ---------- */}
          <div>
            <div className="sky-seccion-titulo">
              <span className={`sky-paso ${paqueteValido ? 'sky-paso-ok' : ''}`}>2</span> Paquete
            </div>
            <div className="sky-presets">
              {cajas.map(p => (
                <button
                  key={p.id}
                  type="button"
                  className={`sky-preset ${presetActivo?.id === p.id ? 'activo' : ''}`}
                  // Merge, no reemplazo: un setPaquete({...}) a secas tiraba
                  // package_type/consignment_note (bug real: el preset "Caja
                  // chica" coincide con SKY_PAQUETE_DEFAULT, así que quedaba
                  // activo sin que el usuario lo tocara, pero elegir cualquier
                  // OTRO preset borraba esos dos campos ya rellenados).
                  onClick={() => setPaquete(prev => window.skydropxLogica.aplicarCaja(prev, p))}
                  aria-pressed={presetActivo?.id === p.id}
                  title={`${p.length}×${p.width}×${p.height} cm · ${p.weight} kg`}
                >
                  {p.label}
                </button>
              ))}
              {cajasApi.ok && !nuevaCaja && (
                <button type="button" className="sky-preset" onClick={() => setNuevaCaja(true)} disabled={!!guia}>
                  <Icon name="plus" size={11} /> Nueva caja
                </button>
              )}
            </div>
            {nuevaCaja && (
              <SkyNuevaCaja
                paquete={paquete}
                user={user}
                onCancelar={() => setNuevaCaja(false)}
                onGuardada={(caja) => {
                  setCajasApi(prev => {
                    const lista = [...prev, caja];
                    lista.ok = true;  // conserva la marca de "catálogo leído" de listaConError
                    return lista;
                  });
                  setNuevaCaja(false);
                  setPaquete(prev => window.skydropxLogica.aplicarCaja(prev, window.skydropxLogica.cajasParaBotones([caja])[0]));
                }}
              />
            )}
            <div className="field" style={{ marginTop: 10, maxWidth: 220 }}>
              <label className="field-label" htmlFor="sky-bultos">Cantidad de bultos / guías</label>
              <input
                id="sky-bultos"
                className="input mono"
                type="number"
                min="1"
                max="20"
                step="1"
                value={cantidadBultos}
                onChange={e => setCantidadBultos(e.target.value)}
                onBlur={e => {
                  const n = Math.round(Number(e.target.value));
                  setCantidadBultos(n > 0 ? Math.min(n, 20) : 1);
                }}
                disabled={!!guia}
              />
              <span className="field-hint">
                {cantidadBultos > 1
                  ? `Se cotizarán/generarán ${cantidadBultos} bultos idénticos (misma medida) en un solo envío.`
                  : 'Un solo bulto. Aumenta el número si este pedido se divide en varias cajas idénticas.'}
              </span>
            </div>

            <div className="sky-grid-4" style={{ marginTop: 10 }}>
              {[
                ['length', 'Largo (cm)'],
                ['width', 'Ancho (cm)'],
                ['height', 'Alto (cm)'],
                ['weight', 'Peso (kg)'],
              ].map(([k, label]) => (
                <div className="field" key={k}>
                  <label className="field-label" htmlFor={`sky-${k}`}>{label}</label>
                  <input
                    id={`sky-${k}`}
                    className="input mono"
                    type="number"
                    min="0.1"
                    step={k === 'weight' ? '0.1' : '1'}
                    value={paquete[k]}
                    onChange={e => setP(k, e.target.value)}
                    onBlur={e => { if (!(Number(e.target.value) > 0)) setP(k, SKY_PAQUETE_DEFAULT[k]); }}
                  />
                </div>
              ))}
            </div>            

            <div className="sky-grid-2" style={{ marginTop: 10 }}>
              <div className="field">
                <label className="field-label" htmlFor="sky-package-type">Tipo de embalaje</label>
                {embalajes.length > 0 ? (
                  <select
                    id="sky-package-type"
                    className="input"
                    style={{ fontSize: 12 }}
                    value={paquete.package_type || ''}
                    onChange={e => setP('package_type', e.target.value)}
                  >
                    {window.skydropxLogica.opcionesEmbalaje(embalajes, paquete.package_type).map(o => (
                      <option key={o.code} value={o.code}>{o.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="sky-package-type"
                    className="input mono"
                    value={paquete.package_type}
                    onChange={e => setP('package_type', e.target.value)}
                    onBlur={e => { if (!e.target.value.trim()) setP('package_type', SKY_PAQUETE_DEFAULT.package_type); }}
                  />
                )}
                <span className="field-hint">
                  {embalajes.length > 0
                    ? 'Catálogo de embalajes de tu cuenta Skydropx.'
                    : 'No se pudo leer el catálogo de Skydropx: captura el código a mano ("4G" = caja de cartón).'}
                </span>
              </div>
              <div className="field-select">
                  <label className="field-label" htmlFor="sky-contenido">
                    CONTENIDO (CARTA PORTE)
                  </label>
                  <select
                    id="sky-contenido"
                    className="input"
                    style={{ fontSize: 12, color: 'var(--fg-1)' }}
                    value={paquete.consignment_note || ''}
                    onChange={e => setP('consignment_note', e.target.value)}
                  >
                    <option value="" disabled style={{ backgroundColor: 'var(--bg-1)', color: 'var(--fg-2)' }}>
                      Selecciona un código SAT
                    </option>
                    {SAT_OPTIONS.map(item => (
                      <option 
                        key={item.code} 
                        value={item.code} 
                        style={{ fontSize: 12, color: 'var(--fg-1)' }}
                      >
                        {item.label}
                      </option>
                    ))}
                  </select>
              </div>
            </div>

            <div className="field" style={{ marginTop: 10 }}>
              <label className="field-label" htmlFor="sky-declared-value">Valor declarado / seguro (MXN por bulto)</label>
              <input
                id="sky-declared-value"
                className="input mono"
                type="number"
                min="0"
                step="100"
                value={paquete.declared_value ?? ''}
                onChange={e => setP('declared_value', e.target.value)}
                onBlur={e => setP('declared_value', window.skydropxLogica.valorDeclarado(e.target.value))}
              />
              <span className="field-hint">
                {window.skydropxLogica.valorDeclarado(paquete.declared_value) > 0
                  ? `La guía se genera con seguro por ${window.fmt.mxn(window.skydropxLogica.valorDeclarado(paquete.declared_value))} por bulto. Cotiza de nuevo si lo cambias.`
                  : 'Sin seguro: la guía se generará sin protección.'}
              </span>
            </div>
          </div>

          {/* ---------- 3. Tarifas ---------- */}
          {(cotizando || cotizado) && (
            <div>
              <div className="sky-seccion-titulo">
                <span className={`sky-paso ${tarifas.length > 0 ? 'sky-paso-ok' : ''}`}>3</span> Tarifas
                {cotizacionId && <span className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>{cotizacionId}</span>}
              </div>

              {cotizando ? (
                <div className="empty" style={{ padding: 20 }} aria-live="polite">
                  <span className="spinner" /> Consultando carriers en Skydropx…
                </div>
              ) : tarifas.length === 0 ? (
                <div className="empty" style={{ padding: 20 }}>
                  <div className="empty-icon"><Icon name="pkg" /></div>
                  <div>Ningún carrier cotizó a ese destino</div>
                  <div className="empty-detail">
                    Revisa el código postal y las medidas, o vuelve a consultar: los carriers
                    a veces tardan en responder.
                  </div>
                  {cotizacionId && (
                    <button className="btn btn-secondary btn-sm" style={{ marginTop: 10 }} onClick={reconsultar}>
                      <Icon name="refresh" size={12} /> Reconsultar tarifas
                    </button>
                  )}
                </div>
              ) : (
                <div className="sky-tarifas" role="radiogroup" aria-label="Tarifas disponibles">
                  {tarifas.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      role="radio"
                      aria-checked={tarifaSel === t.id}
                      className={`sky-tarifa ${tarifaSel === t.id ? 'activa' : ''}`}
                      onClick={() => setTarifaSel(t.id)}
                      disabled={!!guia}
                    >
                      <span className="sky-tarifa-radio" />
                      <span className="sky-tarifa-info">
                        <span className="sky-tarifa-carrier">
                          {t.carrier}
                          {masBarata?.id === t.id && tarifas.length > 1 && <span className="sky-chip-barata">Más barata</span>}
                        </span>
                        <span className="sky-tarifa-servicio">{t.servicio || 'Servicio estándar'}</span>
                        {cantidadBultos > 1 && t.tipoCreacion && (
                          <span className="field-hint" style={{ display: 'block' }}>
                            {t.tipoCreacion === 'multipackage'
                              ? `Multipaquete nativo: ${cantidadBultos} bultos en una sola guía maestra.`
                              : t.tipoCreacion === 'multishipment'
                                ? `Sin multipaquete nativo: generará ${cantidadBultos} guías independientes.`
                                : t.tipoCreacion}
                          </span>
                        )}
                      </span>
                      <span className="sky-tarifa-precio">
                        <span className="sky-tarifa-monto mono">{window.fmt.mxn(t.total)}</span>
                        <span className="sky-tarifa-dias">{t.dias ? `${t.dias} día(s)` : 'Sin estimado'}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ---------- 4. Guía generada ---------- */}
          {guia && (
            <div>
              <div className="sky-seccion-titulo">
                <span className="sky-paso sky-paso-ok"><Icon name="check" size={10} /></span> Guía generada
              </div>
              <div className="sky-guia">
                <div className="sky-guia-row">
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--fg-1)', textTransform: 'capitalize' }}>
                      {guia.carrier} {guia.servicio ? `· ${guia.servicio}` : ''}
                    </div>
                    <div className="sky-guia-track mono">{guia.tracking || 'Sin número de rastreo'}</div>
                    {!guia.tracking && (
                      <div className="field-hint">
                        Skydropx genera el número de rastreo y la etiqueta con el carrier
                        después de contratar la guía; puede tardar unos minutos. Usa
                        "Actualizar" para revisar si ya está lista.
                      </div>
                    )}
                    {guia.estatus_texto && (
                      <div style={{ marginTop: 6 }}>
                        <span className={`badge badge-${guia.estatus_tono || 'info'}`}>
                          <span className="badge-dot" />{guia.estatus_texto}
                        </span>
                        {guia.estatus_descripcion && (
                          <span style={{ fontSize: 11, color: 'var(--fg-1)', marginLeft: 8 }}>
                            {guia.estatus_descripcion}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {guia.costo > 0 && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'var(--fg-1)' }}>Costo</div>
                      <div className="mono" style={{ fontSize: 15, fontWeight: 700 }}>{window.fmt.mxn(guia.costo)}</div>
                    </div>
                  )}
                </div>
                <div className="sky-guia-acciones">
                  {guia.tracking && (
                    <button className="btn btn-secondary btn-sm" onClick={() => copiar(guia.tracking)}>
                      <Icon name="doc" size={12} /> Copiar rastreo
                    </button>
                  )}
                  {/* Documentación para imprimir: la etiqueta se pega al paquete;
                      la remisión (packing slip) acompaña la entrega. */}
                  {guia.etiqueta && (
                    <a className="btn btn-secondary btn-sm" href={guia.etiqueta} target="_blank" rel="noopener noreferrer">
                      <Icon name="download" size={12} /> Imprimir etiqueta
                    </a>
                  )}
                  {guia.ordenDetalle && (
                    <a className="btn btn-secondary btn-sm" href={guia.ordenDetalle} target="_blank" rel="noopener noreferrer">
                      <Icon name="doc" size={12} /> Imprimir remisión
                    </a>
                  )}
                  {/* Trae lo que ya haya en el backend (tracking/etiqueta/estatus que
                      dejó el webhook mientras el modal estaba abierto), sin tener que
                      cerrar y volver a abrir el modal para verlo. */}
                  <button className="btn btn-secondary btn-sm" onClick={actualizarGuia} disabled={actualizando}>
                    {actualizando ? <><span className="spinner" /> Actualizando…</> : <><Icon name="refresh" size={12} /> Actualizar</>}
                  </button>
                  {/* Sin carrier el endpoint de rastreo responde 422: mejor no ofrecer el botón. */}
                  <button className="btn btn-primary btn-sm" onClick={rastrear} disabled={rastreando || !guia.tracking || !guia.carrier}>
                    {rastreando ? <><span className="spinner" /> Consultando…</> : <><Icon name="refresh" size={12} /> Rastrear</>}
                  </button>
                </div>
              </div>

              {/* Multipaquete: un botón de descarga por cada bulto generado. Con
                  1 solo bulto no se muestra nada aquí -- la guía ya está arriba. */}
              {bultos.length > 1 && (
                <div style={{ marginTop: 12 }}>
                  <div className="sky-seccion-titulo" style={{ marginBottom: 8 }}>
                    Bultos generados ({bultos.length})
                  </div>
                  <div className="sky-guia-acciones" style={{ flexWrap: 'wrap' }}>
                    {bultos.map((b) => (
                      <a
                        key={b.shipmentId ? `${b.shipmentId}-${b.numero}` : b.numero}
                        className="btn btn-secondary btn-sm"
                        href={b.etiqueta || undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => { if (!b.etiqueta) e.preventDefault(); }}
                        title={b.tracking || 'Sin número de rastreo'}
                        aria-disabled={!b.etiqueta}
                        style={!b.etiqueta ? { opacity: 0.5, cursor: 'default' } : undefined}
                      >
                        <Icon name="download" size={12} /> Guía Bulto {b.numero}
                        {b.tracking && <span className="mono" style={{ marginLeft: 6, fontSize: 10 }}>{b.tracking}</span>}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Recolección en dos pasos por shipment: consultar horarios
                  (cobertura del carrier) y agendar. Con tarifa "multishipment"
                  hay un shipment por bulto, y cada uno se agenda por separado. */}
              {shipments.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div className="sky-seccion-titulo" style={{ marginBottom: 8 }}>Recolección</div>
                  <div className="sky-recolecciones">
                    {shipments.map((s, i) => {
                      const rec = recolecciones[s.shipmentId];
                      const abierto = recForm?.shipmentId === s.shipmentId;
                      const etiqueta = shipments.length > 1
                        ? `Envío ${i + 1} (bulto${s.bultos.length > 1 ? 's' : ''} ${s.bultos.map(b => b.numero).join(', ')})`
                        : `${s.bultos.length} bulto${s.bultos.length > 1 ? 's' : ''}`;
                      return (
                        <div className="sky-recoleccion" key={s.shipmentId}>
                          <div className="sky-recoleccion-row">
                            <span style={{ fontSize: 12 }}>{etiqueta}</span>
                            {rec ? (
                              <span className="badge badge-success">
                                <span className="badge-dot" />
                                Agendada {rec.fecha} · {rec.hora_inicio}–{rec.hora_fin}
                                {rec.confirmacion ? ` · Folio ${rec.confirmacion}` : ''}
                              </span>
                            ) : (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => consultarHorarios(s.shipmentId)}
                                disabled={!s.listo || (abierto && recForm.cargando) || agendando}
                                title={!s.listo ? 'Disponible cuando la guía tenga número de rastreo' : undefined}
                              >
                                {abierto && recForm.cargando
                                  ? <><span className="spinner" /> Consultando…</>
                                  : <><Icon name="clock" size={12} /> Consultar horarios</>}
                              </button>
                            )}
                          </div>
                          {!rec && !s.listo && (
                            <div className="field-hint">
                              Skydropx solo acepta la recolección cuando el carrier terminó de crear
                              la guía (con número de rastreo). Usa "Actualizar" para revisar.
                            </div>
                          )}

                          {abierto && !recForm.cargando && (
                            recForm.horarios.length === 0 ? (
                              <div className="field-hint">El carrier no ofrece recolección para este envío.</div>
                            ) : (
                              <div className="sky-grid-3" style={{ marginTop: 8 }}>
                                <div className="field">
                                  <label className="field-label" htmlFor={`sky-rec-fecha-${i}`}>Fecha</label>
                                  <select
                                    id={`sky-rec-fecha-${i}`}
                                    className="input"
                                    value={recForm.fecha}
                                    onChange={e => {
                                      const h = recForm.horarios.find(x => x.fecha === e.target.value);
                                      setRecForm(f => ({ ...f, fecha: e.target.value, inicio: h?.hora_inicio || '', fin: h?.hora_fin || '' }));
                                    }}
                                  >
                                    {recForm.horarios.map(h => (
                                      <option key={h.fecha} value={h.fecha}>{h.fecha} ({h.hora_inicio}–{h.hora_fin})</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="field">
                                  <label className="field-label" htmlFor={`sky-rec-ini-${i}`}>Desde</label>
                                  <input
                                    id={`sky-rec-ini-${i}`}
                                    className="input mono"
                                    type="time"
                                    min={horarioElegido?.hora_inicio}
                                    max={horarioElegido?.hora_fin}
                                    value={recForm.inicio}
                                    onChange={e => setRecForm(f => ({ ...f, inicio: e.target.value }))}
                                  />
                                </div>
                                <div className="field">
                                  <label className="field-label" htmlFor={`sky-rec-fin-${i}`}>Hasta</label>
                                  <input
                                    id={`sky-rec-fin-${i}`}
                                    className="input mono"
                                    type="time"
                                    min={horarioElegido?.hora_inicio}
                                    max={horarioElegido?.hora_fin}
                                    value={recForm.fin}
                                    onChange={e => setRecForm(f => ({ ...f, fin: e.target.value }))}
                                  />
                                </div>
                              </div>
                            )
                          )}

                          {abierto && !recForm.cargando && recForm.horarios.length > 0 && (
                            <div className="sky-guia-acciones" style={{ marginTop: 8 }}>
                              {!ventanaOk && (
                                <span className="field-hint" style={{ color: 'var(--danger)' }} role="alert">
                                  El horario debe quedar dentro de {horarioElegido?.hora_inicio}–{horarioElegido?.hora_fin}.
                                </span>
                              )}
                              <button className="btn btn-ghost btn-sm" onClick={() => setRecForm(null)} disabled={agendando}>
                                Cancelar
                              </button>
                              <button
                                className="btn btn-primary btn-sm"
                                disabled={!ventanaOk || agendando}
                                onClick={() => askConfirm(
                                  `¿Agendar recolección el ${recForm.fecha} de ${recForm.inicio} a ${recForm.fin}` +
                                  ` para ${s.bultos.length} bulto(s)?`,
                                  () => agendarRecoleccion(s)
                                )}
                              >
                                {agendando
                                  ? <><span className="spinner" /> Agendando…</>
                                  : <><Icon name="check" size={12} /> Agendar recolección</>}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Historial propio: lo que Skydropx nos empujó por webhook. A
                  diferencia de "Rastrear", esto no consulta al carrier: ya está
                  guardado y queda aunque el carrier deje de responder. */}
              {historial.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div className="sky-seccion-titulo" style={{ marginBottom: 8 }}>
                    Historial de estatus ({historial.length})
                  </div>
                  <div className="sky-eventos">
                    {historial.map((ev, i) => (
                      <div className="sky-evento" key={i}>
                        <span className="sky-evento-dot" />
                        <span>
                          <span className="sky-evento-texto">
                            {ev.estatus_texto}
                            {ev.descripcion ? ` — ${ev.descripcion}` : ''}
                          </span>
                          <span className="sky-evento-fecha" style={{ display: 'block' }}>
                            {ev.recibido_en ? window.fmt.date(ev.recibido_en) : ''}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {eventos && (
                <div style={{ marginTop: 12 }}>
                  <div className="sky-seccion-titulo" style={{ marginBottom: 8 }}>
                    Rastreo en vivo del carrier
                  </div>
                  {eventos.length === 0 ? (
                    <div className="field-hint">El carrier aún no reporta movimientos de esta guía.</div>
                  ) : (
                    <div className="sky-eventos">
                      {eventos.map((ev, i) => (
                        <div className="sky-evento" key={i}>
                          <span className="sky-evento-dot" />
                          <span>
                            <span className="sky-evento-texto">{ev.texto}</span>
                            <span className="sky-evento-fecha" style={{ display: 'block' }}>
                              {ev.fecha ? window.fmt.date(ev.fecha) : ''}{ev.lugar ? ` · ${ev.lugar}` : ''}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="sky-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose} disabled={cerrarBloqueado}>
            {guia ? 'Cerrar' : 'Cancelar'}
          </button>

          {!guia && (
            <>
              <button className="btn btn-secondary btn-sm" onClick={cotizar} disabled={!puedeCotizar || !credencialesListas}>
                {cotizando
                  ? <><span className="spinner" /> Cotizando…</>
                  : <><Icon name="search" size={13} /> {cotizado ? 'Volver a cotizar' : 'Cotizar envío'}</>}
              </button>
              <button
                className="btn btn-primary btn-sm"
                disabled={!tarifaSel || generando || cotizando || !datosGuiaCompletos}
                title={!datosGuiaCompletos
                  ? 'Completa Referencia (Destino) y Tipo de paquete / Contenido (Paquete) antes de generar la guía'
                  : undefined}
                onClick={() => {
                  const t = tarifas.find(x => x.id === tarifaSel);
                  if (!t) return;
                  // El saldo restante se calcula solo si se pudo leer: con saldo
                  // desconocido es mejor no decir nada que dar una cifra inventada.
                  const hay = saldo?.saldo != null;
                  const restante = hay ? saldo.saldo - t.total : null;
                  // Cuando no alcanza se dice "faltan X" en vez de "quedarían
                  // $-X": fmt.mxn antepone el signo de pesos al número, así que
                  // un negativo saldría como "$-89.50" y además se lee peor.
                  const lineaSaldo = !hay
                    ? ' No se pudo leer el saldo de Skydropx.'
                    : restante >= 0
                      ? ` Saldo Skydropx: ${window.fmt.mxn(saldo.saldo)} → quedarían ${window.fmt.mxn(restante)}.`
                      : ` Saldo Skydropx: ${window.fmt.mxn(saldo.saldo)} → faltan ${window.fmt.mxn(-restante)}.` +
                        ' El saldo NO alcanza: Skydropx puede rechazar la guía.';
                  const lineaBultos = cantidadBultos > 1 ? ` Se generarán ${cantidadBultos} bultos/guías en este envío.` : '';
                  const valorSeguro = window.skydropxLogica.valorDeclarado(paquete.declared_value);
                  const lineaSeguro = valorSeguro > 0
                    ? ` Seguro: ${window.fmt.mxn(valorSeguro)} por bulto.`
                    : ' SIN seguro.';
                  askConfirm(
                    `¿Generar la guía de ${codigo} con ${t.carrier} por ${window.fmt.mxn(t.total)}?` +
                    lineaBultos +
                    lineaSeguro +
                    lineaSaldo +
                    (esProduccion ? ' El envío se contrata en producción y se cobra. No se puede cancelar desde el panel.' : ''),
                    generarGuia
                  );
                }}
              >
                {generando
                  ? <><span className="spinner" /> Generando guía…</>
                  : <><Icon name="pkg" size={13} /> Generar guía</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

window.SkydropxEnvioModal = SkydropxEnvioModal;
window.skydropxLeerEnvio = skyLeerEnvio;
