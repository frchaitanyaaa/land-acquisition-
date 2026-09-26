import { Controller, Get } from '@nestjs/common';
import { ClockService } from '../common/clock/clock.service';
import { Roles } from '../common/guards/decorators';
import { OrgService } from './org.service';

@Controller('org')
export class OrgController {
  constructor(
    private readonly org: OrgService,
    private readonly clock: ClockService,
  ) {}

  @Get('posts')
  @Roles('SUPER_ADMIN')
  posts() {
    return this.org.listPosts(this.clock.now());
  }
}
