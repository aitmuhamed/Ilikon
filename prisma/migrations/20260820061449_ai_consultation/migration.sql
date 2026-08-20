-- CreateEnum
CREATE TYPE "ConsultationStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'ASSESSED', 'PHARMACIST_REVIEW', 'REVIEWED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "ConsultationStep" AS ENUM ('CONSENT', 'BASICS', 'COMPLAINT', 'SYMPTOM_DETAILS', 'MEDICAL_HISTORY', 'ALLERGIES', 'MEDICATIONS', 'RED_FLAG_SCREENING', 'RESULT');

-- CreateEnum
CREATE TYPE "TriageLevel" AS ENUM ('EMERGENCY', 'URGENT_MEDICAL_REVIEW', 'PHARMACIST_CONSULTATION', 'SELF_CARE');

-- CreateEnum
CREATE TYPE "RecommendationType" AS ENUM ('EMERGENCY_CARE', 'DOCTOR_REVIEW', 'PHARMACIST_CONSULT', 'OTC_GUIDANCE');

-- CreateEnum
CREATE TYPE "AgeBand" AS ENUM ('UNDER_2', 'AGE_2_5', 'AGE_6_12', 'AGE_13_17', 'AGE_18_64', 'AGE_65_PLUS');

-- CreateEnum
CREATE TYPE "SexOption" AS ENUM ('MALE', 'FEMALE', 'UNDISCLOSED');

-- CreateEnum
CREATE TYPE "PregnancyStatus" AS ENUM ('PREGNANT', 'POSSIBLY_PREGNANT', 'BREASTFEEDING', 'NEITHER', 'UNDISCLOSED');

-- CreateEnum
CREATE TYPE "SymptomCourse" AS ENUM ('ACUTE', 'PERSISTENT', 'RECURRENT', 'CHRONIC');

-- CreateEnum
CREATE TYPE "RedFlagSource" AS ENUM ('RULE', 'FREE_TEXT', 'LLM', 'PHARMACIST');

-- CreateEnum
CREATE TYPE "RedFlagSeverity" AS ENUM ('EMERGENCY', 'URGENT');

-- CreateEnum
CREATE TYPE "SafetyCheckType" AS ENUM ('AGE', 'ALLERGY', 'PREGNANCY', 'BREASTFEEDING', 'CONDITION', 'INTERACTION', 'DUPLICATE_INGREDIENT', 'PRESCRIPTION_ONLY', 'AVAILABILITY', 'EXPIRY', 'DOSAGE', 'GUIDELINE_SCOPE');

