// middleware/auth.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Socket } from 'socket.io';
import { AuthService } from 'src/modules/users/auth/auth.service';

@Injectable()
export class WsAuthMiddleware implements NestMiddleware {
  constructor(private readonly authService: AuthService) {}
  async use(socket: Socket, next: (err?: any) => void) {
    let authToken: any = socket.handshake.headers.authorization;
    if (!authToken && socket.handshake.auth) {
      authToken = socket.handshake.auth.token;
    }

    if (!authToken) {
      return next(new Error('Authentication error: No token provided'));
    }

    if (typeof authToken === 'string' && authToken.startsWith('Bearer ')) {
      authToken = authToken.substring(7);
    }

    try {
      // Verify token
      const user = await this.authService.verify(authToken);
      // Attach user to socket
      socket.data.user = user;

      next();
    } catch {
      next(new Error('Authentication error: Invalid token'));
    }
  }
}
