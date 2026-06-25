import { JwtService } from '@nestjs/jwt';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IPayload } from './payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async verify(token: string) {
    try {
      return this.jwtService.verify(token, {
        secret: this.getAccessSecret(),
      });
    } catch (error) {
      throw new Error(`Failed to verify token: ${error.message}`);
    }
  }

  decode(token: string) {
    try {
      const decoded = this.jwtService.decode(token);
      if (!decoded) {
        throw new Error('Invalid token');
      }
      return decoded;
    } catch (error) {
      throw new Error(`Failed to decode token: ${error.message}`);
    }
  }

  generateAccessToken(payload: IPayload) {
    const accessToken = this.jwtService.sign(payload, {
      secret: this.getAccessSecret(),
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRE'),
    });

    return accessToken;
  }

  private getAccessSecret() {
    return (
      this.configService.get<string>('JWT_ACCESS_SECRET') ||
      'snet-dev-access-secret'
    );
  }
}
