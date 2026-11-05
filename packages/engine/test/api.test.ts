import { expect, test } from 'vitest';
import * as engine from '../src';

test('API pública exporta o essencial', () => {
  for (const nome of [
    'novaPartida', 'reduce', 'ErroJogada', 'ehAcaoJogador', 'acoesValidas', 'todasAcoesValidas', 'visaoDoJogador', 'botFacil',
    'novoBaralho', 'embaralhar', 'mulberry32', 'forca', 'ehFamilia', 'ESCADAS', 'REGRAS_RANQUEADA', 'quemDeveAgir',
  ]) {
    expect(engine).toHaveProperty(nome);
  }
});
