import { Global, Module } from '@nestjs/common';
import { StorageService } from '../adapters/storage/storage.adapter';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Global()
@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService, StorageService],
  exports: [DocumentsService, StorageService],
})
export class DocumentsModule {}
