import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/modules/users/entities/user.entity';
import { NotificationUsersService } from '../../notifications/notification-users/notification-users.service';
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
import { RedisService } from 'src/infra/redis/redis.service';
import { WsAuthMiddleware } from './ws-auth.middleware';
import { INotiUser } from 'src/modules/notifications/notification.interface';
import { ChatMessagesService } from 'src/modules/chats/chat-messages.service';

/** TTL (giây) cho presence key; client heartbeat mỗi ~30s để gia hạn. */
const PRESENCE_TTL = 60;

/**
 * WebSocket Gateway — Real-time messaging hub.
 *
 * Architecture (Hybrid Messaging Pattern):
 * - Text messages: sent via WebSocket ('sendMessage' event)
 * - Media messages: uploaded via REST POST /chat-messages, then broadcast here
 * - All broadcasts use userId-based sockets (not room-based)
 *   → Users receive messages from ALL their rooms without needing to join each room
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
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  // ═══════════════════════════════════════════
  //  LIFECYCLE: Init, Connect, Disconnect
  // ═══════════════════════════════════════════

  /** Initialize WebSocket server with auth middleware */
  afterInit() {
    console.log('WebSocket initialized');
    this.server.use((socket: Socket, next) =>
      this.wsAuthMiddleware.use(socket, next),
    );
  }

  /**
   * Handle new socket connection.
   * Each socket auto-joins the user's personal room (userId).
   * This enables broadcasting to a user across all their tabs/devices.
   */
  async handleConnection(socket: Socket) {
    const userId = socket.data.user.id;
    // Join personal room keyed by userId — this is the broadcast target
    socket.join(userId);
    // Presence key có TTL: tự hết hạn khi client chết/mất mạng/server restart
    // (không còn dựa vào bộ đếm dễ kẹt). Được heartbeat gia hạn định kỳ.
    await this.redisService.set(
      `presence:${userId}`,
      Date.now().toString(),
      PRESENCE_TTL,
    );
    await this.usersRepository.update(userId, { last_active: new Date() });

    // Broadcast user online status to all connected clients
    this.server.emit('userStatusChanged', {
      user_id: userId,
      is_online: true,
    });
  }

  /** Client gửi định kỳ (~30s) để gia hạn presence key (giữ trạng thái online). */
  @SubscribeMessage('heartbeat')
  async handleHeartbeat(@ConnectedSocket() socket: Socket) {
    const userId = socket.data?.user?.id;
    if (!userId) return;
    await this.redisService.set(
      `presence:${userId}`,
      Date.now().toString(),
      PRESENCE_TTL,
    );
  }

  /**
   * Handle socket disconnection.
   * Nếu KHÔNG còn socket/tab nào khác của user -> đánh dấu offline ngay + last_active.
   * Nếu còn -> giữ online (presence do heartbeat gia hạn). TTL là lưới an toàn.
   */
  async handleDisconnect(@ConnectedSocket() socket: Socket) {
    const userId = socket.data.user.id;
    // Ở event 'disconnect', socket đã rời room; loại phòng hờ chính nó.
    const sockets = await this.server.in(userId).allSockets();
    const remaining = [...sockets].filter((id) => id !== socket.id);

    if (remaining.length === 0) {
      await this.redisService.del(`presence:${userId}`);
      await this.usersRepository.update(userId, { last_active: new Date() });
      this.server.emit('userStatusChanged', {
        user_id: userId,
        is_online: false,
        last_active: new Date(),
      });
    }
  }

  // ═══════════════════════════════════════════
  //  BROADCASTING: Core broadcast methods
  // ═══════════════════════════════════════════

  /**
   * Broadcast an event to ALL members of a chat room via their userId sockets.
   * This is the primary broadcast mechanism — replaces the old room-based emitToRoom.
   *
   * @param roomId - The chat room ID to look up members
   * @param event - Socket event name (e.g., 'newMessage', 'messageEdited')
   * @param data - Payload to broadcast
   * @param excludeUserId - Optional userId to exclude from broadcast (e.g., sender)
   */
  async broadcastToMembers(
    roomId: string,
    event: string,
    data: unknown,
    excludeUserId?: string,
  ) {
    // Look up all member userIds for this room
    const memberIds =
      await this.chatMessagesService.getRoomMemberIds(roomId);

    // Emit to each member's personal socket room
    for (const userId of memberIds) {
      if (excludeUserId && userId === excludeUserId) continue;
      this.server.to(userId).emit(event, data);
    }
  }

  // ═══════════════════════════════════════════
  //  NOTIFICATIONS
  // ═══════════════════════════════════════════

  /** Send a notification to a specific user */
  async sendNotification(noti: INotiUser) {
    this.server.to(noti.user_id).emit('notification', noti);
  }

  /** Handle notification read event */
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

  /**
   * Handle text message sent via WebSocket (fast path for text-only messages).
   *
   * Flow:
   * 1. Save message to DB via service
   * 2. Emit 'messageSaved' back to sender with tempId mapping
   * 3. Broadcast 'newMessage' to all OTHER members via userId sockets
   */
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() socket: Socket,
    @MessageBody()
    body: { chat_room_id: string; message: string; tempId: string; reply_to_id?: string; shared_post_id?: string; medias?: string },
  ) {
    try {
      console.log('--- GATEWAY RECEIVED sendMessage BODY ---', body);
      const user = socket.data.user;

      // Step 1: Save message to DB + Redis cache via service
      const savedMessage = await this.chatMessagesService.createMessage(
        {
          chat_room_id: body.chat_room_id,
          message: body.message,
          medias: body.medias || '',
          reply_to_id: body.reply_to_id,
          shared_post_id: body.shared_post_id,
        },
        user,
      );

      // Step 2: Confirm to sender — map tempId to real saved message
      socket.emit('messageSaved', {
        tempId: body.tempId,
        message: savedMessage,
      });

      // Step 3: Broadcast to all OTHER members via userId sockets
      await this.broadcastToMembers(
        body.chat_room_id,
        'newMessage',
        savedMessage,
        user.id, // exclude sender — they already got 'messageSaved'
      );
    } catch (error) {
      // Notify sender of failure
      socket.emit('messageError', {
        tempId: body.tempId,
        error: error.message || 'Failed to send message',
      });
    }
  }

  /**
   * Typing indicator — broadcast to other room members.
   * Frontend should debounce: emit true on keypress, false after 1.5s idle.
   */
  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { chat_room_id: string; is_typing: boolean },
  ) {
    // Broadcast typing status to all members except sender
    await this.broadcastToMembers(
      body.chat_room_id,
      'userTyping',
      {
        user_id: socket.data.user.id,
        is_typing: body.is_typing,
      },
      socket.data.user.id,
    );
  }
}
