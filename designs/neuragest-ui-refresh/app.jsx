/* Interactive explorer — 3 directions × auth + all nav modules */
const { useState, useEffect, useRef } = React;

const DIRS = [
  { id: 'a', label: 'A · Graphite · Accordion', short: 'A' },
  { id: 'b', label: 'B · Amethyst · Rail+flyout', short: 'B' },
  { id: 'c', label: 'C · Lattice · Top+side', short: 'C' },
];

const MODULE_IDS = MODULE_SCREENS.map((s) => s.id);
const AUTH_IDS = AUTH_SCREENS.map((s) => s.id);

function readParam(key, fallback) {
  try {
    const v = new URLSearchParams(location.search).get(key);
    return v || fallback;
  } catch {
    return fallback;
  }
}

function writeParams(dir, screen) {
  try {
    const u = new URL(location.href);
    u.searchParams.set('dir', dir);
    u.searchParams.set('screen', screen);
    history.replaceState(null, '', u);
  } catch { /* ignore */ }
}

function isModule(id) {
  return MODULE_IDS.includes(id);
}

function App() {
  const [dir, setDir] = useState(() => {
    const d = readParam('dir', 'a');
    return ['a', 'b', 'c'].includes(d) ? d : 'a';
  });
  const [screen, setScreen] = useState(() => {
    const s = readParam('screen', 'login');
    if (AUTH_IDS.includes(s) || MODULE_IDS.includes(s) || s === 'shell') return s === 'shell' ? 'dash' : s;
    return 'login';
  });
  const [phase, setPhase] = useState('idle');
  const [collapsed, setCollapsed] = useState(false);
  const [tweaks, setTweaks] = useState(true);
  const timerRef = useRef(null);

  const activeNav = isModule(screen) ? screen : 'dash';
  const showingShell = isModule(screen);

  useEffect(() => {
    writeParams(dir, screen);
  }, [dir, screen]);

  useEffect(() => {
    document.documentElement.setAttribute('data-dir', dir);
  }, [dir]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function goScreen(id) {
    clearTimer();
    setScreen(id);
    if (id === 'login') setPhase('idle');
    if (id === 'waiting') setPhase('waiting');
    if (isModule(id)) setPhase('idle');
  }

  function startLogin() {
    clearTimer();
    setScreen('login');
    setPhase('opening');
    timerRef.current = setTimeout(() => {
      setPhase('waiting');
      timerRef.current = setTimeout(() => {
        setPhase('success');
        timerRef.current = setTimeout(() => {
          setPhase('idle');
          setScreen('dash');
        }, 900);
      }, 1600);
    }, 700);
  }

  function cancelOAuth() {
    clearTimer();
    setPhase('idle');
  }

  function forceError() {
    clearTimer();
    setPhase('error');
    setScreen('login');
  }

  let body = null;
  if (screen === 'norole') {
    body = <NoRoleScreen dir={dir} onLogout={() => goScreen('login')} />;
  } else if (showingShell) {
    body = (
      <ShellScreen
        dir={dir}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        activeNav={activeNav}
        setActiveNav={goScreen}
      />
    );
  } else if (screen === 'waiting') {
    body = (
      <LoginScreen
        dir={dir}
        phase={phase === 'idle' ? 'waiting' : phase}
        onStart={startLogin}
        onCancel={cancelOAuth}
        onRetry={startLogin}
      />
    );
  } else {
    body = (
      <LoginScreen
        dir={dir}
        phase={phase}
        onStart={startLogin}
        onCancel={cancelOAuth}
        onRetry={startLogin}
      />
    );
  }

  return (
    <div className="ng-root" data-dir={dir}>
      {body}

      {tweaks && (
        <div className="explorer-bar" role="toolbar" aria-label="Explorador de direcciones">
          <div className="seg" aria-label="Dirección">
            {DIRS.map((d) => (
              <button
                key={d.id}
                type="button"
                className={dir === d.id ? 'on' : ''}
                onClick={() => setDir(d.id)}
              >
                {d.short}
              </button>
            ))}
          </div>
          <div className="seg" aria-label="Auth">
            {AUTH_SCREENS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={screen === s.id ? 'on' : ''}
                onClick={() => goScreen(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <label className="explorer-select">
            <span>Módulo</span>
            <select
              value={showingShell ? screen : ''}
              onChange={(e) => {
                if (e.target.value) goScreen(e.target.value);
              }}
              aria-label="Apartado del nav"
            >
              <option value="" disabled>
                — Elegir apartado —
              </option>
              {NAV_SECTIONS.map((sec) => (
                <optgroup key={sec.title} label={sec.title}>
                  {sec.items.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </optgroup>
              ))}
              <optgroup label="Sistema">
                <option value={SETTINGS_NAV.id}>{SETTINGS_NAV.label}</option>
              </optgroup>
            </select>
          </label>
          {screen === 'login' && phase === 'idle' && (
            <button type="button" className="seg" style={{ padding: 0 }} onClick={forceError}>
              <span style={{ padding: '7px 10px', fontSize: 11, fontWeight: 600, color: '#f87171' }}>Simular error</span>
            </button>
          )}
          {showingShell && (
            <button
              type="button"
              className={collapsed ? 'on' : ''}
              onClick={() => setCollapsed((c) => !c)}
              title="Alternar nav colapsada"
              style={{ border: '1px solid #2a2a30', background: collapsed ? '#27272a' : 'transparent', color: '#e4e4e7', borderRadius: 8, padding: '7px 10px', fontSize: 11, fontWeight: 600 }}
            >
              {collapsed ? 'Nav · rail' : 'Nav · expandida'}
            </button>
          )}
          <span className="hint">
            {DIRS.find((d) => d.id === dir)?.label}
            {dir === 'a' && showingShell ? ' · Accordion' : ''}
            {dir === 'b' && showingShell ? ' · Rail+flyout' : ''}
            {dir === 'c' && showingShell ? ' · Top+side' : ''}
            {showingShell ? ` · ${PAGE_META[screen]?.title || screen}` : ''}
          </span>
          <button
            type="button"
            onClick={() => setTweaks(false)}
            style={{ border: 0, background: 'transparent', color: '#71717a', fontSize: 11, padding: '4px 6px' }}
          >
            Ocultar
          </button>
        </div>
      )}

      {!tweaks && (
        <button
          type="button"
          onClick={() => setTweaks(true)}
          style={{
            position: 'fixed', bottom: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 100,
            border: '1px solid #2a2a30', background: 'rgba(12,12,14,.92)', color: '#e4e4e7',
            borderRadius: 999, padding: '8px 14px', fontSize: 11, fontWeight: 600,
          }}
        >
          Tweaks
        </button>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
