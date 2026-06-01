import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { SaveListsService } from './save-lists.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResponseMessage, User } from 'src/common/decorators/customize';
import { IUser } from 'src/modules/users/users.interface';
import { CreateSaveListDto } from './dto/create-save-list.dto';
import { UpdateSaveListDto } from './dto/update-save-list.dto';

@ApiTags('Save Lists (Bộ sưu tập)')
@Controller('save-lists')
export class SaveListsController {
  constructor(private readonly saveListsService: SaveListsService) {}

  @Post()
  @ResponseMessage('Tạo bộ sưu tập thành công')
  @ApiOperation({ summary: 'Tạo bộ sưu tập mới' })
  create(@User() user: IUser, @Body() createSaveListDto: CreateSaveListDto) {
    return this.saveListsService.create(user, createSaveListDto);
  }

  @Get()
  @ResponseMessage('Lấy danh sách bộ sưu tập thành công')
  @ApiOperation({ summary: 'Lấy danh sách bộ sưu tập của người dùng hiện tại' })
  findAll(
    @User() user: IUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.saveListsService.findAllByUser(user, page ? +page : 1, limit ? +limit : 10);
  }

  @Put(':id')
  @ResponseMessage('Cập nhật bộ sưu tập thành công')
  @ApiOperation({ summary: 'Đổi tên bộ sưu tập' })
  update(
    @Param('id') id: string,
    @Body() updateSaveListDto: UpdateSaveListDto,
    @User() user: IUser,
  ) {
    return this.saveListsService.update(id, updateSaveListDto, user);
  }

  @Delete(':id')
  @ResponseMessage('Xóa bộ sưu tập thành công')
  @ApiOperation({ summary: 'Xóa bộ sưu tập' })
  remove(@Param('id') id: string, @User() user: IUser) {
    return this.saveListsService.remove(id, user);
  }
}
