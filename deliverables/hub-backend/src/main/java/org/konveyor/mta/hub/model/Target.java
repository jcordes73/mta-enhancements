package org.konveyor.mta.hub.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * Migration target (mock's MOCK_TARGETS store): the Config registries tab.
 */
@Entity
@Table(name = "target")
public class Target extends BaseEntity {

    @Column(nullable = false, unique = true, length = 255)
    public String name;

    /** Display string ('Java, Maven'). */
    @Column(nullable = false, length = 255)
    public String langs;
}
