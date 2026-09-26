import { Controller, Get, Param } from '@nestjs/common';
import { ProblemException } from '../common/errors/problem';
import { RulesService } from './rules.service';

/** Read-only pack viewer (§12.4: `verify` notes must be shown prominently; demo beat 8). */
@Controller('rules/packs')
export class RulesController {
  constructor(private readonly rules: RulesService) {}

  @Get()
  list() {
    return this.rules.list();
  }

  @Get(':code/:version')
  get(@Param('code') code: string, @Param('version') version: string) {
    const pack = this.rules.get(code, version);
    if (!pack) throw new ProblemException(404, 'PACK_NOT_FOUND', `No rule pack ${code}@${version}.`);
    return pack;
  }
}
