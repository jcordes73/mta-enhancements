package org.konveyor.mta.hub.rest;

import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.PUT;
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
import org.konveyor.mta.hub.model.Workflow;
import org.konveyor.mta.hub.model.WorkflowRun;
import org.konveyor.mta.hub.security.Scopes;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * Migration workflows (#49, mock's MOCK_WORKFLOWS store).
 */
@Path("/workflows")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class WorkflowResource {

    public record View(UUID id, String name, int stages, String guide, boolean ready, String age,
                       long version, Instant createdAt, Instant updatedAt) {
        public static View of(Workflow w) {
            long d = Duration.between(w.createdAt, Instant.now()).toDays();
            String age = d >= 1 ? d + "d" : Duration.between(w.createdAt, Instant.now()).toHours() + "h";
            return new View(w.id, w.name, w.stages, w.guide, w.ready, age, w.version, w.createdAt, w.updatedAt);
        }
    }

    public record Upsert(String name, Integer stages, String guide, Boolean ready) {
    }

    @Inject
    AuditService audit;

    @GET
    @Scopes("workflows:read")
    public Response list(@QueryParam("page") Integer page, @QueryParam("size") Integer size) {
        return Responses.paged(Workflow.find("order by name"), page, size, View::of);
    }

    @POST
    @Scopes("workflows:create")
    @Transactional
    public Response create(Upsert body) {
        if (body.name() == null || body.name().isBlank()) {
            throw ApiException.validation("Workflow name is required");
        }
        if (Workflow.find("name", body.name()).firstResult() != null) {
            throw ApiException.duplicate("Workflow", body.name());
        }
        Workflow w = new Workflow();
        apply(w, body);
        w.persist();
        audit.mutation("create", "Workflow", w.id, null, "created workflow " + w.name);
        return Responses.created(View.of(w), w, "/workflows/" + w.id);
    }

    @PUT
    @Path("/{id}")
    @Scopes("workflows:update")
    @Transactional
    public Response update(@PathParam("id") UUID id, Upsert body) {
        Workflow w = Workflow.findById(id);
        if (w == null) {
            throw ApiException.notFound("Workflow", id);
        }
        Responses.checkIfMatch(null, w);
        apply(w, body);
        audit.mutation("update", "Workflow", id, null, "updated workflow " + w.name);
        return Responses.updated(View.of(w), w);
    }

    @DELETE
    @Path("/{id}")
    @Scopes("workflows:delete")
    @Transactional
    public Response delete(@PathParam("id") UUID id) {
        Workflow w = Workflow.findById(id);
        if (w == null) {
            throw ApiException.notFound("Workflow", id);
        }
        long runs = WorkflowRun.count("workflow", w);
        if (runs > 0) {
            throw ApiException.inUse("Workflow", w.name, runs + " run(s) reference it");
        }
        audit.mutation("delete", "Workflow", id, null, "deleted workflow " + w.name);
        w.delete();
        return Response.noContent().build();
    }

    private void apply(Workflow w, Upsert body) {
        if (body.name() != null) w.name = body.name();
        if (body.stages() != null) w.stages = body.stages();
        if (body.guide() != null) w.guide = body.guide();
        if (body.ready() != null) w.ready = body.ready();
    }
}
