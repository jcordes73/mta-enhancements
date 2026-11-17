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

import java.time.Instant;
import java.util.UUID;

/**
 * One analysis run of one application (driven by an AnalysisProfile). The
 * analysis-diff endpoint (#33 item 2) compares two analyses of the same
 * application by their incidents.
 */
@Entity
@Table(name = "analysis",
        indexes = @Index(name = "idx_analysis_application", columnList = "application_id"))
public class Analysis extends BaseEntity {

    public enum Status { QUEUED, RUNNING, SUCCEEDED, FAILED }

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "application_id", nullable = false)
    public Application application;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "profile_id")
    public AnalysisProfile profile;

    @Column(nullable = false, length = 32)
    @Enumerated(EnumType.STRING)
    public Status status = Status.QUEUED;

    public Instant startedAt;

    public Instant completedAt;

    public String triggeredBy;

    /** Stable incident-identity anchor (deterministic analyses). */
    @Column(length = 64, unique = true, updatable = false)
    public String contentFingerprint;

    /** Running progress percent (0-100); meaningful while RUNNING. */
    public int progress;

    public static PanacheQuery<Analysis> forApplication(UUID applicationId) {
        return find("application.id", applicationId);
    }
}
