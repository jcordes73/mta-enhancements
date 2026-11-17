package org.konveyor.mta.hub.security;

import io.quarkus.security.identity.SecurityIdentity;
import org.eclipse.microprofile.jwt.JsonWebToken;

/**
 * Token claim access for OIDC identities. quarkus-oidc propagates only roles
 * (realm_access.roles by default) to the {@link SecurityIdentity} — arbitrary
 * claims (organization, team, mta-scopes) stay on the verified JWT principal,
 * which is an MP-JWT {@link JsonWebToken}.
 */
public final class TokenClaims {

    private TokenClaims() {
    }

    /** The token claim value, or null when absent / the principal is not a JWT. */
    public static Object get(SecurityIdentity identity, String claim) {
        return identity.getPrincipal() instanceof JsonWebToken jwt ? jwt.getClaim(claim) : null;
    }
}
