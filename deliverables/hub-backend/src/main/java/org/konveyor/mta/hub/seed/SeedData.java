package org.konveyor.mta.hub.seed;

import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.transaction.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.konveyor.mta.hub.model.Agent;
import org.konveyor.mta.hub.model.AgentRun;
import org.konveyor.mta.hub.model.AgentRunEvent;
import org.konveyor.mta.hub.model.Archetype;
import org.konveyor.mta.hub.model.Analysis;
import org.konveyor.mta.hub.model.AnalysisProfile;
import org.konveyor.mta.hub.model.Application;
import org.konveyor.mta.hub.model.AuditEntry;
import org.konveyor.mta.hub.model.BusinessService;
import org.konveyor.mta.hub.model.Department;
import org.konveyor.mta.hub.model.Gateway;
import org.konveyor.mta.hub.model.Identity;
import org.konveyor.mta.hub.model.Incident;
import org.konveyor.mta.hub.model.JobFunction;
import org.konveyor.mta.hub.model.Organization;
import org.konveyor.mta.hub.model.Platform;
import org.konveyor.mta.hub.model.Setting;
import org.konveyor.mta.hub.model.Skill;
import org.konveyor.mta.hub.model.Stakeholder;
import org.konveyor.mta.hub.model.StakeholderGroup;
import org.konveyor.mta.hub.model.Tag;
import org.konveyor.mta.hub.model.TagType;
import org.konveyor.mta.hub.model.Target;
import org.konveyor.mta.hub.model.Task;
import org.konveyor.mta.hub.model.Team;
import org.konveyor.mta.hub.model.TrendPoint;
import org.konveyor.mta.hub.model.Wave;
import org.konveyor.mta.hub.model.WaveDependency;
import org.konveyor.mta.hub.model.WaveEvidence;
import org.konveyor.mta.hub.model.WaveTicket;
import org.konveyor.mta.hub.model.Workflow;
import org.konveyor.mta.hub.model.WorkflowRun;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.LinkedHashMap;

/**
 * Seeds the mock's dataset (deliverables/ui-mockup/index.html — northwind
 * financial / meridian health, 15 applications, the agentic registries,
 * wave content, tasks) on first boot — the dataset the console demo renders.
 * Runs only when the database is empty.
 * <p>
 * Referential gaps in the mock's sample data (schema.sql Findings 2–5) are
 * deliberately FIXED here rather than reproduced: every name reference
 * resolves (Records/Imaging business services, the migiq skill, the
 * unregistered workflow-run workflows, the eap8/jboss archetype tags), and
 * CREDS.usedBy is NOT seeded — the count derives from assignments (finding 1).
 */
@ApplicationScoped
public class SeedData {

    @ConfigProperty(name = "hub.seed.enabled", defaultValue = "true")
    boolean enabled;

    void onStart(@Observes StartupEvent ev) {
        if (enabled && Organization.count() == 0) {
            seed();
        }
    }

