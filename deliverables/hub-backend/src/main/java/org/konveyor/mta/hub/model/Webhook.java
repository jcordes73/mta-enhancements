package org.konveyor.mta.hub.model;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.util.ArrayList;
import java.util.List;

/**
 * A webhook subscription (§9.1): standard CRUD, deliveries logged at
 * {@code /webhooks/{id}/deliveries}, failed deliveries replayable.
 */
@Entity
@Table(name = "webhook", uniqueConstraints = @UniqueConstraint(name = "uc_webhook_name", columnNames = "name"))
public class Webhook extends BaseEntity {

    @Column(nullable = false, length = 255)
    public String name;

    @Column(nullable = false, length = 1024)
    public String url;

    /** Empty = all kinds. Values mirror /events kinds. */
    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "webhook_kinds", joinColumns = @JoinColumn(name = "webhook_id"))
    @Column(name = "kind", length = 64)
    public List<String> kinds = new ArrayList<>();

    @Column(length = 255)
    public String secret;

    public boolean enabled = true;
}
