import { DeviceSessionsService } from './device-sessions/device-sessions.service';
import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';
import { IUser } from './users.interface';
import { UpdateUserDto } from './dto/update-user.dto';
import { RedisService } from 'src/infra/redis/redis.service';
import { AfterSignUpDto } from './dto/after-signup.dto';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import { PrivacyType } from 'src/common/enums/privacy.enum';
import { RelationsService } from 'src/modules/users/relations/relations.service';
import { RelationType } from 'src/common/enums/relation.enum';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private redisService: RedisService,
    private diviceSessionsService: DeviceSessionsService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => RelationsService))
    private readonly relationsService: RelationsService,
  ) {}

  async getAccount(user: IUser) {
    return user;
  }

  async getHashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    return hash;
  }

  isValidPassword(password: string, hash: string) {
    return bcrypt.compareSync(password, hash);
  }

  /**
   * Find user by email
   * @param email user's email
   * @returns User entity if found, otherwise null
   */
  async findUserByEmail(email: string) {
    return await this.usersRepository.findOne({
      where: { email },
    });
  }

  async findAll() {
    return await this.usersRepository.find();
  }

  /**
   * Check if a user is allowed to see another user's profile based on
   * the privacy setting of the user being viewed.
   * @param user_id_see The ID of the user performing the action.
   * @param user_id The ID of the user being viewed.
   * @returns A boolean indicating whether the view is allowed.
   */
  async privacySeeProfile(user_id_see: string, user_id: string) {
    const user = await this.findUserById(user_id);
    const privacy = user.privacy;
    switch (true) {
      case privacy === PrivacyType.PRIVATE:
        return false;
      case privacy === PrivacyType.PUBLIC:
        return true;
      case privacy === PrivacyType.FOLLOWER:
        const relation = await this.relationsService.getRelation(
          user_id_see,
          user_id,
        );
        if (relation === RelationType.FOLLOWING) {
          return true;
        } else {
          return false;
        }
    }
    return false;
  }

  /**
   * Validates a user's credentials.
   *
   * @param email - The email of the user to validate.
   * @param password - The password of the user to validate.
   * @returns The user object if validation is successful.
   * @throws UnauthorizedException if the user is not found or the password is incorrect.
   */
  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { email } });

    if (!user || !this.isValidPassword(password, user.password)) {
      throw new UnauthorizedException('Info is incorrect');
    }
    return user;
  }

  async afterSignUp(dto: AfterSignUpDto) {
    try {
      const hashPassword = await this.getHashPassword(dto.password);

      const newUser = {
        email: dto.email,
        password: hashPassword,
        avatar: dto?.avatar,
        username: dto.username,
        bio: dto?.bio,
        website: dto?.website,
        birthday: dto?.birthday,
        gender: dto?.gender,
        address: dto?.address,
        privacy: PrivacyType.PUBLIC,
      };

      await this.usersRepository.save(newUser);

      return { message: 'sign up successfully' };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new InternalServerErrorException('Error when sign up');
    }
  }

  async login(user: User, dto: any) {
    const session = await this.diviceSessionsService.handleLogin(
      user.id,
      {
        deviceId: dto.deviceId,
        ipAddress: '127.0.0.1',
      },
      user.role,
    );
    return {
      ...session,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatar: user.avatar,
        role: user.role,
      },
    };
  }

  /**
   * @description Handles the deletion of a user account.
   * @param id - The id of the user to delete.
   * @returns The result of the deletion.
   * @throws NotFoundException if the user is not found.
   */
  async afterDelete(id: string) {
    await this.usersRepository.delete({ id });

    await this.redisService.del(`user:${id}`);

    return { message: 'Delete user successfully' };
  }

  /**
   * @description Finds a user by ID from the database and Redis cache.
   * If the user is not found, throws a NotFoundException.
   * If an error occurs while fetching the user, throws an Error.
   * @param id The ID of the user to find.
   * @returns The user object.
   */
  async findUserById(id: string): Promise<User> {
    try {
      const cacheKey = `user:${id}`;

      const userCache = await this.redisService.hGetAll(cacheKey);

      if (userCache && Object.keys(userCache).length > 0) {
        return userCache as any;
      }

      const user = await this.usersRepository.findOne({
        where: { id },
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      await this.redisService.hMSet(cacheKey, user);

      return user;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error in findUserById:', error);
      throw new Error('Failed to fetch user data');
    }
  }

  async getProfileStats(id: string) {
    const stats = await this.usersRepository
      .createQueryBuilder('user')
      .where('user.id = :id', { id })
      .loadRelationCountAndMap('user.postsCount', 'user.posts')
      .loadRelationCountAndMap(
        'user.followersCount',
        'user.received_relations',
        'relation',
        (qb) => qb.where('relation.relation_type = :type', { type: RelationType.FOLLOWING })
      )
      .loadRelationCountAndMap(
        'user.followingCount',
        'user.sent_relations',
        'relation',
        (qb) => qb.where('relation.relation_type = :type', { type: RelationType.FOLLOWING })
      )
      .getOne();

    return {
      postsCount: (stats as any)?.postsCount || 0,
      followersCount: (stats as any)?.followersCount || 0,
      followingCount: (stats as any)?.followingCount || 0,
    };
  }

  async updateUser(dto: UpdateUserDto, user: IUser, file: Express.Multer.File) {
    try {
      // Remove removeAvatar from dto before updating DB
      const { removeAvatar, ...updateData } = dto;

      if (!file) {
        if (removeAvatar === 'true') {
          const userDb = await this.findUserById(user.id);
          const avatar = userDb.avatar;

          if (avatar) {
            try {
              if (fs.existsSync(avatar)) {
                fs.unlinkSync(avatar);
              }
            } catch {
              console.error('Error deleting old avatar');
            }
          }

          await this.usersRepository.update(
            { id: user.id },
            {
              ...updateData,
              avatar: null,
            },
          );
        } else {
          await this.usersRepository.update(
            { id: user.id },
            {
              ...updateData,
            },
          );
        }
      } else {
        const userDb = await this.findUserById(user.id);

        const avatar = userDb.avatar;

        if (avatar) {
          try {
            if (fs.existsSync(avatar)) {
              fs.unlinkSync(avatar);
            }
          } catch {
            throw new BadRequestException('Error when delete file');
          }
        }

        await this.usersRepository.update(
          { id: user.id },
          {
            ...updateData,
            avatar: file.path,
          },
        );
      }

      await this.redisService.del(`user:${user.id}`);

      return {
        message: 'Update successful',
      };
    } catch (err) {
      if (err instanceof BadRequestException) {
        throw err;
      }
      throw new InternalServerErrorException('Error updating user');
    }
  }

  // ═══════════════════════════════════════════
  //  Forgot Password Flow
  // ═══════════════════════════════════════════

  /**
   * Generate a password reset token and store it in Redis (15 min TTL).
   * In production, this would send an email with the token.
   */
  async forgotPassword(email: string) {
    const user = await this.usersRepository.findOne({ where: { email } });
    if (!user) {
      // Don't reveal whether email exists (security best practice)
      return { message: 'If this email exists, a reset link has been sent' };
    }

    // Generate a 6-digit OTP code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Store in Redis with 15 minute TTL
    await this.redisService.set(`password_reset:${email}`, resetCode);
    await this.redisService.getClient().expire(`password_reset:${email}`, 900); // 15 min

    // TODO: Send email with reset code in production
    console.log(`[DEV] Password reset code for ${email}: ${resetCode}`);

    return {
      message: 'If this email exists, a reset link has been sent',
      // Only return code in development mode
      ...(this.configService.get('NODE_ENV') !== 'production' && {
        dev_reset_code: resetCode,
      }),
    };
  }

  /**
   * Reset password using the token from forgotPassword.
   */
  async resetPassword(email: string, resetCode: string, newPassword: string) {
    const storedCode = await this.redisService.get(`password_reset:${email}`);

    if (!storedCode || storedCode !== resetCode) {
      throw new BadRequestException('Invalid or expired reset code');
    }

    const user = await this.usersRepository.findOne({ where: { email } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Hash new password and update
    user.password = await this.getHashPassword(newPassword);
    await this.usersRepository.save(user);

    // Delete reset code from Redis
    await this.redisService.del(`password_reset:${email}`);

    // Invalidate user cache
    await this.redisService.del(`user:${user.id}`);

    return { message: 'Password reset successfully' };
  }
}
