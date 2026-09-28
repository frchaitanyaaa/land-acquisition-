import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { z } from 'zod';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/guards/decorators';
import { ZodPipe } from '../common/validation/zod.pipe';
import { AssistantService } from './assistant.service';

const Query = z.strictObject({ question: z.string().min(3).max(2000) });

@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  /** Advisory only — reads through whitelisted tools under your own data scope. */
  @Post('query')
  @HttpCode(200)
  query(@CurrentUser() user: AuthUser, @Body(new ZodPipe(Query)) body: z.infer<typeof Query>) {
    return this.assistant.query(user, body.question);
  }
}
