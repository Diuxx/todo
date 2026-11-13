import { PasswordService } from './password.service';

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(() => {
    service = new PasswordService();
  });

  it('creates salted hashes that verify with the correct password', async () => {
    const firstHash = await service.hash('a strong example password');
    const secondHash = await service.hash('a strong example password');

    expect(firstHash).toContain('pbkdf2-sha256$');
    expect(firstHash).not.toEqual(secondHash);
    expect(await service.verify('a strong example password', firstHash)).toBeTrue();
    expect(await service.verify('wrong password', firstHash)).toBeFalse();
  });

  it('verifies legacy SHA-256 passwords for migration', async () => {
    const legacyHash = '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';

    expect(await service.verify('test', legacyHash)).toBeTrue();
    expect(await service.verify('different', legacyHash)).toBeFalse();
    expect(service.isCustomPasswordHash(legacyHash)).toBeFalse();
  });

  it('rejects invalid password records and empty inputs', async () => {
    expect(await service.verify('test', '')).toBeFalse();
    expect(await service.verify('test', 'pbkdf2-sha256$1$00$11')).toBeFalse();
    await expectAsync(service.hash('   ')).toBeRejected();
  });
});
