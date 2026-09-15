import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ConfigService } from '@nestjs/config';

const generateContentMock = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(function GoogleGenAIMock(this: any) {
    this.models = { generateContent: generateContentMock };
  }),
}));

const { AskService } = await import('./ask.service.js');
const { TransactionStatus } = await import(
  '../transactions/transaction-status.enum.js'
);
type TransactionsService =
  (typeof import('../transactions/transactions.service.js'))['TransactionsService'];

describe('AskService', () => {
  let transactionsService: { queryTransactions: ReturnType<typeof vi.fn> };
  let configService: ConfigService;

  beforeEach(() => {
    generateContentMock.mockReset();
    transactionsService = { queryTransactions: vi.fn() };
    configService = {
      get: vi.fn().mockReturnValue('fake-api-key'),
    } as unknown as ConfigService;
  });

  function buildService() {
    return new AskService(
      configService,
      transactionsService as unknown as InstanceType<TransactionsService>,
    );
  }

  function lastRequestContents() {
    const call = generateContentMock.mock.calls.at(-1)![0];
    return call.contents;
  }

  it('returns the model text directly when no tool call is made', async () => {
    generateContentMock.mockResolvedValueOnce({
      functionCalls: undefined,
      text: 'Hello there.',
    });

    const answer = await buildService().ask('hi');

    expect(answer).toBe('Hello there.');
    expect(transactionsService.queryTransactions).not.toHaveBeenCalled();
    expect(generateContentMock).toHaveBeenCalledTimes(1);
  });

  it('executes query_transactions and feeds the result back before returning the final answer', async () => {
    transactionsService.queryTransactions.mockResolvedValue([
      { id: '1', status: TransactionStatus.FAILED },
    ]);

    generateContentMock
      .mockResolvedValueOnce({
        functionCalls: [
          { id: 'call_1', name: 'query_transactions', args: { status: 'failed' } },
        ],
        candidates: [
          {
            content: {
              role: 'model',
              parts: [
                {
                  functionCall: {
                    id: 'call_1',
                    name: 'query_transactions',
                    args: { status: 'failed' },
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        functionCalls: undefined,
        text: 'There is 1 failed transaction.',
      });

    const answer = await buildService().ask('How many failed?');

    expect(answer).toBe('There is 1 failed transaction.');
    expect(transactionsService.queryTransactions).toHaveBeenCalledWith({
      status: 'failed',
    });
    expect(generateContentMock).toHaveBeenCalledTimes(2);

    const contents = lastRequestContents();
    const toolResponseContent = contents.at(-1);
    expect(toolResponseContent.role).toBe('user');
    expect(toolResponseContent.parts[0].functionResponse.response.output).toEqual([
      { id: '1', status: TransactionStatus.FAILED },
    ]);
  });

  it('reports an unknown tool name as an error function response instead of throwing', async () => {
    generateContentMock
      .mockResolvedValueOnce({
        functionCalls: [{ id: 'call_1', name: 'not_a_real_tool', args: {} }],
        candidates: [{ content: { role: 'model', parts: [] } }],
      })
      .mockResolvedValueOnce({ functionCalls: undefined, text: 'ok' });

    const answer = await buildService().ask('do something weird');

    expect(answer).toBe('ok');
    const toolResponseContent = lastRequestContents().at(-1);
    expect(toolResponseContent.parts[0].functionResponse.response.error).toMatch(
      /Unknown tool/,
    );
  });

  it('reports a failed query as an error function response instead of throwing', async () => {
    transactionsService.queryTransactions.mockRejectedValue(new Error('db down'));

    generateContentMock
      .mockResolvedValueOnce({
        functionCalls: [{ id: 'call_1', name: 'query_transactions', args: {} }],
        candidates: [{ content: { role: 'model', parts: [] } }],
      })
      .mockResolvedValueOnce({
        functionCalls: undefined,
        text: 'Sorry, I could not fetch that.',
      });

    const answer = await buildService().ask('...');

    expect(answer).toBe('Sorry, I could not fetch that.');
    const toolResponseContent = lastRequestContents().at(-1);
    expect(toolResponseContent.parts[0].functionResponse.response.error).toBe(
      'db down',
    );
  });

  it('stops after the max tool-call iterations and returns a fallback message', async () => {
    transactionsService.queryTransactions.mockResolvedValue([]);
    generateContentMock.mockResolvedValue({
      functionCalls: [{ id: 'call_x', name: 'query_transactions', args: {} }],
      candidates: [{ content: { role: 'model', parts: [] } }],
    });

    const answer = await buildService().ask('loop forever');

    expect(answer).toMatch(/wasn't able to finish/);
    expect(generateContentMock).toHaveBeenCalledTimes(8);
  });
});
