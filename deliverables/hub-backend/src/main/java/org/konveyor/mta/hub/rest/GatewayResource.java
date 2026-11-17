package org.konveyor.mta.hub.rest;

import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
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
import org.konveyor.mta.hub.model.Agent;
import org.konveyor.mta.hub.model.AgentRun;
import org.konveyor.mta.hub.model.Gateway;
import org.konveyor.mta.hub.security.Scopes;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * LLM gateways (#20, mock's MOCK_GATEWAYS store) — the MaaS surface: model
 * attribution, showback inputs, health. consumers is derived from the agent
 * and run stores so the Config card cannot disagree with them (#33 pattern).
 */
@Path("/gateways")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class GatewayResource {

    public record View(UUID id, String name, String model, String endpoint, String ctx, String cred,
                       boolean ready, String tier, String health, String healthAge,
                       long runs30d, String tokens30d, String rate, String consumers,
                       long version, Instant createdAt, Instant updatedAt) {

        public static View of(Gateway g) {
            long agents = Agent.count("gateway", g);
            long runs = AgentRun.count("gateway", g);
            String healthAge = null;
            if (g.healthAt != null) {
                long h = Duration.between(g.healthAt, Instant.now()).toHours();
                healthAge = h <= 0 ? "just now" : h + "h ago";
            }
            return new View(g.id, g.name, g.model, g.endpoint, g.ctx, g.cred,
                    g.ready, g.tier, g.health, healthAge,
                    g.runs30d, g.tokens30d, g.rate, agents + " agents · " + runs + " runs",
                    g.version, g.createdAt, g.updatedAt);
        }
    }

    public record Upsert(String name, String model, String endpoint, String ctx, String cred,
                         Boolean ready, String tier, String health, String tokens30d, String rate) {
    }

    @Inject
    AuditService audit;

    @GET
    @Scopes("gateways:read")
    public Response list(@QueryParam("page") Integer page, @QueryParam("size") Integer size) {
        return Responses.paged(Gateway.find("order by name"), page, size, View::of);
    }

    @GET
    @Path("/{id}")
    @Scopes("gateways:read")
    public Response get(@PathParam("id") UUID id) {
        Gateway g = Gateway.findById(id);
        if (g == null) {
            throw ApiException.notFound("Gateway", id);
        }
        return Responses.withEtag(View.of(g), g);
    }

    @POST
    @Scopes("gateways:create")
    @Transactional
    public Response create(Upsert body) {
        if (body.name() == null || body.name().isBlank() || body.model() == null || body.endpoint() == null) {
            throw ApiException.validation("Gateway name, model and endpoint are required");
        }
        if (Gateway.find("name", body.name()).firstResult() != null) {
            throw ApiException.duplicate("Gateway", body.name());
        }
        Gateway g = new Gateway();
        apply(g, body);
        g.persist();
        audit.mutation("create", "Gateway", g.id, null, "created gateway " + g.name);
        return Responses.created(View.of(g), g, "/gateways/" + g.id);
    }

    @PUT
    @Path("/{id}")
    @Scopes("gateways:update")
    @Transactional
    public Response update(@PathParam("id") UUID id, Upsert body) {
        Gateway g = Gateway.findById(id);
        if (g == null) {
            throw ApiException.notFound("Gateway", id);
        }
        Responses.checkIfMatch(null, g);
        apply(g, body);
        audit.mutation("update", "Gateway", id, null, "updated gateway " + g.name);
        return Responses.updated(View.of(g), g);
    }

    @DELETE
    @Path("/{id}")
    @Scopes("gateways:delete")
    @Transactional
    public Response delete(@PathParam("id") UUID id) {
        Gateway g = Gateway.findById(id);
        if (g == null) {
            throw ApiException.notFound("Gateway", id);
        }
        long agents = Agent.count("gateway", g);
        if (agents > 0) {
            throw ApiException.inUse("Gateway", g.name, agents + " agent(s) reference it — reassign them first");
        }
        audit.mutation("delete", "Gateway", id, null, "deleted gateway " + g.name);
        g.delete();
        return Response.noContent().build();
    }

    private void apply(Gateway g, Upsert body) {
        if (body.name() != null) g.name = body.name();
        if (body.model() != null) g.model = body.model();
        if (body.endpoint() != null) g.endpoint = body.endpoint();
        if (body.ctx() != null) g.ctx = body.ctx();
        if (body.cred() != null) g.cred = body.cred();
        if (body.ready() != null) g.ready = body.ready();
        if (body.tier() != null) g.tier = body.tier();
        if (body.health() != null) {
            g.health = body.health();
            g.healthAt = Instant.now();
        }
        if (body.tokens30d() != null) g.tokens30d = body.tokens30d();
        if (body.rate() != null) g.rate = body.rate();
    }
}