    @Transactional
    void seed() {
        // --- controls: job functions (the mock's 8) --------------------------
        JobFunction fnArchitect = fn("Architect");
        JobFunction fnDeveloper = fn("Developer");
        JobFunction fnPm = fn("Project manager");
        JobFunction fnSteward = fn("Steward");
        JobFunction fnAppOwner = fn("Application owner");
        JobFunction fnBa = fn("Business Analyst");
        JobFunction fnDba = fn("DBA");
        JobFunction fnPgm = fn("Program manager");

        // --- tags (the mock's 6 + the archetype tags the mock left dangling) --
        TagType runtime = tagType("Runtime", 1);
        TagType framework = tagType("Framework", 2);
        TagType build = tagType("Build", 3);
        TagType initiative = tagType("Initiative", 4);
        TagType workflow = tagType("Workflow", 5);
        Tag eap7Tag = tag("eap7", runtime);
        Tag quarkusTag = tag("quarkus", runtime);
        Tag eap8Tag = tag("eap8", runtime);
        Tag jbossTag = tag("jboss", runtime);
        Tag springTag = tag("spring", framework);
        Tag antTag = tag("ant", build);
        Tag cloudReady = tag("cloud-ready", initiative);
        Tag needsReview = tag("needs-review", workflow);

        // --- organizations / departments / teams (the mock's TENANCY) --------
        Organization nwf = org("Northwind Financial");
        Organization mrd = org("Meridian Health");

        Department retail = dept("Retail Banking", nwf);
        Department wealth = dept("Wealth Management", nwf);
        Department clinical = dept("Clinical Systems", mrd);

        Team claims = team("Claims", retail);
        Team payments = team("Payments", retail);
        Team customer = team("Customer digital", retail);
        Team portfolio = team("Portfolio", wealth);
        Team records = team("Records", clinical);
        Team imaging = team("Imaging", clinical);

        // --- stakeholders: every tenancy person + the hand-only DBA -----------
        Stakeholder mk = person("M. Keller", nwf, fnSteward, claims, portfolio);
        Stakeholder rf = person("R. Fuchs", nwf, fnBa, claims);
        Stakeholder ps = person("P. Schmidt", nwf, fnAppOwner, claims, customer, portfolio);
        Stakeholder jc = person("J. Cordes", nwf, fnArchitect, claims, portfolio, payments);
        Stakeholder tn = person("T. Novak", nwf, fnDeveloper, claims);
        Stakeholder aw = person("A. Weber", nwf, fnArchitect, payments);
        Stakeholder lf = person("L. Fischer", nwf, fnPm, payments, customer);
        Stakeholder db = person("D. Braun", nwf, fnDeveloper, payments);
        Stakeholder ko = person("K. Ott", nwf, fnDeveloper, payments);
        Stakeholder vb = person("V. Brandt", nwf, fnArchitect, customer);
        Stakeholder or_ = person("O. Ritter", nwf, fnPm, customer);
        Stakeholder ul = person("U. Lehmann", nwf, fnDeveloper, customer);
        Stakeholder rs = person("R. Schulz", nwf, fnArchitect, portfolio);
        Stakeholder bj = person("B. Jäger", nwf, fnArchitect, portfolio);
        Stakeholder kv = person("K. Vogel", nwf, fnPgm, portfolio);
        Stakeholder sk = person("S. Krüger", nwf, fnDeveloper, portfolio);
        Stakeholder el = person("E. Lang", mrd, fnArchitect, records);
        Stakeholder fr = person("F. Roth", mrd, fnPm, records);
        Stakeholder gh = person("G. Hall", mrd, fnDeveloper, records);
        Stakeholder mp = person("M. Pohl", mrd, fnDeveloper, records);
        Stakeholder hb = person("H. Berg", mrd, fnArchitect, imaging);
        Stakeholder is = person("I. Sommer", mrd, fnPm, imaging);
        Stakeholder nw = person("N. Weiss", mrd, fnDeveloper, imaging);
        person("D. Baumann", nwf, fnDba);   // hand-only DBA, no team

        // owner suggestions resolve through team rosters — M. Keller owns the
        // architect cohort; owners are set per application below (first
        // architect, else pm, else migrator — the mock's teamOwnerSuggest).

        // --- stakeholder groups (the mock's two, wave-addressed) --------------
        StakeholderGroup planners = persist(new StakeholderGroup(), g -> {
            g.name = "Wave planners";
            g.description = "own the wave gates and the assignment decisions (#46)";
            g.organization = nwf;
            g.members = new ArrayList<>(List.of(mk, jc));
        });
        StakeholderGroup appOwners = persist(new StakeholderGroup(), g -> {
            g.name = "Application owners";
            g.description = "sign off reviews for their business services (#45)";
            g.organization = nwf;
            g.members = new ArrayList<>(List.of(ps, jc));
        });

        // --- business services (the mock's 4 + the Records/Imaging the apps reference) ---
        BusinessService svcClaims = bsvc("Claims", "Claims processing and policy administration", mk, nwf);
        BusinessService svcCustomer = bsvc("Customer", "Customer self-service and onboarding", ps, nwf);
        BusinessService svcPricing = bsvc("Pricing", "Premium and rate calculations", lf, nwf);
        BusinessService svcBilling = bsvc("Billing", "Invoicing, dunning and payment runs", jc, nwf);
        BusinessService svcRecords = bsvc("Records", "Clinical records systems", el, mrd);
        BusinessService svcImaging = bsvc("Imaging", "Clinical imaging systems", hb, mrd);

        // --- identities: registry-level + the CREDS credentials ---------------
        Identity idSourceMaven = identity("source maven", Identity.Kind.USERNAME_PASSWORD, nwf, null, false, null,
                "Source control + Maven repository credentials");
        Identity idSource = identity("source", Identity.Kind.SOURCE_PRIVATE_KEY, nwf, null, false, null,
                "Source control only");
        Identity idMaven = identity("maven", Identity.Kind.USERNAME_PASSWORD, nwf, null, false, null,
                "Maven repository only");
        Identity idSourceProxy = identity("source proxy", Identity.Kind.SOURCE_PRIVATE_KEY, nwf, null, false, null,
                "Source control via proxy");
        Identity gitlabPat = identity("gitlab-pat", Identity.Kind.BEARER_TOKEN, nwf, claims, true,
                LocalDate.of(2027, 9, 12), "Source · PAT (https)");
        Identity svnKey = identity("svn-read-key", Identity.Kind.SOURCE_PRIVATE_KEY, nwf, claims, true,
                LocalDate.now().plusDays(6), "Source · SSH key");
        identity("nexus-mvn", Identity.Kind.USERNAME_PASSWORD, nwf, claims, false, null,
                "Maven · user/password");
        Identity wealthPat = identity("github-wealth-pat", Identity.Kind.BEARER_TOKEN, nwf, portfolio, true,
                LocalDate.of(2027, 1, 30), "Source · PAT (https)");
        Identity fhirToken = identity("epic-fhir-token", Identity.Kind.OAUTH2, mrd, records, true,
                LocalDate.of(2026, 12, 1), "Source · OAuth2");
        // last-used audit stamps (#42) — mirrors the mock's credential table
        gitlabPat.lastUsed = Instant.now().minus(14, ChronoUnit.MINUTES);
        svnKey.lastUsed = Instant.now().minus(3, ChronoUnit.DAYS);
        wealthPat.lastUsed = Instant.now().minus(1, ChronoUnit.HOURS);
        fhirToken.lastUsed = Instant.now().minus(6, ChronoUnit.HOURS);

        // --- registries: platforms + targets ----------------------------------
        Platform openshift = persist(new Platform(), p -> {
            p.name = "OpenShift";
            p.type = "kubernetes";
        });
        Platform azure = persist(new Platform(), p -> {
            p.name = "Azure App Service";
            p.type = "app service";
        });
        target("JBoss EAP 8", "Java, Maven");
        target("Quarkus 3", "Java, Maven");
        target("Spring Boot 3", "Java, Maven");
        target("camel:3", "Java, Camel");

        // --- archetypes (the mock's four) -------------------------------------
        Archetype eap8Arch = archetype("EAP8-archetype",
                "EAP 7 → 8 migration assessment", List.of(eap8Tag, jbossTag));
        Archetype springArch = archetype("Spring", "Spring Boot → Quarkus path", List.of(springTag));
        Archetype quarkusArch = archetype("Quarkus", "Quarkus cloud-native baseline", List.of(quarkusTag));
        Archetype legacyArch = archetype("Legacy", "Unclassified legacy inventory", List.of());

        // --- applications (the mock's 15) --------------------------------------
        // (name, team, bsvc, archetype, owner, tags, state, effort, risk, riskKind,
        //  platform, repoType, binary, assess, review, identity, credential, wave)
        Application paymentsApi = app("payments-api", claims, svcClaims, eap8Arch, mk,
                List.of(quarkusTag, cloudReady), Application.AnalysisState.CURRENT, 1180, "High",
                Application.RiskKind.INHERITED, openshift, Application.RepositoryType.GIT, false,
                "v3", Application.ReviewState.PENDING, idSourceMaven, gitlabPat, 3);
        Application invoicing = app("invoicing", claims, svcClaims, eap8Arch, mk,
                List.of(eap7Tag), Application.AnalysisState.IN_FLIGHT, 190, null,
                Application.RiskKind.UNASSESSED, openshift, Application.RepositoryType.GIT, false,
                null, Application.ReviewState.NOT_STARTED, idSource, svnKey, 3);
        Application claimsWeb = app("claims-web", claims, svcClaims, eap8Arch, mk,
                List.of(antTag, needsReview), Application.AnalysisState.STALE, 610, "Medium",
                Application.RiskKind.OWN, null, Application.RepositoryType.SUBVERSION, false,
                "v3", Application.ReviewState.PENDING, idSource, gitlabPat, 4);
        Application claimsBatch = app("claims-batch", claims, svcClaims, eap8Arch, mk,
                List.of(eap7Tag), Application.AnalysisState.CURRENT, 412, "Medium",
                Application.RiskKind.INHERITED, null, Application.RepositoryType.GIT, true,
                null, Application.ReviewState.NOT_STARTED, idSourceMaven, gitlabPat, 3);
        Application policyEngine = app("policy-engine", portfolio, svcPricing, quarkusArch, rs,
                List.of(quarkusTag, cloudReady), Application.AnalysisState.CURRENT, 34, "Low",
                Application.RiskKind.OWN, openshift, Application.RepositoryType.GIT, false,
                "v1", Application.ReviewState.APPROVED, idMaven, wealthPat, 4);
        Application ledgerSync = app("ledger-sync", claims, svcClaims, eap8Arch, mk,
                List.of(eap7Tag), Application.AnalysisState.IN_FLIGHT, 0, null,
                Application.RiskKind.UNASSESSED, null, Application.RepositoryType.GIT, false,
                null, Application.ReviewState.NOT_STARTED, idSource, svnKey, 3);
        Application custPortal = app("cust-portal", customer, svcCustomer, eap8Arch, vb,
                List.of(eap7Tag), Application.AnalysisState.STALE, 890, "High",
                Application.RiskKind.OWN, null, Application.RepositoryType.SUBVERSION, true,
                "v3", Application.ReviewState.PENDING, idSource, null, 4);
        Application riskScoring = app("risk-scoring", portfolio, svcPricing, springArch, rs,
                List.of(springTag), Application.AnalysisState.STALE, 45, "Medium",
                Application.RiskKind.INHERITED, azure, Application.RepositoryType.GIT, false,
                null, Application.ReviewState.NOT_STARTED, idSourceMaven, wealthPat, 4);
        Application notifRouter = app("notification-router", claims, svcClaims, quarkusArch, mk,
                List.of(quarkusTag, cloudReady), Application.AnalysisState.CURRENT, 21, "Low",
                Application.RiskKind.OWN, openshift, Application.RepositoryType.GIT, false,
                "v1", Application.ReviewState.APPROVED, idMaven, gitlabPat, 3);
        Application billingWorker = app("billing-worker", payments, svcBilling, springArch, aw,
                List.of(springTag), Application.AnalysisState.NOT_STARTED, 0, null,
                Application.RiskKind.NONE, null, Application.RepositoryType.GIT, false,
                null, Application.ReviewState.NOT_STARTED, idSourceProxy, null, 0);
        Application customerApi = app("customer-api", customer, svcCustomer, springArch, vb,
                List.of(springTag), Application.AnalysisState.NOT_STARTED, 0, null,
                Application.RiskKind.NONE, null, Application.RepositoryType.GIT, false,
                null, Application.ReviewState.NOT_STARTED, idSource, null, 0);
        Application docsPortal = app("docs-portal", customer, svcCustomer, legacyArch, vb,
                List.of(antTag), Application.AnalysisState.NOT_STARTED, 0, null,
                Application.RiskKind.NONE, null, Application.RepositoryType.SUBVERSION, false,
                null, Application.ReviewState.NOT_STARTED, idSource, null, 0);
        Application patientRecords = app("patient-records", records, svcRecords, springArch, el,
                List.of(springTag), Application.AnalysisState.NOT_STARTED, 0, null,
                Application.RiskKind.NONE, null, Application.RepositoryType.GIT, false,
                null, Application.ReviewState.NOT_STARTED, idSource, fhirToken, 0);
        Application labResults = app("lab-results", records, svcRecords, springArch, el,
                List.of(springTag), Application.AnalysisState.NOT_STARTED, 0, null,
                Application.RiskKind.NONE, null, Application.RepositoryType.GIT, false,
                null, Application.ReviewState.NOT_STARTED, idSource, null, 0);
        Application appointmentApi = app("appointment-api", imaging, svcImaging, quarkusArch, hb,
                List.of(quarkusTag), Application.AnalysisState.NOT_STARTED, 0, null,
                Application.RiskKind.NONE, null, Application.RepositoryType.GIT, false,
                null, Application.ReviewState.NOT_STARTED, idSource, null, 0);

        // --- waves (PM_WAVE_WINDOWS; membership carries the app) ---------------
        Wave wave1 = wave("Wave 1", 1, LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 15), nwf, List.of());
        Wave wave2 = wave("Wave 2", 2, LocalDate.of(2026, 9, 22), LocalDate.of(2026, 10, 3), nwf, List.of());
        Wave wave3 = wave("Wave 3", 3, LocalDate.of(2026, 10, 13), LocalDate.of(2026, 10, 24), nwf,
                List.of(paymentsApi, invoicing, claimsBatch, ledgerSync, notifRouter));
        Wave wave4 = wave("Wave 4", 4, LocalDate.of(2026, 11, 3), LocalDate.of(2026, 11, 21), nwf,
                List.of(claimsWeb, policyEngine, custPortal, riskScoring));

