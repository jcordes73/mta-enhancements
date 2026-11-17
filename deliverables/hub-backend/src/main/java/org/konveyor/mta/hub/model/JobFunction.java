package org.konveyor.mta.hub.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * Job functions classify people (live-API parity: stakeholders pick one at
 * create; the Job functions table lists its people). Deliberately NOT
 * personas — personas classify console access, job functions classify people.
 */
@Entity
@Table(name = "job_function", uniqueConstraints = @UniqueConstraint(name = "uc_jobfunction_name", columnNames = "name"))
public class JobFunction extends BaseEntity {

    @Column(nullable = false, length = 255)
    public String name;
}
