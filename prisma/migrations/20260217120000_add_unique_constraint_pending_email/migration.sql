-- DropIndex (replaced by unique constraint which creates an implicit index)
DROP INDEX IF EXISTS "idx_users_pending_email";

-- CreateIndex (unique constraint on pending_email — prevents race condition
-- where two concurrent transactions both set the same pending_email value)
CREATE UNIQUE INDEX "users_pending_email_key" ON "users"("pending_email");