        // --- analyses (states the mock renders) --------------------------------
        AnalysisProfile profile = persist(new AnalysisProfile(), p -> {
            p.name = "EAP8 analysis profile";
            p.description = "EAP 7 → 8 migration assessment profile";
            p.sources = List.of("eap7", "weblogic");
            p.targets = List.of("eap8", "quarkus");
        });
        Analysis paymentsRun = analysis(paymentsApi, profile, Analysis.Status.SUCCEEDED, 2, 100);
        analysis(invoicing, profile, Analysis.Status.RUNNING, 0, 61);
        analysis(ledgerSync, profile, Analysis.Status.RUNNING, 0, 24);
        analysis(claimsWeb, profile, Analysis.Status.SUCCEEDED, 41, 100);
        analysis(claimsBatch, profile, Analysis.Status.SUCCEEDED, 5, 100);
        analysis(custPortal, profile, Analysis.Status.SUCCEEDED, 9, 100);
        analysis(riskScoring, profile, Analysis.Status.SUCCEEDED, 12, 100);
        analysis(notifRouter, profile, Analysis.Status.SUCCEEDED, 3, 100);
        analysis(policyEngine, profile, Analysis.Status.SUCCEEDED, 1, 100);

        // --- incidents: the mock's APP_INCIDENTS groups as real occurrences ----
        // (description, occurrences, effortTotal, state) — effort splits evenly.
        incidents(paymentsRun, paymentsApi, "javax → jakarta namespace", "eap7-05000", "namespace-remediation", 41, 8, Incident.TriageState.TRIAGE);
        incidents(paymentsRun, paymentsApi, "Kafka producer API change", "kafka-030", "kafka-producer-api", 12, 5, Incident.TriageState.TRIAGE);
        incidents(paymentsRun, paymentsApi, "Log4j 1.2.17 CVE remediation", "cve-2021-44228", "log4j-cve", 2, 3, Incident.TriageState.TRIAGE);
        analysis(invoicing, profile, Analysis.Status.SUCCEEDED, 30, 100); // prior run carrying the seen incidents
        incidents(priorAnalysis(invoicing), invoicing, "WebLogic JNDI lookup", "weblogic-05000", "jndi-lookup", 3, 5, Incident.TriageState.IN_PROGRESS);
        incidents(priorAnalysis(invoicing), invoicing, "jakarta → javax namespace", "eap7-05000", "namespace-backport", 4, 22, Incident.TriageState.TRIAGE);
        incidents(priorAnalysis(invoicing), invoicing, "Deprecated APIs with drop-in replacements", "eap7-02000", "deprecated-api", 10, 30, Incident.TriageState.TRIAGE);
        incidents(priorAnalysis(claimsWeb), claimsWeb, "Proprietary ORM hints", "orm-030", "proprietary-orm-hints", 6, 13, Incident.TriageState.ASSIGNED);
        incidents(priorAnalysis(claimsWeb), claimsWeb, "weblogic.xml deployment descriptors", "weblogic-05000", "weblogic-xml-descriptor", 11, 42, Incident.TriageState.TRIAGE);
        incidents(priorAnalysis(claimsWeb), claimsWeb, "EJB 2.x entity beans", "ejb-020", "ejb2-entity-beans", 8, 55, Incident.TriageState.TRIAGE);
        incidents(priorAnalysis(custPortal), custPortal, "AngularJS → React migration", "ui-040", "angularjs-to-react", 64, 210, Incident.TriageState.TRIAGE);
        incidents(priorAnalysis(custPortal), custPortal, "HTTP session externalization", "web-030", "session-externalization", 18, 95, Incident.TriageState.TRIAGE);
        incidents(priorAnalysis(claimsBatch), claimsBatch, "Batch job descriptors → Jakarta Batch", "batch-020", "batch-descriptors", 14, 60, Incident.TriageState.TRIAGE);
        incidents(priorAnalysis(policyEngine), policyEngine, "Drools rule-session API", "drools-010", "rule-session-api", 5, 12, Incident.TriageState.TRIAGE);
        incidents(priorAnalysis(notifRouter), notifRouter, "JMS destination lookup", "jms-020", "jms-destination-lookup", 4, 8, Incident.TriageState.TRIAGE);
        incidents(priorAnalysis(riskScoring), riskScoring, "Log4j 1.x CVE remediation", "cve-2019-17571", "log4j-cve", 2, 18, Incident.TriageState.TRIAGE);

