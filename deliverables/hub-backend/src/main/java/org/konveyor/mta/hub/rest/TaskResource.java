package org.konveyor.mta.hub.rest;

import io.quarkus.hibernate.orm.panache.PanacheQuery;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.konveyor.mta.hub.error.ApiException;
import org.konveyor.mta.hub.model.Organization;
import org.konveyor.mta.hub.model.Task;
import org.konveyor.mta.hub.security.Scopes;
import org.konveyor.mta.hub.tenancy.TenantScope;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Task queue (upstream /tasks parity): queue health (#30 — aging and
 * cause-grouped failures), structured diagnostics (#3), named quota (#38).
 * Live task state transitions ride /events.
 */
@Path("/tasks")
@Produces(MediaType.APPLICATION_JSON)
public class TaskResource {

    @Inject
    TenantScope tenant;

    public record View(UUID id, String kind, String state, String label, UUID applicationId, String application,
                       String errorCode, String errorMessage, String quota,
                       Instant startedAt, Instant completedAt, String triggeredBy, String age,
                       long version) {

        public static View of(Task t) {
            Instant end = t.completedAt != null ? t.completedAt : Instant.now();
            String age = t.startedAt == null ? null : Duration.between(t.startedAt, end).toString();
            return new View(t.id, t.kind.name(), t.state.name(), t.label,
                    t.application == null ? null : t.application.id,
                    t.application == null ? null : t.application.name,
                    t.errorCode, t.errorMessage, t.quota,
                    t.startedAt, t.completedAt, t.triggeredBy, age, t.version);
        }
    }

    @GET
    @Scopes("tasks:read")
    public Response list(@QueryParam("state") String state,
                         @QueryParam("kind") String kind,
                         @QueryParam("application") UUID applicationId,
                         @QueryParam("organization") UUID organizationId,
                         @QueryParam("page") Integer page, @QueryParam("size") Integer size) {
        Organization org = tenant.organization(organizationId);
        StringBuilder where = new StringBuilder("1=1");
        Map<String, Object> params = new LinkedHashMap<>();
        if (state != null && !state.isBlank()) {
            try {
                params.put("state", Task.State.valueOf(state.toUpperCase()));
            } catch (IllegalArgumentException e) {
                throw ApiException.validation("Unknown task state '" + state + "'");
            }
            where.append(" and state = :state");
        }
        if (kind != null && !kind.isBlank()) {
            try {
                params.put("kind", Task.Kind.valueOf(kind.toUpperCase()));
            } catch (IllegalArgumentException e) {
                throw ApiException.validation("Unknown task kind '" + kind + "'");
            }
            where.append(" and kind = :kind");
        }
        if (applicationId != null) {
            where.append(" and application.id = :app");
            params.put("app", applicationId);
        }
        PanacheQuery<Task> query = (org == null)
                ? Task.find(where + " order by createdAt desc", params)
                : Task.find("application.team.department.organization.id = :org and " + where + " order by createdAt desc",
                        withOrg(params, org.id));
        return Responses.paged(query, page, size, TaskResource.View::of);
    }

    private static Map<String, Object> withOrg(Map<String, Object> params, UUID orgId) {
        Map<String, Object> all = new LinkedHashMap<>();
        all.put("org", orgId);
        all.putAll(params);
        return all;
    }

    /** Queue health (#30): counts by state, aging, cause-grouped failures. */
    @GET
    @Path("/health")
    @Scopes("tasks:read")
    public Response health(@QueryParam("organization") UUID organizationId) {
        Organization org = tenant.organization(organizationId);
        PanacheQuery<Task> scope = (org == null)
                ? Task.findAll()
                : Task.find("application.team.department.organization.id", org.id);
        Map<String, Long> byState = new LinkedHashMap<>();
        Map<String, Long> failuresByCode = new LinkedHashMap<>();
        long oldestQueuedSeconds = 0;
        for (Task t : scope.list()) {
            byState.merge(t.state.name(), 1L, Long::sum);
            if (t.state == Task.State.FAILED && t.errorCode != null) {
                failuresByCode.merge(t.errorCode, 1L, Long::sum);
            }
            if (t.state == Task.State.QUEUED && t.startedAt == null) {
                long age = Duration.between(t.createdAt, Instant.now()).toSeconds();
                oldestQueuedSeconds = Math.max(oldestQueuedSeconds, age);
            }
        }
        Map<String, Object> health = new LinkedHashMap<>();
        health.put("byState", byState);
        health.put("failuresByErrorCode", failuresByCode);
        health.put("oldestQueuedSeconds", oldestQueuedSeconds);
        health.put("total", scope.count());
        return Response.ok(health).build();
    }

    @GET
    @Path("/{id}")
    @Scopes("tasks:read")
    public Response get(@PathParam("id") UUID id) {
        Task task = Task.findById(id);
        if (task == null) {
            throw ApiException.notFound("Task", id);
        }
        if (task.application != null) {
            tenant.assertReadable(task.application.team.department.organization, "Task");
            auditCrossTenant(task);
        }
        return Response.ok(View.of(task)).tag(Responses.etag(task)).build();
    }

    @Inject
    org.konveyor.mta.hub.audit.AuditService audit;

    private void auditCrossTenant(Task t) {
        Organization org = t.application.team.department.organization;
        audit.crossTenantRead("Task", t.id, org, null);
    }
}
