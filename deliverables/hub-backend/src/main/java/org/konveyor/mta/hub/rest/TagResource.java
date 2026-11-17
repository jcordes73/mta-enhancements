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
import org.konveyor.mta.hub.model.Tag;
import org.konveyor.mta.hub.model.TagType;
import org.konveyor.mta.hub.security.Scopes;
import org.konveyor.mta.hub.tenancy.TenantScope;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Tags. Reverse relations are first-class: "which applications carry this
 * tag" via {@code /tags/{id}/applications} (contract v2.1).
 */
@Path("/tags")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class TagResource {

    @Inject
    TenantScope tenant;

    @Inject
    AuditService audit;

    public record View(UUID id, String name, String tagType, UUID tagTypeId, String color, long version,
                       Instant createdAt, Instant updatedAt) {

        public static View of(Tag t) {
            return new View(t.id, t.name, t.tagType.name, t.tagType.id, t.tagType.color, t.version,
                    t.createdAt, t.updatedAt);
        }
    }

    public record Upsert(String name, UUID tagTypeId) {
    }

    @GET
    @Scopes("tags:read")
    public Response list(@QueryParam("name") String name, @QueryParam("page") Integer page,
                         @QueryParam("size") Integer size) {
        PanacheQuery<Tag> query = Tag.search(name);
        return Responses.paged(query, page, size, TagResource.View::of);
    }

    @POST
    @Scopes("tags:create")
    @Transactional
    public Response create(Upsert body) {
        if (body.name() == null || body.name().isBlank()) {
            throw ApiException.validation("Tag name is required");
        }
        if (Tag.count("name", body.name()) > 0) {
            throw ApiException.duplicate("Tag", body.name());
        }
        Tag tag = new Tag();
        tag.name = body.name();
        tag.tagType = body.tagTypeId() == null ? defaultType() : findType(body.tagTypeId());
        tag.persist();
        audit.mutation("create", "Tag", tag.id, null, "created tag " + tag.name);
        return Responses.created(View.of(tag), tag, "/tags/" + tag.id);
    }

    private TagType findType(UUID id) {
        TagType type = TagType.findById(id);
        if (type == null) {
            throw ApiException.notFound("TagType", id);
        }
        return type;
    }

    private TagType defaultType() {
        TagType type = TagType.find("name", "General").firstResult();
        if (type == null) {
            type = new TagType();
            type.name = "General";
            type.color = "#876fd4";
            type.rank = 99;
            type.persist();
        }
        return type;
    }

    @GET
    @Path("/{id}")
    @Scopes("tags:read")
    public Response get(@PathParam("id") UUID id) {
        Tag tag = Tag.findById(id);
        if (tag == null) {
            throw ApiException.notFound("Tag", id);
        }
        return Responses.withEtag(View.of(tag), tag);
    }

    /** Reverse relation (contract v2.1): applications carrying this tag. */
    @GET
    @Path("/{id}/applications")
    @Scopes("applications:read")
    public Response applications(@PathParam("id") UUID id, @QueryParam("page") Integer page,
                                 @QueryParam("size") Integer size) {
        Tag tag = Tag.findById(id);
        if (tag == null) {
            throw ApiException.notFound("Tag", id);
        }
        return Responses.paged(Application.find("select a from Application a join a.tags t where t.id = ?1 order by a.name", id),
                page, size, ApplicationResource.View::of);
    }

    @PUT
    @Path("/{id}")
    @Scopes("tags:update")
    @Transactional
    public Response update(@PathParam("id") UUID id, Upsert body) {
        Tag tag = Tag.findById(id);
        if (tag == null) {
            throw ApiException.notFound("Tag", id);
        }
        if (body.name() != null) {
            tag.name = body.name();
        }
        if (body.tagTypeId() != null) {
            tag.tagType = findType(body.tagTypeId());
        }
        audit.mutation("update", "Tag", id, null, "updated tag " + tag.name);
        return Responses.updated(View.of(tag), tag);
    }

    @DELETE
    @Path("/{id}")
    @Scopes("tags:delete")
    @Transactional
    public Response delete(@PathParam("id") UUID id) {
        Tag tag = Tag.findById(id);
        if (tag == null) {
            throw ApiException.notFound("Tag", id);
        }
        long refs = Application.count("tags.id", id);
        if (refs > 0) {
            throw ApiException.inUse("Tag", id, refs + " application(s) — remove the tag there first");
        }
        tag.delete();
        audit.mutation("delete", "Tag", id, null, "deleted tag " + tag.name);
        return Response.noContent().build();
    }

    public static List<Tag> ensureTags(List<String> names, AuditService audit) {
        return names.stream().map(n -> {
            Tag tag = Tag.find("name", n).firstResult();
            if (tag == null) {
                TagType type = TagType.find("name", "General").firstResult();
                if (type == null) {
                    type = new TagType();
                    type.name = "General";
                    type.rank = 99;
                    type.persist();
                }
                tag = new Tag();
                tag.name = n;
                tag.tagType = type;
                tag.persist();
                audit.mutation("create", "Tag", tag.id, null, "created tag " + n + " (batch)");
            }
            return tag;
        }).toList();
    }

    public static Map<String, Object> eventRef(String action, String name) {
        return Map.of("action", action, "name", name);
    }
}
