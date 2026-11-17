package org.konveyor.mta.hub.model;

import io.quarkus.hibernate.orm.panache.PanacheQuery;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.util.UUID;

/** Tenancy level 2 (#41): a department groups teams inside one organization. */
@Entity
@Table(name = "department", uniqueConstraints = @UniqueConstraint(name = "uc_dept_org_name", columnNames = {"organization_id", "name"}))
public class Department extends BaseEntity {

    @Column(nullable = false, length = 255)
    public String name;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organization_id", nullable = false)
    public Organization organization;

    public static PanacheQuery<Department> inOrganization(UUID organizationId) {
        return find("organization.id", organizationId);
    }
}
