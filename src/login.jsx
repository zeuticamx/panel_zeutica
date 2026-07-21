// ===== Zeutica — Login Screen =====
const { useState: useStateL } = React;

function LoginScreen({ onLogin }) {
  const toast = window.useToast();
  const [u, setU] = useStateL('');
  const [p, setP] = useStateL('');
  const [loading, setLoading] = useStateL(false);
  const [err, setErr] = useStateL('');
  const [showPw, setShowPw] = useStateL(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!u || !p) { setErr('Completa ambos campos'); return; }
    setErr(''); setLoading(true);
    const res = await window.api.login(u, p);
    setLoading(false);
    if (res.ok) {
      toast.success('Bienvenido', res.live ? 'Sesión iniciada en producción' : 'Sesión iniciada (modo demo)');
      onLogin({ user: res.user, token: res.token, id_usuario: res.id_usuario, live: res.live });
    } else {
      setErr(res.error || 'Error de autenticación');
    }
  };

  const quickFill = (user) => { setU(user); setP(user); };

  return (
    <div className="login-wrap">
      {/* Decorative BG */}
      <div className="login-bg">
        <div className="login-orb login-orb-1" />
        <div className="login-orb login-orb-2" />
        <svg className="login-grid" width="100%" height="100%">
          <defs>
            <pattern id="gridpat" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M 48 0 L 0 0 0 48" fill="none" stroke="oklch(0.3 0.01 240 / 0.3)" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#gridpat)"/>
        </svg>
      </div>

      {/* Left — Brand panel */}
      <aside className="login-brand">
        <div className="login-brand-middle">
          <h1 className="login-headline">
            Sistema de control operativo<br/>
            y administracion.
          </h1>
          <p className="login-subhead">
            El sistema operativo de Zeutica para gerencia y equipo comercial.
            Métricas vivas, cartera sana, decisiones rápidas.
          </p>

          <div className="login-features">
            <div className="login-feat">
              <div className="login-feat-icon"><Icon name="zap" size={14}/></div>
              <div>
                <div className="login-feat-title">Tiempo real</div>
                <div className="login-feat-desc">KPIs del mes al instante</div>
              </div>
            </div>
            <div className="login-feat">
              <div className="login-feat-icon"><Icon name="lock" size={14}/></div>
              <div>
                <div className="login-feat-title">Acceso por rol</div>
                <div className="login-feat-desc">Permisos granulares</div>
              </div>
            </div>
            <div className="login-feat">
              <div className="login-feat-icon"><Icon name="trend" size={14}/></div>
              <div>
                <div className="login-feat-title">Visualización clara</div>
                <div className="login-feat-desc">Análisis accionable</div>
              </div>
            </div>
          </div>

        </div>

        <div className="login-brand-bottom">
          <div className="login-status">
            <span className="login-status-dot"/>
            <span>v3.2 · {new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
          </div>
        </div>
      </aside>

      {/* Right — Form */}
      <main className="login-form-wrap">
        <form className="login-form slide-up" onSubmit={handleSubmit}>
          <div className="login-logo" style={{ marginBottom: 8 }}>
            <img src="imagenes/logo.webp" alt="Zeutica" className="login-logo-img" />
          </div>
          <div className="login-form-head">
            <h2 className="login-form-title">Iniciar sesión</h2>
            <p className="login-form-sub">Bienvenido de nuevo. Ingresa tus credenciales para continuar.</p>
          </div>

          <div className="field">
            <label className="field-label">Usuario</label>
            <div className="input-group">
              <span className="input-group-icon"><Icon name="user" size={14}/></span>
              <input
                className="input input-lg"
                type="text"
                placeholder="tu.usuario"
                value={u}
                onChange={(e) => setU(e.target.value.toLowerCase())}
                autoFocus
                autoComplete="username"
              />
            </div>
          </div>

          <div className="field">
            <div className="login-pw-label">
              <label className="field-label">Contraseña</label>
              <a className="login-link" onClick={(e) => { e.preventDefault(); toast.info('Contacta a TI', 'fernandoparrav@outlook.com'); }}>¿Olvidaste tu contraseña?</a>
            </div>
            <div className="input-group">
              <span className="input-group-icon"><Icon name="lock" size={14}/></span>
              <input
                className="input input-lg"
                type={showPw ? 'text' : 'password'}
                placeholder="••••••••"
                value={p}
                onChange={(e) => setP(e.target.value)}
                autoComplete="current-password"
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                className="login-pw-toggle"
                onClick={() => setShowPw(v => !v)}
              >
                <Icon name="eye" size={14}/>
              </button>
            </div>
          </div>

          {err && (
            <div className="login-error">
              <Icon name="alert" size={14}/>
              <span>{err}</span>
            </div>
          )}

          <button className="btn btn-primary btn-lg login-submit" type="submit" disabled={loading}>
            {loading ? <><span className="spinner"/> Autenticando...</> : <>Entrar <Icon name="chevRight" size={14}/></>}
          </button>

          <div className="login-divider"><span>o prueba con</span></div>

          <div className="login-demo">
            <button type="button" className="login-demo-btn" onClick={() => quickFill('gerencia')}>
              <div className="login-demo-avatar" style={{ background: 'oklch(0.38 0.15 255)' }}>G</div>
              <div className="login-demo-body">
                <div className="login-demo-name">gerencia</div>
                <div className="login-demo-role">Acceso completo</div>
              </div>
            </button>
            <button type="button" className="login-demo-btn" onClick={() => quickFill('vendedor')}>
              <div className="login-demo-avatar" style={{ background: 'oklch(0.42 0.14 155)' }}>V</div>
              <div className="login-demo-body">
                <div className="login-demo-name">vendedor</div>
                <div className="login-demo-role">Operaciones</div>
              </div>
            </button>
          </div>

          <div className="login-foot">
            <span>¿Problemas para acceder?</span>
            <a className="login-link">Contacta a TI</a>
          </div>
        </form>
      </main>
    </div>
  );
}

window.LoginScreen = LoginScreen;
