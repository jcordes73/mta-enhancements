package org.konveyor.mta.hub.rest;

import io.smallrye.mutiny.Multi;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.sse.OutboundSseEvent;
import jakarta.ws.rs.sse.Sse;
import org.konveyor.mta.hub.events.EventBroadcaster;
import org.konveyor.mta.hub.events.HubEvent;
import org.konveyor.mta.hub.security.Scopes;

/**
 * Outbound event stream (Batch & events): subscribe with a kind filter
 * (analysis | task | application | assessment) instead of polling task
 * state. Server-Sent Events; webhook registration is the push alternative.
 */
@Path("/events")
public class EventResource {

    @Inject
    EventBroadcaster broadcaster;

    @Inject
    Sse sse;

    @GET
    @Produces(MediaType.SERVER_SENT_EVENTS)
    @Scopes("tasks:read")
    public Multi<OutboundSseEvent> stream(@QueryParam("kind") String kind) {
        return broadcaster.stream()
                .filter(e -> kind == null || kind.isBlank() || e.kind().equalsIgnoreCase(kind.trim()))
                .map(this::toEvent);
    }

    private OutboundSseEvent toEvent(HubEvent e) {
        return sse.newEventBuilder()
                .name(e.type())
                .mediaType(MediaType.APPLICATION_JSON_TYPE)
                .data(EventBroadcaster.toJson(e))
                .build();
    }
}
