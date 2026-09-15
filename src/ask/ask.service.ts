import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleGenAI,
  FunctionDeclaration,
  Content,
  Part,
} from '@google/genai';
import {
  TransactionsService,
  QueryTransactionsFilters,
} from '../transactions/transactions.service.js';
import { TransactionStatus } from '../transactions/transaction-status.enum.js';

const QUERY_TRANSACTIONS_TOOL: FunctionDeclaration = {
  name: 'query_transactions',
  description:
    'Look up payment transactions from the database. Read-only: returns rows, never modifies data. ' +
    'All filters are optional and are combined with AND. Use this to answer any question about ' +
    'transaction volume, status, amounts, failure reasons, or specific customers.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: Object.values(TransactionStatus),
        description: 'Filter by transaction status.',
      },
      customer_email: {
        type: 'string',
        description: 'Filter by exact customer email.',
      },
      failure_reason: {
        type: 'string',
        description:
          'Filter by exact failure reason (e.g. insufficient_funds, card_declined, expired_card, invalid_cvc, processor_timeout, fraud_suspected).',
      },
      min_amount: {
        type: 'number',
        description: 'Only include transactions with amount >= this value.',
      },
      max_amount: {
        type: 'number',
        description: 'Only include transactions with amount <= this value.',
      },
      start_date: {
        type: 'string',
        description: 'ISO 8601 date/time. Only include transactions created on or after this.',
      },
      end_date: {
        type: 'string',
        description: 'ISO 8601 date/time. Only include transactions created on or before this.',
      },
      limit: {
        type: 'integer',
        description: 'Max rows to return (default 50, max 200).',
      },
    },
    additionalProperties: false,
  },
};

const SYSTEM_PROMPT =
  'You are Payment Ops Copilot, an assistant that answers plain-English questions about ' +
  'payment transactions. You can only read transaction data via the query_transactions tool - ' +
  'you have no ability to create, update, or delete anything. If asked to issue a refund, cancel ' +
  'a payment, or make any change, say clearly that you cannot take that action and that a human ' +
  'must handle it; you may only report on data. Base every answer strictly on tool results - never ' +
  'invent transactions, amounts, or reasons. Give concise, natural-language answers.';

const MODEL = 'gemini-3.6-flash';
const MAX_TOOL_ITERATIONS = 8;

@Injectable()
export class AskService {
  private readonly client: GoogleGenAI;

  constructor(
    private readonly config: ConfigService,
    private readonly transactionsService: TransactionsService,
  ) {
    this.client = new GoogleGenAI({
      apiKey: this.config.get<string>('GEMINI_API_KEY'),
    });
  }

  async ask(question: string): Promise<string> {
    const contents: Content[] = [{ role: 'user', parts: [{ text: question }] }];

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const response = await this.client.models.generateContent({
        model: MODEL,
        contents,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          tools: [{ functionDeclarations: [QUERY_TRANSACTIONS_TOOL] }],
        },
      });

      const functionCalls = response.functionCalls;
      if (!functionCalls || functionCalls.length === 0) {
        return (response.text ?? '').trim();
      }

      const modelParts = response.candidates?.[0]?.content?.parts ?? [];
      contents.push({ role: 'model', parts: modelParts });

      const responseParts: Part[] = [];
      for (const call of functionCalls) {
        responseParts.push(await this.runTool(call));
      }
      contents.push({ role: 'user', parts: responseParts });
    }

    return "I wasn't able to finish answering that within the allotted tool calls - try narrowing the question.";
  }

  private async runTool(call: {
    name?: string;
    id?: string;
    args?: Record<string, unknown>;
  }): Promise<Part> {
    if (call.name !== 'query_transactions') {
      return {
        functionResponse: {
          id: call.id,
          name: call.name ?? 'unknown',
          response: { error: `Unknown tool: ${call.name}` },
        },
      };
    }

    try {
      const filters = (call.args ?? {}) as QueryTransactionsFilters;
      const rows = await this.transactionsService.queryTransactions(filters);
      return {
        functionResponse: {
          id: call.id,
          name: call.name,
          response: { output: rows },
        },
      };
    } catch (err) {
      return {
        functionResponse: {
          id: call.id,
          name: call.name,
          response: {
            error: err instanceof Error ? err.message : 'Query failed',
          },
        },
      };
    }
  }
}
