package org.konveyor.mta.hub.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * Inter-wave dependency edge (#23): the dependency graph drives the
 * inter-wave edges and the admission gates ("schedule the provider first").
 */
@Entity
@Table(name = "wave_dependency", uniqueConstraints = @UniqueConstraint(name = "uc_wave_dependency_edge", columnNames = {"from_app_id", "to_app_id"}))
public class WaveDependency extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "from_app_id", nullable = false)
    public Application fromApp;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "to_app_id", nullable = false)
    public Application toApp;

    /** Verb display ('consumed by'). */
    @Column(nullable = false, length = 64)
    public String verb;
}
