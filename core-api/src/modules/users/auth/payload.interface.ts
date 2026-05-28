import { RoleType } from 'src/common/enums/role.enum';

export interface IPayload {
  id: string;
  deviceSecssionId: string;
  role: RoleType;
  sub?: number;
  iat?: number;
  exp?: number;
}
