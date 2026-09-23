/* Screen components for NeuraGest UI refresh prototype */
const LOGO = 'assets/neuralive-logotype.png';

function LoginScreen({ dir, phase, onStart, onCancel, onRetry }) {
  const showWait = phase !== 'idle';
  const brand = (
    <>
      <img src={LOGO} alt="NeuraGest by NeuraLive" className="ng-logo" draggable={false} />
      {dir === 'b' && (
        <div>
          <span className="ng-overline">NeuraLive · Ops</span>
          <h1>Control de talentos, sin ruido visual</h1>
          <p className="ng-auth-copy">
            Una lectura más limpia del magenta Neura: acento preciso, superficies calmadas,
            lista para jornadas largas de operaciones.
          </p>
        </div>
      )}
      {dir === 'b' && (
        <footer className="ng-auth-footer">NeuraLive · Gestión profesional de talentos</footer>
      )}
    </>
  );

  const form = (
    <>
      {dir !== 'b' && <img src={LOGO} alt="NeuraGest by NeuraLive" className="ng-logo" draggable={false} />}
      <div className="ng-auth-hero" data-screen-label={`login-${dir}`}>
        <span className="ng-overline">
          {dir === 'c' ? 'AUTH · TWITCH OAUTH' : 'CENTRO DE OPERACIONES TWITCH'}
        </span>
        <h1>
          {dir === 'a' && 'Gestiona talentos con precisión'}
          {dir === 'b' && 'Entra al panel'}
          {dir === 'c' && 'Iniciar sesión'}
        </h1>
        {dir !== 'b' && (
          <p className="ng-auth-copy">
            {dir === 'a'
              ? 'Inicia sesión con Twitch para acceder a operaciones, analítica y gestión de agencia.'
              : 'Sesión segura vía Twitch. El shell se restaura en este equipo al reabrir la app.'}
          </p>
        )}
      </div>

      {!showWait ? (
        <div className="ng-auth-cta">
          <button type="button" className="ng-btn ng-btn-twitch" onClick={onStart}>
            <I.Radio size={17} />
            Continuar con Twitch
          </button>
          <p className="ng-note">
            NeuraGest guarda la sesión en este equipo. Ejecuta la app de escritorio para autenticarte.
          </p>
        </div>
      ) : (
        <WaitingPanel phase={phase} onCancel={onCancel} onRetry={onRetry} />
      )}

      {dir !== 'b' && (
        <footer className="ng-auth-footer">NeuraLive · Gestión profesional de talentos</footer>
      )}
    </>
  );

  if (dir === 'b') {
    return (
      <div className="ng-auth" data-screen-label="auth-b">
        <div className="ng-auth-card">
          <div className="ng-auth-brand-pane">{brand}</div>
          <div className="ng-auth-form-pane">{form}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="ng-auth" data-screen-label={`auth-${dir}`}>
      <div className="ng-auth-card">{form}</div>
    </div>
  );
}

function WaitingPanel({ phase, onCancel, onRetry }) {
  if (phase === 'error') {
    return (
      <div className="ng-wait ng-error" data-screen-label="oauth-error">
        <div className="ng-badge"><I.X size={18} /></div>
        <b>No se pudo completar la autorización</b>
        <p>Intenta de nuevo o vuelve al login.</p>
        <div className="ng-wait-actions">
          <button type="button" className="ng-btn ng-btn-twitch" onClick={onRetry}>
            <I.Radio size={16} /> Reintentar
          </button>
          <button type="button" className="ng-btn ng-btn-ghost" onClick={onCancel}>Volver</button>
        </div>
      </div>
    );
  }
  if (phase === 'success') {
    return (
      <div className="ng-wait ng-success" data-screen-label="oauth-success">
        <div className="ng-badge"><I.Check size={18} /></div>
        <b>Sesión iniciada</b>
        <p>Entrando al panel de operaciones…</p>
      </div>
    );
  }
  return (
    <div className="ng-wait" data-screen-label="oauth-waiting">
      <div className="ng-wait-head">
        <span>Autoriza NeuraGest con Twitch</span>
        <small>Se abrió tu navegador</small>
      </div>
      <p>Inicia sesión en Twitch y autoriza NeuraGest. Cuando termines, volverás aquí automáticamente.</p>
      <div className="ng-wait-actions">
        <button type="button" className="ng-btn ng-btn-twitch" disabled>
          <I.External size={15} /> Esperando autorización…
        </button>
        {(phase === 'opening' || phase === 'waiting') && (
          <button type="button" className="ng-btn ng-btn-ghost" onClick={onCancel}>Cancelar</button>
        )}
      </div>
      <div className="ng-wait-status">
        <div className="ng-spin" />
        <span>
          {phase === 'opening'
            ? 'Preparando inicio de sesión seguro…'
            : 'Esperando que completes la autorización…'}
        </span>
      </div>
    </div>
  );
}

function NoRoleScreen({ dir, onLogout }) {
  return (
    <div className="ng-auth" data-screen-label={`norole-${dir}`}>
      <div className="ng-auth-card" style={dir === 'b' ? { width: 'min(480px,100%)', display: 'block', padding: '32px 28px' } : undefined}>
        <img src={LOGO} alt="NeuraGest" className="ng-logo" draggable={false} />
        <div className="ng-icon-ring"><I.Clock size={24} stroke={1.5} /></div>
        <span className="ng-overline">CUENTA EN REVISIÓN</span>
        <h1>Tu acceso está en camino</h1>
        <p className="ng-auth-copy">
          Hola, Maya. Tu cuenta ya está vinculada, pero aún no tienes un rol asignado en NeuraGest.
        </p>
        <p className="ng-note" style={{ marginTop: 0, marginBottom: 8 }}>
          El equipo configurará tus permisos pronto. Cuando te asignen un rol, verás las secciones de tu trabajo.
        </p>
        <div className="ng-session">
          <div className="ng-avatar">MA</div>
          <div>
            <b>Maya Ortega</b>
            <span>@mayaops</span>
          </div>
        </div>
        <button type="button" className="ng-btn ng-btn-ghost" style={{ width: '100%' }} onClick={onLogout}>
          <I.LogOut size={15} /> Cerrar sesión
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { LoginScreen, WaitingPanel, NoRoleScreen });
