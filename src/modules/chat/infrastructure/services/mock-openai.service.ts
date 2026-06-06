import { MOCK_AI_MIN_LATENCY_MS, MOCK_AI_MAX_LATENCY_MS } from '../../../../lib/constants/time.constants';
import { TokenUsage } from '../../domain/entities/chat-message.entity';

export interface MockAIResponse {
  answer: string;
  tokenUsage: TokenUsage;
  latencyMs: number;
}

const MOCK_RESPONSES = [
  'Based on my analysis, the answer involves considering multiple factors including context, constraints, and best practices.',
  'That\'s an interesting question. Here\'s my perspective: the key insight is to focus on the fundamental principles rather than surface-level details.',
  'I\'d recommend approaching this systematically. First, identify the core requirements, then evaluate trade-offs between different solutions.',
  'The short answer is that it depends on your specific use case. However, I can provide general guidelines that apply in most scenarios.',
  'Let me break this down: there are three main aspects to consider - performance, maintainability, and scalability.',
];

export async function generateMockResponse(question: string): Promise<MockAIResponse> {
  const latency = Math.floor(
    Math.random() * (MOCK_AI_MAX_LATENCY_MS - MOCK_AI_MIN_LATENCY_MS) + MOCK_AI_MIN_LATENCY_MS,
  );

  await new Promise((resolve) => setTimeout(resolve, latency));

  const responseIndex = Math.floor(Math.random() * MOCK_RESPONSES.length);
  const answer = MOCK_RESPONSES[responseIndex]!;

  const promptTokens = Math.ceil(question.length / 4);
  const completionTokens = Math.ceil(answer.length / 4);

  return {
    answer,
    tokenUsage: {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    },
    latencyMs: latency,
  };
}
