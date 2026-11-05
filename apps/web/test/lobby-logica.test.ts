import { opcoesDaSala } from '@truco/protocolo';
import { describe, expect, test } from 'vitest';
import { CHAVE_APELIDO, formPadrao, gravarApelido, lerApelido, opcoesDeEntrada, trocarVariante } from '../src/logica/lobby';

describe('formulário do lobby', () => {
  test('padrões seguem a ranqueada da variante', () => {
    expect(formPadrao('paulista')).toEqual({
      nome: '',
      variante: 'paulista',
      pontuacao: '1-3-6-9-12',
      maoDe10: false,
      maoDe11: 'qualquerDupla',
      familia: 'off',
      humanos: 1,
      nivelBot: 'facil',
    });
    expect(formPadrao('mineiro')).toMatchObject({ pontuacao: '2-4-8-10-12', maoDe10: true, maoDe11: 'off', familia: 'fechada' });
  });

  test('trocar a variante reaplica as regras mas mantém nome, humanos e bots', () => {
    const f = { ...formPadrao('paulista', 'Ana'), humanos: 2, nivelBot: 'dificil' as const, familia: 'aberta' as const };
    expect(trocarVariante(f, 'mineiro')).toEqual({ ...formPadrao('mineiro', 'Ana'), humanos: 2, nivelBot: 'dificil' });
  });

  test('opções de entrada', () => {
    expect(opcoesDeEntrada({ ...formPadrao('paulista'), nome: '  Ana ', humanos: 3, nivelBot: 'dificil' })).toEqual({
      nome: 'Ana',
      variante: 'paulista',
      humanos: 3,
      nivelBot: 'dificil',
      regras: { pontuacao: '1-3-6-9-12', maoDe10: false, maoDe11: 'qualquerDupla', familia: 'off' },
    });
    expect(opcoesDeEntrada({ ...formPadrao('paulista'), nome: '   ', humanos: 9 })).toMatchObject({ nome: 'Jogador', humanos: 4 });
  });

  test('o servidor entende as opções sem trocar nada', () => {
    const o = opcoesDeEntrada({ ...formPadrao('mineiro', 'Ana'), humanos: 2, maoDe10: false, familia: 'aberta' });
    const s = opcoesDaSala(o);
    expect(s.regras).toEqual({ variante: 'mineiro', ...o.regras });
    expect(s.humanos).toBe(2);
    expect(s.nivelBot).toBe('facil');
  });

  test('apelido no localStorage', () => {
    expect(lerApelido()).toBe('');
    gravarApelido('Bia');
    expect(localStorage.getItem(CHAVE_APELIDO)).toBe('Bia');
    expect(lerApelido()).toBe('Bia');
  });
});
