package org.konveyor.mta.hub.rest;

import io.quarkus.hibernate.orm.panache.PanacheQuery;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.DefaultValue;
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
import org.konveyor.mta.hub.events.EventBroadcaster;
import org.konveyor.mta.hub.model.Analysis;
import org.konveyor.mta.hub.model.Application;
import org.konveyor.mta.hub.model.Archetype;
import org.konveyor.mta.hub.model.BusinessService;
import org.konveyor.mta.hub.model.Incident;
import org.konveyor.mta.hub.model.AgentRun;
import org.konveyor.mta.hub.model.AgentRunEvent;
import org.konveyor.mta.hub.model.Organization;
import org.konveyor.mta.hub.model.Stakeholder;
import org.konveyor.mta.hub.model.Tag;
import org.konveyor.mta.hub.model.Task;
import org.konveyor.mta.hub.model.WaveEvidence;
import org.konveyor.mta.hub.model.WaveTicket;
import org.konveyor.mta.hub.model.WorkflowRun;
import org.konveyor.mta.hub.model.Team;
import org.konveyor.mta.hub.model.Wave;
import org.konveyor.mta.hub.security.Scopes;
import org.konveyor.mta.hub.tenancy.TenantScope;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Path("/applications")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ApplicationResource {

    @Inject
    TenantScope tenant;

    @Inject
    AuditService audit;

    @Inject
    EventBroadcaster events;

    // ------------------------------------------------------------------ view

    public record View(UUID id, String name, String description, String repositoryUrl,
                       String businessService, UUID businessServiceId,
                       String owner, UUID ownerId,
                       String team, UUID teamId, String organization,
                       String archetype, UUID archetypeId,
                       List<String> tags, String analysisState, int effort, String risk,
                       String riskKind, String platform, String repositoryType, boolean binaryArtifact,
                       String assessmentVersion, String reviewState,
                       String identity, String credential,
                       long incidents, Double progress,
                       long version, Instant createdAt, Instant updatedAt) {

        public static View of(Application a) {
            Organization org = a.team.department.organization;
            Double pct = null;
            Analysis running = Analysis.find("application = ?1 and status = ?2", a, Analysis.Status.RUNNING).firstResult();
            if (running != null) {
                pct = (double) running.progress;
            }
            return new View(a.id, a.name, a.description, a.repositoryUrl,
                    a.businessService.name, a.businessService.id,
                    a.owner == null ? null : a.owner.name, a.owner == null ? null : a.owner.id,
                    a.team.name, a.team.id, org.name,
                    a.archetype == null ? null : a.archetype.name, a.archetype == null ? null : a.archetype.id,
                    a.tags.stream().map(t -> t.name).sorted().toList(),
                    a.analysisState.name(), a.effort, a.risk,
                    a.riskKind.name(),
                    a.platform == null ? null : a.platform.name,
                    a.repositoryType.name(),
                    a.binaryArtifact,
                    a.assessmentVersion,
                    a.reviewState.name(),
                    a.identity == null ? null : a.identity.name,
                    a.credential == null ? null : a.credential.name,
                    Incident.count("application", a),
                    pct,
                    a.version, a.createdAt, a.updatedAt);
        }
    }

    public record Upsert(String name, String description, String repositoryUrl,
                         UUID businessServiceId, UUID ownerId, UUID teamId, UUID archetypeId,
                         List<String> tags, String analysisState, Integer effort, String risk) {
    }

    // ----------------------------------------------------------------- list

    @GET
    @Scopes("applications:read")
    public Response list(@QueryParam("name") String name,
                         @QueryParam("businessService") String businessService,
                         @QueryParam("team") UUID teamId,
                         @QueryParam("analysisState") String analysisState,
                         @QueryParam("organization") UUID organizationId,
                         @QueryParam("page") Integer page,
                         @QueryParam("size") Integer size) {
        Organization org = tenant.organization(organizationId);
        if (org == null) {
            audit.crossTenantRead("Application", "*", null, "platform admin listed all applications");
        }
        StringBuilder where = new StringBuilder("1=1");
        Map<String, Object> params = new LinkedHashMap<>();
        if (name != null && !name.isBlank()) {
            where.append(" and lower(name) like :name");
            params.put("name", "%" + name.toLowerCase() + "%");
        }
        if (businessService != null && !businessService.isBlank()) {
            where.append(" and businessService.name = :bsvc");
            params.put("bsvc", businessService);
        }
        if (teamId != null) {
            where.append(" and team.id = :team");
            params.put("team", teamId);
        }
        if (analysisState != null && !analysisState.isBlank()) {
            where.append(" and analysisState = :state");
            params.put("state", parseState(analysisState));
        }
        PanacheQuery<Application> query = (org == null)
                ? Application.find(where.toString(), params)
                : Application.find("team.department.organization.id = :org and " + where,
                        withOrg(params, org.id));
        return Responses.paged(query, page, size, ApplicationResource.View::of);
    }

    private static Map<String, Object> withOrg(Map<String, Object> params, UUID orgId) {
        Map<String, Object> all = new LinkedHashMap<>();
        all.put("org", orgId);
        all.putAll(params);
        return all;
    }

    private static Application.AnalysisState parseState(String s) {
        try {
            return Application.AnalysisState.valueOf(s.toUpperCase().replace('-', '_'));
        } catch (IllegalArgumentException e) {
            throw ApiException.validation("Unknown analysisState '" + s + "'");
        }
    }

    // ---------------------------------------------------------------- create

    @POST
    @Scopes("applications:create")
    @Transactional
    public Response create(@QueryParam("upsert") @DefaultValue("false") boolean upsert, Upsert body) {
        if (body.name() == null || body.name().isBlank()) {
            throw ApiException.validation("Application name is required");
        }
        Application existing = Application.findByName(body.name());
        if (existing != null) {
            if (!upsert) {
                throw ApiException.duplicate("Application", body.name());
            }
            apply(existing, body);
            events.publish("application", "application.updated", existing.id, Map.of("name", existing.name));
            return Responses.updated(View.of(existing), existing);
        }
        Application app = new Application();
        app.name = body.name();
        apply(app, body);
        app.persist();
        audit.mutation("create", "Application", app.id, app.team.department.organization, "created application " + app.name);
        events.publish("application", "application.created", app.id, Map.of("name", app.name));
        return Responses.created(View.of(app), app, "/applications/" + app.id);
    }

    // ----------------------------------------------------------------- item

    @GET
    @Path("/{id}")
    @Scopes("applications:read")
    public Response get(@PathParam("id") UUID id) {
        Application app = Application.findById(id);
        if (app == null) {
            throw ApiException.notFound("Application", id);
        }
        Organization org = app.team.department.organization;
        tenant.assertReadable(org, "Application");
        audit.crossTenantRead("Application", id, org, null);
        return Responses.withEtag(View.of(app), app);
    }

    @PUT
    @Path("/{id}")
    @Scopes("applications:update")
    @Transactional
    public Response update(@PathParam("id") UUID id,
                           @HeaderParam("If-Match") String ifMatch,
                           Upsert body) {
        Application app = Application.findById(id);
        if (app == null) {
            throw ApiException.notFound("Application", id);
        }
        Responses.checkIfMatch(ifMatch, app);
        tenant.assertReadable(app.team.department.organization, "Application");
        apply(app, body);
        audit.mutation("update", "Application", id, app.team.department.organization, "updated application " + app.name);
        events.publish("application", "application.updated", id, Map.of("name", app.name));
        return Responses.updated(View.of(app), app);
    }

    @DELETE
    @Path("/{id}")
    @Scopes("applications:delete")
    @Transactional
    public Response delete(@PathParam("id") UUID id) {
        Application app = Application.findById(id);
        if (app == null) {
            throw ApiException.notFound("Application", id);
        }
        Organization org = app.team.department.organization;
        tenant.assertReadable(org, "Application");
        long waveRefs = Wave.find("select w from Wave w join w.members m where m.id = ?1", id).count();
        if (waveRefs > 0) {
            throw ApiException.inUse("Application", id, waveRefs + " wave(s) — remove it from the wave(s) first");
        }
        Incident.delete("application.id", id);
        Analysis.delete("application.id", id);
        // full cascade (mock row 106 — the UI's bulk delete hits this for seeded apps):
        // agentic rows (events via their run), the workflow-run stages, tasks and wave
        // content FK-reference the application non-optionally and would fail the delete
        AgentRunEvent.delete("agentRun.application.id", id);
        AgentRun.delete("application.id", id);
        WorkflowRun.delete("application.id", id);
        Task.delete("application.id", id);
        WaveEvidence.delete("application.id", id);
        WaveTicket.delete("application.id", id);
        app.delete();
        audit.mutation("delete", "Application", id, org, "deleted application " + app.name);
        events.publish("application", "application.deleted", id, Map.of("name", app.name));
        return Response.noContent().build();
    }

    // ------------------------------------------------------- analysis diff

    /**
     * Analysis diff (#33 item 2): added / resolved / changed incidents plus
     * the effort delta between two analyses of the same application.
     * Triage states carry over per §8.1 (exact incident identity).
     */
    @GET
    @Path("/{id}/analysis/diff")
    @Scopes("analyses:read")
    public Response analysisDiff(@PathParam("id") UUID id,
                                 @QueryParam("from") UUID fromId,
                                 @QueryParam("to") UUID toId) {
        Application app = Application.findById(id);
        if (app == null) {
            throw ApiException.notFound("Application", id);
        }
        audit.crossTenantRead("Application", id, app.team.department.organization, "analysis diff");
        Analysis from = requireAnalysis(fromId, id, "from");
        Analysis to = requireAnalysis(toId, id, "to");

        Map<String, Incident> fromIdx = incidentIndex(from);
        Map<String, Incident> toIdx = incidentIndex(to);

        List<Map<String, Object>> added = new ArrayList<>();
        List<Map<String, Object>> resolved = new ArrayList<>();
        List<Map<String, Object>> changed = new ArrayList<>();
        for (Map.Entry<String, Incident> e : toIdx.entrySet()) {
            Incident before = fromIdx.get(e.getKey());
            if (before == null) {
                added.add(incidentRef(e.getValue()));
            } else if (before.state != e.getValue().state || before.effort != e.getValue().effort) {
                changed.add(diff(before, e.getValue()));
            }
        }
        for (Map.Entry<String, Incident> e : fromIdx.entrySet()) {
            if (!toIdx.containsKey(e.getKey())) {
                resolved.add(incidentRef(e.getValue()));
            }
        }
        int effortDelta = toIdx.values().stream().mapToInt(i -> i.effort).sum()
                - fromIdx.values().stream().mapToInt(i -> i.effort).sum();
        long triageCarryover = toIdx.values().stream()
                .filter(i -> i.triagedAt != null).count();

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("added", added);
        body.put("resolved", resolved);
        body.put("changed", changed);
        body.put("effortDelta", effortDelta);
        body.put("triageCarryover", triageCarryover);
        return Response.ok(body).build();
    }

    private Analysis requireAnalysis(UUID analysisId, UUID applicationId, String param) {
        if (analysisId == null) {
            throw ApiException.validation("Query parameter '" + param + "' (analysis id) is required");
        }
        Analysis a = Analysis.findById(analysisId);
        if (a == null || !a.application.id.equals(applicationId)) {
            throw ApiException.notFound("Analysis", analysisId);
        }
        return a;
    }

    private static Map<String, Incident> incidentIndex(Analysis analysis) {
        Map<String, Incident> idx = new LinkedHashMap<>();
        for (Incident i : Incident.<Incident>find("analysis.id", analysis.id).list()) {
            idx.put(incidentIdentity(i), i);
        }
        return idx;
    }

    private static String incidentIdentity(Incident i) {
        return i.ruleset + "." + i.rule + "@" + i.file + ":" + i.line;
    }

    private static Map<String, Object> incidentRef(Incident i) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("incidentKey", i.incidentKey);
        m.put("ruleset", i.ruleset);
        m.put("rule", i.rule);
        m.put("file", i.file);
        m.put("line", i.line);
        m.put("effort", i.effort);
        m.put("state", i.state.name());
        return m;
    }

    private static Map<String, Object> diff(Incident before, Incident after) {
        Map<String, Object> m = incidentRef(after);
        m.put("before", Map.of("state", before.state.name(), "effort", before.effort));
        m.put("after", Map.of("state", after.state.name(), "effort", after.effort));
        return m;
    }

    // -------------------------------------------------------------- helpers

    private void apply(Application app, Upsert body) {
        if (body.businessServiceId() == null) {
            throw ApiException.validation("businessServiceId is required");
        }
        BusinessService bsvc = BusinessService.findById(body.businessServiceId());
        if (bsvc == null) {
            throw ApiException.notFound("BusinessService", body.businessServiceId());
        }
        if (body.teamId() == null) {
            throw ApiException.validation("teamId is required — exactly-one-team application ownership (#41)");
        }
        Team team = Team.findById(body.teamId());
        if (team == null) {
            throw ApiException.notFound("Team", body.teamId());
        }
        if (!Objects.equals(bsvc.organization.id, team.department.organization.id)) {
            throw ApiException.tenantMismatch("BusinessService");
        }
        app.businessService = bsvc;
        app.team = team;

        if (body.ownerId() != null) {
            Stakeholder owner = Stakeholder.findById(body.ownerId());
            if (owner == null) {
                throw ApiException.notFound("Stakeholder", body.ownerId());
            }
            app.owner = owner;
        }
        if (body.archetypeId() != null) {
            Archetype archetype = Archetype.findById(body.archetypeId());
            if (archetype == null) {
                throw ApiException.notFound("Archetype", body.archetypeId());
            }
            app.archetype = archetype;
        } else {
            app.archetype = null;
        }
        if (body.description() != null) {
            app.description = body.description();
        }
        if (body.repositoryUrl() != null) {
            app.repositoryUrl = body.repositoryUrl();
        }
        if (body.effort() != null) {
            app.effort = body.effort();
        }
        if (body.risk() != null) {
            app.risk = body.risk();
        }
        if (body.analysisState() != null) {
            app.analysisState = parseState(body.analysisState());
        }
        if (body.tags() != null) {
            app.tags.clear();
            for (String tagName : body.tags()) {
                Tag tag = Tag.find("name", tagName).firstResult();
                if (tag == null) {
                    throw ApiException.validation("Unknown tag '" + tagName + "'");
                }
                app.tags.add(tag);
            }
        }
        // New apps default to an org the caller can see; existing apps keep theirs.
        if (!app.isPersistent() || app.analysisState == null) {
            app.analysisState = Application.AnalysisState.NOT_STARTED;
        }
    }
}