        // --- wave content -------------------------------------------------------
        dependency(paymentsApi, claimsWeb, "consumed by");
        evidence(paymentsApi, "2 DBs · 3 APIs · 1 queue", 6, 6, 0);
        evidence(invoicing, "1 DB · 2 APIs", 3, 1, 2);
        evidence(claimsBatch, "1 DB · 1 queue", 0, 0, 0);
        ticket(invoicing, "Migrate JNDI lookups", "MIG-412", WaveTicket.Outcome.SYNCED,
                "comment posted", "2h ago · 1 attempt");
        ticket(paymentsApi, "Namespace migration", "MIG-418", WaveTicket.Outcome.SYNCED,
                "status → In Progress", "2h ago · 1 attempt");
        ticket(claimsWeb, "ORM hint replacement", "MIG-425", WaveTicket.Outcome.FAILED,
                "410 Gone — ticket moved projects; re-link to restore sync", "38m ago · 3 attempts");
        ticket(riskScoring, "Log4j remediation", null, WaveTicket.Outcome.QUEUED,
                "no ticket yet", null);

        // --- task manager (the mock's #taskBody rows) ---------------------------
        // mock's 'Postponed' renders as QUEUED with a capacity wait label.
        task(Task.Kind.ANALYSIS, Task.State.FAILED, claimsBatch, "2h 41m",
                "mkdir /cache/m2: permission denied → check PVC RWX; retry · logs (#3)", "PVC_RWX_DENIED");
        task(Task.Kind.ANALYSIS, Task.State.QUEUED, claimsWeb, "1h 12m",
                "blocked by quota concurrent-analyses (8/8) → raise in CR (#38)", null);
        task(Task.Kind.ANALYSIS, Task.State.QUEUED, custPortal, "26m",
                "position 3 of 34 — aging toward the 2h SLA (#30)", null);
        task(Task.Kind.ANALYSIS, Task.State.QUEUED, riskScoring, "18m",
                "queued behind the same quota as #493 — one raise unblocks both (#38)", null);
        task(Task.Kind.ANALYSIS, Task.State.RUNNING, invoicing, "61m",
                "61% — the same run the Applications row shows (#33)", null);
        task(Task.Kind.ANALYSIS, Task.State.QUEUED, invoicing, "38m",
                "waiting for capacity — dependency rule: Wave 3 before 4 (#36)", null);
        task(Task.Kind.ANALYSIS, Task.State.QUEUED, ledgerSync, "5m",
                "waiting for a worker slot — next free worker picks it up", null);

        // --- agentic layer (WP1) ------------------------------------------------
        Gateway gw1 = gateway("llm-gateway-1", "granite-3.3-70b", "https://maas.apps.example.com/v1",
                "128k", "Hub token exchange", true, "standard", "reachable (HTTP 200)", 2, 14, "41.2M", "2.0971");
        Gateway gw2 = gateway("llm-gateway-2", "frontier-70b", "https://maas.apps.example.com/v2",
                "200k", "Hub token exchange", true, "premium", "reachable (HTTP 200)", 2, 2, "9.8M", "5.5204");

        Skill sMigPlan = skill("mig-plan", "Migration planner", "Produces a staged migration plan from analysis results", Skill.Type.BUILTIN, "shipped", "planning", 12);
        Skill sMigExecute = skill("mig-execute", "Quarkus rewriter", "Applies the planned rewrites file-by-file with compile gates", Skill.Type.BUILTIN, "shipped", "execute", 12);
        Skill sMigVerify = skill("mig-verify", "Migration verifier", "Runs the verification charter against the rewritten workspace", Skill.Type.BUILTIN, "shipped", "verify", 12);
        Skill sMigContainerize = skill("mig-containerize", "Containerizer", "Containerizes the rewritten workspace for the target platform", Skill.Type.BUILTIN, "shipped", "execute", 12);
        Skill sMigDeploy = skill("mig-deploy", "Deployer", "Deploys the containerized result to the target cluster", Skill.Type.BUILTIN, "shipped", "execute", 12);
        Skill sMigPromptBuilder = skill("mig-prompt-builder", "Prompt builder", "Assembles stage prompts from the versioned template set", Skill.Type.BUILTIN, "shipped", "planning", 12);
        Skill sMigiq = skill("migiq", "Migration IQ", "Retrieval over the migration knowledge base", Skill.Type.BUILTIN, "shipped", "planning", 12);
        Skill sCitrusVerify = skill("citrus-test-verify", "Citrus verifier", "Executes Citrus verification suites", Skill.Type.BUILTIN, "shipped", "verify", 12);
        Skill sCitrusAuthor = skill("citrus-test-author", "Citrus test author", "Authors/extends Citrus verification suites from the test charter", Skill.Type.CUSTOM, "org registry", "verify, authoring", 20);
        Skill sEjbRest = skill("jboss-ejb-to-rest-author", "EJB → REST author", "EJB/JNDI-to-REST rewrite patterns for the EJB cohort", Skill.Type.CUSTOM, "org registry", "execute, eap", 20);
        skill("rgctl-review", "Remediation reviewer", "Reviews remediation proposals against the repo policy", Skill.Type.THIRD_PARTY, "curated registry", "governance", 0);

