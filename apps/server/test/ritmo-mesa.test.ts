import { describe, expect, test } from 'vitest';
import { REGRAS_RANQUEADA } from '@truco/engine';
import { TEMPOS_PADRAO } from '../src/mesa/Mesa';
import { chaveRegras, filtroDaSala, opcoesDaSala, temposDaMesa } from '../src/mesa/protocolo';
import { preferenciasValidas } from '../src/repo/usuarios';
import { criarMesa } from './mesa-helpers';

// Pedido do André (2026-11-20): o ritmo vira escolha da mesa, bem claro no menu inicial. "Calmo" é
// o ritmo novo (bots pensam 1,4 s, fim da mão 2,6 s); "Rápido" é o de antes (0,9 s e 1,8 s). O tempo
// por jogada também se escolhe ao criar a mesa (15, 20 ou 30 s).
describe('ritmo e tempo por jogada nas opções da mesa', () => {
  test('padrão: calmo e 20 s; aceita rápido e 15/30 s; valor estranho volta ao padrão', () => {
    expect(opcoesDaSala({})).toMatchObject({ ritmo: 'calmo', tempoJogadaS: 20 });
    expect(opcoesDaSala({ ritmo: 'rapido', tempoJogadaS: 15 })).toMatchObject({ ritmo: 'rapido', tempoJogadaS: 15 });
    expect(opcoesDaSala({ tempoJogadaS: 30 })).toMatchObject({ tempoJogadaS: 30 });
    expect(opcoesDaSala({ ritmo: 'turbo', tempoJogadaS: 5 })).toMatchObject({ ritmo: 'calmo', tempoJogadaS: 20 });
  });

  test('ranqueada: sempre calmo e 20 s (todos jogam igual)', () => {
    expect(opcoesDaSala({ modo: 'ranqueada', ritmo: 'rapido', tempoJogadaS: 30 })).toMatchObject({ ritmo: 'calmo', tempoJogadaS: 20 });
  });

  test('só junta na mesma sala quem escolheu o mesmo ritmo e tempo; as chaves de antes não mudam', () => {
    const r = REGRAS_RANQUEADA.paulista;
    const antes = chaveRegras(r, 0, 20, true, true);
    expect(chaveRegras(r, 0, 20, true, true, 'calmo', 20)).toBe(antes);
    expect(chaveRegras(r, 0, 20, true, true, 'rapido', 20)).not.toBe(antes);
    expect(chaveRegras(r, 0, 20, true, true, 'calmo', 30)).not.toBe(antes);
    expect(filtroDaSala(opcoesDaSala({ ritmo: 'rapido' })).chaveRegras).not.toBe(filtroDaSala(opcoesDaSala({})).chaveRegras);
  });

  test('tempos da mesa: calmo = padrão novo, rápido = o de antes; a jogada segue o tempo escolhido', () => {
    expect(temposDaMesa(opcoesDaSala({}))).toMatchObject({ botMs: TEMPOS_PADRAO.botMs, pausaMaoMs: TEMPOS_PADRAO.pausaMaoMs, jogadaMs: 20_000 });
    expect(temposDaMesa(opcoesDaSala({ ritmo: 'rapido', tempoJogadaS: 30 }))).toMatchObject({ botMs: 900, pausaMaoMs: 1_800, jogadaMs: 30_000 });
  });

  test('a mesa conta o ritmo e o tempo para a tela (animações e resumo)', () => {
    const t = criarMesa({ ritmo: 'rapido', tempoJogadaS: 15 });
    t.mesa.sentar('a', 'Ana');
    expect(t.estado('a')).toMatchObject({ ritmo: 'rapido', tempoJogadaS: 15 });
  });

  test('as preferências da conta lembram ritmo e tempo', () => {
    expect(preferenciasValidas({ variante: 'paulista', ritmo: 'rapido', tempoJogadaS: 30 })).toMatchObject({ ritmo: 'rapido', tempoJogadaS: 30 });
  });
});
