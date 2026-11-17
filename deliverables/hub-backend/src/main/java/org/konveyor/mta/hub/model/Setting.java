package org.konveyor.mta.hub.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * One settings-manifest entry (#33 item 11): key, type, default,
 * since-version, effect semantics — drives manifest-driven Administration
 * and the settings parity test. Served by GET /manifests.
 */
@Entity
@Table(name = "setting", uniqueConstraints = @UniqueConstraint(name = "uc_setting_key", columnNames = "key"))
public class Setting extends BaseEntity {

    @Id
    @Column(name = "key", nullable = false, length = 255, updatable = false)
    public String key;

    /** e.g. string | boolean | integer | duration */
    @Column(nullable = false, length = 32)
    public String type;

    @Column(length = 1024)
    public String defaultValue;

    /** Value currently in effect (manifest-driven Administration). */
    @Column(length = 1024)
    public String value;

    /** Hub release the setting appeared in. */
    @Column(nullable = false, length = 32)
    public String since;

    @Column(nullable = false, length = 512)
    public String effect;
}
