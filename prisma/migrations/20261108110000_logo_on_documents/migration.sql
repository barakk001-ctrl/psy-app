-- Settings → מיתוג: show the logo on the app's own document preview and draft
-- PDFs. Off for every existing account, so nothing changes until it is ticked.
ALTER TABLE "User" ADD COLUMN "logoOnDocuments" BOOLEAN NOT NULL DEFAULT false;
