-- ============================================================================
-- schema.sql — schema of record for the hub-backend implementation
--
-- Provenance (refreshed 2026-11-16):
--   Part 1 is the Hibernate-generated schema of the 35 JPA entities in
--   src/main/java/org/konveyor/mta/hub/model/ (45 tables including the 10
--   @ManyToMany join tables), exported verbatim via pg_dump from the
--   DevServices PostgreSQL while running `mvn quarkus:dev`.
--   Refresh history: the first cut (2026-11-16) covered the 22 base entities
--   of the console contract; this refresh adds the mock-model entities that
--   have since landed — platform, target, gateway, skill, agent (+agent_skills
--   join), workflow, workflow_run, agent_run (+agent_run_event),
--   wave_dependency, wave_evidence, wave_ticket, trend_point — plus the
--   identity extension (expireson/verified/description) and the application
--   extension (riskkind, platform/identity/credential FKs, repositorytype,
--   binaryartifact, assessmentversion, reviewstate, progress on analysis).
--   Tables PROMOTED from the former Part 2 into Part 1 (now entity-backed):
--   gateway, skill, agent, agent_skill, workflow, workflow_run, agent_run,
--   agent_run_event, wave_dependency, wave_evidence, wave_ticket;
--   trend_point supersedes the designed run_trend; identity's new
--   expireson/verified/description columns supersede the designed credential.
--   Part 2 keeps only what NO entity models yet: run comparison
--   (analysis_run, run_diff) and stakeholder-group wave addressing.
--
-- Status / usage:
--   * At RUNTIME, Hibernate schema generation is the source of truth
--     (dev: `update`, test: `drop-and-create`, see application.properties).
--     This file is the reviewed, checked-in baseline: the reference for
--     reviews, migrations, and API-contract work — not an init script.
--     Do NOT point Quarkus at it (it duplicates what generation produces).
--   * To refresh Part 1 after entity changes: boot `mvn quarkus:dev`
--     (DevServices starts PostgreSQL), then
--     `podman exec <container> pg_dump -U quarkus -d quarkus --schema-only`
--     from that container.
--   * Part 2 tables use natural keys (names) as the mock model does; on
--     promotion they gain UUID PKs (see the platform/target/gateway/skill/
--     agent/workflow trend in Part 1).
--
-- Dialect: PostgreSQL. Verified: Part 1 + Part 2 apply cleanly together
-- (re-verified on this refresh; see the Findings section at the end).
-- ============================================================================


-- ############################################################################
-- # PART 1 — IMPLEMENTED: Hibernate-generated schema (35 entities, verbatim) #
-- ############################################################################

SET default_table_access_method = heap;

--
-- Name: agent; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.agent (
    id uuid NOT NULL,
    createdat timestamp(6) with time zone NOT NULL,
    updatedat timestamp(6) with time zone NOT NULL,
    version bigint NOT NULL,
    image character varying(1024) NOT NULL,
    name character varying(255) NOT NULL,
    params integer NOT NULL,
    ready boolean NOT NULL,
    tierpin character varying(255),
    gateway_id uuid NOT NULL
);


ALTER TABLE public.agent OWNER TO quarkus;

--
-- Name: agent_run; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.agent_run (
    id uuid NOT NULL,
    createdat timestamp(6) with time zone NOT NULL,
    updatedat timestamp(6) with time zone NOT NULL,
    version bigint NOT NULL,
    cost character varying(32),
    duration character varying(64),
    image character varying(1024),
    model character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    phase character varying(32) NOT NULL,
    reason character varying(1024),
    state smallint NOT NULL,
    tokdetail character varying(64),
    tokens character varying(32),
    agent_id uuid NOT NULL,
    application_id uuid NOT NULL,
    gateway_id uuid NOT NULL,
    workflow_run_id uuid NOT NULL,
    CONSTRAINT agent_run_state_check CHECK (((state >= 0) AND (state <= 2)))
);


ALTER TABLE public.agent_run OWNER TO quarkus;

--
-- Name: agent_run_event; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.agent_run_event (
    id uuid NOT NULL,
    createdat timestamp(6) with time zone NOT NULL,
    updatedat timestamp(6) with time zone NOT NULL,
    version bigint NOT NULL,
    message character varying(1024) NOT NULL,
    offsettext character varying(32) NOT NULL,
    agent_run_id uuid NOT NULL
);


ALTER TABLE public.agent_run_event OWNER TO quarkus;

--
-- Name: agent_skills; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.agent_skills (
    agent_id uuid NOT NULL,
    skill_id uuid NOT NULL
);


ALTER TABLE public.agent_skills OWNER TO quarkus;

--
-- Name: analysis; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.analysis (
    id uuid NOT NULL,
    createdat timestamp(6) with time zone NOT NULL,
    updatedat timestamp(6) with time zone NOT NULL,
    version bigint NOT NULL,
    completedat timestamp(6) with time zone,
    contentfingerprint character varying(64),
    progress integer NOT NULL,
    startedat timestamp(6) with time zone,
    status character varying(32) NOT NULL,
    triggeredby character varying(255),
    application_id uuid NOT NULL,
    profile_id uuid,
    CONSTRAINT analysis_status_check CHECK (((status)::text = ANY ((ARRAY['QUEUED'::character varying, 'RUNNING'::character varying, 'SUCCEEDED'::character varying, 'FAILED'::character varying])::text[])))
);


ALTER TABLE public.analysis OWNER TO quarkus;

--
-- Name: analysis_profile; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.analysis_profile (
    id uuid NOT NULL,
    createdat timestamp(6) with time zone NOT NULL,
    updatedat timestamp(6) with time zone NOT NULL,
    version bigint NOT NULL,
    description character varying(2048),
    name character varying(255) NOT NULL
);


ALTER TABLE public.analysis_profile OWNER TO quarkus;

--
-- Name: analysis_profile_sources; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.analysis_profile_sources (
    profile_id uuid NOT NULL,
    source character varying(255)
);


ALTER TABLE public.analysis_profile_sources OWNER TO quarkus;

--
-- Name: analysis_profile_targets; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.analysis_profile_targets (
    profile_id uuid NOT NULL,
    target character varying(255)
);


ALTER TABLE public.analysis_profile_targets OWNER TO quarkus;

