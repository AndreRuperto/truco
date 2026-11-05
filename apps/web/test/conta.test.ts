import { describe, expect, test } from 'vitest';
import { formatarEspera, NOME_MODO, NOME_VARIANTE, textoDelta, textoErroFila, textoResultado } from '../src/logica/conta';

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

describe('fila', () => {
  test('formatarEspera', () => {
    expect(formatarEspera(0)).toBe('0:00');
    expect(formatarEspera(75)).toBe('1:15');
  });

  test('textoErroFila', () => {
    expect(textoErroFila('fila bloqueada até 2026-11-05T12:05:00.000Z por abandono de partida ranqueada')).toMatch(
      /^Fila bloqueada até \d{2}:\d{2} por abandono de partida ranqueada\.$/,
    );
    expect(textoErroFila('entre na sua conta para jogar ranqueada')).toBe('Entre na sua conta para jogar ranqueada.');
    expect(textoErroFila('rede caiu')).toBe('Não foi possível entrar na fila: rede caiu');
    expect(textoErroFila('você já tem uma partida ranqueada em andamento (mesa abrindo); se ela não começar, libera sozinha — tente de novo em alguns segundos')).toBe(
      'Você acabou de ser pareado e a mesa está abrindo. Se ela não começar, a fila libera sozinha — tente de novo em alguns segundos.',
    );
    expect(textoErroFila('você já tem uma partida ranqueada em andamento; a fila libera sozinha quando ela acabar')).toBe(
      'Você já tem uma partida ranqueada em andamento (outra aba?). A fila libera sozinha quando ela acabar.',
    );
  });
});
