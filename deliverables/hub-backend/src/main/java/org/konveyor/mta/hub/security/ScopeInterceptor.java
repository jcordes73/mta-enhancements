package org.konveyor.mta.hub.security;

import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.interceptor.AroundInvoke;
import jakarta.interceptor.Interceptor;
import jakarta.interceptor.InvocationContext;
import org.konveyor.mta.hub.error.ApiException;

import java.util.Set;

/** Enforces {@link Scopes} on annotated resource methods. */
@Interceptor
@jakarta.annotation.Priority(jakarta.interceptor.Interceptor.Priority.APPLICATION + 500)
@Scopes({})
public class ScopeInterceptor {

    @Inject
    SecurityIdentity identity;

    @Inject
    RoleScopeMapper roleScopeMapper;

    @AroundInvoke
    public Object enforce(InvocationContext ctx) throws Exception {
        Scopes scopes = ctx.getMethod().getAnnotation(Scopes.class);
        if (scopes == null) {
            scopes = ctx.getTarget().getClass().getAnnotation(Scopes.class);
        }
        if (scopes != null && !authorized(scopes.value())) {
            throw ApiException.scopeDenied(String.join(" or ", scopes.value()));
        }
        return ctx.proceed();
    }

    private boolean authorized(String[] required) {
        Set<String> held = effectiveScopes();
        for (String scope : required) {
            if (held.contains(scope)) {
                return true;
            }
        }
        return false;
    }

    /** Token scopes (scopes claim + role mapping). */
    private Set<String> effectiveScopes() {
        return roleScopeMapper.scopes(identity);
    }
}