--
-- Name: application; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.application (
    id uuid NOT NULL,
    createdat timestamp(6) with time zone NOT NULL,
    updatedat timestamp(6) with time zone NOT NULL,
    version bigint NOT NULL,
    analysisstate character varying(32) NOT NULL,
    assessmentversion character varying(32),
    binaryartifact boolean NOT NULL,
    description character varying(2048),
    effort integer NOT NULL,
    name character varying(255) NOT NULL,
    repositorytype character varying(32) NOT NULL,
    repositoryurl character varying(1024),
    reviewstate character varying(32) NOT NULL,
    risk character varying(32),
    riskkind character varying(32) NOT NULL,
    archetype_id uuid,
    business_service_id uuid NOT NULL,
    credential_id uuid,
    identity_id uuid,
    owner_id uuid,
    platform_id uuid,
    team_id uuid NOT NULL,
    CONSTRAINT application_analysisstate_check CHECK (((analysisstate)::text = ANY ((ARRAY['NOT_STARTED'::character varying, 'IN_FLIGHT'::character varying, 'CURRENT'::character varying, 'STALE'::character varying, 'FAILED'::character varying])::text[]))),
    CONSTRAINT application_repositorytype_check CHECK (((repositorytype)::text = ANY ((ARRAY['GIT'::character varying, 'SUBVERSION'::character varying])::text[]))),
    CONSTRAINT application_reviewstate_check CHECK (((reviewstate)::text = ANY ((ARRAY['NOT_STARTED'::character varying, 'PENDING'::character varying, 'APPROVED'::character varying])::text[]))),
    CONSTRAINT application_riskkind_check CHECK (((riskkind)::text = ANY ((ARRAY['OWN'::character varying, 'INHERITED'::character varying, 'UNASSESSED'::character varying, 'NONE'::character varying])::text[])))
);


ALTER TABLE public.application OWNER TO quarkus;

--
-- Name: application_tags; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.application_tags (
    application_id uuid NOT NULL,
    tag_id uuid NOT NULL
);


ALTER TABLE public.application_tags OWNER TO quarkus;

--
-- Name: archetype; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.archetype (
    id uuid NOT NULL,
    createdat timestamp(6) with time zone NOT NULL,
    updatedat timestamp(6) with time zone NOT NULL,
    version bigint NOT NULL,
    description character varying(2048),
    name character varying(255) NOT NULL
);


ALTER TABLE public.archetype OWNER TO quarkus;

--
-- Name: archetype_criteria; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.archetype_criteria (
    archetype_id uuid NOT NULL,
    tag_id uuid NOT NULL
);


ALTER TABLE public.archetype_criteria OWNER TO quarkus;

--
-- Name: archetype_tags; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.archetype_tags (
    archetype_id uuid NOT NULL,
    tag_id uuid NOT NULL
);


ALTER TABLE public.archetype_tags OWNER TO quarkus;

--
-- Name: audit_entry; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.audit_entry (
    id uuid NOT NULL,
    createdat timestamp(6) with time zone NOT NULL,
    updatedat timestamp(6) with time zone NOT NULL,
    version bigint NOT NULL,
    action character varying(64) NOT NULL,
    actor character varying(255) NOT NULL,
    at timestamp(6) with time zone,
    crosstenant boolean NOT NULL,
    detail character varying(2048),
    resourceid character varying(1024) NOT NULL,
    resourcetype character varying(64) NOT NULL,
    organization_id uuid
);


ALTER TABLE public.audit_entry OWNER TO quarkus;

--
-- Name: business_service; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.business_service (
    id uuid NOT NULL,
    createdat timestamp(6) with time zone NOT NULL,
    updatedat timestamp(6) with time zone NOT NULL,
    version bigint NOT NULL,
    description character varying(2048) NOT NULL,
    name character varying(255) NOT NULL,
    organization_id uuid NOT NULL,
    owner_id uuid NOT NULL
);


ALTER TABLE public.business_service OWNER TO quarkus;

--
-- Name: department; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.department (
    id uuid NOT NULL,
    createdat timestamp(6) with time zone NOT NULL,
    updatedat timestamp(6) with time zone NOT NULL,
    version bigint NOT NULL,
    name character varying(255) NOT NULL,
    organization_id uuid NOT NULL
);


ALTER TABLE public.department OWNER TO quarkus;

--
-- Name: gateway; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.gateway (
    id uuid NOT NULL,
    createdat timestamp(6) with time zone NOT NULL,
    updatedat timestamp(6) with time zone NOT NULL,
    version bigint NOT NULL,
    cred character varying(255),
    ctx character varying(32),
    endpoint character varying(1024) NOT NULL,
    health character varying(255),
    healthat timestamp(6) with time zone,
    model character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    rate character varying(32),
    ready boolean NOT NULL,
    runs30d integer,
    tier character varying(32),
    tokens30d character varying(32)
);


ALTER TABLE public.gateway OWNER TO quarkus;

--
-- Name: identity; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.identity (
    id uuid NOT NULL,
    createdat timestamp(6) with time zone NOT NULL,
    updatedat timestamp(6) with time zone NOT NULL,
    version bigint NOT NULL,
    description character varying(1024),
    expireson date,
    key character varying(2048),
    kind character varying(64) NOT NULL,
    lastused timestamp(6) with time zone,
    name character varying(255) NOT NULL,
    password character varying(2048),
    username character varying(255),
    verified boolean NOT NULL,
    organization_id uuid NOT NULL,
    team_id uuid,
    CONSTRAINT identity_kind_check CHECK (((kind)::text = ANY ((ARRAY['USERNAME_PASSWORD'::character varying, 'OAUTH2'::character varying, 'BEARER_TOKEN'::character varying, 'SECRET_KEY'::character varying, 'SOURCE_PRIVATE_KEY'::character varying, 'API_KEY'::character varying])::text[])))
);


ALTER TABLE public.identity OWNER TO quarkus;

--
-- Name: incident; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.incident (
    id uuid NOT NULL,
    createdat timestamp(6) with time zone NOT NULL,
    updatedat timestamp(6) with time zone NOT NULL,
    version bigint NOT NULL,
    effort integer NOT NULL,
    file character varying(1024) NOT NULL,
    incidentkey character varying(1024) NOT NULL,
    line integer,
    message character varying(4096),
    rule character varying(255) NOT NULL,
    ruleset character varying(255) NOT NULL,
    state character varying(32) NOT NULL,
    triageactor character varying(255),
    triagecomment character varying(4096),
    triagedat timestamp(6) with time zone,
    analysis_id uuid,
    application_id uuid NOT NULL,
    CONSTRAINT incident_state_check CHECK (((state)::text = ANY ((ARRAY['TRIAGE'::character varying, 'ASSIGNED'::character varying, 'IN_PROGRESS'::character varying, 'RESOLVED'::character varying, 'FALSE_POSITIVE'::character varying])::text[])))
);


ALTER TABLE public.incident OWNER TO quarkus;

--
-- Name: job_function; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.job_function (
    id uuid NOT NULL,
    createdat timestamp(6) with time zone NOT NULL,
    updatedat timestamp(6) with time zone NOT NULL,
    version bigint NOT NULL,
    name character varying(255) NOT NULL
);


ALTER TABLE public.job_function OWNER TO quarkus;

--
-- Name: organization; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.organization (
    id uuid NOT NULL,
    createdat timestamp(6) with time zone NOT NULL,
    updatedat timestamp(6) with time zone NOT NULL,
    version bigint NOT NULL,
    description character varying(512),
    name character varying(255) NOT NULL
);


ALTER TABLE public.organization OWNER TO quarkus;

--
-- Name: platform; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.platform (
    id uuid NOT NULL,
    createdat timestamp(6) with time zone NOT NULL,
    updatedat timestamp(6) with time zone NOT NULL,
    version bigint NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(64) NOT NULL
);


