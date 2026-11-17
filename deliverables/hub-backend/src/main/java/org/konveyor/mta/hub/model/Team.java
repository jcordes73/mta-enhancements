package org.konveyor.mta.hub.model;

import io.quarkus.hibernate.orm.panache.PanacheQuery;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Tenancy level 3 (#41): teams are the unit of planning and ownership —
 * applications, credentials and work assignments belong to exactly one team.
 */
@Entity
@Table(name = "team", uniqueConstraints = @UniqueConstraint(name = "uc_team_dept_name", columnNames = {"department_id", "name"}))
public class Team extends BaseEntity {

    @Column(nullable = false, length = 255)
    public String name;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "department_id", nullable = false)
    public Department department;

    @ManyToMany(mappedBy = "teams", fetch = FetchType.LAZY)
    public List<Stakeholder> members = new ArrayList<>();

    public static PanacheQuery<Team> inOrganization(UUID organizationId) {
        return find("department.organization.id", organizationId);
    }
}
