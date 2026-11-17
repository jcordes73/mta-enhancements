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
import org.konveyor.mta.hub.model.Organization;
import org.konveyor.mta.hub.model.Stakeholder;
import org.konveyor.mta.hub.model.StakeholderGroup;
import org.konveyor.mta.hub.security.Scopes;
import org.konveyor.mta.hub.tenancy.TenantScope;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Stakeholder groups own their members (real membership: Add/Edit with a
 * member check-list; group renames re-render member rows — the Groups column
 * derives from membership).
 */
@Path("/stakeholder-groups")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class StakeholderGroupResource {

    @Inject
    TenantScope tenant;

    @Inject
    AuditService audit;

    public record View(UUID id, String name, String description, String organization,
                       List<String> members, int memberCount, long version,
                       Instant createdAt, Instant updatedAt) {

        public static View of(StakeholderGroup g) {
            return new View(g.id, g.name, g.description, g.organization.name,
                    g.members.stream().map(s -> s.email).sorted().toList(),
                    g.members.size(), g.version, g.createdAt, g.updatedAt);
        }
    }

    public record Upsert(String name, String description, UUID organizationId, List<UUID> memberIds) {
    }

    @GET
    @Scopes("stakeholder-groups:read")
    public Response list(@QueryParam("organization") UUID organizationId, @QueryParam("page") Integer page,
                         @QueryParam("size") Integer size) {
        Organization org = tenant.organization(organizationId);
        PanacheQuery<StakeholderGroup> query = (org == null)
                ? StakeholderGroup.findAll()
                : StakeholderGroup.inOrganization(org.id);
        return Responses.paged(query, page, size, View::of);
    }

    @POST
    @Scopes("stakeholder-groups:create")
    @Transactional
    public Response create(Upsert body) {
        if (body.name() == null || body.name().isBlank()) {
            throw ApiException.validation("Stakeholder group name is required");
        }
        Organization org = body.organizationId() == null
                ? tenant.organization(null)
                : (Organization.findById(body.organizationId()) != null
                        ? (Organization) Organization.findById(body.organizationId())
                        : null);
        if (org == null) {
            throw ApiException.notFound("Organization", body.organizationId());
        }
        StakeholderGroup group = new StakeholderGroup();
        group.name = body.name();
        group.description = body.description();
        group.organization = org;
        group.persist();
        applyMembers(group, body.memberIds());
        audit.mutation("create", "StakeholderGroup", group.id, org, "created group " + group.name);
        return Responses.created(View.of(group), group, "/stakeholder-groups/" + group.id);
    }

    @GET
    @Path("/{id}")
    @Scopes("stakeholder-groups:read")
    public Response get(@PathParam("id") UUID id) {
        StakeholderGroup group = StakeholderGroup.findById(id);
        if (group == null) {
            throw ApiException.notFound("StakeholderGroup", id);
        }
        tenant.assertReadable(group.organization, "StakeholderGroup");
        audit.crossTenantRead("StakeholderGroup", id, group.organization, null);
        return Responses.withEtag(View.of(group), group);
    }

    @PUT
    @Path("/{id}")
    @Scopes("stakeholder-groups:update")
    @Transactional
    public Response update(@PathParam("id") UUID id, Upsert body) {
        StakeholderGroup group = StakeholderGroup.findById(id);
        if (group == null) {
            throw ApiException.notFound("StakeholderGroup", id);
        }
        tenant.assertReadable(group.organization, "StakeholderGroup");
        if (body.name() != null) {
            group.name = body.name();
        }
        if (body.description() != null) {
            group.description = body.description();
        }
        if (body.memberIds() != null) {
            applyMembers(group, body.memberIds());
        }
        audit.mutation("update", "StakeholderGroup", id, group.organization, "updated group " + group.name);
        return Responses.updated(View.of(group), group);
    }

    @DELETE
    @Path("/{id}")
    @Scopes("stakeholder-groups:delete")
    @Transactional
    public Response delete(@PathParam("id") UUID id) {
        StakeholderGroup group = StakeholderGroup.findById(id);
        if (group == null) {
            throw ApiException.notFound("StakeholderGroup", id);
        }
        tenant.assertReadable(group.organization, "StakeholderGroup");
        group.members.clear();
        group.delete();
        audit.mutation("delete", "StakeholderGroup", id, group.organization, "deleted group " + group.name);
        return Response.noContent().build();
    }

    private void applyMembers(StakeholderGroup group, List<UUID> memberIds) {
        if (memberIds == null) {
            return;
        }
        group.members.clear();
        for (UUID memberId : memberIds) {
            Stakeholder s = Stakeholder.findById(memberId);
            if (s == null) {
                throw ApiException.notFound("Stakeholder", memberId);
            }
            if (!s.organization.id.equals(group.organization.id)) {
                throw ApiException.tenantMismatch("Stakeholder '" + s.email + "'");
            }
            group.members.add(s);
        }
    }
}
