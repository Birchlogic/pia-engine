# KaizenAI — Privacy Impact Assessment Engine (POC)

## Claude Code Master Instruction File

**Product**: KaizenAI Assessment Factory — PIA Module  
**Author**: Birchlogic Pvt Ltd  
**Version**: 0.1.0 (POC)  
**Last Updated**: February 2026

---

## 1. PRODUCT VISION

KaizenAI's PIA Engine is the first privacy assessment platform that generates organizational-level Privacy Impact Assessments from raw, unstructured interview data — producing machine-generated Data Matrices, interactive Data Flow Diagrams, and complete PIA reports without relying on questionnaires.

The core thesis: **every organization's privacy posture lives inside the heads of its people.** The platform extracts that knowledge through structured interviews across business verticals, converts scattered observations into a normalized data inventory, and renders the full picture as an interactive, filterable data flow diagram that a DPO can actually use.

This is not a questionnaire tool. This is not a checkbox tracker. This is a privacy execution engine that takes messy human input and produces regulator-ready artifacts.

---

## 2. USER PERSONAS & ROLES

**Senior Assessor / DPO** — The primary user. Creates org/project setups, assigns verticals, reviews auto-generated Data Matrices, approves them, triggers DFD generation, and exports final PIA reports. Has approval authority over all artifacts. Can view the Master DFD across all verticals.

**Privacy Analyst / Interviewer** — Conducts assessment interviews with vertical stakeholders. Uploads notes, transcripts, and audio/video recordings. Tags sessions by date, assessment criteria, and vertical. Can view but not approve Data Matrices.

**Vertical Stakeholder** — The person being interviewed (HR Manager, Engineering Lead, Customer Care Head, etc.). Does not use the platform directly but their input is the raw material. May receive read-only links to review their vertical's Data Matrix for factual accuracy.

**MSP Admin** — Manages multiple org/project setups across clients. Has cross-org visibility for portfolio management. Cannot see assessment data unless explicitly granted access.

---

## 3. DATA JOURNEY — END TO END

The platform's data journey has six distinct phases. Each phase produces artifacts that feed the next. No phase can be skipped.

### Phase 1: Org/Project Setup

The platform operates on a multi-tenant MSP model. Each client engagement is an "Org" (organization). Within an Org, there can be multiple "Projects" (e.g., "DPDPA Compliance 2026", "AI Governance Assessment Q1"). This allows Birchlogic to manage multiple client assessments simultaneously from a single dashboard.

**What gets created:**
- Org profile (name, industry, jurisdiction, regulatory scope, size band)
- Project profile (name, description, applicable regulations, assessment type, target completion date)
- Team assignments (which Birchlogic analysts are on this project)
- Vertical structure (see Phase 2)

**Data model considerations:**
- Orgs are completely isolated — zero data leakage between tenants
- Projects within an Org share the Org's base configuration but have independent assessment data
- All entities carry audit timestamps (created_at, updated_at, created_by)

### Phase 2: Org Chart & Vertical Definition

Every Org has a visual org chart that defines its business verticals. These verticals are the atomic units of assessment — each one gets interviewed independently, generates its own Data Matrix, and produces its own DFD before rolling up into the Master DFD.

**Default vertical templates** (customizable per Org):
- Human Resources
- Finance & Accounting
- Engineering / Product Development
- Customer Care / Support
- Sales & Marketing
- Legal & Compliance
- IT / Infrastructure
- Administration / Facilities
- Third-Party / Vendor Management
- Executive / Leadership

**Each vertical captures:**
- Vertical name and description
- Head of vertical (contact info, role)
- Number of assessment sessions planned
- Assessment status (not started → in progress → data matrix generated → data matrix approved → DFD generated)
- Linked interview sessions

**UI representation:** An interactive org chart (tree or grid layout) where each node is a vertical. Color-coded by assessment status. Clicking a vertical opens its assessment workspace.

### Phase 3: Interview Data Capture & Version Control

This is where the raw material enters the system. For each vertical, the assessment team conducts one or more interview sessions with stakeholders. Each session produces unstructured data that the platform must consume.

**Supported input types:**
- Free-text notes (typed directly or pasted)
- Transcripts (uploaded as .txt, .docx, .pdf)
- Audio recordings (uploaded as .mp3, .wav, .m4a — transcribed by the platform using Whisper or equivalent)
- Video recordings (uploaded as .mp4, .webm — audio track extracted and transcribed)
- Structured questionnaire responses (optional — for orgs that prefer guided interviews)
- Uploaded documents (policies, SOPs, data sharing agreements, vendor contracts, architecture diagrams)

