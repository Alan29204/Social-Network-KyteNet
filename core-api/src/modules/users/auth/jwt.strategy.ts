import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import {
  forwardRef,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { IUser } from 'src/modules/users/users.interface';
import { DeviceSessionsService } from 'src/modules/users/device-sessions/device-sessions.service';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Repository } from 'typeorm';
import { RoleType } from 'src/common/enums/role.enum';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(forwardRef(() => DeviceSessionsService))
    private readonly deviceSessionsService: DeviceSessionsService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: async (request, rawJwtToken, done) => {
        try {
          // Decode token and get `deviceSessionId`
          const payload: IUser = JSON.parse(
            Buffer.from(rawJwtToken.split('.')[1], 'base64').toString(),
          );

          if (!payload.deviceSecssionId) {
            return done(
              new UnauthorizedException('Invalid token payload'),
              null,
            );
          }

          // Find device session
          const deviceSession = await this.deviceSessionsService.findOne(
            payload.deviceSecssionId,
          );

          if (!deviceSession || !deviceSession.secret_key) {
            return done(
              new UnauthorizedException('Invalid device session'),
              null,
            );
          }

          // Return secret key
          return done(null, deviceSession.secret_key);
        } catch {
          return done(new UnauthorizedException('Invalid token format'), null);
        }
      },
    });
  }

  async validate(payload: IUser) {
    const user = await this.userRepository.findOne({
      where: { id: payload.id },
      select: ['id', 'role'],
    });

    if (!user || user.role === RoleType.BANNED) {
      throw new UnauthorizedException('Token invalid');
    }

    return {
      ...payload,
      role: user.role,
    };
  }
}
