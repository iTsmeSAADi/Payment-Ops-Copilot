import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from './transaction.entity.js';
import { TransactionStatus } from './transaction-status.enum.js';

export interface QueryTransactionsFilters {
  status?: TransactionStatus;
  customer_email?: string;
  failure_reason?: string;
  min_amount?: number;
  max_amount?: number;
  start_date?: string;
  end_date?: string;
  limit?: number;
}

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly repository: Repository<Transaction>,
  ) {}

  /**
   * Builds and runs a single fixed, parameterized SELECT against the
   * transactions table. Every value the caller supplies is bound as a
   * query parameter - never concatenated into the SQL string - so this
   * is read-only by construction, not just by convention.
   */
  async queryTransactions(
    filters: QueryTransactionsFilters,
  ): Promise<Transaction[]> {
    const qb = this.repository
      .createQueryBuilder('t')
      .select([
        't.id',
        't.amount',
        't.status',
        't.failure_reason',
        't.created_at',
        't.customer_email',
      ]);

    if (filters.status) {
      qb.andWhere('t.status = :status', { status: filters.status });
    }
    if (filters.customer_email) {
      qb.andWhere('t.customer_email = :customer_email', {
        customer_email: filters.customer_email,
      });
    }
    if (filters.failure_reason) {
      qb.andWhere('t.failure_reason = :failure_reason', {
        failure_reason: filters.failure_reason,
      });
    }
    if (filters.min_amount !== undefined) {
      qb.andWhere('t.amount >= :min_amount', {
        min_amount: filters.min_amount,
      });
    }
    if (filters.max_amount !== undefined) {
      qb.andWhere('t.amount <= :max_amount', {
        max_amount: filters.max_amount,
      });
    }
    if (filters.start_date) {
      qb.andWhere('t.created_at >= :start_date', {
        start_date: filters.start_date,
      });
    }
    if (filters.end_date) {
      qb.andWhere('t.created_at <= :end_date', {
        end_date: filters.end_date,
      });
    }

    const limit = Math.min(
      Math.max(filters.limit ?? DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );

    return qb.orderBy('t.created_at', 'DESC').take(limit).getMany();
  }
}
