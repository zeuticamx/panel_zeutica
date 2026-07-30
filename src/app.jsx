// ===== Zeutica — Main App =====
const { useState: a_uS, useEffect: a_uE, useCallback: a_uC, useMemo: a_uM, useRef: a_uR } = React;

function useLiveNotifs(user) {
  const [notifs, setNotifs] = a_uS([]);

  const fetchNotifs = a_uC(async () => {
    if (!user) { setNotifs([]); return; }
    const data = await window.api.notificaciones(user);
    const mapped = (data || []).map((n, i) => ({
      id: n.id ?? n.notificacion_id ?? i,
      type: n.type || n.tipo || 'info',
      icon: n.icon || n.icono || 'bell',
      title: n.title || n.titulo || n.asunto || 'Notificación',
      msg: n.msg || n.mensaje || n.descripcion || '',
      time: n.time || n.fecha || n.created_at || new Date().toISOString(),
      unread: n.unread ?? (n.leido != null ? !n.leido : true),
    }));
    setNotifs(mapped);
  }, [user]);

  a_uE(() => {
    fetchNotifs();
    const id = setInterval(fetchNotifs, 60000);
    return () => clearInterval(id);
  }, [fetchNotifs]);

  const markAllRead = a_uC(() => {
    setNotifs(prev => {
      const unread = prev.filter(n => n.unread);
      // POST por cada notificación no leída; id numérico esperado por backend.
      unread.forEach(n => { window.api.marcarNotificacionLeida(n.id); });
      return prev.map(n => ({ ...n, unread: false }));
    });
  }, []);
  const unreadCount = notifs.filter(n => n.unread).length;
  return { notifs, unreadCount, markAllRead };
}

