import { limitesCorte, novaPartida, novoBaralho, REGRAS_RANQUEADA, reduce } from '@truco/engine';
import { distribuirSemRitual } from '@truco/engine/testes';
import { describe, expect, test } from 'vitest';
import { chaveRegras, ehFala, ehSinal, filtroDaSala, limparChat, limparNome, MAX_CHAT, msgDaAcao, opcoesDaSala } from '../src/mesa/protocolo';

describe('chaveRegras', () => {
  const base = REGRAS_RANQUEADA.paulista;
  test('determinística e igual para as mesmas regras (a variante fica de fora: tem filtro próprio)', () => {
    expect(chaveRegras(base, 0)).toBe(chaveRegras({ ...base }, 0));
    expect(chaveRegras(base, 0)).toBe(chaveRegras({ ...base, variante: 'mineiro' }, 0, 20, true));
    expect(chaveRegras(base, 0.25)).toBe('1-3-6-9-12|m10:0|m11:qualquerDupla|fam:off|lim:0|int:0.25|sin:1');
  });

  test('sinais: padrão ligados no paulista e desligados no mineiro; a escolha da mesa vale e entra na chave', () => {
    expect(opcoesDaSala({ variante: 'paulista' }).sinais).toBe(true);
    expect(opcoesDaSala({ variante: 'mineiro' }).sinais).toBe(false);
    expect(opcoesDaSala({ variante: 'mineiro', sinais: true }).sinais).toBe(true);
    expect(opcoesDaSala({ variante: 'paulista', sinais: false }).sinais).toBe(false);
    expect(chaveRegras(base, 0, 20, false)).not.toBe(chaveRegras(base, 0, 20, true));
  });

  test('muda com cada regra e com a chance de interceptar', () => {
    const k = chaveRegras(base, 0);
    expect(chaveRegras({ ...base, pontuacao: '2-4-8-10-12' }, 0)).not.toBe(k);
    expect(chaveRegras({ ...base, maoDe10: !base.maoDe10 }, 0)).not.toBe(k);
    expect(chaveRegras({ ...base, maoDe11: 'off' }, 0)).not.toBe(k);
    expect(chaveRegras({ ...base, familia: 'aberta' }, 0)).not.toBe(k);
    expect(chaveRegras({ ...base, maoLimpa: true }, 0)).not.toBe(k);
    expect(chaveRegras(base, 0.5)).not.toBe(k);
  });
});

