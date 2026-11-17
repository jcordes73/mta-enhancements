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
import org.konveyor.mta.hub.model.Identity;
import org.konveyor.mta.hub.model.Organization;
import org.konveyor.mta.hub.model.Stakeholder;
import org.konveyor.mta.hub.model.Team;
import org.konveyor.mta.hub.security.Scopes;
import org.konveyor.mta.hub.tenancy.TenantScope;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Teams are the unit of planning and ownership (#41): applications,
 * credentials and work assignments belong to exactly one team. The rosters
 * drive stakeholder derivation and delete guards.
 */
@Path("/teams")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class TeamResource {

    @Inject
    TenantScope tenant;

    @Inject
    AuditService audit;

    public record View(UUID id, String name, String department, UUID departmentId,
                       String organization, UUID organizationId,
                       List<String> members, long applicationCount, long credentialCount,
                       long version, Instant createdAt, Instant updatedAt) {

        public static View of(Team t) {
            return new View(t.id, t.name, t.department.name, t.department.id,
                    t.department.organization.name, t.department.organization.id,
                    t.members.stream().map(s -> s.email).sorted().toList(),
                    Application.count("team.id", t.id),
                    Identity.count("team.id", t.id),
                    t.version, t.createdAt, t.updatedAt);
        }
    }

    public record Upsert(String name, UUID departmentId, List<UUID> memberIds) {
    }

    @GET
    @Scopes("teams:read")
    public Response list(@QueryParam("organization") UUID organizationId, @QueryParam("department") UUID departmentId,
                         @QueryParam("page") Integer page, @QueryParam("size") Integer size) {
        Organization org = tenant.organization(organizationId);
        PanacheQuery<Team> query = (org == null)
                ? Team.findAll()
                : Team.inOrganization(org.id);
        if (departmentId != null) {
            query = (org == null)
                    ? Team.find("department.id", departmentId)
                    : Team.find("department.organization.id = ?1 and department.id = ?2", org.id, departmentId);
        }
        return Responses.paged(query, page, size, View::of);
    }

    @POST
    @Scopes("teams:create")
    @Transactional
    public Response create(Upsert body) {
        if (body.name() == null || body.name().isBlank()) {
            throw ApiException.validation("Team name is required");
        }
        Department dept = resolveDepartment(body.departmentId());
        Team team = new Team();
        team.name = body.name();
        team.department = dept;
        team.persist();
        applyMembers(team, body.memberIds());
        audit.mutation("create", "Team", team.id, dept.organization, "created team " + team.name);
        return Responses.created(View.of(team), team, "/teams/" + team.id);
    }

    private Department resolveDepartment(UUID departmentId) {
        if (departmentId == null) {
            throw ApiException.validation("departmentId is required");
        }
        Department dept = Department.findById(departmentId);
        if (dept == null) {
            throw ApiException.notFound("Department", departmentId);
        }
        // Tenant check: non-platform-admins can only create inside their org.
        if (!tenant.platformAdmin()) {
            Organization mine = tenant.organization(null);
            if (mine == null || !mine.id.equals(dept.organization.id)) {
                throw ApiException.tenantMismatch("Department");
            }
        }
        return dept;
    }

    @GET
    @Path("/{id}")
    @Scopes("teams:read")
    public Response get(@PathParam("id") UUID id) {
        Team team = Team.findById(id);
        if (team == null) {
            throw ApiException.notFound("Team", id);
        }
        tenant.assertReadable(team.department.organization, "Team");
        audit.crossTenantRead("Team", id, team.department.organization, null);
        return Responses.withEtag(View.of(team), team);
    }

    @PUT
    @Path("/{id}")
    @Scopes("teams:update")
    @Transactional
    public Response update(@PathParam("id") UUID id, Upsert body) {
        Team team = Team.findById(id);
        if (team == null) {
            throw ApiException.notFound("Team", id);
        }
        tenant.assertReadable(team.department.organization, "Team");
        if (body.name() != null) {
            team.name = body.name(); // rename cascades into applications' team references
        }
        if (body.memberIds() != null) {
            applyMembers(team, body.memberIds());
        }
        audit.mutation("update", "Team", id, team.department.organization, "updated team " + team.name);
        return Responses.updated(View.of(team), team);
    }

    @DELETE
    @Path("/{id}")
    @Scopes("teams:delete")
    @Transactional
    public Response delete(@PathParam("id") UUID id) {
        Team team = Team.findById(id);
        if (team == null) {
            throw ApiException.notFound("Team", id);
        }
        tenant.assertReadable(team.department.organization, "Team");
        long apps = Application.count("team.id", id);
        if (apps > 0) {
            throw ApiException.inUse("Team", id,
                    apps + " application(s) still assigned — the exactly-one-team invariant blocks the delete");
        }
        long creds = Identity.count("team.id", id);
        if (creds > 0) {
            throw ApiException.inUse("Team", id, creds + " credential(s) still owned");
        }
        for (Stakeholder m : List.copyOf(team.members)) {
            m.teams.remove(team);
        }
        team.delete();
        audit.mutation("delete", "Team", id, team.department.organization, "deleted team " + team.name);
        return Response.noContent().build();
    }

    /** One role per person per team — the roster IS the staffing record.
     *  The owning side is {@code stakeholder.teams}; both sides are kept in
     *  sync so the view reads correctly within the same transaction. */
    private void applyMembers(Team team, List<UUID> memberIds) {
        if (memberIds == null) {
            return;
        }
        for (Stakeholder m : List.copyOf(team.members)) {
            m.teams.remove(team);
        }
        team.members.clear();
        for (UUID memberId : memberIds) {
            Stakeholder s = Stakeholder.findById(memberId);
            if (s == null) {
                throw ApiException.notFound("Stakeholder", memberId);
            }
            if (!s.organization.id.equals(team.department.organization.id)) {
                throw ApiException.tenantMismatch("Stakeholder '" + s.email + "'");
            }
            s.teams.add(team);
            team.members.add(s);
        }
    }

    public static Map<String, Object> ref(Team t) {
        return Map.of("id", t.id, "name", t.name);
    }
}