ALTER TABLE public.platform OWNER TO quarkus;

--
-- Name: setting; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.setting (
    id uuid NOT NULL,
    key character varying(255) NOT NULL,
    createdat timestamp(6) with time zone NOT NULL,
    updatedat timestamp(6) with time zone NOT NULL,
    version bigint NOT NULL,
    defaultvalue character varying(1024),
    effect character varying(512) NOT NULL,
    since character varying(32) NOT NULL,
    type character varying(32) NOT NULL,
    value character varying(1024)
);


ALTER TABLE public.setting OWNER TO quarkus;

--
-- Name: skill; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.skill (
    id uuid NOT NULL,
    createdat timestamp(6) with time zone NOT NULL,
    updatedat timestamp(6) with time zone NOT NULL,
    version bigint NOT NULL,
    description character varying(2048) NOT NULL,
    display character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    ready boolean NOT NULL,
    source character varying(255) NOT NULL,
    tags character varying(512),
    type smallint NOT NULL,
    CONSTRAINT skill_type_check CHECK (((type >= 0) AND (type <= 2)))
);


ALTER TABLE public.skill OWNER TO quarkus;

--
-- Name: stakeholder; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.stakeholder (
    id uuid NOT NULL,
    createdat timestamp(6) with time zone NOT NULL,
    updatedat timestamp(6) with time zone NOT NULL,
    version bigint NOT NULL,
    email character varying(320) NOT NULL,
    name character varying(255) NOT NULL,
    job_function_id uuid,
    organization_id uuid NOT NULL
);


ALTER TABLE public.stakeholder OWNER TO quarkus;

--
-- Name: stakeholder_group; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.stakeholder_group (
    id uuid NOT NULL,
    createdat timestamp(6) with time zone NOT NULL,
    updatedat timestamp(6) with time zone NOT NULL,
    version bigint NOT NULL,
    description character varying(1024),
    name character varying(255) NOT NULL,
    organization_id uuid NOT NULL
);


ALTER TABLE public.stakeholder_group OWNER TO quarkus;

--
-- Name: stakeholder_group_members; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.stakeholder_group_members (
    group_id uuid NOT NULL,
    stakeholder_id uuid NOT NULL
);


ALTER TABLE public.stakeholder_group_members OWNER TO quarkus;

--
-- Name: tag; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.tag (
    id uuid NOT NULL,
    createdat timestamp(6) with time zone NOT NULL,
    updatedat timestamp(6) with time zone NOT NULL,
    version bigint NOT NULL,
    name character varying(255) NOT NULL,
    tag_type_id uuid NOT NULL
);


ALTER TABLE public.tag OWNER TO quarkus;

--
-- Name: tag_type; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.tag_type (
    id uuid NOT NULL,
    createdat timestamp(6) with time zone NOT NULL,
    updatedat timestamp(6) with time zone NOT NULL,
    version bigint NOT NULL,
    color character varying(32),
    name character varying(255) NOT NULL,
    rank integer
);


ALTER TABLE public.tag_type OWNER TO quarkus;

--
-- Name: target; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.target (
    id uuid NOT NULL,
    createdat timestamp(6) with time zone NOT NULL,
    updatedat timestamp(6) with time zone NOT NULL,
    version bigint NOT NULL,
    langs character varying(255) NOT NULL,
    name character varying(255) NOT NULL
);


ALTER TABLE public.target OWNER TO quarkus;

--
-- Name: task; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.task (
    id uuid NOT NULL,
    createdat timestamp(6) with time zone NOT NULL,
    updatedat timestamp(6) with time zone NOT NULL,
    version bigint NOT NULL,
    completedat timestamp(6) with time zone,
    errorcode character varying(64),
    errormessage character varying(4096),
    kind character varying(32) NOT NULL,
    label character varying(255),
    quota character varying(255),
    startedat timestamp(6) with time zone,
    state character varying(32) NOT NULL,
    triggeredby character varying(255),
    application_id uuid,
    CONSTRAINT task_kind_check CHECK (((kind)::text = ANY ((ARRAY['ANALYSIS'::character varying, 'TRIAGE_CARRYOVER'::character varying, 'BATCH_TAG'::character varying, 'EXPORT'::character varying, 'VERIFICATION'::character varying])::text[]))),
    CONSTRAINT task_state_check CHECK (((state)::text = ANY ((ARRAY['QUEUED'::character varying, 'RUNNING'::character varying, 'SUCCEEDED'::character varying, 'FAILED'::character varying, 'CANCELED'::character varying])::text[])))
);


ALTER TABLE public.task OWNER TO quarkus;

--
-- Name: team; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.team (
    id uuid NOT NULL,
    createdat timestamp(6) with time zone NOT NULL,
    updatedat timestamp(6) with time zone NOT NULL,
    version bigint NOT NULL,
    name character varying(255) NOT NULL,
    department_id uuid NOT NULL
);


ALTER TABLE public.team OWNER TO quarkus;

--
-- Name: team_members; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.team_members (
    stakeholder_id uuid NOT NULL,
    team_id uuid NOT NULL
);


ALTER TABLE public.team_members OWNER TO quarkus;

--
-- Name: trend_point; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.trend_point (
    id uuid NOT NULL,
    createdat timestamp(6) with time zone NOT NULL,
    updatedat timestamp(6) with time zone NOT NULL,
    version bigint NOT NULL,
    date date NOT NULL,
    open integer NOT NULL,
    pass integer NOT NULL
);


ALTER TABLE public.trend_point OWNER TO quarkus;

--
-- Name: user_settings; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.user_settings (
    subject character varying(255) NOT NULL,
    settings text DEFAULT '{}'::text NOT NULL
);


ALTER TABLE public.user_settings OWNER TO quarkus;

--
-- Name: wave; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.wave (
    id uuid NOT NULL,
    createdat timestamp(6) with time zone NOT NULL,
    updatedat timestamp(6) with time zone NOT NULL,
    version bigint NOT NULL,
    enddate date,
    name character varying(255) NOT NULL,
    "position" integer,
    startdate date,
    organization_id uuid NOT NULL
);


ALTER TABLE public.wave OWNER TO quarkus;

--
-- Name: wave_dependency; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.wave_dependency (
    id uuid NOT NULL,
    createdat timestamp(6) with time zone NOT NULL,
    updatedat timestamp(6) with time zone NOT NULL,
    version bigint NOT NULL,
    verb character varying(64) NOT NULL,
    from_app_id uuid NOT NULL,
    to_app_id uuid NOT NULL
);


ALTER TABLE public.wave_dependency OWNER TO quarkus;

--
-- Name: wave_evidence; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.wave_evidence (
    id uuid NOT NULL,
    createdat timestamp(6) with time zone NOT NULL,
    updatedat timestamp(6) with time zone NOT NULL,
    version bigint NOT NULL,
    coverage character varying(255) NOT NULL,
    red integer NOT NULL,
    run integer NOT NULL,
    total integer NOT NULL,
    application_id uuid NOT NULL
);


ALTER TABLE public.wave_evidence OWNER TO quarkus;

