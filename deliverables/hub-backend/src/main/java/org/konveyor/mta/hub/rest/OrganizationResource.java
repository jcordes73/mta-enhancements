package org.konveyor.mta.hub.rest;

import io.quarkus.hibernate.orm.panache.PanacheQuery;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.konveyor.mta.hub.audit.AuditService;
import org.konveyor.mta.hub.error.ApiException;
import org.konveyor.mta.hub.model.Application;
import org.konveyor.mta.hub.model.Organization;
import org.konveyor.mta.hub.security.Scopes;
import org.konveyor.mta.hub.tenancy.TenantScope;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * The tenancy root (#41). Write verbs are padmin-exclusive (the
 * `tenants:*` surface); read is available to any tenant-scoped identity for
 * the switcher. Every cross-organization pivot appends to the audit trail.
 */
@Path("/organizations")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class OrganizationResource {

    @Inject
    TenantScope tenant;

    @Inject
    AuditService audit;

    public record View(UUID id, String name, String description, long departmentCount,
                       long applicationCount, long version, Instant createdAt, Instant updatedAt) {

        public static View of(Organization o) {
            return new View(o.id, o.name, o.description,
                    o.departments.size(),
                    Application.count("team.department.organization.id", o.id),
                    o.version, o.createdAt, o.updatedAt);
        }
    }

    public record Upsert(String name, String description) {
    }

    @GET
    @Scopes("organizations:read")
    public Response list(@QueryParam("page") Integer page, @QueryParam("size") Integer size) {
        PanacheQuery<Organization> query = Organization.find("order by name");
        return Responses.paged(query, page, size, View::of);
    }

    @POST
    @Scopes("organizations:create")
    @Transactional
    public Response create(Upsert body) {
        if (body.name() == null || body.name().isBlank()) {
            throw ApiException.validation("Organization name is required");
        }
        if (Organization.count("name", body.name()) > 0) {
            throw ApiException.duplicate("Organization", body.name());
        }
        Organization org = new Organization();
        org.name = body.name();
        org.description = body.description();
        org.persist();
        audit.mutation("provision", "Organization", org.id, org, "provisioned organization " + org.name);
        return Responses.created(View.of(org), org, "/organizations/" + org.id);
    }

    @GET
    @Path("/{id}")
    @Scopes("organizations:read")
    public Response get(@PathParam("id") UUID id) {
        Organization org = Organization.findById(id);
        if (org == null) {
            throw ApiException.notFound("Organization", id);
        }
        audit.crossTenantRead("Organization", id, org, null);
        return Responses.withEtag(View.of(org), org);
    }

    @PUT
    @Path("/{id}")
    @Scopes("organizations:update")
    @Transactional
    public Response update(@PathParam("id") UUID id, Upsert body) {
        Organization org = Organization.findById(id);
        if (org == null) {
            throw ApiException.notFound("Organization", id);
        }
        if (body.name() != null) {
            org.name = body.name();
        }
        if (body.description() != null) {
            org.description = body.description();
        }
        audit.mutation("update", "Organization", id, org, "updated organization " + org.name);
        return Responses.updated(View.of(org), org);
    }

    @DELETE
    @Path("/{id}")
    @Scopes("organizations:delete")
    @Transactional
    public Response delete(@PathParam("id") UUID id) {
        Organization org = Organization.findById(id);
        if (org == null) {
            throw ApiException.notFound("Organization", id);
        }
        long apps = Application.count("team.department.organization.id", id);
        if (apps > 0 || !org.departments.isEmpty()) {
            throw ApiException.inUse("Organization", id,
                    apps + " application(s) and " + org.departments.size() + " department(s) — empty it first");
        }
        org.delete();
        audit.mutation("delete", "Organization", id, null, "deleted organization " + org.name);
        return Response.noContent().build();
    }

    public static Map<String, Object> ref(Organization o) {
        return Map.of("id", o.id, "name", o.name);
    }
}
