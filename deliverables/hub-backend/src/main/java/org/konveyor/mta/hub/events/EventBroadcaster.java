package org.konveyor.mta.hub.events;

import io.smallrye.mutiny.Multi;
import io.smallrye.mutiny.operators.multi.processors.BroadcastProcessor;
import io.vertx.core.json.JsonObject;
import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.UUID;

/**
 * In-process event bus feeding the SSE stream on {@code /events}. In a
 * clustered deployment this becomes a Kafka/AMQP bridge — the SSE contract
 * (kind filter, payload shape) does not change (batch-events enhancement).
 */
@ApplicationScoped
public class EventBroadcaster {

    private final BroadcastProcessor<HubEvent> processor = BroadcastProcessor.create();

    public void publish(String kind, String type, UUID resourceId, java.util.Map<String, Object> payload) {
        processor.onNext(HubEvent.of(kind, type, resourceId, payload));
    }

    public Multi<HubEvent> stream() {
        return processor;
    }

    public static JsonObject toJson(HubEvent e) {
        JsonObject json = new JsonObject()
                .put("kind", e.kind())
                .put("type", e.type())
                .put("at", e.at().toString());
        if (e.resourceId() != null) {
            json.put("resourceId", e.resourceId().toString());
        }
        if (e.payload() != null) {
            json.put("payload", e.payload());
        }
        return json;
    }

    @PreDestroy
    void close() {
        processor.onComplete();
    }
}