--
-- Name: wave_members; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.wave_members (
    wave_id uuid NOT NULL,
    application_id uuid NOT NULL
);


ALTER TABLE public.wave_members OWNER TO quarkus;

--
-- Name: wave_ticket; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.wave_ticket (
    id uuid NOT NULL,
    createdat timestamp(6) with time zone NOT NULL,
    updatedat timestamp(6) with time zone NOT NULL,
    version bigint NOT NULL,
    detail character varying(1024),
    key character varying(64),
    outcome smallint NOT NULL,
    title character varying(255) NOT NULL,
    whentext character varying(128),
    application_id uuid NOT NULL,
    CONSTRAINT wave_ticket_outcome_check CHECK (((outcome >= 0) AND (outcome <= 2)))
);


ALTER TABLE public.wave_ticket OWNER TO quarkus;

--
-- Name: webhook; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.webhook (
    id uuid NOT NULL,
    createdat timestamp(6) with time zone NOT NULL,
    updatedat timestamp(6) with time zone NOT NULL,
    version bigint NOT NULL,
    enabled boolean NOT NULL,
    name character varying(255) NOT NULL,
    secret character varying(255),
    url character varying(1024) NOT NULL
);


ALTER TABLE public.webhook OWNER TO quarkus;

--
-- Name: webhook_delivery; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.webhook_delivery (
    id uuid NOT NULL,
    createdat timestamp(6) with time zone NOT NULL,
    updatedat timestamp(6) with time zone NOT NULL,
    version bigint NOT NULL,
    attempts integer NOT NULL,
    deliveredat timestamp(6) with time zone,
    kind character varying(64) NOT NULL,
    payload oid NOT NULL,
    responsestatus integer NOT NULL,
    succeeded boolean NOT NULL,
    type character varying(64) NOT NULL,
    webhook_id uuid NOT NULL
);


ALTER TABLE public.webhook_delivery OWNER TO quarkus;

--
-- Name: webhook_kinds; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.webhook_kinds (
    webhook_id uuid NOT NULL,
    kind character varying(64)
);


ALTER TABLE public.webhook_kinds OWNER TO quarkus;

--
-- Name: workflow; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.workflow (
    id uuid NOT NULL,
    createdat timestamp(6) with time zone NOT NULL,
    updatedat timestamp(6) with time zone NOT NULL,
    version bigint NOT NULL,
    guide character varying(255),
    name character varying(255) NOT NULL,
    ready boolean NOT NULL,
    stages integer NOT NULL
);


ALTER TABLE public.workflow OWNER TO quarkus;

--
-- Name: workflow_run; Type: TABLE; Schema: public; Owner: quarkus
--

CREATE TABLE public.workflow_run (
    id uuid NOT NULL,
    createdat timestamp(6) with time zone NOT NULL,
    updatedat timestamp(6) with time zone NOT NULL,
    version bigint NOT NULL,
    canonical boolean NOT NULL,
    duration character varying(64),
    name character varying(64) NOT NULL,
    phase character varying(32) NOT NULL,
    stages integer NOT NULL,
    state smallint NOT NULL,
    application_id uuid NOT NULL,
    workflow_id uuid NOT NULL,
    CONSTRAINT workflow_run_state_check CHECK (((state >= 0) AND (state <= 2)))
);


ALTER TABLE public.workflow_run OWNER TO quarkus;

--
-- Name: agent agent_pkey; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.agent
    ADD CONSTRAINT agent_pkey PRIMARY KEY (id);


--
-- Name: agent_run_event agent_run_event_pkey; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.agent_run_event
    ADD CONSTRAINT agent_run_event_pkey PRIMARY KEY (id);


--
-- Name: agent_run agent_run_pkey; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.agent_run
    ADD CONSTRAINT agent_run_pkey PRIMARY KEY (id);


--
-- Name: analysis analysis_pkey; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.analysis
    ADD CONSTRAINT analysis_pkey PRIMARY KEY (id);


--
-- Name: analysis_profile analysis_profile_pkey; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.analysis_profile
    ADD CONSTRAINT analysis_profile_pkey PRIMARY KEY (id);


--
-- Name: application application_pkey; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.application
    ADD CONSTRAINT application_pkey PRIMARY KEY (id);


--
-- Name: archetype archetype_pkey; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.archetype
    ADD CONSTRAINT archetype_pkey PRIMARY KEY (id);


--
-- Name: audit_entry audit_entry_pkey; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.audit_entry
    ADD CONSTRAINT audit_entry_pkey PRIMARY KEY (id);


--
-- Name: business_service business_service_pkey; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.business_service
    ADD CONSTRAINT business_service_pkey PRIMARY KEY (id);


--
-- Name: department department_pkey; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.department
    ADD CONSTRAINT department_pkey PRIMARY KEY (id);


--
-- Name: gateway gateway_pkey; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.gateway
    ADD CONSTRAINT gateway_pkey PRIMARY KEY (id);


--
-- Name: identity identity_pkey; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.identity
    ADD CONSTRAINT identity_pkey PRIMARY KEY (id);


--
-- Name: incident incident_pkey; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.incident
    ADD CONSTRAINT incident_pkey PRIMARY KEY (id);


--
-- Name: job_function job_function_pkey; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.job_function
    ADD CONSTRAINT job_function_pkey PRIMARY KEY (id);


--
-- Name: organization organization_pkey; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.organization
    ADD CONSTRAINT organization_pkey PRIMARY KEY (id);


--
-- Name: platform platform_pkey; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.platform
    ADD CONSTRAINT platform_pkey PRIMARY KEY (id);


--
-- Name: setting setting_pkey; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.setting
    ADD CONSTRAINT setting_pkey PRIMARY KEY (id, key);


--
-- Name: skill skill_pkey; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.skill
    ADD CONSTRAINT skill_pkey PRIMARY KEY (id);


--
-- Name: stakeholder_group stakeholder_group_pkey; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.stakeholder_group
    ADD CONSTRAINT stakeholder_group_pkey PRIMARY KEY (id);


--
-- Name: stakeholder stakeholder_pkey; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.stakeholder
    ADD CONSTRAINT stakeholder_pkey PRIMARY KEY (id);


--
-- Name: tag tag_pkey; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.tag
    ADD CONSTRAINT tag_pkey PRIMARY KEY (id);


--
-- Name: tag_type tag_type_pkey; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.tag_type
    ADD CONSTRAINT tag_type_pkey PRIMARY KEY (id);


--
-- Name: target target_pkey; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.target
    ADD CONSTRAINT target_pkey PRIMARY KEY (id);


--
-- Name: task task_pkey; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.task
    ADD CONSTRAINT task_pkey PRIMARY KEY (id);


--
-- Name: team team_pkey; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.team
    ADD CONSTRAINT team_pkey PRIMARY KEY (id);


--
-- Name: trend_point trend_point_pkey; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.trend_point
    ADD CONSTRAINT trend_point_pkey PRIMARY KEY (id);


--
-- Name: application uc_application_name; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.application
    ADD CONSTRAINT uc_application_name UNIQUE (name);


