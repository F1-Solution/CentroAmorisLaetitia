/** Forma delle risposte di `/accounts`, che rispecchia packages/contracts/src/accounts.ts. */
export interface Account {
  readonly id: string;
  readonly email: string;
  readonly fullName: string;
  readonly isActive: boolean;
  readonly roleKeys: readonly string[];
  readonly lastLoginAt: string | null;
  readonly createdAt: string;
}

export type AccountRoleKey = 'editor' | 'amministrazione';

export interface CreateAccountBody {
  readonly email: string;
  readonly fullName: string;
  readonly roleKeys: readonly AccountRoleKey[];
}
