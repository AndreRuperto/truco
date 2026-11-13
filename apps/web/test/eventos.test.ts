import { reduce, visaoDoJogador } from '@truco/engine';
import { describe, expect, test } from 'vitest';
import { baloesAtivos, type Evento, FALA_TEXTO, textoDaAcao } from '../src/logica/eventos';
import { distribuida, jogar, naSegundaRodada, PAULISTA } from './fixtures';

describe('texto dos balões de ação', () => {
  test('truco e aumento usam o nível do estado anterior', () => {
    const s = naSegundaRodada(distribuida(PAULISTA)); // truco só da 2ª rodada em diante
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
    expect(textoDaAcao({ cadeira: 2, tipo: 'cortar', fracao: 0.3 }, null)).toBe('Cortei.');
    expect(textoDaAcao({ cadeira: 2, tipo: 'abrir3' }, null)).toBe('Abri 3!');
    expect(textoDaAcao({ cadeira: 2, tipo: 'dar3', para: 0 }, null)).toBe('Toma 3, parceiro!');
    expect(textoDaAcao({ cadeira: 2, tipo: 'devolver' }, null)).toBe('Pode dar.');
    expect(textoDaAcao({ cadeira: 3, tipo: 'distribuir', modo: 'subindo', ordem: [0, 1, 2, 3] }, null)).toBe('Subindo!');
    expect(textoDaAcao({ cadeira: 0, tipo: 'familia', aberta: false }, null)).toBe('Família fechada!');
    expect(textoDaAcao({ cadeira: 0, tipo: 'familia', aberta: true }, null)).toBe('Família aberta!');
    expect(textoDaAcao({ cadeira: 1, tipo: 'conferir', conferir: true }, null)).toBe('Confere!');
    expect(textoDaAcao({ cadeira: 1, tipo: 'conferir', conferir: false }, null)).toBe('Pode ir.');
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

  test('com limite (telas de até 340 px): só os N balões mais recentes, de cadeiras diferentes', () => {
    const eventos: Evento[] = [
      { id: 1, em: 1_000, tipo: 'acao', de: 0, texto: 'Pode dar.' },
      { id: 2, em: 1_200, tipo: 'fala', de: 1, texto: 'Boa!' },
      { id: 3, em: 1_400, tipo: 'fala', de: 3, texto: 'Vixe!' },
      { id: 4, em: 1_600, tipo: 'fala', de: 2, texto: 'Bora!' },
      // A cadeira 1 fala de novo: passa a ser a mais recente.
      { id: 5, em: 1_800, tipo: 'fala', de: 1, texto: 'TRUCO!' },
    ];
    expect(baloesAtivos(eventos, 2_000, undefined, 2)).toEqual(new Map([[2, 'Bora!'], [1, 'TRUCO!']]));
    expect(baloesAtivos(eventos, 2_000, undefined, 2).size).toBe(2);
    // Sem limite, continua um por cadeira.
    expect(baloesAtivos(eventos, 2_000).size).toBe(4);
  });
});