--
-- Name: archetype uc_archetype_name; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.archetype
    ADD CONSTRAINT uc_archetype_name UNIQUE (name);


--
-- Name: business_service uc_bsvc_org_name; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.business_service
    ADD CONSTRAINT uc_bsvc_org_name UNIQUE (organization_id, name);


--
-- Name: department uc_dept_org_name; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.department
    ADD CONSTRAINT uc_dept_org_name UNIQUE (organization_id, name);


--
-- Name: incident uc_incident_key; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.incident
    ADD CONSTRAINT uc_incident_key UNIQUE (incidentkey);


--
-- Name: job_function uc_jobfunction_name; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.job_function
    ADD CONSTRAINT uc_jobfunction_name UNIQUE (name);


--
-- Name: organization uc_org_name; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.organization
    ADD CONSTRAINT uc_org_name UNIQUE (name);


--
-- Name: analysis_profile uc_profile_name; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.analysis_profile
    ADD CONSTRAINT uc_profile_name UNIQUE (name);


--
-- Name: setting uc_setting_key; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.setting
    ADD CONSTRAINT uc_setting_key UNIQUE (key);


--
-- Name: stakeholder uc_stakeholder_email; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.stakeholder
    ADD CONSTRAINT uc_stakeholder_email UNIQUE (email);


--
-- Name: tag uc_tag_type_name; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.tag
    ADD CONSTRAINT uc_tag_type_name UNIQUE (tag_type_id, name);


--
-- Name: tag_type uc_tagtype_name; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.tag_type
    ADD CONSTRAINT uc_tagtype_name UNIQUE (name);


--
-- Name: team uc_team_dept_name; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.team
    ADD CONSTRAINT uc_team_dept_name UNIQUE (department_id, name);


--
-- Name: trend_point uc_trend_point_date; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.trend_point
    ADD CONSTRAINT uc_trend_point_date UNIQUE (date);


--
-- Name: wave_dependency uc_wave_dependency_edge; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.wave_dependency
    ADD CONSTRAINT uc_wave_dependency_edge UNIQUE (from_app_id, to_app_id);


--
-- Name: wave_evidence uc_wave_evidence_app; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.wave_evidence
    ADD CONSTRAINT uc_wave_evidence_app UNIQUE (application_id);


--
-- Name: wave_ticket uc_wave_ticket_app; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.wave_ticket
    ADD CONSTRAINT uc_wave_ticket_app UNIQUE (application_id);


--
-- Name: webhook uc_webhook_name; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.webhook
    ADD CONSTRAINT uc_webhook_name UNIQUE (name);


--
-- Name: workflow_run uc_workflow_run_name; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.workflow_run
    ADD CONSTRAINT uc_workflow_run_name UNIQUE (name);


--
-- Name: agent uk2kj9wfibmd3pdjilrmsyk45ko; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.agent
    ADD CONSTRAINT uk2kj9wfibmd3pdjilrmsyk45ko UNIQUE (name);


--
-- Name: workflow uk3je18ux0wru0pxv6un40yhbn4; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.workflow
    ADD CONSTRAINT uk3je18ux0wru0pxv6un40yhbn4 UNIQUE (name);


--
-- Name: skill uk5ljf2l2h4odhtxrsuohlro4ir; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.skill
    ADD CONSTRAINT uk5ljf2l2h4odhtxrsuohlro4ir UNIQUE (name);


--
-- Name: gateway ukg78ou4w5y3kd9ovpv3m8tkq8f; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.gateway
    ADD CONSTRAINT ukg78ou4w5y3kd9ovpv3m8tkq8f UNIQUE (name);


--
-- Name: target ukgsvqba2eyab6pb5t0wx0eaxtv; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.target
    ADD CONSTRAINT ukgsvqba2eyab6pb5t0wx0eaxtv UNIQUE (name);


--
-- Name: platform ukhp36t3hx9su23msu2p5qvukyh; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.platform
    ADD CONSTRAINT ukhp36t3hx9su23msu2p5qvukyh UNIQUE (name);


--
-- Name: analysis ukrcfvtkud9qygbk0mbwxm7rxdf; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.analysis
    ADD CONSTRAINT ukrcfvtkud9qygbk0mbwxm7rxdf UNIQUE (contentfingerprint);


--
-- Name: user_settings user_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_pkey PRIMARY KEY (subject);


--
-- Name: wave_dependency wave_dependency_pkey; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.wave_dependency
    ADD CONSTRAINT wave_dependency_pkey PRIMARY KEY (id);


--
-- Name: wave_evidence wave_evidence_pkey; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.wave_evidence
    ADD CONSTRAINT wave_evidence_pkey PRIMARY KEY (id);


--
-- Name: wave wave_pkey; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.wave
    ADD CONSTRAINT wave_pkey PRIMARY KEY (id);


--
-- Name: wave_ticket wave_ticket_pkey; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.wave_ticket
    ADD CONSTRAINT wave_ticket_pkey PRIMARY KEY (id);


--
-- Name: webhook_delivery webhook_delivery_pkey; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.webhook_delivery
    ADD CONSTRAINT webhook_delivery_pkey PRIMARY KEY (id);


--
-- Name: webhook webhook_pkey; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.webhook
    ADD CONSTRAINT webhook_pkey PRIMARY KEY (id);


--
-- Name: workflow workflow_pkey; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.workflow
    ADD CONSTRAINT workflow_pkey PRIMARY KEY (id);


--
-- Name: workflow_run workflow_run_pkey; Type: CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.workflow_run
    ADD CONSTRAINT workflow_run_pkey PRIMARY KEY (id);


--
-- Name: idx_agent_run_event_run; Type: INDEX; Schema: public; Owner: quarkus
--

CREATE INDEX idx_agent_run_event_run ON public.agent_run_event USING btree (agent_run_id);


--
-- Name: idx_agent_run_wfrun; Type: INDEX; Schema: public; Owner: quarkus
--

CREATE INDEX idx_agent_run_wfrun ON public.agent_run USING btree (workflow_run_id);


--
-- Name: idx_analysis_application; Type: INDEX; Schema: public; Owner: quarkus
--

CREATE INDEX idx_analysis_application ON public.analysis USING btree (application_id);


--
-- Name: idx_audit_actor; Type: INDEX; Schema: public; Owner: quarkus
--

CREATE INDEX idx_audit_actor ON public.audit_entry USING btree (actor);


--
-- Name: idx_audit_organization; Type: INDEX; Schema: public; Owner: quarkus
--

CREATE INDEX idx_audit_organization ON public.audit_entry USING btree (organization_id);


--
-- Name: idx_delivery_webhook; Type: INDEX; Schema: public; Owner: quarkus
--

CREATE INDEX idx_delivery_webhook ON public.webhook_delivery USING btree (webhook_id);


--
-- Name: idx_incident_analysis; Type: INDEX; Schema: public; Owner: quarkus
--

CREATE INDEX idx_incident_analysis ON public.incident USING btree (analysis_id);


