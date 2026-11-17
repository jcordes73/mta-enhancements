package org.konveyor.mta.hub.rest;

import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.konveyor.mta.hub.error.ApiException;
import org.konveyor.mta.hub.model.Application;
import org.konveyor.mta.hub.model.Incident;
import org.konveyor.mta.hub.model.Organization;
import org.konveyor.mta.hub.model.Wave;
import org.konveyor.mta.hub.security.Scopes;
import org.konveyor.mta.hub.tenancy.TenantScope;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Report endpoints (§9.1): /report/effort with groupBy
 * archetype|businessService|wave|tagCategory; the deprecated legacy
 * dashboard export keeps its deprecation headers (N-1 compatibility
 * window, §9.3).
 */
@Path("/report")
@Produces(MediaType.APPLICATION_JSON)
public class ReportResource {

    @Inject
    TenantScope tenant;

    @GET
    @Path("/effort")
    @Scopes("reports:read")
    public Response effort(@QueryParam("groupBy") String groupBy,
                           @QueryParam("organization") UUID organizationId) {
        if (groupBy == null || groupBy.isBlank()) {
            throw ApiException.validation("groupBy is required: archetype|businessService|wave|tagCategory");
        }
        Organization org = tenant.organization(organizationId);
        List<Application> apps = (org == null)
                ? Application.listAll()
                : Application.find("team.department.organization.id", org.id).list();

        Map<String, Group> groups = new LinkedHashMap<>();
        for (Application app : apps) {
            List<String> keys = switch (groupBy) {
                case "archetype" -> app.archetype == null ? List.of("(no archetype)") : List.of(app.archetype.name);
                case "businessService" -> List.of(app.businessService.name);
                case "tagCategory" -> app.tags.isEmpty() ? List.of("(untagged)")
                        : app.tags.stream().map(t -> t.name).toList();
                case "wave" -> List.of(); // grouped separately below
                default -> throw ApiException.validation(
                        "Unsupported groupBy '" + groupBy + "' — expected archetype|businessService|wave|tagCategory");
            };
            for (String key : keys) {
                Group g = groups.computeIfAbsent(key, k -> new Group());
                g.applications++;
                g.effort += app.effort;
                g.riskCounts.merge(app.risk == null ? "(none)" : app.risk, 1L, Long::sum);
            }
        }
        if (groupBy.equals("wave")) {
            groups.clear();
            List<Wave> waves = (org == null)
                    ? Wave.listAll()
                    : Wave.find("organization.id", org.id).list();
            for (Wave wave : waves) {
                Group g = groups.computeIfAbsent(wave.name, k -> new Group());
                for (Application app : wave.members) {
                    g.applications++;
                    g.effort += app.effort;
                    g.riskCounts.merge(app.risk == null ? "(none)" : app.risk, 1L, Long::sum);
                }
            }
        }
        List<Map<String, Object>> items = groups.entrySet().stream()
                .map(e -> {
                    Map<String, Object> m = new LinkedHashMap<String, Object>();
                    m.put("key", e.getKey());
                    m.put("effort", e.getValue().effort);
                    m.put("applicationCount", e.getValue().applications);
                    m.put("riskCounts", e.getValue().riskCounts);
                    return m;
                })
                .toList();
        return Response.ok(Map.of("groups", items, "groupBy", groupBy)).build();
    }

    private static final class Group {
        int applications;
        int effort;
        final Map<String, Long> riskCounts = new LinkedHashMap<>();
    }

    /**
     * Legacy dashboard export — <b>deprecated since contract 2.0</b>,
     * replaced by {@code /report/effort} + the analysis surfaces. Removal in
     * contract 2.3: announced one minor ahead, N-1 compatibility window
     * honored (Deprecation + Sunset headers).
     */
    /** Portfolio trend (#1/#30 adjacent): open vs passing incident counts per sample date. */
    @GET
    @Path("/trend")
    @Scopes("reports:read")
    public Response trend() {
        record Point(String date, int open, int pass) {}
        var items = org.konveyor.mta.hub.model.TrendPoint.<org.konveyor.mta.hub.model.TrendPoint>findAll().list()
                .stream().map(tp -> new Point(tp.date.toString(), tp.open, tp.pass)).toList();
        return Response.ok(items).build();
    }

    @GET
    @Path("/dashboard")
    @Scopes("reports:read")
    public Response legacyDashboard(@QueryParam("organization") UUID organizationId) {
        Organization org = tenant.organization(organizationId);
        List<Application> apps = (org == null)
                ? Application.listAll()
                : Application.find("team.department.organization.id", org.id).list();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("applications", apps.size());
        payload.put("totalEffort", apps.stream().mapToInt(a -> a.effort).sum());
        payload.put("openIncidents", org == null
                ? Incident.count()
                : Incident.count("application.team.department.organization.id", org.id));
        payload.put("replacement", "/report/effort?groupBy=… + /analyses/*");
        return Response.ok(payload)
                .header("Deprecation", "true")
                .header("Sunset", "Wed, 01 Jul 2026 00:00:00 GMT")
                .header("Link", "</report/effort>; rel=\"successor-version\"")
                .build();
    }
}
