package org.konveyor.mta.hub.events;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * An outbound Hub event: "analysis completed", "task failed",
 * "application updated" — CI and GitOps integrate by subscription (SSE via
 * {@code GET /events?kind=…}) instead of polling task state.
 */
public record HubEvent(String kind, String type, Instant at, UUID resourceId, Map<String, Object> payload) {

    public static HubEvent of(String kind, String type, UUID resourceId, Map<String, Object> payload) {
        return new HubEvent(kind, type, Instant.now(), resourceId, payload);
    }
}
