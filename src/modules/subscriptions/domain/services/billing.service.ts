import { env } from '../../../../lib/config/env.config';

export interface PaymentResult {
  success: boolean;
  failureReason?: string;
}

export class BillingService {
  simulatePayment(_amount: number): PaymentResult {
    const failureRate = env.PAYMENT_FAILURE_RATE;
    const random = Math.random();

    if (random < failureRate) {
      const reasons = [
        'Insufficient funds',
        'Card expired',
        'Payment gateway timeout',
        'Transaction declined by issuer',
      ];
      const reason = reasons[Math.floor(Math.random() * reasons.length)]!;
      return { success: false, failureReason: reason };
    }

    return { success: true };
  }
}
