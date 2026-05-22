import { Global, Module } from '@nestjs/common';
import { MediaService } from './media.service';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

/**
 * Global media module that provides file upload/delete services
 * using SeaweedFS via S3-compatible API.
 * Uses memoryStorage so files go to buffer (then uploaded to S3)
 * instead of being saved to local disk.
 */
@Global()
@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(),
    }),
  ],
  providers: [MediaService],
  exports: [MediaService, MulterModule],
})
export class MediaModule {}
