package org.konveyor.mta.hub.rest;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.emptyOrNullString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;

/**
 * Contract v2.1 conformance for the analysis, batch, settings, report and
 * audit surfaces. Fresh seeded DB per JVM (drop-and-create).
 */
@QuarkusTest
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class AnalysisAndPlatformTest {

    static final String ORG = "Northwind Financial";
    static final String ARCHITECT = "applications:read,applications:create,applications:update,analyses:read,analyses:create,tasks:read,incidents:read,triage:read,triage:write,waves:read,teams:read,organizations:read,tags:read,business-services:read,reports:read,analysis-profiles:read";
    static final String MIGRATOR = "applications:read,incidents:read,triage:read,triage:write";
    static final String PM = "applications:read,incidents:read,triage:read";
    static final String ADMIN = "webhooks:manage,settings:read,audit:read,reports:read,tasks:read,incidents:read,triage:write,applications:read,organizations:read,analyses:read";

    @Test
    @Order(1)
    void incidentsListScopedAndFiltered() {
        given().auth().oauth2(Tokens.of("arch"))
                .when().get("/analyses/incidents")
                .then().statusCode(200)
                .body("totalCount", greaterThan(2));
        given().auth().oauth2(Tokens.of("arch"))
                .when().get("/analyses/incidents?state=triage")
                .then().statusCode(200)
                .body("totalCount", greaterThan(0))
                .body("items[0].state", equalTo("TRIAGE"));
        // meridian-health sees none of northwind's incidents
        given().auth().oauth2(Tokens.of("chen"))
                .when().get("/analyses/incidents")
                .then().statusCode(200)
                .body("totalCount", equalTo(0));
    }

    @Test
    @Order(2)
    void triageWriteRequiresScope() throws Exception {
        String key = given().auth().oauth2(Tokens.of("arch"))
                .when().get("/analyses/incidents?state=triage")
                .then().statusCode(200)
                .extract().jsonPath().getString("items[0].incidentKey");
        // The key embeds file paths (slashes) — the regex path param
        // `/{incidentKey: .+}/triage` captures them; clients send it raw.
        // pm has no triage:write
        given().auth().oauth2(Tokens.of("pm"))
                .contentType("application/json")
                .body("{\"state\":\"false-positive\",\"comment\":\"not our path\"}")
                .when().put("/incidents/" + key + "/triage")
                .then().statusCode(403)
                .body("code", equalTo("scope.denied"));
        // migrator triages — §9.2: migrator/architect/admin
        given().auth().oauth2(Tokens.of("mig"))
                .contentType("application/json")
                .body("{\"state\":\"false-positive\",\"comment\":\"not our path\"}")
                .when().put("/incidents/" + key + "/triage")
                .then().statusCode(200)
                .body("state", equalTo("FALSE_POSITIVE"))
                .body("triageActor", equalTo("mig"))
                .header("ETag", notNullValue());
        // state enum validated
        given().auth().oauth2(Tokens.of("mig"))
                .contentType("application/json")
                .body("{\"state\":\"bogus\"}")
                .when().put("/incidents/" + key + "/triage")
                .then().statusCode(400)
                .body("code", equalTo("validation.failed"));
    }

    @Test
    @Order(3)
    void analysisDiffEndpoint() {
        String appId = given().auth().oauth2(Tokens.of("arch"))
                .when().get("/applications?name=payments-api")
                .then().statusCode(200)
                .extract().jsonPath().getString("items[0].id");
        String analysisId = given().auth().oauth2(Tokens.of("arch"))
                .when().get("/analyses?application=" + appId)
                .then().statusCode(200)
                .extract().jsonPath().getString("items[0].id");
        // same analysis on both sides: no diff
        given().auth().oauth2(Tokens.of("arch"))
                .when().get("/applications/" + appId + "/analysis/diff?from=" + analysisId + "&to=" + analysisId)
                .then().statusCode(200)
                .body("added.size()", equalTo(0))
                .body("resolved.size()", equalTo(0))
                .body("effortDelta", equalTo(0));
        // missing parameter → validation.failed
        given().auth().oauth2(Tokens.of("arch"))
                .when().get("/applications/" + appId + "/analysis/diff")
                .then().statusCode(400)
                .body("code", equalTo("validation.failed"));
    }

    @Test
    @Order(4)
    void batchTagsAccepted202() {
        String appId = given().auth().oauth2(Tokens.of("arch"))
                .when().get("/applications?name=billing-worker")
                .then().statusCode(200)
                .extract().jsonPath().getString("items[0].id");
        given().auth().oauth2(Tokens.of("arch"))
                .contentType("application/json")
                .body("{\"applications\":[\"" + appId + "\"],\"tags\":[\"ui-e2e\"]}")
                .when().post("/batch/tags")
                .then().statusCode(202)
                .body("applicationCount", equalTo(1))
                .body("taskId", notNullValue());
        // the reverse relation now carries the app
        String tagId = given().auth().oauth2(Tokens.of("arch"))
                .when().get("/tags?name=ui-e2e")
                .then().statusCode(200)
                .extract().jsonPath().getString("items[0].id");
        given().auth().oauth2(Tokens.of("arch"))
                .when().get("/tags/" + tagId + "/applications")
                .then().statusCode(200)
                .body("totalCount", equalTo(1))
                .body("items[0].name", equalTo("billing-worker"));
    }

    @Test
    @Order(5)
    void batchAnalysesQueuesTasks() {
        String appId = given().auth().oauth2(Tokens.of("arch"))
                .when().get("/applications?name=billing-worker")
                .then().statusCode(200)
                .extract().jsonPath().getString("items[0].id");
        given().auth().oauth2(Tokens.of("arch"))
                .contentType("application/json")
                .body("{\"applicationIds\":[\"" + appId + "\"]}")
                .when().post("/batch/analyses")
                .then().statusCode(202)
                .body("tasks.size()", equalTo(1))
                .body("taskgroupId", notNullValue());
        given().auth().oauth2(Tokens.of("arch"))
                .when().get("/tasks?state=QUEUED")
                .then().statusCode(200)
                .body("totalCount", greaterThan(0));
        // queue health (#30): state counts + cause-grouped failures
        given().auth().oauth2(Tokens.of("arch"))
                .when().get("/tasks/health")
                .then().statusCode(200)
                .body("byState.FAILED", equalTo(1))
                .body("failuresByErrorCode.PVC_RWX_DENIED", equalTo(1));
    }

    /**
     * Queue gating (mock defect-log row 106): only Not started / Succeeded
     * (NOT_STARTED / CURRENT) analyses queue a fresh run — the single queue
     * endpoint rejects other states with {@code state.conflict}.
     */
    @Test
    @Order(16)
    void queueAnalysisRejectsNonQueueableState() {
        // invoicing seeds IN_FLIGHT (running) — the mock's greyed-out Queue option
        String invoicingId = given().auth().oauth2(Tokens.of("arch"))
                .when().get("/applications?name=invoicing")
                .then().statusCode(200)
                .extract().jsonPath().getString("items[0].id");
        given().auth().oauth2(Tokens.of("arch"))
                .contentType("application/json")
                .body("{\"applicationId\":\"" + invoicingId + "\"}")
                .when().post("/analyses")
                .then().statusCode(409)
                .body("code", equalTo("state.conflict"))
                .body("message", containsString("IN_FLIGHT"));
        // the same POST for a CURRENT app still queues (re-running starts a fresh run)
        String paymentsId = given().auth().oauth2(Tokens.of("arch"))
                .when().get("/applications?name=payments-api")
                .then().statusCode(200)
                .extract().jsonPath().getString("items[0].id");
        given().auth().oauth2(Tokens.of("arch"))
                .contentType("application/json")
                .body("{\"applicationId\":\"" + paymentsId + "\"}")
                .when().post("/analyses")
                .then().statusCode(201);
    }

    /** Bulk queue (mock row 106): ineligible states are skipped and NAMED, not fatal. */
    @Test
    @Order(17)
    void batchAnalysesSkipsNonQueueable() {
        String notStarted = given().auth().oauth2(Tokens.of("arch"))
                .when().get("/applications?name=billing-worker")
                .then().statusCode(200)
                .extract().jsonPath().getString("items[0].id");
        String running = given().auth().oauth2(Tokens.of("arch"))
                .when().get("/applications?name=invoicing")
                .then().statusCode(200)
                .extract().jsonPath().getString("items[0].id");
        given().auth().oauth2(Tokens.of("arch"))
                .contentType("application/json")
                .body("{\"applicationIds\":[\"" + notStarted + "\",\"" + running + "\"]}")
                .when().post("/batch/analyses")
                .then().statusCode(202)
                .body("tasks.size()", equalTo(1))
                .body("skipped.size()", equalTo(1))
                .body("skipped[0]", containsString("IN_FLIGHT"));
    }

    @Test
    @Order(6)
    void userSettingsSelfScopedMerge() {
        // PUT stores for the calling subject only
        given().auth().oauth2(Tokens.of("arch"))
                .contentType("application/json")
                .body("{\"language\":\"de\",\"tourCompleted\":{\"architect\":true}}")
                .when().put("/user-settings")
                .then().statusCode(204);
        given().auth().oauth2(Tokens.of("arch"))
                .when().get("/user-settings")
                .then().statusCode(200)
                .body("language", equalTo("de"))
                .body("subject", equalTo("arch"));
        // merge semantics: previous keys preserved
        given().auth().oauth2(Tokens.of("arch"))
                .contentType("application/json")
                .body("{\"currency\":\"EUR\"}")
                .when().put("/user-settings")
                .then().statusCode(204);
        given().auth().oauth2(Tokens.of("arch"))
                .when().get("/user-settings")
                .then().statusCode(200)
                .body("language", equalTo("de"))
                .body("currency", equalTo("EUR"));
        // another subject cannot see it
        given().auth().oauth2(Tokens.of("someone-else"))
                .when().get("/user-settings")
                .then().statusCode(200)
                .body("language", emptyOrNullString());
    }

    @Test
    @Order(7)
    void settingsManifest() {
        given().auth().oauth2(Tokens.of("admin"))
                .when().get("/manifests")
                .then().statusCode(200)
                .body("totalCount", greaterThan(2))
                .body("items[0].key", notNullValue())
                .body("items[0].effect", notNullValue());
    }

    @Test
    @Order(8)
    void reportEffortGroupBy() {
        given().auth().oauth2(Tokens.of("arch"))
                .when().get("/report/effort?groupBy=businessService")
                .then().statusCode(200)
                .body("groups.size()", greaterThan(0))
                .body("groups[0].applicationCount", notNullValue());
        given().auth().oauth2(Tokens.of("arch"))
                .when().get("/report/effort?groupBy=wave")
                .then().statusCode(200)
                .body("groups.size()", equalTo(4)); // 4 seeded waves (2 with members)
        given().auth().oauth2(Tokens.of("arch"))
                .when().get("/report/effort?groupBy=nonsense")
                .then().statusCode(400)
                .body("code", equalTo("validation.failed"));
    }

    @Test
    @Order(9)
    void legacyDashboardDeprecated() {
        given().auth().oauth2(Tokens.of("arch"))
                .when().get("/report/dashboard")
                .then().statusCode(200)
                .header("Deprecation", equalTo("true"))
                .header("Link", containsString("/report/effort"))
                .body("replacement", containsString("/report/effort"));
    }

    @Test
    @Order(10)
    void webhookCrudAndDeliveries() {
        String webhookId = given().auth().oauth2(Tokens.of("admin"))
                .contentType("application/json")
                .body("{\"name\":\"ci-webhook\",\"url\":\"https://ci.example.com/hooks/mta\",\"kinds\":[\"analysis\",\"task\"]}")
                .when().post("/webhooks")
                .then().statusCode(201)
                .extract().jsonPath().getString("id");
        given().auth().oauth2(Tokens.of("admin"))
                .when().post("/webhooks/" + webhookId + "/deliveries")
                .then().statusCode(202)
                .body("replayed", equalTo(0));
        given().auth().oauth2(Tokens.of("admin"))
                .when().get("/webhooks/" + webhookId + "/deliveries")
                .then().statusCode(200)
                .body("totalCount", equalTo(0));
        // webhooks:manage is admin-only (mig token lacks the scope)
        given().auth().oauth2(Tokens.of("mig"))
                .when().get("/webhooks")
                .then().statusCode(403);
    }

    @Test
    @Order(11)
    void auditTrailRecordsMutations() {
        // the earlier triage + batch mutations must be in the trail
        given().auth().oauth2(Tokens.of("padmin"))
                .when().get("/audit")
                .then().statusCode(200)
                .body("totalCount", greaterThan(2))
                .body("items.actor", notNullValue());
        // audit:read is padmin-exclusive in practice
        given().auth().oauth2(Tokens.of("mig"))
                .when().get("/audit")
                .then().statusCode(403);
    }

    @Test
    @Order(12)
    void openapiServed() {
        given()
                .when().get("/openapi3.json")
                .then().statusCode(200)
                .body(containsString("Tackle Hub API"));
    }
}
