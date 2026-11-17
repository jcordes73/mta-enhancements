package org.konveyor.mta.hub.model;

import io.quarkus.hibernate.orm.panache.PanacheQuery;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.util.ArrayList;
import java.util.List;

/**
 * The resource every analysis is driven by — first-class REST with its own
 * RBAC scope and spec entry (the API-parity gate: no UI surface ships
 * without them).
 */
@Entity
@Table(name = "analysis_profile", uniqueConstraints = @UniqueConstraint(name = "uc_profile_name", columnNames = "name"))
public class AnalysisProfile extends BaseEntity {

    @Column(nullable = false, length = 255)
    public String name;

    @Column(length = 2048)
    public String description;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "analysis_profile_sources", joinColumns = @JoinColumn(name = "profile_id"))
    @Column(name = "source", length = 255)
    public List<String> sources = new ArrayList<>();

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "analysis_profile_targets", joinColumns = @JoinColumn(name = "profile_id"))
    @Column(name = "target", length = 255)
    public List<String> targets = new ArrayList<>();

    public static PanacheQuery<AnalysisProfile> search(String name) {
        if (name == null || name.isBlank()) {
            return findAll();
        }
        return find("lower(name) like lower(?1)", "%" + name + "%");
    }
}
