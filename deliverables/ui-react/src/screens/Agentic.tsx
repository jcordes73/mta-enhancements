import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, CardBody, CardHeader, CardTitle, Content, ContentVariants,
  Form, FormGroup, Label, Modal, ModalHeader, ModalBody, ModalFooter, Pagination, Tabs, Tab, TabTitleText,
  TextInput, Title,
} from '@patternfly/react-core';
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';
import { useApp, useScoped, can } from '../state/appState';
import { useHub, type HubData } from '../api/hub';
import { api } from '../api/client';
import { dec } from '../utils/decode';
import { RhIcon } from '../components/RhIcon';

type WfRun = HubData['wfruns'][number];
type AgentRun = HubData['agentRuns'][number];
type Agent = HubData['agents'][number];
type Skill = HubData['skills'][number];
type Workflow = HubData['workflows'][number];

const AG_TABS = ['wfruns', 'agentruns', 'workflows', 'agents', 'skills', 'gateways'] as const;
type AgTab = (typeof AG_TABS)[number];

/* ---------- shared bits (ports of stateLabel / icon buttons) ---------- */
function StateLabel({ st }: { st: string }) {
  const map: Record<string, 'green' | 'red' | 'blue' | 'purple' | 'orange'> = {
    succeeded: 'green', failed: 'red', running: 'blue', paused: 'purple', cancelled: 'orange',
  };
  const color = map[st];
  return color
    ? <Label color={color} isCompact>{st.charAt(0).toUpperCase() + st.slice(1)}</Label>
    : <Label variant="outline" isCompact>Queued</Label>;
}

function AppLink({ name }: { name: string }) {
  return <a href="#scr=inventory">{name}</a>;
}

function IconBtn({ icon, scope, label, title, onClick }: {
  icon: string; scope: string; label: string; title: string; onClick?: () => void;
}) {
  const { state } = useApp();
  const ok = can(state.persona, scope.split(':')[1], scope.split(':')[0]);
  return (
    <Button variant="plain" aria-label={label} title={ok ? title : `Missing scope ${scope}`}
      isDisabled={!ok} onClick={e => { e.stopPropagation(); onClick?.(); }}
      icon={<RhIcon name={icon} />} />
  );
}

/* armed two-step delete (the dataset.armed contract): trash → warning + pf-m-danger */
function DeleteBtn({ armed, scope, onArm, onConfirm }: {
  armed: boolean; scope: string; onArm: () => void; onConfirm: () => void;
}) {
  const { state } = useApp();
  const ok = can(state.persona, scope.split(':')[1], scope.split(':')[0]);
  return (
    <Button variant="plain" isDisabled={!ok}
      className={armed ? 'armed-delete' : undefined}
      title={armed ? 'Confirm delete' : ok ? 'Delete' : `Missing scope ${scope}`}
      aria-label={armed ? 'Confirm delete' : 'Delete'}
      onClick={e => { e.stopPropagation(); if (armed) onConfirm(); else onArm(); }}
      icon={<RhIcon name={armed ? 'warning' : 'trash'} />} />
  );
}

/* ---------- run detail modal (port of openAgentRunDetail + tpl-drawer-wfrun-full) ---------- */
const parseTok = (v: unknown) => {
  const m = /^([\d.]+)(M|k)/.exec(String(v ?? '').trim());
  return m ? parseFloat(m[1]) * (m[2] === 'M' ? 1e6 : 1e3) : (parseInt(String(v).replace(/\D/g, ''), 10) || 0);
};
const fmtTok = (n: number) => (n >= 1e6 ? (Math.round(n / 1e5) / 10) + 'M' : Math.round(n / 1e3) + 'k');

const AI_SPARKLE = 'M26.031 16.962a11.932 11.932 0 0 1-10.999-11c-.041-.52-.516-.961-1.038-.961s-.996.442-1.038.962A11.93 11.93 0 0 1 1.965 16.962c-.524.037-.97.514-.97 1.038 0 .521.442.997.962 1.038a11.933 11.933 0 0 1 11 11c.041.52.516.961 1.037.961.522 0 .997-.442 1.039-.962A11.931 11.931 0 0 1 26.03 19.038c.52-.042.962-.516.962-1.038 0-.521-.442-.997-.962-1.038Zm-12.037 8.803A13.888 13.888 0 0 0 6.228 18a13.898 13.898 0 0 0 7.767-7.766A13.888 13.888 0 0 0 21.76 18a13.899 13.899 0 0 0-7.767 7.766ZM30.502 7c0 .29-.209.536-.498.59a5.523 5.523 0 0 0-4.417 4.417c-.054.289-.3.498-.59.498s-.536-.21-.59-.498A5.52 5.52 0 0 0 19.99 7.59c-.289-.054-.498-.3-.498-.59s.21-.536.498-.59a5.52 5.52 0 0 0 4.417-4.417c.054-.289.301-.498.59-.498s.536.21.59.498a5.523 5.523 0 0 0 4.417 4.417c.289.054.498.3.498.59Z';

function AiMarker() {
  return (
    <span className="ai-marker" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--rh-space-xs)', color: 'var(--rh-color-purple-60)', fontSize: 'var(--rh-font-size-body-text-sm)' }}>
      <svg className="fas" viewBox="0 0 32 32" aria-hidden="true" focusable="false" style={{ width: '1em', height: '1em', fill: 'currentColor' }}><path d={AI_SPARKLE} /></svg>
      AI-generated
    </span>
  );
}

function DetailCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ border: '1px solid var(--pf-t--global--border--color--subtle)', borderRadius: 'var(--pf-t--global--border--radius--medium)', marginTop: 'var(--rh-space-lg)', padding: 'var(--rh-space-lg)', ...style }}>
      {children}
    </div>
  );
}

/* per-stage agent-loop telemetry (mock defect-log row 105): the composed line
   keeps ONE text node per segment so the legacy i18n walker's exact-node dict
   keys ("Agent loop ", " turns · context ") hit — never concatenate. */
function LoopTelemetry({ turns, ctx, live }: { turns: number | null; ctx: string | null; live?: boolean }) {
  if (turns == null && !ctx) return null;
  return (
    <Content component={ContentVariants.small} style={{ marginTop: 'var(--rh-space-xs)' }}>
      Agent loop <b>{turns ?? '—'}</b> turns · context <b>{ctx ?? '—'}</b>
      {live && <> <Label color="blue" isCompact>live</Label></>}
    </Content>
  );
}

/* shared bottom pager (mock defect-log row 106: the seven secondary tables
   page; hidden at zero results per row 87) */
function TablePager({ count, page, perPage, onSet }: {
  count: number; page: number; perPage: number; onSet: (page: number, perPage: number) => void;
}) {
  if (count === 0) return null;
  return (
    <Pagination
      itemCount={count} page={page} perPage={perPage} variant="bottom" isCompact
      onSetPage={(_e, p) => onSet(p, perPage)}
      onPerPageSelect={(_e, pp) => onSet(1, pp)}
      style={{ marginTop: 'var(--rh-space-md)' }}
    />
  );
}

