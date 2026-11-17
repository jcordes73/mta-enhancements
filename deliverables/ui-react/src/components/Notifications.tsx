import { useEffect, useRef, useState } from 'react';
import { useApp } from '../state/appState';
/* the drawer markup is hand-rolled PF6 HTML (the mock's idiom — the React
   ListItemHeader title is a plain string and can't carry the persona chip), so
   its component CSS must be imported explicitly: react-core injects styles only
   when its own components render */
import '@patternfly/react-styles/css/components/NotificationDrawer/notification-drawer.css';

/* #36 item 5 — role-filtered notification feed, ported verbatim from the mock's
   #bellBtn/#notifDrawer: same 6 items, same role/org filter (an item that
   declares an org is visible only to that organization — except the Platform
   administrator, who spans all orgs; the Admin role keeps its blanket view),
   same "N unread · filtered for your role and organization" status line and
   bell badge derived from the SAME filtered count.
   Unfenced (no data-i18n-live): the mock's legacy DOM walker translates these
   exact strings (trailing-space dict keys), like the mock itself. Titles carry
   the exact mock dict key — the trailing space is the visual gap before the
   persona chip and part of the key. */
type NotifVariant = 'info' | 'warning' | 'danger' | 'custom';
interface NotifItem {
  for: string;            // persona key the item targets
  org: string;            // org slug the item belongs to ('' = org-neutral)
  variant: NotifVariant;
  icon: string;           // pf-v6-pficon-* class
  title: string;          // exact dict key (trailing space included where the mock has it)
  personaLabel: string;   // chip text
  desc: string;           // description text node (exact dict key)
  descDot?: boolean;      // mock renders the trailing '.' as a separate node
  ts: string;
  to: string;             // screen to open
  actionAria: string;
}

const ITEMS: NotifItem[] = [
  {
    for: 'padmin', org: 'meridian-health', variant: 'custom', icon: 'pf-v6-pficon-infrastructure',
    title: 'Tenant “Meridian Health” provisioned ', personaLabel: 'platform admin',
    desc: '1 department, 2 teams, 3 applications imported — provisioning recorded in the cross-tenant audit trail ',
    descDot: true, ts: 'yesterday', to: 'config', actionAria: 'Open administration',
  },
  {
    for: 'pgm', org: 'northwind-financial', variant: 'info', icon: 'pf-v6-pficon-info',
    /* dict key has NO trailing space (the mock's node text does — its walker
       falls through to the phrase pass; here the exact key wins) */
    title: 'Wave 4 spans 3 teams — coordinate the change window', personaLabel: 'program manager',
    desc: 'Claims, Portfolio, and Customer digital all move in Wave 4 ',
    descDot: true, ts: '1 hour ago', to: 'waves', actionAria: 'Open waves',
  },
  {
    for: 'pm', org: 'northwind-financial', variant: 'warning', icon: 'pf-v6-pficon-warning-triangle',
    title: 'Wave 3 entered its window — 2 members not started ', personaLabel: 'project manager',
    desc: 'Gate at risk: 4 tickets open.', ts: '32 minutes ago', to: 'waves', actionAria: 'Open waves',
  },
  {
    for: 'migrator', org: 'northwind-financial', variant: 'custom', icon: 'pf-v6-pficon-attention-bell',
    title: 'Incident assigned to you — invoicing ', personaLabel: 'migrator',
    desc: 'WebLogic JNDI lookup → migration hint available.', ts: '1 hour ago', to: 'incidents', actionAria: 'Open incidents',
  },
  {
    for: 'admin', org: 'northwind-financial', variant: 'danger', icon: 'pf-v6-pficon-error-circle-o',
    title: 'Task queue backlog aging — 38 tasks > 2h ', personaLabel: 'administrator',
    desc: '3 failed, cause: cache permission denied — diagnose in the Task Manager.', ts: '2 hours ago', to: 'tasks', actionAria: 'Diagnose',
  },
  {
    for: 'architect', org: 'northwind-financial', variant: 'info', icon: 'pf-v6-pficon-info',
    title: 'Analysis completed — payments-api ', personaLabel: 'architect',
    desc: '214 incidents, 2 new vs. last run — open the comparison.', ts: '2d ago', to: 'inventory', actionAria: 'Open comparison',
  },
];

