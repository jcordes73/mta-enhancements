package org.konveyor.mta.hub.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * Skill card (mock's MOCK_SKILLS store) — versioned capability units (#49).
 */
@Entity
@Table(name = "skill")
public class Skill extends BaseEntity {

    public enum Type { BUILTIN, CUSTOM, THIRD_PARTY }

    @Column(nullable = false, unique = true, length = 255)
    public String name;

    @Column(nullable = false, length = 255)
    public String display;

    @Column(nullable = false, length = 2048)
    public String description;

    @Column(nullable = false, length = 32)
    public Type type = Type.BUILTIN;

    /** 'shipped' | 'org registry' | 'curated registry'. */
    @Column(nullable = false, length = 255)
    public String source;

    @Column(nullable = false)
    public boolean ready;

    /** Comma-separated display tags. */
    @Column(length = 512)
    public String tags;
}
