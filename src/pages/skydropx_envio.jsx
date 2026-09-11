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
};

// Medidas típicas de la operación. Evitan capturar 4 números en el caso común.
const SKY_PRESETS = [
  { id: 'sobre',   label: 'Sobre',        length: 30, width: 25, height: 2,  weight: 0.5 },
  { id: 'chica',   label: 'Caja chica',   length: 25, width: 20, height: 15, weight: 2 },
  { id: 'mediana', label: 'Caja mediana', length: 40, width: 30, height: 25, weight: 5 },
  { id: 'grande',  label: 'Caja grande',  length: 60, width: 40, height: 40, weight: 12 },
];

const SKY_PAQUETE_DEFAULT = { length: 25, width: 20, height: 15, weight: 2 };

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

function SkydropxEnvioModal({ cot, user, onClose, onGuiaGenerada }) {
  const toast = window.useToast();
  const [askConfirm, ConfirmModal] = window.useConfirm();
  const codigo = cot.codigo_cotizacion;
  const guardado = sk_uR(skyLeerEnvio(codigo)).current;
  const primerCampo = sk_uR(null);

  const [config, setConfig] = sk_uS(null);
  const [destino, setDestino] = sk_uS(guardado?.destino || {
    country_code: 'MX', postal_code: '', area_level1: '', area_level2: '', area_level3: '',
    street1: '', name: cot.empresa || '', company: cot.empresa || '', phone: '', email: '', reference: '',
  });
  const [paquete, setPaquete] = sk_uS(guardado?.paquete || SKY_PAQUETE_DEFAULT);
  const [origen, setOrigen] = sk_uS(guardado?.origen || SKY_ORIGEN_DEFAULT);
  const [verOrigen, setVerOrigen] = sk_uS(false);

  const [cotizando, setCotizando] = sk_uS(false);
  const [tarifas, setTarifas] = sk_uS([]);
  const [cotizacionId, setCotizacionId] = sk_uS(null);
  const [tarifaSel, setTarifaSel] = sk_uS(null);
  const [cotizado, setCotizado] = sk_uS(false);

  const [generando, setGenerando] = sk_uS(false);
  const [guia, setGuia] = sk_uS(guardado?.guia || null);

  const [rastreando, setRastreando] = sk_uS(false);
  const [eventos, setEventos] = sk_uS(null);

  const [error, setError] = sk_uS(null);
  const [tocadoCP, setTocadoCP] = sk_uS(false);

  const cpValido = /^\d{5}$/.test(String(destino.postal_code || '').trim());
  const paqueteValido = ['length', 'width', 'height', 'weight'].every(k => Number(paquete[k]) > 0);
  const puedeCotizar = cpValido && paqueteValido && !cotizando;
  // Mientras se genera la guía no se puede cerrar: la llamada ya salió y cerrar
  // dejaría al usuario sin el número de rastreo de un envío que ya se contrató.
  const cerrarBloqueado = generando;

  sk_uE(() => {
    (async () => {
      const cfg = await window.api.skydropxConfiguracion();
      setConfig(cfg);
    })();
    // El CP es el único dato que siempre falta: ahí arranca el foco.
    setTimeout(() => primerCampo.current?.focus(), 60);
  }, []);

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

  const cotizar = async () => {
    setCotizando(true);
    setError(null);
    setTarifas([]);
    setTarifaSel(null);
    const payload = {
      address_from: limpiarDireccion(origen),
      address_to: limpiarDireccion(destino),
      parcels: [{
        length: Number(paquete.length),
        width: Number(paquete.width),
        height: Number(paquete.height),
        weight: Number(paquete.weight),
      }],
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
      parcels: [{
        length: Number(paquete.length),
        width: Number(paquete.width),
        height: Number(paquete.height),
        weight: Number(paquete.weight),
      }],
      referencia: codigo,
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
    setGuia(nueva);
    persistir({ guia: nueva });
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
                  onClick={() => setPaquete({ length: p.length, width: p.width, height: p.height, weight: p.weight })}
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
                  {guia.etiqueta && (
                    <a className="btn btn-secondary btn-sm" href={guia.etiqueta} target="_blank" rel="noopener noreferrer">
                      <Icon name="download" size={12} /> Abrir etiqueta
                    </a>
                  )}
                  {/* Sin carrier el endpoint de rastreo responde 422: mejor no ofrecer el botón. */}
                  <button className="btn btn-primary btn-sm" onClick={rastrear} disabled={rastreando || !guia.tracking || !guia.carrier}>
                    {rastreando ? <><span className="spinner" /> Consultando…</> : <><Icon name="refresh" size={12} /> Rastrear</>}
                  </button>
                </div>
              </div>

              {eventos && (
                <div style={{ marginTop: 12 }}>
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
                disabled={!tarifaSel || generando || cotizando}
                onClick={() => {
                  const t = tarifas.find(x => x.id === tarifaSel);
                  if (!t) return;
                  askConfirm(
                    `¿Generar la guía de ${codigo} con ${t.carrier} por ${window.fmt.mxn(t.total)}?` +
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
