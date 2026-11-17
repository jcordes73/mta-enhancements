package org.konveyor.mta.hub.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * Tracker ticket of one wave-member application (mock's WAVE_TICKETS store):
 * tickets follow the app into whatever wave it lands in — keyed by
 * application, never by wave.
 */
@Entity
@Table(name = "wave_ticket", uniqueConstraints = @UniqueConstraint(name = "uc_wave_ticket_app", columnNames = "application_id"))
public class WaveTicket extends BaseEntity {

    public enum Outcome { SYNCED, FAILED, QUEUED }

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "application_id", nullable = false, unique = true)
    public Application application;

    @Column(nullable = false, length = 255)
    public String title;

    /** Tracker key ('MIG-412'); NULL = queued, no ticket yet. */
    @Column(length = 64)
    public String key;

    @Column(nullable = false, length = 32)
    public Outcome outcome = Outcome.QUEUED;

    /** Sync note / failure reason display. */
    @Column(length = 1024)
    public String detail;

    /** '2h ago · 1 attempt' — attempt count display. */
    @Column(length = 128)
    public String whenText;
}
