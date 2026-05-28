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
} from '@nestjs/common';
import { UsersService } from './users.service';
import { Public, ResponseMessage, User } from 'src/common/decorators/customize';
import { IUser } from './users.interface';
import { UpdateUserDto } from './dto/update-user.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { isUUID } from 'class-validator';
import { FileInterceptor } from '@nestjs/platform-express';
import { LoginDto } from './dto/login.dto';
import { AfterSignUpDto } from './dto/after-signup.dto';

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

    if (!privacySeeProfile) {
      const { id, email, avatar, username, privacy } = userResult;
      return {
        id,
        email,
        avatar,
        username,
        privacy,
      };
    }
    return result;
  }

  @Patch('/profile')
  @ResponseMessage('Update profile user seccessfully')
  @ApiOperation({ summary: 'Update profile user' })
  @UseInterceptors(FileInterceptor('avatar-user'))
  async updateUser(
    @Body() dto: UpdateUserDto,
    @User() user: IUser,
    @UploadedFile()
    file: Express.Multer.File,
  ) {
    return await this.usersService.updateUser(dto, user, file);
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
  forgotPassword(@Body('email') email: string) {
    return this.usersService.forgotPassword(email);
  }

  @Post('/reset-password')
  @Public()
  @ResponseMessage('Password reset successfully')
  @ApiOperation({ summary: 'Reset password with OTP code' })
  resetPassword(
    @Body() body: { email: string; reset_code: string; new_password: string },
  ) {
    return this.usersService.resetPassword(
      body.email,
      body.reset_code,
      body.new_password,
    );
  }
}

export interface LoginMetaData {
  deviceId: string;
  ipAddress: string;
}

