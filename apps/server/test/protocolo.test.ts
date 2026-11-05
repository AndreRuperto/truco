import { REGRAS_RANQUEADA } from '@truco/engine';
import { describe, expect, test } from 'vitest';
import { ehFala, ehSinal, limparNome, opcoesDaSala } from '../src/mesa/protocolo';

describe('opcoesDaSala', () => {
  test('padrão: paulista ranqueado, 1 humano, bot fácil', () => {
    expect(opcoesDaSala(undefined)).toEqual({ regras: REGRAS_RANQUEADA.paulista, humanos: 1, nivelBot: 'facil' });
  });

  test('mistura variante com regras customizadas', () => {
    const o = opcoesDaSala({ variante: 'mineiro', humanos: 2, nivelBot: 'dificil', regras: { familia: 'aberta', pontuacao: '1-3-6-9-12' } });
    expect(o.regras).toEqual({ ...REGRAS_RANQUEADA.mineiro, familia: 'aberta', pontuacao: '1-3-6-9-12' });
    expect(o.humanos).toBe(2);
    expect(o.nivelBot).toBe('dificil');
  });

  test('valores inválidos caem no padrão', () => {
    const o = opcoesDaSala({ variante: 'gaucho', humanos: 9, nivelBot: 'deus', regras: { maoDe10: 'sim', familia: 'talvez' } });
    expect(o).toEqual({ regras: REGRAS_RANQUEADA.paulista, humanos: 1, nivelBot: 'facil' });
  });
});

describe('limparNome', () => {
  test('tira caracteres de controle e invisíveis, apara e corta em 20', () => {
    expect(limparNome('  A\u0000n​a‮\n ')).toBe('Ana');
    expect(limparNome('x'.repeat(50))).toHaveLength(20);
    expect(limparNome('  João  da Silva ')).toBe('João  da Silva');
  });
  test('vazio ou não-texto vira Jogador', () => {
    expect(limparNome('   ')).toBe('Jogador');
    expect(limparNome('​\u0007')).toBe('Jogador');
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
