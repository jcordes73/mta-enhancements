package org.konveyor.mta.hub.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * A credential (suggestion #15). Team-owned like applications: the credential
 * belongs to exactly one team (nullable only for org/admin-managed entries);
 * lastUsed feeds the audit posture (#42), usedBy is derived from assignments.
 */
@Entity
@Table(name = "identity")
public class Identity extends BaseEntity {

    public enum Kind { USERNAME_PASSWORD, OAUTH2, BEARER_TOKEN, SECRET_KEY, SOURCE_PRIVATE_KEY, API_KEY }

    @Column(nullable = false, length = 255)
    public String name;

    @Column(nullable = false, length = 64)
    @Enumerated(EnumType.STRING)
    public Kind kind;

    @Column(name = "username", length = 255)
    public String user;

    /** Secret — write-only upstream parity: never serialized back. */
    @Column(length = 2048)
    public String password;

    @Column(length = 2048)
    public String key;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organization_id", nullable = false)
    public Organization organization;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_id")
    public Team team;

    /** Last-used as audit (#42); maintained by the consumers of the credential. */
    public java.time.Instant lastUsed;

    /** Expiry date; NULL = no expiry. The UI derives the expiring/ok chips (#15). */
    public java.time.LocalDate expiresOn;

    /** Verification state — the unverified chip is a #15 admission-gate input. */
    @Column(nullable = false)
    public boolean verified;

    /** Registry-level display description (Config identities tab). */
    @Column(length = 1024)
    public String description;
}