**Version control model:**
- Each session is a versioned snapshot, identified by date + session number + assessment criteria tag
- Sessions are immutable once finalized — edits create new versions
- Assessment criteria tags define what the session was focused on (e.g., "Data Collection Practices", "Third-Party Sharing", "Retention & Deletion", "Access Controls", "Cross-Border Transfers", "AI/ML Usage", "Consent Mechanisms")
- A vertical can have multiple sessions across different dates and criteria — the platform tracks the full history

**Session metadata:**
- Session ID (auto-generated)
- Vertical ID (parent)
- Date and time
- Duration
- Interviewer(s)
- Interviewee(s) with roles
- Assessment criteria tags (multi-select)
- Status (draft → finalized)
- Version number
- Raw inputs (files, text)
- AI-generated transcript (if audio/video)
- AI-generated summary (always produced)

### Phase 4: AI-Powered Data Matrix Generation

This is the core intelligence layer. The platform consumes all session data for a given vertical and produces a comprehensive Data Matrix — a structured inventory of every data element, its relationships, classifications, processing activities, and risk indicators.

**AI Pipeline:**

Step 1 — **Transcription & Normalization**: Audio/video inputs are transcribed. All text inputs are normalized into a consistent format. OCR is applied to scanned documents. The output is a unified text corpus per vertical.

Step 2 — **Entity Extraction**: An NER pipeline (fine-tuned for privacy terminology) extracts data elements (e.g., "employee name", "customer email", "health records"), systems/applications (e.g., "Salesforce", "HRMS", "AWS S3"), actors/roles (e.g., "HR Manager", "external auditor"), processing activities (e.g., "collects", "stores", "shares with", "deletes after"), and third parties (e.g., "payroll provider", "cloud vendor", "regulator").

Step 3 — **Relationship Mapping**: Extracted entities are linked into a relationship graph. "HR collects employee health records via the HRMS and shares them with the insurance provider" becomes a structured relationship: Source(HR) → collects → DataElement(employee_health_records) → stored_in → System(HRMS) → shared_with → ThirdParty(insurance_provider).

Step 4 — **Classification & Enrichment**: Each data element is automatically classified across multiple dimensions:

