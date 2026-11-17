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
import org.konveyor.mta.hub.model.JobFunction;
import org.konveyor.mta.hub.model.Stakeholder;
import org.konveyor.mta.hub.security.Scopes;
import org.konveyor.mta.hub.tenancy.TenantScope;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Job functions classify people (linked taxonomy with stakeholders: a
 * stakeholder picks one at create; this table lists its people). Deliberately
 * NOT additional personas — job functions classify people, the persona model
 * classifies console access.
 */
@Path("/job-functions")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class JobFunctionResource {

    @Inject
    TenantScope tenant;

    @Inject
    AuditService audit;

    public record View(UUID id, String name, List<String> people, long version,
                       Instant createdAt, Instant updatedAt) {

        public static View of(JobFunction jf) {
            return new View(jf.id, jf.name,
                    Stakeholder.<Stakeholder>find("jobFunction.id", jf.id).list()
                            .stream().map(s -> s.email).sorted().toList(),
                    jf.version, jf.createdAt, jf.updatedAt);
        }
    }

    public record Upsert(String name) {
    }

    @GET
    @Scopes("job-functions:read")
    public Response list(@QueryParam("page") Integer page, @QueryParam("size") Integer size) {
        PanacheQuery<JobFunction> query = JobFunction.find("order by name");
        return Responses.paged(query, page, size, View::of);
    }

    @POST
    @Scopes("job-functions:create")
    @Transactional
    public Response create(Upsert body) {
        if (body.name() == null || body.name().isBlank()) {
            throw ApiException.validation("Job function name is required");
        }
        if (JobFunction.count("name", body.name()) > 0) {
            throw ApiException.duplicate("JobFunction", body.name());
        }
        JobFunction jf = new JobFunction();
        jf.name = body.name();
        jf.persist();
        audit.mutation("create", "JobFunction", jf.id, null, "created job function " + jf.name);
        return Responses.created(View.of(jf), jf, "/job-functions/" + jf.id);
    }

    @GET
    @Path("/{id}")
    @Scopes("job-functions:read")
    public Response get(@PathParam("id") UUID id) {
        JobFunction jf = JobFunction.findById(id);
        if (jf == null) {
            throw ApiException.notFound("JobFunction", id);
        }
        return Responses.withEtag(View.of(jf), jf);
    }

    @PUT
    @Path("/{id}")
    @Scopes("job-functions:update")
    @Transactional
    public Response update(@PathParam("id") UUID id, Upsert body) {
        JobFunction jf = JobFunction.findById(id);
        if (jf == null) {
            throw ApiException.notFound("JobFunction", id);
        }
        if (body.name() != null) {
            jf.name = body.name();
        }
        audit.mutation("update", "JobFunction", id, null, "updated job function " + jf.name);
        return Responses.updated(View.of(jf), jf);
    }

    @DELETE
    @Path("/{id}")
    @Scopes("job-functions:delete")
    @Transactional
    public Response delete(@PathParam("id") UUID id) {
        JobFunction jf = JobFunction.findById(id);
        if (jf == null) {
            throw ApiException.notFound("JobFunction", id);
        }
        long refs = Stakeholder.count("jobFunction.id", id);
        if (refs > 0) {
            throw ApiException.inUse("JobFunction", id, refs + " stakeholder(s) — pick another function for them first");
        }
        jf.delete();
        audit.mutation("delete", "JobFunction", id, null, "deleted job function " + jf.name);
        return Response.noContent().build();
    }

    public static Map<String, Object> ref(JobFunction jf) {
        return Map.of("id", jf.id, "name", jf.name);
    }
}
