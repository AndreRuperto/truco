import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { servicosDeTeste } from '../src/servicos';
import { type BancoDeTeste, bancoDeTeste } from './banco-helpers';
import { subirApp } from './http-helpers';

/** Vozes pessoais saíram do Git (código público): vêm de uma pasta à parte, no mesmo /vozes/. */
let b: BancoDeTeste;
let pastaWeb: string;
let pastaVozes: string;

beforeAll(async () => {
  b = await bancoDeTeste();
  pastaWeb = mkdtempSync(join(tmpdir(), 'truco-web-'));
  writeFileSync(join(pastaWeb, 'index.html'), '<!doctype html><title>t</title>');
  mkdirSync(join(pastaWeb, 'vozes'));
  writeFileSync(join(pastaWeb, 'vozes', '0-truco-0.mp3'), 'build');
  pastaVozes = mkdtempSync(join(tmpdir(), 'truco-vozes-'));
  writeFileSync(join(pastaVozes, 'andre-truco-0.mp3'), 'pessoal');
  writeFileSync(join(pastaVozes, 'segredo.txt'), 'nao');
});
afterAll(async () => b?.fechar());

describe('vozes pessoais fora do Git', () => {
  test('serve a voz pessoal da pasta à parte e as outras do build', async () => {
    const app = await subirApp(servicosDeTeste(b.db), { pastaWeb, pastaVozesPessoais: pastaVozes });
    try {
      const p = await app.pedir('/vozes/andre-truco-0.mp3');
      expect(p.status).toBe(200);
      expect(p.texto).toBe('pessoal');
      expect(p.headers.get('cache-control')).toMatch(/max-age=604800/);
      const comum = await app.pedir('/vozes/0-truco-0.mp3');
      expect(comum.status).toBe(200);
      expect(comum.texto).toBe('build');
    } finally {
      await app.fechar();
    }
  });

  test('não entrega nada que não seja .mp3 nem arquivo que não existe', async () => {
    const app = await subirApp(servicosDeTeste(b.db), { pastaWeb, pastaVozesPessoais: pastaVozes });
    try {
      expect((await app.pedir('/vozes/segredo.txt')).status).toBe(404);
      expect((await app.pedir('/vozes/andre-nao-existe-0.mp3')).status).toBe(404);
      expect((await app.pedir('/vozes/../segredo.txt')).status).toBe(404);
    } finally {
      await app.fechar();
    }
  });

  test('sem a pasta configurada, a voz pessoal some (404) e o resto continua', async () => {
    const app = await subirApp(servicosDeTeste(b.db), { pastaWeb });
    try {
      expect((await app.pedir('/vozes/andre-truco-0.mp3')).status).toBe(404);
      expect((await app.pedir('/vozes/0-truco-0.mp3')).status).toBe(200);
    } finally {
      await app.fechar();
    }
  });
});