- **Data Category**: Personal Data, Sensitive Personal Data, Non-Personal Data, Anonymized Data, Pseudonymized Data
- **Data Sub-Category** (for PII): Direct Identifiers (name, email, phone, ID numbers), Indirect Identifiers (DOB, gender, zip code), Sensitive Categories (health, biometric, financial, religious, political, sexual orientation, criminal, children's data, genetic, racial/ethnic)
- **Processing Types**: Collection, Recording, Organization, Structuring, Storage, Adaptation/Alteration, Retrieval, Consultation, Use, Disclosure by transmission, Dissemination, Alignment/Combination, Restriction, Erasure/Destruction, Profiling, Automated Decision-Making
- **Data Source**: Direct from data subject, Observed/inferred, Third-party provided, Publicly available, Generated/derived
- **Storage Classification**: At rest (encrypted/unencrypted), In transit (encrypted/unencrypted), In use
- **Retention Status**: Defined retention period, No defined retention, Exceeds retention, Pending deletion
- **Cross-Border Transfer**: Yes/No, Source jurisdiction, Destination jurisdiction, Transfer mechanism (SCCs, adequacy decision, BCRs, consent)
- **Legal Basis**: Consent, Contract, Legal obligation, Vital interests, Public task, Legitimate interests — mapped per applicable regulation
- **Access Controls**: Who has access (roles), Access type (read/write/admin), Authentication method
- **Risk Indicators**: Auto-scored based on data sensitivity × processing risk × volume × cross-border exposure

Step 5 — **Confidence Scoring & Gap Detection**: Every auto-generated cell in the Data Matrix gets a confidence score (0.0 to 1.0). Low-confidence items are flagged for human review. Gaps (e.g., "retention period not discussed for customer payment data") are surfaced as explicit action items.

Step 6 — **Data Matrix Assembly**: All extracted, classified, and enriched data is assembled into the final Data Matrix table.

**Data Matrix Schema (columns):**

| Column | Description |
|---|---|
| `data_element_id` | Unique identifier |
| `data_element_name` | Human-readable name (e.g., "Employee Health Records") |
| `data_category` | Personal / Sensitive Personal / Non-Personal / Anonymized / Pseudonymized |
| `data_sub_category` | Specific PII type (Direct Identifier, Indirect, Sensitive sub-type) |
| `data_subjects` | Who the data is about (employees, customers, vendors, children, etc.) |
| `source_of_data` | Where the data comes from (direct collection, third party, observed, etc.) |
| `collection_method` | How it is collected (web form, API, manual entry, sensor, etc.) |
| `purpose_of_processing` | Why the data is processed (HR management, marketing, legal compliance, etc.) |
| `legal_basis` | Legal ground for processing under applicable regulation |
| `consent_mechanism` | If consent-based: type (explicit, implied, opt-in, opt-out), collection point, withdrawal method |
| `processing_types` | All processing activities applied to this data element |
| `systems_applications` | Which systems/apps touch this data |
| `storage_location` | Where the data is stored (system, geography, cloud provider) |
| `storage_format` | Structured DB, unstructured file store, email, paper, etc. |
| `encryption_status` | At rest: Yes/No/Partial; In transit: Yes/No/Partial |
| `retention_period` | Defined period or "undefined" |
| `deletion_method` | How data is deleted (automated, manual, soft delete, hard delete, anonymization) |
| `access_roles` | Which roles/teams have access |
| `access_type` | Read / Write / Admin per role |
| `data_recipients` | Internal teams or external parties who receive the data |
| `third_party_sharing` | If shared externally: who, why, under what agreement |
| `cross_border_transfer` | Yes/No; if yes: destination country, transfer mechanism |
| `data_owner` | Business owner responsible for this data element |
| `vertical` | Which business vertical this data element belongs to |
| `risk_score` | Auto-calculated composite risk score (1-25 scale: sensitivity × processing risk × volume × exposure) |
| `confidence_score` | AI confidence in the accuracy of this row (0.0-1.0) |
| `gaps_flagged` | List of missing information items |
| `source_sessions` | Which interview sessions contributed to this row (linked by session IDs) |
| `last_updated` | Timestamp of last modification |
| `status` | Draft / Under Review / Approved |

### Phase 5: DFD Generation (Per-Vertical & Master)

Once the Senior Assessor reviews and approves a vertical's Data Matrix, they can trigger DFD generation. The DFD is not a static image — it is an interactive, filterable canvas.

**Per-Vertical DFD:**

The DFD for a single vertical visualizes every data flow captured in that vertical's approved Data Matrix. It renders as a directed graph where:

- **Nodes** represent: Data Sources (where data originates), Processing Activities (what happens to data), Data Stores (where data lives), External Entities (third parties, regulators, data subjects), and Systems/Applications
- **Edges** represent: Data flows between nodes, annotated with the data elements flowing along that edge, the classification of those elements, and the processing type
- **Node styling**: Color-coded by node type; badge indicators for risk level (green/yellow/orange/red); icons for encryption status, cross-border transfer, and retention compliance
- **Edge styling**: Line thickness proportional to data volume/sensitivity; dashed lines for third-party transfers; red highlights for unencrypted flows; arrows indicate direction

**Interactive filters on the DFD canvas:**
- **By Data Classification**: Show only PII, show only Sensitive PII, show only Non-Personal
- **By Processing Type**: Show only Collection flows, only Storage, only Transfer/Sharing, only Deletion
- **By Risk Level**: Show only High/Critical risk flows
- **By Retention Compliance**: Highlight all flows where retention is undefined or exceeded
- **By Cross-Border**: Highlight all cross-border data transfers
- **By Third-Party**: Show only flows involving external entities
- **By Legal Basis**: Filter by consent-based vs. legitimate interest vs. contractual
- **By System/Application**: Isolate all flows touching a specific system
- **Search**: Find a specific data element and highlight all paths it travels

**Master DFD:**

The Master DFD is generated once two or more vertical DFDs are approved. It is a ground-up aggregation that:

- Starts from individual data elements at the bottom
- Groups them by the vertical that owns/processes them
- Shows cross-vertical data flows (e.g., HR shares employee data with Finance for payroll, Engineering shares user analytics with Marketing)
- Rolls up to vertical-level ownership nodes at the top
- Includes all external entities (third parties, regulators) as boundary nodes

The Master DFD is essentially a "privacy map of the entire organization" — something no current tool on the market auto-generates from interview data.

**DFD Technical Implementation Notes:**
- Use React Flow (https://reactflow.dev/) or D3.js for the interactive canvas
- Nodes and edges are stored as a graph data structure (adjacency list or Neo4j property graph)
- DFD state is derived from the Data Matrix — any update to the matrix should offer to regenerate the DFD
- Export options: PNG, SVG, PDF (static), and interactive HTML (shareable link)
- Layout algorithms: Dagre (hierarchical) for per-vertical DFDs, force-directed for Master DFD

### Phase 6: PIA Report Generation (Future — Not in POC)

After the Master DFD is approved, the platform generates a complete PIA report aligned with ISO/IEC 29134:2023, including executive summary, processing description, necessity & proportionality analysis, risk register with heat map, controls assessment, treatment plan, and DPO sign-off section. This is out of scope for the POC but the data model should be designed to support it.

---

## 4. POC SCOPE — WHAT TO BUILD

The POC must demonstrate the end-to-end data journey from org setup through DFD generation. It does not need to be production-ready but it must be functionally complete enough to demo to a prospective client.

### In Scope (POC v0.1)

**P0 — Must Have:**
- Org/Project CRUD with multi-tenant isolation
- Org chart view with vertical management (add/edit/remove verticals)
- Interview session capture: text notes and transcript upload (.txt, .docx, .pdf)
- Session version control by date and assessment criteria tags
- AI-powered Data Matrix generation from uploaded session data (using Claude API or OpenAI API)
- Data Matrix table view with all columns defined in Phase 4
- Confidence scores and gap flagging on each row
- Manual editing of Data Matrix rows by Senior Assessor
- Approval workflow (Draft → Under Review → Approved) for Data Matrix
- Per-Vertical DFD generation from approved Data Matrix
- Interactive DFD canvas with at least 5 working filters (PII, processing type, risk level, retention, cross-border)
- Master DFD generation from 2+ approved vertical DFDs
- Basic authentication and role-based access (Senior Assessor vs. Analyst)

**P1 — Should Have:**
- Audio file upload with transcription (Whisper API)
- AI-generated session summaries
- Data Matrix export to Excel (.xlsx)
- DFD export to PNG/PDF
- Session-to-matrix traceability (click a matrix row → see which sessions contributed)

**P2 — Nice to Have (defer to v0.2):**
- Video upload and transcription
- Real-time collaborative editing on Data Matrix
- DFD annotation/commenting
- PIA report generation
- Risk heat map visualization
- Regulatory framework mapping (DPDPA, GDPR, CCPA selector)

### Out of Scope (POC)
- Production-grade security hardening
- SOC 2 / ISO 27001 compliance of the platform itself
- Mobile responsiveness
- Multi-language support
- Billing and subscription management
- Public API
- SSO / SAML integration

---

## 5. TECH STACK RECOMMENDATION (POC)

**Frontend:** Next.js 14+ (App Router) with TypeScript. Tailwind CSS for styling. shadcn/ui for component library. React Flow for DFD canvas. TanStack Table for Data Matrix views. Zustand for state management.

**Backend:** Next.js API routes for POC simplicity (monorepo). Alternatively, a separate FastAPI (Python) backend if heavy AI processing demands it. Prisma ORM for database access.

**Database:** PostgreSQL (via Supabase or Neon for managed hosting). JSON columns for flexible schema where needed (session metadata, AI extraction results). Separate schema per org for tenant isolation in POC (row-level security in production).

**AI/LLM Layer:** Anthropic Claude API (claude-sonnet-4-20250514 for extraction, claude-sonnet-4-20250514 for classification) or OpenAI GPT-4o. Structured output enforcement using Zod schemas + instructor library or BAML. Whisper API for audio transcription. LangChain or LangGraph for multi-step extraction pipeline orchestration.

**File Storage:** S3-compatible object storage (AWS S3, Supabase Storage, or MinIO for local dev). Files are never stored in the database.

**Auth:** NextAuth.js with credential provider for POC. JWT-based session management. Role field on user model (admin, senior_assessor, analyst).

**Deployment:** Vercel (frontend + API routes) or Railway/Fly.io for full-stack. PostgreSQL on Supabase/Neon.

---

## 6. DATABASE SCHEMA (CORE ENTITIES)

```
Organization
├── id (uuid, PK)
├── name (string)
├── industry (string)
├── jurisdiction (string)
├── regulatory_scope (string[]) — e.g., ["DPDPA", "GDPR"]
├── size_band (enum: micro, small, medium, large, enterprise)
├── created_at, updated_at
└── created_by (FK → User)

Project
├── id (uuid, PK)
├── org_id (FK → Organization)
├── name (string)
├── description (text)
├── applicable_regulations (string[])
├── assessment_type (enum: full_pia, dpia, ai_governance, custom)
├── target_completion_date (date)
├── status (enum: setup, in_progress, review, completed, archived)
├── created_at, updated_at
└── created_by (FK → User)

Vertical
├── id (uuid, PK)
├── project_id (FK → Project)
├── name (string)
├── description (text)
├── head_name (string)
├── head_role (string)
├── head_contact (string)
├── assessment_status (enum: not_started, in_progress, matrix_generated, matrix_approved, dfd_generated)
├── sort_order (int) — for org chart positioning
├── created_at, updated_at
└── created_by (FK → User)

InterviewSession
├── id (uuid, PK)
├── vertical_id (FK → Vertical)
├── session_date (datetime)
├── session_number (int) — auto-incremented per vertical
├── duration_minutes (int, nullable)
├── interviewer_names (string[])
├── interviewee_names (string[])
├── interviewee_roles (string[])
├── assessment_criteria_tags (string[]) — e.g., ["data_collection", "third_party_sharing"]
├── status (enum: draft, finalized)
├── version (int) — incremented on edit
├── parent_version_id (uuid, nullable, FK → InterviewSession) — for version chain
├── raw_text_notes (text, nullable)
├── ai_transcript (text, nullable) — generated from audio/video
├── ai_summary (text, nullable) — always generated
├── created_at, updated_at
└── created_by (FK → User)

SessionFile
├── id (uuid, PK)
├── session_id (FK → InterviewSession)
├── file_name (string)
├── file_type (enum: transcript_doc, audio, video, policy_doc, architecture_diagram, contract, other)
├── mime_type (string)
├── file_size_bytes (bigint)
├── storage_path (string) — S3 key
├── transcription_status (enum: not_applicable, pending, processing, completed, failed)
├── transcribed_text (text, nullable)
├── created_at
└── uploaded_by (FK → User)

DataMatrixRow
├── id (uuid, PK)
├── vertical_id (FK → Vertical)
├── data_element_name (string)
├── data_category (enum: personal, sensitive_personal, non_personal, anonymized, pseudonymized)
├── data_sub_category (string, nullable) — e.g., "health", "biometric", "financial"
├── data_subjects (string[]) — e.g., ["employees", "customers"]
├── source_of_data (string)
├── collection_method (string)
├── purpose_of_processing (string)
├── legal_basis (string)
├── consent_mechanism (jsonb, nullable) — {type, collection_point, withdrawal_method}
├── processing_types (string[]) — e.g., ["collection", "storage", "transfer"]
├── systems_applications (string[])
├── storage_location (string)
├── storage_format (string)
├── encryption_at_rest (enum: yes, no, partial, unknown)
├── encryption_in_transit (enum: yes, no, partial, unknown)
├── retention_period (string, nullable) — e.g., "3 years", "undefined"
├── retention_compliant (boolean, nullable) — null = not assessed
├── deletion_method (string, nullable)
├── access_roles (jsonb) — [{role, access_type}]
├── data_recipients_internal (string[])
├── data_recipients_external (string[])
├── third_party_details (jsonb, nullable) — [{party_name, purpose, agreement_type}]
├── cross_border_transfer (boolean)
├── cross_border_details (jsonb, nullable) — {destination_country, transfer_mechanism}
├── data_owner (string)
├── risk_score (int, 1-25)
├── confidence_score (float, 0.0-1.0)
├── gaps_flagged (string[])
├── source_session_ids (uuid[]) — FK references to InterviewSession
├── status (enum: draft, under_review, approved)
├── reviewed_by (FK → User, nullable)
├── reviewed_at (datetime, nullable)
├── created_at, updated_at
└── generated_by (enum: ai, manual)

DataMatrix (aggregate entity — represents the approved set for a vertical)
├── id (uuid, PK)
├── vertical_id (FK → Vertical, unique)
├── status (enum: draft, under_review, approved)
├── approved_by (FK → User, nullable)
├── approved_at (datetime, nullable)
├── generation_metadata (jsonb) — {model_used, prompt_version, generation_time_ms, total_rows, avg_confidence}
├── created_at, updated_at

DFDGraph
├── id (uuid, PK)
├── project_id (FK → Project)
├── vertical_id (FK → Vertical, nullable) — null for Master DFD
├── dfd_type (enum: vertical, master)
├── graph_data (jsonb) — Full React Flow compatible node/edge structure
├── layout_config (jsonb) — Layout algorithm settings, zoom, viewport
├── status (enum: draft, approved)
├── approved_by (FK → User, nullable)
├── approved_at (datetime, nullable)
├── generated_from_matrix_ids (uuid[]) — FK references to DataMatrix
├── created_at, updated_at

DFDNode
├── id (uuid, PK)
├── dfd_graph_id (FK → DFDGraph)
├── node_type (enum: data_source, processing_activity, data_store, external_entity, system_application, vertical_owner)
├── label (string)
├── metadata (jsonb) — type-specific properties
├── position_x (float)
├── position_y (float)
├── risk_level (enum: low, medium, high, critical, nullable)
├── vertical_id (FK → Vertical, nullable) — for Master DFD grouping

DFDEdge
├── id (uuid, PK)
├── dfd_graph_id (FK → DFDGraph)
├── source_node_id (FK → DFDNode)
├── target_node_id (FK → DFDNode)
├── data_elements (string[]) — what flows along this edge
├── data_classification (string) — highest classification of elements on this edge
├── processing_type (string) — collection, storage, transfer, etc.
├── is_encrypted (boolean)
├── is_cross_border (boolean)
├── risk_level (enum: low, medium, high, critical)
├── metadata (jsonb)

User
├── id (uuid, PK)
├── email (string, unique)
├── name (string)
├── role (enum: admin, senior_assessor, analyst)
├── org_id (FK → Organization, nullable) — null for MSP admins with cross-org access
├── created_at, updated_at
```

---

## 7. AI PIPELINE SPECIFICATION

### 7.1 Transcription Pipeline

**Input:** Audio/video file (mp3, wav, m4a, mp4, webm)  
**Process:** Extract audio track (ffmpeg for video) → send to Whisper API (or whisper.cpp for local) → return timestamped transcript  
**Output:** Plain text transcript with speaker diarization (if available), stored in `SessionFile.transcribed_text` and `InterviewSession.ai_transcript`

### 7.2 Session Summary Pipeline

**Input:** All text content for a session (notes + transcripts + uploaded doc text)  
**Process:** Single LLM call with structured output  
**Prompt strategy:**

```
You are a privacy assessment analyst. Summarize the following interview session 
conducted with {interviewee_role} from the {vertical_name} vertical.

Focus your summary on:
1. What personal data is collected, processed, or stored by this vertical
2. What systems and applications are used
3. Who has access to the data and why
4. Whether data is shared with third parties
5. Retention and deletion practices discussed
6. Any cross-border data transfers mentioned
7. Consent mechanisms described
8. Gaps or areas where the interviewee was uncertain

Session content:
{combined_text}

Return a structured JSON summary.
```

**Output:** Stored in `InterviewSession.ai_summary`

### 7.3 Data Matrix Generation Pipeline

This is the most complex pipeline. It operates on ALL finalized sessions for a vertical, not just one session.

**Input:** All finalized session content (notes + transcripts + summaries + uploaded documents) for a single vertical.

**Process:** Multi-step LLM chain:

**Step 1 — Entity Extraction** (per session, parallelizable):
```
Extract all privacy-relevant entities from this interview session transcript.

For each entity found, categorize it as one of:
- DATA_ELEMENT: A specific type of personal or organizational data (e.g., "employee name", "customer email", "health records", "IP address")
- SYSTEM: A software system, application, or platform (e.g., "Salesforce", "HRMS", "AWS S3 bucket")
- ACTOR: A person, role, or team that interacts with data (e.g., "HR Manager", "external auditor", "marketing team")
- PROCESSING_ACTIVITY: An action performed on data (e.g., "collects", "stores", "shares with", "deletes after 2 years")
- THIRD_PARTY: An external organization (e.g., "payroll provider ADP", "cloud vendor AWS", "insurance company")
- RELATIONSHIP: A connection between entities (e.g., "HR collects employee health records via HRMS")

Return as structured JSON array with entity type, name, context quote, and confidence score.
```

**Step 2 — Relationship Graph Construction** (aggregate all sessions):
```
Given the following extracted entities from multiple interview sessions for the 
{vertical_name} vertical, construct a relationship graph.

For each data element, determine:
- Who collects it and how
- Where it is stored
- What processing activities are performed on it
- Who has access
- Whether it is shared externally
- Cross-border transfer indicators

Entities: {merged_entity_list}

Return as structured JSON where each data element is a node with edges to related 
systems, actors, third parties, and processing activities.
```

**Step 3 — Classification & Enrichment** (per data element):
```
Classify the following data element according to privacy regulations.

Data Element: {element_name}
Context: {relationship_context}
Vertical: {vertical_name}
Organization Industry: {org_industry}
Applicable Regulations: {regulatory_scope}

Return a JSON object with all Data Matrix columns populated. 
For any field where the source material is insufficient, set confidence_score 
for that field below 0.5 and add the gap to gaps_flagged.
```

**Step 4 — Risk Scoring** (per data element):
```
Risk Score = Sensitivity Weight × Processing Risk × Volume Indicator × Exposure Factor

Sensitivity Weight (1-5):
  1 = Non-personal data
  2 = Pseudonymized / indirect identifiers
  3 = Direct personal identifiers
  4 = Sensitive personal data (financial, health)
  5 = Special category data (biometric, children's, genetic, criminal)

Processing Risk (1-5):
  1 = Storage only, well-controlled
  2 = Internal use, limited processing
  3 = Automated processing / profiling
  4 = Third-party sharing
  5 = Automated decision-making with legal effects + third-party sharing

Volume Indicator (1-5):
  Based on implied scale of data subjects affected

Exposure Factor (1-5):
  1 = No external access, encrypted, compliant retention
  2 = Limited external access, encrypted
  3 = External access OR unencrypted OR non-compliant retention
  4 = Cross-border transfer OR multiple third parties
  5 = Cross-border + unencrypted + no defined retention + multiple third parties

Final score = ceiling((S × P × V × E) / 25) mapped to 1-25 scale
```

**Step 5 — Deduplication & Merge**: Multiple sessions may reference the same data element. The pipeline must detect semantic duplicates (e.g., "employee email" and "staff email address") and merge them, combining source session references and taking the highest confidence classification for each field.

**Output:** Array of `DataMatrixRow` objects, persisted to database.

### 7.4 DFD Generation Pipeline

**Input:** Approved Data Matrix rows for a vertical (or all verticals for Master DFD).

**Process:** Graph construction algorithm (not LLM-dependent — deterministic):

1. Create nodes from unique values in: `systems_applications`, `data_recipients_external`, `data_subjects` (as data sources), `storage_location` (as data stores), `vertical` (for Master DFD)
2. Create edges from Data Matrix rows: each row implies flows from source → system → storage → recipients
3. Apply layout algorithm (Dagre for hierarchical, cola.js for constraint-based)
4. Compute node positions, edge routing, and visual properties (colors, sizes, badges)
5. Serialize to React Flow compatible JSON structure

**LLM-assisted step** (optional, for labels and grouping):
```
Given the following graph structure, suggest logical groupings and 
human-readable labels for the DFD layout. Group related systems into 
clusters. Suggest which nodes should be positioned as boundary entities.
```

**Output:** `DFDGraph` with `DFDNode[]` and `DFDEdge[]`, stored in database.

---

## 8. KEY TECHNICAL DECISIONS FOR POC

**Structured Output Enforcement:** Every LLM call must return valid JSON matching a Zod schema. Use `instructor` library (Python) or `zod + structured output mode` (TypeScript) to enforce this. Never parse free-text LLM output with regex.

**Idempotency:** Data Matrix generation for a vertical should be idempotent — running it twice on the same finalized sessions should produce the same result. Achieve this by hashing the input corpus and caching results.

**Progressive Loading:** Data Matrix generation may take 30-120 seconds for a vertical with many sessions. Use a job queue (BullMQ or Inngest) and stream progress to the UI via SSE or websockets. Show a progress indicator: "Extracting entities... (3/7 sessions processed)".

**Audit Trail:** Every AI-generated artifact must be traceable to its source sessions. Every human edit must be logged with before/after values, timestamp, and user. This is non-negotiable — regulators expect provenance.

**Graph Storage:** For the POC, store DFD graph data as JSONB in PostgreSQL. For production, consider Neo4j or Amazon Neptune for native graph queries (e.g., "find all paths from data element X to any external entity").

---

## 9. FILE/FOLDER STRUCTURE (RECOMMENDED)

```
kaizen-pia/
├── apps/
│   └── web/                          # Next.js application
│       ├── app/
│       │   ├── (auth)/               # Auth pages (login, register)
│       │   ├── (dashboard)/          # Authenticated pages
│       │   │   ├── orgs/             # Org listing and management
│       │   │   ├── orgs/[orgId]/     # Single org view
│       │   │   ├── projects/[projectId]/        # Project workspace
│       │   │   ├── projects/[projectId]/verticals/        # Org chart view
│       │   │   ├── projects/[projectId]/verticals/[verticalId]/  # Vertical workspace
│       │   │   ├── projects/[projectId]/verticals/[verticalId]/sessions/  # Interview sessions
│       │   │   ├── projects/[projectId]/verticals/[verticalId]/matrix/    # Data Matrix view
│       │   │   ├── projects/[projectId]/verticals/[verticalId]/dfd/       # Per-vertical DFD
│       │   │   └── projects/[projectId]/master-dfd/                       # Master DFD canvas
│       │   ├── api/                  # API routes
│       │   │   ├── orgs/
│       │   │   ├── projects/
│       │   │   ├── verticals/
│       │   │   ├── sessions/
│       │   │   ├── matrix/
│       │   │   ├── dfd/
│       │   │   ├── ai/              # AI pipeline endpoints
│       │   │   │   ├── transcribe/
│       │   │   │   ├── summarize/
│       │   │   │   ├── generate-matrix/
│       │   │   │   └── generate-dfd/
│       │   │   └── auth/
│       │   └── layout.tsx
│       ├── components/
│       │   ├── ui/                   # shadcn/ui components
│       │   ├── org-chart/            # Org chart visualization
│       │   ├── data-matrix/          # Matrix table components
│       │   ├── dfd-canvas/           # React Flow DFD components
│       │   ├── session/              # Interview session components
│       │   └── common/               # Shared components
│       ├── lib/
│       │   ├── ai/                   # AI pipeline logic
│       │   │   ├── transcription.ts
│       │   │   ├── entity-extraction.ts
│       │   │   ├── classification.ts
│       │   │   ├── matrix-generation.ts
│       │   │   ├── dfd-generation.ts
│       │   │   ├── risk-scoring.ts
│       │   │   └── prompts/          # All prompt templates
│       │   ├── db/                   # Prisma client and queries
│       │   ├── storage/              # S3 file management
│       │   ├── auth/                 # Auth utilities
│       │   └── utils/
│       ├── prisma/
│       │   └── schema.prisma         # Database schema
│       └── public/
├── packages/
│   └── shared/                       # Shared types, constants, validators
│       ├── types/
│       ├── schemas/                  # Zod schemas for AI output validation
│       └── constants/
├── .env.example
├── docker-compose.yml                # Local dev: Postgres + MinIO
├── package.json
└── turbo.json                        # Turborepo config (if monorepo)
```

---

## 10. UI WIREFRAME NOTES (FOR IMPLEMENTER)

**Org Chart View:** Grid or tree of cards, one per vertical. Each card shows: vertical name, head name/role, session count, assessment status (color-coded badge), and a progress bar. Clicking opens the vertical workspace.

**Session List View:** Chronological list with version indicators. Each session card shows date, interviewee, criteria tags as chips, and file attachments as icons. Finalized sessions have a lock icon.

**Data Matrix View:** Full-width table using TanStack Table with column resizing, sorting, filtering, and row expansion. Confidence scores shown as small colored bars in each cell (green > 0.8, yellow 0.5-0.8, red < 0.5). Gaps flagged with a warning icon that opens a popover with details. Row status shown as a badge. Bulk approval action for Senior Assessor.

**DFD Canvas:** Full-screen React Flow canvas with a left sidebar for filters (checkbox groups for each filter type). Minimap in bottom-right. Node details panel on right side (click a node → see all data elements, risk scores, connected entities). Zoom to fit button. Export button (PNG/PDF).

**Master DFD Canvas:** Same as per-vertical but with vertical grouping boxes (React Flow groups/subflows). A toggle to switch between "flat view" (all nodes) and "vertical-grouped view" (nodes clustered by vertical with inter-vertical flows highlighted).

---

## 11. DEVELOPMENT SEQUENCE (SPRINT PLAN)

**Sprint 1 (Week 1-2): Foundation**
- Project scaffolding (Next.js + Prisma + Postgres + Auth)
- Org/Project CRUD with basic UI
- User authentication and role setup
- File upload infrastructure (S3 integration)

**Sprint 2 (Week 3-4): Assessment Data Capture**
- Vertical management and org chart view
- Interview session CRUD with version control
- File upload (notes, transcripts, documents)
- Session metadata management (criteria tags, dates, participants)

**Sprint 3 (Week 5-6): AI Pipeline — Data Matrix**
- Transcription pipeline (Whisper integration)
- Entity extraction pipeline with structured output
- Classification and enrichment pipeline
- Risk scoring algorithm
- Data Matrix generation job (background processing)
- Data Matrix table UI with confidence indicators and gap flags

**Sprint 4 (Week 7-8): DFD Engine**
- Graph construction from Data Matrix
- React Flow integration with custom node/edge components
- Per-Vertical DFD generation and rendering
- Interactive filters (minimum 5)
- Master DFD generation from multiple verticals
- DFD export (PNG, PDF)

**Sprint 5 (Week 9-10): Polish & Demo-Ready**
- Approval workflows (Matrix approval → DFD trigger)
- Matrix export to Excel
- Session-to-Matrix traceability links
- UI polish, loading states, error handling
- Demo data seeding (realistic fake org with 4-5 verticals)
- Bug fixes and performance optimization

---

## 12. CRITICAL IMPLEMENTATION NOTES

**Do not hallucinate data.** The AI pipeline must only produce Data Matrix rows grounded in actual session content. If a data element is mentioned without enough context to classify it, set confidence to < 0.5 and flag the gap. Never invent retention periods, legal bases, or access controls that were not discussed.

**The Data Matrix is the single source of truth.** The DFD is a visualization of the matrix, not an independent data structure. If the matrix changes, the DFD must be regenerated. Do not allow manual DFD editing that contradicts the matrix.

**Assessment criteria tags are the taxonomy.** Use a controlled vocabulary for these tags. Suggested starting set: `data_collection`, `data_storage`, `data_processing`, `data_sharing_internal`, `data_sharing_external`, `cross_border_transfers`, `retention_deletion`, `access_controls`, `consent_mechanisms`, `ai_ml_usage`, `automated_decision_making`, `data_breach_response`, `data_subject_rights`, `third_party_management`, `security_measures`, `legal_basis`.

**Multi-session merging is the hardest problem.** Two sessions for the same vertical may describe the same data element differently. The merge logic must be robust — use semantic similarity (embeddings) to detect duplicates, and take the union of information (not the intersection) when merging.

**Performance budget for Data Matrix generation:** Target under 2 minutes for a vertical with up to 10 sessions averaging 5 pages each. Profile LLM call latency and parallelize where possible (entity extraction is parallelizable across sessions; classification is parallelizable across data elements).

---

## 13. COMPETITIVE POSITIONING NOTES

This system differs from Clearly AI in three fundamental ways: (1) it performs organizational-level PIAs across all business verticals, not just feature-level product reviews; (2) it generates auto-generated, interactive DFDs as a first-class artifact, not just assessment reports; (3) it produces a Master DFD showing cross-vertical data flows — a "privacy map of the organization" that does not exist in any current product. The closest competitor to this specific capability is Privado.ai's code-based DFD generation, but Privado only works for engineering teams with code access. KaizenAI works for any organization, including those with no codebase at all, because the input is human knowledge captured through interviews.
