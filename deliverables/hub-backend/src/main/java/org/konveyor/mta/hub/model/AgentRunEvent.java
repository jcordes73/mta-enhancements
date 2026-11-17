package org.konveyor.mta.hub.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * Timestamped event-log row of an agent run (relative offset + message) —
 * the run-record transparency surface.
 */
@Entity
@Table(name = "agent_run_event", indexes = @Index(name = "idx_agent_run_event_run", columnList = "agent_run_id"))
public class AgentRunEvent extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "agent_run_id", nullable = false)
    public AgentRun agentRun;

    /** Relative offset ('+04:38'). */
    @Column(nullable = false, length = 32)
    public String offsetText;

    @Column(nullable = false, length = 1024)
    public String message;
}
