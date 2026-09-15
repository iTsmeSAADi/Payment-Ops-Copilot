import { describe, it, expect } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AskQuestionDto } from './ask-question.dto.js';

describe('AskQuestionDto', () => {
  it('passes validation for a normal question', async () => {
    const dto = plainToInstance(AskQuestionDto, {
      question: 'How many transactions failed?',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('fails validation when the question is empty', async () => {
    const dto = plainToInstance(AskQuestionDto, { question: '' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('fails validation when the question is missing', async () => {
    const dto = plainToInstance(AskQuestionDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('fails validation when the question exceeds the max length', async () => {
    const dto = plainToInstance(AskQuestionDto, { question: 'a'.repeat(1001) });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('fails validation when the question is not a string', async () => {
    const dto = plainToInstance(AskQuestionDto, { question: 12345 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
