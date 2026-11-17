package org.konveyor.mta.hub.rest;

import io.quarkus.hibernate.orm.panache.PanacheQuery;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.konveyor.mta.hub.model.Setting;
import org.konveyor.mta.hub.security.Scopes;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * The machine-readable settings manifest (#33 item 11): key, type, default,
 * since-version, effect semantics — drives manifest-driven Administration
 * and the settings parity test.
 */
@Path("/manifests")
@Produces(MediaType.APPLICATION_JSON)
public class ManifestResource {

    public record View(String key, String type, String defaultValue, String value, String since,
                       String effect, long version, Instant updatedAt) {

        public static View of(Setting s) {
            return new View(s.key, s.type, s.defaultValue, s.value, s.since, s.effect, s.version, s.updatedAt);
        }
    }

    @GET
    @Scopes("settings:read")
    public Response list() {
        PanacheQuery<Setting> query = Setting.find("order by key");
        List<View> items = query.list().stream().map(ManifestResource.View::of).toList();
        return Response.ok(Map.of("items", items, "totalCount", items.size())).build();
    }
}
