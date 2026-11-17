package org.konveyor.mta.hub.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * Verification evidence for one wave-member application (mock's
 * WAVE_EVIDENCE store): coverage display + suite totals for the gate state.
 */
@Entity
@Table(name = "wave_evidence", uniqueConstraints = @UniqueConstraint(name = "uc_wave_evidence_app", columnNames = "application_id"))
public class WaveEvidence extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "application_id", nullable = false, unique = true)
    public Application application;

    /** Coverage display ('2 DBs · 3 APIs · 1 queue'). */
    @Column(nullable = false, length = 255)
    public String coverage;

    @Column(nullable = false)
    public int total;

    @Column(nullable = false)
    public int run;

    @Column(nullable = false)
    public int red;
}
