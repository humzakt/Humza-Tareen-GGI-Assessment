import { prisma } from '../../../../lib/prisma/client';
import { IChatRepository, CreateChatMessageInput } from '../../domain/repositories/chat.repository.interface';
import { ChatMessageEntity } from '../../domain/entities/chat-message.entity';

export class PrismaChatRepository implements IChatRepository {
  async create(input: CreateChatMessageInput): Promise<ChatMessageEntity> {
    const record = await prisma.chatMessage.create({
      data: {
        userId: input.userId,
        question: input.question,
        answer: input.answer,
        tokenUsage: input.tokenUsage as object,
        correlationId: input.correlationId,
      },
    });

    return {
      id: record.id,
      userId: record.userId,
      question: record.question,
      answer: record.answer,
      tokenUsage: record.tokenUsage as unknown as ChatMessageEntity['tokenUsage'],
      correlationId: record.correlationId,
      createdAt: record.createdAt,
    };
  }

  async findByUserId(
    userId: string,
    page: number,
    limit: number,
  ): Promise<{ items: ChatMessageEntity[]; total: number }> {
    const [records, total] = await Promise.all([
      prisma.chatMessage.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.chatMessage.count({ where: { userId } }),
    ]);

    return {
      items: records.map((r) => ({
        id: r.id,
        userId: r.userId,
        question: r.question,
        answer: r.answer,
        tokenUsage: r.tokenUsage as unknown as ChatMessageEntity['tokenUsage'],
        correlationId: r.correlationId,
        createdAt: r.createdAt,
      })),
      total,
    };
  }
}
