-- CreateEnum
CREATE TYPE "event_type" AS ENUM ('SYNC_STARTED', 'SYNC_COMPLETED', 'SYNC_FAILED', 'RECOMMENDATION_CREATED', 'RECOMMENDATION_ACCEPTED', 'RECOMMENDATION_DISMISSED', 'USER_INVITED', 'USER_JOINED', 'SETTINGS_UPDATED', 'SITE_CONNECTED', 'SITE_REMOVED');

-- CreateEnum
CREATE TYPE "actor_type" AS ENUM ('USER', 'SYSTEM', 'PLUGIN');

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "email_verified" TIMESTAMP(3),
    "password_hash" TEXT,
    "image" TEXT,
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable (partitioned by account_id for tenant isolation and query performance)
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "type" "event_type" NOT NULL,
    "actor_id" TEXT NOT NULL,
    "actor_type" "actor_type" NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "payload" JSONB,
    "parent_event_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id","account_id")
) PARTITION BY LIST ("account_id");

-- Default partition for the events table
CREATE TABLE "events_default" PARTITION OF "events" DEFAULT;

-- CreateTable
CREATE TABLE "account_summaries" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "total_sites" INTEGER NOT NULL DEFAULT 0,
    "total_pages" INTEGER NOT NULL DEFAULT 0,
    "pending_recommendations" INTEGER NOT NULL DEFAULT 0,
    "accepted_recommendations" INTEGER NOT NULL DEFAULT 0,
    "dismissed_recommendations" INTEGER NOT NULL DEFAULT 0,
    "last_sync_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_account_id" ON "users"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE INDEX "idx_sessions_user_id" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE INDEX "idx_events_account_id_created_at" ON "events"("account_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "account_summaries_account_id_key" ON "account_summaries"("account_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_parent_event_id_account_id_fkey" FOREIGN KEY ("parent_event_id", "account_id") REFERENCES "events"("id", "account_id") ON DELETE RESTRICT ON UPDATE CASCADE;
