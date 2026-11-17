package org.konveyor.mta.hub.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.util.ArrayList;
import java.util.List;

/**
 * Archetypes propagate rules/tags to member applications (upstream
 * /archetypes parity; WP2 of the parity plan).
 */
@Entity
@Table(name = "archetype", uniqueConstraints = @UniqueConstraint(name = "uc_archetype_name", columnNames = "name"))
public class Archetype extends BaseEntity {

    @Column(nullable = false, length = 255)
    public String name;

    @Column(length = 2048)
    public String description;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "archetype_tags",
            joinColumns = @JoinColumn(name = "archetype_id"),
            inverseJoinColumns = @JoinColumn(name = "tag_id"))
    public List<Tag> tags = new ArrayList<>();

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "archetype_criteria",
            joinColumns = @JoinColumn(name = "archetype_id"),
            inverseJoinColumns = @JoinColumn(name = "tag_id"))
    public List<Tag> membershipCriteria = new ArrayList<>();
}
