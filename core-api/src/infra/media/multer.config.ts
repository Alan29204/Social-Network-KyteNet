import { Injectable } from '@nestjs/common';
import {
  MulterModuleOptions,
  MulterOptionsFactory,
} from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class MulterConfigService implements MulterOptionsFactory {
  getRootPath = () => {
    return process.cwd();
  };
  ensureExists(targetDirectory: string) {
    if (!fs.existsSync(targetDirectory)) {
      fs.mkdirSync(targetDirectory, { recursive: true });
    }
  }

  createMulterOptions(): MulterModuleOptions {
    return {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const folder = req?.headers?.folder_type ?? 'default';
          const targetPath = path.join(this.getRootPath(), `public/${folder}`);
          this.ensureExists(targetPath);
          cb(null, targetPath);
        },
        filename: (req, file, cb) => {
          //get image extension
          const extName = path.extname(file.originalname);
          //get image's name (without extension)
          const baseName = path.basename(file.originalname, extName);
          const finalName = `${baseName}-${Date.now()}${extName}`;
          cb(null, finalName);
        },
      }),
    };
  }
}
