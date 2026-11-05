import { REGRAS_RANQUEADA } from '@truco/engine';
import { describe, expect, test } from 'vitest';
import { ehFala, ehSinal, opcoesDaSala } from '../src/mesa/protocolo';

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

describe('sinais e falas', () => {
  test('só aceita os da lista', () => {
    expect(ehSinal('zap')).toBe(true);
    expect(ehSinal('olhar feio')).toBe(false);
    expect(ehFala('truco')).toBe(true);
    expect(ehFala(42)).toBe(false);
  });
});
