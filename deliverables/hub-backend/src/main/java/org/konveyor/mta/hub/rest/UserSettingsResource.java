package org.konveyor.mta.hub.rest;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.konveyor.mta.hub.error.ApiException;
import org.konveyor.mta.hub.model.UserSettings;
import org.konveyor.mta.hub.tenancy.TenantScope;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Per-identity UI settings (#64, GET/PUT /user-settings): tour completion per
 * role, selected language, currency override. Keycloak-subject scoped — a
 * user can only read their own map; PUT merges; the SPA falls back to
 * localStorage only when this API is unreachable.
 */
@Path("/user-settings")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class UserSettingsResource {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Inject
    TenantScope tenant;

    @GET
    @Transactional
    public Response get() {
        String subject = tenant.actor();
        UserSettings settings = UserSettings.forSubject(subject);
        return Response.ok(parse(settings)).build();
    }

    /** Merge semantics (contract): unknown keys preserved, known keys updated. */
    @PUT
    @Transactional
    public Response put(Map<String, Object> body) {
        if (body == null) {
            throw ApiException.validation("Settings body is required");
        }
        String subject = tenant.actor();
        UserSettings settings = UserSettings.forSubject(subject);
        Map<String, Object> merged = parse(settings);
        merged.putAll(body);
        try {
            settings.settings = MAPPER.writeValueAsString(merged);
        } catch (Exception e) {
            throw new ApiException(500, "settings.serialize", "Failed to serialize settings", null);
        }
        return Response.noContent().build();
    }

    private static Map<String, Object> parse(UserSettings settings) {
        try {
            Map<String, Object> map = MAPPER.readValue(settings.settings == null ? "{}" : settings.settings,
                    new TypeReference<LinkedHashMap<String, Object>>() {
                    });
            map.put("subject", settings.subject);
            return map;
        } catch (Exception e) {
            return new LinkedHashMap<>(Map.of("subject", settings.subject));
        }
    }
}
