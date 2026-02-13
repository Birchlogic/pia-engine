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
CREATE TABLE "data_matrices" (
    "id" TEXT NOT NULL,
    "vertical_id" TEXT NOT NULL,
    "schema_one_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_matrices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_mapping_rows" (
    "id" TEXT NOT NULL,
    "vertical_id" TEXT NOT NULL,
    "s_no" INTEGER NOT NULL,
    "data_category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "data_owner" TEXT NOT NULL,
    "storage_location" TEXT NOT NULL,
    "data_classification" TEXT NOT NULL,
    "retention_period" TEXT NOT NULL,
    "legal_basis" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_mapping_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dfd_graphs" (
    "id" TEXT NOT NULL,
    "vertical_id" TEXT NOT NULL,
    "mermaid_code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dfd_graphs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "data_matrices_vertical_id_key" ON "data_matrices"("vertical_id");

-- CreateIndex
CREATE UNIQUE INDEX "dfd_graphs_vertical_id_key" ON "dfd_graphs"("vertical_id");

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
ALTER TABLE "data_matrices" ADD CONSTRAINT "data_matrices_vertical_id_fkey" FOREIGN KEY ("vertical_id") REFERENCES "verticals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_mapping_rows" ADD CONSTRAINT "data_mapping_rows_vertical_id_fkey" FOREIGN KEY ("vertical_id") REFERENCES "verticals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dfd_graphs" ADD CONSTRAINT "dfd_graphs_vertical_id_fkey" FOREIGN KEY ("vertical_id") REFERENCES "verticals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
