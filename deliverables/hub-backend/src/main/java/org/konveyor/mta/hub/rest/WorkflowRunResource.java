package org.konveyor.mta.hub.rest;

import io.quarkus.hibernate.orm.panache.PanacheQuery;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
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
import org.konveyor.mta.hub.model.Workflow;
import org.konveyor.mta.hub.model.WorkflowRun;
import org.konveyor.mta.hub.security.Scopes;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * Workflow runs (mock's MOCK_WFRUNS store) — the operations-first surface of
 * the Agentic section. Runs decompose into per-stage agent runs.
 */
@Path("/workflow-runs")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class WorkflowRunResource {

    public record View(UUID id, String name, String workflow, String application, String phase,
                       int stages, String state, String age, String duration, boolean canonical,
                       long version, Instant createdAt, Instant updatedAt) {

        public static View of(WorkflowRun r) {
            Duration d = Duration.between(r.createdAt, Instant.now());
            String age = d.toHours() >= 24
                    ? (d.toDays() + "d")
                    : d.toHours() >= 1 ? (d.toHours() + "h") : (d.toMinutes() + "m");
            return new View(r.id, r.name, r.workflow.name, r.application.name, r.phase,
                    r.stages, r.state.name(), age, r.duration, r.canonical,
                    r.version, r.createdAt, r.updatedAt);
        }
    }

    public record Upsert(String name, String workflow, String application, String phase,
                         Integer stages, String state, String duration, Boolean canonical) {
    }

    @Inject
    AuditService audit;

    @GET
    @Scopes("workflow-runs:read")
    public Response list(@QueryParam("application") String appName, @QueryParam("state") String state,
                         @QueryParam("page") Integer page, @QueryParam("size") Integer size) {
        PanacheQuery<WorkflowRun> query = (appName != null && !appName.isBlank())
                ? WorkflowRun.find("application.name = ?1 order by createdAt desc", appName)
                : WorkflowRun.find("order by createdAt desc");
        return Responses.paged(query, page, size, View::of);
    }

    @GET
    @Path("/{id}")
    @Scopes("workflow-runs:read")
    public Response get(@PathParam("id") UUID id) {
        WorkflowRun r = WorkflowRun.findById(id);
        if (r == null) {
            throw ApiException.notFound("WorkflowRun", id);
        }
        return Responses.withEtag(View.of(r), r);
    }

    @POST
    @Scopes("workflow-runs:create")
    @Transactional
    public Response create(Upsert body) {
        if (body.name() == null || body.workflow() == null || body.application() == null) {
            throw ApiException.validation("Run name, workflow and application are required");
        }
        if (WorkflowRun.find("name", body.name()).firstResult() != null) {
            throw ApiException.duplicate("WorkflowRun", body.name());
        }
        Workflow wf = Workflow.find("name", body.workflow()).firstResult();
        if (wf == null) {
            throw ApiException.notFound("Workflow", body.workflow());
        }
        Application app = Application.findByName(body.application());
        if (app == null) {
            throw ApiException.notFound("Application", body.application());
        }
        WorkflowRun r = new WorkflowRun();
        r.name = body.name();
        r.workflow = wf;
        r.application = app;
        r.phase = body.phase() == null ? "plan" : body.phase();
        r.stages = body.stages() == null ? wf.stages : body.stages();
        r.state = body.state() == null ? WorkflowRun.State.RUNNING : WorkflowRun.State.valueOf(body.state().toUpperCase());
        r.duration = body.duration();
        r.canonical = Boolean.TRUE.equals(body.canonical());
        r.persist();
        audit.mutation("create", "WorkflowRun", r.id, app.team.department.organization,
                "queued workflow run " + r.name + " for " + app.name);
        return Responses.created(View.of(r), r, "/workflow-runs/" + r.id);
    }
}
