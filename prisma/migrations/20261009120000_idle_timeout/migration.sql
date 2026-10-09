-- Automatic sign-out after inactivity (Settings → ניתוק אוטומטי); 30 minutes by default.
ALTER TABLE "User" ADD COLUMN "idleTimeoutMinutes" INTEGER NOT NULL DEFAULT 30;
