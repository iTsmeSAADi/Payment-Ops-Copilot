import { describe, it, expect, vi } from 'vitest';
import { Repository } from 'typeorm';
import { TransactionsService } from './transactions.service.js';
import { Transaction } from './transaction.entity.js';
import { TransactionStatus } from './transaction-status.enum.js';

function createQueryBuilderMock(result: Transaction[] = []) {
  const qb: any = {};
  qb.select = vi.fn().mockReturnValue(qb);
  qb.andWhere = vi.fn().mockReturnValue(qb);
  qb.orderBy = vi.fn().mockReturnValue(qb);
  qb.take = vi.fn().mockReturnValue(qb);
  qb.getMany = vi.fn().mockResolvedValue(result);
  return qb;
}

function buildService(qb: ReturnType<typeof createQueryBuilderMock>) {
  const repository = {
    createQueryBuilder: vi.fn().mockReturnValue(qb),
  } as unknown as Repository<Transaction>;
  return new TransactionsService(repository);
}

describe('TransactionsService', () => {
  it('applies only the filters that were provided, as parameterized andWhere clauses', async () => {
    const qb = createQueryBuilderMock([{ id: '1' } as Transaction]);
    const service = buildService(qb);

    const rows = await service.queryTransactions({
      status: TransactionStatus.FAILED,
      customer_email: 'a@b.com',
    });

    expect(qb.andWhere).toHaveBeenCalledWith('t.status = :status', {
      status: TransactionStatus.FAILED,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('t.customer_email = :customer_email', {
      customer_email: 'a@b.com',
    });
    expect(qb.andWhere).toHaveBeenCalledTimes(2);
    expect(rows).toEqual([{ id: '1' }]);
  });

  it('applies no filters at all when none are given', async () => {
    const qb = createQueryBuilderMock([]);
    const service = buildService(qb);

    await service.queryTransactions({});

    expect(qb.andWhere).not.toHaveBeenCalled();
  });

  it('defaults the limit to 50 and clamps out-of-range values', async () => {
    const qb = createQueryBuilderMock([]);
    const service = buildService(qb);

    await service.queryTransactions({});
    expect(qb.take).toHaveBeenLastCalledWith(50);

    await service.queryTransactions({ limit: 10000 });
    expect(qb.take).toHaveBeenLastCalledWith(200);

    await service.queryTransactions({ limit: 0 });
    expect(qb.take).toHaveBeenLastCalledWith(1);

    await service.queryTransactions({ limit: -5 });
    expect(qb.take).toHaveBeenLastCalledWith(1);
  });

  it('always orders by created_at descending', async () => {
    const qb = createQueryBuilderMock([]);
    const service = buildService(qb);

    await service.queryTransactions({ status: TransactionStatus.PENDING });

    expect(qb.orderBy).toHaveBeenCalledWith('t.created_at', 'DESC');
  });
});
