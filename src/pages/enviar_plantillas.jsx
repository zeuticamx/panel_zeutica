// ===== Zeutica — Enviar plantillas (WhatsApp Cloud API de Meta) =====
// Flujo: eliges destinatario (cliente registrado o número nuevo), eliges una
// plantilla aprobada en Meta, rellenas sus variables y ves cómo va a llegar
// antes de mandarla. El envío es real y no se puede cancelar.
const { useState: ep_uS, useEffect: ep_uE, useMemo: ep_uM, useRef: ep_uR } = React;

const EP_MAX_CLIENTES_LISTA = 60;   // la lista se recorta; el buscador es el filtro real
const EP_LARGO_CONTEXTO = 34;       // caracteres de contexto que se muestran por variable

// ---- Helpers de plantilla ----

// Meta entrega los componentes crudos; aquí se busca el que interesa.
function epComponente(plantilla, tipo) {
  return (plantilla?.componentes || []).find(c => (c.type || '').toUpperCase() === tipo) || null;
}

// Índices de variables ({{1}}, {{2}}...) que aparecen en un texto, ordenados y sin repetir.
function epIndicesVariables(texto) {
  const encontrados = [...String(texto || '').matchAll(/\{\{(\d+)\}\}/g)].map(m => Number(m[1]));
  return [...new Set(encontrados)].sort((a, b) => a - b);
}

// Fragmento del texto alrededor de la variable, para saber qué se está llenando
// sin tener que leer la plantilla completa.
function epContextoVariable(texto, indice) {
  const marca = `{{${indice}}}`;
  const pos = String(texto || '').indexOf(marca);
  if (pos < 0) return '';
  const desde = Math.max(0, pos - EP_LARGO_CONTEXTO);
  const hasta = Math.min(texto.length, pos + marca.length + EP_LARGO_CONTEXTO);
  return `${desde > 0 ? '…' : ''}${texto.slice(desde, hasta).replace(marca, '⟦ ⟧')}${hasta < texto.length ? '…' : ''}`;
}

