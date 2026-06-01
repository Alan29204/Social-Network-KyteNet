import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SaveList } from './entities/save-list.entity';
import { CreateSaveListDto } from './dto/create-save-list.dto';
import { UpdateSaveListDto } from './dto/update-save-list.dto';
import { IUser } from 'src/modules/users/users.interface';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SaveListsService {
  constructor(
    @InjectRepository(SaveList)
    private readonly saveListRepository: Repository<SaveList>,
  ) {}

  async create(user: IUser, createSaveListDto: CreateSaveListDto) {
    try {
      const newList = new SaveList();
      newList.id = uuidv4();
      newList.user_id = user.id;
      newList.name = createSaveListDto.name;

      await this.saveListRepository.save(newList);
      return { message: 'Tạo bộ sưu tập thành công', data: newList };
    } catch (error) {
      throw new InternalServerErrorException('Lỗi khi tạo bộ sưu tập');
    }
  }

  async findAllByUser(user: IUser, page: number = 1, limit: number = 10) {
    try {
      const [data, total] = await this.saveListRepository.findAndCount({
        where: { user_id: user.id },
        order: { name: 'ASC' },
        skip: (page - 1) * limit,
        take: limit,
      });

      return {
        data,
        meta: {
          total,
          page,
          last_page: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      throw new InternalServerErrorException('Lỗi khi lấy danh sách bộ sưu tập');
    }
  }

  async findOne(id: string, user: IUser) {
    const list = await this.saveListRepository.findOne({ where: { id, user_id: user.id } });
    if (!list) {
      throw new NotFoundException('Không tìm thấy bộ sưu tập');
    }
    return list;
  }

  async update(id: string, updateSaveListDto: UpdateSaveListDto, user: IUser) {
    const list = await this.findOne(id, user);

    try {
      list.name = updateSaveListDto.name || list.name;
      await this.saveListRepository.save(list);
      return { message: 'Cập nhật bộ sưu tập thành công', data: list };
    } catch (error) {
      throw new InternalServerErrorException('Lỗi khi cập nhật bộ sưu tập');
    }
  }

  async remove(id: string, user: IUser) {
    const list = await this.findOne(id, user);

    try {
      await this.saveListRepository.remove(list);
      return { message: 'Xóa bộ sưu tập thành công' };
    } catch (error) {
      throw new InternalServerErrorException('Lỗi khi xóa bộ sưu tập');
    }
  }
}
