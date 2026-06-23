import { DeviceSessionsService } from './device-sessions/device-sessions.service';
import {
  BadRequestException,
  ForbiddenException,
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
import { ChangePasswordDto } from './dto/change-password.dto';
import { RedisService } from 'src/infra/redis/redis.service';
import { AfterSignUpDto } from './dto/after-signup.dto';
import { ConfigService } from '@nestjs/config';
import { PrivacyType } from 'src/common/enums/privacy.enum';
import { RelationsService } from 'src/modules/users/relations/relations.service';
import { RelationType } from 'src/common/enums/relation.enum';
import { MediaService } from 'src/infra/media/media.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Post } from 'src/modules/posts/entities/post.entity';
import { RoleType } from 'src/common/enums/role.enum';

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
    private readonly mediaService: MediaService,
    @InjectQueue('avatar-updates')
    private avatarUpdatesQueue: Queue,
  ) {}

  private sanitizeUser<T extends Partial<User>>(user: T) {
    if (!user) return user;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...safeUser } = user;
    return safeUser;
  }

  async getAccount(user: IUser) {
    const userDb = await this.findUserById(user.id);
    return {
      id: userDb.id,
      email: userDb.email,
      username: userDb.username,
      full_name: userDb.full_name,
      avatar: userDb.avatar,
      role: userDb.role,
    };
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
    const users = await this.usersRepository.find({
      select: [
        'id',
        'username',
        'full_name',
        'avatar',
        'cover_photo',
        'privacy',
        'role',
        'created_at',
      ],
    });
    return users.map((user) => this.sanitizeUser(user));
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
    if (user_id_see === user_id) {
      return true;
    }

    const privacy = user.privacy;
    if (privacy === PrivacyType.PUBLIC) {
      return true;
    }

    // Both PRIVATE and FOLLOWER mean only followers (or the user themselves) can see
    const relation = await this.relationsService.getRelation(
      user_id_see,
      user_id,
    );
    if (relation === RelationType.FOLLOWING) {
      return true;
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
    if (user.role === RoleType.BANNED) {
      throw new ForbiddenException('Account has been locked');
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
        full_name: dto.full_name,
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
        full_name: user.full_name,
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

      await this.redisService.hMSet(cacheKey, this.sanitizeUser(user));

      return this.sanitizeUser(user) as User;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error in findUserById:', error);
      throw new Error('Failed to fetch user data');
    }
  }

  async getProfileStats(id: string, viewerId?: string) {
    const stats = await this.usersRepository
      .createQueryBuilder('user')
      .where('user.id = :id', { id })
      .loadRelationCountAndMap(
        'user.followersCount',
        'user.received_relations',
        'relation',
        (qb) =>
          qb.where('relation.relation_type = :type', {
            type: RelationType.FOLLOWING,
          }),
      )
      .loadRelationCountAndMap(
        'user.followingCount',
        'user.sent_relations',
        'relation',
        (qb) =>
          qb.where('relation.relation_type = :type', {
            type: RelationType.FOLLOWING,
          }),
      )
      .getOne();

    if (!stats) {
      throw new NotFoundException('User not found');
    }

    const postRepository = this.usersRepository.manager.getRepository(Post);
    const postsQb = postRepository
      .createQueryBuilder('post')
      .where('post.user_id = :id', { id })
      .andWhere('post.shared_post_id IS NULL');

    if (viewerId && viewerId !== id) {
      const relation = await this.relationsService.getRelation(viewerId, id);
      const isFollowing = relation === RelationType.FOLLOWING;

      if (stats.privacy !== PrivacyType.PUBLIC && !isFollowing) {
        postsQb.andWhere('1 = 0');
      } else if (isFollowing) {
        postsQb.andWhere('post.privacy IN (:...visiblePostPrivacies)', {
          visiblePostPrivacies: [PrivacyType.PUBLIC, PrivacyType.FOLLOWER],
        });
      } else {
        postsQb.andWhere('post.privacy = :publicPostPrivacy', {
          publicPostPrivacy: PrivacyType.PUBLIC,
        });
      }
    }

    const postsCount = await postsQb.getCount();

    return {
      postsCount,
      followersCount: (stats as any)?.followersCount || 0,
      followingCount: (stats as any)?.followingCount || 0,
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    if (dto.new_password !== dto.confirm_password) {
      throw new BadRequestException('New password confirmation does not match');
    }

    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!this.isValidPassword(dto.current_password, user.password)) {
      throw new BadRequestException('Current password is incorrect');
    }

    if (this.isValidPassword(dto.new_password, user.password)) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    user.password = await this.getHashPassword(dto.new_password);
    await this.usersRepository.save(user);
    await this.redisService.del(`user:${userId}`);

    return { message: 'Password updated successfully' };
  }

  async updateUser(dto: UpdateUserDto, user: IUser, file: Express.Multer.File) {
    try {
      // Remove removeAvatar from dto before updating DB
      const { removeAvatar, ...updateData } = dto;
      console.log('UpdateUser payload received:', updateData);

      if (!file) {
        if (removeAvatar === 'true') {
          const userDb = await this.findUserById(user.id);
          const avatar = userDb.avatar;

          if (avatar) {
            try {
              if (avatar.startsWith('http')) {
                await this.mediaService.deleteFile(avatar);
              }
            } catch (error) {
              console.error('Error deleting old avatar:', error);
            }
          }

          await this.usersRepository.update(
            { id: user.id },
            {
              ...updateData,
              avatar: null,
            },
          );

          // Queue background cache invalidation
          this.avatarUpdatesQueue.add(
            'avatar-updated',
            { user_id: user.id },
            { removeOnComplete: true, removeOnFail: true },
          );

          await this.redisService.del(`user:${user.id}`);
          return {
            message: 'Update successful',
            avatar: null,
          };
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
            if (avatar.startsWith('http')) {
              await this.mediaService.deleteFile(avatar);
            }
          } catch {
            console.error('Error when delete old file');
          }
        }

        const avatarUrl = await this.mediaService.uploadFile(file, 'avatars');

        await this.usersRepository.update(
          { id: user.id },
          {
            ...updateData,
            avatar: avatarUrl,
          },
        );

        // Queue background cache invalidation
        this.avatarUpdatesQueue.add(
          'avatar-updated',
          { user_id: user.id },
          { removeOnComplete: true, removeOnFail: true },
        );

        await this.redisService.del(`user:${user.id}`);
        return {
          message: 'Update successful',
          avatar: avatarUrl,
        };
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

  async updateCoverPhoto(
    user: IUser,
    file: Express.Multer.File,
    removeCoverPhoto?: string,
  ) {
    try {
      const userDb = await this.findUserById(user.id);
      const oldCover = userDb.cover_photo;

      if (removeCoverPhoto === 'true') {
        if (oldCover && oldCover.startsWith('http')) {
          try {
            await this.mediaService.deleteFile(oldCover);
          } catch (error) {
            console.error('Error deleting old cover photo:', error);
          }
        }
        await this.usersRepository.update(
          { id: user.id },
          { cover_photo: null },
        );
        await this.redisService.del(`user:${user.id}`);
        return { message: 'Cover photo removed', cover_photo: null };
      }

      if (!file) {
        throw new BadRequestException('File is required');
      }

      if (oldCover && oldCover.startsWith('http')) {
        try {
          await this.mediaService.deleteFile(oldCover);
        } catch {
          console.error('Error deleting old cover photo');
        }
      }

      const coverUrl = await this.mediaService.uploadFile(file, 'covers');

      await this.usersRepository.update(
        { id: user.id },
        { cover_photo: coverUrl },
      );
      await this.redisService.del(`user:${user.id}`);

      return {
        message: 'Cover photo updated',
        cover_photo: coverUrl,
      };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new InternalServerErrorException('Error updating cover photo');
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

  /**
   * Search users for messaging with ranking priorities.
   * Returns { data: users[] } to match SearchUserMessageResponseDto.
   */
  async searchUsersForMessage(userId: string, q?: string) {
    // Nếu không có keyword, trả về gợi ý (suggested users)
    if (!q || q.trim() === '') {
      const suggested = await this.relationsService.getSuggestedUsers(
        userId,
        10,
      );
      // Map suggested users to include online status
      const suggestedWithStatus = await Promise.all(
        suggested.map(async (u) => {
          const redisStatus = await this.redisService.get(
            `connection_number:${u.id}`,
          );
          const isOnline = !!redisStatus && parseInt(redisStatus) > 0;
          return {
            ...u,
            is_online: isOnline,
          };
        }),
      );
      return { data: suggestedWithStatus };
    }

    const prefix = `${q.toLowerCase()}%`;
    const keyword = `%${q.toLowerCase()}%`;

    const query = this.usersRepository
      .createQueryBuilder('user')
      .leftJoin(
        'relation',
        'r',
        `((r.request_side_id = :userId AND r.accept_side_id = user.id) OR 
          (r.request_side_id = user.id AND r.accept_side_id = :userId)) AND 
          r.relation_type = 'following'`,
      )
      .where(
        '(LOWER(user.username) LIKE :keyword OR LOWER(user.full_name) LIKE :keyword)',
        { keyword },
      )
      .andWhere('user.id != :userId', { userId })
      .andWhere(
        `user.id NOT IN (
          SELECT accept_side_id FROM relation WHERE request_side_id = :userId AND relation_type = 'block'
          UNION
          SELECT request_side_id FROM relation WHERE accept_side_id = :userId AND relation_type = 'block'
        )`,
      )
      .select([
        'user.id AS id',
        'user.username AS username',
        'user.full_name AS full_name',
        'user.avatar AS avatar',
        'user.privacy AS privacy',
        'user.message_privacy AS message_privacy',
      ])
      .addSelect(
        `MAX(CASE 
          WHEN LOWER(user.username) LIKE :prefix THEN 4
          WHEN LOWER(user.full_name) LIKE :prefix THEN 3
          WHEN LOWER(user.username) LIKE :keyword THEN 2
          ELSE 1 
        END)`,
        'search_rank',
      )
      .addSelect(
        `MAX(CASE WHEN r.id IS NOT NULL THEN 2 ELSE 1 END)`,
        'relation_rank',
      )
      .groupBy('user.id')
      .orderBy('search_rank', 'DESC')
      .addOrderBy('relation_rank', 'DESC')
      .addOrderBy('user.username', 'ASC')
      .limit(30)
      .setParameter('userId', userId)
      .setParameter('prefix', prefix)
      .setParameter('keyword', keyword);

    const results = await query.getRawMany();

    // Check online status in Redis for each matching user
    const resultsWithStatus = await Promise.all(
      results.map(async (u) => {
        const redisStatus = await this.redisService.get(
          `connection_number:${u.id}`,
        );
        const isOnline = !!redisStatus && parseInt(redisStatus) > 0;
        return {
          id: u.id,
          username: u.username,
          full_name: u.full_name,
          avatar: u.avatar,
          privacy: u.privacy,
          message_privacy: u.message_privacy,
          is_online: isOnline,
        };
      }),
    );

    return { data: resultsWithStatus };
  }
}
