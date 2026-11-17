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
import org.konveyor.mta.hub.model.Application;
import org.konveyor.mta.hub.model.Identity;
import org.konveyor.mta.hub.model.Organization;
import org.konveyor.mta.hub.model.Team;
import org.konveyor.mta.hub.security.Scopes;
import org.konveyor.mta.hub.tenancy.TenantScope;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Credentials (#15) — team-owned resources. The secret is write-only
 * (never serialized back); credential health comes from the verification
 * action, last-used feeds the audit posture (#42), used-by is derived from
 * assignments.
 */
@Path("/identities")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class IdentityResource {

    @Inject
    TenantScope tenant;

    @Inject
    AuditService audit;

    public record View(UUID id, String name, String kind, String user, boolean hasSecret,
                       String organization, String team, UUID teamId, Instant lastUsed,
                       java.time.LocalDate expiresOn, boolean verified, String description,
                       long usedBy,
                       long version, Instant createdAt, Instant updatedAt) {

        public static View of(Identity i) {
            return new View(i.id, i.name, i.kind.name(), i.user,
                    i.password != null || i.key != null,
                    i.organization.name,
                    i.team == null ? null : i.team.name, i.team == null ? null : i.team.id,
                    i.lastUsed,
                    i.expiresOn, i.verified, i.description,
                    Application.count("credential", i),
                    i.version, i.createdAt, i.updatedAt);
        }
    }

    public record Upsert(String name, String kind, String user, String password, String key,
                         UUID teamId) {
    }

    @GET
    @Scopes("identities:read")
    public Response list(@QueryParam("organization") UUID organizationId, @QueryParam("team") UUID teamId,
                         @QueryParam("page") Integer page, @QueryParam("size") Integer size) {
        Organization org = tenant.organization(organizationId);
        PanacheQuery<Identity> query = (org == null)
                ? Identity.findAll()
                : Identity.find("organization.id", org.id);
        if (teamId != null) {
            query = (org == null)
                    ? Identity.find("team.id", teamId)
                    : Identity.find("organization.id = ?1 and team.id = ?2", org.id, teamId);
        }
        return Responses.paged(query, page, size, View::of);
    }

    @POST
    @Scopes("identities:create")
    @Transactional
    public Response create(Upsert body) {
        if (body.name() == null || body.name().isBlank()) {
            throw ApiException.validation("Credential name is required");
        }
        Identity.Kind kind = parseKind(body.kind());
        Organization org = tenant.organization(null);
        if (org == null) {
            throw new ApiException(400, "tenant.required", "organization resolution failed", null);
        }
        Identity identity = new Identity();
        identity.name = body.name();
        identity.kind = kind;
        identity.user = body.user();
        identity.password = body.password();
        identity.key = body.key();
        identity.organization = org;
        if (body.teamId() != null) {
            Team team = Team.findById(body.teamId());
            if (team == null) {
                throw ApiException.notFound("Team", body.teamId());
            }
            if (!team.department.organization.id.equals(org.id)) {
                throw ApiException.tenantMismatch("Team");
            }
            identity.team = team;
        }
        identity.persist();
        audit.mutation("create", "Identity", identity.id, org, "created credential " + identity.name);
        return Responses.created(View.of(identity), identity, "/identities/" + identity.id);
    }

    private static Identity.Kind parseKind(String kind) {
        if (kind == null || kind.isBlank()) {
            throw ApiException.validation("Credential kind is required");
        }
        try {
            return Identity.Kind.valueOf(kind.toUpperCase().replace('-', '_'));
        } catch (IllegalArgumentException e) {
            throw ApiException.validation("Unknown credential kind '" + kind + "'");
        }
    }

    @GET
    @Path("/{id}")
    @Scopes("identities:read")
    public Response get(@PathParam("id") UUID id) {
        Identity identity = Identity.findById(id);
        if (identity == null) {
            throw ApiException.notFound("Identity", id);
        }
        tenant.assertReadable(identity.organization, "Identity");
        audit.crossTenantRead("Identity", id, identity.organization, null);
        return Responses.withEtag(View.of(identity), identity);
    }

    @PUT
    @Path("/{id}")
    @Scopes("identities:update")
    @Transactional
    public Response update(@PathParam("id") UUID id, Upsert body) {
        Identity identity = Identity.findById(id);
        if (identity == null) {
            throw ApiException.notFound("Identity", id);
        }
        tenant.assertReadable(identity.organization, "Identity");
        if (body.name() != null) {
            identity.name = body.name();
        }
        if (body.user() != null) {
            identity.user = body.user();
        }
        if (body.password() != null) {
            identity.password = body.password();
        }
        if (body.key() != null) {
            identity.key = body.key();
        }
        if (body.teamId() != null) {
            Team team = Team.findById(body.teamId());
            if (team == null) {
                throw ApiException.notFound("Team", body.teamId());
            }
            if (!team.department.organization.id.equals(identity.organization.id)) {
                throw ApiException.tenantMismatch("Team");
            }
            identity.team = team;
        }
        audit.mutation("update", "Identity", id, identity.organization, "updated credential " + identity.name);
        return Responses.updated(View.of(identity), identity);
    }

    @DELETE
    @Path("/{id}")
    @Scopes("identities:delete")
    @Transactional
    public Response delete(@PathParam("id") UUID id) {
        Identity identity = Identity.findById(id);
        if (identity == null) {
            throw ApiException.notFound("Identity", id);
        }
        tenant.assertReadable(identity.organization, "Identity");
        identity.delete();
        audit.mutation("delete", "Identity", id, identity.organization, "deleted credential " + identity.name);
        return Response.noContent().build();
    }

    public static Map<String, Object> ref(Identity i) {
        return Map.of("id", i.id, "name", i.name, "kind", i.kind.name());
    }
}
