import { describe, expect, it } from 'vitest';
import { bootstrapRoles, ROLE_PASSWORDS } from '../helpers/db';

describe('F-63 database role bootstrap', () => {
  it('accepts synthetic role passwords containing SQL and shell special characters', () => {
    expect(() => bootstrapRoles()).not.toThrow();
    expect(ROLE_PASSWORDS.owner).toContain("'");
    expect(ROLE_PASSWORDS.owner).toContain('\\');
    expect(ROLE_PASSWORDS.owner).toContain('$');
    expect(ROLE_PASSWORDS.owner).toContain(';');
  });

  it('fails before role changes when any password is empty', () => {
    expect(() => bootstrapRoles({ ...ROLE_PASSWORDS, owner: '' })).toThrow();
  });
});
