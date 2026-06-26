import {
  Controller,
  Get,
  Body,
  Param,
  ParseUUIDPipe,
  Patch,
  Delete,
  NotFoundException,
  Post,
  UseInterceptors,
  UploadedFile,
  Query,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { Public, ResponseMessage, User } from 'src/common/decorators/customize';
import { IUser } from './users.interface';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { SearchUserMessageResponseDto } from './dto/search-user-message.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { LoginDto } from './dto/login.dto';
import { AfterSignUpDto } from './dto/after-signup.dto';
import { SendRegisterOtpDto } from './dto/send-register-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RoleType } from 'src/common/enums/role.enum';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ResponseMessage('Fetch all users successfully')
  @ApiOperation({ summary: 'Admin: Get all users' })
  findAll(@User() user: IUser) {
    if (user?.role !== RoleType.ADMIN) {
      throw new ForbiddenException('Admin access required');
    }
    return this.usersService.findAll();
  }

  @Get('/account')
  @ResponseMessage('Get account from header successfully')
  @ApiOperation({ summary: 'Get account' })
  getAccount(@User() user: IUser) {
    return this.usersService.getAccount(user);
  }

  @Post('/login')
  @Public()
  @ResponseMessage('Login successfully')
  @ApiOperation({ summary: 'Login with email and password' })
  async login(@Body() loginDto: LoginDto) {
    const user = await this.usersService.validateUser(
      loginDto.email,
      loginDto.password,
    );
    return await this.usersService.login(user);
  }

  @Get('search-messages')
  @ResponseMessage('Search users for messaging')
  @ApiOperation({ summary: 'Search users with message priority ranking' })
  @ApiOkResponse({
    type: SearchUserMessageResponseDto,
    description: 'List of matched users',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    type: String,
    description: 'Search keyword (empty = suggested users)',
  })
  async searchUsersForMessage(
    @User() user: IUser,
    @Query('q') q?: string,
  ): Promise<SearchUserMessageResponseDto> {
    return this.usersService.searchUsersForMessage(user.id, q);
  }

  @Get(':user_id')
  @ResponseMessage('Find user by ID successfully')
  @ApiOperation({ summary: 'Find user by ID' })
  async getProfile(
    @Param('user_id', ParseUUIDPipe) user_id: string,
    @User() user: IUser,
  ) {
    // Absolute Override: nếu bị chặn (2 chiều) -> coi như không tồn tại (404)
    if (user.id !== user_id) {
      const blocked = await this.usersService.areBlocked(user.id, user_id);
      if (blocked) {
        throw new NotFoundException('User profile is not available');
      }
    }

    const userResult = await this.usersService.findUserById(user_id);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = userResult;

    const privacySeeProfile = await this.usersService.privacySeeProfile(
      user.id,
      user_id,
    );

    const stats = await this.usersService.getProfileStats(user_id, user.id);
    const relationStatus = await this.usersService.getRelationStatus(
      user.id,
      user_id,
    );
    const isFollowing = relationStatus === 'following';

    if (!privacySeeProfile) {
      const { id, email, avatar, cover_photo, username, privacy } = userResult;
      return {
        id,
        email,
        avatar,
        cover_photo,
        username,
        privacy,
        isFollowing,
        relationStatus,
        postsCount: stats.postsCount,
        followersCount: stats.followersCount,
        followingCount: stats.followingCount,
      };
    }
    return { ...result, isFollowing, relationStatus, ...stats };
  }

  @Patch('/profile')
  @ResponseMessage('Update profile user seccessfully')
  @ApiOperation({ summary: 'Update profile user' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateUserDto })
  @UseInterceptors(FileInterceptor('avatar-user'))
  async updateUser(
    @Body() dto: UpdateUserDto,
    @User() user: IUser,
    @UploadedFile()
    file: Express.Multer.File,
  ) {
    return await this.usersService.updateUser(dto, user, file);
  }

  @Patch('/profile/password')
  @ResponseMessage('Change password successfully')
  @ApiOperation({ summary: 'Change current user password' })
  @ApiBody({ type: ChangePasswordDto })
  async changePassword(@Body() dto: ChangePasswordDto, @User() user: IUser) {
    return this.usersService.changePassword(user.id, dto);
  }

  @Patch('/profile/cover-photo')
  @ResponseMessage('Update cover photo successfully')
  @ApiOperation({ summary: 'Update cover photo user' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('cover-photo'))
  async updateCoverPhoto(
    @User() user: IUser,
    @UploadedFile() file: Express.Multer.File,
    @Body('removeCoverPhoto') removeCoverPhoto?: string,
  ) {
    return await this.usersService.updateCoverPhoto(
      user,
      file,
      removeCoverPhoto,
    );
  }

  @Post('/register/send-otp')
  @Public()
  @ResponseMessage('OTP sent successfully')
  @ApiOperation({ summary: 'Gửi mã OTP xác thực email khi đăng ký' })
  sendRegisterOtp(@Body() dto: SendRegisterOtpDto) {
    return this.usersService.sendRegisterOtp(dto.email);
  }

  @Post('/signup')
  @Public()
  @ResponseMessage('Create user successfully')
  @ApiOperation({
    summary: 'Sign up (yêu cầu OTP đã xác thực email)',
  })
  afterSignUp(@Body() dto: AfterSignUpDto) {
    return this.usersService.afterSignUp(dto);
  }

  @Delete('/delete')
  @ResponseMessage('Delete account successfully')
  @ApiOperation({ summary: 'Delete account' })
  afterDelete(@User() user: IUser) {
    return this.usersService.afterDelete(user.id);
  }

  @Post('/forgot-password')
  @Public()
  @ResponseMessage('Password reset request processed')
  @ApiOperation({ summary: 'Request password reset (sends OTP code)' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.usersService.forgotPassword(dto.email);
  }

  @Post('/reset-password')
  @Public()
  @ResponseMessage('Password reset successfully')
  @ApiOperation({ summary: 'Reset password with OTP code' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.usersService.resetPassword(
      dto.email,
      dto.reset_code,
      dto.new_password,
    );
  }
}

