import { prisma } from '../../../../lib/prisma/client';
import { IChatRepository } from '../../domain/repositories/chat.repository.interface';
import { QuotaService, QuotaDeductionResult } from '../../domain/services/quota.service';
import { generateMockResponse } from '../../infrastructure/services/mock-openai.service';
import { isUnlimited, SubscriptionTier } from '../../../../lib/registries/subscription-tier.registry';
import { logger } from '../../../../lib/logger/logger';
import { LOG_EVENTS, LOG_MODULES } from '../../../../lib/logger/logger.constants';
import { ChatMessageEntity } from '../../domain/entities/chat-message.entity';

interface SendMessageInput {
  userId: string;
  question: string;
  correlationId: string;
  requestId: string;
}

interface SendMessageOutput {
  message: ChatMessageEntity;
  quotaSource: 'FREE' | 'BUNDLE';
  subscriptionId?: string;
}

export class SendMessageUseCase {
  private quotaService = new QuotaService();

  constructor(
    private chatRepo: IChatRepository,
  ) {}

  async execute(input: SendMessageInput): Promise<SendMessageOutput> {
    const logCtx = {
      module: LOG_MODULES.CHAT,
      correlationId: input.correlationId,
      requestId: input.requestId,
      userId: input.userId,
    };

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: input.userId } });
      const subscriptions = await tx.subscription.findMany({
        where: { userId: input.userId, active: true },
        orderBy: { remainingMessages: 'desc' },
      });

      logger.info(LOG_EVENTS.QUOTA_CHECKED, logCtx, {
        freeUsed: user.freeMessagesUsed,
        activeSubscriptions: subscriptions.length,
      });

      const deduction: QuotaDeductionResult = this.quotaService.checkAndDeduct(
        { freeMessagesUsed: user.freeMessagesUsed, freeQuotaResetDate: user.freeQuotaResetDate },
        subscriptions.map((s) => ({
          id: s.id,
          tier: s.tier as SubscriptionTier,
          remainingMessages: s.remainingMessages,
          active: s.active,
        })),
      );

      if (deduction.source === 'FREE') {
        await tx.user.update({
          where: { id: input.userId },
          data: {
            freeMessagesUsed: deduction.newFreeMessagesUsed,
            freeQuotaResetDate: deduction.newResetDate,
          },
        });
      } else if (deduction.subscriptionId) {
        const sub = subscriptions.find((s) => s.id === deduction.subscriptionId);
        if (sub && !isUnlimited(sub.tier as SubscriptionTier)) {
          await tx.subscription.update({
            where: { id: deduction.subscriptionId },
            data: { remainingMessages: { decrement: 1 } },
          });
        }
      }

      await tx.usageLog.create({
        data: {
          userId: input.userId,
          subscriptionId: deduction.subscriptionId ?? null,
          type: deduction.source,
          correlationId: input.correlationId,
        },
      });

      logger.info(LOG_EVENTS.QUOTA_DEDUCTED, logCtx, {
        source: deduction.source,
        subscriptionId: deduction.subscriptionId,
      });

      return deduction;
    });

    logger.info(LOG_EVENTS.AI_REQUEST_START, logCtx, { question: input.question.slice(0, 100) });
    const aiStartTime = Date.now();
    const aiResponse = await generateMockResponse(input.question);
    logger.info(LOG_EVENTS.AI_REQUEST_END, logCtx, {
      latencyMs: Date.now() - aiStartTime,
      tokens: aiResponse.tokenUsage.totalTokens,
    });

    const message = await this.chatRepo.create({
      userId: input.userId,
      question: input.question,
      answer: aiResponse.answer,
      tokenUsage: aiResponse.tokenUsage,
      correlationId: input.correlationId,
    });

    logger.info(LOG_EVENTS.MESSAGE_STORED, logCtx, { messageId: message.id });

    return {
      message,
      quotaSource: result.source,
      subscriptionId: result.subscriptionId,
    };
  }
}