--
-- Name: idx_incident_application; Type: INDEX; Schema: public; Owner: quarkus
--

CREATE INDEX idx_incident_application ON public.incident USING btree (application_id);


--
-- Name: idx_task_state; Type: INDEX; Schema: public; Owner: quarkus
--

CREATE INDEX idx_task_state ON public.task USING btree (state);


--
-- Name: stakeholder_group fk17qt0wa84hwgryc4j8344x45b; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.stakeholder_group
    ADD CONSTRAINT fk17qt0wa84hwgryc4j8344x45b FOREIGN KEY (organization_id) REFERENCES public.organization(id);


--
-- Name: application fk1lhqnqek55pi44e8msidb1bhg; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.application
    ADD CONSTRAINT fk1lhqnqek55pi44e8msidb1bhg FOREIGN KEY (team_id) REFERENCES public.team(id);


--
-- Name: wave fk2tfltm22aq95k1anaw0xgo69d; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.wave
    ADD CONSTRAINT fk2tfltm22aq95k1anaw0xgo69d FOREIGN KEY (organization_id) REFERENCES public.organization(id);


--
-- Name: application_tags fk3ybnwav965cbchbta5p6spt7m; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.application_tags
    ADD CONSTRAINT fk3ybnwav965cbchbta5p6spt7m FOREIGN KEY (tag_id) REFERENCES public.tag(id);


--
-- Name: agent_run_event fk450twxhjraa3eedc6mjg2sng8; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.agent_run_event
    ADD CONSTRAINT fk450twxhjraa3eedc6mjg2sng8 FOREIGN KEY (agent_run_id) REFERENCES public.agent_run(id);


--
-- Name: tag fk4dal6a59cl5t8omhsi2yrtk0g; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.tag
    ADD CONSTRAINT fk4dal6a59cl5t8omhsi2yrtk0g FOREIGN KEY (tag_type_id) REFERENCES public.tag_type(id);


--
-- Name: audit_entry fk4r8ivt5bfcgk4g5ycogmvur5y; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.audit_entry
    ADD CONSTRAINT fk4r8ivt5bfcgk4g5ycogmvur5y FOREIGN KEY (organization_id) REFERENCES public.organization(id);


--
-- Name: application_tags fk4rfl5e8ciux26971mgwvu9xem; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.application_tags
    ADD CONSTRAINT fk4rfl5e8ciux26971mgwvu9xem FOREIGN KEY (application_id) REFERENCES public.application(id);


--
-- Name: application fk4ut3g11pbfto2m4737ev5x1ag; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.application
    ADD CONSTRAINT fk4ut3g11pbfto2m4737ev5x1ag FOREIGN KEY (owner_id) REFERENCES public.stakeholder(id);


--
-- Name: incident fk562cketwdtg5bx1g47ci15ury; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.incident
    ADD CONSTRAINT fk562cketwdtg5bx1g47ci15ury FOREIGN KEY (analysis_id) REFERENCES public.analysis(id);


--
-- Name: analysis_profile_targets fk5cxguxlftdqtqh0f14b09kl0d; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.analysis_profile_targets
    ADD CONSTRAINT fk5cxguxlftdqtqh0f14b09kl0d FOREIGN KEY (profile_id) REFERENCES public.analysis_profile(id);


--
-- Name: incident fk64qsxdxdxnma76mbcqbs8q8hy; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.incident
    ADD CONSTRAINT fk64qsxdxdxnma76mbcqbs8q8hy FOREIGN KEY (application_id) REFERENCES public.application(id);


--
-- Name: workflow_run fk6c3uyjwvy7ec1k1f0612edmva; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.workflow_run
    ADD CONSTRAINT fk6c3uyjwvy7ec1k1f0612edmva FOREIGN KEY (application_id) REFERENCES public.application(id);


--
-- Name: wave_evidence fk6v632gucjp31yk7m5ev6s6v52; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.wave_evidence
    ADD CONSTRAINT fk6v632gucjp31yk7m5ev6s6v52 FOREIGN KEY (application_id) REFERENCES public.application(id);


--
-- Name: archetype_tags fk71fotpw586sfu2686jun0pn7; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.archetype_tags
    ADD CONSTRAINT fk71fotpw586sfu2686jun0pn7 FOREIGN KEY (tag_id) REFERENCES public.tag(id);


--
-- Name: analysis_profile_sources fk7a6vhc954e6cvsp98fsqryt8i; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.analysis_profile_sources
    ADD CONSTRAINT fk7a6vhc954e6cvsp98fsqryt8i FOREIGN KEY (profile_id) REFERENCES public.analysis_profile(id);


--
-- Name: stakeholder fk7d7di80q0l2plhyq4vubnhst8; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.stakeholder
    ADD CONSTRAINT fk7d7di80q0l2plhyq4vubnhst8 FOREIGN KEY (job_function_id) REFERENCES public.job_function(id);


--
-- Name: business_service fk8cm2bun4ev8utyck64k7lmbb6; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.business_service
    ADD CONSTRAINT fk8cm2bun4ev8utyck64k7lmbb6 FOREIGN KEY (owner_id) REFERENCES public.stakeholder(id);


--
-- Name: archetype_criteria fk8o71tfdpi6f383si720h97nxi; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.archetype_criteria
    ADD CONSTRAINT fk8o71tfdpi6f383si720h97nxi FOREIGN KEY (tag_id) REFERENCES public.tag(id);


--
-- Name: wave_dependency fk9n0byjvns5ve6wq1a7ljyoxk0; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.wave_dependency
    ADD CONSTRAINT fk9n0byjvns5ve6wq1a7ljyoxk0 FOREIGN KEY (to_app_id) REFERENCES public.application(id);


--
-- Name: agent_run fk9qxidw2jrdiyna9dty135t8c; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.agent_run
    ADD CONSTRAINT fk9qxidw2jrdiyna9dty135t8c FOREIGN KEY (workflow_run_id) REFERENCES public.workflow_run(id);


--
-- Name: application fka2e4avxxl93530oiaimkili71; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.application
    ADD CONSTRAINT fka2e4avxxl93530oiaimkili71 FOREIGN KEY (identity_id) REFERENCES public.identity(id);


--
-- Name: identity fkakasiwch8qttcvblbqi7du7u8; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.identity
    ADD CONSTRAINT fkakasiwch8qttcvblbqi7du7u8 FOREIGN KEY (organization_id) REFERENCES public.organization(id);


--
-- Name: team_members fkb3toat7ors5scfmd3n69dhmr1; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT fkb3toat7ors5scfmd3n69dhmr1 FOREIGN KEY (team_id) REFERENCES public.team(id);


--
-- Name: team fkcitsl0ygrf7nbmydhlcqorb3p; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.team
    ADD CONSTRAINT fkcitsl0ygrf7nbmydhlcqorb3p FOREIGN KEY (department_id) REFERENCES public.department(id);


--
-- Name: archetype_criteria fkcpwibtsdcdsg1p2e21o8it21x; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.archetype_criteria
    ADD CONSTRAINT fkcpwibtsdcdsg1p2e21o8it21x FOREIGN KEY (archetype_id) REFERENCES public.archetype(id);


