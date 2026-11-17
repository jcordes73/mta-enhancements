package org.konveyor.mta.hub.model;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.util.ArrayList;
import java.util.List;

/**
 * Top-level tenancy boundary (#41). Every tenant-owned resource belongs to
 * exactly one organization; only the platform administrator (padmin) operates
 * above organizations, and every cross-organization pivot is audited (#42).
 */
@Entity
@Table(name = "organization", uniqueConstraints = @UniqueConstraint(name = "uc_org_name", columnNames = "name"))
public class Organization extends BaseEntity {

    @Column(nullable = false, length = 255)
    public String name;

    @Column(length = 512)
    public String description;

    @OneToMany(mappedBy = "organization", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    public List<Department> departments = new ArrayList<>();

    public static Organization findByName(String name) {
        return find("name", name).firstResult();
    }
}
