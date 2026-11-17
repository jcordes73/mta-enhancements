package org.konveyor.mta.hub.model;

import io.quarkus.hibernate.orm.panache.PanacheQuery;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * Audit trail (#42): every mutation attributed; every cross-organization
 * pivot by the platform admin appends here, so the isolation invariant has
 * no unlogged exception.
 */
@Entity
@Table(name = "audit_entry", indexes = {
        @Index(name = "idx_audit_actor", columnList = "actor"),
        @Index(name = "idx_audit_organization", columnList = "organization_id")
})
public class AuditEntry extends BaseEntity {

    @Column(nullable = false, length = 255)
    public String actor;

    @Column(nullable = false, length = 64)
    public String action;

    @Column(nullable = false, length = 64)
    public String resourceType;

    @Column(nullable = false, length = 1024)
    public String resourceId;

    /** Organization the resource belongs to (null = fleet-wide). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id")
    public Organization organization;

    /** Set when a platform admin touched another organization's resource. */
    @Column(nullable = false)
    public boolean crossTenant;

    @Column(length = 2048)
    public String detail;

    public Instant at = Instant.now();

    public static PanacheQuery<AuditEntry> newestFirst() {
        return find("order by at desc");
    }

    public static PanacheQuery<AuditEntry> forOrganization(UUID organizationId) {
        return find("organization.id = ?1 or organization is null order by at desc", organizationId);
    }
}
