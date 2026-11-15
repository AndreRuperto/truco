import { describe, expect, it } from 'vitest';
import { gratisDoSlot, itemPorId, ITENS, PACOTES, pacotePorId, SLOTS } from '../src/loja/catalogo';
import {
  bonusDoDia,
  CACIFES_MESA,
  cacifeDaRanqueada,
  cacifeEfetivo,
  cacifeValido,
  diaSP,
  dividirPote,
  FICHAS_DIARIO,
  RESGATE_ATE,
} from '../src/loja/regras';

describe('diaSP', () => {
  it('usa o fuso de São Paulo (UTC-3)', () => {
    expect(diaSP(new Date('2026-11-11T02:59:00Z'))).toBe('2026-11-10');
    expect(diaSP(new Date('2026-11-11T03:00:00Z'))).toBe('2026-11-11');
  });
});

describe('bonusDoDia', () => {
  it('soma o diário uma vez por dia', () => {
    expect(bonusDoDia(800, '2026-11-10', '2026-11-11')).toEqual({ delta: FICHAS_DIARIO, motivo: 'diario' });
    expect(bonusDoDia(800, null, '2026-11-11')).toEqual({ delta: FICHAS_DIARIO, motivo: 'diario' });
    expect(bonusDoDia(800, '2026-11-11', '2026-11-11')).toBeNull();
  });
  it('resgata quem está abaixo do piso: o saldo vai para 500', () => {
    expect(bonusDoDia(40, '2026-11-10', '2026-11-11')).toEqual({ delta: RESGATE_ATE - 40, motivo: 'resgate' });
    expect(bonusDoDia(0, '2026-11-10', '2026-11-11')).toEqual({ delta: 500, motivo: 'resgate' });
    // No piso exato já não é resgate.
    expect(bonusDoDia(100, '2026-11-10', '2026-11-11')?.motivo).toBe('diario');
  });
});

describe('cacife', () => {
  it('efetivo é o menor entre o pedido e os saldos', () => {
    expect(cacifeEfetivo(100, [500, 300])).toBe(100);
    expect(cacifeEfetivo(500, [1000, 120])).toBe(120);
    expect(cacifeEfetivo(100, [0, 900])).toBe(0);
    expect(cacifeEfetivo(100, [])).toBe(0);
  });
  it('ranqueada usa a patente do jogador mais alto', () => {
    expect(cacifeDaRanqueada([0, 10])).toBe(50);
    expect(cacifeDaRanqueada([0, 650])).toBe(200);
    expect(cacifeDaRanqueada([1500, 20, 300, 0])).toBe(1500);
    expect(cacifeDaRanqueada([])).toBe(50);
  });
  it('só aceita valores da lista', () => {
    for (const c of CACIFES_MESA) expect(cacifeValido(c)).toBe(c);
    expect(cacifeValido(75)).toBe(0);
    expect(cacifeValido('100')).toBe(0);
    expect(cacifeValido(-50)).toBe(0);
  });
});

describe('dividirPote', () => {
  it('divide igual e o resto vai para a cadeira mais baixa', () => {
    expect([...dividirPote(300, [2, 0])]).toEqual([
      [0, 150],
      [2, 150],
    ]);
    expect([...dividirPote(301, [3, 1])]).toEqual([
      [1, 151],
      [3, 150],
    ]);
    expect([...dividirPote(200, [1])]).toEqual([[1, 200]]);
    expect(dividirPote(200, []).size).toBe(0);
  });
});

describe('catálogo', () => {
  it('ids únicos, slots válidos e preços coerentes', () => {
    const ids = ITENS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const i of ITENS) {
      expect(SLOTS).toContain(i.slot);
      if (i.preco) expect(i.preco.valor).toBeGreaterThan(0);
      expect(itemPorId(i.id)).toBe(i);
    }
    expect(itemPorId('nao-existe')).toBeNull();
  });
  it('todo slot tem um item grátis (menos avatar, que usa os prontos)', () => {
    for (const s of SLOTS) if (s !== 'avatar') expect(gratisDoSlot(s)?.preco).toBeNull();
  });
  it('avatares da loja: os seis com desenho no web (apps/web/test/avatares-loja.test.tsx), todos pagos', () => {
    const avatares = ITENS.filter((i) => i.slot === 'avatar');
    expect(avatares.map((i) => i.id)).toEqual(['avatar-violeiro', 'avatar-garrafa', 'avatar-caramelo', 'avatar-mao', 'avatar-dono', 'avatar-vo']);
    for (const a of avatares) expect(a.preco).not.toBeNull();
  });
  it('habilidade: embaralhar simples de série e Floreios por 5.000 Fichas (o dinheiro do jogo)', () => {
    const habilidades = ITENS.filter((i) => i.slot === 'habilidade');
    expect(habilidades.map((i) => [i.id, i.preco])).toEqual([
      ['habilidade-simples', null],
      ['habilidade-floreios', { moeda: 'fichas', valor: 5000 }],
    ]);
  });
  it('itens de Fichas não estão à venda por Pila e vice-versa (um preço só)', () => {
    expect(ITENS.some((i) => i.preco?.moeda === 'fichas')).toBe(true);
    expect(ITENS.some((i) => i.preco?.moeda === 'pila')).toBe(true);
  });
  it('pacotes respeitam o mínimo da InfinitePay (R$ 1,00)', () => {
    for (const p of PACOTES) {
      expect(p.centavos).toBeGreaterThanOrEqual(100);
      expect(Number.isInteger(p.pila)).toBe(true);
      expect(pacotePorId(p.id)).toBe(p);
    }
    expect(pacotePorId('x')).toBeNull();
  });
});
