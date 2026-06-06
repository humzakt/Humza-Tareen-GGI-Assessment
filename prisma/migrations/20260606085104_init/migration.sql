-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('LOCAL', 'GOOGLE_MOCK');

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('BASIC', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "UsageType" AS ENUM ('FREE', 'BUNDLE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "authProvider" "AuthProvider" NOT NULL DEFAULT 'LOCAL',
    "freeMessagesUsed" INTEGER NOT NULL DEFAULT 0,
    "freeQuotaResetDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "tokenUsage" JSONB NOT NULL,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" "SubscriptionTier" NOT NULL,
    "billingCycle" "BillingCycle" NOT NULL,
    "maxMessages" INTEGER NOT NULL,
    "remainingMessages" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "renewalDate" TIMESTAMP(3) NOT NULL,
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "type" "UsageType" NOT NULL,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "success" BOOLEAN NOT NULL,
    "failureReason" TEXT,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_tokenHash_idx" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "chat_messages_userId_idx" ON "chat_messages"("userId");

-- CreateIndex
CREATE INDEX "chat_messages_createdAt_idx" ON "chat_messages"("createdAt");

-- CreateIndex
CREATE INDEX "subscriptions_userId_active_idx" ON "subscriptions"("userId", "active");

-- CreateIndex
CREATE INDEX "subscriptions_endDate_autoRenew_active_idx" ON "subscriptions"("endDate", "autoRenew", "active");

-- CreateIndex
CREATE INDEX "usage_logs_userId_createdAt_idx" ON "usage_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "payment_logs_userId_idx" ON "payment_logs"("userId");

-- CreateIndex
CREATE INDEX "payment_logs_subscriptionId_idx" ON "payment_logs"("subscriptionId");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_logs" ADD CONSTRAINT "payment_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_logs" ADD CONSTRAINT "payment_logs_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
