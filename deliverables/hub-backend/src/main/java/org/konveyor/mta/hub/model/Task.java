package org.konveyor.mta.hub.model;

import io.quarkus.hibernate.orm.panache.PanacheQuery;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * A task (upstream /tasks parity): queue health (#30), structured
 * diagnostics (#3), named quota (#38). State transitions publish to
 * {@code /events} so CI and GitOps subscribe instead of polling.
 */
@Entity
@Table(name = "task", indexes = @Index(name = "idx_task_state", columnList = "state"))
public class Task extends BaseEntity {

    public enum State { QUEUED, RUNNING, SUCCEEDED, FAILED, CANCELED }

    public enum Kind { ANALYSIS, TRIAGE_CARRYOVER, BATCH_TAG, EXPORT, VERIFICATION }

    @Column(nullable = false, length = 32)
    @Enumerated(EnumType.STRING)
    public State state = State.QUEUED;

    @Column(nullable = false, length = 32)
    @Enumerated(EnumType.STRING)
    public Kind kind;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "application_id")
    public Application application;

    @Column(length = 255)
    public String label;

    /** Structured diagnostics on failure (#3): stable code + human message. */
    @Column(length = 64)
    public String errorCode;

    @Column(length = 4096)
    public String errorMessage;

    /** Quota named when blocked (#38). */
    @Column(length = 255)
    public String quota;

    public Instant startedAt;

    public Instant completedAt;

    public String triggeredBy;

    public static PanacheQuery<Task> byState(String state) {
        return find("state", Task.State.valueOf(state.toUpperCase()));
    }
}
