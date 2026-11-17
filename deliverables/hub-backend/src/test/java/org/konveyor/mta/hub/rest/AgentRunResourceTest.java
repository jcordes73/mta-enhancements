package org.konveyor.mta.hub.rest;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.notNullValue;

/**
 * Agent-run telemetry contract (mock defect-log row 105): every seeded run
 * carries agent-loop turns and context-window usage (current / window and
 * the derived display form). Seeded numbers are byte-identical to the
 * mock's MOCK_AGENT_RUNS so the console views cannot disagree.
 */
@QuarkusTest
class AgentRunResourceTest {

    @Test
    void listCarriesTurnsAndContextTelemetry() {
        given().auth().oauth2(Tokens.of("arch"))
                .when().get("/agent-runs?size=50")
                .then().statusCode(200)
                .body("totalCount", greaterThanOrEqualTo(12))
                // run #27 (execute — spring-boot-to-quarkus, 128k granite window)
                .body("items.find { it.name.startsWith('execute — spring-boot-to-quarkus') && it.state == 'RUNNING' }.turns", equalTo(23))
                .body("items.find { it.name.startsWith('execute — spring-boot-to-quarkus') && it.state == 'RUNNING' }.ctx", equalTo("38,412 / 128,000 (30%)"))
                // run #19 (frontier-70b — 200k window)
                .body("items.find { it.name == 'execute — quarkus rewrite' }.ctx", equalTo("91,640 / 200,000 (46%)"))
                .body("items.find { it.name == 'execute — quarkus rewrite' }.ctxWindow", equalTo(200000));
    }

    @Test
    void detailIncludesEventsAndTelemetry() {
        String id = given().auth().oauth2(Tokens.of("arch"))
                .when().get("/agent-runs?application=payments-api&size=50")
                .then().statusCode(200)
                .body("items.turns", hasItem(notNullValue()))
                .extract().jsonPath().getString("items[0].id");
        given().auth().oauth2(Tokens.of("arch"))
                .when().get("/agent-runs/" + id)
                .then().statusCode(200)
                .body("events", notNullValue())
                .body("events.size()", greaterThanOrEqualTo(4))
                .body("turns", notNullValue())
                .body("ctxCurrent", notNullValue())
                .body("ctxWindow", notNullValue());
    }
}
