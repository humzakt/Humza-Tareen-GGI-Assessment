import { ChatMessageEntity, TokenUsage } from '../entities/chat-message.entity';

export interface CreateChatMessageInput {
  userId: string;
  question: string;
  answer: string;
  tokenUsage: TokenUsage;
  correlationId: string;
}

export interface IChatRepository {
  create(input: CreateChatMessageInput): Promise<ChatMessageEntity>;
  findByUserId(userId: string, page: number, limit: number): Promise<{ items: ChatMessageEntity[]; total: number }>;
}
