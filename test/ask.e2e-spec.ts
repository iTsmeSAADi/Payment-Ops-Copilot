import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AskController } from '../src/ask/ask.controller.js';
import { AskService } from '../src/ask/ask.service.js';

describe('AskController (e2e)', () => {
  let app: INestApplication<App>;
  const askServiceMock = { ask: vi.fn() };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AskController],
      providers: [{ provide: AskService, useValue: askServiceMock }],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    vi.resetAllMocks();
  });

  it('POST /ask returns the answer produced by AskService', async () => {
    askServiceMock.ask.mockResolvedValue('3 transactions failed.');

    const res = await request(app.getHttpServer())
      .post('/ask')
      .send({ question: 'How many failed?' })
      .expect(201);

    expect(res.body).toEqual({ answer: '3 transactions failed.' });
    expect(askServiceMock.ask).toHaveBeenCalledWith('How many failed?');
  });

  it('POST /ask rejects an empty question with 400', async () => {
    await request(app.getHttpServer())
      .post('/ask')
      .send({ question: '' })
      .expect(400);

    expect(askServiceMock.ask).not.toHaveBeenCalled();
  });

  it('POST /ask rejects a missing question with 400', async () => {
    await request(app.getHttpServer()).post('/ask').send({}).expect(400);

    expect(askServiceMock.ask).not.toHaveBeenCalled();
  });

  it('POST /ask rejects a non-string question with 400', async () => {
    await request(app.getHttpServer())
      .post('/ask')
      .send({ question: 12345 })
      .expect(400);

    expect(askServiceMock.ask).not.toHaveBeenCalled();
  });
});
