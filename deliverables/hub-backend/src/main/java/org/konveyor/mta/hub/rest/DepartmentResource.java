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
import org.konveyor.mta.hub.model.Department;
import org.konveyor.mta.hub.model.Organization;
import org.konveyor.mta.hub.model.Team;
import org.konveyor.mta.hub.security.Scopes;
import org.konveyor.mta.hub.tenancy.TenantScope;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/** Departments group teams inside one organization (tenancy level 2, #41). */
@Path("/departments")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class DepartmentResource {

    @Inject
    TenantScope tenant;

    @Inject
    AuditService audit;

    public record View(UUID id, String name, String organization, UUID organizationId,
                       long teamCount, long applicationCount, long version,
                       Instant createdAt, Instant updatedAt) {

        public static View of(Department d) {
            return new View(d.id, d.name, d.organization.name, d.organization.id,
                    Team.count("department.id", d.id),
                    Application.count("team.department.id", d.id),
                    d.version, d.createdAt, d.updatedAt);
        }
    }

    public record Upsert(String name, UUID organizationId) {
    }

    @GET
    @Scopes("departments:read")
    public Response list(@QueryParam("organization") UUID organizationId, @QueryParam("page") Integer page,
                         @QueryParam("size") Integer size) {
        Organization org = tenant.organization(organizationId);
        PanacheQuery<Department> query = (org == null)
                ? Department.findAll()
                : Department.inOrganization(org.id);
        return Responses.paged(query, page, size, View::of);
    }

    @POST
    @Scopes("departments:create")
    @Transactional
    public Response create(Upsert body) {
        if (body.name() == null || body.name().isBlank()) {
            throw ApiException.validation("Department name is required");
        }
        Organization org = body.organizationId() == null
                ? tenant.organization(null)
                : (Organization.findById(body.organizationId()) != null
                        ? (Organization) Organization.findById(body.organizationId()) : null);
        if (org == null) {
            throw ApiException.notFound("Organization", body.organizationId());
        }
        if (Department.count("organization.id = ?1 and name = ?2", org.id, body.name()) > 0) {
            throw ApiException.duplicate("Department", body.name());
        }
        Department dept = new Department();
        dept.name = body.name();
        dept.organization = org;
        dept.persist();
        audit.mutation("create", "Department", dept.id, org, "created department " + dept.name);
        return Responses.created(View.of(dept), dept, "/departments/" + dept.id);
    }

    @GET
    @Path("/{id}")
    @Scopes("departments:read")
    public Response get(@PathParam("id") UUID id) {
        Department dept = Department.findById(id);
        if (dept == null) {
            throw ApiException.notFound("Department", id);
        }
        tenant.assertReadable(dept.organization, "Department");
        audit.crossTenantRead("Department", id, dept.organization, null);
        return Responses.withEtag(View.of(dept), dept);
    }

    @PUT
    @Path("/{id}")
    @Scopes("departments:update")
    @Transactional
    public Response update(@PathParam("id") UUID id, Upsert body) {
        Department dept = Department.findById(id);
        if (dept == null) {
            throw ApiException.notFound("Department", id);
        }
        tenant.assertReadable(dept.organization, "Department");
        if (body.name() != null) {
            dept.name = body.name(); // rename cascades: teams/applications follow the relation
        }
        audit.mutation("update", "Department", id, dept.organization, "updated department " + dept.name);
        return Responses.updated(View.of(dept), dept);
    }

    @DELETE
    @Path("/{id}")
    @Scopes("departments:delete")
    @Transactional
    public Response delete(@PathParam("id") UUID id) {
        Department dept = Department.findById(id);
        if (dept == null) {
            throw ApiException.notFound("Department", id);
        }
        tenant.assertReadable(dept.organization, "Department");
        long teams = Team.count("department.id", id);
        if (teams > 0) {
            throw ApiException.inUse("Department", id,
                    teams + " team(s) — delete or move the teams first (team-guarded deletes)");
        }
        dept.delete();
        audit.mutation("delete", "Department", id, dept.organization, "deleted department " + dept.name);
        return Response.noContent().build();
    }

    public static Map<String, Object> ref(Department d) {
        return Map.of("id", d.id, "name", d.name);
    }
}
