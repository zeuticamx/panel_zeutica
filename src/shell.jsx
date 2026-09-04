// ===== Zeutica — App Shell (Sidebar + Topbar + Routing) =====
const { useState: uS, useEffect: uE, useMemo: uM, useCallback: uC, useRef: uR } = React;

const NAV = [
  { key: 'dashboard',    label: 'Dashboard',        icon: 'dashboard', gerencia: true },
  { key: 'acciones_pendientes', label: 'Pendientes', icon: 'clock' },
  { key: 'clientes_potenciales', label: 'Clientes Potenciales', icon: 'users' },
  { key: 'promociones_meli', label: 'Promociones Meli', icon: 'tag' },
  { key: 'conversaciones_sofi', label: 'Conversaciones Sofi', icon: 'chat' },
  { key: 'enviar_plantillas', label: 'Enviar Plantillas', icon: 'send' },
  { key: 'inventario',   label: 'Inventario',       icon: 'box' },
  { key: 'ubicaciones',  label: 'Ubicaciones',      icon: 'building' },
  { key: 'conteo',       label: 'Conteo de Inv.',   icon: 'ok' },
  { key: 'ventas',       label: 'Ventas',           icon: 'cash' },
  { key: 'cotizaciones', label: 'Cotizaciones',     icon: 'doc' },
  { key: 'clientes',     label: 'Clientes',         icon: 'users' },
  { key: 'reportes',     label: 'Reportes',         icon: 'chart' },
  { key: 'full',         label: 'Traspaso FULL',    icon: 'transfer' },  
  { key: 'gastos',       label: 'Gastos Operativos',icon: 'wallet' },
  { key: 'devoluciones',  label: 'Devoluciones',     icon: 'refresh' },
  { key: 'embarques',    label: 'Rastreo Importaciones', icon: 'pkg' },
  //{ key: 'pendientes',   label: 'Cuentas Pendientes',icon: 'clock', gerencia: true },
  { key: 'cleanest',     label: 'CleanestChoice',   icon: 'stars' },
  { key: 'compras',      label: 'Compras',          icon: 'cart', gerencia: true },
  { key: 'cobranza',     label: 'Monitor Cobranza', icon: 'eye' },
  { key: 'cuentaspagar', label: 'Cuentas por Pagar',icon: 'cash', gerencia: true },
  { key: 'usuarios',    label: 'Usuarios',         icon: 'users', gerencia: true },
  { key: 'contrasena',  label: 'Contraseña',       icon: 'lock' },  
  { key: 'registro_ingresos',  label: 'Registro de ingresos',       icon: 'login', gerencia: true },
  { key: 'registro_movimientos',  label: 'Registro de movimientos',       icon: 'login', gerencia: true },
  { key: 'gerencia',             label: 'Monitor Gerencia',             icon: 'chart', gerencia: true },
];

const GERENCIA_USERS = ['gerencia', 'fparra'];

function canSee(item, user) {
  if (!item.gerencia) return true;
  return GERENCIA_USERS.includes(user);
}

function Sidebar({ current, setCurrent, user, onLogout, live, mobileOpen }) {
  const toast = window.useToast();
  return (
    <aside className={`sidebar${mobileOpen ? ' mobile-open' : ''}`}>
      <div className="sidebar-head">
        <div className="sidebar-brand">
          <img src="imagenes/logo.webp" alt="Zeutica" className="sidebar-logo-img" />
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section">General</div>
        {NAV.slice(0, 6).map((n) => (
          <NavItem key={n.key} item={n} active={current === n.key} onClick={() => setCurrent(n.key)} canSee={canSee(n, user)} onBlock={() => toast.warn('Acceso restringido', 'Solo gerencia puede ver esta sección')}/>
        ))}
        <div className="sidebar-section">Operación</div>
        {NAV.slice(6, 17).map((n) => (
          <NavItem key={n.key} item={n} active={current === n.key} onClick={() => setCurrent(n.key)} canSee={canSee(n, user)} onBlock={() => toast.warn('Acceso restringido', 'Solo gerencia puede ver esta sección')}/>
        ))}
        <div className="sidebar-section">Finanzas</div>
        {NAV.slice(17, 21).map((n) => (
          <NavItem key={n.key} item={n} active={current === n.key} onClick={() => setCurrent(n.key)} canSee={canSee(n, user)} onBlock={() => toast.warn('Acceso restringido', 'Solo gerencia puede ver esta sección')}/>
        ))}
      </nav>

      <div className="sidebar-foot">
        <div className="sidebar-status">
          <span className={`sidebar-status-dot ${live ? 'ok' : 'mock'}`}/>
          <span className="sidebar-status-text">{live ? 'Servidor activo' : 'Modo demo'}</span>
        </div>
        <div className="sidebar-user" onClick={onLogout}>
          <div className="sidebar-avatar">{(user || '?').slice(0,2).toUpperCase()}</div>
          <div className="sidebar-user-body">
            <div className="sidebar-user-name">{user}</div>
            <div className="sidebar-user-role">{GERENCIA_USERS.includes(user) ? 'Administrador' : 'Operaciones'}</div>
          </div>
          <Icon name="logout" size={14}/>
        </div>
      </div>
    </aside>
  );
}

