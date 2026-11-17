package org.konveyor.mta.hub.rest;

import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.konveyor.mta.hub.audit.AuditService;
import org.konveyor.mta.hub.error.ApiException;
import org.konveyor.mta.hub.events.EventBroadcaster;
import org.konveyor.mta.hub.model.Incident;
import org.konveyor.mta.hub.model.Organization;
import org.konveyor.mta.hub.security.Scopes;
import org.konveyor.mta.hub.tenancy.TenantScope;

import java.time.Instant;
import java.util.Map;

/**
 * Writable triage (#33 item 1) — {@code PUT /incidents/{incidentKey}/triage}
 * is the §9.1 anchor endpoint: decisions made here sync to the IDE and
 * tooling (triage.changed webhook, solved-example weighting, re-analysis
 * carry-over per §8.1).
 */
@Path("/incidents")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class TriageResource {

    @Inject
    TenantScope tenant;

    @Inject
    AuditService audit;

    @Inject
    EventBroadcaster events;

    public record TriageInput(String state, String comment) {
    }

    @PUT
    @Path("/{incidentKey: .+}/triage")
    @Scopes("triage:write")
    @Transactional
    public Response triage(@PathParam("incidentKey") String incidentKey, TriageInput body) {
        if (body.state() == null || body.state().isBlank()) {
            throw ApiException.validation("Triage state is required (triage|assigned|in-progress|resolved|false-positive)");
        }
        Incident.TriageState newState = AnalysisResource.parseTriageState(body.state());
        Incident incident = Incident.findByKey(incidentKey);
        if (incident == null) {
            throw ApiException.notFound("Incident", incidentKey);
        }
        Organization org = incident.application.team.department.organization;
        tenant.assertReadable(org, "Incident");
        audit.crossTenantRead("Incident", incidentKey, org, "triage");

        String before = incident.state.name();
        incident.state = newState;
        incident.triageComment = body.comment();
        incident.triageActor = tenant.actor();
        incident.triagedAt = Instant.now();
        audit.mutation("triage", "Incident", incidentKey, org,
                "triage " + before + " → " + newState.name() + " on " + incident.application.name);
        events.publish("analysis", "triage.changed", incident.id, Map.of(
                "incidentKey", incidentKey,
                "application", incident.application.name,
                "state", newState.name(),
                "before", before));
        return Response.ok(AnalysisResource.IncidentView.of(incident)).tag(Responses.etag(incident)).build();
    }
}
