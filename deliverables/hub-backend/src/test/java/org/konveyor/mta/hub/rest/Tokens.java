package org.konveyor.mta.hub.rest;

import io.restassured.RestAssured;
import org.eclipse.microprofile.config.ConfigProvider;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Tokens for the REST contract tests: password grants against the Dev
 * Services Keycloak (realm {@code mta}, client {@code mta-console}, all demo
 * users password {@code demo} — see keycloak/mta-realm.json). The realm users
 * carry the scope sets / organization claims the tests previously expressed
 * as {@code X-MTA-Scopes} / {@code X-MTA-Org} headers, so a test's token
 * replaces all of its identity headers 1:1.
 */
public final class Tokens {

    private static final Map<String, String> CACHE = new ConcurrentHashMap<>();

    private Tokens() {
    }

    /** Access token for the given realm user (cached per test JVM). */
    public static String of(String username) {
        return CACHE.computeIfAbsent(username, Tokens::fetch);
    }

    private static String fetch(String username) {
        String authServer = ConfigProvider.getConfig()
                .getValue("quarkus.oidc.auth-server-url", String.class);
        return RestAssured.given()
                .contentType("application/x-www-form-urlencoded")
                .formParams(Map.of(
                        "grant_type", "password",
                        "client_id", "mta-console",
                        "username", username,
                        "password", "demo",
                        "scope", "openid"))
                .post(authServer + "/protocol/openid-connect/token")
                .then()
                .statusCode(200)
                .extract()
                .jsonPath()
                .getString("access_token");
    }
}
