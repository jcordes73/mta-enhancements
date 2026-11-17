package org.konveyor.mta.hub.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.util.ArrayList;
import java.util.List;

/**
 * Registered agent (mock's MOCK_AGENTS store) — an A2A-style card referencing
 * its gateway and skills (one agent = one gateway in the mock model; the
 * '(premium-pinned)' display nuance is a tier constraint, not a second gw).
 */
@Entity
@Table(name = "agent")
public class Agent extends BaseEntity {

    @Column(nullable = false, unique = true, length = 255)
    public String name;

    @Column(nullable = false, length = 1024)
    public String image;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "gateway_id", nullable = false)
    public Gateway gateway;

    /** Number of declared parameters. */
    public int params;

    @Column(nullable = false)
    public boolean ready;

    @Column(length = 255)
    public String tierPin;              // 'premium-pinned' display nuance

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "agent_skills",
            joinColumns = @JoinColumn(name = "agent_id"),
            inverseJoinColumns = @JoinColumn(name = "skill_id"))
    public List<Skill> skills = new ArrayList<>();
}
