import { Module } from '@nestjs/common';
import { TransactionsModule } from '../transactions/transactions.module.js';
import { AskController } from './ask.controller.js';
import { AskService } from './ask.service.js';

@Module({
  imports: [TransactionsModule],
  controllers: [AskController],
  providers: [AskService],
})
export class AskModule {}
