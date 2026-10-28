-- Grow callbacks: match each to the checkout we created (user/plan/amount
-- stored server-side, never read from the unsigned payload) and apply it once.
-- BillingEvent stays as the log of every callback; its transactionId is no
-- longer unique (an unverified, possibly forged, callback must not block the
-- real one). No rows are changed or removed.
CREATE TABLE "GrowCheckout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "sum" DOUBLE PRECISION NOT NULL,
    "processId" TEXT NOT NULL,
    "processToken" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),
    CONSTRAINT "GrowCheckout_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GrowCheckout_processId_key" ON "GrowCheckout"("processId");
CREATE INDEX "GrowCheckout_userId_createdAt_idx" ON "GrowCheckout"("userId", "createdAt" DESC);

DROP INDEX "BillingEvent_transactionId_key";
CREATE INDEX "BillingEvent_transactionId_idx" ON "BillingEvent"("transactionId");
