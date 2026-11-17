package org.konveyor.mta.hub.rest;

import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.konveyor.mta.hub.error.ApiException;
import org.konveyor.mta.hub.model.AgentRun;
import org.konveyor.mta.hub.model.AgentRunEvent;
import org.konveyor.mta.hub.security.Scopes;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Agent runs (mock's MOCK_AGENT_RUNS store) — one per workflow-run stage,
 * with full attribution (gateway + model) and showback (tokens, cost), plus
 * the timestamped event log. The Reports KPIs roll up from the same rows.
 */
@Path("/agent-runs")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AgentRunResource {

    public record EventView(String offset, String message) {
        public static EventView of(AgentRunEvent e) {
            return new EventView(e.offsetText, e.message);
        }
    }

    public record View(UUID id, String name, String agent, String application, String workflowRun,
                       String phase, String state, String reason, String duration,
                       String gateway, String model, String tokens, String tokDetail, String cost,
                       Integer turns, Integer ctxCurrent, Integer ctxWindow, String ctx,
                       String image, String age, List<EventView> events,
                       long version, Instant createdAt, Instant updatedAt) {

        public static View of(AgentRun r, boolean withEvents) {
            Duration d = Duration.between(r.createdAt, Instant.now());
            String age = d.toHours() >= 24
                    ? (d.toDays() + "d")
                    : d.toHours() >= 1 ? (d.toHours() + "h") : (d.toMinutes() + "m");
            // context usage display '38,412 / 128,000 (30%)' — mock idiom; null until telemetry exists
            String ctx = (r.ctxCurrent == null || r.ctxWindow == null || r.ctxWindow == 0) ? null
                    : String.format("%,d / %,d (%d%%)", r.ctxCurrent, r.ctxWindow,
                            Math.round(r.ctxCurrent * 100.0 / r.ctxWindow));
            List<EventView> events = withEvents
                    ? AgentRunEvent.<AgentRunEvent>find("agentRun = ?1 order by id", r).list().stream()
                            .map(EventView::of).toList()
                    : null;
            return new View(r.id, r.name, r.agent.name, r.application.name, r.workflowRun.name,
                    r.phase, r.state.name(), r.reason, r.duration,
                    r.gateway.name, r.model, r.tokens, r.tokDetail, r.cost,
                    r.turns, r.ctxCurrent, r.ctxWindow, ctx, r.image, age, events,
                    r.version, r.createdAt, r.updatedAt);
        }
    }

    @GET
    @Scopes("agent-runs:read")
    public Response list(@QueryParam("workflowRun") String wrName, @QueryParam("application") String appName,
                         @QueryParam("page") Integer page, @QueryParam("size") Integer size) {
        var query = (wrName != null && !wrName.isBlank())
                ? AgentRun.find("workflowRun.name = ?1 order by id desc", wrName)
                : (appName != null && !appName.isBlank()
                        ? AgentRun.find("application.name = ?1 order by id desc", appName)
                        : AgentRun.find("order by id desc"));
        return Responses.paged(query, page, size, r -> View.of((AgentRun) r, false));
    }

    @GET
    @Path("/{id}")
    @Scopes("agent-runs:read")
    public Response get(@PathParam("id") UUID id) {
        AgentRun r = AgentRun.findById(id);
        if (r == null) {
            throw ApiException.notFound("AgentRun", id);
        }
        return Responses.withEtag(View.of(r, true), r);
    }
}
