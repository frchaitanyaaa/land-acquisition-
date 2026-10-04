import { Module } from '@nestjs/common';
import { GisController } from './gis.controller';
import { GisLayersService } from './gis-layers.service';
import { GisRegistryService } from './gis-registry.service';
import { GisService } from './gis.service';

@Module({
  controllers: [GisController],
  providers: [GisService, GisLayersService, GisRegistryService],
  exports: [GisService, GisLayersService, GisRegistryService],
})
export class GisModule {}
