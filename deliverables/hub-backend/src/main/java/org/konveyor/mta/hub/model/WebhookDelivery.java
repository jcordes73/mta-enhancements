package org.konveyor.mta.hub.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;

/** One delivery attempt log entry (GET /webhooks/{id}/deliveries). */
@Entity
@Table(name = "webhook_delivery", indexes = @Index(name = "idx_delivery_webhook", columnList = "webhook_id"))
public class WebhookDelivery extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "webhook_id", nullable = false)
    public Webhook webhook;

    @Column(nullable = false, length = 64)
    public String kind;

    @Column(nullable = false, length = 64)
    public String type;

    @Lob
    @Column(nullable = false)
    public String payload;

    public int responseStatus;

    /** true = the final attempt of this delivery succeeded. */
    public boolean succeeded;

    public int attempts = 1;

    public Instant deliveredAt = Instant.now();
}
