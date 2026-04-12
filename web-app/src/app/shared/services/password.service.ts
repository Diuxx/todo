import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PasswordService {
  public readonly defaultPassword = 'test';
  public readonly defaultPasswordHash =
    '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';

  public async hash(password: string): Promise<string> {
    const buffer = new TextEncoder().encode(password);
    const digest = await crypto.subtle.digest('SHA-256', buffer);

    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  public async verify(candidate: string, expectedHash: string): Promise<boolean> {
    return (await this.hash(candidate)) === expectedHash;
  }

  public isCustomPasswordHash(passwordHash?: string | null): boolean {
    return !!passwordHash && passwordHash !== this.defaultPasswordHash;
  }
}
