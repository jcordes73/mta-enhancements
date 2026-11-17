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
import org.konveyor.mta.hub.events.EventBroadcaster;
import org.konveyor.mta.hub.model.Analysis;
import org.konveyor.mta.hub.model.AnalysisProfile;
import org.konveyor.mta.hub.model.Application;
import org.konveyor.mta.hub.model.Incident;
import org.konveyor.mta.hub.model.Organization;
import org.konveyor.mta.hub.model.Task;
import org.konveyor.mta.hub.security.Scopes;
import org.konveyor.mta.hub.tenancy.TenantScope;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Analysis runs. POST /analyses queues a run for one application (creates
 * the ANALYSIS task and publishes the lifecycle events); the diff surface
 * lives at /applications/{id}/analysis/diff.
 */
@Path("/analyses")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AnalysisResource {

    @Inject
    TenantScope tenant;

    @Inject
    AuditService audit;

    @Inject
    EventBroadcaster events;

    public record View(UUID id, UUID applicationId, String application, UUID profileId, String profile,
                       String status, Instant startedAt, Instant completedAt, String triggeredBy,
                       long incidentCount, long version) {

        public static View of(Analysis a) {
            return new View(a.id, a.application.id, a.application.name,
                    a.profile == null ? null : a.profile.id, a.profile == null ? null : a.profile.name,
                    a.status.name(), a.startedAt, a.completedAt, a.triggeredBy,
                    org.konveyor.mta.hub.model.Incident.count("analysis.id", a.id), a.version);
        }
    }

    public record Create(UUID applicationId, UUID profileId) {
    }

    @GET
    @Scopes("analyses:read")
    public Response list(@QueryParam("application") UUID applicationId,
                         @QueryParam("status") String status,
                         @QueryParam("organization") UUID organizationId,
                         @QueryParam("page") Integer page, @QueryParam("size") Integer size) {
        Organization org = tenant.organization(organizationId);
        StringBuilder where = new StringBuilder("1=1");
        Map<String, Object> params = new LinkedHashMap<>();
        if (applicationId != null) {
            where.append(" and application.id = :app");
            params.put("app", applicationId);
        }
        if (status != null && !status.isBlank()) {
            try {
                params.put("status", Analysis.Status.valueOf(status.toUpperCase()));
            } catch (IllegalArgumentException e) {
                throw ApiException.validation("Unknown analysis status '" + status + "'");
            }
            where.append(" and status = :status");
        }
        PanacheQuery<Analysis> query = (org == null)
                ? Analysis.find(where + " order by createdAt desc", params)
                : Analysis.find("application.team.department.organization.id = :org and " + where + " order by createdAt desc",
                        withOrg(params, org.id));
        return Responses.paged(query, page, size, View::of);
    }

    @POST
    @Scopes("analyses:create")
    @Transactional
    public Response create(Create body) {
        if (body.applicationId() == null) {
            throw ApiException.validation("applicationId is required");
        }
        Application app = Application.findById(body.applicationId());
        if (app == null) {
            throw ApiException.notFound("Application", body.applicationId());
        }
        // queue gating (mock row 106): only Not started / Succeeded analyses queue a fresh run
        if (!app.analysisQueueable()) {
            throw ApiException.stateConflict("Application '" + app.name + "' analysis state is "
                    + app.analysisState + " — only NOT_STARTED or CURRENT analyses can be queued");
        }
        AnalysisProfile profile = null;
        if (body.profileId() != null) {
            profile = AnalysisProfile.findById(body.profileId());
            if (profile == null) {
                throw ApiException.notFound("AnalysisProfile", body.profileId());
            }
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
        task.label = "Analysis of " + app.name + (profile == null ? "" : " (" + profile.name + ")");
        task.triggeredBy = tenant.actor();
        task.persist();

        audit.mutation("create", "Analysis", analysis.id, app.team.department.organization,
                "queued analysis for " + app.name);
        events.publish("analysis", "analysis.queued", analysis.id,
                Map.of("application", app.name, "taskId", task.id.toString()));
        return Responses.created(View.of(analysis), analysis, "/analyses/" + analysis.id);
    }

    private static Map<String, Object> withOrg(Map<String, Object> params, UUID orgId) {
        Map<String, Object> all = new LinkedHashMap<>();
        all.put("org", orgId);
        all.putAll(params);
        return all;
    }

    /**
     * GET /analyses/incidents (contract v2.1): incidents carry the writable
     * triage {@code state} — recording decisions via API is the precondition
     * for the IDE and automation loops.
     */
    @GET
    @Path("/incidents")
    @Scopes("incidents:read")
    public Response listIncidents(@QueryParam("application") UUID applicationId,
                                  @QueryParam("state") String state,
                                  @QueryParam("ruleset") String ruleset,
                                  @QueryParam("organization") UUID organizationId,
                                  @QueryParam("page") Integer page, @QueryParam("size") Integer size) {
        Organization org = tenant.organization(organizationId);
        StringBuilder where = new StringBuilder("1=1");
        Map<String, Object> params = new LinkedHashMap<>();
        if (applicationId != null) {
            where.append(" and application.id = :app");
            params.put("app", applicationId);
        }
        if (state != null && !state.isBlank()) {
            where.append(" and state = :state");
            params.put("state", parseTriageState(state));
        }
        if (ruleset != null && !ruleset.isBlank()) {
            where.append(" and ruleset = :ruleset");
            params.put("ruleset", ruleset);
        }
        PanacheQuery<Incident> query = (org == null)
                ? Incident.find(where + " order by application.name, ruleset, file, line", params)
                : Incident.find("application.team.department.organization.id = :org and " + where
                        + " order by application.name, ruleset, file, line", withOrg(params, org.id));
        return Responses.paged(query, page, size, IncidentView::of);
    }

    /** §9.2: GET /analyses/{id}/triage (triage:read) — badge + history on demand. */
    @GET
    @Path("/{id}/triage")
    @Scopes("triage:read")
    public Response triageOfAnalysis(@PathParam("id") UUID analysisId) {
        Analysis analysis = Analysis.findById(analysisId);
        if (analysis == null) {
            throw ApiException.notFound("Analysis", analysisId);
        }
        tenant.assertReadable(analysis.application.team.department.organization, "Analysis");
        List<Incident> incidents = Incident.find("analysis.id = ?1 order by file, line", analysisId).list();
        List<IncidentView> views = incidents.stream().map(IncidentView::of).toList();
        return Response.ok(Map.of("analysisId", analysisId, "incidents", views,
                "totalCount", views.size())).build();
    }

    public static Incident.TriageState parseTriageState(String s) {
        try {
            return Incident.TriageState.valueOf(s.toUpperCase().replace('-', '_'));
        } catch (IllegalArgumentException e) {
            throw ApiException.validation("Unknown triage state '" + s
                    + "' — expected triage|assigned|in-progress|resolved|false-positive");
        }
    }

    public record IncidentView(String incidentKey, UUID applicationId, String application, UUID analysisId,
                               String ruleset, String rule, String file, int line, String message, int effort,
                               String state, String triageComment, String triageActor, java.time.Instant triagedAt,
                               long version, java.time.Instant createdAt, java.time.Instant updatedAt) {

        public static IncidentView of(Incident i) {
            return new IncidentView(i.incidentKey, i.application.id, i.application.name,
                    i.analysis == null ? null : i.analysis.id,
                    i.ruleset, i.rule, i.file, i.line, i.message, i.effort,
                    i.state.name(), i.triageComment, i.triageActor, i.triagedAt,
                    i.version, i.createdAt, i.updatedAt);
        }
    }
}
