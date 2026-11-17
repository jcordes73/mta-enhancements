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

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Stakeholder groups own their members (real membership, not a label). */
@Entity
@Table(name = "stakeholder_group")
public class StakeholderGroup extends BaseEntity {

    @Column(nullable = false, length = 255)
    public String name;

    @Column(length = 1024)
    public String description;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organization_id", nullable = false)
    public Organization organization;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "stakeholder_group_members",
            joinColumns = @JoinColumn(name = "group_id"),
            inverseJoinColumns = @JoinColumn(name = "stakeholder_id"))
    public List<Stakeholder> members = new ArrayList<>();

    public static PanacheQuery<StakeholderGroup> inOrganization(UUID organizationId) {
        return find("organization.id", organizationId);
    }
}
