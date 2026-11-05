import { describe, expect, test } from 'vitest';
import { cadeirasDoPareamento, type EntradaFila, faixa, Fila, normalizarCodigoDupla, parear } from '../src/fila/fila';

const T0 = 1_000_000;
let n = 0;
const e = (elo: number, extra: Partial<EntradaFila> = {}): EntradaFila => {
  n++;
  return { id: `s${n}`, usuarioId: n, apelido: `j${n}`, elo, variante: 'paulista', formato: '1x1', codigoDupla: null, desde: T0, ...extra };
};
const ids = (xs: EntradaFila[]) => xs.map((x) => x.id);

describe('faixa', () => {
  test('100, +50 a cada 15 s, teto 1000', () => {
    expect(faixa(0)).toBe(100);
    expect(faixa(14_999)).toBe(100);
    expect(faixa(15_000)).toBe(150);
    expect(faixa(60_000)).toBe(300);
    expect(faixa(10 * 60_000)).toBe(1000);
    expect(faixa(-5)).toBe(100);
  });
});

describe('normalizarCodigoDupla', () => {
  test('4 a 12 letras/números, maiúsculas', () => {
    expect(normalizarCodigoDupla(' ze123 ')).toBe('ZE123');
    expect(normalizarCodigoDupla('abc')).toBeNull();
    expect(normalizarCodigoDupla('com espaço')).toBeNull();
    expect(normalizarCodigoDupla(7)).toBeNull();
  });
});

describe('parear 1x1', () => {
  test('dentro da faixa: casa', () => {
    const a = e(1000);
    const b = e(1050);
    expect(parear([a, b], T0)).toEqual([{ variante: 'paulista', formato: '1x1', times: [[a], [b]] }]);
  });

  test('fora da faixa espera; a faixa alarga com o tempo', () => {
    const a = e(1000);
    const b = e(1300);
    expect(parear([a, b], T0)).toEqual([]);
    expect(parear([a, b], T0 + 59_999)).toEqual([]);
    expect(parear([a, b], T0 + 60_000)).toHaveLength(1);
  });

  test('a faixa maior dos dois vale (quem espera há mais tempo puxa o novato)', () => {
    const velho = e(1000, { desde: T0 - 60_000 });
    const novo = e(1300);
    expect(parear([velho, novo], T0)).toHaveLength(1);
  });

  test('o mais antigo escolhe o mais próximo em Elo', () => {
    const a = e(1000, { desde: T0 - 1 });
    const longe = e(1090);
    const perto = e(1020);
    const [p] = parear([a, longe, perto], T0);
    expect(p.times).toEqual([[a], [perto]]);
  });

  test('variantes e formatos diferentes não se misturam', () => {
    expect(parear([e(1000), e(1000, { variante: 'mineiro' })], T0)).toEqual([]);
    expect(parear([e(1000), e(1000, { formato: '2x2' })], T0)).toEqual([]);
  });

  test('código de dupla é ignorado no 1x1', () => {
    expect(parear([e(1000, { codigoDupla: 'AMIGOS' }), e(1000, { codigoDupla: 'AMIGOS' })], T0)).toHaveLength(1);
  });
});

describe('parear 2x2', () => {
  test('quatro avulsos: times equilibrados — maior + menor contra os dois do meio', () => {
    const [a, b, c, d] = [e(1000, { formato: '2x2' }), e(1010, { formato: '2x2' }), e(1020, { formato: '2x2' }), e(1030, { formato: '2x2' })];
    const [p] = parear([d, c, b, a], T0);
    expect(p.times.map((t) => ids(t).sort())).toEqual([ids([a, d]).sort(), ids([b, c]).sort()]);
  });

  test('avulsos bem diferentes: o equilíbrio vale mesmo assim (1000+1200 contra 1080+1120)', () => {
    const x = [1000, 1080, 1120, 1200].map((elo) => e(elo, { formato: '2x2' }));
    const [p] = parear(x, T0 + 60_000);
    const medias = p.times.map((t) => t.reduce((s, y) => s + y.elo, 0) / t.length);
    expect(medias).toEqual([1100, 1100]);
  });

  test('dupla completa por código contra dois solos', () => {
    const x1 = e(1000, { formato: '2x2', codigoDupla: 'ZE12' });
    const x2 = e(1100, { formato: '2x2', codigoDupla: 'ZE12' });
    const s1 = e(1040, { formato: '2x2' });
    const s2 = e(1060, { formato: '2x2' });
    const [p] = parear([x1, s1, x2, s2], T0);
    expect(p.times.map((t) => ids(t).sort())).toEqual([ids([x1, x2]).sort(), ids([s1, s2]).sort()]);
  });

  test('dupla incompleta não entra', () => {
    const sozinho = e(1000, { formato: '2x2', codigoDupla: 'ZE12' });
    expect(parear([sozinho, e(1000, { formato: '2x2' }), e(1000, { formato: '2x2' })], T0)).toEqual([]);
  });
});

