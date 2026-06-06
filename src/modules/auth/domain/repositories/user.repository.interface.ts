import { CreateUserInput, UserEntity } from '../entities/user.entity';

export interface IUserRepository {
  findByEmail(email: string): Promise<UserEntity | null>;
  findById(id: string): Promise<UserEntity | null>;
  create(input: CreateUserInput): Promise<UserEntity>;
  updateFreeQuota(userId: string, messagesUsed: number, resetDate: Date): Promise<void>;
}
