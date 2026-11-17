package org.konveyor.mta.hub.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.LocalDate;

/**
 * Portfolio trend point (mock's MOCK_RUN_TREND store): open vs passing
 * incident counts at a sample date — the architect landing chart.
 */
@Entity
@Table(name = "trend_point", uniqueConstraints = @UniqueConstraint(name = "uc_trend_point_date", columnNames = "date"))
public class TrendPoint extends BaseEntity {

    @Column(nullable = false, unique = true)
    public LocalDate date;

    @Column(nullable = false)
    public int open;

    @Column(nullable = false)
    public int pass;
}
