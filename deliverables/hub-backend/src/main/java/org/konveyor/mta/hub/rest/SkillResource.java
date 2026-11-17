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
import org.konveyor.mta.hub.model.Skill;
import org.konveyor.mta.hub.security.Scopes;

import java.util.Arrays;
import java.util.UUID;

/**
 * Skill cards (#49, mock's MOCK_SKILLS store).
 */
@Path("/skills")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class SkillResource {

    public record View(UUID id, String name, String display, String description, String type,
                       String source, boolean ready, String tags,
                       long version, java.time.Instant createdAt, java.time.Instant updatedAt) {
        public static View of(Skill s) {
            return new View(s.id, s.name, s.display, s.description, s.type.name(),
                    s.source, s.ready, s.tags, s.version, s.createdAt, s.updatedAt);
        }
    }

    public record Upsert(String name, String display, String description, String type,
                         String source, Boolean ready, String tags) {
    }

    @Inject
    AuditService audit;

    @GET
    @Scopes("skills:read")
    public Response list(@QueryParam("page") Integer page, @QueryParam("size") Integer size) {
        return Responses.paged(Skill.find("order by name"), page, size, View::of);
    }

    @POST
    @Scopes("skills:create")
    @Transactional
    public Response create(Upsert body) {
        if (body.name() == null || body.name().isBlank()) {
            throw ApiException.validation("Skill name is required");
        }
        if (Skill.find("name", body.name()).firstResult() != null) {
            throw ApiException.duplicate("Skill", body.name());
        }
        Skill s = new Skill();
        apply(s, body);
        s.persist();
        audit.mutation("create", "Skill", s.id, null, "created skill " + s.name);
        return Responses.created(View.of(s), s, "/skills/" + s.id);
    }

    @PUT
    @Path("/{id}")
    @Scopes("skills:update")
    @Transactional
    public Response update(@PathParam("id") UUID id, Upsert body) {
        Skill s = Skill.findById(id);
        if (s == null) {
            throw ApiException.notFound("Skill", id);
        }
        Responses.checkIfMatch(null, s);
        apply(s, body);
        audit.mutation("update", "Skill", id, null, "updated skill " + s.name);
        return Responses.updated(View.of(s), s);
    }

    @DELETE
    @Path("/{id}")
    @Scopes("skills:delete")
    @Transactional
    public Response delete(@PathParam("id") UUID id) {
        Skill s = Skill.findById(id);
        if (s == null) {
            throw ApiException.notFound("Skill", id);
        }
        audit.mutation("delete", "Skill", id, null, "deleted skill " + s.name);
        s.delete();
        return Response.noContent().build();
    }

    private void apply(Skill s, Upsert body) {
        if (body.name() != null) s.name = body.name();
        if (body.display() != null) s.display = body.display();
        if (body.description() != null) s.description = body.description();
        if (body.type() != null) s.type = Skill.Type.valueOf(body.type().toUpperCase().replace('-', '_'));
        if (body.source() != null) s.source = body.source();
        if (body.ready() != null) s.ready = body.ready();
        if (body.tags() != null) s.tags = body.tags();
    }
}
