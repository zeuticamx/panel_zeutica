// ===== Zeutica — Toast Notification System =====
const { useState, useEffect, useCallback, useRef, useMemo } = React;

const ToastContext = React.createContext(null);
window.useToast = () => React.useContext(ToastContext);

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const push = useCallback((t) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, ...t }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, t.duration || 4500);
  }, []);

  const remove = useCallback((id) => setToasts((prev) => prev.filter((x) => x.id !== id)), []);

  const ctx = useMemo(() => ({
    success: (title, msg, duration) => push({ type: 'success', title, msg, duration }),
    // Los errores traen el mensaje del servidor: se dejan más tiempo en pantalla
    // porque hay que leerlos, no solo verlos pasar.
    error:   (title, msg, duration) => push({ type: 'error',   title, msg, duration: duration || 10000 }),
    warn:    (title, msg, duration) => push({ type: 'warn',    title, msg, duration }),
    info:    (title, msg, duration) => push({ type: 'info',    title, msg, duration }),
  }), [push]);

  const iconFor = { success: 'ok', error: 'alert', warn: 'alert', info: 'info' };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            <div className="toast-icon"><Icon name={iconFor[t.type]} size={16}/></div>
            <div className="toast-body">
              <div className="toast-title">{t.title}</div>
              {t.msg && <div className="toast-msg">{t.msg}</div>}
            </div>
            <button className="toast-close" onClick={() => remove(t.id)}>
              <Icon name="x" size={14}/>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

window.ToastProvider = ToastProvider;
