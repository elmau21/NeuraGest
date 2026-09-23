/* Module page bodies — one representative layout per nav apartado */

function PageChrome({ id, children, actions }) {
  const meta = PAGE_META[id] || { title: id, sub: '' };
  return (
    <div className="ng-content" data-screen-label={`page-${id}`}>
      <div className="ng-page-title ng-page-title-row">
        <div>
          <h1>{meta.title}</h1>
          <p>{meta.sub}</p>
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

function KpiRow({ items }) {
  return (
    <div className="ng-kpis">
      {items.map(([label, value, hint]) => (
        <div className="ng-card ng-kpi" key={label}>
          <span>{label}</span>
          <b>{value}</b>
          {hint && <em>{hint}</em>}
        </div>
      ))}
    </div>
  );
}

function Toolbar({ children }) {
  return <div className="ng-toolbar">{children}</div>;
}

function TableLite({ cols, rows }) {
  return (
    <div className="ng-card ng-table-wrap">
      <table className="ng-table">
        <thead>
          <tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Tag({ children, tone }) {
  return <span className={`ng-tag${tone ? ` tone-${tone}` : ''}`}>{children}</span>;
}

function PageControl() {
  return (
    <PageChrome id="control" actions={<button type="button" className="ng-btn ng-btn-primary ng-btn-sm"><I.Plus size={14} /> Nueva ficha</button>}>
      <KpiRow items={[['Inbox', '9', '3 urgentes'], ['Tareas hoy', '14', '5 mías'], ['En vivo', '12', 'roster'], ['Contratos', '2', 'vencencen 14d']]} />
      <div className="ng-grid ng-grid-2">
        <div className="ng-card">
          <div className="ng-card-head"><div><h3>Inbox</h3><p>Prioridad operativa</p></div></div>
          {[
            ['Cumplimiento · NovaPulse', 'Gap 45m ayer', 'warn'],
            ['Brief creativo', 'Banner Q2 listo para review', 'ok'],
            ['CRM · Acme Esports', 'Follow-up pendiente', ''],
          ].map(([t, d, tone]) => (
            <div className="ng-list-row" key={t}>
              <div><b>{t}</b><span>{d}</span></div>
              <Tag tone={tone || undefined}>{tone === 'warn' ? 'Urgente' : tone === 'ok' ? 'Listo' : 'Hoy'}</Tag>
            </div>
          ))}
        </div>
        <div className="ng-card">
          <div className="ng-card-head"><div><h3>Atajos</h3><p>Centro de control</p></div></div>
          <div className="ng-shortcut-grid">
            {['Tareas asistente', 'Fichas evento', 'War Room', 'Documentos', 'Analítica', 'Ajustes'].map((l) => (
              <button type="button" className="ng-shortcut" key={l}>{l}</button>
            ))}
          </div>
        </div>
      </div>
    </PageChrome>
  );
}

function PageDash({ dir }) {
  return (
    <PageChrome id="dash">
      <KpiRow items={[['En vivo', '12', '+2 vs ayer'], ['Viewers pico', '48.2k', '+6.1%'], ['Tareas abiertas', '27', '8 urgentes'], ['Cumplimiento', '94%', 'horario OK']]} />
      <div className="ng-grid">
        <div className="ng-card">
          <div className="ng-card-head"><div><h3>Actividad 7 días</h3><p>{dir === 'c' ? 'Horas · roster · mono metrics' : 'Horas de stream · roster activo'}</p></div></div>
          <div className="ng-chart-fake"><div className="ng-chart-line" /></div>
        </div>
        <div className="ng-card">
          <div className="ng-card-head"><div><h3>Ahora en vivo</h3><p>Señal en vivo · cartera Neura</p></div><span className="ng-pill">LIVE</span></div>
          {[['NovaPulse', 'Just Chatting', '4.2k'], ['KaiStream', 'Valorant', '2.8k'], ['LumenTV', 'IRL', '1.1k']].map(([n, g, v]) => (
            <div className="ng-live-row" key={n}>
              <div className="ng-live-avatar" /><div><b>{n}</b><span>{g}</span></div><strong>{v}</strong>
            </div>
          ))}
        </div>
      </div>
    </PageChrome>
  );
}

function PageTareas() {
  return (
    <PageChrome id="tareas" actions={<button type="button" className="ng-btn ng-btn-primary ng-btn-sm"><I.Plus size={14} /> Nueva tarea</button>}>
      <Toolbar>
        <span className="ng-chip on">Todas</span>
        <span className="ng-chip">Mías</span>
        <span className="ng-chip">Urgentes</span>
        <span className="ng-chip">Hechas</span>
      </Toolbar>
      <div className="ng-kanban">
        {[['Por hacer', [['Banner Twitch', 'Diseño', 'Alta'], ['Follow-up Acme', 'CRM', 'Media']]],
          ['En curso', [['Brief Q2', 'Contenido', 'Alta'], ['Checklist VOD', 'Ops', 'Baja']]],
          ['Hecho', [['Onboarding Maya', 'People', 'Media']]]].map(([col, cards]) => (
          <div className="ng-kanban-col" key={col}>
            <div className="ng-kanban-head">{col} <em>{cards.length}</em></div>
            {cards.map(([t, tag, prio]) => (
              <div className="ng-card ng-task-card" key={t}>
                <b>{t}</b>
                <div className="ng-task-meta"><Tag>{tag}</Tag><Tag tone={prio === 'Alta' ? 'warn' : undefined}>{prio}</Tag></div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </PageChrome>
  );
}

function PageTalentos() {
  return (
    <PageChrome id="talentos">
      <Toolbar>
        <div className="ng-search ng-search-inline"><I.Search size={14} /><span>Buscar talento…</span></div>
        <span className="ng-chip on">Activos</span>
        <span className="ng-chip">En vivo</span>
      </Toolbar>
      <div className="ng-talent-grid">
        {[['NovaPulse', 'Just Chatting', '4.2k', true], ['KaiStream', 'Valorant', '2.8k', true],
          ['LumenTV', 'IRL', '—', false], ['PixelFox', 'Art', '—', false],
          ['EchoByte', 'Variety', '910', true], ['MiraOps', 'Talk', '—', false]].map(([n, g, v, live]) => (
          <div className="ng-card ng-talent-card" key={n}>
            <div className="ng-live-avatar lg" />
            <div>
              <b>{n} {live && <span className="ng-pill">LIVE</span>}</b>
              <span>{g}</span>
              <strong>{v} viewers</strong>
            </div>
          </div>
        ))}
      </div>
    </PageChrome>
  );
}

function PageWarRoom() {
  return (
    <PageChrome id="war-room">
      <div className="ng-mosaic">
        {['NovaPulse', 'KaiStream', 'EchoByte', 'LumenTV'].map((n, i) => (
          <div className="ng-mosaic-tile" key={n}>
            <div className="ng-mosaic-vid"><span className="ng-pill">LIVE</span></div>
            <div className="ng-mosaic-meta"><b>{n}</b><span>{['4.2k', '2.8k', '910', '1.1k'][i]} · chat</span></div>
          </div>
        ))}
      </div>
    </PageChrome>
  );
}

function PageCalendario({ id = 'calendario' } = {}) {
  const days = Array.from({ length: 28 }, (_, i) => i + 1);
  return (
    <PageChrome id={id}>
      <Toolbar><span className="ng-chip on">Mes</span><span className="ng-chip">Semana</span><b className="ng-muted">Marzo 2026</b></Toolbar>
      <div className="ng-card ng-cal">
        <div className="ng-cal-head">{['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => <span key={d}>{d}</span>)}</div>
        <div className="ng-cal-grid">
          {days.map((d) => (
            <div className={`ng-cal-cell${[4, 11, 18].includes(d) ? ' has-event' : ''}`} key={d}>
              <em>{d}</em>
              {[4, 11].includes(d) && <span>Stream night</span>}
              {d === 18 && <span>Entrega brief</span>}
            </div>
          ))}
        </div>
      </div>
    </PageChrome>
  );
}

function PagePipeline() {
  return (
    <PageChrome id="pipeline">
      <div className="ng-kanban">
        {[['Lead', [['Acme · integración', '€12k']]],
          ['Negociación', [['BrandX · midroll', '€8.5k'], ['StudioY · IRL', '€4k']]],
          ['Cerrado', [['Nova · season', '€22k']]]].map(([col, cards]) => (
          <div className="ng-kanban-col" key={col}>
            <div className="ng-kanban-head">{col} <em>{cards.length}</em></div>
            {cards.map(([t, v]) => (
              <div className="ng-card ng-task-card" key={t}><b>{t}</b><span className="ng-muted">{v}</span></div>
            ))}
          </div>
        ))}
      </div>
    </PageChrome>
  );
}

function PageCrm() {
  return (
    <PageChrome id="crm">
      <TableLite
        cols={['Deal', 'Marca', 'Etapa', 'Valor', 'Owner']}
        rows={[
          ['Integración midroll', 'Acme Esports', <Tag tone="warn">Negociación</Tag>, '€12k', 'Maya'],
          ['IRL collab', 'StudioY', <Tag>Lead</Tag>, '€4k', 'Leo'],
          ['Season pack', 'Nova', <Tag tone="ok">Cerrado</Tag>, '€22k', 'Maya'],
        ]}
      />
    </PageChrome>
  );
}

function PageSchedule() {
  return (
    <PageChrome id="schedule">
      <KpiRow items={[['Cumplimiento', '94%', '7d'], ['Gaps', '3', 'ayer'], ['On-time', '41', 'streams'], ['Alertas', '2', 'abiertas']]} />
      <div className="ng-card">
        {[['NovaPulse', 96], ['KaiStream', 88], ['LumenTV', 72], ['EchoByte', 91]].map(([n, pct]) => (
          <div className="ng-bar-row" key={n}>
            <b>{n}</b>
            <div className="ng-bar"><i style={{ width: `${pct}%` }} /></div>
            <span>{pct}%</span>
          </div>
        ))}
      </div>
    </PageChrome>
  );
}

function PageComisiones() {
  return (
    <PageChrome id="comisiones">
      <TableLite
        cols={['Periodo', 'Talento', '%', 'Base', 'Neto', 'Estado']}
        rows={[
          ['Mar 2026', 'NovaPulse', '15%', '€18.2k', '€2.73k', <Tag tone="ok">Pagado</Tag>],
          ['Mar 2026', 'KaiStream', '12%', '€9.4k', '€1.13k', <Tag tone="warn">Pendiente</Tag>],
          ['Feb 2026', 'LumenTV', '10%', '€6.1k', '€610', <Tag tone="ok">Pagado</Tag>],
        ]}
      />
    </PageChrome>
  );
}

function PagePortal() {
  return (
    <PageChrome id="portal">
      <div className="ng-grid ng-grid-2">
        <div className="ng-card">
          <div className="ng-card-head"><div><h3>Portal · NovaPulse</h3><p>Materiales y checklist</p></div></div>
          {['Media kit actualizado', 'Tarifas firmadas', 'Brief Q2 recibido', 'Assets banner'].map((x, i) => (
            <div className="ng-list-row" key={x}><div><b>{x}</b><span>Item {i + 1}/4</span></div><Tag tone={i < 3 ? 'ok' : 'warn'}>{i < 3 ? 'OK' : 'Pendiente'}</Tag></div>
          ))}
        </div>
        <div className="ng-card">
          <div className="ng-card-head"><div><h3>Enlaces</h3><p>Vista talento</p></div></div>
          <div className="ng-shortcut-grid">
            {['Twitch', 'Media kit', 'Documentos', 'Calendario'].map((l) => (
              <button type="button" className="ng-shortcut" key={l}>{l}</button>
            ))}
          </div>
        </div>
      </div>
    </PageChrome>
  );
}

function PageRateCard() {
  return (
    <PageChrome id="rate-card">
      <TableLite
        cols={['Formato', 'Audiencia', 'Base', 'Premium']}
        rows={[
          ['Mention 30s', '10–25k', '€450', '€650'],
          ['Midroll 60s', '25–50k', '€900', '€1.2k'],
          ['Dedicated', '50k+', '€2.4k', '€3.1k'],
        ]}
      />
    </PageChrome>
  );
}

function PageContentList({ id, rows }) {
  return (
    <PageChrome id={id} actions={<button type="button" className="ng-btn ng-btn-ghost ng-btn-sm"><I.Plus size={14} /> Nuevo</button>}>
      <div className="ng-card">
        {rows.map(([t, d, tone]) => (
          <div className="ng-list-row" key={t}>
            <div><b>{t}</b><span>{d}</span></div>
            <Tag tone={tone}>{tone === 'ok' ? 'Listo' : tone === 'warn' ? 'En curso' : 'Borrador'}</Tag>
          </div>
        ))}
      </div>
    </PageChrome>
  );
}

function PageDocumentos() {
  return (
    <PageChrome id="documentos">
      <Toolbar>
        <span className="ng-chip on">Contratos</span>
        <span className="ng-chip">Legales</span>
        <span className="ng-chip">Internos</span>
      </Toolbar>
      <div className="ng-file-grid">
        {[['Contratos', '12 archivos'], ['NovaPulse', '4 PDFs'], ['Plantillas', '6 docs'], ['NDAs', '3 archivos']].map(([n, m]) => (
          <div className="ng-card ng-file-card" key={n}>
            <I.Folder size={22} />
            <b>{n}</b>
            <span>{m}</span>
          </div>
        ))}
      </div>
    </PageChrome>
  );
}

function PageDiseno() {
  return (
    <PageChrome id="diseno">
      <Toolbar>
        <span className="ng-chip on">Creative Drive</span>
        <span className="ng-chip">Recientes</span>
      </Toolbar>
      <div className="ng-file-grid">
        {[['Banners Q2', '18 assets'], ['Overlays', '9 PSD'], ['Emotes', '24 PNG'], ['Thumbnails', '31 JPG']].map(([n, m]) => (
          <div className="ng-card ng-file-card" key={n}>
            <I.Paint size={22} />
            <b>{n}</b>
            <span>{m}</span>
          </div>
        ))}
      </div>
    </PageChrome>
  );
}

function PageHuecos() {
  return (
    <PageChrome id="huecos">
      <div className="ng-card">
        {[['NovaPulse · panel missing', 'Canal incompleto'], ['KaiStream · banner stale', 'Actualizar Q2'], ['LumenTV · emote pack', 'Sin set oficial']].map(([t, d]) => (
          <div className="ng-list-row" key={t}>
            <div><b>{t}</b><span>{d}</span></div>
            <button type="button" className="ng-btn ng-btn-ghost ng-btn-sm">Resolver</button>
          </div>
        ))}
      </div>
    </PageChrome>
  );
}

function PageNlOverview() {
  return (
    <PageChrome id="nl-temp">
      <KpiRow items={[['Equipos', '8', 'S2'], ['Jugadores', '64', 'activos'], ['Partidos', '12', 'esta semana'], ['VODs', '28', 'taggeados']]} />
      <div className="ng-grid ng-grid-2">
        <div className="ng-card">
          <div className="ng-card-head"><div><h3>Clasificación</h3><p>Top 4</p></div></div>
          {[['Neon Wolves', '18 pts'], ['Violet Fox', '15 pts'], ['Signal Ops', '14 pts'], ['Lattice', '11 pts']].map(([t, p], i) => (
            <div className="ng-list-row" key={t}><div><b>{i + 1}. {t}</b></div><strong>{p}</strong></div>
          ))}
        </div>
        <div className="ng-card">
          <div className="ng-card-head"><div><h3>Próximos partidos</h3><p>Calendario liga</p></div></div>
          {[['Vie 20:00', 'Neon vs Violet'], ['Sáb 18:00', 'Signal vs Lattice'], ['Dom 19:30', 'Fox vs Ops']].map(([t, d]) => (
            <div className="ng-list-row" key={t}><div><b>{t}</b><span>{d}</span></div><Tag>Live</Tag></div>
          ))}
        </div>
      </div>
    </PageChrome>
  );
}

function PageAnalitica() {
  return (
    <PageChrome id="analitica">
      <KpiRow items={[['AVG CCV', '3.1k', '+4%'], ['Horas', '412h', '7d'], ['Clips', '86', 'semana'], ['Retention', '41%', 'vod']]} />
      <div className="ng-grid">
        <div className="ng-card">
          <div className="ng-card-head"><div><h3>Tendencia viewers</h3><p>14 días</p></div></div>
          <div className="ng-chart-fake"><div className="ng-chart-line" /></div>
        </div>
        <div className="ng-card">
          <div className="ng-card-head"><div><h3>Top categorías</h3></div></div>
          {[['Just Chatting', '38%'], ['Valorant', '22%'], ['IRL', '14%'], ['Art', '9%']].map(([c, p]) => (
            <div className="ng-bar-row" key={c}><b>{c}</b><div className="ng-bar"><i style={{ width: p }} /></div><span>{p}</span></div>
          ))}
        </div>
      </div>
    </PageChrome>
  );
}

function PageInteligencia() {
  return (
    <PageChrome id="inteligencia">
      <div className="ng-grid ng-grid-2">
        <div className="ng-card">
          <div className="ng-card-head"><div><h3>Schedule heatmap</h3><p>Horas × día</p></div></div>
          <div className="ng-heat">
            {Array.from({ length: 35 }, (_, i) => (
              <i key={i} style={{ opacity: 0.15 + ((i * 7) % 10) / 12 }} />
            ))}
          </div>
        </div>
        <div className="ng-card">
          <div className="ng-card-head"><div><h3>Clips semanales</h3></div></div>
          {[['Clip · clutch Ace', '12.4k'], ['Funny fail', '8.1k'], ['IRL moment', '5.6k']].map(([t, v]) => (
            <div className="ng-list-row" key={t}><div><b>{t}</b></div><strong>{v}</strong></div>
          ))}
        </div>
      </div>
    </PageChrome>
  );
}

function PageCiencia() {
  return (
    <PageChrome id="ciencia">
      <KpiRow items={[['Risk score', '0.28', 'bajo'], ['Forecast CCV', '3.4k', '+9%'], ['Churn flag', '2', 'talentos'], ['Model', 'v1.4', 'stable']]} />
      <div className="ng-card">
        <div className="ng-card-head"><div><h3>Scores compuestos</h3><p>Días sin stream · tendencia · frecuencia</p></div></div>
        <TableLite
          cols={['Talento', 'Score', 'Señal', 'Acción']}
          rows={[
            ['LumenTV', '0.71', <Tag tone="warn">Watch</Tag>, 'Revisar horario'],
            ['NovaPulse', '0.18', <Tag tone="ok">OK</Tag>, 'Mantener'],
            ['KaiStream', '0.34', <Tag>Normal</Tag>, 'Monitor'],
          ]}
        />
      </div>
    </PageChrome>
  );
}

function PageAuditoria() {
  return (
    <PageChrome id="auditoria">
      <TableLite
        cols={['Cuándo', 'Actor', 'Acción', 'Entidad']}
        rows={[
          ['hace 2m', 'Maya', 'Actualizó permisos', 'app_users'],
          ['hace 18m', 'Leo', 'Subió contrato', 'documentos'],
          ['hace 1h', 'Sistema', 'Backfill de señal', 'metrics'],
          ['hace 3h', 'Maya', 'Creó tarea', 'tasks'],
        ]}
      />
    </PageChrome>
  );
}

function PageAjustes() {
  return (
    <PageChrome id="ajustes">
      <Toolbar>
        {['General', 'Permisos', 'Twitch', 'Discord', 'Nav', 'Plantillas'].map((t, i) => (
          <span className={`ng-chip${i === 0 ? ' on' : ''}`} key={t}>{t}</span>
        ))}
      </Toolbar>
      <div className="ng-grid ng-grid-2">
        <div className="ng-card">
          <div className="ng-card-head"><div><h3>Sesión</h3><p>Cuenta vinculada</p></div></div>
          <div className="ng-session" style={{ margin: 0 }}>
            <div className="ng-avatar">MA</div>
            <div><b>Maya Ortega</b><span>@mayaops · manager</span></div>
          </div>
        </div>
        <div className="ng-card">
          <div className="ng-card-head"><div><h3>Integraciones</h3></div></div>
          {[['Twitch', 'ok'], ['Supabase', 'ok'], ['Discord presence', 'warn'], ['Google Calendar', '']].map(([n, t]) => (
            <div className="ng-list-row" key={n}>
              <div><b>{n}</b></div>
              <Tag tone={t || undefined}>{t === 'ok' ? 'Conectado' : t === 'warn' ? 'Revisar' : 'Off'}</Tag>
            </div>
          ))}
        </div>
      </div>
    </PageChrome>
  );
}

function ModulePage({ id, dir }) {
  switch (id) {
    case 'control': return <PageControl />;
    case 'dash': return <PageDash dir={dir} />;
    case 'tareas': return <PageTareas />;
    case 'talentos': return <PageTalentos />;
    case 'war-room': return <PageWarRoom />;
    case 'calendario': return <PageCalendario />;
    case 'pipeline': return <PagePipeline />;
    case 'crm': return <PageCrm />;
    case 'schedule': return <PageSchedule />;
    case 'comisiones': return <PageComisiones />;
    case 'portal': return <PagePortal />;
    case 'rate-card': return <PageRateCard />;
    case 'brief':
      return <PageContentList id="brief" rows={[['Campaign Q2', 'Banner + midroll', 'warn'], ['IRL collab', 'StudioY pack', ''], ['Season opener', 'NL S2', 'ok']]} />;
    case 'assets':
      return <PageContentList id="assets" rows={[['Logo pack', 'SVG + PNG', 'ok'], ['Font kit', 'Sora / Geist', 'ok'], ['Overlay base', 'OBS scene', 'warn']]} />;
    case 'handoff':
      return <PageContentList id="handoff" rows={[['Banner delivery', 'NovaPulse', 'ok'], ['Emote set', 'KaiStream', 'warn'], ['Panel refresh', 'LumenTV', '']]} />;
    case 'media-kit':
      return <PageContentList id="media-kit" rows={[['NovaPulse kit', 'PDF · actualizado', 'ok'], ['KaiStream kit', 'Pendiente stats', 'warn'], ['Roster pack', 'Board', '']]} />;
    case 'media-kit-compare':
      return (
        <PageChrome id="media-kit-compare">
          <div className="ng-grid ng-grid-2">
            <div className="ng-card">
              <div className="ng-card-head"><div><h3>NovaPulse</h3><p>Media kit</p></div></div>
              <KpiRow items={[['CCV', '4.1k', ''], ['Horas', '62h', ''], ['Eng.', '4.2%', '']]} />
              <div className="ng-muted" style={{ fontSize: 12 }}>Demografía · categorías · rate card</div>
            </div>
            <div className="ng-card">
              <div className="ng-card-head"><div><h3>KaiStream</h3><p>Media kit</p></div></div>
              <KpiRow items={[['CCV', '2.6k', ''], ['Horas', '48h', ''], ['Eng.', '3.1%', '']]} />
              <div className="ng-muted" style={{ fontSize: 12 }}>Demografía · categorías · rate card</div>
            </div>
          </div>
        </PageChrome>
      );
    case 'vod-digest':
      return <PageContentList id="vod-digest" rows={[['Mar 18 · Just Chatting', '3 highlights', 'ok'], ['Mar 17 · Valorant', 'Ace clip', 'warn'], ['Mar 15 · IRL', 'Digest listo', 'ok']]} />;
    case 'board-pack':
      return <PageContentList id="board-pack" rows={[['Board Mar 2026', 'Export PDF', 'ok'], ['Investor lite', 'Metrics only', ''], ['Ops weekly', 'Internal', 'warn']]} />;
    case 'onboarding':
      return <PageContentList id="onboarding" rows={[['Tour manager', 'Completado', 'ok'], ['Permisos base', 'Asignados', 'ok'], ['Nav personalizada', 'Pendiente', 'warn']]} />;
    case 'wiki':
      return <PageContentList id="wiki" rows={[['SOP · War Room', 'Ops', 'ok'], ['Playbook CRM', 'Sales', 'ok'], ['Diseño · naming', 'Creative', 'warn']]} />;
    case 'documentos': return <PageDocumentos />;
    case 'diseno': return <PageDiseno />;
    case 'huecos': return <PageHuecos />;
    case 'briefs':
      return <PageContentList id="briefs" rows={[['Banner Nova Q2', 'En review', 'warn'], ['Emotes Kai', 'Cola', ''], ['Overlay Echo', 'Entregado', 'ok']]} />;
    case 'nl-temp': return <PageNlOverview />;
    case 'nl-teams':
      return <PageContentList id="nl-teams" rows={[['Neon Wolves', '8 jugadores', 'ok'], ['Violet Fox', '8 jugadores', 'ok'], ['Signal Ops', '7 jugadores', 'warn']]} />;
    case 'nl-players':
      return (
        <PageChrome id="nl-players">
          <TableLite cols={['Jugador', 'Equipo', 'Rol', 'Estado']} rows={[
            ['ApexNine', 'Neon Wolves', 'IGL', <Tag tone="ok">Activo</Tag>],
            ['MiraShot', 'Violet Fox', 'Entry', <Tag tone="ok">Activo</Tag>],
            ['QuietAim', 'Signal Ops', 'Support', <Tag tone="warn">Lesión</Tag>],
          ]} />
        </PageChrome>
      );
    case 'nl-cal': return <PageCalendario id="nl-cal" />;
    case 'nl-stats':
      return (
        <PageChrome id="nl-stats">
          <TableLite cols={['Equipo', 'PJ', 'W', 'L', 'Pts']} rows={[
            ['Neon Wolves', '10', '6', '4', '18'],
            ['Violet Fox', '10', '5', '5', '15'],
            ['Signal Ops', '10', '4', '6', '14'],
          ]} />
        </PageChrome>
      );
    case 'nl-vods':
      return <PageContentList id="nl-vods" rows={[['Neon vs Violet', 'VOD · 2h14', 'ok'], ['Signal vs Lattice', 'Highlights', 'warn'], ['Scrim Fox', 'Privado', '']]} />;
    case 'nl-train':
      return <PageContentList id="nl-train" rows={[['Scrim A', 'Vie 17:00', 'ok'], ['Review VOD', 'Sáb 12:00', 'warn'], ['Aim block', 'Dom 10:00', '']]} />;
    case 'nl-recruit':
      return <PageContentList id="nl-recruit" rows={[['Scout · QuietAim', 'Trial', 'warn'], ['Scout · ByteRex', 'Watchlist', ''], ['Offer · Mira', 'Firmado', 'ok']]} />;
    case 'nl-ops':
      return <PageContentList id="nl-ops" rows={[['Casting slotted', 'Sábado', 'ok'], ['Overlays obs', 'Pendiente', 'warn'], ['Lobby codes', 'Listo', 'ok']]} />;
    case 'analitica': return <PageAnalitica />;
    case 'estadisticas':
      return (
        <PageChrome id="estadisticas">
          <KpiRow items={[['Followers', '1.2M', 'roster'], ['Horas mes', '1.8k', '+3%'], ['Unique CCV', '86k', '30d'], ['Clips', '412', 'mes']]} />
          <div className="ng-card"><div className="ng-chart-fake"><div className="ng-chart-line" /></div></div>
        </PageChrome>
      );
    case 'inteligencia': return <PageInteligencia />;
    case 'ciencia': return <PageCiencia />;
    case 'auditoria': return <PageAuditoria />;
    case 'ajustes': return <PageAjustes />;
    default: return <PageDash dir={dir} />;
  }
}

Object.assign(window, { ModulePage, PageChrome });
