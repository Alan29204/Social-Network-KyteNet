import {
  Controller,
  Get,
  Body,
  Param,
  Patch,
  Delete,
  BadRequestException,
  Post,
  UseInterceptors,
  UploadedFile,
  Query,
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
import { isUUID } from 'class-validator';
import { FileInterceptor } from '@nestjs/platform-express';
import { LoginDto } from './dto/login.dto';
import { AfterSignUpDto } from './dto/after-signup.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Public()
  @ResponseMessage('Fetch all users successfully')
  @ApiOperation({ summary: 'Get all users' })
  findAll() {
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
    return await this.usersService.login(user, loginDto);
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
  async getProfile(@Param('user_id') user_id: string, @User() user: IUser) {
    if (!isUUID(user_id)) {
      throw new BadRequestException(`Invalid ID format: ${user_id}`);
    }
    const userResult = await this.usersService.findUserById(user_id);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = userResult;

    const privacySeeProfile = await this.usersService.privacySeeProfile(
      user.id,
      user_id,
    );

    const stats = await this.usersService.getProfileStats(user_id);
    const relationStatus = await (
      this.usersService as any
    ).relationsService.getRelation(user.id, user_id);
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
        ...stats,
      };
    }
    return { ...result, isFollowing, ...stats };
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
    return await this.usersService.updateCoverPhoto(user, file, removeCoverPhoto);
  }

  @Post('/signup')
  @Public()
  @ResponseMessage('Create user successfully')
  @ApiOperation({
    summary: 'Sign up (no OTP required)',
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

export interface LoginMetaData {
  deviceId: string;
  ipAddress: string;
}
