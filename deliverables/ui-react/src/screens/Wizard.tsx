import { useState } from 'react';
import { Alert, Button, Title, Content, ContentVariants } from '@patternfly/react-core';
import '@patternfly/react-styles/css/components/Wizard/wizard.css';

const STEP_NAMES = ['Source', 'Credentials', 'Repository', 'Business service', 'Review'];

export function Wizard() {
  /* the mock boots the wizard at step 3 — the step with the blocking validation error */
  const [step, setStep] = useState(3);

  const goto = (n: number) => { if (n >= 1 && n <= 5) setStep(n); };

  return (
    <>
      <Title headingLevel="h1" size="2xl" className="page-title">Import applications</Title>
      <Content component={ContentVariants.p} className="page-subtitle">
        Per-step validation kills the silent failure modes at the step that causes them
      </Content>
      <div className="pf-v6-c-wizard" style={{ border: '1px solid var(--pf-t--global--border--color--subtle)', borderRadius: 'var(--pf-t--global--border--radius--medium)', height: 'auto', maxWidth: 860 }}>
        <div className="pf-v6-c-wizard__header">
          <h1 className="pf-v6-c-wizard__title">
            <span className="pf-v6-c-wizard__title-text">Import applications — step {step} of 5</span>
          </h1>
        </div>
        <div className="pf-v6-c-wizard__outer-wrap">
          <div className="pf-v6-c-wizard__inner-wrap">
            <nav className="pf-v6-c-wizard__nav" aria-label="Import steps">
              <ol className="pf-v6-c-wizard__nav-list">
                {STEP_NAMES.map((name, i) => {
                  const n = i + 1;
                  const cls = 'pf-v6-c-wizard__nav-link'
                    + (n === step ? ' pf-m-current' : '')
                    + (n < step ? ' pf-m-done' : '');
                  return (
                    <li key={n} className="pf-v6-c-wizard__nav-item">
                      {/* bare name — PF6 renders the step number in the ::before badge
                          (counter wizard-nav-count); a "N." text prefix would duplicate it */}
                      <a href="#" className={cls} aria-current={n === step ? 'step' : undefined}
                        onClick={e => { e.preventDefault(); goto(n); }}>{name}</a>
                    </li>
                  );
                })}
              </ol>
            </nav>
            <div className="pf-v6-c-wizard__main">
              <div className="pf-v6-c-wizard__main-body" role="tabpanel" aria-label={`Step ${step}`}>
                {step === 1 && (
                  <p className="u-muted">Source: choose SCM / binary / custom — the wizard remembers team-typical defaults</p>
                )}
                {step === 2 && (
                  <p className="u-muted">Credentials: the owning team&apos;s credentials, filtered to the selected scheme&apos;s kinds, with the test action inline (R2-15)</p>
                )}
                {step === 3 && (
                  <form className="pf-v6-c-form">
                    <div className="pf-v6-c-form__group">
                      <label className="pf-v6-c-form__label" htmlFor="repo-url"><span className="pf-v6-c-form__label-text">Repository URL</span></label>
                      <input className="pf-v6-c-form-control pf-m-danger" type="text" id="repo-url" readOnly
                        value="ssh://git@gitlab.corp:2222/vcs/payments-api.git" />
                      <div className="pf-v6-c-helper-text">
                        <p className="pf-v6-c-helper-text__item"><span className="pf-v6-c-helper-text__item-text">
                          Scheme, host reachability, and branch are validated now — not at analysis time
                        </span></p>
                      </div>
                    </div>
                    <Alert variant="warning" isInline title="Scheme requires a different credential kind">
                      <p><code>ssh://</code> requires an SSH-key credential; the selected credential is username/password. Also: agent runs clone over HTTPS only (agentic-controller#240) — suggest <code>https://</code> URL with a PAT.</p>
                    </Alert>
                    <div className="pf-v6-c-form__group" style={{ marginTop: 'var(--pf-t--global--spacer--md)' }}>
                      <label className="pf-v6-c-form__label" htmlFor="repo-branch"><span className="pf-v6-c-form__label-text">Branch</span></label>
                      <select className="pf-v6-c-form-control" id="repo-branch">
                        <option>main ✓ (resolved, default)</option>
                        <option>release/2.4 ✓</option>
                      </select>
                      <div className="pf-v6-c-helper-text">
                        <p className="pf-v6-c-helper-text__item"><span className="pf-v6-c-helper-text__item-text">
                          Branch list resolved from the remote — free-text typos can&apos;t silently analyze the wrong tree.
                        </span></p>
                      </div>
                    </div>
                    <div className="pf-v6-c-form__group">
                      <label className="pf-v6-c-form__label" htmlFor="repo-cred"><span className="pf-v6-c-form__label-text">Credential</span></label>
                      <select className="pf-v6-c-form-control" id="repo-cred">
                        <option>gitlab-corpus-pat (kind: source, https) ✓ tested</option>
                      </select>
                      <div className="pf-v6-c-helper-text">
                        <p className="pf-v6-c-helper-text__item"><span className="pf-v6-c-helper-text__item-text">
                          Filtered to the kinds this repository scheme supports; test action attached (R2-15)
                        </span></p>
                      </div>
                    </div>
                  </form>
                )}
                {step === 4 && (
                  <p className="u-muted">Business service: pre-selected from the application record; archetypes ride along</p>
                )}
                {step === 5 && (
                  <p className="u-muted">Review: import plan as a diff — what will be created, what will be reused, what will fail validation now instead of at run time</p>
                )}
              </div>
            </div>
          </div>
          <footer className="pf-v6-c-wizard__footer">
            <Button variant="secondary" isDisabled={step === 1} onClick={() => goto(step - 1)}>Back</Button>
            <Button variant="primary" isDisabled={step === 3} onClick={() => goto(step + 1)}>
              {step === 3 ? 'Next — fix the errors above' : 'Next'}
            </Button>
            <span className="u-muted" style={{ marginLeft: 'auto' }}>Step validates via the same API the run will use — no mock checks.</span>
          </footer>
        </div>
      </div>
    </>
  );
}
