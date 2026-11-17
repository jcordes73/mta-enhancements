package org.konveyor.mta.hub.rest;

import io.quarkus.hibernate.orm.panache.PanacheQuery;
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
import org.konveyor.mta.hub.model.Application;
import org.konveyor.mta.hub.model.Archetype;
import org.konveyor.mta.hub.model.Tag;
import org.konveyor.mta.hub.security.Scopes;
import org.konveyor.mta.hub.tenancy.TenantScope;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Archetypes propagate rules/tags to member applications (upstream /archetypes parity). */
@Path("/archetypes")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ArchetypeResource {

    @Inject
    TenantScope tenant;

    @Inject
    AuditService audit;

    public record View(UUID id, String name, String description, List<String> tags,
                       List<String> membershipCriteria, int memberCount,
                       long version, Instant createdAt, Instant updatedAt) {

        public static View of(Archetype a) {
            return new View(a.id, a.name, a.description,
                    a.tags.stream().map(t -> t.name).sorted().toList(),
                    a.membershipCriteria.stream().map(t -> t.name).sorted().toList(),
                    (int) Application.count("archetype.id", a.id),
                    a.version, a.createdAt, a.updatedAt);
        }
    }

    public record Upsert(String name, String description, List<String> tags, List<String> membershipCriteria) {
    }

    @GET
    @Scopes("archetypes:read")
    public Response list(@QueryParam("page") Integer page, @QueryParam("size") Integer size) {
        PanacheQuery<Archetype> query = Archetype.find("order by name");
        return Responses.paged(query, page, size, View::of);
    }

    @POST
    @Scopes("archetypes:create")
    @Transactional
    public Response create(Upsert body) {
        if (body.name() == null || body.name().isBlank()) {
            throw ApiException.validation("Archetype name is required");
        }
        if (Archetype.count("name", body.name()) > 0) {
            throw ApiException.duplicate("Archetype", body.name());
        }
        Archetype archetype = new Archetype();
        archetype.name = body.name();
        archetype.description = body.description();
        applyTags(archetype, body);
        archetype.persist();
        audit.mutation("create", "Archetype", archetype.id, null, "created archetype " + archetype.name);
        return Responses.created(View.of(archetype), archetype, "/archetypes/" + archetype.id);
    }

    @GET
    @Path("/{id}")
    @Scopes("archetypes:read")
    public Response get(@PathParam("id") UUID id) {
        Archetype archetype = Archetype.findById(id);
        if (archetype == null) {
            throw ApiException.notFound("Archetype", id);
        }
        return Responses.withEtag(View.of(archetype), archetype);
    }

    @PUT
    @Path("/{id}")
    @Scopes("archetypes:update")
    @Transactional
    public Response update(@PathParam("id") UUID id, Upsert body) {
        Archetype archetype = Archetype.findById(id);
        if (archetype == null) {
            throw ApiException.notFound("Archetype", id);
        }
        if (body.name() != null) {
            archetype.name = body.name();
        }
        if (body.description() != null) {
            archetype.description = body.description();
        }
        applyTags(archetype, body);
        audit.mutation("update", "Archetype", id, null, "updated archetype " + archetype.name);
        return Responses.updated(View.of(archetype), archetype);
    }

    @DELETE
    @Path("/{id}")
    @Scopes("archetypes:delete")
    @Transactional
    public Response delete(@PathParam("id") UUID id) {
        Archetype archetype = Archetype.findById(id);
        if (archetype == null) {
            throw ApiException.notFound("Archetype", id);
        }
        long refs = Application.count("archetype.id", id);
        if (refs > 0) {
            throw ApiException.inUse("Archetype", id, refs + " application(s) — reassign their archetype first");
        }
        archetype.delete();
        audit.mutation("delete", "Archetype", id, null, "deleted archetype " + archetype.name);
        return Response.noContent().build();
    }

    private void applyTags(Archetype archetype, Upsert body) {
        if (body.tags() != null) {
            archetype.tags.clear();
            archetype.tags.addAll(TagResource.ensureTags(body.tags(), audit));
        }
        if (body.membershipCriteria() != null) {
            archetype.membershipCriteria.clear();
            for (String criteria : body.membershipCriteria()) {
                Tag tag = TagResource.ensureTags(List.of(criteria), audit).get(0);
                archetype.membershipCriteria.add(tag);
            }
        }
    }
}
