-- Sent-record for the trial/subscription emails. A new, empty table: nothing
-- existing changes.
CREATE TABLE "SubscriptionNotice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionNotice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubscriptionNotice_userId_stage_periodEnd_key" ON "SubscriptionNotice"("userId", "stage", "periodEnd");

ALTER TABLE "SubscriptionNotice" ADD CONSTRAINT "SubscriptionNotice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
