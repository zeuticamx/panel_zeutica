// ===== Zeutica — Cambio de Contraseña =====
const { useState: pw_uS } = React;

const PW_RULES = [
  { key: 'len', label: 'Mínimo 8 caracteres', test: (s) => s.length >= 8 },
  { key: 'upper', label: 'Al menos una mayúscula', test: (s) => /[A-ZÁÉÍÓÚÑ]/.test(s) },
  { key: 'num', label: 'Al menos un número', test: (s) => /\d/.test(s) },
];

function passwordValida(s) {
  return PW_RULES.every(r => r.test(s));
}

function CampoPassword({ id, label, value, onChange, autoComplete, autoFocus }) {
  const [show, setShow] = pw_uS(false);
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>{label}</label>
      <div className="input-group">
        <span className="input-group-icon"><Icon name="lock" size={14}/></span>
        <input
          id={id}
          className="input input-lg"
          type={show ? 'text' : 'password'}
          placeholder="••••••••"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          style={{ paddingRight: 40 }}
        />
        <button
          type="button"
          className="login-pw-toggle"
          onClick={() => setShow(v => !v)}
          aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          <Icon name="eye" size={14}/>
        </button>
      </div>
    </div>
  );
}

function PageContrasena({ user }) {
  const toast = window.useToast();
  const [paso, setPaso] = pw_uS(1); // 1: verificar actual, 2: nueva contraseña
  const [actual, setActual] = pw_uS('');
  const [nueva, setNueva] = pw_uS('');
  const [confirmar, setConfirmar] = pw_uS('');
  const [loading, setLoading] = pw_uS(false);
  const [err, setErr] = pw_uS('');

  const verificarActual = async (e) => {
    e.preventDefault();
    if (!actual) { setErr('Ingresa tu contraseña actual'); return; }
    setErr(''); setLoading(true);
    const res = await window.api.login(user, actual);
    setLoading(false);
    if (res.ok) {
      toast.success('Contraseña verificada', 'Ahora ingresa tu nueva contraseña');
      setPaso(2);
    } else {
      setErr(res.error || 'Contraseña incorrecta');
    }
  };

  const guardarNueva = async (e) => {
    e.preventDefault();
    if (!passwordValida(nueva)) { setErr('La contraseña no cumple los requisitos'); return; }
    if (nueva !== confirmar) { setErr('Las contraseñas no coinciden'); return; }
    if (nueva === actual) { setErr('La nueva contraseña debe ser diferente a la actual'); return; }
    setErr(''); setLoading(true);
    const r = await window.api.cambiarPassword(user, nueva);
    setLoading(false);
    if (r.ok) {
      toast.success('Contraseña actualizada', 'Usa tu nueva contraseña en el próximo inicio de sesión');
      window.fireConfetti();
      setPaso(1); setActual(''); setNueva(''); setConfirmar('');
    } else {
      toast.error('Error al actualizar', r.error);
    }
  };

  return (
    <div className="page">
      <section className="card" style={{ maxWidth: 480, margin: '24px auto' }}>
        <div className="card-header">
          <div>
            <h2 className="card-title">¿Deseas cambiar tu contraseña?</h2>
            <p className="section-subtitle" style={{ marginTop: 4 }}>
              {paso === 1
                ? `Primero confirma tu contraseña actual, ${user}.`
                : 'Ingresa y confirma tu nueva contraseña.'}
            </p>
          </div>
        </div>

        {paso === 1 ? (
          <form onSubmit={verificarActual}>
            <div className="card-body">
              <CampoPassword
                id="pw-actual"
                label="Contraseña actual"
                value={actual}
                onChange={setActual}
                autoComplete="current-password"
                autoFocus
              />
              {err && (
                <div className="login-error" role="alert">
                  <Icon name="alert" size={14}/>
                  <span>{err}</span>
                </div>
              )}
            </div>
            <div className="card-footer">
              <button className="btn btn-primary" type="submit" disabled={loading || !actual}>
                {loading
                  ? <><span className="spinner"/> Verificando...</>
                  : <>Verificar <Icon name="chevRight" size={14}/></>}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={guardarNueva}>
            <div className="card-body">
              <CampoPassword
                id="pw-nueva"
                label="Nueva contraseña"
                value={nueva}
                onChange={(v) => { setNueva(v); setErr(''); }}
                autoComplete="new-password"
                autoFocus
              />
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px', display: 'grid', gap: 4 }}>
                {PW_RULES.map(r => {
                  const ok = r.test(nueva);
                  return (
                    <li key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: ok ? 'var(--success)' : 'var(--fg-3)' }}>
                      <Icon name={ok ? 'check' : 'clock'} size={12}/> {r.label}
                    </li>
                  );
                })}
              </ul>
              <CampoPassword
                id="pw-confirmar"
                label="Confirmar nueva contraseña"
                value={confirmar}
                onChange={(v) => { setConfirmar(v); setErr(''); }}
                autoComplete="new-password"
              />
              {err && (
                <div className="login-error" role="alert">
                  <Icon name="alert" size={14}/>
                  <span>{err}</span>
                </div>
              )}
            </div>
            <div className="card-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setPaso(1); setNueva(''); setConfirmar(''); setErr(''); }}
              >
                Volver
              </button>
              <button
                className="btn btn-primary"
                type="submit"
                disabled={loading || !passwordValida(nueva) || nueva !== confirmar}
              >
                {loading
                  ? <><span className="spinner"/> Guardando...</>
                  : <><Icon name="check" size={14}/> Cambiar contraseña</>}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

window.PageContrasena = PageContrasena;
