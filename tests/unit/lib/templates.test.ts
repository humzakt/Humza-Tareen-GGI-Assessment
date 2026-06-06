import { success, paginated, errorResponse } from '../../../src/lib/responses/response.template';
import { createAppError, AppError } from '../../../src/lib/errors/error.template';

describe('Response Template', () => {
  it('should create success response', () => {
    const result = success({ id: '1', name: 'test' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: '1', name: 'test' });
    expect(result.error).toBeNull();
    expect(result.meta).toBeNull();
  });

  it('should create success response with meta', () => {
    const result = success({ id: '1' }, { extra: 'info' });
    expect(result.meta).toEqual({ extra: 'info' });
  });

  it('should create paginated response', () => {
    const items = [{ id: '1' }, { id: '2' }];
    const result = paginated(items, 50, 1, 20);
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(result.meta.total).toBe(50);
    expect(result.meta.page).toBe(1);
    expect(result.meta.limit).toBe(20);
    expect(result.meta.pages).toBe(3);
  });

  it('should create error response', () => {
    const result = errorResponse('QUOTA_EXHAUSTED', 'No quota left', 'corr-123');
    expect(result.success).toBe(false);
    expect(result.data).toBeNull();
    expect(result.error.code).toBe('QUOTA_EXHAUSTED');
    expect(result.error.message).toBe('No quota left');
    expect(result.error.correlationId).toBe('corr-123');
  });
});

describe('Error Template', () => {
  it('should create AppError with correct status', () => {
    const error = createAppError('QUOTA_EXHAUSTED');
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('QUOTA_EXHAUSTED');
    expect(error.status).toBe(403);
    expect(error.message).toContain('quota exhausted');
  });

  it('should interpolate details into message', () => {
    const error = createAppError('USER_ALREADY_EXISTS', { email: 'test@test.com' });
    expect(error.message).toContain('test@test.com');
  });

  it('should preserve details object', () => {
    const error = createAppError('SUBSCRIPTION_NOT_FOUND', { id: 'abc-123' });
    expect(error.details).toEqual({ id: 'abc-123' });
  });

  it('should be catchable as Error', () => {
    const error = createAppError('INTERNAL_ERROR');
    expect(error).toBeInstanceOf(Error);
  });
});
