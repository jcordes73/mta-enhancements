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
import org.konveyor.mta.hub.model.Skill;
import org.konveyor.mta.hub.security.Scopes;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

/**
 * Registered agents (mock's MOCK_AGENTS store) — A2A-style cards referencing
 * their gateway and skills.
 */
@Path("/agents")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AgentResource {

    public record View(UUID id, String name, String image, String gateway, String tierPin,
                       List<String> skills, int params, boolean ready, String age, long runCount,
                       long version, Instant createdAt, Instant updatedAt) {

        public static View of(Agent a) {
            long d = Duration.between(a.createdAt, Instant.now()).toDays();
            String age = d >= 1 ? d + "d" : Duration.between(a.createdAt, Instant.now()).toHours() + "h";
            return new View(a.id, a.name, a.image, a.gateway.name, a.tierPin,
                    a.skills.stream().map(s -> s.name).sorted().toList(),
                    a.params, a.ready, age, AgentRun.count("agent", a),
                    a.version, a.createdAt, a.updatedAt);
        }
    }

    public record Upsert(String name, String image, String gateway, List<String> skills,
                         Integer params, Boolean ready, String tierPin) {
    }

    @Inject
    AuditService audit;

    @GET
    @Scopes("agents:read")
    public Response list(@QueryParam("page") Integer page, @QueryParam("size") Integer size) {
        return Responses.paged(Agent.find("order by name"), page, size, View::of);
    }

    @GET
    @Path("/{id}")
    @Scopes("agents:read")
    public Response get(@PathParam("id") UUID id) {
        Agent a = Agent.findById(id);
        if (a == null) {
            throw ApiException.notFound("Agent", id);
        }
        return Responses.withEtag(View.of(a), a);
    }

    @POST
    @Scopes("agents:create")
    @Transactional
    public Response create(Upsert body) {
        if (body.name() == null || body.name().isBlank() || body.image() == null) {
            throw ApiException.validation("Agent name and image are required");
        }
        if (Agent.find("name", body.name()).firstResult() != null) {
            throw ApiException.duplicate("Agent", body.name());
        }
        Agent a = new Agent();
        apply(a, body);
        a.persist();
        audit.mutation("create", "Agent", a.id, null, "created agent " + a.name);
        return Responses.created(View.of(a), a, "/agents/" + a.id);
    }

    @PUT
    @Path("/{id}")
    @Scopes("agents:update")
    @Transactional
    public Response update(@PathParam("id") UUID id, Upsert body) {
        Agent a = Agent.findById(id);
        if (a == null) {
            throw ApiException.notFound("Agent", id);
        }
        Responses.checkIfMatch(null, a);
        apply(a, body);
        audit.mutation("update", "Agent", id, null, "updated agent " + a.name);
        return Responses.updated(View.of(a), a);
    }

    @DELETE
    @Path("/{id}")
    @Scopes("agents:delete")
    @Transactional
    public Response delete(@PathParam("id") UUID id) {
        Agent a = Agent.findById(id);
        if (a == null) {
            throw ApiException.notFound("Agent", id);
        }
        long runs = AgentRun.count("agent", a);
        if (runs > 0) {
            throw ApiException.inUse("Agent", a.name, runs + " run(s) reference it");
        }
        audit.mutation("delete", "Agent", id, null, "deleted agent " + a.name);
        a.delete();
        return Response.noContent().build();
    }

    private void apply(Agent a, Upsert body) {
        if (body.name() != null) a.name = body.name();
        if (body.image() != null) a.image = body.image();
        if (body.gateway() != null) {
            Gateway gw = Gateway.find("name", body.gateway().trim()).firstResult();
            if (gw == null) {
                throw ApiException.notFound("Gateway", body.gateway());
            }
            a.gateway = gw;
        }
        if (body.skills() != null) {
            List<Skill> list = new ArrayList<>();
            for (String n : body.skills()) {
                Skill s = Skill.find("name", n.trim()).firstResult();
                if (s == null) {
                    throw ApiException.notFound("Skill", n);
                }
                list.add(s);
            }
            a.skills = list;
        }
        if (body.params() != null) a.params = body.params();
        if (body.ready() != null) a.ready = body.ready();
        if (body.tierPin() != null) a.tierPin = body.tierPin();
    }
}
