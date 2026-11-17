package org.konveyor.mta.hub.tenancy;

import io.quarkus.security.identity.SecurityIdentity;
import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import org.konveyor.mta.hub.error.ApiException;
import org.konveyor.mta.hub.model.Organization;
import org.konveyor.mta.hub.model.Team;
import org.konveyor.mta.hub.security.RoleScopeMapper;
import org.konveyor.mta.hub.security.TokenClaims;

import java.util.Collection;
import java.util.UUID;

/**
 * Per-request tenancy context (#41): the organization (from the token's
 * {@code mta-org} / {@code mta-orgs} claims, see below) clamps every list and
 * single-resource read; team claims narrow further for team-locked roles.
 * The platform administrator operates above tenancy — every cross-tenant
 * pivot is audited by {@code AuditService}.
 *
 * Two organization claim sources, tried in order:
 * <ol>
 *   <li>{@code mta-org} — a display-name string from the realm user
 *       attribute (test users, dev without the bootstrap script)</li>
 *   <li>native {@code mta-orgs} claim — the Keycloak <em>Organizations</em>
 *       feature's membership claim (array of org aliases, built by the
 *       {@code oidc-organization-membership-mapper} client scope); aliases
 *       match the slug of the seeded organization's display name</li>
 * </ol>
 * The Keycloak-native {@code organization} claim (built-in scope, array of
 * aliases when the Organizations feature is enabled) is deliberately NOT
 * read — alias resolution goes through {@code mta-orgs} only.
 */
@RequestScoped
public class TenantScope {

    @Inject
    SecurityIdentity identity;

    @Inject
    RoleScopeMapper scopes;

    private String organizationClaim() {
        Object claim = TokenClaims.get(identity, "mta-org");
        return claim == null ? null : String.valueOf(claim);
    }

    public boolean platformAdmin() {
        return identity.hasRole("padmin");
    }

    /** Organization name of the caller, resolved from the token claims. */
    public String organizationName() {
        String legacy = organizationClaim();
        if (legacy != null) {
            return legacy;
        }
        Organization org = orgFromMembershipClaim();
        return org == null ? null : org.name;
    }

    /**
     * The caller's organization from the native Keycloak Organizations
     * membership claim ({@code mta-orgs}: array of org aliases). The realm's
     * org aliases follow the slug convention of the seeded display names
     * ("Northwind Financial" → "northwind-financial"), so membership alone
     * resolves the tenancy clamp without any user attribute.
     */
    private Organization orgFromMembershipClaim() {
        String alias = firstAlias(TokenClaims.get(identity, "mta-orgs"));
        if (alias == null) {
            return null;
        }
        for (Organization org : Organization.<Organization>listAll()) {
            if (slug(org.name).equals(alias)) {
                return org;
            }
        }
        return null;
    }

    /**
     * First alias of the mta-orgs claim. The claim arrives as a JSON-P array
     * (smallrye-jwt parses with parsson) — element toString() would keep the
     * JSON quotes ("northwind-financial"), so extract via JsonString.
     */
    private static String firstAlias(Object claim) {
        if (claim instanceof jakarta.json.JsonArray arr && !arr.isEmpty()) {
            return arr.getString(0);
        }
        if (claim instanceof Collection<?> c && !c.isEmpty()) {
            Object first = c.iterator().next();
            String s = first instanceof jakarta.json.JsonString js ? js.getString() : String.valueOf(first);
            if (s.length() >= 2 && s.startsWith("\"") && s.endsWith("\"")) {
                s = s.substring(1, s.length() - 1);  // defensive: quoted toString
            }
            return s;
        }
        return null;
    }

    /** Same slug rule as the frontend (appState/hub {@code slug()}). */
    static String slug(String s) {
        return s.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("^-+|-+$", "");
    }

    public String teamName() {
        Object claim = TokenClaims.get(identity, "team");
        return claim == null ? null : String.valueOf(claim);
    }

    /** Subject for audit attribution. */
    public String actor() {
        return identity.getPrincipal() == null ? "anonymous" : identity.getPrincipal().getName();
    }

    /**
     * The organization the request is clamped to; platform admins may pass
     * an explicit organization query param (audited cross-tenant pivot).
     * Returns null when no clamp applies (platform admin, no org requested).
     */
    public Organization organization(UUID requestedOrganizationId) {
        if (platformAdmin()) {
            if (requestedOrganizationId != null) {
                Organization org = Organization.findById(requestedOrganizationId);
                if (org == null) {
                    throw ApiException.notFound("Organization", requestedOrganizationId);
                }
                return org;
            }
            return null;
        }
        String name = organizationName();
        if (name == null) {
            // Unscoped caller: allow an explicit org as long as it is named.
            if (requestedOrganizationId != null) {
                Organization org = Organization.findById(requestedOrganizationId);
                if (org == null) {
                    throw ApiException.notFound("Organization", requestedOrganizationId);
                }
                return org;
            }
            throw new ApiException(400, "tenant.required",
                    "No organization in token — pass ?organization=<id> or authenticate with a tenant-scoped identity", null);
        }
        Organization org = Organization.findByName(name);
        if (org == null) {
            throw new ApiException(400, "tenant.unknown",
                    "Organization '" + name + "' does not exist", null);
        }
        return org;
    }

    /** Team clamp for team-locked callers (migrator/pm); null = no clamp. */
    public Team team(UUID requestedTeamId) {
        if (platformAdmin()) {
            return requestedTeamId == null ? null : Team.findById(requestedTeamId);
        }
        String name = teamName();
        if (name == null) {
            return null;
        }
        Organization org = organization(null);
        if (org == null) {
            return null;
        }
        return Team.find("name = ?1 and department.organization.id = ?2", name, org.id).firstResult();
    }

    /**
     * Single-resource read guard: non-platform-admins may only read inside
     * their own organization (403 tenant.mismatch otherwise). Platform admins
     * pass; the caller additionally audits cross-tenant reads.
     */
    public void assertReadable(Organization resourceOrg, String resourceLabel) {
        if (resourceOrg == null || platformAdmin()) {
            return;
        }
        Organization mine = organization(null);
        if (mine == null || !mine.id.equals(resourceOrg.id)) {
            throw ApiException.tenantMismatch(resourceLabel);
        }
    }
}
