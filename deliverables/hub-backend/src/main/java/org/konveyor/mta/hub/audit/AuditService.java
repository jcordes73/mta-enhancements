package org.konveyor.mta.hub.audit;

import io.quarkus.runtime.annotations.RegisterForReflection;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.konveyor.mta.hub.model.AuditEntry;
import org.konveyor.mta.hub.model.Organization;
import org.konveyor.mta.hub.tenancy.TenantScope;

/**
 * Audit trail (#42): every mutation attributed; every cross-organization
 * pivot by the platform admin appends here — the isolation invariant has no
 * unlogged exception.
 */
@ApplicationScoped
public class AuditService {

    @Inject
    TenantScope tenantScope;

    @Transactional(jakarta.transaction.Transactional.TxType.REQUIRES_NEW)
    public void mutation(String action, String resourceType, Object resourceId, Organization organization, String detail) {
        boolean crossTenant = organization != null && !organization.name.equals(tenantScope.organizationName());
        AuditEntry entry = new AuditEntry();
        entry.actor = tenantScope.actor();
        entry.action = action;
        entry.resourceType = resourceType;
        entry.resourceId = String.valueOf(resourceId);
        entry.organization = organization;
        entry.crossTenant = crossTenant;
        entry.detail = detail;
        entry.persist();
    }

    /** Called by resources when a platform admin reads another organization's data. */
    public void crossTenantRead(String resourceType, Object resourceId, Organization organization, String detail) {
        if (organization == null || !organization.name.equals(tenantScope.organizationName())) {
            mutation("read", resourceType, resourceId, organization, detail);
        }
    }

    @RegisterForReflection
    public record View(String actor, String action, String resourceType, String resourceId,
                       String organization, boolean crossTenant, String detail, java.time.Instant at) {

        public static View of(AuditEntry e) {
            return new View(e.actor, e.action, e.resourceType, e.resourceId,
                    e.organization == null ? null : e.organization.name, e.crossTenant, e.detail, e.at);
        }
    }
}