        Agent agAnalyzer = agent("analyzer-jboss-eap-7-to-8", "quay.io/mta/analyzer@sha256:8a1f…", gw1, List.of(sMigPlan, sMigiq), 4, true, 3);
        Agent agPlanner = agent("planner-spring-boot-to-quarkus", "quay.io/mta/planner@sha256:9f2c…", gw1, List.of(sMigPlan, sMigPromptBuilder), 6, true, 3);
        Agent agRewriter = agent("rewriter-spring-boot-to-quarkus", "quay.io/mta/rewriter@sha256:c41d…", gw2, List.of(sMigExecute, sMigContainerize), 8, true, 3);
        Agent agVerifier = agent("verifier-citrus", "quay.io/mta/verifier@sha256:77b0…", gw1, List.of(sCitrusVerify, sMigVerify), 3, true, 12);
        Agent agRemediation = agent("remediation-internal", "registry.example.com/platform/remediation@sha256:5e9a…", gw1, List.of(sCitrusVerify, sMigDeploy), 5, false, 0);

        Workflow wfSbq = workflow("spring-boot-to-quarkus", 3, "spring-boot-to-quarkus", true, 12);
        Workflow wfEjb = workflow("jboss-ejb-to-rest", 3, "jboss-eap-to-eap", true, 20);
        Workflow wfCitrus = workflow("citrus-verification", 2, null, false, 2);
        // the mock's workflow runs reference these without registering them — fixed here
        Workflow wfClaims = workflow("claims-batch-rewrite", 2, null, true, 2);
        Workflow wfQuarkusRw = workflow("quarkus-rewrite", 2, null, true, 2);
        Workflow wfNamespace = workflow("namespace-migration", 2, null, true, 2);
        Workflow wfSmoke = workflow("smoke-verification", 1, null, true, 2);

        WorkflowRun wr14 = wfrun("WR-14", wfSbq, paymentsApi, "execute", 3, WorkflowRun.State.RUNNING, "41m so far", false, 2);
        WorkflowRun wr8 = wfrun("WR-8", wfSbq, paymentsApi, "verify", 3, WorkflowRun.State.SUCCEEDED, "1h 12m", true, 2);
        WorkflowRun wr15 = wfrun("WR-15", wfClaims, claimsBatch, "execute", 2, WorkflowRun.State.RUNNING, "18m so far", false, 0);
        WorkflowRun wr13 = wfrun("WR-13", wfEjb, invoicing, "verify", 3, WorkflowRun.State.SUCCEEDED, "55m", false, 1);
        wfrun("WR-12", wfCitrus, claimsBatch, "verify", 2, WorkflowRun.State.FAILED, "6m", false, 1);
        wfrun("WR-11", wfQuarkusRw, invoicing, "execute", 2, WorkflowRun.State.SUCCEEDED, "1h 2m", false, 0);
        wfrun("WR-10", wfNamespace, riskScoring, "execute", 2, WorkflowRun.State.FAILED, "4m", false, 2);
        wfrun("WR-9", wfSmoke, ledgerSync, "verify", 1, WorkflowRun.State.SUCCEEDED, "9m", false, 3);

