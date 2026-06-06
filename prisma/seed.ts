import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  const adminPassword = await bcrypt.hash('admin123', 12);
  const userPassword = await bcrypt.hash('user123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@local.dev' },
    update: {},
    create: {
      email: 'admin@local.dev',
      passwordHash: adminPassword,
      name: 'Admin User',
      role: 'ADMIN',
      authProvider: 'LOCAL',
      freeMessagesUsed: 0,
      freeQuotaResetDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    },
  });

  const user = await prisma.user.upsert({
    where: { email: 'user@local.dev' },
    update: {},
    create: {
      email: 'user@local.dev',
      passwordHash: userPassword,
      name: 'Regular User',
      role: 'USER',
      authProvider: 'LOCAL',
      freeMessagesUsed: 0,
      freeQuotaResetDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    },
  });

  const now = new Date();
  const endDate = new Date(now);
  endDate.setMonth(endDate.getMonth() + 1);

  await prisma.subscription.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      userId: user.id,
      tier: 'BASIC',
      billingCycle: 'MONTHLY',
      maxMessages: 10,
      remainingMessages: 10,
      price: 9.99,
      startDate: now,
      endDate: endDate,
      renewalDate: endDate,
      autoRenew: true,
      active: true,
    },
  });

  console.log('Seed completed:');
  console.log(`  Admin: ${admin.email} (${admin.id})`);
  console.log(`  User: ${user.email} (${user.id})`);
  console.log('  Subscription: BASIC plan for user');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
