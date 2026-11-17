package org.konveyor.mta.hub.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * One agent run = ONE stage of a workflow run (upstream model — agent runs
 * are never ad-hoc). Carries the full transparency set (RHDS AI principles):
 * gateway + model attribution, token/cost showback, and the event log
 * (AgentRunEvent rows).
 */
@Entity
@Table(name = "agent_run", indexes = @Index(name = "idx_agent_run_wfrun", columnList = "workflow_run_id"))
public class AgentRun extends BaseEntity {

    public enum State { RUNNING, SUCCEEDED, FAILED }

    @Column(nullable = false, length = 255)
    public String name;                 // 'execute — spring-boot-to-quarkus'

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "agent_id", nullable = false)
    public Agent agent;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "application_id", nullable = false)
    public Application application;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "workflow_run_id", nullable = false)
    public WorkflowRun workflowRun;

    @Column(nullable = false, length = 32)
    public String phase;

    @Column(nullable = false, length = 32)
    public State state = State.RUNNING;

    /** Failure reason; NULL/empty when succeeded. */
    @Column(length = 1024)
    public String reason;

    /** Duration display ('29m so far', '12m'). */
    @Column(length = 64)
    public String duration;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "gateway_id", nullable = false)
    public Gateway gateway;

    /** Model attribution stamped per run (#20). */
    @Column(nullable = false, length = 255)
    public String model;

    /** Token showback, display form ('176,300'). */
    @Column(length = 32)
    public String tokens;

    /** Prompt/completion split ('161k/15k'). */
    @Column(length = 64)
    public String tokDetail;

    /** Cost showback ('$4.70'). */
    @Column(length = 32)
    public String cost;

    /** Agent-loop turns (agent-run telemetry, row 105 of the mock's defect log). */
    @Column
    public Integer turns;

    /** Context-window usage at the last checkpoint, in tokens. */
    @Column
    public Integer ctxCurrent;

    /** Model context window, in tokens (128,000 granite-3.3-70b / 200,000 frontier-70b). */
    @Column
    public Integer ctxWindow;

    /** Agent image stamped at run time. */
    @Column(length = 1024)
    public String image;
}
