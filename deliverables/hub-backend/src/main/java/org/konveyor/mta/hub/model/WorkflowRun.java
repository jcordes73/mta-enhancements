package org.konveyor.mta.hub.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * A workflow execution (mock's MOCK_WFRUNS store): one run of a workflow
 * against an application, decomposed into per-stage agent runs.
 */
@Entity
@Table(name = "workflow_run", uniqueConstraints = @UniqueConstraint(name = "uc_workflow_run_name", columnNames = "name"))
public class WorkflowRun extends BaseEntity {

    public enum State { RUNNING, SUCCEEDED, FAILED }

    @Column(nullable = false, length = 64)
    public String name;                 // 'WR-14'

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "workflow_id", nullable = false)
    public Workflow workflow;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "application_id", nullable = false)
    public Application application;

    /** Current phase ('plan' | 'execute' | 'verify'). */
    @Column(nullable = false, length = 32)
    public String phase;

    @Column(nullable = false)
    public int stages;

    @Column(nullable = false, length = 32)
    public State state = State.RUNNING;

    /** Duration display ('1h 12m', '41m so far'). */
    @Column(length = 64)
    public String duration;

    /** The canonical run for comparison (WR-8 pattern). */
    @Column(nullable = false)
    public boolean canonical;
}
