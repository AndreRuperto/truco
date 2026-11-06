import { describe, expect, test } from 'vitest';
import { distribuirSemRitual } from '../src/testes';
import { idCarta } from '../src/cartas';
import { novaPartida } from '../src/estado';
import { reduce } from '../src/reducer';
import { ESCADAS, REGRAS_RANQUEADA } from '../src/regras';
import { MAOS_DUPLA0_VENCE, MINEIRO, PAULISTA, baralhoCom, partida } from './helpers';

describe('estado não compartilha referências com a entrada', () => {
  test('mutar o baralho depois de distribuir não altera o estado', () => {
    const baralho = baralhoCom(MAOS_DUPLA0_VENCE, '5p');
    const s = distribuirSemRitual(partida(PAULISTA), baralho);
    baralho[0].valor = '3'; // 1ª carta → cadeira 0 (era 4p)
    baralho[12].naipe = 'copas'; // vira (era 5p)
    expect(idCarta(s.mao!.maos[0][0])).toBe('4p');
    expect(idCarta(s.mao!.vira!)).toBe('5p');
  });

  test('novaPartida copia as regras', () => {
    expect(novaPartida(REGRAS_RANQUEADA.paulista).regras).not.toBe(REGRAS_RANQUEADA.paulista);
    const regras = { ...MINEIRO };
    const s = novaPartida(regras);
    regras.familia = 'off';
    expect(s.regras.familia).toBe('fechada');
  });
});

describe('constantes congeladas', () => {
  test('ESCADAS', () => {
    expect(Object.isFrozen(ESCADAS)).toBe(true);
    for (const e of Object.values(ESCADAS)) expect(Object.isFrozen(e)).toBe(true);
    expect(() => {
      (ESCADAS['1-3-6-9-12'] as number[])[1] = 99;
    }).toThrow(TypeError);
  });

  test('REGRAS_RANQUEADA', () => {
    expect(Object.isFrozen(REGRAS_RANQUEADA)).toBe(true);
    for (const r of Object.values(REGRAS_RANQUEADA)) expect(Object.isFrozen(r)).toBe(true);
  });
});
