package org.konveyor.mta.hub.model;

import io.quarkus.hibernate.orm.panache.PanacheQuery;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.util.List;
import java.util.UUID;

/**
 * A tag. Reverse relations are first-class: "which applications carry this
 * tag" is `/tags/{id}/applications` (contract v2.1).
 */
@Entity
@Table(name = "tag", uniqueConstraints = @UniqueConstraint(name = "uc_tag_type_name", columnNames = {"tag_type_id", "name"}))
public class Tag extends BaseEntity {

    @Column(nullable = false, length = 255)
    public String name;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tag_type_id", nullable = false)
    public TagType tagType;

    @ManyToMany(mappedBy = "tags", fetch = FetchType.LAZY)
    public List<Application> applications = new java.util.ArrayList<>();

    public static PanacheQuery<Tag> search(String name) {
        if (name == null || name.isBlank()) {
            return findAll();
        }
        return find("lower(name) like lower(?1)", "%" + name + "%");
    }
}
