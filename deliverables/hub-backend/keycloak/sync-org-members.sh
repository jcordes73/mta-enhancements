#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# sync-org-members.sh — Keycloak Organizations bootstrap for the `mta` realm.
#
# WHY THIS EXISTS: realm JSON import creates organizations but IGNORES their
# members (keycloak#54343) — memberships must go through the Admin API. This
# script is idempotent: it ensures the orgs exist (the realm import normally
# creates them), then ensures every listed user is a member of their org.
#
# Run it after the realm exists — against the Dev Services Keycloak (port
# 8180, the default here), e.g. from a throwaway Keycloak container with the
# keycloak/ directory mounted and KC_URL set to the reachable origin.
#
# Membership is what the native `mta-orgs` token claim (oidc-organization-
# membership-mapper, client scope `org-membership`) is built from — the
# backend's TenantScope resolves it when the legacy `organization` attribute
# claim is absent.
#
# kcadm landmines baked into this script: org endpoints take the org UUID
# (NOT the alias — resolve it via ?search first), member add is a POST with
# the user UUID as a raw JSON string body (kcadm -f, not -s).
# ---------------------------------------------------------------------------
set -euo pipefail

KC_URL="${KC_URL:-http://127.0.0.1:8180}"
KC_ADMIN_USER="${KC_ADMIN_USER:-admin}"
KC_ADMIN_PASSWORD="${KC_ADMIN_PASSWORD:-admin}"
REALM="${REALM:-mta}"
KC="/opt/keycloak/bin/kcadm.sh"

echo "waiting for Keycloak at $KC_URL ..."
for _ in $(seq 1 60); do
  if "$KC" get "$KC_URL/admin/realms/$REALM" --no-config --server "$KC_URL" \
       --realm master --user "$KC_ADMIN_USER" --password "$KC_ADMIN_PASSWORD" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

"$KC" config credentials --server "$KC_URL" --realm master \
  --user "$KC_ADMIN_USER" --password "$KC_ADMIN_PASSWORD"

# alias -> org members (legacy `organization` attribute claim mirrors these;
# users WITHOUT the attribute, e.g. olson, rely on membership alone)
# usernames are the demo users' email addresses (2026-11-16)
NORTHWIND_USERS="m.keller@northwind-financial.com j.cordes@northwind-financial.com p.schmidt@northwind-financial.com k.vogel@northwind-financial.com a.weber@northwind-financial.com r.olson@northwind-financial.com arch mig pm limited test-architect"
MERIDIAN_USERS="chen"

org_id() { # $1 = alias -> prints the org UUID (empty when missing).
  # kcadm's ?search= matches org NAME, not alias; its output is pretty-printed
  # (id and alias on separate lines) — flatten, split into objects, then match.
  "$KC" get organizations -r "$REALM" --fields alias,id 2>/dev/null \
    | tr -d ' \n' \
    | sed 's/},{/}\n{/g' \
    | grep "\"$1\"" \
    | sed -n 's/.*"id" *: *"\([^"]*\)".*/\1/p' | head -1
}

ensure_org() { # $1 = alias, $2 = display name; sets ORG_ID
  local alias="$1" name="$2"
  ORG_ID=$(org_id "$alias")
  if [ -n "$ORG_ID" ]; then
    echo "org $alias: exists ($ORG_ID)"
  else
    "$KC" create organizations -r "$REALM" \
      -s "alias=$alias" -s "name=$name" -s "enabled=true"
    ORG_ID=$(org_id "$alias")
    echo "org $alias: created ($ORG_ID)"
  fi
}

ensure_member() { # $1 = org UUID, $2 = username
  local oid="$1" user="$2" uid
  uid=$("$KC" get users -r "$REALM" -q "username=$user" -q exact=true --fields id 2>/dev/null \
        | sed -n 's/.*"id" *: *"\([^"]*\)".*/\1/p' | head -1)
  if [ -z "$uid" ]; then
    echo "  !! user $user not found — skipped"; return 0
  fi
  if "$KC" get "organizations/$oid/members/$uid" -r "$REALM" >/dev/null 2>&1; then
    echo "  $user -> member (already)"
  else
    printf '"%s"' "$uid" > /tmp/member.json
    "$KC" create "organizations/$oid/members" -r "$REALM" -f /tmp/member.json
    echo "  $user -> member (added)"
  fi
}

ensure_org northwind-financial "Northwind Financial"
NW="$ORG_ID"
for u in $NORTHWIND_USERS; do ensure_member "$NW" "$u"; done

ensure_org meridian-health "Meridian Health"
MH="$ORG_ID"
for u in $MERIDIAN_USERS; do ensure_member "$MH" "$u"; done

# ---------------------------------------------------------------------------
# Attach the `org-membership` client scope to mta-console. Realm-level
# defaultDefaultClientScopes CANNOT be used for this: setting it in the realm
# import JSON suppresses the creation of Keycloak's built-in default scopes
# (profile/email/roles/... — realm_access.roles disappears, personas break).
# ---------------------------------------------------------------------------
CID=$("$KC" get clients -r "$REALM" -q "clientId=mta-console" --fields id 2>/dev/null \
      | sed -n 's/.*"id" *: *"\([^"]*\)".*/\1/p' | head -1)
SID=$("$KC" get client-scopes -r "$REALM" 2>/dev/null \
      | tr -d ' \n' | sed 's/},{/}\n{/g' \
      | grep '"org-membership"' \
      | sed -n 's/.*"id" *: *"\([^"]*\)".*/\1/p' | head -1)
if [ -n "$CID" ] && [ -n "$SID" ] \
   && ! "$KC" get "clients/$CID/default-client-scopes" -r "$REALM" 2>/dev/null | grep -q '"org-membership"'; then
  "$KC" create "clients/$CID/default-client-scopes/$SID" -r "$REALM"
  echo "org-membership scope attached to mta-console"
else
  echo "org-membership scope already attached (or ids unresolved)"
fi

echo "org memberships in sync."
