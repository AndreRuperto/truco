import { reduce, visaoDoJogador } from '@truco/engine';
import { describe, expect, test } from 'vitest';
import { baloesAtivos, type Evento, FALA_TEXTO, textoDaAcao } from '../src/logica/eventos';
import { distribuida, jogar, PAULISTA } from './fixtures';

describe('texto dos balões de ação', () => {
  test('truco e aumento usam o nível do estado anterior', () => {
    const s = distribuida(PAULISTA);
    expect(textoDaAcao({ cadeira: 0, tipo: 'truco' }, visaoDoJogador(s, 1))).toBe('TRUCO!');
    const pendente = reduce(s, { tipo: 'truco', cadeira: 0 });
    expect(textoDaAcao({ cadeira: 1, tipo: 'aumentar' }, visaoDoJogador(pendente, 0))).toBe('SEIS!');
    // truco aceito (nível 1): o próximo pedido, da outra dupla, é "seis"
    const aceito = jogar(reduce(pendente, { tipo: 'aceitar', cadeira: 1 }), [[0, 0]]);
    expect(textoDaAcao({ cadeira: 1, tipo: 'truco' }, visaoDoJogador(aceito, 0))).toBe('SEIS!');
  });

  test('respostas e família', () => {
    expect(textoDaAcao({ cadeira: 1, tipo: 'aceitar' }, null)).toBe('Aceito!');
    expect(textoDaAcao({ cadeira: 1, tipo: 'correr' }, null)).toBe('Corro!');
    expect(textoDaAcao({ cadeira: 1, tipo: 'familia' }, null)).toBe('Família!');
    expect(textoDaAcao({ cadeira: 1, tipo: 'jogar' }, null)).toBeNull();
    expect(textoDaAcao({ cadeira: 1, tipo: 'mao10', jogar: true }, null)).toBe('Vamos!');
    expect(textoDaAcao({ cadeira: 1, tipo: 'mao10', jogar: false }, null)).toBe('Corro!');
    // servidor antigo, sem `jogar`: sem balão
    expect(textoDaAcao({ cadeira: 1, tipo: 'mao10' }, null)).toBeNull();
  });

  test('ritual e família viram balões curtos', () => {
    expect(textoDaAcao({ cadeira: 3, tipo: 'embaralhar' }, null)).toBe('Embaralhando…');
    expect(textoDaAcao({ cadeira: 3, tipo: 'passarCorte' }, null)).toBe('Corta aí!');
    expect(textoDaAcao({ cadeira: 2, tipo: 'cortar', fracao: 0.4 }, null)).toBe('Cortei.');
    expect(textoDaAcao({ cadeira: 2, tipo: 'abrir3' }, null)).toBe('Abri 3!');
    expect(textoDaAcao({ cadeira: 2, tipo: 'dar3', para: 0 }, null)).toBe('Toma 3, parceiro!');
    expect(textoDaAcao({ cadeira: 2, tipo: 'devolver' }, null)).toBe('Pode dar.');
    expect(textoDaAcao({ cadeira: 3, tipo: 'distribuir', modo: 'subindo', ordem: [0, 1, 2, 3] }, null)).toBe('Subindo!');
    expect(textoDaAcao({ cadeira: 0, tipo: 'familia', aberta: false }, null)).toBe('Família fechada!');
    expect(textoDaAcao({ cadeira: 0, tipo: 'familia', aberta: true }, null)).toBe('Família aberta!');
    expect(textoDaAcao({ cadeira: 1, tipo: 'conferir', conferir: true }, null)).toBe('Confere!');
    expect(textoDaAcao({ cadeira: 1, tipo: 'conferir', conferir: false }, null)).toBeNull();
  });

  test('falas', () => {
    expect(FALA_TEXTO.bora).toBe('Bora!');
    expect(FALA_TEXTO.truco).toBe('TRUCO!');
  });
});

describe('baloesAtivos', () => {
  test('só os recentes, o último de cada cadeira; sinais não viram balão', () => {
    const eventos: Evento[] = [
      { id: 1, em: 1_000, tipo: 'fala', de: 1, texto: 'Boa!' },
      { id: 2, em: 2_000, tipo: 'acao', de: 2, texto: 'TRUCO!' },
      { id: 3, em: 2_500, tipo: 'fala', de: 2, texto: 'Bora!' },
      { id: 4, em: 3_000, tipo: 'sinal', de: 2, sinal: 'zap', interceptado: false },
    ];
    expect(baloesAtivos(eventos, 3_600)).toEqual(new Map([[2, 'Bora!']]));
    expect(baloesAtivos(eventos, 3_400).get(1)).toBe('Boa!');
  });
});
