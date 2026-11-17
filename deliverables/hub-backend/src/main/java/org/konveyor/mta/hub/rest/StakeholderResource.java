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
import org.konveyor.mta.hub.model.BusinessService;
import org.konveyor.mta.hub.model.JobFunction;
import org.konveyor.mta.hub.model.Organization;
import org.konveyor.mta.hub.model.Stakeholder;
import org.konveyor.mta.hub.model.Team;
import org.konveyor.mta.hub.security.Scopes;
import org.konveyor.mta.hub.tenancy.TenantScope;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Stakeholders (directory-bound, #36 clause a). Every stakeholder belongs to
 * exactly one organization; team staffing is the source of rosters — a
 * stakeholder staffed on a team cannot be deleted (remove the membership
 * first), and a stakeholder owning applications/services is equally guarded.
 */
@Path("/stakeholders")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class StakeholderResource {

    @Inject
    TenantScope tenant;

    @Inject
    AuditService audit;

    public record View(UUID id, String name, String email, String jobFunction, UUID jobFunctionId,
                       String organization, List<String> groups, List<String> teams,
                       long version, Instant createdAt, Instant updatedAt) {

        public static View of(Stakeholder s) {
            return new View(s.id, s.name, s.email,
                    s.jobFunction == null ? null : s.jobFunction.name,
                    s.jobFunction == null ? null : s.jobFunction.id,
                    s.organization.name,
                    s.groups.stream().map(g -> g.name).sorted().toList(),
                    s.teams.stream().map(t -> t.name).sorted().toList(),
                    s.version, s.createdAt, s.updatedAt);
        }
    }

    public record Upsert(String name, String email, UUID jobFunctionId, UUID organizationId) {
    }

    @GET
    @Scopes("stakeholders:read")
    public Response list(@QueryParam("organization") UUID organizationId, @QueryParam("page") Integer page,
                         @QueryParam("size") Integer size) {
        Organization org = tenant.organization(organizationId);
        PanacheQuery<Stakeholder> query = (org == null)
                ? Stakeholder.findAll()
                : Stakeholder.find("organization.id", org.id);
        return Responses.paged(query, page, size, View::of);
    }

    @POST
    @Scopes("stakeholders:create")
    @Transactional
    public Response create(Upsert body) {
        if (body.name() == null || body.name().isBlank()) {
            throw ApiException.validation("Stakeholder name is required");
        }
        if (body.email() == null || body.email().isBlank()) {
            throw ApiException.validation("Stakeholder email is required (logins are emails — binding is by email)");
        }
        if (Stakeholder.count("email", body.email()) > 0) {
            throw ApiException.duplicate("Stakeholder", body.email());
        }
        Organization org = body.organizationId() == null
                ? tenant.organization(null)
                : requireOrg(body.organizationId());
        Stakeholder s = new Stakeholder();
        s.name = body.name();
        s.email = body.email();
        s.organization = org;
        if (body.jobFunctionId() != null) {
            s.jobFunction = requireJobFunction(body.jobFunctionId());
        }
        s.persist();
        audit.mutation("create", "Stakeholder", s.id, org, "created stakeholder " + s.email);
        return Responses.created(View.of(s), s, "/stakeholders/" + s.id);
    }

    private JobFunction requireJobFunction(UUID id) {
        JobFunction jf = JobFunction.findById(id);
        if (jf == null) {
            throw ApiException.notFound("JobFunction", id);
        }
        return jf;
    }

    private Organization requireOrg(UUID id) {
        Organization org = Organization.findById(id);
        if (org == null) {
            throw ApiException.notFound("Organization", id);
        }
        return org;
    }

    @GET
    @Path("/{id}")
    @Scopes("stakeholders:read")
    public Response get(@PathParam("id") UUID id) {
        Stakeholder s = Stakeholder.findById(id);
        if (s == null) {
            throw ApiException.notFound("Stakeholder", id);
        }
        tenant.assertReadable(s.organization, "Stakeholder");
        audit.crossTenantRead("Stakeholder", id, s.organization, null);
        return Responses.withEtag(View.of(s), s);
    }

    @PUT
    @Path("/{id}")
    @Scopes("stakeholders:update")
    @Transactional
    public Response update(@PathParam("id") UUID id, Upsert body) {
        Stakeholder s = Stakeholder.findById(id);
        if (s == null) {
            throw ApiException.notFound("Stakeholder", id);
        }
        tenant.assertReadable(s.organization, "Stakeholder");
        if (body.name() != null) {
            s.name = body.name();
        }
        if (body.email() != null && !body.email().equals(s.email)) {
            if (Stakeholder.count("email", body.email()) > 0) {
                throw ApiException.duplicate("Stakeholder", body.email());
            }
            s.email = body.email();
        }
        if (body.jobFunctionId() != null) {
            s.jobFunction = requireJobFunction(body.jobFunctionId());
        }
        audit.mutation("update", "Stakeholder", id, s.organization, "updated stakeholder " + s.email);
        return Responses.updated(View.of(s), s);
    }

    @DELETE
    @Path("/{id}")
    @Scopes("stakeholders:delete")
    @Transactional
    public Response delete(@PathParam("id") UUID id) {
        Stakeholder s = Stakeholder.findById(id);
        if (s == null) {
            throw ApiException.notFound("Stakeholder", id);
        }
        tenant.assertReadable(s.organization, "Stakeholder");
        long teamStaffing = Team.count("members.id", id);
        if (teamStaffing > 0) {
            throw ApiException.inUse("Stakeholder", id,
                    "staffed on " + teamStaffing + " team(s) — team staffing is the source of this stakeholder; remove the membership there first");
        }
        long appOwns = Application.count("owner.id", id);
        if (appOwns > 0) {
            throw ApiException.inUse("Stakeholder", id, appOwns + " application(s) — reassign the owner first");
        }
        long svcOwns = BusinessService.count("owner.id", id);
        if (svcOwns > 0) {
            throw ApiException.inUse("Stakeholder", id, svcOwns + " business service(s) — reassign the owner first");
        }
        s.delete();
        audit.mutation("delete", "Stakeholder", id, s.organization, "deleted stakeholder " + s.email);
        return Response.noContent().build();
    }
}
