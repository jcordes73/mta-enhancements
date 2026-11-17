package org.konveyor.mta.hub.model;

import io.quarkus.hibernate.orm.panache.PanacheQuery;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * An application in the migration portfolio. Exactly-one-team ownership is
 * enforced in the app form (#41); analysis state feeds the coverage donut
 * (current / stale / in-flight / failed / not-started).
 */
@Entity
@Table(name = "application", uniqueConstraints = @UniqueConstraint(name = "uc_application_name", columnNames = "name"))
public class Application extends BaseEntity {

    public enum AnalysisState { NOT_STARTED, IN_FLIGHT, CURRENT, STALE, FAILED }

    /** Risk provenance, #32 item 6: own assessment vs inherited from the archetype. */
    public enum RiskKind { OWN, INHERITED, UNASSESSED, NONE }

    /** Review sign-off state (#45). */
    public enum ReviewState { NOT_STARTED, PENDING, APPROVED }

    /** Source repository type (mock's repo field). */
    public enum RepositoryType { GIT, SUBVERSION }

    @Column(nullable = false, length = 255)
    public String name;

    @Column(length = 2048)
    public String description;

    @Column(length = 1024)
    public String repositoryUrl;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "business_service_id", nullable = false)
    public BusinessService businessService;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id")
    public Stakeholder owner;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "team_id", nullable = false)
    public Team team;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "archetype_id")
    public Archetype archetype;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "application_tags",
            joinColumns = @JoinColumn(name = "application_id"),
            inverseJoinColumns = @JoinColumn(name = "tag_id"))
    public List<Tag> tags = new ArrayList<>();

    @Column(nullable = false, length = 32)
    @Enumerated(EnumType.STRING)
    public AnalysisState analysisState = AnalysisState.NOT_STARTED;

    /**
     * Queue gating (mock defect-log row 106): only NOT_STARTED or CURRENT
     * (succeeded) analyses can queue a fresh run — IN_FLIGHT (running),
     * STALE (quota-blocked) and FAILED applications are rejected until then.
     */
    public boolean analysisQueueable() {
        return analysisState == AnalysisState.NOT_STARTED || analysisState == AnalysisState.CURRENT;
    }

    /** Effort in story points (scaled to the scoped max in UI layers). */
    public int effort;

    /** Combined risk, #32 — never encoded in color alone downstream. */
    @Column(length = 32)
    public String risk;

    /** Risk provenance (#32 item 6): own | inherited | unassessed | none. */
    @Column(nullable = false, length = 32)
    @Enumerated(EnumType.STRING)
    public RiskKind riskKind = RiskKind.NONE;

    /** Target platform (mock's platform field). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "platform_id")
    public Platform platform;

    /** Source repository type. */
    @Column(nullable = false, length = 32)
    @Enumerated(EnumType.STRING)
    public RepositoryType repositoryType = RepositoryType.GIT;

    /** Whether a prebuilt binary artifact accompanies the source. */
    @Column(nullable = false)
    public boolean binaryArtifact;

    /** Assessment version ('v3'); NULL/empty = none. */
    @Column(length = 32)
    public String assessmentVersion;

    /** Review sign-off (#45). */
    @Column(nullable = false, length = 32)
    @Enumerated(EnumType.STRING)
    public ReviewState reviewState = ReviewState.NOT_STARTED;

    /** Registry-level source identity (mock's creds: 'source maven', 'source', …). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "identity_id")
    public Identity identity;

    /** Team-scoped source credential (mock's credName: 'gitlab-pat', …). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "credential_id")
    public Identity credential;

    public static PanacheQuery<Application> inOrganization(UUID organizationId) {
        return find("team.department.organization.id", organizationId);
    }

    public static Application findByName(String name) {
        return find("name", name).firstResult();
    }

    public UUID organizationId() {
        return team.department.organization.id;
    }
}
