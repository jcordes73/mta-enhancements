package org.konveyor.mta.hub.model;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Version;

import java.time.Instant;
import java.util.UUID;

/**
 * Base for all Hub resources: UUID identity, optimistic-lock version (exposed
 * as ETag per the contract), and create/update timestamps (audit posture, #42).
 */
@MappedSuperclass
public abstract class BaseEntity extends PanacheEntityBase {

    @Id
    @Column(nullable = false, updatable = false)
    public UUID id = UUID.randomUUID();

    /** Optimistic-lock version — serialized into the ETag header. */
    @Version
    @Column(nullable = false)
    public long version;

    @Column(nullable = false, updatable = false)
    public Instant createdAt;

    @Column(nullable = false)
    public Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (this.createdAt == null) {
            this.createdAt = now;
        }
        if (this.updatedAt == null) {
            this.updatedAt = now;
        }
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public String etag() {
        return "\"" + version + "\"";
    }
}
