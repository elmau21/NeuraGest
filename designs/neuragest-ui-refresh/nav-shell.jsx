/* Three distinct nav patterns for NeuraGest A / B / C */
const { useState, useEffect, useRef } = React;

const LOGO_SRC = 'assets/neuralive-logotype.png';

function NavBrandMark() {
  return <div className="ng-mark" aria-hidden>NG</div>;
}

function NavIcon({ name, size = 16 }) {
  const Cmp = (I && I[name]) || (I && I.Layout);
  return Cmp ? <Cmp size={size} /> : null;
}

function NavFoot({ collapsed }) {
  return (
    <div className="ng-aside-foot">
      <div className="ng-dot" />
      {!collapsed && (
        <span>
          Twitch conectado
          <small style={{ display: 'block', opacity: 0.7 }}>Monitoreo + caché local</small>
        </span>
      )}
    </div>
  );
}

function MainChrome({ activeNav, dir, children, topExtra }) {
  return (
    <div className="ng-main">
      <header className="ng-top">
        {topExtra}
        <div className="ng-search">
          <I.Search size={14} />
          <span>Buscar talentos, tareas…</span>
          <kbd>⌘K</kbd>
        </div>
        <div className="ng-top-actions">
          <button type="button" className="ng-icon-btn" aria-label="Notificaciones">
            <I.Bell size={16} />
          </button>
          <div className="ng-avatar" title="Maya Ortega">MA</div>
        </div>
      </header>
      {children || <ModulePage id={activeNav} dir={dir} />}
    </div>
  );
}

