package org.konveyor.mta.hub.model;

import io.quarkus.hibernate.orm.panache.PanacheQuery;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * A migration wave — the unit of planning (defect 31): membership carries
 * ticket rows and verification evidence, and wave aggregates re-derive from
 * the member set.
 */
@Entity
@Table(name = "wave")
public class Wave extends BaseEntity {

    @Column(nullable = false, length = 255)
    public String name;

    @Column
    public int position;

    @Column
    public LocalDate startDate;

    @Column
    public LocalDate endDate;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organization_id", nullable = false)
    public Organization organization;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "wave_members",
            joinColumns = @JoinColumn(name = "wave_id"),
            inverseJoinColumns = @JoinColumn(name = "application_id"))
    public List<Application> members = new ArrayList<>();

    public static PanacheQuery<Wave> inOrganization(UUID organizationId) {
        return find("organization.id", organizationId);
    }
}
