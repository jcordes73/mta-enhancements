package org.konveyor.mta.hub.error;

import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;

import java.util.LinkedHashMap;
import java.util.Map;

/** Renders {@link ApiException} as the contract's structured error body. */
@Provider
public class ApiExceptionMapper implements ExceptionMapper<ApiException> {

    @Override
    public Response toResponse(ApiException e) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("code", e.code);
        body.put("message", e.getMessage());
        if (e.details != null && !e.details.isEmpty()) {
            body.put("details", e.details);
        }
        return Response.status(e.status)
                .type(MediaType.APPLICATION_JSON_TYPE)
                .entity(body)
                .build();
    }
}
