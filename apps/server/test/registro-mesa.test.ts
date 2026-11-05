import { type Dupla, type EstadoPartida, novaPartida, REGRAS_RANQUEADA } from '@truco/engine';
import { asc } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Banco } from '../src/banco/banco';
import { participacoes, partidas } from '../src/banco/schema';
import { RegistroMesa } from '../src/registroMesa';
import { bloqueioAte, ratingDe } from '../src/repo/partidas';
import { criarUsuario } from '../src/repo/usuarios';
import { servicosDeTeste } from '../src/servicos';
import { type BancoDeTeste, bancoDeTeste } from './banco-helpers';

let b: BancoDeTeste;
beforeAll(async () => {
  b = await bancoDeTeste();
}, 30_000);
beforeEach(() => b.limpar());
afterAll(() => b.fechar());

const T0 = new Date('2026-11-05T12:00:00Z');
const fimDe = (vencedor: Dupla, placar: [number, number]): EstadoPartida => ({
  ...novaPartida(REGRAS_RANQUEADA.paulista, 0),
  fase: 'fimPartida',
  placar,
  vencedor,
});

describe('RegistroMesa', () => {
  test('ranqueada 1x1: só ações de humano contam; abandono custa Elo; quem fica pontua', async () => {
    const s = servicosDeTeste(b.db, { agora: () => T0 });
    const ana = await criarUsuario(b.db, { apelidoBase: 'ana' });
    const bia = await criarUsuario(b.db, { apelidoBase: 'bia' });
    const r = new RegistroMesa(s, { variante: 'paulista', modo: 'ranqueada', formato: '1x1' });
    // Ordem real: o `sentar` do último humano dispara o início ANTES do `sentou` dele.
    r.sentou({ cadeira: 0, usuarioId: ana.id, nome: 'ana' });
    r.iniciou();
    r.sentou({ cadeira: 1, usuarioId: bia.id, nome: 'bia' });
    r.acao({ tipo: 'truco', cadeira: 1 }, true);
    r.acao({ tipo: 'correr', cadeira: 0 }, false);
    r.acao({ tipo: 'truco', cadeira: 2 }, false);
    r.abandonou(0);
    r.terminou(fimDe(1, [5, 12]));
    await r.ocioso();

    expect(await ratingDe(b.db, ana.id, 'paulista')).toEqual({ elo: 984, pontos: 0, partidas: 1 });
    expect(await ratingDe(b.db, bia.id, 'paulista')).toEqual({ elo: 1016, pontos: 16, partidas: 1 });
    expect(await bloqueioAte(b.db, ana.id, T0)).toEqual(new Date(T0.getTime() + 5 * 60_000));
    const ps = await b.db.select().from(participacoes).orderBy(asc(participacoes.cadeira));
    expect(ps.map((p) => [p.nome, p.humano, p.trucosPedidos, p.corridas, p.venceu, p.abandonou])).toEqual([
      ['ana', true, 0, 0, false, true],
      ['bia', true, 1, 0, true, false],
      ['Bot', false, 0, 0, null, false],
      ['Bot', false, 0, 0, null, false],
    ]);
  });

  test('só convidados: nada é gravado', async () => {
    const r = new RegistroMesa(servicosDeTeste(b.db), { variante: 'mineiro', modo: 'classica', formato: null });
    r.sentou({ cadeira: 0, usuarioId: null, nome: 'Convidado' });
    r.iniciou();
    r.terminou(fimDe(0, [12, 0]));
    await r.ocioso();
    expect(await b.db.select().from(partidas)).toEqual([]);
  });

  test('quem saiu antes do início não entra na partida', async () => {
    const ana = await criarUsuario(b.db, { apelidoBase: 'ana' });
    const bia = await criarUsuario(b.db, { apelidoBase: 'bia' });
    const r = new RegistroMesa(servicosDeTeste(b.db), { variante: 'mineiro', modo: 'privada', formato: null });
    r.sentou({ cadeira: 0, usuarioId: ana.id, nome: 'ana' });
    r.sentou({ cadeira: 2, usuarioId: bia.id, nome: 'bia' });
    r.saiuAntesDoInicio(2);
    r.iniciou();
    await r.ocioso();
    const ps = await b.db.select().from(participacoes).orderBy(asc(participacoes.cadeira));
    expect(ps.map((p) => p.usuarioId)).toEqual([ana.id, null, null, null]);
  });

  test('sem serviços (null) não faz nada; erro de banco vai para aoErro', async () => {
    const semBanco = new RegistroMesa(null, { variante: 'paulista', modo: 'classica', formato: null });
    semBanco.sentou({ cadeira: 0, usuarioId: 1, nome: 'x' });
    semBanco.iniciou();
    await semBanco.ocioso();

    const aoErro = vi.fn();
    const quebrado = new RegistroMesa(servicosDeTeste({} as Banco), { variante: 'paulista', modo: 'classica', formato: null }, aoErro);
    quebrado.sentou({ cadeira: 0, usuarioId: 1, nome: 'x' });
    quebrado.iniciou();
    await quebrado.ocioso();
    expect(aoErro).toHaveBeenCalledTimes(1);
  });
});
