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

/**
 * Business services are records at live-API parity: every application has an
 * accountable owner, and every service always has an owner AND a description
 * (both required — the admission gate 'business service X has no owner' can
 * therefore only fire on legacy rows).
 */
@Entity
@Table(name = "business_service", uniqueConstraints = @UniqueConstraint(name = "uc_bsvc_org_name", columnNames = {"organization_id", "name"}))
public class BusinessService extends BaseEntity {

    @Column(nullable = false, length = 255)
    public String name;

    @Column(nullable = false, length = 2048)
    public String description;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    public Stakeholder owner;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organization_id", nullable = false)
    public Organization organization;

    public static PanacheQuery<BusinessService> inOrganization(UUID organizationId) {
        return find("organization.id", organizationId);
    }
}
