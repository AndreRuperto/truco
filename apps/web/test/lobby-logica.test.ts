import { chaveRegras, opcoesDaSala } from '@truco/protocolo';
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
      chanceInterceptarSinal: 0,
    });
    expect(formPadrao('mineiro')).toMatchObject({ pontuacao: '2-4-8-10-12', maoDe10: true, maoDe11: 'off', familia: 'fechada' });
  });

  test('trocar a variante reaplica as regras mas mantém nome, humanos, bots e interceptação', () => {
    const f = { ...formPadrao('paulista', 'Ana'), humanos: 2, nivelBot: 'dificil' as const, familia: 'aberta' as const, chanceInterceptarSinal: 0.5 };
    expect(trocarVariante(f, 'mineiro')).toEqual({ ...formPadrao('mineiro', 'Ana'), humanos: 2, nivelBot: 'dificil', chanceInterceptarSinal: 0.5 });
  });

  test('opções de entrada', () => {
    expect(opcoesDeEntrada({ ...formPadrao('paulista'), nome: '  Ana ', humanos: 3, nivelBot: 'dificil' })).toEqual({
      nome: 'Ana',
      variante: 'paulista',
      humanos: 3,
      nivelBot: 'dificil',
      regras: { pontuacao: '1-3-6-9-12', maoDe10: false, maoDe11: 'qualquerDupla', familia: 'off' },
      chanceInterceptarSinal: 0,
      chaveRegras: '1-3-6-9-12|m10:0|m11:qualquerDupla|fam:off|int:0',
    });
    expect(opcoesDeEntrada({ ...formPadrao('paulista'), nome: '   ', humanos: 9 })).toMatchObject({ nome: 'Jogador', humanos: 4 });
  });

  test('o servidor entende as opções sem trocar nada', () => {
    const o = opcoesDeEntrada({ ...formPadrao('mineiro', 'Ana'), humanos: 2, maoDe10: false, familia: 'aberta', chanceInterceptarSinal: 0.25 });
    const s = opcoesDaSala(o);
    expect(s.regras).toEqual({ variante: 'mineiro', ...o.regras });
    expect(s.humanos).toBe(2);
    expect(s.nivelBot).toBe('facil');
    expect(s.chanceInterceptarSinal).toBe(0.25);
    // a chave que o cliente manda é a mesma que a sala recalcula
    expect(o.chaveRegras).toBe(chaveRegras(s.regras, s.chanceInterceptarSinal));
  });

  test('apelido no localStorage', () => {
    expect(lerApelido()).toBe('');
    gravarApelido('Bia');
    expect(localStorage.getItem(CHAVE_APELIDO)).toBe('Bia');
    expect(lerApelido()).toBe('Bia');
  });
});
