import { describe, expect, test } from 'vitest';
import { NOME_MODO, NOME_VARIANTE, textoDelta, textoResultado } from '../src/logica/conta';

const base = { partidaId: 1, variante: 'paulista', modo: 'ranqueada', ranqueada: true, nos: 12, eles: 3, iniciadaEm: '', deltaElo: 16 } as const;

describe('textos de conta', () => {
  test('nomes', () => {
    expect(NOME_VARIANTE.mineiro).toBe('Mineiro');
    expect(NOME_MODO.desafio).toBe('Desafio');
    expect(NOME_MODO.ranqueada).toBe('Ranqueada');
  });

  test('textoResultado', () => {
    expect(textoResultado({ ...base, venceu: true, abandonou: false, terminadaEm: 'x' })).toBe('Vitória');
    expect(textoResultado({ ...base, venceu: false, abandonou: false, terminadaEm: 'x' })).toBe('Derrota');
    expect(textoResultado({ ...base, venceu: false, abandonou: true, terminadaEm: null })).toBe('Abandonou');
    expect(textoResultado({ ...base, venceu: null, abandonou: false, terminadaEm: null })).toBe('Em andamento');
  });

  test('textoDelta', () => {
    expect(textoDelta(16)).toBe('+16');
    expect(textoDelta(-8)).toBe('−8');
    expect(textoDelta(0)).toBe('0');
    expect(textoDelta(null)).toBe('');
  });
});