// WhatsApp usa *negrita*, _cursiva_ y ~tachado~. Se respeta para que la vista
// previa se parezca a lo que ve el cliente, no al texto crudo de Meta.
function epFormatoWhatsapp(texto, claveBase) {
  const partes = String(texto).split(/(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g);
  return partes.filter(Boolean).map((parte, i) => {
    const clave = `${claveBase}-f${i}`;
    if (/^\*[^*\n]+\*$/.test(parte)) return <strong key={clave}>{parte.slice(1, -1)}</strong>;
    if (/^_[^_\n]+_$/.test(parte)) return <em key={clave}>{parte.slice(1, -1)}</em>;
    if (/^~[^~\n]+~$/.test(parte)) return <s key={clave}>{parte.slice(1, -1)}</s>;
    return <React.Fragment key={clave}>{parte}</React.Fragment>;
  });
}

// Sustituye las variables por lo capturado. Lo que sigue vacío se pinta como
// hueco marcado, para que se note antes de enviar y no después.
function epTextoRenderizado(texto, valores, claveBase) {
  const partes = String(texto || '').split(/(\{\{\d+\}\})/g);
  return partes.filter(p => p !== '').map((parte, i) => {
    const clave = `${claveBase}-p${i}`;
    const m = parte.match(/^\{\{(\d+)\}\}$/);
    if (!m) return <React.Fragment key={clave}>{epFormatoWhatsapp(parte, clave)}</React.Fragment>;
    const valor = (valores?.[m[1]] || '').trim();
    return valor
      ? <React.Fragment key={clave}>{epFormatoWhatsapp(valor, clave)}</React.Fragment>
      : <span key={clave} className="wa-hueco">{parte}</span>;
  });
}

// Lo que se manda a Meta: el texto ya sustituido, en orden de índice.
function epValoresOrdenados(indices, valores) {
  return indices.map(i => (valores[i] || '').trim());
}

function epTelefonoLegible(digitos) {
  const d = String(digitos || '').replace(/\D/g, '');
  if (d.length === 10) return `${d.slice(0, 2)} ${d.slice(2, 6)} ${d.slice(6)}`;
  if (d.length === 12) return `+${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, 8)} ${d.slice(8)}`;
  return d ? `+${d}` : '';
}

// ---- Vista previa: burbuja de WhatsApp ----

function EPVistaPrevia({ plantilla, valoresEncabezado, valoresCuerpo, urlMedia }) {
  const hora = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  if (!plantilla) {
    return (
      <div className="wa-chat wa-chat-vacio">
        <div className="empty">
          <div className="empty-icon"><Icon name="chat" /></div>
          <div>Elige una plantilla para ver cómo llega el mensaje</div>
        </div>
      </div>
    );
  }

  const encabezado = epComponente(plantilla, 'HEADER');
  const cuerpo = epComponente(plantilla, 'BODY');
  const pie = epComponente(plantilla, 'FOOTER');
  const botones = epComponente(plantilla, 'BUTTONS')?.buttons || [];
  const formato = (encabezado?.format || 'TEXT').toUpperCase();

  return (
    <div className="wa-chat">
      <div className="wa-burbuja">
        {encabezado && formato === 'TEXT' && (
          <div className="wa-encabezado">
            {epTextoRenderizado(encabezado.text, valoresEncabezado, 'enc')}
          </div>
        )}

        {encabezado && formato !== 'TEXT' && (
          <div className="wa-media" data-formato={formato}>
            {formato === 'IMAGE' && urlMedia
              ? <img src={urlMedia} alt="Imagen del encabezado de la plantilla" />
              : (
                <div className="wa-media-placeholder">
                  <Icon name={formato === 'DOCUMENT' ? 'doc' : 'box'} size={22} />
                  <span>{formato === 'IMAGE' ? 'Imagen' : formato === 'VIDEO' ? 'Video' : 'Documento'}</span>
                </div>
              )}
          </div>
        )}

        {cuerpo && (
          <div className="wa-cuerpo">
            {epTextoRenderizado(cuerpo.text, valoresCuerpo, 'cue')}
          </div>
        )}

        {pie?.text && <div className="wa-pie">{pie.text}</div>}

        <div className="wa-meta">
          <span>{hora}</span>
          <svg width="16" height="11" viewBox="0 0 16 11" aria-hidden="true">
            <path d="M1 6l2.5 2.5L9 3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M6 6l2.5 2.5L14 3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {botones.length > 0 && (
          <div className="wa-botones">
            {botones.map((b, i) => (
              <div className="wa-boton" key={`${b.text}-${i}`}>
                {(b.type || '').toUpperCase() === 'URL' && <Icon name="globe" size={13} />}
                {(b.type || '').toUpperCase() === 'PHONE_NUMBER' && <Icon name="chat" size={13} />}
                <span>{b.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Página ----

function PageEnviarPlantillas({ user }) {
  const toast = window.useToast();
  const [askConfirm, ConfirmModal] = window.useConfirm();

  const [plantillas, setPlantillas] = ep_uS([]);
  const [configuracion, setConfiguracion] = ep_uS(null);
  const [errorPlantillas, setErrorPlantillas] = ep_uS(null);
  const [cargando, setCargando] = ep_uS(true);

  const [clientes, setClientes] = ep_uS([]);
  const [cargandoClientes, setCargandoClientes] = ep_uS(true);

  const [modoDestino, setModoDestino] = ep_uS('registrado'); // 'registrado' | 'nuevo'
  const [busquedaCliente, setBusquedaCliente] = ep_uS('');
  const [clienteSel, setClienteSel] = ep_uS(null);
  const [telefonoNuevo, setTelefonoNuevo] = ep_uS('');

  const [nombrePlantilla, setNombrePlantilla] = ep_uS('');
  const [valoresEncabezado, setValoresEncabezado] = ep_uS({});
  const [valoresCuerpo, setValoresCuerpo] = ep_uS({});
  const [urlMedia, setUrlMedia] = ep_uS('');
  const [nombreArchivo, setNombreArchivo] = ep_uS('');
  const [enviando, setEnviando] = ep_uS(false);
  const [ultimoEnvio, setUltimoEnvio] = ep_uS(null);

  const cargarPlantillas = async ({ refrescar = false } = {}) => {
    setCargando(true);
    const r = await window.api.plantillasWhatsapp({ refrescar });
    setPlantillas(r.data || []);
    setConfiguracion(r.configuracion || null);
    setErrorPlantillas(r.ok ? null : r.error);
    setCargando(false);
    if (refrescar && r.ok) toast.success('Plantillas actualizadas', `${(r.data || []).length} aprobadas en Meta`);
  };

  ep_uE(() => { cargarPlantillas(); }, []);

  ep_uE(() => {
    (async () => {
      setCargandoClientes(true);
      const lista = await window.api.clientes();
      setClientes(Array.isArray(lista) ? lista : []);
      setCargandoClientes(false);
    })();
  }, []);

  const plantilla = ep_uM(
    () => plantillas.find(p => `${p.nombre}|${p.idioma}` === nombrePlantilla) || null,
    [plantillas, nombrePlantilla]
  );

  const textoEncabezado = epComponente(plantilla, 'HEADER')?.text || '';
  const textoCuerpo = epComponente(plantilla, 'BODY')?.text || '';
  const formatoEncabezado = (epComponente(plantilla, 'HEADER')?.format || 'TEXT').toUpperCase();
  const indicesEncabezado = ep_uM(() => epIndicesVariables(textoEncabezado), [textoEncabezado]);
  const indicesCuerpo = ep_uM(() => epIndicesVariables(textoCuerpo), [textoCuerpo]);
  const requiereMedia = Boolean(plantilla) && formatoEncabezado !== 'TEXT';

  // Cambiar de plantilla limpia lo capturado: los índices no significan lo mismo
  // entre una plantilla y otra, arrastrarlos mandaría datos equivocados.
  ep_uE(() => {
    setValoresEncabezado({});
    setValoresCuerpo({});
    setUrlMedia('');
    setNombreArchivo('');
  }, [nombrePlantilla]);

  const clientesConTelefono = ep_uM(
    () => clientes.filter(c => String(c.telefono || '').replace(/\D/g, '').length >= 10),
    [clientes]
  );

  const clientesFiltrados = ep_uM(() => {
    const q = busquedaCliente.trim().toLowerCase();
    if (!q) return clientesConTelefono.slice(0, EP_MAX_CLIENTES_LISTA);
    return clientesConTelefono
      .filter(c => `${c.nombre || ''} ${c.empresa || ''} ${c.contacto || ''} ${c.telefono || ''}`.toLowerCase().includes(q))
      .slice(0, EP_MAX_CLIENTES_LISTA);
  }, [clientesConTelefono, busquedaCliente]);

  const telefonoDestino = modoDestino === 'registrado'
    ? String(clienteSel?.telefono || '')
    : telefonoNuevo;
  const digitosDestino = String(telefonoDestino).replace(/\D/g, '');
  const destinoValido = digitosDestino.length >= 10 && digitosDestino.length <= 15;

  const faltanVariables = [
    ...indicesEncabezado.filter(i => !(valoresEncabezado[i] || '').trim()),
    ...indicesCuerpo.filter(i => !(valoresCuerpo[i] || '').trim()),
  ].length;
  const faltaMedia = requiereMedia && !urlMedia.trim();

  const credencialesListas = !configuracion || (configuracion.token && configuracion.phone_number_id);
  const puedeEnviar = Boolean(plantilla) && destinoValido && faltanVariables === 0 && !faltaMedia && !enviando;

  const enviar = async () => {
    setEnviando(true);
    const r = await window.api.enviarPlantillaWhatsapp({
      telefono: telefonoDestino,
      plantilla: plantilla.nombre,
      idioma: plantilla.idioma,
      variables_encabezado: epValoresOrdenados(indicesEncabezado, valoresEncabezado),
      variables_cuerpo: epValoresOrdenados(indicesCuerpo, valoresCuerpo),
      url_encabezado: requiereMedia ? urlMedia.trim() : null,
      tipo_encabezado: requiereMedia ? formatoEncabezado : null,
      nombre_archivo: formatoEncabezado === 'DOCUMENT' ? (nombreArchivo.trim() || null) : null,
      destinatario: clienteSel?.nombre || clienteSel?.empresa || null,
    }, user);
    setEnviando(false);

    if (r.ok) {
      const destino = r.data?.destino || digitosDestino;
      setUltimoEnvio({ destino, id: r.data?.message_id, hora: new Date() });
      toast.success('Plantilla enviada', `${plantilla.nombre} → +${destino}`);
      window.fireConfetti();
    } else {
      toast.error('No se envió', r.error);
    }
  };

  const nombreDestino = clienteSel
    ? (clienteSel.empresa || clienteSel.nombre || `Cliente #${clienteSel.id}`)
    : 'Número nuevo';

  return (
    <div className="page">
      {ConfirmModal}

      <div className="section-header">
        <div>
          <h2 className="section-title">Enviar plantillas</h2>
          <p className="section-subtitle">
            Mensajes de WhatsApp con plantillas aprobadas en Meta. El envío es inmediato y no se puede cancelar.
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => cargarPlantillas({ refrescar: true })} disabled={cargando}>
          <Icon name="refresh" size={13} /> Actualizar plantillas
        </button>
      </div>

      {configuracion && !credencialesListas && (
        <div className="card ep-aviso" role="status">
          <div className="card-body ep-aviso-body">
            <Icon name="alert" size={16} />
            <div>
              <strong>Faltan credenciales de Meta.</strong>{' '}
              Carga <code>META_WA_TOKEN</code>
              {!configuracion.phone_number_id && <> y <code>META_WA_PHONE_NUMBER_ID</code></>}
              {' '}en el <code>.env</code> de api_zeutica1 y reinicia el servicio.
            </div>
          </div>
        </div>
      )}

      <div className="ep-layout">
        {/* ---------- Columna izquierda: captura ---------- */}
        <div className="ep-formulario">

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">1. Destinatario</h3>
            </div>
            <div className="card-body">
              <div className="tabs ep-tabs" role="tablist" aria-label="Origen del número">
                <button
                  className={`tab ${modoDestino === 'registrado' ? 'active' : ''}`}
                  role="tab"
                  aria-selected={modoDestino === 'registrado'}
                  onClick={() => setModoDestino('registrado')}
                >
                  <Icon name="users" size={13} /> Cliente registrado
                </button>
                <button
                  className={`tab ${modoDestino === 'nuevo' ? 'active' : ''}`}
                  role="tab"
                  aria-selected={modoDestino === 'nuevo'}
                  onClick={() => setModoDestino('nuevo')}
                >
                  <Icon name="plus" size={13} /> Número nuevo
                </button>
              </div>

              {modoDestino === 'registrado' ? (
                clienteSel ? (
                  <div className="ep-cliente-elegido">
                    <div className="ep-cliente-elegido-avatar" aria-hidden="true">
                      {(clienteSel.empresa || clienteSel.nombre || '?').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="ep-cliente-elegido-info">
                      <div className="ep-cliente-nombre">{clienteSel.empresa || clienteSel.nombre || `Cliente #${clienteSel.id}`}</div>
                      <div className="ep-cliente-datos">
                        <span className="ep-telefono">{epTelefonoLegible(clienteSel.telefono)}</span>
                        {clienteSel.contacto && <span className="ep-cliente-contacto">· {clienteSel.contacto}</span>}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setClienteSel(null)}
                      title="Quitar cliente y elegir otro"
                    >
                      <Icon name="x" size={13} /> Quitar
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="field">
                      <label className="field-label" htmlFor="ep-buscar-cliente">Buscar cliente</label>
                      <div className="input-group">
                        <span className="input-group-icon"><Icon name="search" size={14} /></span>
                        <input
                          id="ep-buscar-cliente"
                          className="input"
                          placeholder="Nombre, empresa o teléfono…"
                          value={busquedaCliente}
                          onChange={e => setBusquedaCliente(e.target.value)}
                        />
                      </div>
                      <div className="field-hint">
                        {cargandoClientes
                          ? 'Cargando clientes…'
                          : `${clientesConTelefono.length} cliente(s) con teléfono registrado`}
                      </div>
                    </div>

                    <div className="ep-lista-clientes" role="listbox" aria-label="Clientes con teléfono">
                      {cargandoClientes ? (
                        [1, 2, 3, 4].map(i => <div className="skeleton ep-skeleton-fila" key={i} />)
                      ) : clientesFiltrados.length === 0 ? (
                        <div className="empty ep-lista-vacia">
                          <div>{busquedaCliente ? `Sin clientes para "${busquedaCliente}"` : 'Ningún cliente tiene teléfono registrado'}</div>
                        </div>
                      ) : clientesFiltrados.map(c => {
                        const activo = clienteSel?.id === c.id;
                        return (
                          <button
                            key={c.id}
                            role="option"
                            aria-selected={activo}
                            className={`ep-cliente ${activo ? 'activo' : ''}`}
                            onClick={() => setClienteSel(c)}
                          >
                            <div className="ep-cliente-nombre">{c.empresa || c.nombre || `Cliente #${c.id}`}</div>
                            <div className="ep-cliente-datos">
                              <span className="ep-telefono">{epTelefonoLegible(c.telefono)}</span>
                              {c.contacto && <span className="ep-cliente-contacto">· {c.contacto}</span>}
                            </div>
                            {activo && <Icon name="check" size={14} className="ep-cliente-check" />}
                          </button>
                        );
                      })}
                      {!cargandoClientes && clientesFiltrados.length === EP_MAX_CLIENTES_LISTA && (
                        <div className="ep-lista-tope">Se muestran los primeros {EP_MAX_CLIENTES_LISTA}. Afina la búsqueda.</div>
                      )}
                    </div>
                  </>
                )
              ) : (
                <div className="field">
                  <label className="field-label" htmlFor="ep-telefono-nuevo">Número de WhatsApp</label>
                  <input
                    id="ep-telefono-nuevo"
                    className="input"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="8112345678"
                    value={telefonoNuevo}
                    onChange={e => setTelefonoNuevo(e.target.value)}
                  />
                  <div className="field-hint">
                    A 10 dígitos se le antepone la lada {configuracion?.codigo_pais || '52'} automáticamente.
                    Con otra lada, escríbelo completo.
                  </div>
                </div>
              )}

              {destinoValido && (
                <div className="ep-destino-ok">
                  <Icon name="check" size={13} />
                  <span>Se enviará a <strong>{epTelefonoLegible(digitosDestino)}</strong>{clienteSel && modoDestino === 'registrado' ? ` — ${nombreDestino}` : ''}</span>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">2. Plantilla</h3>
              {plantilla && <span className="badge badge-info">{plantilla.categoria}</span>}
            </div>
            <div className="card-body">
              {cargando ? (
                <div className="empty ep-cargando"><span className="spinner" /> Consultando plantillas en Meta…</div>
              ) : errorPlantillas ? (
                <div className="empty ep-error">
                  <div className="empty-icon"><Icon name="alert" /></div>
                  <div>{errorPlantillas}</div>
                  <button className="btn btn-secondary btn-sm" onClick={() => cargarPlantillas({ refrescar: true })}>
                    <Icon name="refresh" size={13} /> Reintentar
                  </button>
                </div>
              ) : plantillas.length === 0 ? (
                <div className="empty">
                  <div className="empty-icon"><Icon name="doc" /></div>
                  <div>No hay plantillas aprobadas en esta cuenta de WhatsApp Business</div>
                  <div className="empty-detail">Créalas y espera su aprobación en el Administrador de WhatsApp de Meta.</div>
                </div>
              ) : (
                <div className="field">
                  <label className="field-label" htmlFor="ep-plantilla">Plantilla aprobada</label>
                  <select
                    id="ep-plantilla"
                    className="select"
                    value={nombrePlantilla}
                    onChange={e => setNombrePlantilla(e.target.value)}
                  >
                    <option value="">— Selecciona una plantilla —</option>
                    {plantillas.map(p => (
                      <option key={`${p.nombre}|${p.idioma}`} value={`${p.nombre}|${p.idioma}`}>
                        {p.nombre} ({p.idioma})
                      </option>
                    ))}
                  </select>
                  <div className="field-hint">{plantillas.length} plantilla(s) aprobada(s) en Meta.</div>
                </div>
              )}
            </div>
          </div>

          {plantilla && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">3. Variables</h3>
                {faltanVariables > 0 && <span className="badge badge-warn">{faltanVariables} sin llenar</span>}
              </div>
              <div className="card-body">
                {indicesEncabezado.length === 0 && indicesCuerpo.length === 0 && !requiereMedia ? (
                  <div className="ep-sin-variables">
                    <Icon name="info" size={14} />
                    <span>Esta plantilla no tiene variables. Se envía tal cual la ves en la vista previa.</span>
                  </div>
                ) : (
                  <>
                    {requiereMedia && (
                      <>
                        <div className="field">
                          <label className="field-label" htmlFor="ep-url-media">
                            URL del {formatoEncabezado === 'IMAGE' ? 'imagen' : formatoEncabezado === 'VIDEO' ? 'video' : 'documento'} del encabezado *
                          </label>
                          <input
                            id="ep-url-media"
                            className="input"
                            type="url"
                            placeholder="https://…"
                            value={urlMedia}
                            onChange={e => setUrlMedia(e.target.value)}
                          />
                          <div className="field-hint">Debe ser una URL pública: Meta la descarga desde sus servidores.</div>
                        </div>
                        {formatoEncabezado === 'DOCUMENT' && (
                          <div className="field">
                            <label className="field-label" htmlFor="ep-nombre-archivo">Nombre del archivo</label>
                            <input
                              id="ep-nombre-archivo"
                              className="input"
                              placeholder="cotizacion.pdf"
                              value={nombreArchivo}
                              onChange={e => setNombreArchivo(e.target.value)}
                            />
                            <div className="field-hint">Es el nombre que ve el cliente al recibirlo.</div>
                          </div>
                        )}
                      </>
                    )}

                    {indicesEncabezado.map(i => (
                      <div className="field" key={`enc-${i}`}>
                        <label className="field-label" htmlFor={`ep-enc-${i}`}>Encabezado · variable {`{{${i}}}`} *</label>
                        <input
                          id={`ep-enc-${i}`}
                          className="input"
                          value={valoresEncabezado[i] || ''}
                          onChange={e => setValoresEncabezado(v => ({ ...v, [i]: e.target.value }))}
                        />
                        <div className="field-hint ep-contexto">{epContextoVariable(textoEncabezado, i)}</div>
                      </div>
                    ))}

                    {indicesCuerpo.map(i => (
                      <div className="field" key={`cue-${i}`}>
                        <label className="field-label" htmlFor={`ep-cue-${i}`}>Variable {`{{${i}}}`} *</label>
                        <input
                          id={`ep-cue-${i}`}
                          className="input"
                          value={valoresCuerpo[i] || ''}
                          onChange={e => setValoresCuerpo(v => ({ ...v, [i]: e.target.value }))}
                        />
                        <div className="field-hint ep-contexto">{epContextoVariable(textoCuerpo, i)}</div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ---------- Columna derecha: vista previa ---------- */}
        <div className="ep-preview">
          <div className="card ep-preview-card">
            <div className="card-header">
              <h3 className="card-title">Vista previa</h3>
              <span className="card-subtitle">Así le llega al cliente</span>
            </div>

            <div className="ep-preview-cuerpo">
              <div className="wa-encabezado-chat">
                <div className="wa-avatar" aria-hidden="true">
                  {(nombreDestino || '?').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="wa-titulo">{modoDestino === 'registrado' && clienteSel ? nombreDestino : 'Destinatario'}</div>
                  <div className="wa-sub">{destinoValido ? epTelefonoLegible(digitosDestino) : 'Sin número seleccionado'}</div>
                </div>
              </div>

              <EPVistaPrevia
                plantilla={plantilla}
                valoresEncabezado={valoresEncabezado}
                valoresCuerpo={valoresCuerpo}
                urlMedia={urlMedia.trim()}
              />
            </div>

            <div className="card-footer ep-preview-footer">
              {!puedeEnviar && (
                <span className="ep-motivo">
                  {!destinoValido ? 'Falta el número de destino'
                    : !plantilla ? 'Falta elegir plantilla'
                    : faltaMedia ? 'Falta la URL del encabezado'
                    : faltanVariables > 0 ? `Faltan ${faltanVariables} variable(s)`
                    : ''}
                </span>
              )}
              <button
                className="btn btn-primary"
                disabled={!puedeEnviar}
                onClick={() => askConfirm(
                  `Se enviará la plantilla "${plantilla?.nombre}" a ${epTelefonoLegible(digitosDestino)}. El mensaje sale de inmediato y no se puede cancelar. ¿Continuar?`,
                  enviar
                )}
              >
                {enviando
                  ? <><span className="spinner" /> Enviando…</>
                  : <><Icon name="send" size={14} /> Enviar plantilla</>}
              </button>
            </div>
          </div>

          {ultimoEnvio && (
            <div className="card ep-ultimo">
              <div className="card-body ep-ultimo-body">
                <Icon name="ok" size={16} />
                <div>
                  <div className="ep-ultimo-titulo">Enviado a +{ultimoEnvio.destino}</div>
                  <div className="ep-ultimo-detalle">
                    {window.fmt.datetime(ultimoEnvio.hora.toISOString())}
                    {ultimoEnvio.id && <> · <code>{ultimoEnvio.id}</code></>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

window.PageEnviarPlantillas = PageEnviarPlantillas;
