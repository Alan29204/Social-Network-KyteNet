import { NotificationUsersService } from './../notification-users/notification-users.service';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RedisService } from 'src/redis/redis.service';
import { WsAuthMiddleware } from './ws-auth.middleware';
import { INotiUser } from 'src/notifications/notification.interface';
import { ChatMessagesService } from 'src/modules/chats/chat-messages.service';

/*
    Client --|Gửi tin| Redis;
    Redis --|Phản hồi nhanh| Client;
    Redis --|Lưu vào hàng đợi| BullMQ;
    BullMQ --|Ghi tin nhắn vào DB| PostgreSQL;
    Client --|Yêu cầu tin nhắn cũ| PostgreSQL;
*/

@WebSocketGateway({
  cors: true,
  pingInterval: 10000,
  pingTimeout: 20000,
})
export class GatewayGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly redisService: RedisService,
    private readonly wsAuthMiddleware: WsAuthMiddleware,
    private readonly notificationUsersService: NotificationUsersService,
    private readonly chatMessagesService: ChatMessagesService,
  ) {}

  // Initialize WebSocket
  afterInit() {
    console.log('WebSocket initialized');
    this.server.use((socket: Socket, next) =>
      this.wsAuthMiddleware.use(socket, next),
    );
  }

  // Handle connection
  async handleConnection(socket: Socket) {
    // Increase connection number
    socket.join(socket.data.user.id);
    await this.redisService.incr(`connection_number:${socket.data.user.id}`);
  }

  // Handle disconnection
  async handleDisconnect(@ConnectedSocket() socket: Socket) {
    // get connection number
    const connectionNumber = await this.redisService.get(
      `connection_number:${socket.data.user.id}`,
    );

    // Decrease connection number
    if (parseInt(connectionNumber) === 1) {
      await this.redisService.del(`connection_number:${socket.data.user.id}`);
    } else {
      await this.redisService.decr(`connection_number:${socket.data.user.id}`);
    }
  }

  // Send notification
  async sendNotification(noti: INotiUser) {
    this.server.to(noti.user_id).emit('notification', noti);
  }

  // User read notification
  @SubscribeMessage('readNotification')
  handleReadNotification(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: object,
  ) {
    this.notificationUsersService.readNoti(
      socket.data.user.id,
      body['noti_user_id'],
    );
  }

  // ═══════════════════════════════════════════
  //  CHAT: Real-time messaging
  // ═══════════════════════════════════════════

  // Join a chat room
  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() socket: Socket,
    @MessageBody() roomId: string,
  ) {
    socket.join(roomId);
    console.log(`User ${socket.data.user.id} joined room ${roomId}`);

    // Get cached messages from Redis
    const messages = await this.redisService.lRange(`chat:${roomId}`, 0, -1);

    // Send cached message history to client
    socket.emit(
      'messageHistory',
      messages.map((msg) => JSON.parse(msg)),
    );
  }

  // Leave a chat room
  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    @ConnectedSocket() socket: Socket,
    @MessageBody() roomId: string,
  ) {
    socket.leave(roomId);
    console.log(`User ${socket.data.user.id} left room ${roomId}`);
  }

  // Send a text message via WebSocket (real-time path)
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { chat_room_id: string; message: string },
  ) {
    try {
      const user = socket.data.user;

      // Save message to DB + Redis via service
      const savedMessage = await this.chatMessagesService.createMessage(
        { chat_room_id: body.chat_room_id, message: body.message, medias: '' },
        user,
      );

      // Broadcast to all members in the room (including sender)
      this.server.to(body.chat_room_id).emit('newMessage', savedMessage);
    } catch (error) {
      socket.emit('messageError', {
        error: error.message || 'Failed to send message',
      });
    }
  }

  // Typing indicator
  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { chat_room_id: string; is_typing: boolean },
  ) {
    // Broadcast typing status to other members (not sender)
    socket.to(body.chat_room_id).emit('userTyping', {
      user_id: socket.data.user.id,
      is_typing: body.is_typing,
    });
  }

  /**
   * Emit a message to a specific chat room.
   * Called externally by ChatMessagesService (via REST API path).
   */
  emitToRoom(roomId: string, event: string, data: any) {
    this.server.to(roomId).emit(event, data);
  }
}
