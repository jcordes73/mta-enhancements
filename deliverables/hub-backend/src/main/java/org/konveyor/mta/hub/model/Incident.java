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
import jakarta.persistence.UniqueConstraint;

/**
 * An incident from an analysis run. The triage {@code state} is WRITABLE
 * (#33 item 1) — decisions made here sync to the IDE and tooling via
 * {@code PUT /incidents/{incidentKey}/triage} (§9.1); triage history and
 * re-analysis carry-over per §8.1/#26.
 */
@Entity
@Table(name = "incident",
        uniqueConstraints = @UniqueConstraint(name = "uc_incident_key", columnNames = "incidentKey"),
        indexes = {
                @Index(name = "idx_incident_application", columnList = "application_id"),
                @Index(name = "idx_incident_analysis", columnList = "analysis_id")
        })
public class Incident extends BaseEntity {

    public enum TriageState { TRIAGE, ASSIGNED, IN_PROGRESS, RESOLVED, FALSE_POSITIVE }

    /** Stable external identity: ruleset.rule@file#line — the same incident
     *  regenerates the same key (deterministic analyses, incident identity). */
    @Column(name = "incidentKey", nullable = false, length = 1024, updatable = false)
    public String incidentKey;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "application_id", nullable = false)
    public Application application;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "analysis_id")
    public Analysis analysis;

    @Column(nullable = false, length = 255)
    public String ruleset;

    @Column(nullable = false, length = 255)
    public String rule;

    @Column(nullable = false, length = 1024)
    public String file;

    @Column
    public int line;

    @Column(length = 4096)
    public String message;

    public int effort;

    @Column(nullable = false, length = 32)
    @Enumerated(EnumType.STRING)
    public TriageState state = TriageState.TRIAGE;

    @Column(length = 4096)
    public String triageComment;

    public String triageActor;

    public java.time.Instant triagedAt;

    public static PanacheQuery<Incident> byState(String state) {
        return find("state", TriageState.valueOf(state.toUpperCase().replace('-', '_')));
    }

    public static Incident findByKey(String incidentKey) {
        return find("incidentKey", incidentKey).firstResult();
    }
}
