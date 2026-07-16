import { UsersService } from './users.service';

/**
 * Kiểm thử băm/đối chiếu mật khẩu (bcrypt). Hai method này không dùng tới các
 * dependency được inject nên có thể khởi tạo service với null.
 */
describe('UsersService password hashing', () => {
  const service = new UsersService(
    null as any, // usersRepository
    null as any, // redisService
    null as any, // authService
    null as any, // relationsService
    null as any, // mediaService
    null as any, // avatarUpdatesQueue
    null as any, // mailService
  );

  it('hashes a password into something other than the plaintext', async () => {
    const hash = await service.getHashPassword('secret123');
    expect(typeof hash).toBe('string');
    expect(hash).not.toBe('secret123');
  });

  it('validates a correct password against its hash', async () => {
    const hash = await service.getHashPassword('secret123');
    expect(service.isValidPassword('secret123', hash)).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await service.getHashPassword('secret123');
    expect(service.isValidPassword('wrong-password', hash)).toBe(false);
  });
});