--
-- Name: archetype_tags fkdbrv0lrj0ujlfl5rn8ctjysg9; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.archetype_tags
    ADD CONSTRAINT fkdbrv0lrj0ujlfl5rn8ctjysg9 FOREIGN KEY (archetype_id) REFERENCES public.archetype(id);


--
-- Name: business_service fket9w8odqwcbycx4hxcws0erw0; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.business_service
    ADD CONSTRAINT fket9w8odqwcbycx4hxcws0erw0 FOREIGN KEY (organization_id) REFERENCES public.organization(id);


--
-- Name: application fkfqnwcyffvrt8xxflewv8uk9oh; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.application
    ADD CONSTRAINT fkfqnwcyffvrt8xxflewv8uk9oh FOREIGN KEY (platform_id) REFERENCES public.platform(id);


--
-- Name: analysis fkfur3y503gq59u53y8s38abgyv; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.analysis
    ADD CONSTRAINT fkfur3y503gq59u53y8s38abgyv FOREIGN KEY (profile_id) REFERENCES public.analysis_profile(id);


--
-- Name: agent_skills fkgahvo6ib5mmafftela8rqn51a; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.agent_skills
    ADD CONSTRAINT fkgahvo6ib5mmafftela8rqn51a FOREIGN KEY (skill_id) REFERENCES public.skill(id);


--
-- Name: team_members fkgql30l55ph282rodn79e6kr45; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT fkgql30l55ph282rodn79e6kr45 FOREIGN KEY (stakeholder_id) REFERENCES public.stakeholder(id);


--
-- Name: department fkgt2jmae86v2aik1nklhdc2dnx; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.department
    ADD CONSTRAINT fkgt2jmae86v2aik1nklhdc2dnx FOREIGN KEY (organization_id) REFERENCES public.organization(id);


--
-- Name: wave_dependency fkgthy0ky7aicyw2gup289gfati; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.wave_dependency
    ADD CONSTRAINT fkgthy0ky7aicyw2gup289gfati FOREIGN KEY (from_app_id) REFERENCES public.application(id);


--
-- Name: webhook_delivery fkgvxky22weg5fvsngh0qtrf1y; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.webhook_delivery
    ADD CONSTRAINT fkgvxky22weg5fvsngh0qtrf1y FOREIGN KEY (webhook_id) REFERENCES public.webhook(id);


--
-- Name: wave_ticket fkgw5mhhi46ondvctejyylcisv7; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.wave_ticket
    ADD CONSTRAINT fkgw5mhhi46ondvctejyylcisv7 FOREIGN KEY (application_id) REFERENCES public.application(id);


--
-- Name: stakeholder_group_members fkhmnrn6npgv03m77fql2gvpb4y; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.stakeholder_group_members
    ADD CONSTRAINT fkhmnrn6npgv03m77fql2gvpb4y FOREIGN KEY (stakeholder_id) REFERENCES public.stakeholder(id);


--
-- Name: agent_run fki7xfewfq04qfotrgxgmx2ow33; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.agent_run
    ADD CONSTRAINT fki7xfewfq04qfotrgxgmx2ow33 FOREIGN KEY (gateway_id) REFERENCES public.gateway(id);


--
-- Name: wave_members fkic3t0ujueq9vdsh6089xu5fhb; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.wave_members
    ADD CONSTRAINT fkic3t0ujueq9vdsh6089xu5fhb FOREIGN KEY (wave_id) REFERENCES public.wave(id);


--
-- Name: wave_members fkinrcf3qt0h48y9ppk0iph4akn; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.wave_members
    ADD CONSTRAINT fkinrcf3qt0h48y9ppk0iph4akn FOREIGN KEY (application_id) REFERENCES public.application(id);


--
-- Name: agent_run fkisrh8rpn9n3k172u1y9hlx036; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.agent_run
    ADD CONSTRAINT fkisrh8rpn9n3k172u1y9hlx036 FOREIGN KEY (agent_id) REFERENCES public.agent(id);


--
-- Name: workflow_run fkj233pvwsmhtirw3kbsbb07wg5; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.workflow_run
    ADD CONSTRAINT fkj233pvwsmhtirw3kbsbb07wg5 FOREIGN KEY (workflow_id) REFERENCES public.workflow(id);


--
-- Name: application fkjbxs9sf1bef1x7cl2x034b5k3; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.application
    ADD CONSTRAINT fkjbxs9sf1bef1x7cl2x034b5k3 FOREIGN KEY (credential_id) REFERENCES public.identity(id);


--
-- Name: task fkkj95at7t3jbjg0nng1bw44asr; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.task
    ADD CONSTRAINT fkkj95at7t3jbjg0nng1bw44asr FOREIGN KEY (application_id) REFERENCES public.application(id);


--
-- Name: agent_run fkl0kc6m4ed0l1gn3q1bbn6m713; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.agent_run
    ADD CONSTRAINT fkl0kc6m4ed0l1gn3q1bbn6m713 FOREIGN KEY (application_id) REFERENCES public.application(id);


--
-- Name: application fklr8i6it4b10bl32wfh0r03vtg; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.application
    ADD CONSTRAINT fklr8i6it4b10bl32wfh0r03vtg FOREIGN KEY (archetype_id) REFERENCES public.archetype(id);


--
-- Name: agent_skills fklvmakbiasytt9syrj99gniysc; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.agent_skills
    ADD CONSTRAINT fklvmakbiasytt9syrj99gniysc FOREIGN KEY (agent_id) REFERENCES public.agent(id);


--
-- Name: stakeholder fko259ahinps57w9wmhnovwv3ot; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.stakeholder
    ADD CONSTRAINT fko259ahinps57w9wmhnovwv3ot FOREIGN KEY (organization_id) REFERENCES public.organization(id);


--
-- Name: identity fko2c70bw9s66pxgcommx3jkuyx; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.identity
    ADD CONSTRAINT fko2c70bw9s66pxgcommx3jkuyx FOREIGN KEY (team_id) REFERENCES public.team(id);


--
-- Name: agent fkq7m3vy0g115qrsq2w2afnyu0f; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.agent
    ADD CONSTRAINT fkq7m3vy0g115qrsq2w2afnyu0f FOREIGN KEY (gateway_id) REFERENCES public.gateway(id);


--
-- Name: stakeholder_group_members fkquhsabcqqlm2xj46nx8o1g85r; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.stakeholder_group_members
    ADD CONSTRAINT fkquhsabcqqlm2xj46nx8o1g85r FOREIGN KEY (group_id) REFERENCES public.stakeholder_group(id);


--
-- Name: analysis fksov9re7ch61e9ur6pdjw1mxxj; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.analysis
    ADD CONSTRAINT fksov9re7ch61e9ur6pdjw1mxxj FOREIGN KEY (application_id) REFERENCES public.application(id);


--
-- Name: application fkt1t8sv300pf5e2v7s8jqjcqp0; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.application
    ADD CONSTRAINT fkt1t8sv300pf5e2v7s8jqjcqp0 FOREIGN KEY (business_service_id) REFERENCES public.business_service(id);


