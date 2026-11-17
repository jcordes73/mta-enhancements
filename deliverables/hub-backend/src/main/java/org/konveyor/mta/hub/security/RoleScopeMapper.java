package org.konveyor.mta.hub.security;

import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.inject.Singleton;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/**
 * Resolves the caller's `resource:verb` scopes. Two sources, merged:
 * <ol>
 *   <li>a {@code scopes} claim in the token (automation/service accounts,</li>
 *   <li>realm roles mapped via {@code hub.role-mapping.<role>} config, so the
 *       Keycloak realm packages role bundles once (§9.2).</li>
 * </ol>
 */
@Singleton
public class RoleScopeMapper {

    @Inject
    @ConfigProperty(name = "hub.role-mapping")
    Map<String, String> roleMappings;

    /** Effective scopes of the given identity. */
    public Set<String> scopes(SecurityIdentity identity) {
        Set<String> result = new HashSet<>();

        // 1) explicit mta-scopes claim (space/comma-separated string or array —
        //    the realm's `scopes` user attribute, mapped to `mta-scopes` in the
        //    token via TokenClaims; claims are NOT SecurityIdentity attributes)
        Object claim = TokenClaims.get(identity, "mta-scopes");
        collect(claim, result);

        // 2) role -> scopes mapping
        for (String role : identity.getRoles()) {
            String mapped = roleMappings.get(role);
            if (mapped != null) {
                Arrays.stream(mapped.split(",")).map(String::trim).filter(s -> !s.isEmpty()).forEach(result::add);
            }
        }
        return result;
    }

    /** Adds a scopes value: a delimited string, or a collection of them, split on whitespace/commas. */
    private void collect(Object value, Set<String> into) {
        if (value instanceof String s && !s.isBlank()) {
            Arrays.stream(s.split("[\\s,]+")).filter(t -> !t.isEmpty()).forEach(into::add);
        } else if (value instanceof java.util.Collection<?> c) {
            c.forEach(o -> collect(o, into));
        }
    }
}
