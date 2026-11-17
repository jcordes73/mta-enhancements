package org.konveyor.mta.hub.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/** Tag categories (upstream parity: color/rank metadata). */
@Entity
@Table(name = "tag_type", uniqueConstraints = @UniqueConstraint(name = "uc_tagtype_name", columnNames = "name"))
public class TagType extends BaseEntity {

    @Column(nullable = false, length = 255)
    public String name;

    @Column(length = 32)
    public String color;

    @Column
    public int rank;
}