        // agent runs (one per stage) with their event logs
        agentRun(27, "execute — spring-boot-to-quarkus", agRewriter, paymentsApi, wr14, "execute",
                AgentRun.State.RUNNING, null, "29m so far", gw1, "granite-3.3-70b", "176,300", "161k/15k", "$4.70", 23, 38412, 128000,
                "quay.io/…/rewrite-agent@sha256:c41d…", 0, List.of(
                new String[]{"+00:00", "stage started — rewriter-spring-boot-to-quarkus · gateway llm-gateway-1 (granite-3.3-70b)"},
                new String[]{"+01:12", "handoff accepted from plan stage #26 — 6 planned steps"},
                new String[]{"+04:38", "tool: git checkout -b mta/quarkus-rewrite (workspace-scoped, OpenShell envelope)"},
                new String[]{"+11:20", "model call — 8,412 tokens (prompt 7,930 / completion 482)"},
                new String[]{"+18:02", "sandbox: file write outside workspace — denied (OCSF 4001, policy agent-policy-v3)"},
                new String[]{"+24:15", "checkpoint — patch set 3/6 committed to the workspace branch (git is the persistence layer)"},
                new String[]{"+28:47", "model call — 12,050 tokens (prompt 11,380 / completion 670)"}));
        agentRun(26, "plan — spring-boot-to-quarkus", agPlanner, paymentsApi, wr14, "plan",
                AgentRun.State.SUCCEEDED, null, "12m", gw1, "granite-3.3-70b", "58,410", "52.1k/6.3k", "$1.60", 11, 42355, 128000,
                "quay.io/…/plan-agent@sha256:9f2c…", 0, List.of(
                new String[]{"+00:00", "stage started — planner-spring-boot-to-quarkus · gateway llm-gateway-1 (granite-3.3-70b)"},
                new String[]{"+03:22", "analysis summary ingested — payments-api (7 incident groups, 2 archetypes)"},
                new String[]{"+08:40", "model call — 6,240 tokens (prompt 5,780 / completion 460)"},
                new String[]{"+11:36", "stage SUCCEEDED — 6-step plan written to docs/plan.md (handoff to execute)"}));
        agentRun(25, "verify — spring-boot-to-quarkus", agVerifier, paymentsApi, wr8, "verify",
                AgentRun.State.SUCCEEDED, null, "14m", gw1, "granite-3.3-70b", "73,750", "64.6k/9.2k", "$1.30", 12, 51208, 128000,
                "quay.io/…/verify-agent@sha256:77b0…", 2, List.of(
                new String[]{"+00:00", "stage started — verifier-citrus · gateway llm-gateway-1 (granite-3.3-70b)"},
                new String[]{"+02:10", "suite run 1 — payments-contract green"},
                new String[]{"+05:45", "suite run 2 — kafka-consumer re-run clean"},
                new String[]{"+13:22", "stage SUCCEEDED — verification suite green (2/2)"}));
        agentRun(24, "execute — spring-boot-to-quarkus", agRewriter, paymentsApi, wr8, "execute",
                AgentRun.State.SUCCEEDED, null, "46m", gw1, "granite-3.3-70b", "231,524", "210.4k/21.1k", "$8.20", 31, 96412, 128000,
                "quay.io/…/rewrite-agent@sha256:c41d…", 2, List.of(
                new String[]{"+00:00", "stage started — rewriter-spring-boot-to-quarkus · gateway llm-gateway-1 (granite-3.3-70b)"},
                new String[]{"+09:12", "patch set 1/6 applied — payments-api/src/main/java/…/PaymentMapper.java"},
                new String[]{"+21:44", "model call — 31,050 tokens · checkpoint committed"},
                new String[]{"+45:30", "stage SUCCEEDED — 6/6 planned steps complete, proposal written to the workspace branch"}));
        agentRun(23, "plan — spring-boot-to-quarkus", agPlanner, paymentsApi, wr8, "plan",
                AgentRun.State.SUCCEEDED, null, "12m", gw1, "granite-3.3-70b", "107,586", "96.2k/11.4k", "$2.90", 9, 40979, 128000,
                "quay.io/…/plan-agent@sha256:9f2c…", 2, List.of(
                new String[]{"+00:00", "stage started — planner-spring-boot-to-quarkus · gateway llm-gateway-1 (granite-3.3-70b)"},
                new String[]{"+04:05", "model call — 9,110 tokens (prompt 8,420 / completion 690)"},
                new String[]{"+11:29", "stage SUCCEEDED — 6-step plan committed to docs/plan.md"}));
        agentRun(19, "execute — quarkus rewrite", agRewriter, invoicing, null, "execute",
                AgentRun.State.SUCCEEDED, null, "58m", gw2, "frontier-70b", "1,204,332", "1.10M/99k", "$31.90", 44, 91640, 200000,
                "quay.io/…/rewrite-agent@sha256:c41d…", 5, List.of(
                new String[]{"+00:00", "stage started — rewriter-spring-boot-to-quarkus · gateway llm-gateway-2 (frontier-70b)"},
                new String[]{"+12:30", "model call — 22,410 tokens · checkpoint committed"},
                new String[]{"+31:15", "sandbox: file write outside workspace — denied (OCSF 4001, policy agent-policy-v3)"},
                new String[]{"+40:02", "patch set 5/6 applied"},
                new String[]{"+57:20", "stage SUCCEEDED — proposal written to the workspace branch"}));
        agentRun(18, "verify — citrus suite", agVerifier, claimsBatch, null, "verify",
                AgentRun.State.FAILED, "suite exited 1 — kafka-contract step red after 3 retries", "6m", gw1, "granite-3.3-70b", "18,404", "18.1k/0.3k", "$0.52", 5, 8910, 128000,
                "quay.io/…/verify-agent@sha256:77b0…", 1, List.of(
                new String[]{"+00:00", "stage started — verifier-citrus · gateway llm-gateway-1 (granite-3.3-70b)"},
                new String[]{"+01:30", "suite run 1 — payments-contract green, kafka-contract RED (assert on consumer-group offset)"},
                new String[]{"+02:50", "retry 1 — kafka-contract red (same assertion)"},
                new String[]{"+04:10", "retry 2 — red"},
                new String[]{"+05:30", "retry 3 — red — retries exhausted"},
                new String[]{"+06:00", "stage FAILED — suite exited 1 — kafka-contract step red after 3 retries"}));
        agentRun(17, "plan — EJB to REST", agPlanner, invoicing, null, "plan",
                AgentRun.State.SUCCEEDED, null, "24m", gw1, "granite-3.3-70b", "96,120", "88k/8k", "$3.10", 12, 24890, 128000,
                "quay.io/…/plan-agent@sha256:9f2c…", 1, List.of(
                new String[]{"+00:00", "stage started — planner-spring-boot-to-quarkus · gateway llm-gateway-1 (granite-3.3-70b)"},
                new String[]{"+06:44", "model call — 8,930 tokens (prompt 8,210 / completion 720)"},
                new String[]{"+23:12", "stage SUCCEEDED — EJB→REST plan committed (handoff to execute stage #16)"}));
        agentRun(16, "execute — EJB to REST", agRewriter, invoicing, null, "execute",
                AgentRun.State.SUCCEEDED, null, "31m", gw1, "granite-3.3-70b", "1,048,550", "960k/88k", "$27.80", 38, 83402, 128000,
                "quay.io/…/rewrite-agent@sha256:c41d…", 1, List.of(
                new String[]{"+00:00", "stage started — rewriter-spring-boot-to-quarkus · gateway llm-gateway-1 (granite-3.3-70b)"},
                new String[]{"+01:05", "handoff accepted from plan stage #17"},
                new String[]{"+15:40", "model call — 18,220 tokens · checkpoint committed"},
                new String[]{"+30:15", "stage SUCCEEDED — 6/6 steps complete, proposal on the workspace branch"}));
        agentRun(15, "execute — namespace migration", agRewriter, riskScoring, null, "execute",
                AgentRun.State.FAILED, "model 429 after quota exhaustion on llm-gateway-2", "4m", gw2, "frontier-70b", "22,010", "21.9k/0.1k", "$1.05", 3, 12704, 200000,
                "quay.io/…/rewrite-agent@sha256:c41d…", 2, List.of(
                new String[]{"+00:00", "stage started — rewriter-spring-boot-to-quarkus · gateway llm-gateway-2 (frontier-70b)"},
                new String[]{"+01:12", "model call — 6,180 tokens (prompt 5,900 / completion 280)"},
                new String[]{"+02:40", "model call — HTTP 429 from llm-gateway-2 — retrying (backoff 30s)"},
                new String[]{"+03:30", "model call — HTTP 429 again — quota exhausted on frontier-70b"},
                new String[]{"+04:00", "stage FAILED — model 429 after quota exhaustion on llm-gateway-2"}));
        agentRun(14, "verify — smoke suite", agVerifier, ledgerSync, null, "verify",
                AgentRun.State.SUCCEEDED, null, "9m", gw1, "granite-3.3-70b", "31,880", "30.2k/1.7k", "$0.90", 4, 9612, 128000,
                "quay.io/…/verify-agent@sha256:77b0…", 3, List.of(
                new String[]{"+00:00", "stage started — verifier-citrus · gateway llm-gateway-1 (granite-3.3-70b)"},
                new String[]{"+03:15", "suite run 1 — smoke suite green"},
                new String[]{"+08:30", "stage SUCCEEDED — smoke verification clean"}));
        agentRun(22, "execute — claims-batch rewrite", agRewriter, claimsBatch, null, "execute",
                AgentRun.State.RUNNING, null, "18m so far", gw1, "granite-3.3-70b", "412,050", "380k/32k", "$9.40", 11, 21688, 128000,
                "quay.io/…/rewriter-agent@sha256:c41d…", 0, List.of(
                new String[]{"+00:00", "stage started — rewriter-spring-boot-to-quarkus · gateway llm-gateway-1 (granite-3.3-70b)"},
                new String[]{"+02:05", "handoff — execute stage of WR-15 (claims-batch-rewrite)"},
                new String[]{"+06:40", "tool: git checkout -b mta/claims-rewrite (workspace-scoped, OpenShell envelope)"},
                new String[]{"+09:55", "model call — 9,860 tokens (prompt 9,100 / completion 760)"},
                new String[]{"+14:20", "checkpoint — patch set 1/4 committed to the workspace branch"},
                new String[]{"+17:38", "model call — 11,420 tokens (prompt 10,660 / completion 760)"}));

        // --- portfolio trend (MOCK_RUN_TREND) ------------------------------------
        trend(LocalDate.of(2026, 9, 8), 142, 68);
        trend(LocalDate.of(2026, 9, 22), 128, 71);
        trend(LocalDate.of(2026, 10, 6), 120, 74);
        trend(LocalDate.of(2026, 10, 20), 98, 78);
        trend(LocalDate.of(2026, 11, 3), 84, 82);

