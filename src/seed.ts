import 'reflect-metadata';
import 'dotenv/config';
import { faker } from '@faker-js/faker';
import { DataSource } from 'typeorm';
import { Transaction } from './transactions/transaction.entity.js';
import { TransactionStatus } from './transactions/transaction-status.enum.js';

const FAILURE_REASONS = [
  'insufficient_funds',
  'card_declined',
  'expired_card',
  'invalid_cvc',
  'processor_timeout',
  'fraud_suspected',
];

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'payment_ops_copilot',
  entities: [Transaction],
  synchronize: true,
});

function buildTransaction(status: TransactionStatus): Partial<Transaction> {
  return {
    amount: Number(faker.finance.amount({ min: 5, max: 2500, dec: 2 })),
    status,
    failure_reason:
      status === TransactionStatus.FAILED
        ? faker.helpers.arrayElement(FAILURE_REASONS)
        : null,
    customer_email: faker.internet.email().toLowerCase(),
  };
}

async function seed() {
  await dataSource.initialize();
  const repo = dataSource.getRepository(Transaction);

  const statuses: TransactionStatus[] = [
    TransactionStatus.SUCCESS,
    TransactionStatus.SUCCESS,
    TransactionStatus.SUCCESS,
    TransactionStatus.SUCCESS,
    TransactionStatus.SUCCESS,
    TransactionStatus.FAILED,
    TransactionStatus.FAILED,
    TransactionStatus.FAILED,
    TransactionStatus.PENDING,
    TransactionStatus.PENDING,
  ];

  const transactions = statuses.map(buildTransaction);
  await repo.save(transactions);

  console.log(`Seeded ${transactions.length} transactions.`);
  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
