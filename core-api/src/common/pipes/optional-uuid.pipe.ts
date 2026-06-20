import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { isUUID } from 'class-validator';

@Injectable()
export class OptionalUuidPipe
  implements PipeTransform<string | null | undefined, string | undefined>
{
  transform(value: string | null | undefined): string | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (!isUUID(value)) {
      throw new BadRequestException(`Invalid UUID format: ${value}`);
    }

    return value;
  }
}
