import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { Transaction } from './transactions/transaction.entity.js';
import { TransactionsModule } from './transactions/transactions.module.js';
import { AskModule } from './ask/ask.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USERNAME', 'postgres'),
        password: config.get<string>('DB_PASSWORD', 'postgres'),
        database: config.get<string>('DB_NAME', 'payment_ops_copilot'),
        entities: [Transaction],
        synchronize: config.get<string>('NODE_ENV', 'development') !== 'production',
      }),
    }),
    TransactionsModule,
    AskModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
