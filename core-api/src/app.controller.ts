import { Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { Public, ResponseMessage } from './common/decorators/customize';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChatbotDto } from './common/dto/chatbot.dto';

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

  @Post('/chatbot/new')
  @ResponseMessage('Tạo prompt thành công')
  @ApiOperation({ summary: 'Tạo prompt với Chatbot AI' })
  chatbot(@Body() body: ChatbotDto) {
    return this.appService.chatbot(body.prompt);
  }
}
