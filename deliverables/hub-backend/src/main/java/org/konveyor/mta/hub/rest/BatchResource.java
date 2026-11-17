package org.konveyor.mta.hub.rest;

import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.konveyor.mta.hub.audit.AuditService;
import org.konveyor.mta.hub.error.ApiException;
import org.konveyor.mta.hub.events.EventBroadcaster;
import org.konveyor.mta.hub.model.Analysis;
import org.konveyor.mta.hub.model.AnalysisProfile;
import org.konveyor.mta.hub.model.Application;
import org.konveyor.mta.hub.model.Organization;
import org.konveyor.mta.hub.model.Tag;
import org.konveyor.mta.hub.model.Task;
import org.konveyor.mta.hub.security.Scopes;
import org.konveyor.mta.hub.tenancy.TenantScope;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Bulk operations (Batch & events, beta): bulk tagging now; batch analysis
 * start per Suggestion 33's extension set. Progress rides /events — CI and
 * GitOps subscribe instead of polling task state.
 */
@Path("/batch")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class BatchResource {

    @Inject
    TenantScope tenant;

    @Inject
    AuditService audit;

    @Inject
    EventBroadcaster events;

    public record BatchTags(List<UUID> applications, List<String> tags) {
    }

    public record BatchAnalyses(List<UUID> applicationIds, UUID profileId) {
    }

    public record BatchResult(UUID taskId, int applicationCount, List<String> tags, Instant acceptedAt) {
    }

    public record TaskRef(UUID taskId, UUID applicationId, String application) {
    }

    /** POST /batch/tags (contract v2.1, 202 — progress rides /events). */
    @POST
    @Path("/tags")
    @Scopes({"applications:update", "tags:update"})
    @Transactional
    public Response batchTag(BatchTags body) {
        if (body.applications() == null || body.applications().isEmpty()) {
            throw ApiException.validation("applications[] is required");
        }
        if (body.tags() == null || body.tags().isEmpty()) {
            throw ApiException.validation("tags[] is required");
        }
        List<Tag> tags = TagResource.ensureTags(body.tags(), audit);
        List<Application> apps = new ArrayList<>();
        Organization org = null;
        for (UUID appId : body.applications()) {
            Application app = Application.findById(appId);
            if (app == null) {
                throw ApiException.notFound("Application", appId);
            }
            if (org == null) {
                org = app.team.department.organization;
            }
            apps.add(app);
        }
        apps.forEach(app -> {
            tags.forEach(tag -> {
                if (!app.tags.contains(tag)) {
                    app.tags.add(tag);
                }
            });
            events.publish("application", "application.updated", app.id, Map.of("name", app.name, "batch", "tags"));
        });

        Task task = new Task();
        task.kind = Task.Kind.BATCH_TAG;
        task.state = Task.State.SUCCEEDED;
        task.label = "Bulk tag " + apps.size() + " application(s) with " + tags.size() + " tag(s)";
        task.startedAt = Instant.now();
        task.completedAt = Instant.now();
        task.triggeredBy = tenant.actor();
        task.persist();
        audit.mutation("batch-tag", "Application", "*", org,
                "tagged " + apps.size() + " application(s): " + String.join(", ", body.tags()));

        return Response.status(Response.Status.ACCEPTED)
                .entity(new BatchResult(task.id, apps.size(), body.tags(), Instant.now()))
                .build();
    }

    /** POST /batch/analyses (§9.1): {applicationIds[], profileId} → taskgroup reference. */
    @POST
    @Path("/analyses")
    @Scopes({"analyses:create", "applications:update"})
    @Transactional
    public Response batchAnalyses(BatchAnalyses body) {
        if (body.applicationIds() == null || body.applicationIds().isEmpty()) {
            throw ApiException.validation("applicationIds[] is required");
        }
        AnalysisProfile profile = null;
        if (body.profileId() != null) {
            profile = AnalysisProfile.findById(body.profileId());
            if (profile == null) {
                throw ApiException.notFound("AnalysisProfile", body.profileId());
            }
        }
        List<TaskRef> tasks = new ArrayList<>();
        List<String> skipped = new ArrayList<>();
        UUID taskgroupId = UUID.randomUUID();
        Organization org = null;
        for (UUID appId : body.applicationIds()) {
            Application app = Application.findById(appId);
            if (app == null) {
                throw ApiException.notFound("Application", appId);
            }
            // queue gating (mock row 106): ineligible states are SKIPPED, not fatal — the
            // response names them so the client can surface "N skipped (only Not started or
            // Succeeded analyses can queue)", mirroring the mock's bulk-queue behavior
            if (!app.analysisQueueable()) {
                skipped.add(app.name + " (" + app.analysisState + ")");
                continue;
            }
            if (org == null) {
                org = app.team.department.organization;
            }
            Analysis analysis = new Analysis();
            analysis.application = app;
            analysis.profile = profile;
            analysis.status = Analysis.Status.QUEUED;
            analysis.triggeredBy = tenant.actor();
            analysis.persist();

            Task task = new Task();
            task.kind = Task.Kind.ANALYSIS;
            task.state = Task.State.QUEUED;
            task.application = app;
            task.label = "Batch analysis " + taskgroupId + " of " + app.name;
            task.triggeredBy = tenant.actor();
            task.persist();

            tasks.add(new TaskRef(task.id, app.id, app.name));
            events.publish("task", "task.queued", task.id,
                    Map.of("taskgroup", taskgroupId.toString(), "application", app.name, "kind", "ANALYSIS"));
        }
        audit.mutation("batch-analyses", "Application", "*", org,
                "queued " + tasks.size() + " batch analysis task(s)");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("taskgroupId", taskgroupId);
        result.put("tasks", tasks);
        result.put("skipped", skipped);
        result.put("acceptedAt", Instant.now().toString());
        return Response.status(Response.Status.ACCEPTED).entity(result).build();
    }
}
