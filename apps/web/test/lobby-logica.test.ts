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
      maoLimpa: false,
      humanos: 1,
      nivelBot: 'facil',
      chanceInterceptarSinal: 0,
      tempoFamiliaS: 20,
      sinais: true,
      privada: false,
    });
    expect(formPadrao('mineiro')).toMatchObject({ pontuacao: '2-4-8-10-12', maoDe10: true, maoDe11: 'off', familia: 'fechada', maoLimpa: false });
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
      regras: { pontuacao: '1-3-6-9-12', maoDe10: false, maoDe11: 'qualquerDupla', familia: 'off', maoLimpa: false },
      chanceInterceptarSinal: 0,
      tempoFamiliaS: 20,
      sinais: true,
      chaveRegras: '1-3-6-9-12|m10:0|m11:qualquerDupla|fam:off|lim:0|int:0|sin:1',
      modo: 'desafio',
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
    expect(o.chaveRegras).toBe(chaveRegras(s.regras, s.chanceInterceptarSinal, s.tempoFamiliaS));
  });

  test('mão limpa: vai nas regras e na chave só no mineiro; trocar de variante desmarca', () => {
    const limpa = { ...formPadrao('mineiro', 'Ana'), maoLimpa: true };
    const o = opcoesDeEntrada(limpa);
    expect(o.regras.maoLimpa).toBe(true);
    expect(o.chaveRegras).toContain('|lim:1|');
    const s = opcoesDaSala(o);
    expect(s.regras).toEqual({ variante: 'mineiro', ...o.regras });
    expect(o.chaveRegras).toBe(chaveRegras(s.regras, s.chanceInterceptarSinal, s.tempoFamiliaS));
    expect(trocarVariante(limpa, 'paulista').maoLimpa).toBe(false);
    // mesmo que o estado fique marcado no paulista, não vai para a sala
    expect(opcoesDeEntrada({ ...formPadrao('paulista'), maoLimpa: true }).regras.maoLimpa).toBe(false);
  });

  test('apelido no localStorage', () => {
    expect(lerApelido()).toBe('');
    gravarApelido('Bia');
    expect(localStorage.getItem(CHAVE_APELIDO)).toBe('Bia');
    expect(lerApelido()).toBe('Bia');
  });
});

describe('modo', () => {
  test('clássica com bot fácil, desafio com difícil, privada quando marcada', () => {
    expect(opcoesDeEntrada(formPadrao('paulista', 'Ana')).modo).toBe('classica');
    expect(opcoesDeEntrada({ ...formPadrao('paulista', 'Ana'), nivelBot: 'dificil' }).modo).toBe('desafio');
    expect(opcoesDeEntrada({ ...formPadrao('paulista', 'Ana'), privada: true }).modo).toBe('privada');
  });

  test('privada com "só eu" pede 4 humanos: a mesa espera o convite em vez de começar na hora', () => {
    expect(opcoesDeEntrada({ ...formPadrao('paulista', 'Ana'), privada: true, humanos: 1 }).humanos).toBe(4);
    expect(opcoesDeEntrada({ ...formPadrao('paulista', 'Ana'), privada: true, humanos: 2 }).humanos).toBe(2);
    expect(opcoesDeEntrada({ ...formPadrao('paulista', 'Ana'), humanos: 1 }).humanos).toBe(1);
  });

  test('trocar a variante mantém a privada', () => {
    expect(trocarVariante({ ...formPadrao(), privada: true }, 'mineiro').privada).toBe(true);
  });
});
