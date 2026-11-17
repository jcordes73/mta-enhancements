package org.konveyor.mta.hub.security;

import jakarta.annotation.Priority;
import jakarta.interceptor.InterceptorBinding;
import jakarta.enterprise.util.Nonbinding;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Declares the `resource:verb` scope(s) a method requires (§9.2). The
 * identity must hold at least one of the listed scopes; otherwise the call
 * fails with 403 `scope.denied`. Scopes derive from realm roles via the
 * {@code hub.role-mapping.*} config, so the Keycloak realm packages them
 * once and the Administration → Scopes UI picks them up.
 */
@InterceptorBinding
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.METHOD, ElementType.TYPE})
public @interface Scopes {

    /** Any one of these scopes authorizes the call (not part of the binding). */
    @Nonbinding
    String[] value();
}
