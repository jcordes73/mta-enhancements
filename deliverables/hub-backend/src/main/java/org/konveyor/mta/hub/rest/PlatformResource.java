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
import org.konveyor.mta.hub.model.Application;
import org.konveyor.mta.hub.model.Platform;
import org.konveyor.mta.hub.security.Scopes;

import java.util.UUID;

/**
 * Source platforms (mock's MOCK_PLATFORMS store) — Config registries tab and
 * the inventory platform filter. Delete is guarded by application usage.
 */
@Path("/platforms")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class PlatformResource {

    public record View(UUID id, String name, String type, long applications,
                       long version, java.time.Instant createdAt, java.time.Instant updatedAt) {
        public static View of(Platform p) {
            return new View(p.id, p.name, p.type,
                    Application.count("platform", p), p.version, p.createdAt, p.updatedAt);
        }
    }

    public record Upsert(String name, String type) {
    }

    @Inject
    AuditService audit;

    @GET
    @Scopes("platforms:read")
    public Response list(@QueryParam("page") Integer page, @QueryParam("size") Integer size) {
        return Responses.paged(Platform.find("order by name"), page, size, View::of);
    }

    @POST
    @Scopes("platforms:create")
    @Transactional
    public Response create(Upsert body) {
        if (body.name() == null || body.name().isBlank()) {
            throw ApiException.validation("Platform name is required");
        }
        if (Platform.find("name", body.name()).firstResult() != null) {
            throw ApiException.duplicate("Platform", body.name());
        }
        Platform p = new Platform();
        p.name = body.name();
        p.type = body.type() == null || body.type().isBlank() ? "kubernetes" : body.type();
        p.persist();
        audit.mutation("create", "Platform", p.id, null, "created platform " + p.name);
        return Responses.created(View.of(p), p, "/platforms/" + p.id);
    }

    @DELETE
    @Path("/{id}")
    @Scopes("platforms:delete")
    @Transactional
    public Response delete(@PathParam("id") UUID id) {
        Platform p = Platform.findById(id);
        if (p == null) {
            throw ApiException.notFound("Platform", id);
        }
        long inUse = Application.count("platform", p);
        if (inUse > 0) {
            throw ApiException.inUse("Platform", p.name, inUse + " application(s) still target it — reassign them first");
        }
        audit.mutation("delete", "Platform", id, null, "deleted platform " + p.name);
        p.delete();
        return Response.noContent().build();
    }
}
