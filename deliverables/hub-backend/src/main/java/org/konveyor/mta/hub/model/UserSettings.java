package org.konveyor.mta.hub.model;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Per-identity UI settings (#64, GET/PUT /user-settings): tour completion per
 * role, selected language, currency override. Keycloak-subject scoped — a
 * user can only ever read their own row; merge semantics on PUT.
 */
@Entity
@Table(name = "user_settings")
public class UserSettings extends PanacheEntityBase {

    @Id
    @Column(name = "subject", nullable = false, length = 255, updatable = false)
    public String subject;

    /** Free-form settings map (tourCompleted.role, language, currency, …). */
    @Column(columnDefinition = "text not null default '{}'")
    public String settings = "{}";

    public static UserSettings forSubject(String subject) {
        UserSettings s = findById(subject);
        if (s == null) {
            s = new UserSettings();
            s.subject = subject;
            s.persist();
        }
        return s;
    }
}