-- CreateEnum
CREATE TYPE "SafetyCheckOutcome" AS ENUM ('PASS', 'WARN', 'BLOCK', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('SAFE_TO_SHOW', 'PHARMACIST_REVIEW_REQUIRED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "InteractionStatus" AS ENUM ('SAFE', 'CAUTION', 'SIGNIFICANT_RISK', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ConsultationReviewAction" AS ENUM ('ACCEPT', 'MODIFY', 'REJECT', 'NOTE', 'REQUEST_INFO', 'RECOMMEND_PRODUCT');

-- CreateEnum
CREATE TYPE "KnowledgeSourceType" AS ENUM ('PACKAGE_INSERT', 'PRODUCT_INFORMATION', 'PHARMACY_PROTOCOL', 'DRUG_INTERACTION_DB', 'CATALOGUE', 'FAQ');

-- CreateEnum
CREATE TYPE "MedicationEntrySource" AS ENUM ('CATALOGUE_SEARCH', 'MANUAL', 'BARCODE', 'PHOTO');

-- CreateEnum
CREATE TYPE "ContraindicationScope" AS ENUM ('AGE', 'PREGNANCY', 'BREASTFEEDING', 'CONDITION', 'ALLERGY');

-- CreateEnum
CREATE TYPE "RuleSeverity" AS ENUM ('BLOCK', 'PHARMACIST_REVIEW', 'WARN');

-- CreateTable
CREATE TABLE "consultations" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userId" TEXT,
    "sessionKey" TEXT NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'mn',
    "status" "ConsultationStatus" NOT NULL DEFAULT 'DRAFT',
    "currentStep" "ConsultationStep" NOT NULL DEFAULT 'CONSENT',
    "disclaimerAcceptedAt" TIMESTAMP(3),
    "disclaimerVersion" TEXT,
    "ageBand" "AgeBand",
    "exactAgeYears" INTEGER,
    "exactAgeMonths" INTEGER,
    "sex" "SexOption",
    "pregnancy" "PregnancyStatus",
    "primarySymptom" TEXT,
    "symptomFreeText" TEXT,
    "secondarySymptoms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "onsetCode" TEXT,
    "durationHours" INTEGER,
    "course" "SymptomCourse",
    "severity" INTEGER,
    "worsening" BOOLEAN,
    "triageLevel" "TriageLevel",
    "recommendationType" "RecommendationType",
    "triageReason" TEXT,
    "aiUnderstood" TEXT,
    "aiSafetyAssessment" TEXT,
    "aiNextStep" TEXT,
    "aiPrecautions" TEXT,
    "aiSeekCare" TEXT,
    "selfCareEligible" BOOLEAN NOT NULL DEFAULT false,
    "pharmacistReviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "aiModel" TEXT,
    "promptVersion" TEXT,
    "rulesVersion" TEXT,
    "llmUsed" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assessedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "handedOffAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "purgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultation_answers" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "step" "ConsultationStep" NOT NULL,
    "questionKey" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "answerValue" JSONB NOT NULL,
    "answerLabel" TEXT,
    "isRedFlagProbe" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "askedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultation_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultation_conditions" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "conditionCode" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultation_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultation_allergies" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "medication" TEXT NOT NULL,
    "ingredientKey" TEXT,
    "reaction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultation_allergies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultation_medications" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dose" TEXT,
    "frequency" TEXT,
    "source" "MedicationEntrySource" NOT NULL DEFAULT 'MANUAL',
    "productId" TEXT,
    "barcode" TEXT,
    "photoKey" TEXT,
    "ingredientKey" TEXT,
    "unresolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultation_medications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultation_red_flags" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "severity" "RedFlagSeverity" NOT NULL DEFAULT 'EMERGENCY',
    "source" "RedFlagSource" NOT NULL DEFAULT 'RULE',
    "evidence" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultation_red_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultation_safety_checks" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT,
    "type" "SafetyCheckType" NOT NULL,
    "outcome" "SafetyCheckOutcome" NOT NULL,
    "code" TEXT NOT NULL,
    "detail" TEXT,
    "ingredientKey" TEXT,
    "ruleId" TEXT,
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultation_safety_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultation_recommendations" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "categoryName" TEXT,
    "activeIngredients" TEXT,
    "dosageForm" TEXT,
    "strength" TEXT,
    "packageSize" TEXT,
    "price" INTEGER,
    "prescriptionRequired" BOOLEAN NOT NULL DEFAULT false,
    "stockQuantity" INTEGER,
    "imageKey" TEXT,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'PHARMACIST_REVIEW_REQUIRED',
    "rank" INTEGER NOT NULL DEFAULT 0,
    "safetyScore" INTEGER NOT NULL DEFAULT 0,
    "relevanceScore" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT,
    "safetyNotes" TEXT,
    "interactionStatus" "InteractionStatus" NOT NULL DEFAULT 'UNKNOWN',
    "blockedReason" TEXT,
    "guidelineId" TEXT,
    "sourceId" TEXT,
    "addedByPharmacist" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultation_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultation_reviews" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "pharmacistId" TEXT NOT NULL,
    "action" "ConsultationReviewAction" NOT NULL,
    "aiRecommendation" JSONB,
    "pharmacistRecommendation" TEXT,
    "reasonForChange" TEXT,
    "note" TEXT,
    "triageOverride" "TriageLevel",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultation_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultation_audit_entries" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "payload" JSONB,
    "aiModel" TEXT,
    "promptVersion" TEXT,
    "rulesVersion" TEXT,
    "latencyMs" INTEGER,
    "actorId" TEXT,
    "actorLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultation_audit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_sources" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "sourceType" "KnowledgeSourceType" NOT NULL,
    "title" TEXT NOT NULL,
    "reference" TEXT,
    "version" TEXT NOT NULL,
    "body" TEXT,
    "locale" "Locale",
    "productId" TEXT,
    "approvedBy" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "active_ingredients" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameMn" TEXT NOT NULL,
    "nameRu" TEXT,
    "className" TEXT,
    "classKey" TEXT,
    "isOtc" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "active_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medication_aliases" (
    "id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "ingredientKey" TEXT NOT NULL,
    "locale" "Locale",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medication_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_ingredients" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "ingredientKey" TEXT NOT NULL,
    "strengthMg" INTEGER,
    "strengthLabel" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "product_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otc_guidelines" (
    "id" TEXT NOT NULL,
    "symptomCode" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "categorySlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ingredientKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "minAgeYears" INTEGER,
    "maxSelfCareDays" INTEGER NOT NULL DEFAULT 7,
    "rationaleMn" TEXT NOT NULL,
    "rationaleEn" TEXT NOT NULL,
    "rationaleRu" TEXT NOT NULL,
    "precautionMn" TEXT,
    "precautionEn" TEXT,
    "precautionRu" TEXT,
    "pregnancyNeedsPharmacist" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "otc_guidelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contraindication_rules" (
    "id" TEXT NOT NULL,
    "ingredientKey" TEXT NOT NULL,
    "scope" "ContraindicationScope" NOT NULL,
    "severity" "RuleSeverity" NOT NULL DEFAULT 'BLOCK',
    "conditionCode" TEXT,
    "minAgeYears" INTEGER,
    "minAgeMonths" INTEGER,
    "maxAgeYears" INTEGER,
    "messageMn" TEXT NOT NULL,
    "messageEn" TEXT NOT NULL,
    "messageRu" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contraindication_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interaction_rules" (
    "id" TEXT NOT NULL,
    "ingredientKeyA" TEXT NOT NULL,
    "ingredientKeyB" TEXT NOT NULL,
    "status" "InteractionStatus" NOT NULL,
    "adviceMn" TEXT NOT NULL,
    "adviceEn" TEXT NOT NULL,
    "adviceRu" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interaction_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "consultations_code_key" ON "consultations"("code");

-- CreateIndex
CREATE UNIQUE INDEX "consultations_sessionKey_key" ON "consultations"("sessionKey");

-- CreateIndex
CREATE INDEX "consultations_userId_idx" ON "consultations"("userId");

-- CreateIndex
CREATE INDEX "consultations_status_idx" ON "consultations"("status");

-- CreateIndex
CREATE INDEX "consultations_triageLevel_idx" ON "consultations"("triageLevel");

-- CreateIndex
CREATE INDEX "consultations_primarySymptom_idx" ON "consultations"("primarySymptom");

-- CreateIndex
CREATE INDEX "consultations_createdAt_idx" ON "consultations"("createdAt");

-- CreateIndex
CREATE INDEX "consultations_expiresAt_idx" ON "consultations"("expiresAt");

-- CreateIndex
CREATE INDEX "consultation_answers_consultationId_idx" ON "consultation_answers"("consultationId");

-- CreateIndex
CREATE UNIQUE INDEX "consultation_answers_consultationId_questionKey_key" ON "consultation_answers"("consultationId", "questionKey");

-- CreateIndex
CREATE INDEX "consultation_conditions_consultationId_idx" ON "consultation_conditions"("consultationId");

-- CreateIndex
CREATE UNIQUE INDEX "consultation_conditions_consultationId_conditionCode_key" ON "consultation_conditions"("consultationId", "conditionCode");

-- CreateIndex
CREATE INDEX "consultation_allergies_consultationId_idx" ON "consultation_allergies"("consultationId");

-- CreateIndex
CREATE INDEX "consultation_allergies_ingredientKey_idx" ON "consultation_allergies"("ingredientKey");

-- CreateIndex
CREATE INDEX "consultation_medications_consultationId_idx" ON "consultation_medications"("consultationId");

-- CreateIndex
CREATE INDEX "consultation_medications_productId_idx" ON "consultation_medications"("productId");

-- CreateIndex
CREATE INDEX "consultation_medications_ingredientKey_idx" ON "consultation_medications"("ingredientKey");

-- CreateIndex
CREATE INDEX "consultation_red_flags_consultationId_idx" ON "consultation_red_flags"("consultationId");

-- CreateIndex
CREATE INDEX "consultation_red_flags_code_idx" ON "consultation_red_flags"("code");

-- CreateIndex
CREATE UNIQUE INDEX "consultation_red_flags_consultationId_code_key" ON "consultation_red_flags"("consultationId", "code");

-- CreateIndex
CREATE INDEX "consultation_safety_checks_consultationId_idx" ON "consultation_safety_checks"("consultationId");

-- CreateIndex
CREATE INDEX "consultation_safety_checks_type_idx" ON "consultation_safety_checks"("type");

-- CreateIndex
CREATE INDEX "consultation_safety_checks_outcome_idx" ON "consultation_safety_checks"("outcome");

-- CreateIndex
CREATE INDEX "consultation_recommendations_consultationId_idx" ON "consultation_recommendations"("consultationId");

-- CreateIndex
CREATE INDEX "consultation_recommendations_productId_idx" ON "consultation_recommendations"("productId");

-- CreateIndex
CREATE INDEX "consultation_recommendations_status_idx" ON "consultation_recommendations"("status");

-- CreateIndex
CREATE INDEX "consultation_reviews_consultationId_idx" ON "consultation_reviews"("consultationId");

-- CreateIndex
CREATE INDEX "consultation_reviews_pharmacistId_idx" ON "consultation_reviews"("pharmacistId");

-- CreateIndex
CREATE INDEX "consultation_audit_entries_consultationId_idx" ON "consultation_audit_entries"("consultationId");

-- CreateIndex
CREATE INDEX "consultation_audit_entries_stage_idx" ON "consultation_audit_entries"("stage");

-- CreateIndex
CREATE INDEX "consultation_audit_entries_createdAt_idx" ON "consultation_audit_entries"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_sources_key_key" ON "knowledge_sources"("key");

-- CreateIndex
CREATE INDEX "knowledge_sources_sourceType_idx" ON "knowledge_sources"("sourceType");

-- CreateIndex
CREATE INDEX "knowledge_sources_isActive_idx" ON "knowledge_sources"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "active_ingredients_key_key" ON "active_ingredients"("key");

-- CreateIndex
CREATE INDEX "active_ingredients_classKey_idx" ON "active_ingredients"("classKey");

-- CreateIndex
CREATE UNIQUE INDEX "medication_aliases_alias_key" ON "medication_aliases"("alias");

-- CreateIndex
CREATE INDEX "medication_aliases_ingredientKey_idx" ON "medication_aliases"("ingredientKey");

-- CreateIndex
CREATE INDEX "product_ingredients_ingredientKey_idx" ON "product_ingredients"("ingredientKey");

-- CreateIndex
CREATE UNIQUE INDEX "product_ingredients_productId_ingredientKey_key" ON "product_ingredients"("productId", "ingredientKey");

-- CreateIndex
CREATE UNIQUE INDEX "otc_guidelines_key_key" ON "otc_guidelines"("key");

-- CreateIndex
CREATE INDEX "otc_guidelines_symptomCode_idx" ON "otc_guidelines"("symptomCode");

-- CreateIndex
CREATE INDEX "otc_guidelines_isActive_idx" ON "otc_guidelines"("isActive");

-- CreateIndex
CREATE INDEX "contraindication_rules_ingredientKey_idx" ON "contraindication_rules"("ingredientKey");

-- CreateIndex
CREATE INDEX "contraindication_rules_scope_idx" ON "contraindication_rules"("scope");

-- CreateIndex
CREATE INDEX "contraindication_rules_isActive_idx" ON "contraindication_rules"("isActive");

-- CreateIndex
CREATE INDEX "interaction_rules_ingredientKeyA_idx" ON "interaction_rules"("ingredientKeyA");

-- CreateIndex
CREATE INDEX "interaction_rules_ingredientKeyB_idx" ON "interaction_rules"("ingredientKeyB");

-- CreateIndex
CREATE UNIQUE INDEX "interaction_rules_ingredientKeyA_ingredientKeyB_key" ON "interaction_rules"("ingredientKeyA", "ingredientKeyB");

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_answers" ADD CONSTRAINT "consultation_answers_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_conditions" ADD CONSTRAINT "consultation_conditions_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_allergies" ADD CONSTRAINT "consultation_allergies_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_medications" ADD CONSTRAINT "consultation_medications_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_medications" ADD CONSTRAINT "consultation_medications_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_red_flags" ADD CONSTRAINT "consultation_red_flags_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_safety_checks" ADD CONSTRAINT "consultation_safety_checks_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_safety_checks" ADD CONSTRAINT "consultation_safety_checks_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "knowledge_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_recommendations" ADD CONSTRAINT "consultation_recommendations_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_recommendations" ADD CONSTRAINT "consultation_recommendations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_recommendations" ADD CONSTRAINT "consultation_recommendations_guidelineId_fkey" FOREIGN KEY ("guidelineId") REFERENCES "otc_guidelines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_recommendations" ADD CONSTRAINT "consultation_recommendations_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "knowledge_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_reviews" ADD CONSTRAINT "consultation_reviews_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_reviews" ADD CONSTRAINT "consultation_reviews_pharmacistId_fkey" FOREIGN KEY ("pharmacistId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_audit_entries" ADD CONSTRAINT "consultation_audit_entries_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_aliases" ADD CONSTRAINT "medication_aliases_ingredientKey_fkey" FOREIGN KEY ("ingredientKey") REFERENCES "active_ingredients"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_ingredients" ADD CONSTRAINT "product_ingredients_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_ingredients" ADD CONSTRAINT "product_ingredients_ingredientKey_fkey" FOREIGN KEY ("ingredientKey") REFERENCES "active_ingredients"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otc_guidelines" ADD CONSTRAINT "otc_guidelines_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "knowledge_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contraindication_rules" ADD CONSTRAINT "contraindication_rules_ingredientKey_fkey" FOREIGN KEY ("ingredientKey") REFERENCES "active_ingredients"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contraindication_rules" ADD CONSTRAINT "contraindication_rules_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "knowledge_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interaction_rules" ADD CONSTRAINT "interaction_rules_ingredientKeyA_fkey" FOREIGN KEY ("ingredientKeyA") REFERENCES "active_ingredients"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interaction_rules" ADD CONSTRAINT "interaction_rules_ingredientKeyB_fkey" FOREIGN KEY ("ingredientKeyB") REFERENCES "active_ingredients"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interaction_rules" ADD CONSTRAINT "interaction_rules_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "knowledge_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
