package org.konveyor.mta.hub.rest;

import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.konveyor.mta.hub.audit.AuditService;
import org.konveyor.mta.hub.error.ApiException;
import org.konveyor.mta.hub.model.Target;
import org.konveyor.mta.hub.security.Scopes;

import java.util.UUID;

/**
 * Migration targets (mock's MOCK_TARGETS store) — Config registries tab.
 */
@Path("/targets")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class TargetResource {

    public record View(UUID id, String name, String langs,
                       long version, java.time.Instant createdAt, java.time.Instant updatedAt) {
        public static View of(Target t) {
            return new View(t.id, t.name, t.langs, t.version, t.createdAt, t.updatedAt);
        }
    }

    public record Upsert(String name, String langs) {
    }

    @Inject
    AuditService audit;

    @GET
    @Scopes("targets:read")
    public Response list(@QueryParam("page") Integer page, @QueryParam("size") Integer size) {
        return Responses.paged(Target.find("order by name"), page, size, View::of);
    }

    @POST
    @Scopes("targets:create")
    @Transactional
    public Response create(Upsert body) {
        if (body.name() == null || body.name().isBlank()) {
            throw ApiException.validation("Target name is required");
        }
        if (Target.find("name", body.name()).firstResult() != null) {
            throw ApiException.duplicate("Target", body.name());
        }
        Target t = new Target();
        t.name = body.name();
        t.langs = body.langs() == null || body.langs().isBlank() ? "Java" : body.langs();
        t.persist();
        audit.mutation("create", "Target", t.id, null, "created target " + t.name);
        return Responses.created(View.of(t), t, "/targets/" + t.id);
    }

    @DELETE
    @Path("/{id}")
    @Scopes("targets:delete")
    @Transactional
    public Response delete(@PathParam("id") UUID id) {
        Target t = Target.findById(id);
        if (t == null) {
            throw ApiException.notFound("Target", id);
        }
        audit.mutation("delete", "Target", id, null, "deleted target " + t.name);
        t.delete();
        return Response.noContent().build();
    }
}
