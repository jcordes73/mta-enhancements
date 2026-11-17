package org.konveyor.mta.hub.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * Source platform a migration lands on (mock's MOCK_PLATFORMS store): the
 * Config registries tab and the inventory's platform filter both read this.
 */
@Entity
@Table(name = "platform")
public class Platform extends BaseEntity {

    @Column(nullable = false, unique = true, length = 255)
    public String name;

    @Column(nullable = false, length = 64)
    public String type = "kubernetes";
}
