import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  /**
   * Returns the home page message.
   */
  home() {
    return 'Đây là trang chủ';
  }
}
