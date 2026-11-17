import { Masthead, MastheadToggle, MastheadMain, MastheadBrand, MastheadContent, Page, PageSidebar, PageSidebarBody, PageSection, PageToggleButton, Button, Content, ContentVariants, SkipToContent, MenuToggle, Dropdown, DropdownList, DropdownItem, Divider } from '@patternfly/react-core';
import { BarsIcon } from '@patternfly/react-icons';
import { useEffect, useState } from 'react';
import { PERSONA_LABEL } from '../data/generated';
import { useApp, useScoped, type Persona } from '../state/appState';
import { authUser, logout } from '../api/auth';
import { LANG_META, applyLang } from '../i18n/i18n';
import { i18next, useT } from '../i18n';
import { RhIcon } from './RhIcon';
import { Notifications } from './Notifications';
import { HelpSuite } from './Help';
import { Nav } from './Nav';

export function Shell({ children }: { children: React.ReactNode }) {
  const { state, set } = useApp();
  const { path } = useScoped();
  const me = authUser();
  const [userOpen, setUserOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const t = useT();

  /* locale switch → the mock's DOM translation pass (dir/lang/dict/walk) … */
  useEffect(() => { applyLang(state.lang); }, [state.lang]);
  /* … and the key-based mirror for migrated (data-i18n-live) subtrees */
  useEffect(() => { if (i18next.language !== state.lang) i18next.changeLanguage(state.lang); }, [state.lang]);
  const LM = LANG_META as unknown as Record<string, string[]>;

  return (
    <Page
      skipToContent={<SkipToContent href="#main-content" data-i18n-live>{t('Skip to main content')}</SkipToContent>}
      isManagedSidebar
      defaultManagedSidebarIsOpen
      masthead={
        <Masthead display={{ default: 'stack', md: 'inline' }}>
          {/* toggle + brand inside Main per the PF6 inline structure (MastheadDisplayInline
              example) — as a sibling of Main the toggle gets its own grid row */}
          <MastheadMain>
            <MastheadToggle>
              <PageToggleButton variant="plain" data-i18n-live aria-label={t('Toggle navigation sidebar')} icon={<BarsIcon />} />
            </MastheadToggle>
            <MastheadBrand href="#scr=home" data-i18n-skip>
              Migration Toolkit for Applications{' '}
              <Content component={ContentVariants.small} className="brand-tag" data-i18n-skip>
                mockup · real PF6
              </Content>
            </MastheadBrand>
          </MastheadMain>
          <MastheadContent>
            {/* roles define persona: the signed-in user's realm role IS the persona —
                migrated to i18next (data-i18n-live fences the legacy DOM walker) */}
            {me && (
              <Dropdown
                isOpen={userOpen}
                onOpenChange={setUserOpen}
                popperProps={{ position: 'end' }}   /* masthead menus open right-aligned (the mock's anchorMenu) */
                toggle={(toggleRef) => (
                  <MenuToggle ref={toggleRef} variant="plain" isExpanded={userOpen}
                    onClick={() => setUserOpen(!userOpen)}
                    data-i18n-live
                    aria-label={t('Signed-in user (roles define persona — the realm role is the persona)')}>
                    <b>{me.userName}</b>&nbsp;·&nbsp;{shortPersona(me.persona, t)}
                  </MenuToggle>
                )}
              >
                <DropdownList>
                  <DropdownItem isDisabled key="role" data-i18n-live description={t(PERSONA_LABEL[me.persona])}>
                    {t('Role:')} {me.persona}
                  </DropdownItem>
                  {(me.orgName || me.orgAliases[0]) && <DropdownItem isDisabled key="org" data-i18n-live>{t('Organization:')} {me.orgName ?? me.orgAliases[0]}</DropdownItem>}
                  {me.teamName && <DropdownItem isDisabled key="team" data-i18n-live>{t('Team:')} {me.teamName}</DropdownItem>}
                  <Divider component="li" />
                  <DropdownItem key="signout" data-i18n-live onClick={logout}>{t('Sign out')}</DropdownItem>
                </DropdownList>
              </Dropdown>
            )}
            {/* org/dept/team scope (#41 multi-tenancy, from the token claims) — after the
                user chip per user request: role info first, organizational info second */}
            <Content component={ContentVariants.small} className="scope-label" title="Organization / department / team scope (#41 multi-tenancy, from the token claims)">
              {path}
            </Content>
            {/* #51/#98: language switcher — languages only, native names; the locale
                decides currency; selection persists + deep-links (&lang=) */}
            <Dropdown
              isOpen={langOpen}
              onOpenChange={setLangOpen}
              popperProps={{ position: 'end' }}
              toggle={(toggleRef) => (
                <MenuToggle ref={toggleRef} variant="plain" isExpanded={langOpen}
                  onClick={() => setLangOpen(!langOpen)}
                  aria-label={`UI language — ${LM[state.lang]?.[1] ?? 'English'}`}>
                  {LM[state.lang]?.[0] ?? 'English'}
                </MenuToggle>
              )}
            >
              <DropdownList>
                {Object.entries(LM).map(([k, m]) => (
                  <DropdownItem key={k} isSelected={state.lang === k}
                    aria-label={m[1]}
                    onClick={() => { set({ lang: k }); setLangOpen(false); }}>
                    {state.lang === k ? <b>{m[0]}</b> : m[0]}
                    {' '}<span className="u-muted" style={{ fontSize: 'var(--rh-font-size-body-text-xs)' }}>{m[1]}</span>
                  </DropdownItem>
                ))}
              </DropdownList>
            </Dropdown>
            {/* #36 item 5: role/org-filtered notification bell + drawer (mock parity) */}
            <Notifications />
            <Button
              variant="plain"
              data-i18n-live
              aria-label={t('Color scheme (light/dark)')}
              aria-pressed={state.scheme === 'dark'}
              onClick={() => set({ scheme: state.scheme === 'dark' ? 'light' : 'dark' })}
              icon={<RhIcon name={state.scheme === 'dark' ? 'dark-mode' : 'light-mode'} />}
            />
            {/* #43: help menu + guided tour + role welcome + about */}
            <HelpSuite />
          </MastheadContent>
        </Masthead>
      }
      sidebar={
        <PageSidebar>
          <PageSidebarBody>
            <Nav />
          </PageSidebarBody>
        </PageSidebar>
      }
    >
      <PageSection id="main-content" hasBodyWrapper={false}>
        {children}
      </PageSection>
    </Page>
  );
}

function shortPersona(p: Persona, t: (k: string) => string): string {
  return t({ architect: 'Architect', pm: 'Project mgr', pgm: 'Program mgr', migrator: 'Migrator', admin: 'Admin', padmin: 'Platform admin' }[p]);
}
