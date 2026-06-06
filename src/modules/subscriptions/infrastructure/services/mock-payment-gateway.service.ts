import { prisma } from '../../../../lib/prisma/client';
import { BillingService, PaymentResult } from '../../domain/services/billing.service';

export interface PaymentLogInput {
  userId: string;
  subscriptionId: string;
  amount: number;
  correlationId: string;
}

export class MockPaymentGateway {
  private billingService = new BillingService();

  async processPayment(input: PaymentLogInput): Promise<PaymentResult> {
    const result = this.billingService.simulatePayment(input.amount);

    await prisma.paymentLog.create({
      data: {
        userId: input.userId,
        subscriptionId: input.subscriptionId,
        amount: input.amount,
        success: result.success,
        failureReason: result.failureReason ?? null,
        correlationId: input.correlationId,
      },
    });

    return result;
  }
}
