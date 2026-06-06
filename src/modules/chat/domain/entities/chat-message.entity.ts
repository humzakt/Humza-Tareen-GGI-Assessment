export interface ChatMessageEntity {
  id: string;
  userId: string;
  question: string;
  answer: string;
  tokenUsage: TokenUsage;
  correlationId: string;
  createdAt: Date;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}
