package org.konveyor.mta.hub.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * LLM gateway (mock's MOCK_GATEWAYS store) — the MaaS surface of #20:
 * model attribution, token/cost showback inputs, and health state.
 */
@Entity
@Table(name = "gateway")
public class Gateway extends BaseEntity {

    @Column(nullable = false, unique = true, length = 255)
    public String name;

    @Column(nullable = false, length = 255)
    public String model;

    @Column(nullable = false, length = 1024)
    public String endpoint;

    /** Context window display ('128k'). */
    @Column(length = 32)
    public String ctx;

    /** Auth mechanism display ('Hub token exchange'). */
    @Column(length = 255)
    public String cred;

    @Column(nullable = false)
    public boolean ready;

    @Column(length = 32)
    public String tier;                 // standard | premium

    /** Health display ('reachable (HTTP 200)'). */
    @Column(length = 255)
    public String health;

    /** When health was last checked — the UI derives '2h ago'. */
    @Column
    public Instant healthAt;

    @Column
    public int runs30d;

    /** '41.2M' — display form, unit-normalizing is cosmetic. */
    @Column(length = 32)
    public String tokens30d;

    /** Showback rate, $/M tokens. */
    @Column(length = 32)
    public String rate;
}
