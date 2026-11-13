import { Injectable } from '@angular/core';

const LEGACY_DEFAULT_PASSWORD_HASH =
  '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';
const PASSWORD_SCHEME = 'pbkdf2-sha256';
const PASSWORD_ITERATIONS = 210_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

@Injectable({ providedIn: 'root' })
export class PasswordService {
  public readonly legacyDefaultPasswordHash = LEGACY_DEFAULT_PASSWORD_HASH;

  public async hash(password: string): Promise<string> {
    if (!password.trim()) {
      throw new Error('A non-empty password is required.');
    }

    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const derivedKey = await this.deriveKey(password, salt, PASSWORD_ITERATIONS);
    return `${PASSWORD_SCHEME}$${PASSWORD_ITERATIONS}$${this.toHex(salt)}$${this.toHex(derivedKey)}`;
  }

  public async verify(candidate: string, expectedHash: string): Promise<boolean> {
    if (!candidate || !expectedHash) {
      return false;
    }

    const parts = expectedHash.split('$');
    if (parts.length === 4 && parts[0] === PASSWORD_SCHEME) {
      const iterations = Number(parts[1]);
      const salt = this.fromHex(parts[2]);
      const expected = this.fromHex(parts[3]);

      if (!Number.isInteger(iterations) || iterations < 100_000 || iterations > 1_000_000 ||
          salt?.length !== SALT_BYTES || expected?.length !== HASH_BYTES) {
        return false;
      }

      const actual = await this.deriveKey(candidate, salt, iterations);
      return this.equalBytes(actual, expected);
    }

    // Older installations stored plain SHA-256 hashes. Keep verification during migration.
    if (!/^[a-f0-9]{64}$/i.test(expectedHash)) {
      return false;
    }

    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(candidate));
    return this.equalBytes(new Uint8Array(digest), this.fromHex(expectedHash)!);
  }

  public isCustomPasswordHash(passwordHash?: string | null): boolean {
    return !!passwordHash && passwordHash !== LEGACY_DEFAULT_PASSWORD_HASH;
  }

  public isLegacyPasswordHash(passwordHash?: string | null): boolean {
    return !!passwordHash && /^[a-f0-9]{64}$/i.test(passwordHash);
  }

  private async deriveKey(
    password: string,
    salt: Uint8Array,
    iterations: number
  ): Promise<Uint8Array> {
    const material = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: new Uint8Array(salt), iterations },
      material,
      HASH_BYTES * 8
    );
    return new Uint8Array(bits);
  }

  private toHex(bytes: Uint8Array): string {
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  private fromHex(hex: string): Uint8Array | null {
    if (hex.length % 2 !== 0 || !/^[a-f0-9]+$/i.test(hex)) {
      return null;
    }

    return Uint8Array.from(hex.match(/.{2}/g)!, (byte) => parseInt(byte, 16));
  }

  private equalBytes(left: Uint8Array, right: Uint8Array): boolean {
    if (left.length !== right.length) {
      return false;
    }

    let difference = 0;
    for (let index = 0; index < left.length; index++) {
      difference |= left[index] ^ right[index];
    }
    return difference === 0;
  }
}
