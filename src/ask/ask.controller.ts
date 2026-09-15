import { Body, Controller, Post } from '@nestjs/common';
import { AskService } from './ask.service.js';
import { AskQuestionDto } from './dto/ask-question.dto.js';

@Controller('ask')
export class AskController {
  constructor(private readonly askService: AskService) {}

  @Post()
  async ask(@Body() dto: AskQuestionDto): Promise<{ answer: string }> {
    const answer = await this.askService.ask(dto.question);
    return { answer };
  }
}
