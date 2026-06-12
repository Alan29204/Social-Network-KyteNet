import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ChatMessagesService } from './modules/chats/chat-messages.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const chatMessagesService = app.get(ChatMessagesService);

  try {
    const res = await chatMessagesService.getMessageHistory(
      '1a47601d-ff70-48bf-9e92-833a9977d0f2',
      'd98a0939-d84d-438e-9ed4-a6ac2c284d47'
    );
    console.log('SUCCESS:', res);
  } catch (error) {
    console.error('ERROR OCCURRED:');
    console.error(error);
  }

  await app.close();
}

bootstrap();
