import { describe, expect, test } from 'vitest';
import { conquistasDe, type TotaisConquista } from '../src/ranking/conquistas';

const zero: TotaisConquista = { jogos: 0, vitorias: 0, trucosPedidos: 0, trucosAceitos: 0, ranqueadas: 0, variantes: 0, privadas: 0, lavadas: 0, pontos: 0 };
const feitas = (t: Partial<TotaisConquista>) => conquistasDe({ ...zero, ...t }).filter((c) => c.alcancada).map((c) => c.id);

describe('conquistas', () => {
  test('ninguém começa com nada; o progresso fica no teto da meta', () => {
    expect(feitas({})).toEqual([]);
    const c = conquistasDe({ ...zero, trucosPedidos: 35 }).find((x) => x.id === 'trucador')!;
    expect(c).toMatchObject({ alcancada: true, progresso: { atual: 20, meta: 20 } });
    expect(conquistasDe(zero).find((x) => x.id === 'lavada')!.progresso).toBeNull();
  });

  test('cada uma no seu limite', () => {
    expect(feitas({ vitorias: 1, jogos: 10 })).toEqual(['primeira-vitoria', 'frequentador']);
    expect(feitas({ lavadas: 1, privadas: 1, variantes: 2 })).toEqual(['lavada', 'com-a-turma', 'dois-sotaques']);
    expect(feitas({ pontos: 300 })).toEqual(['prata']);
    expect(feitas({ pontos: 600 })).toEqual(['prata', 'ouro']);
  });
});
