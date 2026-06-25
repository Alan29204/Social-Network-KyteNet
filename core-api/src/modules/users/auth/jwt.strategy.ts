import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { IUser } from 'src/modules/users/users.interface';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Repository } from 'typeorm';
import { RoleType } from 'src/common/enums/role.enum';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_ACCESS_SECRET') ||
        'snet-dev-access-secret',
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
