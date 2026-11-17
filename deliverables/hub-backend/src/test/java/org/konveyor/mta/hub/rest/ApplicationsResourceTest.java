package org.konveyor.mta.hub.rest;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.any;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.emptyOrNullString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasKey;
import static org.hamcrest.Matchers.notNullValue;

/**
 * Contract v2.1 conformance for the application surface: upsert semantics,
 * ETag/If-Match, duplicate 409, structured error codes, tenancy clamps and
 * the reverse tag relation.
 * <p>
 * Authenticated with Keycloak tokens (Dev Services Keycloak, realm `mta`);
 * each request's identity (subject, scopes, organization) is baked into the
 * realm user's token — see Tokens.of() and keycloak/mta-realm.json.
 */
@QuarkusTest
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class ApplicationsResourceTest {

    static final String SCOPES = "applications:read,applications:create,applications:update,applications:delete,tags:read,tags:create,organizations:read,teams:read,departments:read,business-services:read,teams:read";

    static String appId;
    static String etag;

    @Test
    @Order(1)
    void listApplicationsSeeded() {
        given()
                .auth().oauth2(Tokens.of("test-architect"))
                .when().get("/applications")
                .then()
                .statusCode(200)
                .body("totalCount", notNullValue())
                .body("items.size()", equalTo(12)); // the mock dataset's nwf apps
    }

    @Test
    @Order(2)
    void unauthenticatedIsRejectedWithMachineReadableError() {
        // Keycloak everywhere: a tokenless call is rejected at the HTTP layer
        // with 401 + WWW-Authenticate — never a redirect (contract semantics,
        // enforced by the `authenticated` policy in every profile).
        given()
                .when().get("/applications")
                .then()
                .statusCode(401)
                .header("WWW-Authenticate", notNullValue());
    }

    @Test
    @Order(3)
    void missingScopeDenied() {
        given()
                .auth().oauth2(Tokens.of("limited"))
                .when().get("/applications")
                .then()
                .statusCode(403)
                .body("code", equalTo("scope.denied"));
    }

    @Test
    @Order(4)
    void createDuplicateFails409() {
        // seed already has payments-api
        given()
                .auth().oauth2(Tokens.of("test-architect"))
                .contentType("application/json")
                .body("""
                        {"name":"payments-api","businessServiceId":"%s","teamId":"%s"}
                        """.formatted(bsvcId(), teamId()))
                .when().post("/applications")
                .then()
                .statusCode(409)
                .body("code", equalTo("resource.duplicate"));
    }

    @Test
    @Order(5)
    void upsertUpdatesExisting() {
        given()
                .auth().oauth2(Tokens.of("test-architect"))
                .contentType("application/json")
                .body("""
                        {"name":"payments-api","description":"upserted","businessServiceId":"%s","teamId":"%s"}
                        """.formatted(bsvcId(), teamId()))
                .when().post("/applications?upsert=true")
                .then()
                .statusCode(200)
                .body("description", equalTo("upserted"));
    }

    @Test
    @Order(6)
    void createAndEtagRoundTrip() {
        String team = teamId();
        String bsvc = bsvcId();
        var response = given()
                .auth().oauth2(Tokens.of("test-architect"))
                .contentType("application/json")
                .body("""
                        {"name":"etl-bridge","description":"created by test","businessServiceId":"%s","teamId":"%s","tags":["quarkus"],"effort":7}
                        """.formatted(bsvc, team))
                .when().post("/applications")
                .then()
                .statusCode(201)
                .header("ETag", notNullValue())
                .header("Location", containsString("/applications/"))
                .body("name", equalTo("etl-bridge"))
                .body("team", equalTo("Claims"))
                .extract();
        appId = response.jsonPath().getString("id");
        etag = response.header("ETag");
    }

    @Test
    @Order(7)
    void staleIfMatchFails412() {
        given()
                .auth().oauth2(Tokens.of("test-architect"))
                .header("If-Match", "\"999999\"")
                .contentType("application/json")
                .body("""
                        {"name":"etl-bridge","businessServiceId":"%s","teamId":"%s"}
                        """.formatted(bsvcId(), teamId()))
                .when().put("/applications/" + appId)
                .then()
                .statusCode(412)
                .body("code", equalTo("precondition.failed"));
    }

    @Test
    @Order(8)
    void currentIfMatchSucceeds() {
        given()
                .auth().oauth2(Tokens.of("test-architect"))
                .header("If-Match", etag)
                .contentType("application/json")
                .body("""
                        {"name":"etl-bridge","description":"updated with matching etag","businessServiceId":"%s","teamId":"%s"}
                        """.formatted(bsvcId(), teamId()))
                .when().put("/applications/" + appId)
                .then()
                .statusCode(200)
                .body("description", equalTo("updated with matching etag"));
    }

    @Test
    @Order(9)
    void tenantClampHidesOtherOrg() {
        // meridian-health (chen) cannot see a northwind application —
        // the organization claim is baked into the token
        given()
                .auth().oauth2(Tokens.of("chen"))
                .when().get("/applications/" + appId)
                .then()
                .statusCode(403)
                .body("code", equalTo("tenant.mismatch"));
    }

    @Test
    @Order(10)
    void platformAdminSeesAllButNotLocked() {
        given()
                .auth().oauth2(Tokens.of("padmin"))
                .when().get("/applications")
                .then()
                .statusCode(200)
                .body("totalCount", notNullValue());
    }

    @Test
    @Order(11)
    void notFoundCarriesStableCode() {
        given()
                .auth().oauth2(Tokens.of("test-architect"))
                .when().get("/applications/00000000-0000-0000-0000-000000000000")
                .then()
                .statusCode(404)
                .body("code", equalTo("resource.not-found"));
    }

    @Test
    @Order(12)
    void deleteBlockedByWaveMembership() {
        // payments-api is a member of seeded Wave 2 → resource.in-use
        String paymentsId = given()
                .auth().oauth2(Tokens.of("test-architect"))
                .when().get("/applications?name=payments-api")
                .then().statusCode(200)
                .extract().jsonPath().getString("items[0].id");
        given()
                .auth().oauth2(Tokens.of("test-architect"))
                .when().delete("/applications/" + paymentsId)
                .then()
                .statusCode(409)
                .body("code", equalTo("resource.in-use"));
    }

    @Test
    @Order(13)
    void deleteCreatedApp() {
        given()
                .auth().oauth2(Tokens.of("test-architect"))
                .when().delete("/applications/" + appId)
                .then()
                .statusCode(204);
    }

    /**
     * Full delete cascade (mock defect-log row 106): the UI's bulk delete
     * removes seeded apps that carry workflow runs — workflow_run.application_id
     * is a non-optional FK, so the delete must clear the agentic rows first.
     */
    @Test
    @Order(14)
    void deleteAppWithWorkflowRunCascades() {
        String id = given()
                .auth().oauth2(Tokens.of("test-architect"))
                .contentType("application/json")
                .body("""
                        {"name":"cascade-probe","businessServiceId":"%s","teamId":"%s"}
                        """.formatted(bsvcId(), teamId()))
                .when().post("/applications")
                .then().statusCode(201)
                .extract().jsonPath().getString("id");
        given()
                .auth().oauth2(Tokens.of("test-architect"))
                .contentType("application/json")
                .body("""
                        {"name":"WR-CASCADE","workflow":"spring-boot-to-quarkus","application":"cascade-probe"}
                        """)
                .when().post("/workflow-runs")
                .then().statusCode(201);
        given()
                .auth().oauth2(Tokens.of("test-architect"))
                .when().delete("/applications/" + id)
                .then()
                .statusCode(204);
        // the cascade took the run with it
        given()
                .auth().oauth2(Tokens.of("test-architect"))
                .when().get("/workflow-runs?application=cascade-probe")
                .then().statusCode(200)
                .body("totalCount", equalTo(0));
    }

    private static String bsvcId() {
        return given()
                .auth().oauth2(Tokens.of("test-architect"))
                .when().get("/business-services")
                .then().statusCode(200)
                .extract().jsonPath().getString("items.find { it.name == 'Claims' }.id");
    }

    private static String teamId() {
        return given()
                .auth().oauth2(Tokens.of("test-architect"))
                .when().get("/teams")
                .then().statusCode(200)
                .extract().jsonPath().getString("items.find { it.name == 'Claims' }.id");
    }
}
