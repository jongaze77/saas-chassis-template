-- AddForeignKey
ALTER TABLE "account_summaries" ADD CONSTRAINT "account_summaries_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
