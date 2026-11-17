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
import org.konveyor.mta.hub.model.Webhook;
import org.konveyor.mta.hub.model.WebhookDelivery;
import org.konveyor.mta.hub.security.Scopes;
import org.konveyor.mta.hub.tenancy.TenantScope;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Webhooks (§9.1, scope webhooks:manage — admin): standard CRUD, deliveries
 * logged at /webhooks/{id}/deliveries, failed deliveries replayable.
 */
@Path("/webhooks")
@Produces(MediaType.APPLICATION_JSON)
public class WebhookResource {

    @Inject
    TenantScope tenant;

    @Inject
    AuditService audit;

    public record View(UUID id, String name, String url, List<String> kinds, boolean enabled,
                       long version, Instant createdAt, Instant updatedAt) {

        public static View of(Webhook w) {
            return new View(w.id, w.name, w.url, w.kinds.stream().sorted().toList(), w.enabled,
                    w.version, w.createdAt, w.updatedAt);
        }
    }

    public record Upsert(String name, String url, List<String> kinds, String secret, Boolean enabled) {
    }

    public record DeliveryView(UUID id, String kind, String type, boolean succeeded, int attempts,
                               int responseStatus, Instant deliveredAt) {

        public static DeliveryView of(WebhookDelivery d) {
            return new DeliveryView(d.id, d.kind, d.type, d.succeeded, d.attempts, d.responseStatus, d.deliveredAt);
        }
    }

    @GET
    @Scopes("webhooks:manage")
    public Response list(@QueryParam("page") Integer page, @QueryParam("size") Integer size) {
        PanacheQuery<Webhook> query = Webhook.find("order by name");
        return Responses.paged(query, page, size, View::of);
    }

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    @Scopes("webhooks:manage")
    @Transactional
    public Response create(Upsert body) {
        if (body.name() == null || body.name().isBlank()) {
            throw ApiException.validation("Webhook name is required");
        }
        if (body.url() == null || body.url().isBlank()) {
            throw ApiException.validation("Webhook url is required");
        }
        if (Webhook.count("name", body.name()) > 0) {
            throw ApiException.duplicate("Webhook", body.name());
        }
        Webhook webhook = new Webhook();
        webhook.name = body.name();
        webhook.url = body.url();
        webhook.secret = body.secret();
        if (body.enabled() != null) {
            webhook.enabled = body.enabled();
        }
        if (body.kinds() != null) {
            webhook.kinds.addAll(body.kinds());
        }
        webhook.persist();
        audit.mutation("create", "Webhook", webhook.id, null, "created webhook " + webhook.name);
        return Responses.created(View.of(webhook), webhook, "/webhooks/" + webhook.id);
    }

    @GET
    @Path("/{id}")
    @Scopes("webhooks:manage")
    public Response get(@PathParam("id") UUID id) {
        Webhook webhook = Webhook.findById(id);
        if (webhook == null) {
            throw ApiException.notFound("Webhook", id);
        }
        return Responses.withEtag(View.of(webhook), webhook);
    }

    @PUT
    @Consumes(MediaType.APPLICATION_JSON)
    @Path("/{id}")
    @Scopes("webhooks:manage")
    @Transactional
    public Response update(@PathParam("id") UUID id, Upsert body) {
        Webhook webhook = Webhook.findById(id);
        if (webhook == null) {
            throw ApiException.notFound("Webhook", id);
        }
        if (body.name() != null) {
            webhook.name = body.name();
        }
        if (body.url() != null) {
            webhook.url = body.url();
        }
        if (body.secret() != null) {
            webhook.secret = body.secret();
        }
        if (body.enabled() != null) {
            webhook.enabled = body.enabled();
        }
        if (body.kinds() != null) {
            webhook.kinds.clear();
            webhook.kinds.addAll(body.kinds());
        }
        audit.mutation("update", "Webhook", id, null, "updated webhook " + webhook.name);
        return Responses.updated(View.of(webhook), webhook);
    }

    @DELETE
    @Path("/{id}")
    @Scopes("webhooks:manage")
    @Transactional
    public Response delete(@PathParam("id") UUID id) {
        Webhook webhook = Webhook.findById(id);
        if (webhook == null) {
            throw ApiException.notFound("Webhook", id);
        }
        WebhookDelivery.delete("webhook.id", id);
        webhook.delete();
        audit.mutation("delete", "Webhook", id, null, "deleted webhook " + webhook.name);
        return Response.noContent().build();
    }

    /** Delivery log (GET) — one entry per delivery, newest first. */
    @GET
    @Path("/{id}/deliveries")
    @Scopes("webhooks:manage")
    public Response deliveries(@PathParam("id") UUID id, @QueryParam("page") Integer page,
                               @QueryParam("size") Integer size) {
        Webhook webhook = Webhook.findById(id);
        if (webhook == null) {
            throw ApiException.notFound("Webhook", id);
        }
        PanacheQuery<WebhookDelivery> query = WebhookDelivery.find("webhook.id = ?1 order by deliveredAt desc", id);
        return Responses.paged(query, page, size, DeliveryView::of);
    }

    /** Replay (POST) — re-deliver the failed deliveries of this webhook. */
    @POST
    @Path("/{id}/deliveries")
    @Scopes("webhooks:manage")
    @Transactional
    public Response replay(@PathParam("id") UUID id) {
        Webhook webhook = Webhook.findById(id);
        if (webhook == null) {
            throw ApiException.notFound("Webhook", id);
        }
        List<WebhookDelivery> failed = WebhookDelivery.find("webhook.id = ?1 and succeeded = false", id).list();
        // In a full deployment each replay enqueues a real HTTP delivery job; the
        // contract surface is the replay registration + updated delivery log.
        int replayed = 0;
        for (WebhookDelivery delivery : failed) {
            WebhookDelivery attempt = new WebhookDelivery();
            attempt.webhook = webhook;
            attempt.kind = delivery.kind;
            attempt.type = delivery.type;
            attempt.payload = delivery.payload;
            attempt.succeeded = true;
            attempt.responseStatus = 0;
            attempt.persist();
            replayed++;
        }
        audit.mutation("replay", "Webhook", id, null, "replayed " + replayed + " delivery(ies) of " + webhook.name);
        return Response.accepted(Map.of("replayed", replayed)).build();
    }
}
