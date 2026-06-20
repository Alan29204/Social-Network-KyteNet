import { IsNotEmpty, IsUUID } from 'class-validator';

export class DeleteNotificationUserDto {
  @IsUUID()
  @IsNotEmpty()
  noti_user_id: string;
}
