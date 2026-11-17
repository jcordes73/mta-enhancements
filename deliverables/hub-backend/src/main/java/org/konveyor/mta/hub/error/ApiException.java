package org.konveyor.mta.hub.error;

import java.util.Map;

/**
 * Structured error bodies with stable machine-readable codes (contract
 * semantics): {@code resource.not-found}, {@code resource.in-use},
 * {@code resource.duplicate}, {@code precondition.failed},
 * {@code precondition.required}, {@code validation.failed},
 * {@code scope.denied}, {@code tenant.mismatch}.
 */
public class ApiException extends RuntimeException {

    public final int status;
    public final String code;
    public final transient Map<String, Object> details;

    public ApiException(int status, String code, String message) {
        this(status, code, message, null);
    }

    public ApiException(int status, String code, String message, Map<String, Object> details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }

    public static ApiException notFound(String resource, Object id) {
        return new ApiException(404, "resource.not-found", resource + " '" + id + "' not found",
                Map.of("resource", resource, "id", String.valueOf(id)));
    }

    public static ApiException inUse(String resource, Object id, String referencedBy) {
        return new ApiException(409, "resource.in-use", resource + " '" + id + "' is referenced by " + referencedBy,
                Map.of("resource", resource, "id", String.valueOf(id), "referencedBy", referencedBy));
    }

    public static ApiException duplicate(String resource, Object key) {
        return new ApiException(409, "resource.duplicate", resource + " '" + key + "' already exists",
                Map.of("resource", resource, "key", String.valueOf(key)));
    }

    public static ApiException preconditionRequired(String hint) {
        return new ApiException(428, "precondition.required", hint, null);
    }

    public static ApiException preconditionFailed(String currentEtag) {
        return new ApiException(412, "precondition.failed",
                "Resource changed underneath you — GET the current state and retry with ETag " + currentEtag,
                Map.of("currentEtag", currentEtag));
    }

    public static ApiException validation(String message) {
        return new ApiException(400, "validation.failed", message, null);
    }

    public static ApiException scopeDenied(String required) {
        return new ApiException(403, "scope.denied", "Missing scope '" + required + "'", Map.of("required", required));
    }

    public static ApiException tenantMismatch(String resource) {
        return new ApiException(403, "tenant.mismatch",
                resource + " belongs to another organization", null);
    }

    /** 409 {@code state.conflict} — the operation contradicts the resource's current state. */
    public static ApiException stateConflict(String message) {
        return new ApiException(409, "state.conflict", message, null);
    }
}
