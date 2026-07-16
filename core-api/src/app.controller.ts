import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public, ResponseMessage } from './common/decorators/customize';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Public()
  @ResponseMessage('Trang chủ')
  @ApiOperation({ summary: 'Trang chủ' })
  home() {
    return this.appService.home();
  }
}
