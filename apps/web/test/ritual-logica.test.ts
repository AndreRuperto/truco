import { reduce, visaoDoJogador } from '@truco/engine';
import { describe, expect, test } from 'vitest';
import { donoDoMonte, mostrarResumoMao, passosDistribuicao, textoEtapa, textoFamilia } from '../src/logica/ritual';
import { distribuida, MINEIRO, noRitual } from './fixtures';

const nome = (c: number) => ['Ana', 'Zé', 'Tião', 'Dita'][c];

describe('donoDoMonte', () => {
  test('no ritual, quem age; na mão, o pé', () => {
    const s = noRitual();
    expect(donoDoMonte(visaoDoJogador(s, 0))).toBe(3);
    expect(donoDoMonte(visaoDoJogador(reduce(s, { tipo: 'passarCorte', cadeira: 3 }), 0))).toBe(2);
    expect(donoDoMonte(visaoDoJogador(distribuida(MINEIRO), 0))).toBe(3);
  });
});

describe('textoEtapa', () => {
  test('quem embaralha (e quantas vezes), quem corta (e quantos movimentos restam), quem dá', () => {
    const s = noRitual();
    expect(textoEtapa(visaoDoJogador(s, 3), nome)).toBe('Sua vez de embaralhar');
    expect(textoEtapa(visaoDoJogador(s, 0), nome)).toBe('Dita está embaralhando');
    const e = reduce(s, { tipo: 'embaralhar', cadeira: 3, bits: s.monte.map(() => 0 as const) });
    expect(textoEtapa(visaoDoJogador(e, 0), nome)).toBe('Dita está embaralhando (1×)');
    const t = reduce(e, { tipo: 'passarCorte', cadeira: 3 });
    expect(textoEtapa(visaoDoJogador(t, 2), nome)).toBe('Sua vez de cortar — 3 movimentos');
    const u = reduce(t, { tipo: 'cortar', cadeira: 2, ponto: 20 });
    expect(textoEtapa(visaoDoJogador(u, 0), nome)).toBe('Tião vai cortar — 2 movimentos');
    const d = reduce(u, { tipo: 'devolver', cadeira: 2 });
    expect(textoEtapa(visaoDoJogador(d, 3), nome)).toBe('Como você vai dar as cartas?');
    expect(textoEtapa(visaoDoJogador(d, 1), nome)).toBe('Dita vai dar as cartas');
    expect(textoEtapa(visaoDoJogador(distribuida(MINEIRO), 0), nome)).toBeNull();
  });

  test('conferindo: pergunta à dupla adversária e avisa os outros', () => {
    const t = reduce(distribuida(MINEIRO, [['Qo', 'Jo', 'Ko']]), { tipo: 'familia', cadeira: 0 });
    expect(textoEtapa(visaoDoJogador(t, 1), nome)).toBe('Ana pediu família fechada. Conferir?');
    expect(textoEtapa(visaoDoJogador(t, 2), nome)).toBe('Ana pediu família fechada — esperando os adversários');
    expect(textoEtapa(visaoDoJogador(t, 0), nome)).toBe('Esperando os adversários: conferem ou não?');
  });
});

describe('textoFamilia', () => {
  test('fechada, conferida (família ou blefe)', () => {
    const s = distribuida(MINEIRO, [['Qo', 'Jo', 'Ko'], ['3e', '5e', '6e']]);
    const t = reduce(s, { tipo: 'familia', cadeira: 0 });
    const v2 = visaoDoJogador(t, 2);
    expect(textoFamilia(v2.mao!.familias[0], v2, nome)).toBe('Ana: família fechada');
    const u = visaoDoJogador(reduce(t, { tipo: 'conferir', cadeira: 1, conferir: true }), 2);
    expect(textoFamilia(u.mao!.familias[0], u, nome)).toBe('Zé conferiu: era família! +2 pra nós');
    const b = visaoDoJogador(reduce(reduce(s, { tipo: 'familia', cadeira: 1 }), { tipo: 'conferir', cadeira: 0, conferir: true }), 1);
    expect(textoFamilia(b.mao!.familias[0], b, nome)).toBe('Ana conferiu: era blefe! +2 pra eles');
  });
});

describe('passosDistribuicao', () => {
  test('pacotes de 3 do topo ou do fundo; subindo, 1 por vez em 3 voltas; posições relativas a mim', () => {
    expect(passosDistribuicao({ cadeira: 3, tipo: 'distribuir', modo: 'porCima', ordem: [0, 1, 2, 3] }, 0)).toEqual([
      { pos: 'baixo', qtd: 3, deBaixo: false },
      { pos: 'direita', qtd: 3, deBaixo: false },
      { pos: 'cima', qtd: 3, deBaixo: false },
      { pos: 'esquerda', qtd: 3, deBaixo: false },
    ]);
    const sobe = passosDistribuicao({ cadeira: 3, tipo: 'distribuir', modo: 'subindo', ordem: [1, 2, 3] }, 1);
    expect(sobe).toHaveLength(9);
    expect(sobe.slice(0, 3)).toEqual([
      { pos: 'baixo', qtd: 1, deBaixo: true },
      { pos: 'direita', qtd: 1, deBaixo: true },
      { pos: 'cima', qtd: 1, deBaixo: true },
    ]);
    expect(passosDistribuicao({ cadeira: 0, tipo: 'jogar' }, 0)).toEqual([]);
  });
});

describe('mostrarResumoMao', () => {
  test('o resumo da mão fica até o pé novo embaralhar a 1ª vez', () => {
    let s = distribuida(MINEIRO);
    s = reduce(reduce(s, { tipo: 'truco', cadeira: 0 }), { tipo: 'correr', cadeira: 1 });
    expect(mostrarResumoMao(visaoDoJogador(s, 0))).toBe(true);
    const e = reduce(s, { tipo: 'embaralhar', cadeira: s.pe, bits: s.monte.map(() => 0 as const) });
    expect(mostrarResumoMao(visaoDoJogador(e, 0))).toBe(false);
  });
});
