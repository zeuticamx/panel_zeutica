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
// la cotización (ver generarPDFCotizacion en cotizaciones.jsx).
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
const SKY_PAQUETE_DEFAULT = { length: 25, width: 20, height: 15, weight: 2, package_type: '4G', consignment_note: 'Mercancía general' };

// Contenido por defecto para la carta porte, armado con los productos de la
// cotización en vez de un texto genérico. Mismo requisito confirmado en
// sandbox: "consignment_note es requerido en todos los paquetes".
function skyContenidoDefault(cot) {
  const nombres = (cot.items || []).map(i => i?.nombre_producto).filter(Boolean);
  if (nombres.length === 0) return SKY_PAQUETE_DEFAULT.consignment_note;
  const preview = nombres.slice(0, 3).join(', ');
  return nombres.length > 3 ? `${preview} y ${nombres.length - 3} más` : preview;
}

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

function SkydropxEnvioModal({ cot, user, envio, onClose, onGuiaGenerada }) {
  const toast = window.useToast();
  const [askConfirm, ConfirmModal] = window.useConfirm();
  const codigo = cot.codigo_cotizacion;
  const guardado = sk_uR(skyLeerEnvio(codigo)).current;
  const primerCampo = sk_uR(null);

  const [config, setConfig] = sk_uS(null);
  const [destino, setDestino] = sk_uS(() => skyConDefaults({
    country_code: 'MX', postal_code: '', area_level1: '', area_level2: '', area_level3: '',
    // Referencia obligatoria para generar la guía; se precarga con la empresa
    // para que nunca llegue en blanco, editable si hay una mejor seña.
    street1: '', name: cot.empresa || '', company: cot.empresa || '', phone: '', email: '', reference: cot.empresa || '',
  }, guardado?.destino));
  const [paquete, setPaquete] = sk_uS(() => skyConDefaults({
    ...SKY_PAQUETE_DEFAULT,
    consignment_note: skyContenidoDefault(cot),
  }, guardado?.paquete));
  const [origen, setOrigen] = sk_uS(() => skyConDefaults(SKY_ORIGEN_DEFAULT, guardado?.origen));
  const [verOrigen, setVerOrigen] = sk_uS(false);

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
  const [eventos, setEventos] = sk_uS(null);
  // Línea de tiempo que dejó el webhook (histórico propio, no consulta al carrier).
  const [historial, setHistorial] = sk_uS([]);

  const [error, setError] = sk_uS(null);
  const [tocadoCP, setTocadoCP] = sk_uS(false);
  // Saldo de la cuenta: se muestra antes de generar para que el costo de la
  // guía no sea una sorpresa, y se recarga después porque la guía lo descuenta.
  const [saldo, setSaldo] = sk_uS(null);

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

  const persistir = (extra = {}) => skyGuardarEnvio(codigo, { destino, paquete, origen, guia, ...extra });

  const setD = (k, v) => setDestino(prev => ({ ...prev, [k]: v }));
  const setP = (k, v) => setPaquete(prev => ({ ...prev, [k]: v }));

  const presetActivo = SKY_PRESETS.find(p =>
    p.length === Number(paquete.length) && p.width === Number(paquete.width) &&
    p.height === Number(paquete.height) && p.weight === Number(paquete.weight)
  );

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

  // Un solo lugar para armar el paquete: cotizar y generar guía deben mandar
  // exactamente los mismos campos, o el rate_id de la cotización podría no
  // coincidir con lo que se está empaquetando de verdad.
  const construirParcela = () => ({
    length: Number(paquete.length),
    width: Number(paquete.width),
    height: Number(paquete.height),
    weight: Number(paquete.weight),
    consignment_note: (paquete.consignment_note || '').trim() || undefined,
    package_type: (paquete.package_type || '').trim() || undefined,
  });

  const cotizar = async () => {
    setCotizando(true);
    setError(null);
    setTarifas([]);
    setTarifaSel(null);
    const payload = {
      address_from: limpiarDireccion(origen),
      address_to: limpiarDireccion(destino),
      parcels: [construirParcela()],
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
    setGuia(nueva);
    persistir({ guia: nueva });
    cargarSaldo();   // la guía ya descontó saldo
    onGuiaGenerada?.(codigo, nueva);
    toast.success('Guía generada', `${nueva.carrier} · ${nueva.tracking || 'sin número de rastreo'}`);
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

            <div className="sky-grid-2" style={{ marginTop: 10 }}>
              <div className="field">
                <label className="field-label" htmlFor="sky-colonia">Colonia</label>
                <input id="sky-colonia" className="input" value={destino.area_level3} onChange={e => setD('area_level3', e.target.value)} placeholder="Centro" />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="sky-calle">Calle y número</label>
                <input id="sky-calle" className="input" value={destino.street1} onChange={e => setD('street1', e.target.value)} placeholder="Av. Juárez 100" />
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
          </div>

          {/* ---------- 2. Paquete ---------- */}
          <div>
            <div className="sky-seccion-titulo">
              <span className={`sky-paso ${paqueteValido ? 'sky-paso-ok' : ''}`}>2</span> Paquete
            </div>
            <div className="sky-presets">
              {SKY_PRESETS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  className={`sky-preset ${presetActivo?.id === p.id ? 'activo' : ''}`}
                  // Merge, no reemplazo: un setPaquete({...}) a secas tiraba
                  // package_type/consignment_note (bug real: el preset "Caja
                  // chica" coincide con SKY_PAQUETE_DEFAULT, así que quedaba
                  // activo sin que el usuario lo tocara, pero elegir cualquier
                  // OTRO preset borraba esos dos campos ya rellenados).
                  onClick={() => setPaquete(prev => ({ ...prev, length: p.length, width: p.width, height: p.height, weight: p.weight }))}
                  aria-pressed={presetActivo?.id === p.id}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="sky-grid-4">
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
                <label className="field-label" htmlFor="sky-package-type">Tipo de paquete</label>
                <input
                  id="sky-package-type"
                  className="input mono"
                  value={paquete.package_type}
                  onChange={e => setP('package_type', e.target.value)}
                  onBlur={e => { if (!e.target.value.trim()) setP('package_type', SKY_PAQUETE_DEFAULT.package_type); }}
                />
                <span className="field-hint">
                  Código de embalaje de Skydropx (default "4G" = caja, sin confirmar contra esta
                  cuenta). Si el sandbox lo rechaza, el error suele listar los valores válidos.
                </span>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="sky-contenido">Contenido (carta porte)</label>
                <input
                  id="sky-contenido"
                  className="input"
                  value={paquete.consignment_note}
                  onChange={e => setP('consignment_note', e.target.value)}
                  onBlur={e => { if (!e.target.value.trim()) setP('consignment_note', skyContenidoDefault(cot)); }}
                />
              </div>
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
                  {/* Sin carrier el endpoint de rastreo responde 422: mejor no ofrecer el botón. */}
                  <button className="btn btn-primary btn-sm" onClick={rastrear} disabled={rastreando || !guia.tracking || !guia.carrier}>
                    {rastreando ? <><span className="spinner" /> Consultando…</> : <><Icon name="refresh" size={12} /> Rastrear</>}
                  </button>
                </div>
              </div>

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
                  askConfirm(
                    `¿Generar la guía de ${codigo} con ${t.carrier} por ${window.fmt.mxn(t.total)}?` +
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