// Command Palette
function CommandPalette({ open, onClose, setCurrent, user }) {
  const [q, setQ] = a_uS('');
  const inputRef = a_uR(null);
  a_uE(() => { if (open && inputRef.current) inputRef.current.focus(); }, [open]);
  a_uE(() => {
    const onKey = (e) => { if (e.key === 'Escape' && open) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const items = window.AppShell.NAV
    .filter(n => window.AppShell.canSee(n, user))
    .map(n => ({ type: 'nav', key: n.key, label: `Ir a ${n.label}`, icon: n.icon }));
  const actions = [
    { type: 'action', key: 'new-venta', label: 'Nueva venta', icon: 'plus', nav: 'ventas' },
    { type: 'action', key: 'new-cot',   label: 'Nueva cotización', icon: 'doc', nav: 'cotizaciones' },
    { type: 'action', key: 'new-cli',   label: 'Nuevo cliente', icon: 'users', nav: 'clientes' },
  ];
  const all = [...actions, ...items];
  const filtered = q ? all.filter(i => i.label.toLowerCase().includes(q.toLowerCase())) : all;

  const go = (item) => {
    const target = item.nav || item.key;
    setCurrent(target);
    onClose();
    setQ('');
  };

  return (
    <div className="cmdk-backdrop" onClick={onClose}>
      <div className="cmdk" onClick={e => e.stopPropagation()}>
        <div className="cmdk-head">
          <Icon name="search" size={16}/>
          <input
            ref={inputRef}
            className="cmdk-input"
            placeholder="Buscar comando o navegar..."
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          <kbd className="kbd">ESC</kbd>
        </div>
        <div className="cmdk-list">
          {filtered.length === 0 ? (
            <div className="empty" style={{ padding: 40 }}>Sin resultados para "{q}"</div>
          ) : filtered.map(item => (
            <button key={item.key} className="cmdk-item" onClick={() => go(item)}>
              <Icon name={item.icon} size={14}/>
              <span>{item.label}</span>
              <span className="cmdk-item-kind">{item.type === 'action' ? 'Acción' : 'Navegar'}</span>
            </button>
          ))}
        </div>
        <div className="cmdk-foot">
          <span><kbd className="kbd">↑↓</kbd> navegar</span>
          <span><kbd className="kbd">↵</kbd> seleccionar</span>
        </div>
      </div>
    </div>
  );
}

// Notifications Panel
function NotifPanel({ notifs, markAllRead, onClose }) {
  const panelRef = a_uR(null);
  a_uE(() => {
    const onDoc = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) onClose(); };
    setTimeout(() => document.addEventListener('click', onDoc), 0);
    return () => document.removeEventListener('click', onDoc);
  }, [onClose]);

  const iconBg = {
    success: { bg: 'var(--success-bg)', color: 'var(--success)' },
    warn:    { bg: 'var(--warn-bg)', color: 'var(--warn)' },
    error:   { bg: 'var(--danger-bg)', color: 'var(--danger)' },
    info:    { bg: 'var(--info-bg)', color: 'var(--info)' },
  };

  return (
    <div className="notif-panel" ref={panelRef}>
      <div className="notif-head">
        <div className="notif-head-title">Notificaciones</div>
        <button className="btn btn-ghost btn-sm" onClick={markAllRead}>Marcar todas leídas</button>
      </div>
      <div className="notif-list">
        {notifs.length === 0 ? (
          <div className="empty" style={{ padding: 40 }}>
            <div className="empty-icon"><Icon name="bell"/></div>
            <div>Sin notificaciones</div>
          </div>
        ) : notifs.map(n => {
          const c = iconBg[n.type] || iconBg.info;
          return (
          <div key={n.id} className="notif-item" style={{ background: n.unread ? 'oklch(0.22 0.012 240 / 0.4)' : undefined }}>
            <div className="notif-icon" style={{ background: c.bg, color: c.color }}>
              <Icon name={n.icon} size={14}/>
            </div>
            <div className="notif-body">
              <div className="notif-title">{n.title}</div>
              <div className="notif-msg">{n.msg}</div>
              <div className="notif-time">{window.fmt.relative(n.time.toISOString ? n.time.toISOString() : n.time)}</div>
            </div>
            {n.unread && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand)', marginTop: 10, flexShrink: 0 }}/>}
          </div>
          );
        })}
      </div>
    </div>
  );
}

function App() {
  const [auth, setAuth] = a_uS(() => {
    try { return JSON.parse(localStorage.getItem('zeutica-auth') || 'null'); } catch { return null; }
  });
  const [current, setCurrent] = a_uS(() => localStorage.getItem('zeutica-page') || 'dashboard');
  const [cmdOpen, setCmdOpen] = a_uS(false);
  const [notifOpen, setNotifOpen] = a_uS(false);
  const [mobileMenuOpen, setMobileMenuOpen] = a_uS(false);
  const toast = window.useToast();

  a_uE(() => { if (auth) localStorage.setItem('zeutica-auth', JSON.stringify(auth)); }, [auth]);
  a_uE(() => { localStorage.setItem('zeutica-page', current); }, [current]);
  a_uE(() => { window.api.token = auth?.token ?? null; window.api.id_usuario = auth?.id_usuario ?? null; window.api.usuario = auth?.user ?? null; }, [auth]);
  a_uE(() => { setMobileMenuOpen(false); }, [current]);

  // Cmd+K handler
  a_uE(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(v => !v); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const { notifs, unreadCount, markAllRead } = useLiveNotifs(auth?.id_usuario);

  // Toast on new notif (realtime)
  const prevCountRef = a_uR(notifs.length);
  a_uE(() => {
    if (notifs.length > prevCountRef.current) {
      const latest = notifs[0];
      toast[latest.type === 'error' ? 'error' : latest.type === 'warn' ? 'warn' : latest.type === 'success' ? 'success' : 'info'](latest.title, latest.msg);
    }
    prevCountRef.current = notifs.length;
  }, [notifs.length]);

  // Route guard — if non-gerencia tries to visit restricted page, redirect.
  // IMPORTANT: este hook debe ir antes del early-return para no violar las Rules of Hooks
  const currentItem = window.AppShell.NAV.find(n => n.key === current);
  a_uE(() => {
    if (!auth) return;
    if (currentItem && !window.AppShell.canSee(currentItem, auth.user)) {
      setCurrent('inventario');
      toast.warn('Acceso restringido', 'Solo gerencia puede ver esta sección');
    }
  }, [current, auth?.user]);

  if (!auth) {
    return <window.LoginScreen onLogin={setAuth}/>;
  }

  const logout = () => {
    localStorage.removeItem('zeutica-auth');
    setAuth(null);
    toast.info('Sesión cerrada', 'Hasta pronto');
  };

  const pages = {
    dashboard:    window.PageDashboard,
    acciones_pendientes: window.PageAccionesPendientes,
    clientes_potenciales: window.PageClientesPotenciales,
    promociones_meli: window.PagePromocionesMeli,
    conversaciones_sofi: window.PageConversacionesSofi,
    usuarios:     window.PageUsuarios,
    contrasena:   window.PageContrasena,
    inventario:   window.PageInventario,
    ubicaciones:  window.PageUbicaciones,
    conteo:       window.PageConteo,
    ventas:       window.PageVentas,
    cotizaciones: window.PageCotizaciones,
    clientes:     window.PageClientes,
    reportes:     window.PageReportes,
    full:         window.PageFull,    
    gastos:       window.PageGastos,
    //pendientes:   window.PagePendientes,
    cleanest:     window.PageCleanest,
    compras:      window.PageCompras,
    cobranza:     window.PageCobranza,
    cuentaspagar: window.PageCuentasPagar,
    devoluciones: window.PageDevoluciones,
    registro_ingresos: window.PageRegistroIngresos,
    registro_movimientos: window.PageRegistroMovimientos,
    gerencia:             window.PageGerencia,
  };
  const PageComp = pages[current] || window.PageDashboard;

  return (
    <div className="app" data-screen-label={`app-${current}`}>
      {mobileMenuOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileMenuOpen(false)} aria-hidden="true"/>
      )}
      <window.AppShell.Sidebar
        current={current}
        setCurrent={setCurrent}
        user={auth.user}
        onLogout={logout}
        live={auth.live}
        mobileOpen={mobileMenuOpen}
      />
      <main className="main">
        <window.AppShell.Topbar
          current={current}
          user={auth.user}
          onOpenNotifs={() => setNotifOpen(v => !v)}
          notifCount={unreadCount}
          onCmd={() => setCmdOpen(true)}
          onMenuToggle={() => setMobileMenuOpen(v => !v)}
          setCurrent={setCurrent}
        />
        {notifOpen && (
          <NotifPanel notifs={notifs} markAllRead={markAllRead} onClose={() => setNotifOpen(false)}/>
        )}
        <PageComp key={current} user={auth.user}/>
      </main>
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} setCurrent={setCurrent} user={auth.user}/>
    </div>
  );
}

function Root() {
  return (
    <window.ToastProvider>
      <App/>
    </window.ToastProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root/>);
