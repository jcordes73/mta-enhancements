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
import org.konveyor.mta.hub.model.Wave;
import org.konveyor.mta.hub.security.Scopes;
import org.konveyor.mta.hub.tenancy.TenantScope;

import java.time.LocalDate;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Migration waves — the unit of planning (defect 31): reassigning an
 * application between waves re-derives the wave's aggregates from the new
 * membership; assignment is admission-gated in the UI layer.
 */
@Path("/waves")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class WaveResource {

    @Inject
    TenantScope tenant;

    @Inject
    AuditService audit;

    public record View(UUID id, String name, int position, LocalDate startDate, LocalDate endDate,
                       String organization, List<String> members, int memberCount,
                       int totalEffort, Map<String, Long> memberAnalysisStates,
                       long version, Instant createdAt, Instant updatedAt) {

        public static View of(Wave w) {
            List<Application> apps = w.members.stream().sorted(java.util.Comparator.comparing(a -> a.name)).toList();
            Map<String, Long> states = new LinkedHashMap<>();
            apps.forEach(a -> states.merge(a.analysisState.name(), 1L, Long::sum));
            return new View(w.id, w.name, w.position, w.startDate, w.endDate,
                    w.organization.name,
                    apps.stream().map(a -> a.name).toList(),
                    apps.size(),
                    apps.stream().mapToInt(a -> a.effort).sum(),
                    states, w.version, w.createdAt, w.updatedAt);
        }
    }

    public record Upsert(String name, Integer position, LocalDate startDate, LocalDate endDate,
                         UUID organizationId, List<UUID> memberIds) {
    }

    @GET
    @Scopes("waves:read")
    public Response list(@QueryParam("organization") UUID organizationId, @QueryParam("page") Integer page,
                         @QueryParam("size") Integer size) {
        Organization org = tenant.organization(organizationId);
        PanacheQuery<Wave> query = (org == null)
                ? Wave.find("order by position, name")
                : Wave.find("organization.id = ?1 order by position, name", org.id);
        return Responses.paged(query, page, size, View::of);
    }

    @POST
    @Scopes("waves:create")
    @Transactional
    public Response create(Upsert body) {
        if (body.name() == null || body.name().isBlank()) {
            throw ApiException.validation("Wave name is required");
        }
        Organization org = body.organizationId() == null
                ? tenant.organization(null)
                : (Organization.findById(body.organizationId()) != null
                        ? (Organization) Organization.findById(body.organizationId()) : null);
        if (org == null) {
            throw ApiException.notFound("Organization", body.organizationId());
        }
        Wave wave = new Wave();
        wave.name = body.name();
        wave.position = body.position() == null ? 0 : body.position();
        wave.startDate = body.startDate();
        wave.endDate = body.endDate();
        wave.organization = org;
        wave.persist();
        applyMembers(wave, body.memberIds());
        audit.mutation("create", "Wave", wave.id, org, "created wave " + wave.name);
        return Responses.created(View.of(wave), wave, "/waves/" + wave.id);
    }

    @GET
    @Path("/{id}")
    @Scopes("waves:read")
    public Response get(@PathParam("id") UUID id) {
        Wave wave = Wave.findById(id);
        if (wave == null) {
            throw ApiException.notFound("Wave", id);
        }
        audit.crossTenantRead("Wave", id, wave.organization, null);
        return Responses.withEtag(View.of(wave), wave);
    }

    @PUT
    @Path("/{id}")
    @Scopes("waves:update")
    @Transactional
    public Response update(@PathParam("id") UUID id, Upsert body) {
        Wave wave = Wave.findById(id);
        if (wave == null) {
            throw ApiException.notFound("Wave", id);
        }
        if (body.name() != null) {
            wave.name = body.name();
        }
        if (body.position() != null) {
            wave.position = body.position();
        }
        if (body.startDate() != null) {
            wave.startDate = body.startDate();
        }
        if (body.endDate() != null) {
            wave.endDate = body.endDate();
        }
        if (body.memberIds() != null) {
            applyMembers(wave, body.memberIds());
        }
        audit.mutation("update", "Wave", id, wave.organization, "updated wave " + wave.name);
        return Responses.updated(View.of(wave), wave);
    }

    @DELETE
    @Path("/{id}")
    @Scopes("waves:delete")
    @Transactional
    public Response delete(@PathParam("id") UUID id) {
        Wave wave = Wave.findById(id);
        if (wave == null) {
            throw ApiException.notFound("Wave", id);
        }
        tenant.assertReadable(wave.organization, "Wave");
        wave.members.clear();
        wave.delete();
        audit.mutation("delete", "Wave", id, wave.organization, "deleted wave " + wave.name);
        return Response.noContent().build();
    }

    /** Membership carries the applications (and their evidence) with the wave. */
    private void applyMembers(Wave wave, List<UUID> memberIds) {
        if (memberIds == null) {
            return;
        }
        wave.members.clear();
        for (UUID appId : memberIds) {
            Application app = Application.findById(appId);
            if (app == null) {
                throw ApiException.notFound("Application", appId);
            }
            if (!app.team.department.organization.id.equals(wave.organization.id)) {
                throw ApiException.tenantMismatch("Application '" + app.name + "'");
            }
            wave.members.add(app);
        }
    }
}
