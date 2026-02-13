-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'senior_assessor', 'analyst');

-- CreateEnum
CREATE TYPE "SizeBand" AS ENUM ('micro', 'small', 'medium', 'large', 'enterprise');

-- CreateEnum
CREATE TYPE "AssessmentType" AS ENUM ('full_pia', 'dpia', 'ai_governance', 'custom');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('setup', 'in_progress', 'review', 'completed', 'archived');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('not_started', 'in_progress', 'matrix_generated', 'matrix_approved', 'dfd_generated');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('draft', 'finalized');

-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('transcript_doc', 'audio', 'video', 'policy_doc', 'architecture_diagram', 'contract', 'other');

-- CreateEnum
CREATE TYPE "TranscriptionStatus" AS ENUM ('not_applicable', 'pending', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "DataCategory" AS ENUM ('personal', 'sensitive_personal', 'non_personal', 'anonymized', 'pseudonymized');

-- CreateEnum
CREATE TYPE "EncryptionStatus" AS ENUM ('yes', 'no', 'partial', 'unknown');

-- CreateEnum
CREATE TYPE "MatrixRowStatus" AS ENUM ('draft', 'under_review', 'approved');

-- CreateEnum
CREATE TYPE "MatrixStatus" AS ENUM ('draft', 'under_review', 'approved');

-- CreateEnum
CREATE TYPE "DFDType" AS ENUM ('vertical', 'master');

-- CreateEnum
CREATE TYPE "DFDStatus" AS ENUM ('draft', 'approved');

-- CreateEnum
CREATE TYPE "DFDNodeType" AS ENUM ('data_source', 'processing_activity', 'data_store', 'external_entity', 'system_application', 'vertical_owner');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "GeneratedBy" AS ENUM ('ai', 'manual');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'analyst',
    "org_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "jurisdiction" TEXT,
    "regulatory_scope" TEXT[],
    "size_band" "SizeBand",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "applicable_regulations" TEXT[],
    "assessment_type" "AssessmentType" NOT NULL DEFAULT 'full_pia',
    "target_completion_date" TIMESTAMP(3),
    "status" "ProjectStatus" NOT NULL DEFAULT 'setup',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verticals" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "head_name" TEXT,
    "head_role" TEXT,
    "head_contact" TEXT,
    "assessment_status" "AssessmentStatus" NOT NULL DEFAULT 'not_started',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "verticals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_sessions" (
    "id" TEXT NOT NULL,
    "vertical_id" TEXT NOT NULL,
    "session_date" TIMESTAMP(3) NOT NULL,
    "session_number" INTEGER NOT NULL,
    "duration_minutes" INTEGER,
    "interviewer_names" TEXT[],
    "interviewee_names" TEXT[],
    "interviewee_roles" TEXT[],
    "assessment_criteria_tags" TEXT[],
    "status" "SessionStatus" NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "parent_version_id" TEXT,
    "raw_text_notes" TEXT,
    "ai_transcript" TEXT,
    "ai_summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "interview_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_files" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_type" "FileType" NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "transcription_status" "TranscriptionStatus" NOT NULL DEFAULT 'not_applicable',
    "transcribed_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_by" TEXT NOT NULL,

    CONSTRAINT "session_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_matrix_rows" (
    "id" TEXT NOT NULL,
    "vertical_id" TEXT NOT NULL,
    "data_element_name" TEXT NOT NULL,
    "data_category" "DataCategory" NOT NULL,
    "data_sub_category" TEXT,
    "data_subjects" TEXT[],
    "source_of_data" TEXT,
    "collection_method" TEXT,
    "purpose_of_processing" TEXT,
    "legal_basis" TEXT,
    "consent_mechanism" JSONB,
    "processing_types" TEXT[],
    "systems_applications" TEXT[],
    "storage_location" TEXT,
    "storage_format" TEXT,
    "encryption_at_rest" "EncryptionStatus" NOT NULL DEFAULT 'unknown',
    "encryption_in_transit" "EncryptionStatus" NOT NULL DEFAULT 'unknown',
    "retention_period" TEXT,
    "retention_compliant" BOOLEAN,
    "deletion_method" TEXT,
    "access_roles" JSONB,
    "data_recipients_internal" TEXT[],
    "data_recipients_external" TEXT[],
    "third_party_details" JSONB,
    "cross_border_transfer" BOOLEAN NOT NULL DEFAULT false,
    "cross_border_details" JSONB,
    "data_owner" TEXT,
    "risk_score" INTEGER NOT NULL DEFAULT 1,
    "confidence_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gaps_flagged" TEXT[],
    "source_session_ids" TEXT[],
    "status" "MatrixRowStatus" NOT NULL DEFAULT 'draft',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "generated_by" "GeneratedBy" NOT NULL DEFAULT 'ai',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_matrix_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_matrices" (
    "id" TEXT NOT NULL,
    "vertical_id" TEXT NOT NULL,
    "status" "MatrixStatus" NOT NULL DEFAULT 'draft',
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "generation_metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_matrices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dfd_graphs" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "vertical_id" TEXT,
    "dfd_type" "DFDType" NOT NULL,
    "graph_data" JSONB,
    "layout_config" JSONB,
    "status" "DFDStatus" NOT NULL DEFAULT 'draft',
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "generated_from_matrix_ids" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dfd_graphs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dfd_nodes" (
    "id" TEXT NOT NULL,
    "dfd_graph_id" TEXT NOT NULL,
    "node_type" "DFDNodeType" NOT NULL,
    "label" TEXT NOT NULL,
    "metadata" JSONB,
    "position_x" DOUBLE PRECISION NOT NULL,
    "position_y" DOUBLE PRECISION NOT NULL,
    "risk_level" "RiskLevel",
    "vertical_id" TEXT,

    CONSTRAINT "dfd_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dfd_edges" (
    "id" TEXT NOT NULL,
    "dfd_graph_id" TEXT NOT NULL,
    "source_node_id" TEXT NOT NULL,
    "target_node_id" TEXT NOT NULL,
    "data_elements" TEXT[],
    "data_classification" TEXT,
    "processing_type" TEXT,
    "is_encrypted" BOOLEAN NOT NULL DEFAULT false,
    "is_cross_border" BOOLEAN NOT NULL DEFAULT false,
    "risk_level" "RiskLevel" NOT NULL DEFAULT 'low',
    "metadata" JSONB,

    CONSTRAINT "dfd_edges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "data_matrices_vertical_id_key" ON "data_matrices"("vertical_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verticals" ADD CONSTRAINT "verticals_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verticals" ADD CONSTRAINT "verticals_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_vertical_id_fkey" FOREIGN KEY ("vertical_id") REFERENCES "verticals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_parent_version_id_fkey" FOREIGN KEY ("parent_version_id") REFERENCES "interview_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_files" ADD CONSTRAINT "session_files_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "interview_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_files" ADD CONSTRAINT "session_files_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_matrix_rows" ADD CONSTRAINT "data_matrix_rows_vertical_id_fkey" FOREIGN KEY ("vertical_id") REFERENCES "verticals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_matrix_rows" ADD CONSTRAINT "data_matrix_rows_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_matrices" ADD CONSTRAINT "data_matrices_vertical_id_fkey" FOREIGN KEY ("vertical_id") REFERENCES "verticals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_matrices" ADD CONSTRAINT "data_matrices_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dfd_graphs" ADD CONSTRAINT "dfd_graphs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dfd_graphs" ADD CONSTRAINT "dfd_graphs_vertical_id_fkey" FOREIGN KEY ("vertical_id") REFERENCES "verticals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dfd_graphs" ADD CONSTRAINT "dfd_graphs_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dfd_nodes" ADD CONSTRAINT "dfd_nodes_dfd_graph_id_fkey" FOREIGN KEY ("dfd_graph_id") REFERENCES "dfd_graphs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dfd_edges" ADD CONSTRAINT "dfd_edges_dfd_graph_id_fkey" FOREIGN KEY ("dfd_graph_id") REFERENCES "dfd_graphs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dfd_edges" ADD CONSTRAINT "dfd_edges_source_node_id_fkey" FOREIGN KEY ("source_node_id") REFERENCES "dfd_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dfd_edges" ADD CONSTRAINT "dfd_edges_target_node_id_fkey" FOREIGN KEY ("target_node_id") REFERENCES "dfd_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
