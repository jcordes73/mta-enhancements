package org.konveyor.mta.hub.rest;

import io.quarkus.hibernate.orm.panache.PanacheQuery;
import jakarta.ws.rs.core.Response;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

/**
 * Collection conventions (contract): {@code ?page=&size=} pagination with
 * {@code items} + {@code totalCount} metadata, plus {@code ETag} helpers
 * for the If-Match mutation protocol.
 */
public final class Responses {

    public static final int DEFAULT_SIZE = 20;
    public static final int MAX_SIZE = 200;

    private Responses() {
    }

    public static <T> Response paged(PanacheQuery<T> query, Integer page, Integer size,
                                     Function<T, ?> view) {
        int effectiveSize = clampSize(size);
        int effectivePage = page == null || page < 0 ? 0 : page;
        PanacheQuery<T> paged = query.page(effectivePage, effectiveSize);
        List<T> items = paged.list();
        long total = query.count();
        return pagedResponse(items.stream().map(view).toList(), total, effectivePage, effectiveSize);
    }

    public static Response pagedResponse(List<?> items, long total, int page, int size) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("items", items);
        body.put("totalCount", total);
        body.put("page", page);
        body.put("size", size);
        return Response.ok(body).build();
    }

    public static int clampSize(Integer size) {
        if (size == null || size < 1) {
            return DEFAULT_SIZE;
        }
        return Math.min(size, MAX_SIZE);
    }

    /** GET response carrying the entity's ETag. */
    public static Response withEtag(Object entity, org.konveyor.mta.hub.model.BaseEntity e) {
        return Response.ok(entity).tag(etag(e)).build();
    }

    /** Mutation response carrying the new ETag. */
    public static Response created(Object entity, org.konveyor.mta.hub.model.BaseEntity e, String location) {
        return Response.status(Response.Status.CREATED)
                .entity(entity)
                .tag(etag(e))
                .header("Location", location)
                .build();
    }

    public static Response updated(Object entity, org.konveyor.mta.hub.model.BaseEntity e) {
        return Response.ok(entity).tag(etag(e)).build();
    }

    public static jakarta.ws.rs.core.EntityTag etag(org.konveyor.mta.hub.model.BaseEntity e) {
        return new jakarta.ws.rs.core.EntityTag(String.valueOf(e.version));
    }

    /**
     * Honor If-Match: when present and stale, 412 (concurrent UI edits and
     * automation fail loudly instead of last-write-wins).
     */
    public static void checkIfMatch(String ifMatch, org.konveyor.mta.hub.model.BaseEntity e) {
        if (ifMatch == null || ifMatch.isBlank()) {
            return; // lenient: If-Match encouraged, not required
        }
        String normalized = ifMatch.trim();
        if (normalized.equals("*")) {
            return;
        }
        String bare = normalized.replaceAll("^\"|\"$", "");
        if (!bare.equals(String.valueOf(e.version))) {
            throw org.konveyor.mta.hub.error.ApiException.preconditionFailed(etag(e).getValue());
        }
    }
}