describe('cadeirasDoPareamento', () => {
  test('1x1: 0 e 1; 2x2: dupla A em 0/2, dupla B em 1/3', () => {
    const [a, b, c, d] = [e(1), e(2), e(3), e(4)];
    expect(cadeirasDoPareamento({ variante: 'paulista', formato: '1x1', times: [[a], [b]] }).map((x) => [x.entrada.id, x.cadeira])).toEqual([
      [a.id, 0],
      [b.id, 1],
    ]);
    expect(cadeirasDoPareamento({ variante: 'paulista', formato: '2x2', times: [[a, b], [c, d]] }).map((x) => [x.entrada.id, x.cadeira])).toEqual([
      [a.id, 0],
      [b.id, 2],
      [c.id, 1],
      [d.id, 3],
    ]);
  });
});

describe('Fila', () => {
  test('mesmo usuário em outra aba substitui a entrada antiga', () => {
    const f = new Fila();
    const a = e(1000);
    expect(f.entrar(a)).toBeNull();
    expect(f.entrar({ ...a, id: 'outra-aba' })).toEqual(a);
    expect(f.tamanho).toBe(1);
  });

  test('rodada tira os pareados; devolver recoloca; status', () => {
    const f = new Fila();
    const [a, b, c] = [e(1000), e(1000), e(1900)];
    for (const x of [a, b, c]) f.entrar(x);
    expect(f.status(c.id, T0 + 15_000)).toEqual({ esperaS: 15, faixa: 150, naFila: 3, aguardandoParceiro: false });
    const ps = f.rodada(T0);
    expect(ps).toHaveLength(1);
    expect(f.tamanho).toBe(1);
    expect(f.status(a.id, T0)).toBeNull();
    f.devolver(ps[0]);
    expect(f.tamanho).toBe(3);
    expect(f.sair(c.id)).toBe(true);
    expect(f.sair(c.id)).toBe(false);
  });

  test('3º jogador com o mesmo código de dupla é recusado (a mesma conta em outra aba não conta)', () => {
    const f = new Fila();
    const a = e(1000, { formato: '2x2', codigoDupla: 'ZE12' });
    f.entrar(a);
    f.entrar(e(1000, { formato: '2x2', codigoDupla: 'ZE12' }));
    expect(() => f.entrar(e(1000, { formato: '2x2', codigoDupla: 'ZE12' }))).toThrow('código de dupla já tem dois jogadores');
    expect(f.tamanho).toBe(2);
    // outra aba da mesma conta substitui, não é "terceiro"
    expect(f.entrar({ ...a, id: 'outra-aba' })).toEqual(a);
    // o mesmo código noutra variante é outra dupla
    expect(() => f.entrar(e(1000, { formato: '2x2', variante: 'mineiro', codigoDupla: 'ZE12' }))).not.toThrow();
  });

  test('devolver: se a conta voltou à fila por outra aba enquanto estava pareada, vence a entrada nova', () => {
    const f = new Fila();
    const [a, b] = [e(1000), e(1000)];
    f.entrar(a);
    f.entrar(b);
    const [p] = f.rodada(T0);
    const aNova = { ...a, id: 'aba-nova', desde: T0 + 5_000 };
    f.entrar(aNova);
    expect(f.devolver(p)).toEqual([a]);
    expect(f.tamanho).toBe(2);
    expect(f.status(a.id, T0)).toBeNull();
    expect(f.status(aNova.id, T0 + 5_000)).not.toBeNull();
  });

  test('a mesma conta nunca é pareada contra si mesma', () => {
    const a = e(1000);
    expect(parear([a, { ...a, id: 'outra-aba' }], T0)).toEqual([]);
    const b = e(1000);
    const [p] = parear([a, { ...a, id: 'outra-aba', desde: T0 + 1 }, b], T0 + 1);
    expect(p.times.flat().map((x) => x.usuarioId).sort()).toEqual([a.usuarioId, b.usuarioId].sort());
  });

  test('tirarUsuario remove a entrada da conta', () => {
    const f = new Fila();
    const a = e(1000);
    f.entrar(a);
    expect(f.tirarUsuario(a.usuarioId)).toEqual(a);
    expect(f.tirarUsuario(a.usuarioId)).toBeNull();
    expect(f.tamanho).toBe(0);
  });

  test('status: aguardando parceiro com o mesmo código', () => {
    const f = new Fila();
    const a = e(1000, { formato: '2x2', codigoDupla: 'ZE12' });
    f.entrar(a);
    expect(f.status(a.id, T0)?.aguardandoParceiro).toBe(true);
    f.entrar(e(1000, { formato: '2x2', codigoDupla: 'ZE12' }));
    expect(f.status(a.id, T0)?.aguardandoParceiro).toBe(false);
  });
});