--
-- Name: webhook_kinds fkwb23ibnmo9jlidp6c8bm12nr; Type: FK CONSTRAINT; Schema: public; Owner: quarkus
--

ALTER TABLE ONLY public.webhook_kinds
    ADD CONSTRAINT fkwb23ibnmo9jlidp6c8bm12nr FOREIGN KEY (webhook_id) REFERENCES public.webhook(id);


-- ############################################################################
-- # PART 2 — DESIGNED, NOT YET ENTITY-BACKED: mock-model extension tables    #
-- # (from the UI mock's in-memory stores; natural keys — see header)         #
-- ############################################################################

-- 2a. Stakeholder group → wave addressing (mock's group migrationWaves[])

CREATE TABLE stakeholder_group_wave (
  group_id UUID NOT NULL REFERENCES stakeholder_group(id),
  wave_id  UUID NOT NULL REFERENCES wave(id),
  PRIMARY KEY (group_id, wave_id)
);

-- 2b. Run comparison (#1) — historical runs and per-run diffs. The analysis
--     entity (Part 1) records runs with status/incident counts; the
--     comparison surfaces (per-run effort snapshots, added/resolved/unchanged
--     diffs) are mock-only. The landing trend chart is entity-backed now
--     (trend_point in Part 1).

CREATE TABLE analysis_run (
  id              BIGINT NOT NULL, -- run number
  application_id  UUID NOT NULL REFERENCES application(id),
  run_date        DATE NOT NULL,
  pts             INTEGER NOT NULL,
  incidents       INTEGER NOT NULL,
  manifest        TEXT NOT NULL,   -- toolchain ('kantra 0.11')
  PRIMARY KEY (application_id, id)
);

CREATE TABLE run_diff (
  id              BIGSERIAL PRIMARY KEY,
  application_id  UUID NOT NULL REFERENCES application(id),
  category        TEXT NOT NULL CHECK (category IN ('added','resolved','unchanged')),
  description     TEXT NOT NULL,
  location        TEXT NOT NULL,   -- 'portal/FacesBean.java:18', '41 files'
  pts             TEXT NOT NULL,   -- display ('9 pts', '210 → 190 pts')
  state           TEXT NOT NULL,   -- 'New — needs triage' | 'Resolved' | carried states
  state_color     TEXT,            -- DERIVED (display)
  note            TEXT,            -- derivation note ('carried fuzzy — drifted 8 lines…')
  from_run_id     BIGINT,
  to_run_id       BIGINT
);
CREATE INDEX run_diff_app_idx ON run_diff (application_id);

-- ----------------------------------------------------------------------------
-- Divergences: mock model vs implemented (Part 1) schema
-- ----------------------------------------------------------------------------
-- PROMOTED since the first cut (mock store → entity, Part 1):
--   * CREDS → identity extension: expireson DATE, verified BOOLEAN,
--     description VARCHAR(1024) — the expiring/unverified chips (#15
--     admission gate) are entity-backed; team scoping was already there
--     (team_id). The former designed `credential` table is superseded.
--   * MOCK_RUN_TREND → trend_point (date/open/pass, unique date) — the
--     /report/trend endpoint reads it. The former designed `run_trend` is
--     superseded.
--   * Agentic registries → gateway, skill, agent (+agent_skills),
--     workflow, workflow_run, agent_run (+agent_run_event); wave content →
--     wave_dependency, wave_evidence, wave_ticket; platform/target
--     registries → platform, target. All UUID-keyed (promotion per header).
--     Display-only columns from the mock (age strings, health '2h ago',
--     '… ago' durations) were NOT carried into the entities: they derive at
--     render time — a deliberate cleanup vs the old Part 2 design.
-- Still divergent:
-- * run comparison (analysis_run, run_diff above): per-run effort snapshots
--   and added/resolved/unchanged diffs are presentation-layer; the analysis
--   entity keeps status/completedAt/incidentCount.
-- * stakeholder_group_wave (above): group→wave addressing is not modeled
--   (groups carry members only).
-- * incident is row-level WITH triage inline (state CHECK 'TRIAGE','ASSIGNED',
--   'IN_PROGRESS','RESOLVED','FALSE_POSITIVE' + triageactor/triagecomment/
--   triagedat) — implements implementation.md §8.2's triage store as columns
--   rather than a separate triage table. The mock's incident_group (grouped
--   display rows) is a presentation projection, not modeled.
-- * task state CHECK adds 'CANCELED' and lacks the mock's 'Postponed' render
--   state; kind CHECK ('ANALYSIS','TRIAGE_CARRYOVER','BATCH_TAG','EXPORT',
--   'VERIFICATION').
-- * wave: position/startdate/enddate, org-scoped; the pm gate narrative
--   (now_pct, gate_state, schedule_pvs) is not modeled.
-- * tag_type (name, color, rank) replaces the mock's tag.category string.
-- * archetype is name+description only; the mock's match rule, profiles,
--   maintainers, and assessment columns are not modeled.
-- * Hub-only, no mock counterpart: analysis, analysis_profile (+sources/
--   targets joins), setting, user_settings, audit_entry, webhook,
--   webhook_delivery (+kinds join), archetype_criteria.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- Findings — referential gaps this schema surfaced in the mock's sample data
-- (recorded at the first cut; all fixed in SeedData.java during the entity
-- build — kept here as the rationale for the seed's referential assertions)
-- ----------------------------------------------------------------------------
-- Validated on PostgreSQL against the name-keyed mock projection: the mock's
-- full sample data (tenancy, 15 apps, credentials, agentic stores, tasks, run
-- comparison) loads under FK enforcement, with the mock's boot derivations
-- (stakeholders from team rosters, app owners via first-architect) reproduced
-- in SQL and the invariant checks passing. The load exposed dangling name
-- references the mock's untyped stores cannot see:
--
--   1. CREDS.usedBy display strings contradict MOCK_APPS: 'gitlab-pat —
--      7 applications' (actual apps referencing it: 3), 'github-wealth-pat —
--      2' (actual: 1). Same defect class as the archetype review rollup
--      (mock defect #44): store truth must win — derive usedBy, never
--      hand-set it.
--   2. MOCK_AGENTS reference skills absent from MOCK_SKILLS ('migiq' on
--      analyzer-jboss-eap-7-to-8).
--   3. MOCK_WFRUNS reference workflows absent from MOCK_WORKFLOWS (WR-9
--      smoke-verification, WR-10 namespace-migration, WR-11 quarkus-rewrite,
--      WR-15 claims-batch-rewrite).
--   4. MOCK_ARCHETYPES carry tags absent from MOCK_TAGS ('eap8', 'jboss').
--   5. MOCK_APPS reference business services absent from MOCK_BSVCS
--      ('Records', 'Imaging' — Meridian Health).
--
-- Items 2–5 are seed-data gaps (placeholders fix the load); item 1 is a
-- display-vs-store contradiction of the #44 class and worth fixing in the
-- mock itself.
