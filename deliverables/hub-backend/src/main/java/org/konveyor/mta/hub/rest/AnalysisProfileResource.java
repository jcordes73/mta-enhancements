package org.konveyor.mta.hub.rest;

import io.quarkus.hibernate.orm.panache.PanacheQuery;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
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
import org.konveyor.mta.hub.model.Analysis;
import org.konveyor.mta.hub.model.AnalysisProfile;
import org.konveyor.mta.hub.security.Scopes;
import org.konveyor.mta.hub.tenancy.TenantScope;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Analysis profiles — the resource every analysis is driven by, first-class
 * REST with its own RBAC scope (the API-parity gate: no UI surface ships
 * without them).
 */
@Path("/analysis-profiles")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AnalysisProfileResource {

    @Inject
    TenantScope tenant;

    @Inject
    AuditService audit;

    public record View(UUID id, String name, String description, List<String> sources,
                       List<String> targets, long analysisCount, long version,
                       Instant createdAt, Instant updatedAt) {

        public static View of(AnalysisProfile p) {
            return new View(p.id, p.name, p.description,
                    p.sources.stream().sorted().toList(),
                    p.targets.stream().sorted().toList(),
                    Analysis.count("profile.id", p.id), p.version, p.createdAt, p.updatedAt);
        }
    }

    public record Upsert(String name, String description, List<String> sources, List<String> targets) {
    }

    @GET
    @Scopes("analysis-profiles:read")
    public Response list(@QueryParam("page") Integer page, @QueryParam("size") Integer size) {
        PanacheQuery<AnalysisProfile> query = AnalysisProfile.search(null);
        return Responses.paged(query, page, size, View::of);
    }

    @POST
    @Scopes("analysis-profiles:create")
    @Transactional
    public Response create(Upsert body) {
        if (body.name() == null || body.name().isBlank()) {
            throw ApiException.validation("Analysis profile name is required");
        }
        if (AnalysisProfile.count("name", body.name()) > 0) {
            throw ApiException.duplicate("AnalysisProfile", body.name());
        }
        AnalysisProfile profile = new AnalysisProfile();
        profile.name = body.name();
        profile.description = body.description();
        if (body.sources() != null) {
            profile.sources.addAll(body.sources());
        }
        if (body.targets() != null) {
            profile.targets.addAll(body.targets());
        }
        profile.persist();
        audit.mutation("create", "AnalysisProfile", profile.id, null, "created analysis profile " + profile.name);
        return Responses.created(View.of(profile), profile, "/analysis-profiles/" + profile.id);
    }

    @GET
    @Path("/{id}")
    @Scopes("analysis-profiles:read")
    public Response get(@PathParam("id") UUID id) {
        AnalysisProfile profile = AnalysisProfile.findById(id);
        if (profile == null) {
            throw ApiException.notFound("AnalysisProfile", id);
        }
        return Responses.withEtag(View.of(profile), profile);
    }

    @PUT
    @Path("/{id}")
    @Scopes("analysis-profiles:update")
    @Transactional
    public Response update(@PathParam("id") UUID id, @HeaderParam("If-Match") String ifMatch, Upsert body) {
        AnalysisProfile profile = AnalysisProfile.findById(id);
        if (profile == null) {
            throw ApiException.notFound("AnalysisProfile", id);
        }
        Responses.checkIfMatch(ifMatch, profile);
        if (body.name() != null) {
            profile.name = body.name();
        }
        if (body.description() != null) {
            profile.description = body.description();
        }
        if (body.sources() != null) {
            profile.sources.clear();
            profile.sources.addAll(body.sources());
        }
        if (body.targets() != null) {
            profile.targets.clear();
            profile.targets.addAll(body.targets());
        }
        audit.mutation("update", "AnalysisProfile", id, null, "updated analysis profile " + profile.name);
        return Responses.updated(View.of(profile), profile);
    }

    @DELETE
    @Path("/{id}")
    @Scopes("analysis-profiles:delete")
    @Transactional
    public Response delete(@PathParam("id") UUID id) {
        AnalysisProfile profile = AnalysisProfile.findById(id);
        if (profile == null) {
            throw ApiException.notFound("AnalysisProfile", id);
        }
        long refs = Analysis.count("profile.id", id);
        if (refs > 0) {
            throw ApiException.inUse("AnalysisProfile", id, refs + " analysis run(s)");
        }
        profile.delete();
        audit.mutation("delete", "AnalysisProfile", id, null, "deleted analysis profile " + profile.name);
        return Response.noContent().build();
    }
}
