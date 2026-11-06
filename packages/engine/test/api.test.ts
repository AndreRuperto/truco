import { expect, test } from 'vitest';
import * as engine from '../src';
import * as testes from '../src/testes';

test('API pública exporta o essencial', () => {
  for (const nome of [
    'novaPartida', 'reduce', 'ErroJogada', 'ehAcaoJogador', 'acoesValidas', 'todasAcoesValidas', 'visaoDoJogador', 'botFacil',
    'novoBaralho', 'embaralhar', 'mulberry32', 'forca', 'ehFamilia', 'ESCADAS', 'REGRAS_RANQUEADA', 'quemDeveAgir',
    'riffle', 'completarSorte', 'semSorte', 'cartasDaPartida', 'ehFaseRitual',
  ]) {
    expect(engine).toHaveProperty(nome);
  }
});

test('atalhos de teste ficam fora da API pública, em @truco/engine/testes', () => {
  for (const nome of ['distribuirSemRitual', 'ritualMinimo']) {
    expect(engine).not.toHaveProperty(nome);
    expect(testes).toHaveProperty(nome);
  }
});