        // --- settings manifest (#33 item 11) --------------------------------------
        setting("hub.analysis.timeout", "duration", "30m", "2.0", "Per-run analyzer timeout; longer runs fail with ANALYZER_TIMEOUT");
        setting("hub.task.concurrency", "integer", "8", "2.0", "Maximum concurrent analysis tasks per node (the #38 quota)");
        setting("hub.audit.retention", "duration", "720h", "2.1", "Audit trail retention before archival (#42)");
        setting("hub.api.contract.version", "string", "2.1.0", "2.1", "Contract version reported by /openapi3.json (#48)");
        setting("hub.agentic.sandbox.policy", "string", "agent-policy-v3", "2.1", "Sandbox policy envelope enforced at agent tool-call boundaries (#20)");

        persist(new AuditEntry(), e -> {
            e.actor = "seed";
            e.action = "seed";
            e.resourceType = "System";
            e.resourceId = "bootstrap";
            e.organization = nwf;
            e.detail = "Seeded the console demo dataset (two organizations, 15 applications)";
        });

        // keep the compiler honest about group references
        assert planners != null && appOwners != null && wave1 != null && wave2 != null;
    }

    // =========================================================== helpers ====

    private JobFunction fn(String name) {
        return persist(new JobFunction(), jf -> jf.name = name);
    }

    private TagType tagType(String name, int rank) {
        return persist(new TagType(), t -> {
            t.name = name;
            t.color = "#876fd4";
            t.rank = rank;
        });
    }

    private Tag tag(String name, TagType type) {
        return persist(new Tag(), t -> {
            t.name = name;
            t.tagType = type;
        });
    }

    private Organization org(String name) {
        return persist(new Organization(), o -> {
            o.name = name;
            o.description = "Console demo organization";
        });
    }

    private Department dept(String name, Organization org) {
        return persist(new Department(), d -> {
            d.name = name;
            d.organization = org;
        });
    }

    private Team team(String name, Department dept) {
        return persist(new Team(), t -> {
            t.name = name;
            t.department = dept;
        });
    }

    /** Roster person: job function from the team role; team staffing on the owning side. */
    private Stakeholder person(String name, Organization org, JobFunction fn, Team... teams) {
        Stakeholder s = new Stakeholder();
        s.name = name;
        s.email = name.toLowerCase().replace(" ", ".").replace("ä", "a").replace("ö", "o")
                .replace("ü", "u").replace("é", "e") + "@"
                + (org.name.equals("Northwind Financial") ? "northwind-financial.com" : "meridian-health.com");
        s.organization = org;
        s.jobFunction = fn;
        s.teams = new ArrayList<>(List.of(teams));
        s.persist();
        return s;
    }

    private BusinessService bsvc(String name, String description, Stakeholder owner, Organization org) {
        return persist(new BusinessService(), b -> {
            b.name = name;
            b.description = description;
            b.owner = owner;
            b.organization = org;
        });
    }

    private Identity identity(String name, Identity.Kind kind, Organization org, Team team,
                              boolean verified, LocalDate expiresOn, String description) {
        return persist(new Identity(), i -> {
            i.name = name;
            i.kind = kind;
            i.organization = org;
            i.team = team;
            i.verified = verified;
            i.expiresOn = expiresOn;
            i.description = description;
            if (kind == Identity.Kind.USERNAME_PASSWORD) {
                i.user = name.replace(" ", "-") + "-svc";
                i.password = "seed-only-not-a-real-secret";
            } else if (kind == Identity.Kind.SOURCE_PRIVATE_KEY) {
                i.key = "seed-only-not-a-real-key";
            } else {
                i.key = "seed-only-not-a-real-token";
            }
        });
    }

    private Archetype archetype(String name, String description, List<Tag> tags) {
        return persist(new Archetype(), a -> {
            a.name = name;
            a.description = description;
            a.tags = new ArrayList<>(tags);
        });
    }

    private Application app(String name, Team team, BusinessService bsvc, Archetype archetype,
                            Stakeholder owner, List<Tag> tags, Application.AnalysisState state,
                            int effort, String risk, Application.RiskKind riskKind,
                            Platform platform, Application.RepositoryType repoType, boolean binary,
                            String assessVersion, Application.ReviewState review,
                            Identity identity, Identity credential, int waveNumber) {
        Application a = new Application();
        a.name = name;
        a.description = "Seeded console demo application";
        a.repositoryUrl = "https://repo.example.com/" + team.name.toLowerCase().replace(' ', '-') + "/" + name;
        a.team = team;
        a.businessService = bsvc;
        a.owner = owner;
        a.archetype = archetype;
        a.tags = new ArrayList<>(tags);
        a.analysisState = state;
        a.effort = effort;
        a.risk = risk;
        a.riskKind = riskKind;
        a.platform = platform;
        a.repositoryType = repoType;
        a.binaryArtifact = binary;
        a.assessmentVersion = assessVersion;
        a.reviewState = review;
        a.identity = identity;
        a.credential = credential;
        a.persist();
        if (waveNumber > 0) {
            waveApps.computeIfAbsent(waveNumber, k -> new ArrayList<>()).add(a);
        }
        return a;
    }

    private final Map<Integer, List<Application>> waveApps = new LinkedHashMap<>();

    private Wave wave(String name, int position, LocalDate start, LocalDate end,
                      Organization org, List<Application> members) {
        return persist(new Wave(), w -> {
            w.name = name;
            w.position = position;
            w.startDate = start;
            w.endDate = end;
            w.organization = org;
            w.members = new ArrayList<>(members.isEmpty() && waveApps.containsKey(position)
                    ? waveApps.get(position) : members);
        });
    }

    private Analysis analysis(Application app, AnalysisProfile profile, Analysis.Status status,
                              int daysAgo, int progress) {
        Analysis a = new Analysis();
        a.application = app;
        a.profile = profile;
        a.status = status;
        a.startedAt = Instant.now().minus(Duration_days(daysAgo)).minusSeconds(600);
        a.completedAt = status == Analysis.Status.RUNNING ? null
                : Instant.now().minus(Duration_days(daysAgo));
        a.triggeredBy = "seed";
        a.contentFingerprint = "seed-" + app.name + "-" + daysAgo + "d";
        a.progress = progress;
        a.persist();
        prior.put(app, a);
        return a;
    }

    private final Map<Application, Analysis> prior = new LinkedHashMap<>();

    private Analysis priorAnalysis(Application app) {
        return prior.get(app);
    }

    private static java.time.Duration Duration_days(int days) {
        return java.time.Duration.ofDays(days);
    }

    /** Seeds one incident-group's occurrences as real row-level incidents. */
    private void incidents(Analysis analysis, Application app, String description, String ruleset,
                           String rule, int occurrences, int effortTotal, Incident.TriageState state) {
        String triageComment = null;
        if (state == Incident.TriageState.IN_PROGRESS) {
            triageComment = "synced to MIG-412 (#37)";
        } else if (state == Incident.TriageState.ASSIGNED) {
            triageComment = "assigned to the ORM cohort";
        }
        int effortEach = Math.max(1, effortTotal / occurrences);
        String base = description.replaceAll("[^A-Za-z0-9]+", "-");
        for (int n = 1; n <= occurrences; n++) {
            String file = "src/main/java/" + app.name.replace('-', '/') + "/" + base + "/" + base + n + ".java";
            int line = 10 + n * 7;
            Incident i = new Incident();
            i.incidentKey = app.name + ":" + ruleset + "." + rule + "@" + file + ":" + line;
            i.application = app;
            i.analysis = analysis;
            i.ruleset = ruleset;
            i.rule = rule;
            i.file = file;
            i.line = line;
            i.effort = effortEach;
            i.state = state;
            i.triageComment = triageComment;
            i.triageActor = triageComment == null ? null : "seed";
            i.triagedAt = triageComment == null ? null : Instant.now();
            i.persist();
        }
    }

    private void dependency(Application from, Application to, String verb) {
        persist(new WaveDependency(), d -> {
            d.fromApp = from;
            d.toApp = to;
            d.verb = verb;
        });
    }

    private void evidence(Application app, String coverage, int total, int run, int red) {
        persist(new WaveEvidence(), e -> {
            e.application = app;
            e.coverage = coverage;
            e.total = total;
            e.run = run;
            e.red = red;
        });
    }

    private void ticket(Application app, String title, String key, WaveTicket.Outcome outcome,
                        String detail, String whenText) {
        persist(new WaveTicket(), t -> {
            t.application = app;
            t.title = title;
            t.key = key;
            t.outcome = outcome;
            t.detail = detail;
            t.whenText = whenText;
        });
    }

    private void task(Task.Kind kind, Task.State state, Application app, String ageDisplay,
                      String detail, String errorCode) {
        persist(new Task(), t -> {
            t.kind = kind;
            t.state = state;
            t.application = app;
            t.label = "Analysis of " + app.name;
            t.errorMessage = detail;
            t.errorCode = errorCode;
            if (detail != null && detail.contains("quota")) {
                t.quota = "concurrent-analyses (8/8)";
            }
            t.triggeredBy = "seed";
        });
    }

    private Gateway gateway(String name, String model, String endpoint, String ctx, String cred,
                            boolean ready, String tier, String health, int healthHoursAgo,
                            int runs30d, String tokens30d, String rate) {
        return persist(new Gateway(), g -> {
            g.name = name;
            g.model = model;
            g.endpoint = endpoint;
            g.ctx = ctx;
            g.cred = cred;
            g.ready = ready;
            g.tier = tier;
            g.health = health;
            g.healthAt = Instant.now().minusSeconds(healthHoursAgo * 3600L);
            g.runs30d = runs30d;
            g.tokens30d = tokens30d;
            g.rate = rate;
        });
    }

    private Skill skill(String name, String display, String description, Skill.Type type,
                        String source, String tags, int daysOld) {
        return persist(new Skill(), s -> {
            s.name = name;
            s.display = display;
            s.description = description;
            s.type = type;
            s.source = source;
            s.ready = !name.equals("rgctl-review");
            s.tags = tags;
            s.createdAt = Instant.now().minus(Duration_days(daysOld));
            s.updatedAt = s.createdAt;
        });
    }

    private Agent agent(String name, String image, Gateway gw, List<Skill> skills, int params,
                        boolean ready, int daysOld) {
        return persist(new Agent(), a -> {
            a.name = name;
            a.image = image;
            a.gateway = gw;
            a.skills = new ArrayList<>(skills);
            a.params = params;
            a.ready = ready;
            if (name.equals("rewriter-spring-boot-to-quarkus")) {
                a.tierPin = "premium-pinned";
            }
            a.createdAt = Instant.now().minus(Duration_days(daysOld));
            a.updatedAt = a.createdAt;
        });
    }

    private Workflow workflow(String name, int stages, String guide, boolean ready, int daysOld) {
        return persist(new Workflow(), w -> {
            w.name = name;
            w.stages = stages;
            w.guide = guide;
            w.ready = ready;
            w.createdAt = Instant.now().minus(Duration_days(daysOld));
            w.updatedAt = w.createdAt;
        });
    }

    private WorkflowRun wfrun(String name, Workflow wf, Application app, String phase, int stages,
                              WorkflowRun.State state, String duration, boolean canonical, int daysOld) {
        return persist(new WorkflowRun(), r -> {
            r.name = name;
            r.workflow = wf;
            r.application = app;
            r.phase = phase;
            r.stages = stages;
            r.state = state;
            r.duration = duration;
            r.canonical = canonical;
            r.createdAt = Instant.now().minus(Duration_days(daysOld)).minusSeconds(3600);
            r.updatedAt = r.createdAt;
        });
    }

    private AgentRun agentRun(int num, String name, Agent agent, Application app, WorkflowRun wr,
                              String phase, AgentRun.State state, String reason, String duration,
                              Gateway gw, String model, String tokens, String tokDetail, String cost,
                              Integer turns, Integer ctxCurrent, Integer ctxWindow,
                              String image, int daysOld, List<String[]> events) {
        AgentRun r = new AgentRun();
        r.name = name;
        r.agent = agent;
        r.application = app;
        if (wr == null) {
            // runs sampled without their workflow-run still attach to the app's most recent run
            wr = WorkflowRun.find("application = ?1 order by createdAt desc", app).firstResult();
        }
        r.workflowRun = wr;
        r.phase = phase;
        r.state = state;
        r.reason = reason;
        r.duration = duration;
        r.gateway = gw;
        r.model = model;
        r.tokens = tokens;
        r.tokDetail = tokDetail;
        r.cost = cost;
        r.turns = turns;
        r.ctxCurrent = ctxCurrent;
        r.ctxWindow = ctxWindow;
        r.image = image;
        r.createdAt = Instant.now().minus(Duration_days(daysOld)).minusSeconds(num * 60L);
        r.updatedAt = r.createdAt;
        r.persist();
        for (String[] e : events) {
            persist(new AgentRunEvent(), ev -> {
                ev.agentRun = r;
                ev.offsetText = e[0];
                ev.message = e[1];
            });
        }
        return r;
    }


    private void trend(LocalDate date, int open, int pass) {
        persist(new TrendPoint(), t -> {
            t.date = date;
            t.open = open;
            t.pass = pass;
        });
    }

    private void target(String name, String langs) {
        persist(new Target(), t -> {
            t.name = name;
            t.langs = langs;
        });
    }

    private void setting(String key, String type, String defaultValue, String since, String effect) {
        persist(new Setting(), s -> {
            s.key = key;
            s.type = type;
            s.defaultValue = defaultValue;
            s.value = defaultValue;
            s.since = since;
            s.effect = effect;
        });
    }

    private <T extends io.quarkus.hibernate.orm.panache.PanacheEntityBase> T persist(T entity, java.util.function.Consumer<T> init) {
        init.accept(entity);
        entity.persist();
        return entity;
    }
}
