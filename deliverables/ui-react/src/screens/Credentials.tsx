import { useMemo, useState } from 'react';
import {
  Alert, Button, Card, CardBody, CardHeader, CardTitle, Content, ContentVariants,
  DescriptionList, DescriptionListDescription, DescriptionListGroup, DescriptionListTerm,
  Label, Modal, ModalHeader, ModalBody, Title,
} from '@patternfly/react-core';
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';
import { useApp, useScoped, can, TEAM_BY_ID } from '../state/appState';
import { useHub, type CredRow } from '../api/hub';
import { dec } from '../utils/decode';

type Cred = CredRow;

/* ---------- credential detail modal (port of tpl-drawer-credential) ---------- */
function CredentialModal({ cred, onClose }: { cred: Cred | null; onClose: () => void }) {
  const { state } = useApp();
  const { data } = useHub();
  if (!cred) return null;
  const canVerify = can(state.persona, 'verify', 'identities');
  const canEdit = can(state.persona, 'edit', 'identities');
  const canDelete = can(state.persona, 'delete', 'identities');
  const used = (data.apps as unknown as Array<Record<string, unknown>>).filter(x => x.credName === cred.name);
  const expiring = cred.expLabel === 'expiring';
  return (
    <Modal variant="medium" isOpen onClose={onClose} aria-label="Credential detail">
      <ModalHeader
        title={<>{cred.name} {expiring && <Label color="yellow">expiring in 6d</Label>}</>}
        labelId="cred-modal-title"
      />
      <ModalBody>
        <Content component={ContentVariants.small} className="u-muted">
          {dec(String(cred.kind))} · created by admin · 2026-04-02
        </Content>
        <Alert variant={expiring ? 'warning' : 'info'} isInline title={expiring ? 'Rotation window open' : 'Credential health'} style={{ marginTop: 'var(--rh-space-lg)' }}>
          <p>
            {expiring
              ? <><b>Blast radius before you rotate:</b> {used.length} application{used.length === 1 ? '' : 's'} and 1 archetype use this credential. Replacing it updates the effective credential for future tasks only — running tasks keep the one they started with. Last used {cred.lastUsed}.</>
              : <>Secret values are never displayed — expiry warnings at 30d, re-test before wave start, and revocation with the blast radius named before it lands.</>}
          </p>
        </Alert>
        <DescriptionList isCompact style={{ margin: 'var(--rh-space-lg) 0' }}>
          <DescriptionListGroup>
            <DescriptionListTerm>Verified</DescriptionListTerm>
            <DescriptionListDescription>
              <Label color={cred.verColor as 'green' | 'red'}>{cred.verifiedLabel === 'unverified' ? 'unverified — never tested' : `verified 14m ago`}</Label>{' '}
              <Button variant="secondary" size="sm" isDisabled={!canVerify}
                title={canVerify ? undefined : 'Missing scope identities:verify'}>re-test now</Button>
              {cred.verifiedLabel === 'unverified' && <span className="u-muted"></span>}
            </DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>Used by</DescriptionListTerm>
            <DescriptionListDescription>
              {used.length
                ? <>{used.map((x, i) => <span key={String(x.name)}>{i > 0 && ', '}<a href="#scr=inventory">{x.name as string}</a></span>)} · <a href="#scr=credentials">see all</a></>
                : <span className="u-muted">0 applications — safe to revoke</span>}
            </DescriptionListDescription>
          </DescriptionListGroup>
        </DescriptionList>
        <div style={{ display: 'flex', gap: 'var(--pf-t--global--spacer--sm)', flexWrap: 'wrap' }}>
          <Button variant="primary" isDisabled={!canEdit} title={canEdit ? undefined : 'Missing scope identities:edit'}>Replace key</Button>
          <Button variant="secondary" isDisabled={!canDelete} title={canDelete ? undefined : 'Missing scope identities:delete'}>Revoke</Button>
        </div>
      </ModalBody>
    </Modal>
  );
}

/* ---------- the screen ---------- */
export function Credentials() {
  const { state } = useApp();
  const { path } = useScoped();
  const { data } = useHub();
  const [detail, setDetail] = useState<Cred | null>(null);

  /* scopedCreds (port): the tenancy clamp decides visibility, exactly like applications */
  const rows = useMemo(() => (data.creds as Cred[]).filter(c => {
    const t = TEAM_BY_ID[c.team as string];
    return t && t.org === state.org && (!state.team || c.team === state.team);
  }), [state.org, state.team]);

  const canCreate = can(state.persona, 'create', 'identities');
  const canVerify = can(state.persona, 'verify', 'identities');
  const usedAppsOf = (c: Cred) => (data.apps as unknown as Array<Record<string, unknown>>).filter(x => x.credName === c.name);

  return (
    <>
      <Title headingLevel="h1" size="2xl" className="page-title">Credentials</Title>
      <Content component={ContentVariants.p} className="page-subtitle">
        Team-owned repository &amp; registry credentials — managed where the applications live · {path}
      </Content>
      <Card style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
        <CardHeader actions={{ actions: <Button variant="primary" isDisabled={!canCreate} title={canCreate ? undefined : 'Missing scope identities:create'}>Add credential</Button> }}>
          <CardTitle>Repository credentials</CardTitle>
        </CardHeader>
        <CardBody>
          {rows.length === 0
            ? <div className="u-muted" style={{ margin: 'var(--rh-space-md) 0' }}>
                No credentials for this scope yet — the team&apos;s first repository credential is added with <b>Add credential</b>; the tenancy switcher widens the view
              </div>
            : <Table aria-label="Repository credentials" variant="compact">
                <Thead><Tr>
                  <Th>Name</Th><Th>Kind</Th><Th>Owner team</Th><Th>Expires</Th><Th>Last used</Th><Th>Verified</Th><Th>Used by</Th>
                </Tr></Thead>
                <Tbody>
                  {rows.map(c => {
                    const t = TEAM_BY_ID[c.team as string];
                    const used = usedAppsOf(c);
                    return (
                      <Tr key={String(c.name)} isClickable onClick={() => setDetail(c)}>
                        <Td dataLabel="Name"><b>{c.name}</b></Td>
                        <Td dataLabel="Kind">{dec(String(c.kind))}</Td>
                        <Td dataLabel="Owner team">{t?.name ?? c.team}</Td>
                        <Td dataLabel="Expires">
                          {c.expLabel
                            ? <>{c.expires} <Label color={c.expColor as 'green' | 'yellow'} isCompact>{c.expLabel}</Label></>
                            : <span className="u-muted">—</span>}
                        </Td>
                        <Td dataLabel="Last used">{c.lastUsed}</Td>
                        <Td dataLabel="Verified" onClick={e => e.stopPropagation()}>
                          <Label color={c.verColor as 'green' | 'red'} isCompact>{c.verifiedLabel}</Label>{' '}
                          <Button variant="secondary" size="sm" isDisabled={!canVerify}
                            title={canVerify ? undefined : 'Missing scope identities:verify'}>re-test</Button>
                        </Td>
                        <Td dataLabel="Used by">{used.length} application{used.length === 1 ? '' : 's'}</Td>
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>}
          <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-md)' }}>
            Ownership follows the tenancy model: every credential belongs to exactly one team (the team whose repositories consume it), the table shows the current scope only, and secret values are never displayed — expiry warnings at 30d, re-test before wave start, and revocation with the blast radius named before it lands · the readiness half lives on Migration waves (Credential readiness card); this surface is the management half
          </Content>
        </CardBody>
      </Card>
      <CredentialModal cred={detail} onClose={() => setDetail(null)} />
    </>
  );
}
