import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';

@Injectable()
export class MediaService {
  private s3: S3Client;
  private bucket: string;
  private endpoint: string;

  constructor(private readonly configService: ConfigService) {
    this.endpoint = this.configService.get<string>('S3_ENDPOINT');
    this.bucket = this.configService.get<string>('S3_BUCKET', 'snet-media');

    this.s3 = new S3Client({
      endpoint: this.endpoint,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.configService.get<string>('S3_ACCESS_KEY', 'any'),
        secretAccessKey: this.configService.get<string>('S3_SECRET_KEY', 'any'),
      },
    });

    this.ensureBucketExists();
  }

  /**
   * Ensures the default bucket exists in SeaweedFS/S3.
   * Creates it if it doesn't exist.
   */
  private async ensureBucketExists() {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
        console.log(`Bucket "${this.bucket}" created successfully`);
      } catch (createErr) {
        console.warn(`Could not create bucket "${this.bucket}":`, createErr);
      }
    }
  }

  /**
   * Uploads a file to SeaweedFS via S3 API.
   * @param file - The Multer file object (using memoryStorage)
   * @param folder - The folder path (e.g. 'posts', 'avatars', 'chats')
   * @returns The public URL of the uploaded file
   */
  async uploadFile(file: Express.Multer.File, folder: string): Promise<string> {
    const key = `${folder}/${Date.now()}-${file.originalname}`;

    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );

      return `${this.endpoint}/${this.bucket}/${key}`;
    } catch (error) {
      console.error('Error uploading file to S3:', error);
      throw new InternalServerErrorException('Failed to upload file');
    }
  }

  /**
   * Uploads multiple files to SeaweedFS.
   * @param files - Array of Multer file objects
   * @param folder - The folder path
   * @returns Array of public URLs
   */
  async uploadFiles(
    files: Express.Multer.File[],
    folder: string,
  ): Promise<string[]> {
    if (!files || files.length === 0) return [];

    const urls = await Promise.all(
      files.map((file) => this.uploadFile(file, folder)),
    );
    return urls;
  }

  /**
   * Deletes a file from SeaweedFS by its URL.
   * @param fileUrl - The full URL of the file to delete
   */
  async deleteFile(fileUrl: string): Promise<void> {
    try {
      const key = fileUrl.split(`${this.bucket}/`)[1];
      if (!key) return;

      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
    } catch (error) {
      console.error('Error deleting file from S3:', error);
    }
  }

  /**
   * Deletes multiple files from SeaweedFS.
   * @param fileUrls - Array of file URLs to delete
   */
  async deleteFiles(fileUrls: string[]): Promise<void> {
    if (!fileUrls || fileUrls.length === 0) return;
    await Promise.all(fileUrls.map((url) => this.deleteFile(url)));
  }

  /**
   * Gets a read stream for a file from S3.
   * Useful for proxying authenticated requests.
   * @param bucket - The S3 bucket name
   * @param key - The file path/key
   */
  async getFileStream(bucket: string, key: string) {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    try {
      const response = await this.s3.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
        }),
      );

      return {
        Body: response.Body, // Readable stream
        ContentType: response.ContentType,
        ContentLength: response.ContentLength,
      };
    } catch (error: any) {
      console.error(
        `Error getting file stream for ${bucket}/${key}:`,
        error.message,
      );
      throw error;
    }
  }
}