export function Notifications() {
  const { state } = useApp();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  /* the mock's applyRbac filter: role dimension (admin blanket) × org dimension
     (padmin spans orgs; org-neutral items stay visible to every seat) */
  const visible = ITEMS.filter(it =>
    (state.persona === 'admin' || it.for === state.persona) &&
    (!it.org || state.persona === 'padmin' || it.org === state.org));
  const n = visible.length;

  /* outside-click + Escape close (the mock's toggleDrawer Escape wiring) */
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key === 'Escape') setOpen(false);
      else if (e instanceof MouseEvent && !rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: 'relative', display: 'flex' }}>
      <button
        className="pf-v6-c-menu-toggle pf-m-plain"
        type="button"
        aria-expanded={open}
        aria-controls="notifDrawer"
        aria-label="Notifications"
        title="Notifications (unread count)"
        onClick={() => setOpen(o => !o)}
      >
        {/* the mock's bell SVG (path data inlined, 1em/currentColor like svg.fas) */}
        <svg className="fas" viewBox="0 0 32 32" aria-hidden="true" focusable="false" style={{ width: '1em', height: '1em', fill: 'currentColor', verticalAlign: '-0.125em' }}><path d="M28 21c-1.103 0-2-.897-2-2v-4c0-4.885-3.523-8.955-8.159-9.823.405-.445.659-1.03.659-1.677C18.5 2.122 17.379 1 16 1s-2.5 1.122-2.5 2.5c0 .647.254 1.233.659 1.677C9.523 6.045 6 10.115 6 15v4c0 1.103-.897 2-2 2a1 1 0 0 0-1 1v3.5c0 .827.673 1.5 1.5 1.5H12c0 2.206 1.794 4 4 4s4-1.794 4-4h7.5c.827 0 1.5-.673 1.5-1.5V22a1 1 0 0 0-1-1Zm-1 4H5v-2.126A4.006 4.006 0 0 0 8 19v-4c0-4.411 3.589-8 8-8s8 3.589 8 8v4a4.008 4.008 0 0 0 3 3.874V25Z"/></svg>
        {n > 0 && <span className="pf-v6-c-badge pf-m-unread">{n}</span>}
      </button>
      <div
        id="notifDrawer"
        className="pf-v6-c-notification-drawer"
        hidden={!open}
        style={{
          position: 'absolute', top: 'calc(100% + var(--rh-space-sm))', right: 0, zIndex: 300,
          width: 'min(400px, 80vw)', height: 'auto', /* PF6's height:100% resolves
              against the bell-button wrapper here — auto + max-height like the mock */
          maxHeight: '70vh', overflowY: 'auto',
          boxShadow: 'var(--rh-box-shadow-xl)',
          background: 'var(--pf-t--global--background--color--primary--default)',
          border: '1px solid var(--pf-t--global--border--color--subtle)',
          borderRadius: 'var(--pf-t--global--border--radius--medium)',
        }}
      >
        <div className="pf-v6-c-notification-drawer__header">
          <div className="pf-v6-c-notification-drawer__header-title">
            <h1 className="pf-v6-c-notification-drawer__header-title-text">Notifications</h1>
          </div>
          <div className="pf-v6-c-notification-drawer__header-status">
            {/* single text node — the mock's `n + ' unread · …'` textContent; the
                walker's exact dict key only matches the whole composed string */}
            {`${n} unread · filtered for your role and organization`}
          </div>
          <div className="pf-v6-c-notification-drawer__header-action">
            <button className="pf-v6-c-button pf-m-plain" type="button" aria-label="Close notifications" onClick={() => setOpen(false)}>
              <span className="pf-v6-pficon pf-v6-pficon-close" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="pf-v6-c-notification-drawer__body">
          <ul className="pf-v6-c-notification-drawer__list">
            {visible.map(it => (
              <li key={it.for} data-for={it.for} data-org={it.org} className={`pf-v6-c-notification-drawer__list-item pf-m-${it.variant}`}>
                <div className="pf-v6-c-notification-drawer__list-item-header">
                  <span className="pf-v6-c-notification-drawer__list-item-header-icon">
                    <span className={`pf-v6-pficon ${it.icon}`} aria-hidden="true" />
                  </span>
                  <span className="pf-v6-c-notification-drawer__list-item-header-title">
                    {it.title} <span className="pf-v6-c-label pf-m-teal"><span className="pf-v6-c-label__content"><span className="pf-v6-c-label__text">{it.personaLabel}</span></span></span>
                  </span>
                  <span className="pf-v6-c-notification-drawer__list-item-action">
                    <button className="pf-v6-c-button pf-m-plain" type="button" aria-label={it.actionAria} onClick={() => { setOpen(false); location.hash = `#scr=${it.to}`; }}>→</button>
                  </span>
                </div>
                <div className="pf-v6-c-notification-drawer__list-item-description">
                  {it.desc}{it.descDot ? '.' : null}
                </div>
                <div className="pf-v6-c-notification-drawer__list-item-timestamp">{it.ts}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
