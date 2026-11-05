import { createHash, randomBytes } from 'node:crypto';

/** 32 bytes aleatórios em base64url (43 caracteres). */
export const gerarToken = (): string => randomBytes(32).toString('base64url');

/** O banco guarda só isto: quem ler o banco não consegue se passar pelo usuário. */
export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');
