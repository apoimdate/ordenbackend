import { PrismaClient } from '@prisma/client';
import { DEFAULT_FRAUD_RULES } from '../src/utils/fraud-rules';
import { logger } from '../src/utils/logger';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function seedFraudRules() {
  try {
    console.log('🔒 Seeding fraud detection rules...');

    for (const rule of DEFAULT_FRAUD_RULES) {
      const existing = await prisma.fraudRule.findFirst({
        where: { name: rule.name }
      });

      if (existing) {
        console.log(`ℹ️  Rule "${rule.name}" already exists, updating...`);
        await prisma.fraudRule.update({
          where: { id: existing.id },
          data: {
            type: rule.type,
            weight: rule.weight,
            configuration: rule.configuration,
            description: rule.description,
            isActive: rule.isActive
          }
        });
      } else {
        console.log(`✅ Creating rule "${rule.name}"...`);
        await prisma.fraudRule.create({
          data: {
            name: rule.name,
            type: rule.type,
            weight: rule.weight,
            configuration: rule.configuration,
            description: rule.description,
            isActive: rule.isActive
          }
        });
      }
    }

    // Add some sample blocked IPs (examples only)
    const blockedIPs = [
      { ip: '192.168.1.100', reason: 'Test blocked IP', isActive: false },
      { ip: '10.0.0.1', reason: 'Internal test', isActive: false }
    ];

    for (const blockedIP of blockedIPs) {
      const existing = await prisma.blockedIP.findFirst({
        where: { ip: blockedIP.ip }
      });

      if (!existing) {
        await prisma.blockedIP.create({
          data: blockedIP
        });
      }
    }

    // Add some sample blocked emails (examples only)
    const blockedEmails = [
      { email: 'test@disposable.email', reason: 'Disposable email', isActive: true },
      { email: 'spam@example.com', reason: 'Known spam account', isActive: true }
    ];

    for (const blockedEmail of blockedEmails) {
      const existing = await prisma.blockedEmail.findFirst({
        where: { email: blockedEmail.email }
      });

      if (!existing) {
        await prisma.blockedEmail.create({
          data: blockedEmail
        });
      }
    }

    console.log('\n✅ Fraud rules seeded successfully!');
    
    // Display summary
    const ruleCount = await prisma.fraudRule.count();
    const activeRules = await prisma.fraudRule.count({ where: { isActive: true } });
    const blockedIPCount = await prisma.blockedIP.count({ where: { isActive: true } });
    const blockedEmailCount = await prisma.blockedEmail.count({ where: { isActive: true } });

    console.log('\n📊 Summary:');
    console.log(`  - Total fraud rules: ${ruleCount}`);
    console.log(`  - Active fraud rules: ${activeRules}`);
    console.log(`  - Blocked IPs: ${blockedIPCount}`);
    console.log(`  - Blocked emails: ${blockedEmailCount}`);

  } catch (error) {
    console.error('❌ Error seeding fraud rules:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed script
seedFraudRules();