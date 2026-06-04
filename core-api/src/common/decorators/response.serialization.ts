import { ApiProperty } from '@nestjs/swagger';

export class AppResponseSerialization<T = Record<string, unknown>> {
  @ApiProperty({ example: 200, description: 'Mã trạng thái phản hồi HTTP' })
  statusCode: number;

  @ApiProperty({
    example: 'Yêu cầu xử lý thành công',
    description: 'Thông báo đi kèm phản hồi',
  })
  message: string;

  @ApiProperty({ description: 'Dữ liệu phản hồi' })
  data: T;
}
