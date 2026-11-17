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
import org.konveyor.mta.hub.model.BusinessService;
import org.konveyor.mta.hub.model.Organization;
import org.konveyor.mta.hub.model.Stakeholder;
import org.konveyor.mta.hub.security.Scopes;
import org.konveyor.mta.hub.tenancy.TenantScope;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Business services at live-API parity: always an owner AND a description
 * (both required — the admission gate 'business service X has no owner' can
 * only fire on legacy rows).
 */
@Path("/business-services")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class BusinessServiceResource {

    @Inject
    TenantScope tenant;

    @Inject
    AuditService audit;

    public record View(UUID id, String name, String description, String owner, UUID ownerId,
                       String organization, UUID organizationId, long applicationCount,
                       long version, Instant createdAt, Instant updatedAt) {

        public static View of(BusinessService b) {
            return new View(b.id, b.name, b.description, b.owner.name, b.owner.id,
                    b.organization.name, b.organization.id,
                    Application.count("businessService.id", b.id),
                    b.version, b.createdAt, b.updatedAt);
        }
    }

    public record Upsert(String name, String description, UUID ownerId) {
    }

    @GET
    @Scopes("business-services:read")
    public Response list(@QueryParam("organization") UUID organizationId, @QueryParam("page") Integer page,
                         @QueryParam("size") Integer size) {
        Organization org = tenant.organization(organizationId);
        PanacheQuery<BusinessService> query = (org == null)
                ? BusinessService.findAll()
                : BusinessService.find("organization.id", org.id);
        return Responses.paged(query, page, size, View::of);
    }

    @POST
    @Scopes("business-services:create")
    @Transactional
    public Response create(Upsert body) {
        if (body.name() == null || body.name().isBlank()) {
            throw ApiException.validation("Business service name is required");
        }
        if (body.description() == null || body.description().isBlank()) {
            throw ApiException.validation("Business service description is required");
        }
        Organization org = tenant.organization(null);
        if (org == null) {
            throw new ApiException(400, "tenant.required", "organization resolution failed — authenticate with a tenant-scoped identity", null);
        }
        Stakeholder owner = requireOwner(body.ownerId());
        BusinessService bsvc = new BusinessService();
        bsvc.name = body.name();
        bsvc.description = body.description();
        bsvc.owner = owner;
        bsvc.organization = org;
        bsvc.persist();
        audit.mutation("create", "BusinessService", bsvc.id, org, "created business service " + bsvc.name);
        return Responses.created(View.of(bsvc), bsvc, "/business-services/" + bsvc.id);
    }

    private Stakeholder requireOwner(UUID ownerId) {
        if (ownerId == null) {
            throw ApiException.validation("Business services require an owner — every application has an accountable owner (user requirement)");
        }
        Stakeholder owner = Stakeholder.findById(ownerId);
        if (owner == null) {
            throw ApiException.notFound("Stakeholder", ownerId);
        }
        return owner;
    }

    @GET
    @Path("/{id}")
    @Scopes("business-services:read")
    public Response get(@PathParam("id") UUID id) {
        BusinessService bsvc = BusinessService.findById(id);
        if (bsvc == null) {
            throw ApiException.notFound("BusinessService", id);
        }
        tenant.assertReadable(bsvc.organization, "BusinessService");
        audit.crossTenantRead("BusinessService", id, bsvc.organization, null);
        return Responses.withEtag(View.of(bsvc), bsvc);
    }

    @PUT
    @Path("/{id}")
    @Scopes("business-services:update")
    @Transactional
    public Response update(@PathParam("id") UUID id, Upsert body) {
        BusinessService bsvc = BusinessService.findById(id);
        if (bsvc == null) {
            throw ApiException.notFound("BusinessService", id);
        }
        tenant.assertReadable(bsvc.organization, "BusinessService");
        if (body.name() != null) {
            bsvc.name = body.name();
        }
        if (body.description() != null) {
            bsvc.description = body.description();
        }
        if (body.ownerId() != null) {
            bsvc.owner = requireOwner(body.ownerId());
        }
        audit.mutation("update", "BusinessService", id, bsvc.organization, "updated business service " + bsvc.name);
        return Responses.updated(View.of(bsvc), bsvc);
    }

    @DELETE
    @Path("/{id}")
    @Scopes("business-services:delete")
    @Transactional
    public Response delete(@PathParam("id") UUID id) {
        BusinessService bsvc = BusinessService.findById(id);
        if (bsvc == null) {
            throw ApiException.notFound("BusinessService", id);
        }
        tenant.assertReadable(bsvc.organization, "BusinessService");
        long refs = Application.count("businessService.id", id);
        if (refs > 0) {
            throw ApiException.inUse("BusinessService", id, refs + " application(s) — reassign them first");
        }
        bsvc.delete();
        audit.mutation("delete", "BusinessService", id, bsvc.organization, "deleted business service " + bsvc.name);
        return Response.noContent().build();
    }

    public static Map<String, Object> ref(BusinessService b) {
        return Map.of("id", b.id, "name", b.name);
    }
}
