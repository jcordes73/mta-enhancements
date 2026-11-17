package org.konveyor.mta.hub.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * Migration workflow (mock's MOCK_WORKFLOWS store) — versioned stage list
 (*49): the stage definitions live in workflow.yaml; the record carries the
 * count and the linked guide.
 */
@Entity
@Table(name = "workflow")
public class Workflow extends BaseEntity {

    @Column(nullable = false, unique = true, length = 255)
    public String name;

    @Column(nullable = false)
    public int stages;

    /** Linked migration guide; NULL for org-authored workflows. */
    @Column(length = 255)
    public String guide;

    @Column(nullable = false)
    public boolean ready;
}
