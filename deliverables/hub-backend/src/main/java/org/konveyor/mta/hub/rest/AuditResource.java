package org.konveyor.mta.hub.rest;

import io.quarkus.hibernate.orm.panache.PanacheQuery;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.konveyor.mta.hub.audit.AuditService;
import org.konveyor.mta.hub.model.AuditEntry;
import org.konveyor.mta.hub.model.Organization;
import org.konveyor.mta.hub.security.Scopes;
import org.konveyor.mta.hub.tenancy.TenantScope;

import java.util.UUID;

/**
 * The cross-tenant audit trail (#42) — computed fleet-wide, the one surface
 * above the tenancy clamp. `audit:read` is padmin-exclusive.
 */
@Path("/audit")
@Produces(MediaType.APPLICATION_JSON)
public class AuditResource {

    @Inject
    TenantScope tenant;

    @Inject
    AuditService audit;

    @GET
    @Scopes("audit:read")
    public Response list(@QueryParam("organization") UUID organizationId,
                         @QueryParam("actor") String actor,
                         @QueryParam("page") Integer page, @QueryParam("size") Integer size) {
        Organization org = tenant.organization(organizationId);
        PanacheQuery<AuditEntry> query;
        if (org == null) {
            query = (actor == null || actor.isBlank())
                    ? AuditEntry.newestFirst()
                    : AuditEntry.find("actor = ?1 order by at desc", actor);
        } else {
            query = (actor == null || actor.isBlank())
                    ? AuditEntry.forOrganization(org.id)
                    : AuditEntry.find("(organization.id = ?1 or organization is null) and actor = ?2 order by at desc",
                            org.id, actor);
        }
        return Responses.paged(query, page, size, AuditService.View::of);
    }
}
