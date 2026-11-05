import { defineConfig } from 'drizzle-kit';

// Só gera SQL a partir do schema (não conecta em banco nenhum).
export default defineConfig({ dialect: 'postgresql', schema: './src/banco/schema.ts', out: './drizzle' });
