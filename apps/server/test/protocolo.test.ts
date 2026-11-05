import { REGRAS_RANQUEADA } from '@truco/engine';
import { describe, expect, test } from 'vitest';
import { chaveRegras, ehFala, ehSinal, limparNome, opcoesDaSala } from '../src/mesa/protocolo';

describe('chaveRegras', () => {
  const base = REGRAS_RANQUEADA.paulista;
  test('determinística e igual para as mesmas regras (a variante fica de fora: tem filtro próprio)', () => {
    expect(chaveRegras(base, 0)).toBe(chaveRegras({ ...base }, 0));
    expect(chaveRegras(base, 0)).toBe(chaveRegras({ ...base, variante: 'mineiro' }, 0));
    expect(chaveRegras(base, 0.25)).toBe('1-3-6-9-12|m10:0|m11:qualquerDupla|fam:off|int:0.25');
  });

  test('muda com cada regra e com a chance de interceptar', () => {
    const k = chaveRegras(base, 0);
    expect(chaveRegras({ ...base, pontuacao: '2-4-8-10-12' }, 0)).not.toBe(k);
    expect(chaveRegras({ ...base, maoDe10: !base.maoDe10 }, 0)).not.toBe(k);
    expect(chaveRegras({ ...base, maoDe11: 'off' }, 0)).not.toBe(k);
    expect(chaveRegras({ ...base, familia: 'aberta' }, 0)).not.toBe(k);
    expect(chaveRegras(base, 0.5)).not.toBe(k);
  });
});

describe('opcoesDaSala', () => {
  test('padrão: paulista ranqueado, 1 humano, bot fácil', () => {
    expect(opcoesDaSala(undefined)).toEqual({ regras: REGRAS_RANQUEADA.paulista, humanos: 1, nivelBot: 'facil', chanceInterceptarSinal: 0 });
  });

  test('mistura variante com regras customizadas', () => {
    const o = opcoesDaSala({ variante: 'mineiro', humanos: 2, nivelBot: 'dificil', regras: { familia: 'aberta', pontuacao: '1-3-6-9-12' } });
    expect(o.regras).toEqual({ ...REGRAS_RANQUEADA.mineiro, familia: 'aberta', pontuacao: '1-3-6-9-12' });
    expect(o.humanos).toBe(2);
    expect(o.nivelBot).toBe('dificil');
  });

  test('chance de interceptar sinal: número entre 0 e 1', () => {
    expect(opcoesDaSala({ chanceInterceptarSinal: 0.25 }).chanceInterceptarSinal).toBe(0.25);
    expect(opcoesDaSala({ chanceInterceptarSinal: 1 }).chanceInterceptarSinal).toBe(1);
    for (const ruim of [-0.1, 1.5, NaN, '0.5', null]) expect(opcoesDaSala({ chanceInterceptarSinal: ruim }).chanceInterceptarSinal).toBe(0);
  });

  test('valores inválidos caem no padrão', () => {
    const o = opcoesDaSala({ variante: 'gaucho', humanos: 9, nivelBot: 'deus', regras: { maoDe10: 'sim', familia: 'talvez' }, chanceInterceptarSinal: 2 });
    expect(o).toEqual({ regras: REGRAS_RANQUEADA.paulista, humanos: 1, nivelBot: 'facil', chanceInterceptarSinal: 0 });
  });
});

describe('limparNome', () => {
  test('tira caracteres de controle e invisíveis, apara e corta em 20', () => {
    expect(limparNome('  A\u0000n\u200Ba\u202E\n ')).toBe('Ana');
    expect(limparNome('x'.repeat(50))).toHaveLength(20);
    expect(limparNome('  João  da Silva ')).toBe('João  da Silva');
  });
  test('vazio ou não-texto vira Jogador', () => {
    expect(limparNome('   ')).toBe('Jogador');
    expect(limparNome('\u200B\u0007')).toBe('Jogador');
    expect(limparNome(42)).toBe('Jogador');
  });
  test('não deixa se passar por bot', () => {
    expect(limparNome('Bot Zé')).toBe('Zé');
    expect(limparNome('bOt  bot Tião')).toBe('Tião');
    expect(limparNome('Bot ')).toBe('Jogador');
    expect(limparNome('Botafogo')).toBe('Botafogo');
  });
});

describe('sinais e falas', () => {
  test('só aceita os da lista', () => {
    expect(ehSinal('zap')).toBe(true);
    expect(ehSinal('olhar feio')).toBe(false);
    expect(ehFala('truco')).toBe(true);
    expect(ehFala(42)).toBe(false);
  });
});