function RunDetailModal({ rec, onClose, onJump }: {
  rec: { kind: 'wfrun' | 'agentrun'; wf?: WfRun; run?: AgentRun } | null;
  onClose: () => void;
  onJump: (kind: 'wfrun' | 'agentrun', id: string) => void;
}) {
  const hub = useHub();   // unconditional: the modal body branches below
  if (!rec) return null;
  const isWf = rec.kind === 'wfrun';
  const wf = rec.wf;
  const run = rec.run;

  /* canonical completed run WR-8 opens the rich sampled record */
  if (isWf && wf && wf.canonical) {
    return (
      <Modal variant="large" isOpen onClose={onClose} aria-label="Workflow run record">
        <ModalHeader title={<>Workflow run WR-8 — spring-boot-to-quarkus <Label color="green">Succeeded</Label> <AiMarker /></>} labelId="wfrun-full-title" />
        <ModalBody>
          <Content component={ContentVariants.small} className="u-muted">
            <a href="#scr=inventory">payments-api</a> · plan → execute → verify · started by a.weber@northwind-financial.com · 1h 12m
          </Content>
          <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-xs)' }}>
            Stage records (one agent run per stage): <a href="#" onClick={e => { e.preventDefault(); onJump('agentrun', '23'); }}>#23 plan</a> → <a href="#" onClick={e => { e.preventDefault(); onJump('agentrun', '24'); }}>#24 execute</a> → <a href="#" onClick={e => { e.preventDefault(); onJump('agentrun', '25'); }}>#25 verify</a>
          </Content>
          <DetailCard>
            <Content component={ContentVariants.small} className="u-muted" style={{ marginBottom: 'var(--rh-space-md)' }}>Token accounting</Content>
            <Table aria-label="Token accounting" variant="compact">
              <Thead><Tr><Th>Stage (agent run)</Th><Th>Turns</Th><Th>Peak context</Th><Th>Prompt</Th><Th>Completion</Th><Th>Total</Th></Tr></Thead>
              <Tbody>
                <Tr><Td>plan — <a href="#" onClick={e => { e.preventDefault(); onJump('agentrun', '23'); }}>#23</a></Td><Td>9</Td><Td>40,979 / 128,000 (32%)</Td><Td>96,204</Td><Td>11,382</Td><Td>107,586</Td></Tr>
                <Tr><Td>execute — <a href="#" onClick={e => { e.preventDefault(); onJump('agentrun', '24'); }}>#24</a></Td><Td>31</Td><Td>96,412 / 128,000 (75%)</Td><Td>210,441</Td><Td>21,083</Td><Td>231,524</Td></Tr>
                <Tr><Td>verify — <a href="#" onClick={e => { e.preventDefault(); onJump('agentrun', '25'); }}>#25</a></Td><Td>12</Td><Td>51,208 / 128,000 (40%)</Td><Td>64,559</Td><Td>9,191</Td><Td>73,750</Td></Tr>
                <Tr><Td><b>run total</b></Td><Td><b>52</b></Td><Td /><Td><b>371,204</b></Td><Td><b>41,656</b></Td><Td><b>412,860</b></Td></Tr>
              </Tbody>
            </Table>
            <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-md)' }}>
              Est. cost <b>$12.40</b> · gateway <a href="#scr=config">llm-gateway-1 (granite-3.3-70b)</a> · stage images digest-pinned
            </Content>
          </DetailCard>
          <Alert variant="info" isInline title="Run record vs. live transcript" style={{ marginTop: 'var(--rh-space-lg)' }}>
            <p>The live chat transcript is ephemeral by upstream design (workspaces are ephemeral; git is the persistence layer). This record keeps the audit trail: parameters, token usage, outcome, and the commit list on the target branch.</p>
          </Alert>
          <DetailCard>
            <div style={{ fontWeight: 600, marginBottom: 'var(--rh-space-xs)' }}>Proposal review</div>
            <Content component={ContentVariants.small} className="u-muted" style={{ marginBottom: 'var(--rh-space-md)' }}>
              14 files changed · 6 issues addressed · verification suite green (payments-contract, kafka-consumer re-run clean)
            </Content>
            <div style={{ display: 'flex', gap: 'var(--pf-t--global--spacer--sm)', flexWrap: 'wrap' }}>
              <Button variant="primary">Accept proposal</Button>
              <Button variant="secondary">Reject</Button>
              <Button variant="link">View change report</Button>
            </div>
            <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-md)' }}>
              Acceptance writes the solution back to the Solution Server — <code>get_solved_examples</code> returns it to future runs of this cohort
            </Content>
          </DetailCard>
          <DetailCard>
            <div style={{ fontWeight: 600, marginBottom: 'var(--rh-space-xs)' }}>Sandbox &amp; guardrails — OpenShell</div>
            <Table aria-label="Sandbox controls" variant="compact">
              <Thead><Tr><Th>Control</Th><Th>This run</Th></Tr></Thead>
              <Tbody>
                <Tr><Td>Policy</Td><Td><code>agent-policy-v3</code> <Label color="green" isCompact>formally verified</Label></Td></Tr>
                <Tr><Td>Network allowlist (per binary)</Td><Td>MCP endpoint + project git remote only · credentials injected at the boundary, never inside the sandbox</Td></Tr>
              </Tbody>
            </Table>
            <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-md)' }}>OCSF denial events (this run)</Content>
            <Table aria-label="OCSF denial events" variant="compact" style={{ marginTop: 'var(--rh-space-xs)' }}>
              <Tbody>
                <Tr><Td><code>OCSF 4002</code> network connect → <code>registry.internal:443</code> — <b>denied</b> (outside allowlist)</Td><Td>execute · 2×</Td></Tr>
                <Tr><Td><code>OCSF 4001</code> file write outside workspace — <b>denied</b></Td><Td>plan · 1×</Td></Tr>
              </Tbody>
            </Table>
            <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-md)' }}>
              Adversarial evaluation: 4 red-team scenarios — 3 passed, 1 flagged (prompt-injection via a <code>pom.xml</code> comment; contained by the sandbox, no exfiltration)
            </Content>
          </DetailCard>
          <div style={{ marginTop: 'var(--rh-space-lg)', display: 'flex', gap: 'var(--pf-t--global--spacer--sm)', flexWrap: 'wrap' }}>
            <Button variant="secondary">Download run record (JSON)</Button>
            <Button variant="link">Export usage to MaaS showback CSV</Button>
          </div>
        </ModalBody>
      </Modal>
    );
  }

  /* workflow run → pipeline of its stage-level agent runs + per-stage cards + run total */
  if (isWf && wf) {
    const kids = (hub.data.agentRuns as AgentRun[]).filter(r => r.wr === wf.name);
    const phaseRank = (k: AgentRun) => String(k.phase).includes('plan') ? 0 : String(k.phase).includes('execute') ? 1 : 2;
    const sorted = [...kids].sort((a, b) => (phaseRank(a) - phaseRank(b)) || String(a.id).localeCompare(String(b.id)));
    const stateColor = (st: string) => st === 'succeeded' ? 'var(--pf-t--global--color--status--success--default)'
      : st === 'failed' ? 'var(--pf-t--global--color--status--danger--default)'
      : st === 'running' ? 'var(--pf-t--global--color--status--info--default)'
      : st === 'paused' ? 'var(--pf-t--global--color--status--custom--default, var(--rh-color-purple-40))'
      : 'var(--pf-t--global--color--status--warning--default)';
    const pSum = sorted.reduce((t, k) => t + parseTok(String(k.tokDetail || '0/0').split('/')[0]), 0);
    const cSum = sorted.reduce((t, k) => t + parseTok(String(k.tokDetail || '0/0').split('/')[1] || '0'), 0);
    const cTotal = sorted.reduce((t, k) => t + (parseFloat(String(k.cost).replace(/[^0-9.]/g, '')) || 0), 0);
    return (
      <Modal variant="large" isOpen onClose={onClose} aria-label="Workflow run detail">
        <ModalHeader title={<>Workflow run {wf.name} — {dec(String(wf.wf))} <StateLabel st={String(wf.state)} /></>} labelId="wfrun-title" />
        <ModalBody>
          <Content component={ContentVariants.small} className="u-muted">
            <a href="#scr=inventory">{wf.app}</a> · {wf.phase} · {wf.stages} stages · {dec(String(wf.duration))}
          </Content>
          {wf.state === 'failed' && <Alert variant="danger" isInline title="Failed — cause" style={{ marginTop: 'var(--rh-space-lg)' }}><p>{dec(String(wf.reason || ''))}</p></Alert>}
          <div style={{ marginTop: 'var(--rh-space-lg)' }}>
            <Content component={ContentVariants.small} className="u-muted" style={{ marginBottom: 'var(--rh-space-md)' }}>
              Agent runs composing this workflow run
            </Content>
            {!kids.length
              ? <span className="u-muted">No agent-run records linked — a workflow run should always carry its stage-level records.</span>
              : <>
                <div data-pipeline="1" style={{ display: 'flex', alignItems: 'stretch', flexWrap: 'wrap', marginBottom: 'var(--rh-space-xs)' }}>
                  {sorted.map((k, i) => (
                    <Fragment key={String(k.id)}>
                      {i > 0 && <div style={{ display: 'flex', alignItems: 'center', padding: '0 var(--rh-space-xs)' }}><span className="u-muted" style={{ display: 'inline-flex' }}><RhIcon name="arrow-right" /></span></div>}
                      <div style={{ border: '1px solid var(--pf-t--global--border--color--subtle)', borderLeft: `3px solid ${stateColor(String(k.state))}`, borderRadius: 'var(--pf-t--global--border--radius--small)', padding: 'var(--rh-space-md)', minWidth: 150 }}>
                        <div className="u-muted u-meta">{k.phase}</div>
                        <div style={{ marginTop: 'var(--rh-space-xs)' }}>
                          <b><a href="#" onClick={e => { e.preventDefault(); onJump('agentrun', String(k.id)); }}>#{k.id}</a></b> <StateLabel st={String(k.state)} />
                        </div>
                        <div className="u-muted u-meta" style={{ marginTop: 'var(--rh-space-xs)' }}>{String(k.agent).split('/')[0].split(' (')[0]} · {dec(String(k.duration))}</div>
                      </div>
                    </Fragment>
                  ))}
                </div>
                {sorted.map(k => (
                  <DetailCard key={`card-${k.id}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--rh-space-lg)', alignItems: 'baseline' }}>
                      <span><b><a href="#" onClick={e => { e.preventDefault(); onJump('agentrun', String(k.id)); }}>#{k.id} {dec(String(k.name))}</a></b> <StateLabel st={String(k.state)} /></span>
                      <span className="u-muted u-meta">{dec(String(k.duration))}</span>
                    </div>
                    <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-xs)' }}>{k.agent} · {k.phase}</Content>
                    {k.events && (
                      <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-xs)' }}>
                        Latest event <span className="u-meta">({k.events[k.events.length - 1][0]})</span>: {k.events[k.events.length - 1][1]}
                      </Content>
                    )}
                    {k.reason && k.state === 'failed'
                      ? <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-xs)' }}><b>Failed</b> — {dec(String(k.reason))}</Content>
                      : k.reason
                        ? <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-xs)' }}><b>{String(k.state).charAt(0).toUpperCase() + String(k.state).slice(1)}</b> — {dec(String(k.reason))}</Content>
                        : null}
                    <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-md)' }}>
                      Token accounting: <b>{dec(String(k.tokens))}</b>{k.tokDetail ? <span className="u-meta"> ({k.tokDetail} prompt/completion)</span> : ''} · est. cost <b>{dec(String(k.cost))}</b> · gateway {k.gw} ({k.model}) · image <code>{k.image}</code>
                    </Content>
                    <LoopTelemetry turns={k.turns} ctx={k.ctx} live={k.state === 'running'} />
                  </DetailCard>
                ))}
                <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-md)', borderTop: '1px solid var(--pf-t--global--border--color--subtle)', paddingTop: 'var(--rh-space-md)' }}>
                  Run total: <b>{sorted.length} agent run{sorted.length === 1 ? '' : 's'}</b> · <b>{fmtTok(pSum)}/{fmtTok(cSum)}</b> prompt/completion · est. cost <b>${cTotal.toFixed(2)}</b>
                </Content>
              </>}
          </div>
          <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-lg)' }}>
            Proposal review, the sandbox envelope, and the stage table are shown on the sampled workflow-run record (the canonical completed run).
          </Content>
        </ModalBody>
      </Modal>
    );
  }

  /* agent run → token accounting + structured event stream + mandatory parent link */
  if (run) {
    return (
      <Modal variant="large" isOpen onClose={onClose} aria-label="Agent run record">
        <ModalHeader title={<>Run #{run.id} — {dec(String(run.name))} <StateLabel st={String(run.state)} /></>} labelId="agentrun-title" />
        <ModalBody>
          <Content component={ContentVariants.small} className="u-muted">
            <a href="#scr=inventory">{run.app}</a> · {run.phase} · {dec(String(run.duration))}
          </Content>
          {run.state === 'failed' && run.reason && (
            <Alert variant="danger" isInline title="Failed — cause" style={{ marginTop: 'var(--rh-space-lg)' }}><p>{dec(String(run.reason))}</p></Alert>
          )}
          <DetailCard>
            <Content component={ContentVariants.small} className="u-muted" style={{ marginBottom: 'var(--rh-space-md)' }}>Token accounting</Content>
            <div style={{ fontSize: 'var(--rh-font-size-body-text-xl)', fontWeight: 600 }}>
              {dec(String(run.tokens))}
              {run.tokDetail ? <span className="u-muted" style={{ fontSize: 'var(--rh-font-size-body-text-xs)', fontWeight: 400 }}> {run.tokDetail} prompt/completion</span> : null}
            </div>
            <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-md)' }}>
              Est. cost <b>{dec(String(run.cost))}</b> · gateway <a href="#scr=config">{run.gw} ({run.model})</a> → · agent image <code>{run.image}</code>
            </Content>
            <LoopTelemetry turns={run.turns} ctx={run.ctx} live={run.state === 'running'} />
          </DetailCard>
          {run.events && (
            <DetailCard>
              <Content component={ContentVariants.small} className="u-muted" style={{ marginBottom: 'var(--rh-space-md)' }}>
                Run events{run.state === 'running' ? <> — <b>live tail</b> <Label color="blue" isCompact>events so far</Label></> : run.state === 'paused' ? ' — paused at the last checkpoint — the tail resumes with the run' : ''}
              </Content>
              {run.events.map((e, i) => (
                <div key={i} style={{ display: 'flex', gap: 'var(--rh-space-md)', marginTop: 'var(--rh-space-xs)', fontSize: 'var(--rh-font-size-body-text-xs)', alignItems: 'baseline' }}>
                  <code style={{ whiteSpace: 'nowrap' }}>{e[0]}</code>
                  <span style={String(e[1]).startsWith('FAILED') ? { color: 'var(--pf-t--global--color--status--danger--default)' } : String(e[1]).startsWith('SUCCEEDED') ? { color: 'var(--pf-t--global--color--status--success--default)' } : undefined}>{e[1]}</span>
                </div>
              ))}
            </DetailCard>
          )}
          <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-lg)' }}>
            Parent workflow run: <a href="#" onClick={e => { e.preventDefault(); onJump('wfrun', String(run.wr)); }}>{run.wr} →</a>
          </Content>
          <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-lg)' }}>
            Proposal review, sandbox envelope, and the live-transcript boundary are shown on the sampled workflow-run record (Reports → Workflow runs).
          </Content>
        </ModalBody>
      </Modal>
    );
  }
  return null;
}

/* ---------- small create-modal helper ---------- */
function SmallCreateModal({ title, isOpen, onClose, onSubmit, submitLabel, children }: {
  title: string; isOpen: boolean; onClose: () => void; onSubmit: () => void; submitLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Modal variant="small" isOpen={isOpen} onClose={onClose} aria-label={title}>
      <ModalHeader title={title} labelId="create-modal-title" />
      <ModalBody><Form onSubmit={e => { e.preventDefault(); onSubmit(); }}>{children}</Form></ModalBody>
      <ModalFooter>
        <Button variant="primary" onClick={onSubmit}>{submitLabel}</Button>
        <Button variant="link" onClick={onClose}>Cancel</Button>
      </ModalFooter>
    </Modal>
  );
}

/* ---------- the screen ---------- */
export function Agentic() {
  const { state } = useApp();
  const { apps } = useScoped();
  const { data, reload } = useHub();
  const names = useMemo(() => new Set(apps.map(a => a.name as string)), [apps]);

  /* mutable registries — seeded from the hub; creates/deletes are REAL writes
     (POST/DELETE on the hub API + reload); run lifecycle (pause/resume/cancel)
     is client-side: the verbs are not yet in the hub contract (documented in
     MIGRATION.md), the rows themselves are hub data. */
  const [wfRuns, setWfRuns] = useState<WfRun[]>(() => data.wfruns as WfRun[]);
  const [runs, setRuns] = useState<AgentRun[]>(() => data.agentRuns as AgentRun[]);
  const [agents, setAgents] = useState<Agent[]>(() => data.agents as Agent[]);
  const [skills, setSkills] = useState<Skill[]>(() => data.skills as Skill[]);
  const [workflows, setWorkflows] = useState<Workflow[]>(() => data.workflows as Workflow[]);
  useEffect(() => {
    setWfRuns(data.wfruns as WfRun[]);
    setRuns(data.agentRuns as AgentRun[]);
    setAgents(data.agents as Agent[]);
    setSkills(data.skills as Skill[]);
    setWorkflows(data.workflows as Workflow[]);
  }, [data]);

  /* tab — deep-linkable (&tab=, same grammar as the mock's agTabApply; lives in appState) */
  const { set } = useApp();
  const tab: AgTab = (AG_TABS as readonly string[]).includes(state.agTab || '') ? (state.agTab as AgTab) : 'wfruns';
  const setTab = (t: AgTab) => set({ agTab: t });

  /* armed-delete state per row (one at a time, like the mock's dataset.armed) */
  const [armed, setArmed] = useState<string | null>(null);
  const [delFinishedArmed, setDelFinishedArmed] = useState(false);

  /* record modal + create modal + info alert */
  const [detail, setDetail] = useState<{ kind: 'wfrun' | 'agentrun'; wf?: WfRun; run?: AgentRun } | null>(null);
  const [create, setCreate] = useState<null | 'wfrun' | 'run' | 'wf' | 'agent' | 'skill'>(null);
  const [msg, setMsg] = useState<React.ReactNode | null>(null);

  /* create-form state */
  const [fWf, setFWf] = useState(''); const [fApp, setFApp] = useState('');
  const [fName, setFName] = useState(''); const [fErr, setFErr] = useState<string | null>(null);
  const [fStages, setFStages] = useState(3);
  const [fDisplay, setFDisplay] = useState('');

  const closeCreate = () => { setCreate(null); setFErr(null); setFName(''); setFDisplay(''); };

  /* jump-to-run (ports of jumpToAgentRun / jumpToWfRun): switch tab + open the record */
  const jump = (kind: 'wfrun' | 'agentrun', id: string) => {
    if (kind === 'wfrun') {
      const wf = wfRuns.find(r => r.name === id);
      if (wf) { setTab('wfruns'); setDetail({ kind: 'wfrun', wf }); }
    } else {
      const run = runs.find(r => String(r.id) === id);
      if (run) { setTab('agentruns'); setDetail({ kind: 'agentrun', run }); }
    }
  };

  const canCreate = can(state.persona, 'create', 'runs');
  const canAgentsCreate = can(state.persona, 'create', 'agents');
  const canRunsDelete = can(state.persona, 'delete', 'runs');
  const who = { architect: 'a.weber (architect)', pm: 'm.pm (project manager)', pgm: 'p.program (program manager)', migrator: 'm.migrator (migrator)', admin: 'admin (org admin)', padmin: 'platform-admin' }[state.persona] || state.persona;

  /* lifecycle verbs — ports of runStop / runCancel / runResume with propagation */
  const flip = (rec: { state: unknown; duration: unknown; reason?: unknown; events?: unknown[][] }, to: string, dur: string, reason: string, ev: string) => {
    rec.state = to; rec.duration = dur;
    if (reason) rec.reason = rec.reason || reason; else rec.reason = '';
    if (rec.events) rec.events.push([evNextTs(rec), ev]);
  };
  const propagate = (store: AgentRun[] | WfRun[], match: (r: AgentRun | WfRun) => boolean, to: string, parentName: string, verb: string) => {
    const extra: string[] = [];
    store.forEach(x => {
      if (!match(x)) return;
      flip(x, to, String(x.duration).replace(' so far', to === 'cancelled' ? ' (cancelled)' : to === 'paused' ? ' (paused)' : ' so far'),
        `${to} with parent ${parentName} by ${who}`, `${verb} — ${to === 'cancelled' ? 'stage CANCELLED' : to === 'paused' ? 'run stopped — paused at the last checkpoint (resumable; quota spend halted)' : 'run resumed — continuing from the last checkpoint'} — by ${who}`);
      extra.push('#' + (x.id ?? x.name));
    });
    return extra;
  };
  const lifecycle = (kind: 'wfrun' | 'agentrun', id: string | number, to: 'cancelled' | 'paused' | 'running') => {
    const isWf = kind === 'wfrun';
    const store = isWf ? wfRuns : runs;
    const key = isWf ? 'name' : 'id';
    const r = store.find(x => String(x[key]) === String(id));
    if (!r) return;
    const from = String(r.state);
    if (to === 'running') { if (from !== 'paused') return; } else if (from !== 'running') return;
    const dur = to === 'cancelled' ? String(r.duration).replace(' so far', '') + ' (cancelled)'
      : to === 'paused' ? String(r.duration).replace(' so far', ' (paused)')
      : String(r.duration).replace(' (paused)', ' so far');
    const reason = to === 'cancelled' ? `cancelled by ${who} — quota slot freed`
      : to === 'paused' ? `stopped by ${who} — paused at the last checkpoint, resumable` : '';
    const ev = to === 'cancelled' ? `stage CANCELLED — by ${who}`
      : to === 'paused' ? `run stopped — paused at the last checkpoint (resumable; quota spend halted) — by ${who}`
      : `run resumed — continuing from the last checkpoint — by ${who}`;
    flip(r, to, dur, reason, ev);
    /* propagation: one agent run = one stage of a workflow run */
    const extra: string[] = [];
    if (isWf) {
      const stageRuns = runs as AgentRun[];
      extra.push(...propagate(stageRuns,
        to === 'cancelled' ? (x => (x as AgentRun).wr === r.name && (x.state === 'running' || x.state === 'queued'))
          : to === 'paused' ? (x => (x as AgentRun).wr === r.name && x.state === 'running')
          : (x => (x as AgentRun).wr === r.name && x.state === 'paused'),
        to, String(r.name), to === 'cancelled' ? 'cancelled' : to === 'paused' ? 'stopped' : 'resumed'));
    } else {
      const p = wfRuns.find(x => x.name === (r as AgentRun).wr);
      if (p && (to === 'running' ? p.state === 'paused' : p.state === 'running')) {
        flip(p, to, String(p.duration).replace(' so far', to === 'cancelled' ? ' (cancelled)' : to === 'paused' ? ' (paused)' : ' so far'),
          `stage #${r.id} ${to} by ${who} — a workflow cannot proceed past a ${to === 'cancelled' ? 'cancelled' : 'paused'} stage`,
          `${to === 'cancelled' ? 'stage CANCELLED' : to === 'paused' ? 'run stopped — paused at the last checkpoint (resumable; quota spend halted)' : 'run resumed — continuing from the last checkpoint'} — by ${who}`);
        extra.push(String(p.name));
      }
    }
    setRuns([...runs]); setWfRuns([...wfRuns]);
    const label = isWf ? String(r.name) : '#' + r.id;
    const verbTxt = to === 'cancelled' ? 'cancelled — the record is kept with its partial accounting; cancellation is a state change, not a deletion. The quota slot is freed.'
      : to === 'paused' ? 'stopped — paused at the last checkpoint; checkpoints and the workspace branch are preserved and the run can be resumed (runs:pause). Model quota spend is halted.'
      : 'resumed — continuing from the last checkpoint; no checkpointed work is repeated.';
    setMsg(<>(<b>{label} {to === 'paused' ? 'stopped' : to}</b> — {verbTxt}{extra.length ? <> <b>Propagation:</b> {extra.join(', ')} {to === 'paused' ? 'stopped' : to} with it.</> : null})</>);
  };

  /* create flows — REAL writes against the hub API, then a reload re-derives
     the registries (the backend owns age/consumer/count derivation). RBAC is
     the token's: the backend maps realm roles to scopes; the UI gates via
     can(persona, …). */
  const doCreate = async () => {
    const send = (path: string, body: unknown) =>
      api(path, { method: 'POST', body });
    try {
      if (create === 'wfrun' || create === 'run') {
        const wf = fWf || String((workflows.find(w => w.ready) || workflows[0] || {}).name || '');
        const app = fApp || apps[0]?.name as string || '';
        const nums = wfRuns.map(r => parseInt(String(r.name).replace(/\D/g, ''), 10) || 0);
        const name = 'WR-' + (Math.max(0, ...nums) + 1);
        await send('/workflow-runs', { name, workflow: wf, application: app, phase: create === 'run' ? 'plan' : 'plan' });
        setMsg(<>Created workflow run <b>{name}</b> ({wf} → {app}) on the hub — queued.{' '}
          {create === 'run' ? 'Its stages decompose into agent runs (one agent run = one stage); they appear as the hub executes them.' : 'Open its row for the run record.'}</>);
        closeCreate(); setTab('wfruns'); reload();
      } else if (create === 'wf') {
        const name = fName.trim();
        if (!name) { setFErr('Name is required.'); return; }
        if (workflows.some(w => w.name === name)) { setFErr('This workflow already exists.'); return; }
        await send('/workflows', { name, stages: fStages });
        closeCreate(); setTab('workflows'); reload();
      } else if (create === 'agent') {
        const name = fName.trim();
        if (!name) { setFErr('Name is required.'); return; }
        if (agents.some(a => a.name === name)) { setFErr('This agent already exists.'); return; }
        await send('/agents', { name, image: 'quay.io/example/agent@sha256:unpinned' });
        closeCreate(); setTab('agents'); reload();
      } else if (create === 'skill') {
        const name = fName.trim();
        if (!name) { setFErr('Name is required.'); return; }
        if (skills.some(k => k.name === name)) { setFErr('This skill already exists.'); return; }
        await send('/skills', { name, display: fDisplay.trim() || name, type: 'CUSTOM', source: 'org registry' });
        closeCreate(); setTab('skills'); reload();
      }
    } catch (e) {
      setFErr(e instanceof Error ? e.message : String(e));
    }
  };

  /* registry deletes — REAL writes; the hub enforces the same guard rails
     (in-use 409s) and the guards below give the friendly message first */
  const del = (path: string, ok: () => void) => {
    api(path, { method: 'DELETE' })
      .then(() => { ok(); reload(); })
      .catch(e => setMsg(<>Delete failed on the hub: <b>{e instanceof Error ? e.message : String(e)}</b></>));
  };
  const deleteAgent = (name: string) => {
    const rec = agents.find(a => a.name === name);
    if (!rec) return;
    del(`/agents/${rec.id}`, () => setMsg(<>Deleted agent <b>{name}</b> on the hub. Its skills remain in the registry; workflow bindings must be re-validated.</>));
    setArmed(null);
  };
  const deleteSkill = (name: string) => {
    const used = agents.filter(a => String(a.skills).includes(name));
    if (used.length) {
      setArmed(null);
      setMsg(<>Cannot delete skill <b>{name}</b>: still bound to {used.length} agent{used.length === 1 ? '' : 's'} ({used.map(a => a.name).join(', ')}) — unbind first.</>);
      return;
    }
    const rec = skills.find(k => k.name === name);
    if (!rec) return;
    del(`/skills/${rec.id}`, () => setArmed(null));
  };
  const deleteWorkflow = (name: string) => {
    const used = wfRuns.filter(r => r.wf === name);
    if (used.length) {
      setArmed(null);
      setMsg(<>Cannot delete workflow <b>{name}</b>: {used.length} run{used.length === 1 ? '' : 's'} reference{used.length === 1 ? 's' : ''} it (WR history is a record) — delete the runs first.</>);
      return;
    }
    const rec = workflows.find(w => w.name === name);
    if (!rec) return;
    del(`/workflows/${rec.id}`, () => setArmed(null));
  };
  const deleteFinished = () => {
    if (delFinishedArmed) {
      /* finished-run cleanup is a registry-hygiene demo (no hub verb yet) —
         client-side, exactly like the run lifecycle */
      const kept = runs.filter(r => r.state === 'running' || r.state === 'queued');
      const removed = runs.length - kept.length;
      setRuns(kept); setDelFinishedArmed(false);
      setMsg(<>Deleted <b>{removed}</b> finished run{removed === 1 ? '' : 's'} (local view). The hub keeps the run records — run-record deletion is not part of the contract yet (MIGRATION.md).</>);
    } else setDelFinishedArmed(true);
  };

  const scopedWf = wfRuns.filter(r => names.has(r.app as string));
  const scopedRuns = runs.filter(r => names.has(r.app as string));
  const finishedN = scopedRuns.filter(r => !['running', 'queued', 'paused'].includes(String(r.state))).length;

  /* pagination (mock defect-log row 106): the five agentic tables page, 10 per
     page — PF6 Pagination slicing the in-memory rows; hidden at zero results
     (row 87). Page clamps when a reload shrinks the store. */
  const [pgState, setPgState] = useState<Record<string, { page: number; perPage: number }>>({
    wfruns: { page: 1, perPage: 10 }, agentruns: { page: 1, perPage: 10 },
    workflows: { page: 1, perPage: 10 }, agents: { page: 1, perPage: 10 },
    skills: { page: 1, perPage: 10 },
  });
  const paged = <T,>(tab: string, rows: T[]) => {
    const { page, perPage } = pgState[tab];
    const pages = Math.max(1, Math.ceil(rows.length / perPage));
    const p = Math.min(page, pages);
    return { rows: rows.slice((p - 1) * perPage, p * perPage), page: p, perPage, count: rows.length };
  };
  const wfrP = paged('wfruns', scopedWf);
  const runP = paged('agentruns', scopedRuns);
  const wfP = paged('workflows', workflows);
  const agP = paged('agents', agents);
  const skP = paged('skills', skills);

  const emptyRow = (cols: number, text: React.ReactNode) => (
    <Tr><Td colSpan={cols}><span className="u-muted">{text}</span></Td></Tr>
  );

  return (
    <>
      <Title headingLevel="h1" size="2xl" className="page-title">Agentic</Title>
      <Content component={ContentVariants.p} className="page-subtitle">
        The migration factory&apos;s management surfaces — the upstream Agentic nav section, at its six routes, importance-ordered: operations first (runs), then registry definitions, then infrastructure
      </Content>
      <Tabs activeKey={tab} onSelect={(_e, k) => setTab(k as AgTab)} aria-label="Agentic sections" style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
        <Tab eventKey="wfruns" title={<TabTitleText>Workflow runs</TabTitleText>} aria-label="Workflow runs">
          <Card style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
            <CardHeader actions={{ actions: <Button variant="primary" size="sm" isDisabled={!canCreate} onClick={() => setCreate('wfrun')} title={canCreate ? undefined : 'Missing scope runs:create'}>Create workflow run</Button> }}>
              <CardTitle>Workflow runs</CardTitle>
            </CardHeader>
            <CardBody>
              <Table aria-label="Workflow runs" variant="compact">
                <Thead><Tr>
                  <Th>Name</Th><Th>Workflow</Th><Th>Application</Th><Th>Phase</Th><Th>Stages</Th><Th>State</Th><Th>Age</Th><Th>Duration</Th><Th screenReaderText="Actions" />
                </Tr></Thead>
                <Tbody>
                  {scopedWf.length === 0 && emptyRow(10, <>No workflow runs in this scope — runs execute against applications in scope.</>)}
                  {wfrP.rows.map(r => (
                    <Tr key={String(r.name)} isClickable onClick={() => setDetail({ kind: 'wfrun', wf: r })}>
                      <Td dataLabel="Name"><b>{r.name}</b></Td>
                      <Td dataLabel="Workflow">{dec(String(r.wf))}</Td>
                      <Td dataLabel="Application"><AppLink name={r.app as string} /></Td>
                      <Td dataLabel="Phase">{r.phase}</Td>
                      <Td dataLabel="Stages">{r.stages}</Td>
                      <Td dataLabel="State"><StateLabel st={String(r.state)} /></Td>
                      <Td dataLabel="Age">{r.age}</Td>
                      <Td dataLabel="Duration">{dec(String(r.duration))}</Td>
                      <Td dataLabel="Actions" onClick={e => e.stopPropagation()}>
                        <DeleteBtn armed={armed === 'wf-' + r.name} scope="runs:delete"
                          onArm={() => setArmed('wf-' + r.name)}
                          onConfirm={() => { setWfRuns(wfRuns.filter(x => x.name !== r.name)); setArmed(null); }} />
                        {r.state === 'running' && <>
                          <IconBtn icon="pause" scope="runs:pause" label="Stop run" title="Stop the run — pauses at the last checkpoint, resumable (runs:pause)" onClick={() => lifecycle('wfrun', r.name as string, 'paused')} />
                          <IconBtn icon="close" scope="runs:cancel" label="Cancel run" title="Cancel the run — the record is kept (runs:cancel)" onClick={() => lifecycle('wfrun', r.name as string, 'cancelled')} />
                        </>}
                        {r.state === 'paused' && <IconBtn icon="play" scope="runs:pause" label="Resume run" title="Resume the run from its last checkpoint (runs:pause)" onClick={() => lifecycle('wfrun', r.name as string, 'running')} />}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
              <TablePager count={wfrP.count} page={wfrP.page} perPage={wfrP.perPage} onSet={(p, pp) => setPgState(s => ({ ...s, wfruns: { page: p, perPage: pp } }))} />
            </CardBody>
          </Card>
        </Tab>

        <Tab eventKey="agentruns" title={<TabTitleText>Agent runs</TabTitleText>} aria-label="Agent runs">
          <Card style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
            <CardHeader actions={{ actions: <>
              <Button variant="primary" size="sm" isDisabled={!canCreate} onClick={() => setCreate('run')} title={canCreate ? undefined : 'Missing scope runs:create'}>Create run</Button>{' '}
              <Button variant="secondary" size="sm" isDisabled={!canRunsDelete || finishedN === 0}
                onClick={deleteFinished}
                title={!canRunsDelete ? 'Missing scope runs:delete' : undefined}>
                {delFinishedArmed ? 'Confirm delete' : `Delete finished (${finishedN})`}
              </Button>
            </> }}>
              <CardTitle>Agent runs</CardTitle>
            </CardHeader>
            <CardBody>
              <Table aria-label="Agent runs" variant="compact">
                <Thead><Tr>
                  <Th>Name</Th><Th>Agent</Th><Th>Application</Th><Th>Phase</Th><Th>Reason</Th><Th>State</Th><Th>Age</Th><Th>Duration</Th><Th>Turns</Th><Th>Context</Th>
                </Tr></Thead>
                <Tbody>
                  {scopedRuns.length === 0 && emptyRow(10, <>No agent runs in this scope — runs execute against applications in scope. Create one from an application or the run wizard.</>)}
                  {runP.rows.map(r => (
                    <Tr key={String(r.id)} isClickable onClick={() => setDetail({ kind: 'agentrun', run: r })}>
                      <Td dataLabel="Name"><b>#{r.id}</b> {dec(String(r.name))}{r.events ? <><span className="u-muted">event log</span></> : null}</Td>
                      <Td dataLabel="Agent">{r.agent || <>{r.gw} · {r.model}</>}</Td>
                      <Td dataLabel="Application"><AppLink name={r.app as string} /></Td>
                      <Td dataLabel="Phase">{r.phase}</Td>
                      <Td dataLabel="Reason">{r.reason ? dec(String(r.reason)) : <span className="u-muted">—</span>}</Td>
                      <Td dataLabel="State"><StateLabel st={String(r.state)} /></Td>
                      <Td dataLabel="Age">{r.age}</Td>
                      <Td dataLabel="Duration">
                        {dec(String(r.duration))}{' '}
                        {r.state === 'running' && <>
                          <IconBtn icon="pause" scope="runs:pause" label="Stop run" title="Stop the run — pauses at the last checkpoint, resumable (runs:pause)" onClick={() => lifecycle('agentrun', String(r.id), 'paused')} />
                          <IconBtn icon="close" scope="runs:cancel" label="Cancel run" title="Cancel the run — the record is kept (runs:cancel)" onClick={() => lifecycle('agentrun', String(r.id), 'cancelled')} />
                        </>}
                        {r.state === 'paused' && <IconBtn icon="play" scope="runs:pause" label="Resume run" title="Resume the run from its last checkpoint (runs:pause)" onClick={() => lifecycle('agentrun', String(r.id), 'running')} />}
                      </Td>
                      <Td dataLabel="Turns">{r.turns ?? <span className="u-muted">—</span>}</Td>
                      <Td dataLabel="Context">{r.ctx ?? <span className="u-muted">—</span>}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
              <TablePager count={runP.count} page={runP.page} perPage={runP.perPage} onSet={(p, pp) => setPgState(s => ({ ...s, agentruns: { page: p, perPage: pp } }))} />
              <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-md)' }}>
                Most recent first · token/cost showback per run on the record, monthly rollup in Reports → Agent runs
              </Content>
            </CardBody>
          </Card>
        </Tab>

        <Tab eventKey="workflows" title={<TabTitleText>Workflows</TabTitleText>} aria-label="Workflows">
          <Card style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
            <CardHeader actions={{ actions: <Button variant="primary" size="sm" isDisabled={!canAgentsCreate} onClick={() => setCreate('wf')} title={canAgentsCreate ? undefined : 'Missing scope agents:create'}>Create workflow</Button> }}>
              <CardTitle>Workflows</CardTitle>
            </CardHeader>
            <CardBody>
              <Table aria-label="Workflows" variant="compact">
                <Thead><Tr><Th>Name</Th><Th>Stages</Th><Th>Guide</Th><Th>Ready</Th><Th>Age</Th><Th screenReaderText="Actions" /></Tr></Thead>
                <Tbody>
                  {wfP.rows.map(w => (
                    <Tr key={String(w.name)}>
                      <Td dataLabel="Name"><b><code>{w.name}</code></b></Td>
                      <Td dataLabel="Stages">{w.stages}</Td>
                      <Td dataLabel="Guide">{dec(String(w.guide))}</Td>
                      <Td dataLabel="Ready">{w.ready ? <Label color="green" isCompact>Ready</Label> : <Label color="yellow" isCompact>Draft</Label>}</Td>
                      <Td dataLabel="Age">{w.age}</Td>
                      <Td><DeleteBtn armed={armed === 'wfdef-' + w.name} scope="agents:delete" onArm={() => setArmed('wfdef-' + w.name)} onConfirm={() => deleteWorkflow(String(w.name))} /></Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
              <TablePager count={wfP.count} page={wfP.page} perPage={wfP.perPage} onSet={(p, pp) => setPgState(s => ({ ...s, workflows: { page: p, perPage: pp } }))} />
            </CardBody>
          </Card>
        </Tab>

        <Tab eventKey="agents" title={<TabTitleText>Agents</TabTitleText>} aria-label="Agents">
          <Card style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
            <CardHeader actions={{ actions: <Button variant="primary" size="sm" isDisabled={!canAgentsCreate} onClick={() => setCreate('agent')} title={canAgentsCreate ? undefined : 'Missing scope agents:create'}>Create agent</Button> }}>
              <CardTitle>Agents</CardTitle>
            </CardHeader>
            <CardBody>
              <Table aria-label="Agents" variant="compact">
                <Thead><Tr>
                  <Th>Name</Th><Th>Image</Th><Th>Gateways</Th><Th>Skills</Th><Th>Params</Th><Th>Ready</Th><Th>Age</Th><Th screenReaderText="Actions" />
                </Tr></Thead>
                <Tbody>
                  {agP.rows.map(a => (
                    <Tr key={String(a.name)}>
                      <Td dataLabel="Name"><b><code>{a.name}</code></b></Td>
                      <Td dataLabel="Image"><code>{a.image}</code></Td>
                      <Td dataLabel="Gateways">{a.gateways}</Td>
                      <Td dataLabel="Skills">{a.skills}</Td>
                      <Td dataLabel="Params">{a.params}</Td>
                      <Td dataLabel="Ready">{a.ready ? <Label color="green" isCompact>Ready</Label> : <><Label color="yellow" isCompact>Not ready</Label> <span className="u-muted u-meta">image pull pending</span></>}</Td>
                      <Td dataLabel="Age">{a.age}</Td>
                      <Td><DeleteBtn armed={armed === 'agent-' + a.name} scope="agents:delete" onArm={() => setArmed('agent-' + a.name)} onConfirm={() => { deleteAgent(String(a.name)); setArmed(null); }} /></Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
              <TablePager count={agP.count} page={agP.page} perPage={agP.perPage} onSet={(p, pp) => setPgState(s => ({ ...s, agents: { page: p, perPage: pp } }))} />
            </CardBody>
          </Card>
        </Tab>

        <Tab eventKey="skills" title={<TabTitleText>Skills</TabTitleText>} aria-label="Skills">
          <Card style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
            <CardHeader actions={{ actions: <Button variant="primary" size="sm" isDisabled={!canAgentsCreate} onClick={() => setCreate('skill')} title={canAgentsCreate ? undefined : 'Missing scope agents:create'}>Create skill card</Button> }}>
              <CardTitle>Skills</CardTitle>
            </CardHeader>
            <CardBody>
              <Table aria-label="Skills" variant="compact">
                <Thead><Tr>
                  <Th>Name</Th><Th>Display name</Th><Th>Description</Th><Th>Type</Th><Th>Source</Th><Th>Ready</Th><Th>Tags</Th><Th>Age</Th><Th screenReaderText="Actions" />
                </Tr></Thead>
                <Tbody>
                  {skP.rows.map(k => (
                    <Tr key={String(k.name)}>
                      <Td dataLabel="Name"><b><code>{k.name}</code></b></Td>
                      <Td dataLabel="Display name">{k.display}</Td>
                      <Td dataLabel="Description">{k.desc}</Td>
                      <Td dataLabel="Type">{k.type}</Td>
                      <Td dataLabel="Source">{k.source}</Td>
                      <Td dataLabel="Ready">{k.ready ? <Label color="green" isCompact>Ready</Label> : <Label color="yellow" isCompact>Pending validation</Label>}</Td>
                      <Td dataLabel="Tags">{k.tags}</Td>
                      <Td dataLabel="Age">{k.age}</Td>
                      <Td><DeleteBtn armed={armed === 'skill-' + k.name} scope="agents:delete" onArm={() => setArmed('skill-' + k.name)} onConfirm={() => { deleteSkill(String(k.name)); }} /></Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
              <TablePager count={skP.count} page={skP.page} perPage={skP.perPage} onSet={(p, pp) => setPgState(s => ({ ...s, skills: { page: p, perPage: pp } }))} />
            </CardBody>
          </Card>
        </Tab>

        <Tab eventKey="gateways" title={<TabTitleText>Gateways</TabTitleText>} aria-label="Gateways">
          <Card style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
            <CardHeader actions={{ actions: <a href="#scr=config" style={{ fontSize: 'var(--rh-font-size-body-text-xs)' }}>30-day usage &amp; health →</a> }}>
              <CardTitle>Gateways</CardTitle>
            </CardHeader>
            <CardBody>
              <Table aria-label="Gateways" variant="compact">
                <Thead><Tr>
                  <Th>Name</Th><Th>Provider</Th><Th>Model</Th><Th>Endpoint</Th><Th>Context window</Th><Th>Credential</Th><Th>Ready</Th><Th>Age</Th>
                </Tr></Thead>
                <Tbody>
                  {data.gateways.map(g => (
                    <Tr key={g.name}>
                      <Td dataLabel="Name"><b>{g.name}</b></Td>
                      <Td dataLabel="Provider">MaaS</Td>
                      <Td dataLabel="Model">{g.model}</Td>
                      <Td dataLabel="Endpoint"><code>{g.endpoint}</code></Td>
                      <Td dataLabel="Context window">{g.ctx}</Td>
                      <Td dataLabel="Credential">{g.cred}</Td>
                      <Td dataLabel="Ready"><Label color={g.ready ? 'green' : 'red'} isCompact>{g.ready ? 'Ready' : 'Not ready'}</Label></Td>
                      <Td dataLabel="Age">{g.healthAge}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
              <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-md)' }}>
                Showback (runs, tokens, est. cost per gateway) is the Administration → Automation card — the same store renders both.
              </Content>
            </CardBody>
          </Card>
        </Tab>
      </Tabs>

      {msg && (
        <Alert variant="info" isInline title="Registry updated" style={{ marginTop: 'var(--rh-space-md)' }} actionClose={<Button variant="plain" aria-label="Close" onClick={() => setMsg(null)} icon={<RhIcon name="close" />} />}>
          <p>{msg}</p>
        </Alert>
      )}

      <RunDetailModal rec={detail} onClose={() => setDetail(null)} onJump={jump} />

      {/* create modals */}
      <SmallCreateModal title="Create workflow run" isOpen={create === 'wfrun'} onClose={closeCreate} onSubmit={doCreate} submitLabel="Create run">
        <FormGroup label="Workflow" fieldId="agWfRunWf">
          <select id="agWfRunWf" className="pf-v6-c-form-control" value={fWf} onChange={e => setFWf(e.target.value)}>
            {workflows.filter(w => w.ready).map(w => <option key={String(w.name)} value={String(w.name)}>{w.name}</option>)}
          </select>
        </FormGroup>
        <FormGroup label="Application" fieldId="agWfRunApp">
          <select id="agWfRunApp" className="pf-v6-c-form-control" value={fApp} onChange={e => setFApp(e.target.value)}>
            {apps.map(a => <option key={String(a.name)} value={String(a.name)}>{a.name as string}</option>)}
          </select>
        </FormGroup>
      </SmallCreateModal>
      <SmallCreateModal title="Create run" isOpen={create === 'run'} onClose={closeCreate} onSubmit={doCreate} submitLabel="Create run">
        <FormGroup label="Application" fieldId="agRunApp">
          <select id="agRunApp" className="pf-v6-c-form-control" value={fApp} onChange={e => setFApp(e.target.value)}>
            {apps.map(a => <option key={String(a.name)} value={String(a.name)}>{a.name as string}</option>)}
          </select>
        </FormGroup>
        <Content component={ContentVariants.small} className="u-muted" style={{ marginTop: 'var(--rh-space-md)' }}>
          Queues the default plan skill on llm-gateway-1 — per-run gateway pinning lives on the workflow.
        </Content>
      </SmallCreateModal>
      <SmallCreateModal title="Create workflow" isOpen={create === 'wf'} onClose={closeCreate} onSubmit={doCreate} submitLabel="Create">
        <FormGroup label="Name" fieldId="agWfName">
          <TextInput id="agWfName" value={fName} onChange={(_e, v) => setFName(v)} placeholder="e.g. quarkus-containerize" />
        </FormGroup>
        <FormGroup label="Stages" fieldId="agWfStages">
          <TextInput id="agWfStages" type="number" min={1} max={9} value={String(fStages)} onChange={(_e, v) => setFStages(parseInt(v, 10) || 2)} />
        </FormGroup>
        {fErr && <p style={{ color: 'var(--pf-t--global--color--status--danger--default)', fontSize: 'var(--rh-font-size-body-text-sm)' }}>{fErr}</p>}
      </SmallCreateModal>
      <SmallCreateModal title="Create agent" isOpen={create === 'agent'} onClose={closeCreate} onSubmit={doCreate} submitLabel="Create">
        <FormGroup label="Name" fieldId="agAgentName">
          <TextInput id="agAgentName" value={fName} onChange={(_e, v) => setFName(v)} placeholder="e.g. analyzer-spring6" />
        </FormGroup>
        <FormGroup label={<>Image <span className="u-muted">(digest-pinned)</span></>} fieldId="agAgentImage">
          <TextInput id="agAgentImage" value={fDisplay} onChange={(_e, v) => setFDisplay(v)} placeholder="quay.io/mta/agent@sha256:…" />
        </FormGroup>
        {fErr && <p style={{ color: 'var(--pf-t--global--color--status--danger--default)', fontSize: 'var(--rh-font-size-body-text-sm)' }}>{fErr}</p>}
      </SmallCreateModal>
      <SmallCreateModal title="Create skill card" isOpen={create === 'skill'} onClose={closeCreate} onSubmit={doCreate} submitLabel="Create">
        <FormGroup label="Name" fieldId="agSkillName">
          <TextInput id="agSkillName" value={fName} onChange={(_e, v) => setFName(v)} placeholder="e.g. mig-jakarta-rewrite" />
        </FormGroup>
        <FormGroup label="Display name" fieldId="agSkillDisplay">
          <TextInput id="agSkillDisplay" value={fDisplay} onChange={(_e, v) => setFDisplay(v)} placeholder="Jakarta rewrite skill" />
        </FormGroup>
        {fErr && <p style={{ color: 'var(--pf-t--global--color--status--danger--default)', fontSize: 'var(--rh-font-size-body-text-sm)' }}>{fErr}</p>}
      </SmallCreateModal>
    </>
  );
}

/* event-timestamp helper (port of evNextTs): +45s after the last event */
function evNextTs(rec: { events?: unknown[][] }): string {
  if (!rec.events || !rec.events.length) return '+00:00';
  const m = String(rec.events[rec.events.length - 1][0]).match(/(\d+):(\d+)$/);
  const t = (m ? (+m[1]) * 60 + (+m[2]) : 0) + 45;
  return '+' + Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
}
