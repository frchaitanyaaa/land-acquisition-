import { Module } from '@nestjs/common';
import { FieldController } from './field.controller';
import { FieldOfficeService } from './field-office.service';
import { FieldService } from './field.service';

@Module({ controllers: [FieldController], providers: [FieldService, FieldOfficeService] })
export class FieldModule {}
