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
import org.konveyor.mta.hub.model.Tag;
import org.konveyor.mta.hub.model.TagType;
import org.konveyor.mta.hub.security.Scopes;
import org.konveyor.mta.hub.tenancy.TenantScope;

import java.time.Instant;
import java.util.UUID;

/** Tag categories (upstream parity: color/rank metadata). */
@Path("/tag-types")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class TagTypeResource {

    @Inject
    TenantScope tenant;

    @Inject
    AuditService audit;

    public record View(UUID id, String name, String color, int rank, long tagCount,
                       long version, Instant createdAt, Instant updatedAt) {

        public static View of(TagType t) {
            return new View(t.id, t.name, t.color, t.rank, Tag.count("tagType.id", t.id),
                    t.version, t.createdAt, t.updatedAt);
        }
    }

    public record Upsert(String name, String color, Integer rank) {
    }

    @GET
    @Scopes("tag-types:read")
    public Response list(@QueryParam("page") Integer page, @QueryParam("size") Integer size) {
        PanacheQuery<TagType> query = TagType.find("order by rank, name");
        return Responses.paged(query, page, size, TagTypeResource.View::of);
    }

    @POST
    @Scopes("tag-types:create")
    @Transactional
    public Response create(Upsert body) {
        if (body.name() == null || body.name().isBlank()) {
            throw ApiException.validation("TagType name is required");
        }
        if (TagType.count("name", body.name()) > 0) {
            throw ApiException.duplicate("TagType", body.name());
        }
        TagType type = new TagType();
        type.name = body.name();
        type.color = body.color();
        type.rank = body.rank() == null ? 0 : body.rank();
        type.persist();
        audit.mutation("create", "TagType", type.id, null, "created tag type " + type.name);
        return Responses.created(View.of(type), type, "/tag-types/" + type.id);
    }

    @GET
    @Path("/{id}")
    @Scopes("tag-types:read")
    public Response get(@PathParam("id") UUID id) {
        TagType type = TagType.findById(id);
        if (type == null) {
            throw ApiException.notFound("TagType", id);
        }
        return Responses.withEtag(View.of(type), type);
    }

    @PUT
    @Path("/{id}")
    @Scopes("tag-types:update")
    @Transactional
    public Response update(@PathParam("id") UUID id, Upsert body) {
        TagType type = TagType.findById(id);
        if (type == null) {
            throw ApiException.notFound("TagType", id);
        }
        if (body.name() != null) {
            type.name = body.name();
        }
        if (body.color() != null) {
            type.color = body.color();
        }
        if (body.rank() != null) {
            type.rank = body.rank();
        }
        audit.mutation("update", "TagType", id, null, "updated tag type " + type.name);
        return Responses.updated(View.of(type), type);
    }

    @DELETE
    @Path("/{id}")
    @Scopes("tag-types:delete")
    @Transactional
    public Response delete(@PathParam("id") UUID id) {
        TagType type = TagType.findById(id);
        if (type == null) {
            throw ApiException.notFound("TagType", id);
        }
        long refs = Tag.count("tagType.id", id);
        if (refs > 0) {
            throw ApiException.inUse("TagType", id, refs + " tag(s) — delete or move them first");
        }
        type.delete();
        audit.mutation("delete", "TagType", id, null, "deleted tag type " + type.name);
        return Response.noContent().build();
    }
}