describe('opcoesDaSala', () => {
  test('padrão: paulista ranqueado, 1 humano, bot fácil', () => {
    expect(opcoesDaSala(undefined)).toEqual({ modo: 'classica', regras: REGRAS_RANQUEADA.paulista, humanos: 1, nivelBot: 'facil', chanceInterceptarSinal: 0, tempoFamiliaS: 20, sinais: true, cacife: 0 });
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

  test('mão limpa: só no mineiro, só booleano; ranqueada nunca', () => {
    expect(opcoesDaSala({ variante: 'mineiro', regras: { maoLimpa: true } }).regras.maoLimpa).toBe(true);
    expect(opcoesDaSala({ variante: 'mineiro', regras: { maoLimpa: false } }).regras.maoLimpa).toBe(false);
    expect(opcoesDaSala({ variante: 'mineiro', regras: {} }).regras.maoLimpa).toBe(false);
    for (const ruim of ['sim', 1, null]) expect(opcoesDaSala({ variante: 'mineiro', regras: { maoLimpa: ruim } }).regras.maoLimpa).toBe(false);
    expect(opcoesDaSala({ variante: 'paulista', regras: { maoLimpa: true } }).regras.maoLimpa).toBe(false);
    expect(opcoesDaSala({ modo: 'ranqueada', variante: 'mineiro', humanos: 2, regras: { maoLimpa: true } }).regras.maoLimpa).toBe(false);
  });

  test('valores inválidos caem no padrão', () => {
    const o = opcoesDaSala({ variante: 'gaucho', humanos: 9, nivelBot: 'deus', regras: { maoDe10: 'sim', familia: 'talvez' }, chanceInterceptarSinal: 2 });
    expect(o).toEqual({ modo: 'classica', regras: REGRAS_RANQUEADA.paulista, humanos: 1, nivelBot: 'facil', chanceInterceptarSinal: 0, tempoFamiliaS: 20, sinais: true, cacife: 0 });
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

describe('modo da mesa', () => {
  test('sem modo: clássica com bot fácil, desafio com bot difícil', () => {
    expect(opcoesDaSala({}).modo).toBe('classica');
    expect(opcoesDaSala({ nivelBot: 'dificil' })).toMatchObject({ modo: 'desafio', nivelBot: 'dificil' });
  });

  test('privada com 1 humano espera 4 (senão começaria na hora, sem sala de espera nem link)', () => {
    expect(opcoesDaSala({ modo: 'privada', humanos: 1 }).humanos).toBe(4);
    expect(opcoesDaSala({ modo: 'privada' }).humanos).toBe(4);
    expect(opcoesDaSala({ modo: 'privada', humanos: 2 }).humanos).toBe(2);
    expect(opcoesDaSala({ modo: 'classica', humanos: 1 }).humanos).toBe(1);
  });

  test('o modo manda no nível do bot nas casuais; na privada vale o pedido', () => {
    expect(opcoesDaSala({ modo: 'classica', nivelBot: 'dificil' }).nivelBot).toBe('facil');
    expect(opcoesDaSala({ modo: 'desafio', nivelBot: 'facil' }).nivelBot).toBe('dificil');
    expect(opcoesDaSala({ modo: 'privada', nivelBot: 'dificil' })).toMatchObject({ modo: 'privada', nivelBot: 'dificil' });
  });

  test('ranqueada: regras fixas da variante, 2 ou 4 humanos, bot difícil, sem interceptação', () => {
    const o = opcoesDaSala({ modo: 'ranqueada', variante: 'mineiro', humanos: 3, regras: { familia: 'off' }, chanceInterceptarSinal: 0.5 });
    expect(o).toEqual({ modo: 'ranqueada', regras: REGRAS_RANQUEADA.mineiro, humanos: 2, nivelBot: 'dificil', chanceInterceptarSinal: 0, tempoFamiliaS: 20, sinais: false, cacife: 0 });
    expect(opcoesDaSala({ modo: 'ranqueada', humanos: 4 }).humanos).toBe(4);
  });

  test('filtroDaSala: todos os campos do filterBy, sempre preenchidos', () => {
    expect(filtroDaSala(opcoesDaSala({}))).toEqual({
      modo: 'classica',
      variante: 'paulista',
      humanos: 1,
      nivelBot: 'facil',
      chaveRegras: chaveRegras(REGRAS_RANQUEADA.paulista, 0),
      cacife: 0,
    });
  });

  test('cacife: só valores da lista, só com 2+ humanos; ranqueada só aceita valores de patente', () => {
    expect(opcoesDaSala({ humanos: 2, cacife: 100 }).cacife).toBe(100);
    expect(opcoesDaSala({ humanos: 2, cacife: 77 }).cacife).toBe(0);
    expect(opcoesDaSala({ humanos: 1, cacife: 100 }).cacife).toBe(0);
    // Privada espera até 4 humanos: aceita cacife mesmo pedindo 1.
    expect(opcoesDaSala({ modo: 'privada', cacife: 250 }).cacife).toBe(250);
    expect(opcoesDaSala({ modo: 'ranqueada', humanos: 2, cacife: 1500 }).cacife).toBe(1500);
    expect(opcoesDaSala({ modo: 'ranqueada', humanos: 2, cacife: 250 }).cacife).toBe(0);
    expect(filtroDaSala(opcoesDaSala({ humanos: 2, cacife: 500 })).cacife).toBe(500);
  });
});

describe('limparChat', () => {
  test('tira controles, junta espaços, corta em 200', () => {
    expect(limparChat('  oi\u0007 \n pessoal\u200b ')).toBe('oi pessoal');
    expect(limparChat('x'.repeat(500))).toHaveLength(MAX_CHAT);
    expect(limparChat(42)).toBe('');
    expect(limparChat('   ')).toBe('');
  });
});

describe('msgDaAcao do ritual', () => {
  const comMonte = () => reduce(novaPartida(REGRAS_RANQUEADA.mineiro, 3), { tipo: 'monte', baralho: novoBaralho() });

  test('embaralhar não leva os bits; cortar leva só a fração', () => {
    const s = comMonte();
    expect(msgDaAcao({ tipo: 'embaralhar', cadeira: 3, bits: s.monte.map(() => 0 as const) }, s)).toEqual({ cadeira: 3, tipo: 'embaralhar' });
    const c = reduce(s, { tipo: 'passarCorte', cadeira: 3 });
    expect(msgDaAcao({ tipo: 'cortar', cadeira: 2, ponto: 20 }, c)).toEqual({ cadeira: 2, tipo: 'cortar', fracao: 0.5 });
  });

  test('a fração do corte é só visual (3 níveis: pouco/meio/muito): não revela o ponto exato', () => {
    const c = reduce(comMonte(), { tipo: 'passarCorte', cadeira: 3 });
    const [min, max] = limitesCorte(c.monte.length);
    const pontos = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    const fracoes = pontos.map((ponto) => msgDaAcao({ tipo: 'cortar', cadeira: 2, ponto }, c).fracao!);
    expect([...new Set(fracoes)].sort()).toEqual([0.3, 0.5, 0.7]);
    // Crescente com o ponto: corte raso = pouco, fundo = muito.
    expect(fracoes).toEqual([...fracoes].sort((a, b) => a - b));
    expect(msgDaAcao({ tipo: 'cortar', cadeira: 2, ponto: min }, c).fracao).toBe(0.3);
    expect(msgDaAcao({ tipo: 'cortar', cadeira: 2, ponto: max }, c).fracao).toBe(0.7);
    expect(msgDaAcao({ tipo: 'cortar', cadeira: 2, ponto: 19 }, c).fracao).toBe(msgDaAcao({ tipo: 'cortar', cadeira: 2, ponto: 21 }, c).fracao);
  });

  test('distribuir leva modo e ordem (sem quem ganhou o dar 3); dar3 leva quem recebe', () => {
    const c = reduce(comMonte(), { tipo: 'passarCorte', cadeira: 3 });
    expect(msgDaAcao({ tipo: 'dar3', cadeira: 2 }, c)).toEqual({ cadeira: 2, tipo: 'dar3', para: 0 });
    const d = reduce(c, { tipo: 'dar3', cadeira: 2 });
    expect(msgDaAcao({ tipo: 'distribuir', cadeira: 3, modo: 'subindo' }, d)).toEqual({ cadeira: 3, tipo: 'distribuir', modo: 'subindo', ordem: [1, 2, 3] });
    const e = reduce(c, { tipo: 'devolver', cadeira: 2 });
    expect(msgDaAcao({ tipo: 'distribuir', cadeira: 3, modo: 'porCima' }, e)).toEqual({ cadeira: 3, tipo: 'distribuir', modo: 'porCima', ordem: [0, 1, 2, 3] });
  });

  test('família diz se é aberta; conferir diz se conferiu', () => {
    const s = distribuirSemRitual(novaPartida(REGRAS_RANQUEADA.mineiro, 3), novoBaralho());
    expect(msgDaAcao({ tipo: 'familia', cadeira: 0 }, s)).toEqual({ cadeira: 0, tipo: 'familia', aberta: false });
    expect(msgDaAcao({ tipo: 'conferir', cadeira: 1, conferir: true }, s)).toEqual({ cadeira: 1, tipo: 'conferir', conferir: true });
    expect(msgDaAcao({ tipo: 'jogar', cadeira: 0, indice: 2 })).toEqual({ cadeira: 0, tipo: 'jogar' });
  });
});
