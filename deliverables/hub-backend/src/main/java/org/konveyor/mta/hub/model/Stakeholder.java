package org.konveyor.mta.hub.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.util.ArrayList;
import java.util.List;

/**
 * A person record (directory-bound, #36 clause a). Every stakeholder belongs
 * to exactly one organization (org stamped, email follows the org domain);
 * group membership derives the Groups column, team staffing derives rosters.
 */
@Entity
@Table(name = "stakeholder", uniqueConstraints = @UniqueConstraint(name = "uc_stakeholder_email", columnNames = "email"))
public class Stakeholder extends BaseEntity {

    @Column(nullable = false, length = 255)
    public String name;

    @Column(nullable = false, length = 320, updatable = false)
    public String email;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organization_id", nullable = false)
    public Organization organization;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "job_function_id")
    public JobFunction jobFunction;

    /** Inverse side: group membership is owned by {@link StakeholderGroup}. */
    @ManyToMany(mappedBy = "members", fetch = FetchType.LAZY)
    public List<StakeholderGroup> groups = new ArrayList<>();

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "team_members",
            joinColumns = @JoinColumn(name = "stakeholder_id"),
            inverseJoinColumns = @JoinColumn(name = "team_id"))
    public List<Team> teams = new ArrayList<>();
}