/* ─── A · Accordion rail (sections collapsible + labels) ─────────────── */
function NavA({ collapsed, onToggle, activeNav, setActiveNav }) {
  const activeSec = findNavSection(activeNav);
  const [openIds, setOpenIds] = useState(() => new Set([activeSec.id]));
  const [peekId, setPeekId] = useState(null);

  useEffect(() => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      next.add(findNavSection(activeNav).id);
      return next;
    });
  }, [activeNav]);

  function toggleSection(id) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSections = [...NAV_SECTIONS, SISTEMA_SECTION];
  const peekSec = peekId ? allSections.find((s) => s.id === peekId) : null;

  return (
    <>
      <aside className={`ng-aside nav-a${collapsed ? ' is-rail' : ''}`}>
        <div className="ng-aside-brand">
          {!collapsed && <img src={LOGO_SRC} alt="NeuraGest" draggable={false} />}
          {collapsed && <NavBrandMark />}
        </div>
        <button type="button" className="ng-collapse" onClick={onToggle} aria-label={collapsed ? 'Expandir' : 'Colapsar'}>
          {collapsed ? <I.ChevronR size={14} /> : <I.ChevronL size={14} />}
        </button>

        {!collapsed ? (
          <nav className="ng-nav nav-a-list" aria-label="Navegación">
            {allSections.map((section) => {
              const open = openIds.has(section.id);
              const SecIcon = I[section.icon] || I.Layout;
              const hasActive = section.items.some((i) => i.id === activeNav);
              return (
                <div key={section.id} className={`nav-acc${hasActive ? ' has-active' : ''}${open ? ' is-open' : ''}`}>
                  <button
                    type="button"
                    className="nav-acc-head"
                    onClick={() => toggleSection(section.id)}
                    aria-expanded={open}
                  >
                    <SecIcon size={15} />
                    <span className="nav-acc-title">{section.title}</span>
                    <span className="nav-acc-count">{section.items.length}</span>
                    <span className={`nav-acc-chev${open ? ' open' : ''}`}><I.ChevronD size={12} /></span>
                  </button>
                  {open && (
                    <div className="nav-acc-body">
                      {section.items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`navlink${activeNav === item.id ? ' active' : ''}`}
                          onClick={() => setActiveNav(item.id)}
                        >
                          <NavIcon name={item.icon} size={15} />
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        ) : (
          <nav className="ng-nav nav-a-rail" aria-label="Secciones">
            {allSections.map((section) => {
              const SecIcon = I[section.icon] || I.Layout;
              const hasActive = section.items.some((i) => i.id === activeNav);
              return (
                <button
                  key={section.id}
                  type="button"
                  className={`nav-rail-btn${hasActive ? ' active' : ''}${peekId === section.id ? ' peek' : ''}`}
                  title={section.title}
                  aria-label={section.title}
                  onClick={() => setPeekId((p) => (p === section.id ? null : section.id))}
                >
                  <SecIcon size={17} />
                </button>
              );
            })}
          </nav>
        )}
        <NavFoot collapsed={collapsed} />
      </aside>

      {collapsed && peekSec && (
        <div className="nav-peek" role="dialog" aria-label={peekSec.title}>
          <div className="nav-peek-head">
            <strong>{peekSec.title}</strong>
            <button type="button" className="ng-icon-btn" onClick={() => setPeekId(null)} aria-label="Cerrar">
              <I.X size={14} />
            </button>
          </div>
          <div className="nav-peek-body">
            {peekSec.items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`navlink${activeNav === item.id ? ' active' : ''}`}
                onClick={() => {
                  setActiveNav(item.id);
                  setPeekId(null);
                }}
              >
                <NavIcon name={item.icon} size={15} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/* ─── B · Section icon rail + flyout ─────────────────────────────────── */
function NavB({ collapsed, onToggle, activeNav, setActiveNav }) {
  const activeSec = findNavSection(activeNav);
  const [flyId, setFlyId] = useState(activeSec.id);
  const [hovering, setHovering] = useState(false);
  const leaveTimer = useRef(null);

  useEffect(() => {
    setFlyId(findNavSection(activeNav).id);
  }, [activeNav]);

  const allSections = [...NAV_SECTIONS, SISTEMA_SECTION];
  const flySec = allSections.find((s) => s.id === flyId) || activeSec;
  const pinned = !collapsed;
  const showFly = pinned || hovering;

  function clearLeave() {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  }

  function onRailEnter(id) {
    clearLeave();
    setFlyId(id);
    setHovering(true);
  }

  function onRailLeave() {
    if (pinned) return;
    clearLeave();
    leaveTimer.current = setTimeout(() => setHovering(false), 160);
  }

  return (
    <>
      <aside
        className="ng-aside nav-b is-rail"
        onMouseLeave={onRailLeave}
      >
        <div className="ng-aside-brand">
          <NavBrandMark />
        </div>
        <button
          type="button"
          className="ng-collapse"
          onClick={onToggle}
          aria-label={collapsed ? 'Fijar panel' : 'Solo rail'}
          title={collapsed ? 'Fijar panel de sección' : 'Colapsar a rail'}
        >
          {collapsed ? <I.ChevronR size={14} /> : <I.ChevronL size={14} />}
        </button>
        <nav className="ng-nav nav-b-rail" aria-label="Áreas">
          {allSections.map((section) => {
            const SecIcon = I[section.icon] || I.Layout;
            const hasActive = section.items.some((i) => i.id === activeNav);
            const isFly = flyId === section.id && showFly;
            return (
              <button
                key={section.id}
                type="button"
                className={`nav-rail-btn${hasActive ? ' active' : ''}${isFly ? ' peek' : ''}`}
                title={section.title}
                aria-label={section.title}
                onMouseEnter={() => onRailEnter(section.id)}
                onFocus={() => onRailEnter(section.id)}
                onClick={() => {
                  setFlyId(section.id);
                  if (collapsed) onToggle();
                }}
              >
                <SecIcon size={17} />
                {hasActive && <span className="nav-rail-dot" />}
              </button>
            );
          })}
        </nav>
        <NavFoot collapsed />
      </aside>

      {showFly && (
        <div
          className={`nav-flyout${pinned ? ' is-pinned' : ''}`}
          onMouseEnter={() => {
            clearLeave();
            setHovering(true);
          }}
          onMouseLeave={onRailLeave}
        >
          <div className="nav-flyout-head">
            <div>
              <span className="ng-overline" style={{ display: 'block', marginBottom: 4 }}>Área</span>
              <strong>{flySec.title}</strong>
            </div>
            <button
              type="button"
              className={`nav-pin${pinned ? ' on' : ''}`}
              onClick={onToggle}
              aria-label={pinned ? 'Desfijar' : 'Fijar'}
              title={pinned ? 'Desfijar panel' : 'Fijar panel'}
            >
              {pinned ? 'Fijado' : 'Fijar'}
            </button>
          </div>
          <div className="nav-flyout-body">
            {flySec.items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`navlink${activeNav === item.id ? ' active' : ''}`}
                onClick={() => setActiveNav(item.id)}
              >
                <NavIcon name={item.icon} size={15} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/* ─── C · Top area tabs + short secondary sidebar ────────────────────── */
function NavC({ collapsed, onToggle, activeNav, setActiveNav }) {
  const activeSec = findNavSection(activeNav);
  const [areaId, setAreaId] = useState(activeSec.id);

  useEffect(() => {
    setAreaId(findNavSection(activeNav).id);
  }, [activeNav]);

  const allSections = [...NAV_SECTIONS, SISTEMA_SECTION];
  const area = allSections.find((s) => s.id === areaId) || activeSec;

  function selectArea(id) {
    setAreaId(id);
    const sec = allSections.find((s) => s.id === id);
    if (sec && !sec.items.some((i) => i.id === activeNav)) {
      setActiveNav(sec.items[0].id);
    }
  }

  return (
    <>
      <header className="nav-c-topbar">
        <div className="nav-c-brand">
          <img src={LOGO_SRC} alt="NeuraGest" draggable={false} />
        </div>
        <nav className="nav-c-areas" aria-label="Áreas">
          {allSections.map((section) => {
            const SecIcon = I[section.icon] || I.Layout;
            const on = areaId === section.id;
            return (
              <button
                key={section.id}
                type="button"
                className={`nav-c-tab${on ? ' active' : ''}`}
                onClick={() => selectArea(section.id)}
              >
                <SecIcon size={14} />
                <span>{section.title}</span>
              </button>
            );
          })}
        </nav>
        <div className="nav-c-top-end">
          <button type="button" className="ng-collapse nav-c-side-toggle" onClick={onToggle} aria-label="Alternar sidebar">
            {collapsed ? <I.ChevronR size={14} /> : <I.ChevronL size={14} />}
          </button>
        </div>
      </header>

      {!collapsed && (
        <aside className="ng-aside nav-c-side">
          <div className="nav-c-side-head">
            <span className="ng-overline">{area.title}</span>
            <small>{area.items.length} módulos</small>
          </div>
          <nav className="ng-nav nav-c-list" aria-label={area.title}>
            {area.items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`navlink${activeNav === item.id ? ' active' : ''}`}
                onClick={() => setActiveNav(item.id)}
              >
                <NavIcon name={item.icon} size={15} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          <NavFoot collapsed={false} />
        </aside>
      )}
    </>
  );
}

function ShellScreen({ dir, collapsed, onToggle, activeNav, setActiveNav }) {
  const pattern = dir === 'b' ? 'b' : dir === 'c' ? 'c' : 'a';
  const shellClass = [
    'ng-shell',
    `nav-pattern-${pattern}`,
    collapsed ? 'is-collapsed' : '',
    pattern === 'b' && !collapsed ? 'has-flyout' : '',
    pattern === 'c' ? 'is-topnav' : '',
  ].filter(Boolean).join(' ');

  let nav = null;
  if (pattern === 'b') {
    nav = <NavB collapsed={collapsed} onToggle={onToggle} activeNav={activeNav} setActiveNav={setActiveNav} />;
  } else if (pattern === 'c') {
    nav = <NavC collapsed={collapsed} onToggle={onToggle} activeNav={activeNav} setActiveNav={setActiveNav} />;
  } else {
    nav = <NavA collapsed={collapsed} onToggle={onToggle} activeNav={activeNav} setActiveNav={setActiveNav} />;
  }

  return (
    <div className={shellClass} data-screen-label={`shell-${dir}-${activeNav}`} data-nav={pattern}>
      {nav}
      <MainChrome activeNav={activeNav} dir={dir} />
    </div>
  );
}

Object.assign(window, { ShellScreen, NavA, NavB, NavC, NavBrandMark });