function NavItem({ item, active, onClick, canSee, onBlock }) {
  if (!canSee) {
    return (
      <button className="nav-item nav-item-locked" onClick={onBlock} title="Solo gerencia">
        <Icon name={item.icon} size={15}/>
        <span>{item.label}</span>
        <Icon name="lock" size={12} className="nav-lock"/>
      </button>
    );
  }
  return (
    <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>
      <Icon name={item.icon} size={15}/>
      <span>{item.label}</span>
    </button>
  );
}

function Topbar({ current, user, onOpenNotifs, notifCount, onCmd, onMenuToggle, setCurrent }) {
  const pageLabel = NAV.find(n => n.key === current)?.label || '';
  const [menuOpen, setMenuOpen] = uS(false);
  const menuRef = uR(null);

  uE(() => {
    if (!menuOpen) return;
    const onDoc = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    setTimeout(() => document.addEventListener('click', onDoc), 0);
    return () => document.removeEventListener('click', onDoc);
  }, [menuOpen]);

  const goTo = (key) => { setCurrent(key); setMenuOpen(false); };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="btn btn-ghost btn-icon topbar-menu-btn" onClick={onMenuToggle} aria-label="Abrir menú">
          <Icon name="menu" size={18}/>
        </button>
        <h1 className="topbar-title">{pageLabel}</h1>
        <span className="topbar-crumb">
          <Icon name="chevRight" size={12}/>
          <span>{new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        </span>
      </div>
      <div className="topbar-right">
        <button className="topbar-search" onClick={onCmd}>
          <Icon name="search" size={14}/>
          <span>Buscar productos, clientes, ventas…</span>
          <kbd className="kbd">⌘K</kbd>
        </button>
        <button className="btn btn-ghost btn-icon topbar-icon-btn" onClick={onCmd} aria-label="Buscar" title="Buscar (móvil)">
          <Icon name="search" size={16}/>
        </button>
        <button className="btn btn-ghost btn-icon topbar-icon-btn" onClick={onOpenNotifs}>
          <Icon name="bell" size={16}/>
          {notifCount > 0 && <span className="topbar-badge">{notifCount}</span>}
        </button>
        <div style={{ position: 'relative' }} ref={menuRef}>
          <button className="btn btn-ghost btn-icon topbar-icon-btn" onClick={() => setMenuOpen(v => !v)} aria-label="Menú admin">
            <Icon name="menu" size={16}/>
          </button>
          {menuOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              background: 'var(--bg-1)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '4px 0', minWidth: 160, zIndex: 200,
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
            }}>
              <button
                onClick={() => goTo('usuarios')}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-1)', fontSize: 13 }}
              >
                <Icon name="users" size={14}/> Usuarios
              </button>
              <button
                onClick={() => goTo('contrasena')}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-1)', fontSize: 13 }}
              >
                <Icon name="lock" size={14}/> Contraseña
              </button>              
              <button
                onClick={() => goTo('registro_ingresos')}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-1)', fontSize: 12 }}
              >
                <Icon name="user" size={14}/> Registro ingresos
              </button>
              <button
                onClick={() => goTo('registro_movimientos')}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-1)', fontSize: 10 }}
              >
                <Icon name="lock" size={14}/> Registro Movimientos
              </button>
              <button
                onClick={() => goTo('gerencia')}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-1)', fontSize: 12 }}
              >
                <Icon name="chart" size={14}/> Monitor Gerencia
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

window.AppShell = { NAV, Sidebar, Topbar, canSee, GERENCIA_USERS };
