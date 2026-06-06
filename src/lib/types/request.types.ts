import { Request } from 'express';

export interface RequestContext {
  requestId: string;
  correlationId: string;
  startTime: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
}

export interface AuthenticatedRequest extends Request {
  context: RequestContext;
  user: AuthenticatedUser;
}

export interface ContextRequest extends Request {
  context: RequestContext;
}
