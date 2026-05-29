import { Controller, Get, Param, Res, Logger } from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Public } from 'src/common/decorators/customize';
import { MediaService } from './media.service';

/**
 * MediaProxyController
 *
 * Proxies image/file requests from the frontend to SeaweedFS S3 storage.
 * This avoids CORS issues when the browser tries to load images directly
 * from the SeaweedFS S3 endpoint (localhost:8333).
 *
 * Usage: GET /media/:bucket/:key
 * Example: GET /media/snet-media/posts/1234567890-photo.jpg
 */
@ApiTags('Media Proxy')
@Controller('media')
export class MediaProxyController {
  private readonly logger = new Logger(MediaProxyController.name);
  private readonly s3Endpoint: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly mediaService: MediaService,
  ) {
    this.s3Endpoint = this.configService.get<string>(
      'S3_ENDPOINT',
      'http://localhost:8333',
    );
  }

  /**
   * Proxy a media file from SeaweedFS to the frontend using authenticated S3Client.
   * The :bucket param is the S3 bucket name (e.g. snet-media).
   * The :key param is a wildcard for the full file path.
   */
  @Get(':bucket/*')
  @Public()
  @ApiExcludeEndpoint()
  async proxyMedia(
    @Param('bucket') bucket: string,
    @Param('0') key: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const stream = await this.mediaService.getFileStream(bucket, key);

      if (stream.ContentType) {
        res.setHeader('Content-Type', stream.ContentType);
      }
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      if (stream.ContentLength) {
        res.setHeader('Content-Length', stream.ContentLength.toString());
      }

      (stream.Body as any).pipe(res);
    } catch (err: any) {
      this.logger.error(
        `Media proxy error for ${bucket}/${key}: ${err.message}`,
      );
      if (!res.headersSent) {
        res.status(404).send('Not Found');
      }
    }
  }
}
