# Plano 2 — Bot difícil + Servidor de Mesa (Colyseus)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ter um servidor multiplayer autoritativo: salas de truco em tempo real, bots (fácil e difícil) nas cadeiras vagas e no lugar de quem caiu, timer de jogada, reconexão, sinais entre parceiros e falas.

**Architecture:** Toda a lógica de mesa fica numa classe pura `Mesa` (sem Colyseus): recebe ids de jogadores, mensagens cruas e um `Relogio` injetável, e envia mensagens via callback `enviar(id, tipo, payload)`. É testada com timers falsos do Vitest. `MesaRoom` (Colyseus 0.18) é só um adaptador fino; não usamos `Schema` — cada cliente recebe sua própria `Visao` via `client.send('estado', ...)`. O bot difícil vai na engine (puro): amostra mundos coerentes com a `Visao` (determinização) e simula o resto da mão com o bot fácil.

**Tech Stack:** Node ≥ 20, TypeScript 5.6, `@colyseus/core` 0.18, `@colyseus/ws-transport` 0.18, `@colyseus/testing` + `@colyseus/sdk` 0.18 (testes), `tsx` (execução), Vitest 2.

**Pré-requisitos:** Plano 1 concluído (engine com 120 testes). Design: `docs/plans/2026-11-05-truco-design.md`.

---

## Convenções

- Comandos rodam na raiz `D:\01 Projetos\Projetos\truco` (PowerShell).
- Git: **não** altere config. Use `git -c "safe.directory=D:/01 Projetos/Projetos/truco" ...`. Commits terminam com linha em branco + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- O drive D: é exFAT (sem symlinks) e há `.npmrc` com `node-linker=hoisted` — mantenha. Por isso o servidor **não** depende de `@truco/engine` via `workspace:*`: resolve por alias (Vitest `resolve.alias` + `tsconfig.paths`, que o `tsx` respeita).
- API da engine usada aqui: `novaPartida`, `reduce`, `ErroJogada`, `ehAcaoJogador`, `acoesValidas(s, cadeira)`, `todasAcoesValidas(s)`, `visaoDoJogador`, `botFacil`, `forca`, `embaralhar`, `novoBaralho`, `mulberry32`, `idCarta`, `duplaDe`, `parceiroDe`, `REGRAS_RANQUEADA`, tipos `AcaoJogador`, `Cadeira`, `Dupla`, `EstadoPartida`, `Visao`, `JogadaVisivel`, `Jogada`, `RegrasMesa`, `Carta`.

## Protocolo (cliente ↔ servidor)

| Direção | Tipo | Payload |
|---|---|---|
| C → S | `acao` | `AcaoJogador` sem precisar de `cadeira` (o servidor sobrescreve com a cadeira do cliente) |
| C → S | `sinal` | `Sinal` (string) |
| C → S | `fala` | `Fala` (string) |
| C → S | `iniciar` | — (só o dono, completa com bots) |
| S → C | `estado` | `MsgEstado` |
| S → C | `acao` | `{ cadeira, tipo }` (para animar balões) |
| S → C | `sinal` | `{ de, sinal, interceptado? }` |
| S → C | `fala` | `{ de, fala }` |
| S → C | `erro` | `{ mensagem }` |

---

### Task 1: `amostrarMundo` (determinização) na engine

**Files:**
- Create: `packages/engine/src/bots/dificil.ts`
- Test: `packages/engine/test/bot-dificil.test.ts`

**Step 1: Teste que falha**

```ts
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { todasAcoesValidas } from '../src/acoes';
import { amostrarMundo } from '../src/bots/dificil';
import { type Carta, idCarta, novoBaralho } from '../src/cartas';
import { type Cadeira, type EstadoPartida, novaPartida } from '../src/estado';
import { reduce } from '../src/reducer';
import { embaralhar, mulberry32 } from '../src/rng';
import { visaoDoJogador } from '../src/visao';
import { MAOS_DUPLA0_VENCE, MINEIRO, PAULISTA, distribuida } from './helpers';

const CADEIRAS: Cadeira[] = [0, 1, 2, 3];

function cartasDoMundo(s: EstadoPartida): Carta[] {
  const m = s.mao!;
  return [...m.maos.flat(), ...m.mesa.map((j) => j.carta), ...m.rodadasJogadas.flat().map((j) => j.carta), ...(m.vira ? [m.vira] : [])];
}

function estadoAleatorio(seed: number): EstadoPartida | null {
  const rand = mulberry32(seed);
  const regras = rand() < 0.5 ? PAULISTA : MINEIRO;
  let s = reduce(novaPartida(regras), { tipo: 'distribuir', baralho: embaralhar(novoBaralho(), rand) });
  const passos = Math.floor(rand() * 9);
  for (let i = 0; i < passos && s.mao; i++) {
    const acoes = todasAcoesValidas(s);
    if (acoes.length === 0) break;
    s = reduce(s, acoes[Math.floor(rand() * acoes.length)]);
  }
  return s.mao ? s : null;
}

function conferir(s: EstadoPartida, rand: () => number) {
  for (const cad of CADEIRAS) {
    const v = visaoDoJogador(s, cad);
    const mundo = amostrarMundo(v, rand);
    expect(visaoDoJogador(mundo, cad).mao).toEqual(v.mao);
    const ids = cartasDoMundo(mundo).map(idCarta);
    expect(new Set(ids).size).toBe(ids.length);
    expect(mundo.mao!.maos.map((m) => m.length)).toEqual(s.mao!.maos.map((m) => m.length));
  }
}

describe('amostrarMundo', () => {
  test('o mundo amostrado é indistinguível do real para quem olha', () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const s = estadoAleatorio(seed);
        if (s) conferir(s, mulberry32(seed ^ 0x5eed));
      }),
      { numRuns: 150 },
    );
  });

  test('mão de 10 (vê o parceiro) e mão de 11 (não vê a própria)', () => {
    conferir(distribuida(MINEIRO, MAOS_DUPLA0_VENCE, undefined, [10, 0]), mulberry32(1));
    conferir(distribuida(PAULISTA, MAOS_DUPLA0_VENCE, '5p', [11, 0]), mulberry32(2));
  });

  test('sem mão em andamento é erro', () => {
    expect(() => amostrarMundo(visaoDoJogador(novaPartida(MINEIRO), 0), mulberry32(1))).toThrow();
  });
});
```

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/engine test`
Expected: FAIL — `Failed to load url ../src/bots/dificil`.

**Step 3: Implementação**

`packages/engine/src/bots/dificil.ts`
```ts
import { type Carta, idCarta, novoBaralho } from '../cartas';
import { type Cadeira, type EstadoPartida, type Jogada, parceiroDe } from '../estado';
import { embaralhar } from '../rng';
import type { JogadaVisivel, Visao } from '../visao';

/**
 * Monta um estado completo coerente com tudo que `v.cadeira` enxerga:
 * cartas desconhecidas (mãos alheias, cartas cobertas alheias e, na mão de
 * ferro, a própria mão) são sorteadas do que sobrou do baralho.
 */
export function amostrarMundo(v: Visao, rand: () => number): EstadoPartida {
  const m = v.mao;
  if (!m) throw new Error('não há mão em andamento');

  const conhecidas = new Set<string>();
  const marcar = (c: Carta | null) => {
    if (c) conhecidas.add(idCarta(c));
  };
  m.minhaMao.forEach(marcar);
  m.maoParceiro?.forEach(marcar);
  marcar(m.vira);
  m.mesa.forEach((j) => marcar(j.carta));
  m.rodadasJogadas.flat().forEach((j) => marcar(j.carta));

  const monte = embaralhar(
    novoBaralho().filter((c) => !conhecidas.has(idCarta(c))),
    rand,
  );
  const tirar = (): Carta => {
    const c = monte.pop();
    if (!c) throw new Error('monte esgotado ao amostrar');
    return c;
  };

  const parceiro = parceiroDe(v.cadeira);
  const maos: Carta[][] = ([0, 1, 2, 3] as Cadeira[]).map((c) => {
    if (c === v.cadeira) return m.minhaMao.map((x) => x ?? tirar());
    if (c === parceiro && m.maoParceiro) return m.maoParceiro.map((x) => ({ ...x }));
    return Array.from({ length: m.qtdCartas[c] }, tirar);
  });
  const revelar = (j: JogadaVisivel): Jogada => ({ ...j, carta: j.carta ?? tirar() });

  const { minhaMao: _a, maoParceiro: _b, qtdCartas: _c, mesa, rodadasJogadas, ...resto } = m;
  return {
    regras: { ...v.regras },
    placar: [v.placar[0], v.placar[1]],
    pe: v.pe,
    fase: v.fase,
    ultimaMao: null,
    ultimaFamilia: null,
    vencedor: v.vencedor,
    mao: {
      ...structuredClone(resto),
      maos,
      mesa: mesa.map(revelar),
      rodadasJogadas: rodadasJogadas.map((r) => r.map(revelar)),
    },
  };
}
```

> Se o typecheck reclamar de variáveis não usadas (`_a`, `_b`, `_c`), não há `noUnusedLocals` no tsconfig base — deve passar. Se reclamar, troque a desestruturação por `const { mesa, rodadasJogadas } = m;` e monte `resto` copiando os campos de `EstadoMao` explicitamente.

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/engine test`
Expected: PASS.

**Step 5: Commit**

```powershell
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add -A
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "feat(engine): amostrarMundo para o bot difícil"
```

---

### Task 2: `botDificil` (Monte Carlo) + benchmark

**Files:**
- Modify: `packages/engine/src/bots/dificil.ts`, `packages/engine/src/index.ts`, `packages/engine/package.json`
- Create: `packages/engine/scripts/bench-bots.ts`
- Test: `packages/engine/test/bot-dificil.test.ts` (acrescentar)

**Step 1: Teste que falha** — acrescente ao fim de `bot-dificil.test.ts` (e importe `botDificil`, `acoesValidas`):

```ts
import { acoesValidas } from '../src/acoes';
import { botDificil } from '../src/bots/dificil';

describe('botDificil', () => {
  test('é determinístico para a mesma visão e seed', () => {
    const s = distribuida(MINEIRO, MAOS_DUPLA0_VENCE);
    const v = visaoDoJogador(s, 0);
    expect(botDificil(v, mulberry32(9), { amostras: 6 })).toEqual(botDificil(v, mulberry32(9), { amostras: 6 }));
  });

  test('não age fora da vez', () => {
    const s = distribuida(MINEIRO, MAOS_DUPLA0_VENCE);
    expect(botDificil(visaoDoJogador(s, 1), mulberry32(1), { amostras: 4 })).toBeNull();
  });

  test('sempre devolve uma ação legal', () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const s = estadoAleatorio(seed);
        if (!s) return;
        for (const cad of CADEIRAS) {
          const a = botDificil(visaoDoJogador(s, cad), mulberry32(seed), { amostras: 3 });
          const legais = acoesValidas(s, cad);
          if (legais.length === 0) expect(a).toBeNull();
          else expect(legais).toContainEqual(a);
        }
      }),
      { numRuns: 40 },
    );
  }, 60_000);

  test('quatro bots difíceis terminam uma partida', () => {
    const rand = mulberry32(77);
    let s = novaPartida(MINEIRO);
    for (let passos = 0; s.fase !== 'fimPartida'; passos++) {
      if (passos > 3000) throw new Error('não terminou');
      if (s.fase === 'aguardandoDistribuicao') {
        s = reduce(s, { tipo: 'distribuir', baralho: embaralhar(novoBaralho(), rand) });
        continue;
      }
      const atual = s;
      const acao = CADEIRAS.map((c) => botDificil(visaoDoJogador(atual, c), rand, { amostras: 3 })).find((a) => a !== null);
      expect(acao).toBeDefined();
      s = reduce(s, acao!);
    }
    expect(s.vencedor).not.toBeNull();
  }, 60_000);
});
```

> Atenção no último teste: duas cadeiras da mesma dupla podem responder um truco; usamos a primeira não-nula — mesmo comportamento do servidor.

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/engine test`
Expected: FAIL — `botDificil` não exportado.

**Step 3: Implementação** — acrescente a `packages/engine/src/bots/dificil.ts`:

```ts
import { acoesValidas } from '../acoes';
import { type AcaoJogador, type Dupla, duplaDe } from '../estado';
import { reduce } from '../reducer';
import { botFacil } from './facil';

export interface OpcoesBotDificil {
  /** Mundos amostrados por decisão. Mais = mais forte e mais lento. */
  amostras?: number;
  /** Chance de trucar "no escuro" quando pode. */
  chanceBlefe?: number;
}

/** Joga o resto da mão com o bot fácil em todas as cadeiras; devolve o saldo de pontos da `dupla`. */
function simularResto(inicio: EstadoPartida, dupla: Dupla): number {
  let s = inicio;
  for (let guarda = 0; s.mao && guarda < 200; guarda++) {
    const atual = s;
    const a = ([0, 1, 2, 3] as Cadeira[]).map((c) => botFacil(atual, c)).find((x) => x !== null);
    if (!a) break;
    s = reduce(s, a);
  }
  const outra = (1 - dupla) as Dupla;
  return s.placar[dupla] - inicio.placar[dupla] - (s.placar[outra] - inicio.placar[outra]);
}

/**
 * Bot difícil: para cada ação legal, simula o resto da mão em vários mundos
 * possíveis (coerentes com a própria visão) e escolhe a de melhor saldo médio.
 * Recebe só a `Visao` — não tem como "roubar" olhando cartas alheias.
 */
export function botDificil(v: Visao, rand: () => number, opcoes: OpcoesBotDificil = {}): AcaoJogador | null {
  const { amostras = 24, chanceBlefe = 0.08 } = opcoes;
  if (!v.mao) return null;

  const primeiro = amostrarMundo(v, rand);
  const candidatas = acoesValidas(primeiro, v.cadeira);
  if (candidatas.length <= 1) return candidatas[0] ?? null;

  const truco = candidatas.find((a) => a.tipo === 'truco');
  if (truco && rand() < chanceBlefe) return truco;

  const dupla = duplaDe(v.cadeira);
  const soma = candidatas.map(() => 0);
  for (let k = 0; k < amostras; k++) {
    const mundo = k === 0 ? primeiro : amostrarMundo(v, rand);
    candidatas.forEach((a, i) => {
      soma[i] += simularResto(reduce(mundo, a), dupla);
    });
  }
  let melhor = 0;
  for (let i = 1; i < soma.length; i++) if (soma[i] > soma[melhor]) melhor = i;
  return candidatas[melhor];
}
```

Junte os imports no topo do arquivo (um bloco por módulo; `Cadeira`, `EstadoPartida`, `Jogada`, `parceiroDe` já vêm de `../estado`).

Em `packages/engine/src/index.ts` acrescente:
```ts
export * from './bots/dificil';
```

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/engine test; pnpm --filter @truco/engine typecheck`
Expected: PASS, sem erros de tipo.

**Step 5: Benchmark (não entra no `test`)**

Em `packages/engine/package.json`: devDependency `"tsx": "^4.23.0"` e script `"bench": "tsx scripts/bench-bots.ts"`. Rode `pnpm install`.

`packages/engine/scripts/bench-bots.ts`
```ts
import { botDificil, botFacil, type Cadeira, duplaDe, embaralhar, mulberry32, novaPartida, novoBaralho, reduce, REGRAS_RANQUEADA, visaoDoJogador } from '../src';

const PARTIDAS = Number(process.argv[2] ?? 40);
const rand = mulberry32(2026);
let vitorias = 0;
const t0 = Date.now();

for (let p = 0; p < PARTIDAS; p++) {
  const regras = p % 2 === 0 ? REGRAS_RANQUEADA.paulista : REGRAS_RANQUEADA.mineiro;
  let s = novaPartida(regras, (p % 4) as Cadeira);
  while (s.fase !== 'fimPartida') {
    if (s.fase === 'aguardandoDistribuicao') {
      s = reduce(s, { tipo: 'distribuir', baralho: embaralhar(novoBaralho(), rand) });
      continue;
    }
    const atual = s;
    const acao = ([0, 1, 2, 3] as Cadeira[])
      .map((c) => (duplaDe(c) === 0 ? botDificil(visaoDoJogador(atual, c), rand, { amostras: 16 }) : botFacil(atual, c)))
      .find((a) => a !== null)!;
    s = reduce(s, acao);
  }
  if (s.vencedor === 0) vitorias++;
}

console.log(`difícil (dupla 0) x fácil (dupla 1): ${vitorias}/${PARTIDAS} = ${((100 * vitorias) / PARTIDAS).toFixed(0)}% em ${((Date.now() - t0) / 1000).toFixed(0)} s`);
```

Run: `pnpm --filter @truco/engine bench`
Expected: taxa de vitória do difícil **≥ 60%**. Anote o resultado e o tempo no relatório. Se ficar abaixo, **não** mude regras: reporte (é sinal para calibrar `amostras`/`chanceBlefe` num passo futuro).

**Step 6: Commit**

```powershell
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add -A
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "feat(engine): bot difícil por amostragem e benchmark"
```

---

### Task 3: Pacote `apps/server` + protocolo

**Files:**
- Create: `apps/server/package.json`, `apps/server/tsconfig.json`, `apps/server/vitest.config.ts`
- Create: `apps/server/src/mesa/protocolo.ts`
- Test: `apps/server/test/protocolo.test.ts`

**Step 1: Scaffold**

`apps/server/package.json`
```json
{
  "name": "@truco/server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "start": "tsx src/main.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@colyseus/core": "^0.18.26",
    "@colyseus/ws-transport": "^0.18.4",
    "tsx": "^4.23.0"
  },
  "devDependencies": {
    "@colyseus/sdk": "^0.18.9",
    "@colyseus/testing": "^0.18.6",
    "@types/node": "^20.16.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

`apps/server/tsconfig.json`
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@truco/engine": ["../../packages/engine/src/index.ts"] }
  },
  "include": ["src", "test", "vitest.config.ts"]
}
```

`apps/server/vitest.config.ts`
```ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@truco/engine': fileURLToPath(new URL('../../packages/engine/src/index.ts', import.meta.url)) },
  },
  test: { include: ['test/**/*.test.ts'] },
});
```

Run: `pnpm install`
Expected: instala sem erro (lockfile atualizado).

**Step 2: Teste que falha**

`apps/server/test/protocolo.test.ts`
```ts
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
```

**Step 3: Rodar e ver falhar**

Run: `pnpm --filter @truco/server test`
Expected: FAIL — `Failed to load url ../src/mesa/protocolo`.

**Step 4: Implementação**

`apps/server/src/mesa/protocolo.ts`
```ts
import { type AcaoJogador, type Cadeira, REGRAS_RANQUEADA, type RegrasMesa, type Visao } from '@truco/engine';

export const SINAIS = ['zap', 'copas', 'espadilha', 'picafumo', 'tres', 'dois', 'as', 'nada'] as const;
export type Sinal = (typeof SINAIS)[number];

export const FALAS = ['truco', 'seis', 'nove', 'doze', 'desce', 'corro', 'boa', 'vixe', 'bora'] as const;
export type Fala = (typeof FALAS)[number];

export type NivelBot = 'facil' | 'dificil';

export const ehSinal = (x: unknown): x is Sinal => (SINAIS as readonly unknown[]).includes(x);
export const ehFala = (x: unknown): x is Fala => (FALAS as readonly unknown[]).includes(x);

export interface InfoCadeira {
  tipo: 'vazia' | 'humano' | 'bot';
  nome: string | null;
  conectado: boolean;
}

export interface MsgEstado {
  minhaCadeira: Cadeira;
  cadeiras: InfoCadeira[];
  visao: Visao | null;
  /** Quem precisa agir e até quando (epoch ms). */
  prazo: { cadeiras: Cadeira[]; ate: number } | null;
  minhasAcoes: AcaoJogador[];
}

export interface MsgAcao {
  cadeira: Cadeira;
  tipo: AcaoJogador['tipo'];
}
export interface MsgSinal {
  de: Cadeira;
  sinal: Sinal;
  interceptado?: boolean;
}
export interface MsgFala {
  de: Cadeira;
  fala: Fala;
}
export interface MsgErro {
  mensagem: string;
}

export interface OpcoesSala {
  regras: RegrasMesa;
  humanos: number;
  nivelBot: NivelBot;
}

function um<T extends string>(v: unknown, permitidos: readonly T[], padrao: T): T {
  return (permitidos as readonly unknown[]).includes(v) ? (v as T) : padrao;
}

const obj = (x: unknown): Record<string, unknown> => (x && typeof x === 'object' ? (x as Record<string, unknown>) : {});

/** Converte as opções cruas de criação de sala (vindas do cliente) em configuração válida. */
export function opcoesDaSala(cru: unknown): OpcoesSala {
  const o = obj(cru);
  const variante = um(o.variante, ['paulista', 'mineiro'] as const, 'paulista');
  const base = REGRAS_RANQUEADA[variante];
  const r = obj(o.regras);
  const regras: RegrasMesa = {
    variante,
    pontuacao: um(r.pontuacao, ['1-3-6-9-12', '2-4-8-10-12'] as const, base.pontuacao),
    maoDe10: typeof r.maoDe10 === 'boolean' ? r.maoDe10 : base.maoDe10,
    maoDe11: um(r.maoDe11, ['off', 'qualquerDupla', 'onzeAOnze'] as const, base.maoDe11),
    familia: um(r.familia, ['off', 'aberta', 'fechada'] as const, base.familia),
  };
  const h = o.humanos;
  const humanos = typeof h === 'number' && Number.isInteger(h) && h >= 1 && h <= 4 ? h : 1;
  return { regras, humanos, nivelBot: um(o.nivelBot, ['facil', 'dificil'] as const, 'facil') };
}
```

**Step 5: Rodar e ver passar**

Run: `pnpm --filter @truco/server test; pnpm --filter @truco/server typecheck`
Expected: PASS; sem erros de tipo.

**Step 6: Commit**

```powershell
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add -A
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "feat(server): pacote do servidor e protocolo de mensagens"
```

---

### Task 4: `Mesa` — lobby, início e auxiliares de jogada

**Files:**
- Create: `apps/server/src/mesa/Mesa.ts`
- Create: `apps/server/test/mesa-helpers.ts`
- Test: `apps/server/test/mesa-lobby.test.ts`, `apps/server/test/mesa-auxiliares.test.ts`

**Step 1: Helpers de teste**

`apps/server/test/mesa-helpers.ts`
```ts
import { mulberry32, REGRAS_RANQUEADA } from '@truco/engine';
import { vi } from 'vitest';
import { Mesa, type OpcoesMesa } from '../src/mesa/Mesa';
import type { MsgEstado } from '../src/mesa/protocolo';

export const TEMPOS = { jogadaMs: 1_000, botMs: 10, pausaMaoMs: 20, intervaloMensagemMs: 100 };

export function criarMesa(extra: Partial<OpcoesMesa> = {}) {
  const caixa = new Map<string, { tipo: string; payload: any }[]>();
  const mesa = new Mesa({
    regras: REGRAS_RANQUEADA.mineiro,
    nivelBot: 'facil',
    humanosEsperados: 1,
    rand: mulberry32(7),
    tempos: TEMPOS,
    enviar: (id, tipo, payload) => {
      if (!caixa.has(id)) caixa.set(id, []);
      caixa.get(id)!.push({ tipo, payload });
    },
    ...extra,
  });
  const de = (id: string, tipo: string): any[] => (caixa.get(id) ?? []).filter((m) => m.tipo === tipo).map((m) => m.payload);
  const estado = (id: string): MsgEstado | undefined => de(id, 'estado').at(-1);
  return { mesa, caixa, de, estado };
}

/** Avança o relógio falso em passos até `cond()` ser verdadeira. */
export function avancarAte(cond: () => boolean, passoMs = 10, maxMs = 600_000): void {
  for (let t = 0; t <= maxMs; t += passoMs) {
    if (cond()) return;
    vi.advanceTimersByTime(passoMs);
  }
  throw new Error('condição não atingida no tempo simulado');
}
```

**Step 2: Testes que falham**

`apps/server/test/mesa-lobby.test.ts`
```ts
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { criarMesa } from './mesa-helpers';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('lobby', () => {
  test('os dois primeiros humanos ficam na mesma dupla', () => {
    const { mesa } = criarMesa({ humanosEsperados: 4 });
    expect(['a', 'b', 'c', 'd'].map((id) => mesa.sentar(id, id))).toEqual([0, 2, 1, 3]);
    expect(mesa.iniciada).toBe(true);
  });

  test('espera os humanos; só o dono inicia completando com bots', () => {
    const { mesa, estado } = criarMesa({ humanosEsperados: 3 });
    mesa.sentar('a', 'Ana');
    mesa.sentar('b', 'Bia');
    expect(mesa.iniciada).toBe(false);
    expect(estado('a')!.visao).toBeNull();
    expect(estado('a')!.cadeiras.map((c) => c.tipo)).toEqual(['humano', 'vazia', 'humano', 'vazia']);

    mesa.iniciar('b');
    expect(mesa.iniciada).toBe(false);
    mesa.iniciar('a');
    expect(mesa.iniciada).toBe(true);
    expect(estado('b')!.cadeiras.map((c) => c.tipo)).toEqual(['humano', 'bot', 'humano', 'bot']);
    expect(mesa.sentar('c', 'Cid')).toBeNull();
  });

  test('não senta o mesmo id duas vezes e limpa o nome', () => {
    const { mesa, estado } = criarMesa({ humanosEsperados: 2 });
    expect(mesa.sentar('a', '   ')).toBe(0);
    expect(mesa.sentar('a', 'Ana')).toBeNull();
    expect(estado('a')!.cadeiras[0].nome).toBe('Jogador');
    mesa.sentar('b', 'x'.repeat(50));
    expect(estado('b')!.cadeiras[2].nome).toHaveLength(20);
  });

  test('sair antes do início libera a cadeira', () => {
    const { mesa, estado } = criarMesa({ humanosEsperados: 3 });
    mesa.sentar('a', 'Ana');
    mesa.sentar('b', 'Bia');
    mesa.sair('b');
    expect(estado('a')!.cadeiras[2].tipo).toBe('vazia');
    expect(mesa.sentar('c', 'Cid')).toBe(2);
  });

  test('humanosEsperados fora de 1..4 é erro', () => {
    expect(() => criarMesa({ humanosEsperados: 0 })).toThrow();
    expect(() => criarMesa({ humanosEsperados: 5 })).toThrow();
  });
});
```

`apps/server/test/mesa-auxiliares.test.ts`
```ts
import { type EstadoPartida, novaPartida, novoBaralho, reduce, REGRAS_RANQUEADA } from '@truco/engine';
import { describe, expect, test } from 'vitest';
import { jogadaAutomatica, quemDeveAgir } from '../src/mesa/Mesa';

/**
 * Baralho na ordem de novoBaralho() com pe = 3:
 * cad0 = 4o 5o 6o, cad1 = 4e 5e 6e, cad2 = 4c 5c 6c, cad3 = 4p(zap) 5p 6p.
 */
function inicio(placar: [number, number] = [0, 0]): EstadoPartida {
  const s = novaPartida(REGRAS_RANQUEADA.mineiro, 3);
  s.placar = placar;
  return reduce(s, { tipo: 'distribuir', baralho: novoBaralho() });
}

describe('quemDeveAgir', () => {
  test('jogando: só quem está na vez', () => {
    expect(quemDeveAgir(inicio())).toEqual([0]);
  });
  test('truco pendente: a dupla adversária', () => {
    expect(quemDeveAgir(reduce(inicio(), { tipo: 'truco', cadeira: 0 }))).toEqual([1, 3]);
  });
  test('mão de 10: a dupla com 10', () => {
    expect(quemDeveAgir(inicio([4, 10]))).toEqual([1, 3]);
  });
  test('sem mão: ninguém', () => {
    expect(quemDeveAgir(novaPartida(REGRAS_RANQUEADA.mineiro))).toEqual([]);
  });
});

describe('jogadaAutomatica', () => {
  test('joga a carta mais fraca', () => {
    let s = inicio();
    s = reduce(s, { tipo: 'jogar', cadeira: 0, indice: 2 }); // 6o
    s = reduce(s, { tipo: 'jogar', cadeira: 1, indice: 0 }); // 4e
    s = reduce(s, { tipo: 'jogar', cadeira: 2, indice: 0 }); // 4c
    // cad3 tem 4p (zap, 14), 5p (2), 6p (3) → mais fraca é 5p (índice 1)
    expect(jogadaAutomatica(s, 3)).toEqual({ tipo: 'jogar', cadeira: 3, indice: 1 });
  });
  test('corre do truco e da mão de 10', () => {
    expect(jogadaAutomatica(reduce(inicio(), { tipo: 'truco', cadeira: 0 }), 1)).toEqual({ tipo: 'correr', cadeira: 1 });
    expect(jogadaAutomatica(inicio([4, 10]), 3)).toEqual({ tipo: 'mao10', cadeira: 3, jogar: false });
  });
});
```

**Step 3: Rodar e ver falhar**

Run: `pnpm --filter @truco/server test`
Expected: FAIL — `Failed to load url ../src/mesa/Mesa`.

**Step 4: Implementação (classe completa; as Tasks 5–7 testam o resto do comportamento)**

`apps/server/src/mesa/Mesa.ts`
```ts
import {
  type AcaoJogador,
  botDificil,
  botFacil,
  type Cadeira,
  duplaDe,
  ehAcaoJogador,
  embaralhar,
  ErroJogada,
  type EstadoPartida,
  forca,
  acoesValidas,
  novaPartida,
  novoBaralho,
  parceiroDe,
  reduce,
  type RegrasMesa,
  visaoDoJogador,
} from '@truco/engine';
import { ehFala, ehSinal, type InfoCadeira, type MsgEstado, type NivelBot } from './protocolo';

export interface Relogio {
  /** Agenda `fn` e devolve uma função que cancela. */
  agendar(ms: number, fn: () => void): () => void;
  agora(): number;
}

export const relogioReal: Relogio = {
  agendar(ms, fn) {
    const t = setTimeout(fn, ms);
    return () => clearTimeout(t);
  },
  agora: () => Date.now(),
};

export interface Tempos {
  jogadaMs: number;
  botMs: number;
  pausaMaoMs: number;
  intervaloMensagemMs: number;
}

export const TEMPOS_PADRAO: Tempos = { jogadaMs: 20_000, botMs: 900, pausaMaoMs: 1_800, intervaloMensagemMs: 1_000 };

export interface OpcoesMesa {
  regras: RegrasMesa;
  nivelBot: NivelBot;
  humanosEsperados: number;
  enviar: (id: string, tipo: string, payload: unknown) => void;
  relogio?: Relogio;
  rand?: () => number;
  tempos?: Partial<Tempos>;
  /** Chance (0–1) de cada adversário ver um sinal. */
  chanceInterceptarSinal?: number;
  aoTerminar?: (s: EstadoPartida) => void;
}

interface Ocupante {
  id: string | null;
  nome: string | null;
  humano: boolean;
  conectado: boolean;
  ultimaMensagem: number;
}

const CADEIRAS: Cadeira[] = [0, 1, 2, 3];
/** Os dois primeiros humanos ficam parceiros. */
const ORDEM_SENTAR: Cadeira[] = [0, 2, 1, 3];
const NOMES_BOT = ['Zé', 'Tião', 'Dita', 'Nhô'];

const vazio = (): Ocupante => ({ id: null, nome: null, humano: false, conectado: false, ultimaMensagem: -Infinity });

/** Cadeiras que precisam agir agora. */
export function quemDeveAgir(s: EstadoPartida): Cadeira[] {
  const m = s.mao;
  if (!m) return [];
  if (s.fase === 'jogando') return [m.vez];
  if (s.fase === 'respondendoTruco' && m.trucoPendente) {
    const pediu = m.trucoPendente.dupla;
    return CADEIRAS.filter((c) => duplaDe(c) !== pediu);
  }
  if (s.fase === 'decisaoMao10') return CADEIRAS.filter((c) => duplaDe(c) === m.duplaNoDez);
  return [];
}

/** Jogada quando o tempo estoura: corre, ou joga a carta mais fraca. */
export function jogadaAutomatica(s: EstadoPartida, cadeira: Cadeira): AcaoJogador {
  if (s.fase === 'respondendoTruco') return { tipo: 'correr', cadeira };
  if (s.fase === 'decisaoMao10') return { tipo: 'mao10', cadeira, jogar: false };
  const m = s.mao;
  if (!m || m.tipo === 'mao11') return { tipo: 'jogar', cadeira, indice: 0 };
  const forcas = m.maos[cadeira].map((c) => forca(c, s.regras.variante, m.vira));
  return { tipo: 'jogar', cadeira, indice: forcas.indexOf(Math.min(...forcas)) };
}

export class Mesa {
  private readonly ocupantes: Ocupante[] = CADEIRAS.map(vazio);
  private estado: EstadoPartida | null = null;
  private cancelamentos: (() => void)[] = [];
  private prazo: MsgEstado['prazo'] = null;
  private terminou = false;
  private bots = 0;
  private readonly relogio: Relogio;
  private readonly rand: () => number;
  private readonly tempos: Tempos;

  constructor(private readonly o: OpcoesMesa) {
    const h = o.humanosEsperados;
    if (!Number.isInteger(h) || h < 1 || h > 4) throw new Error('humanosEsperados deve ser 1..4');
    this.relogio = o.relogio ?? relogioReal;
    this.rand = o.rand ?? Math.random;
    this.tempos = { ...TEMPOS_PADRAO, ...o.tempos };
  }

  get iniciada(): boolean {
    return this.estado !== null;
  }

  get partida(): EstadoPartida | null {
    return this.estado;
  }

  cadeiraDe(id: string): Cadeira | null {
    const i = this.ocupantes.findIndex((x) => x.id === id);
    return i < 0 ? null : (i as Cadeira);
  }

  // ---------- lobby ----------

  sentar(id: string, nome: string): Cadeira | null {
    if (this.iniciada || this.cadeiraDe(id) !== null) return null;
    const cad = ORDEM_SENTAR.find((c) => this.ocupantes[c].id === null);
    if (cad === undefined) return null;
    this.ocupantes[cad] = {
      id,
      nome: nome.trim().slice(0, 20) || 'Jogador',
      humano: true,
      conectado: true,
      ultimaMensagem: -Infinity,
    };
    if (this.humanosSentados() >= this.o.humanosEsperados) this.iniciar();
    else this.enviarEstados();
    return cad;
  }

  /** Começa a partida completando com bots. Com `id`, só o dono pode. */
  iniciar(id?: string): void {
    if (this.iniciada) return;
    if (id !== undefined && this.cadeiraDe(id) !== this.dono()) return;
    for (const c of CADEIRAS) if (this.ocupantes[c].id === null) this.virarBot(c);
    this.estado = novaPartida(this.o.regras, Math.floor(this.rand() * 4) as Cadeira);
    this.atualizar();
  }

  desconectar(id: string): void {
    const c = this.cadeiraDe(id);
    if (c === null) return;
    this.ocupantes[c].conectado = false;
    if (this.iniciada) this.atualizar();
    else this.enviarEstados();
  }

  reconectar(id: string): void {
    const c = this.cadeiraDe(id);
    if (c === null) return;
    this.ocupantes[c].conectado = true;
    if (this.iniciada) this.atualizar();
    else this.enviarEstados();
  }

  /** Saída definitiva: antes do início libera a cadeira; depois, um bot assume. */
  sair(id: string): void {
    const c = this.cadeiraDe(id);
    if (c === null) return;
    if (!this.iniciada) {
      this.ocupantes[c] = vazio();
      this.enviarEstados();
      return;
    }
    this.virarBot(c);
    this.atualizar();
  }

  dispose(): void {
    this.cancelarTimers();
  }

  // ---------- jogo ----------

  acao(id: string, bruto: unknown): void {
    const cad = this.cadeiraDe(id);
    if (cad === null || !this.estado) return;
    const comCadeira = bruto && typeof bruto === 'object' ? { ...(bruto as Record<string, unknown>), cadeira: cad } : bruto;
    if (!ehAcaoJogador(comCadeira)) {
      this.erro(id, 'ação inválida');
      return;
    }
    this.aplicar(comCadeira, id);
  }

  sinal(id: string, sinal: unknown): void {
    const c = this.cadeiraDe(id);
    if (c === null || !this.estado || !ehSinal(sinal) || !this.podeMandar(c)) return;
    const parceiro = parceiroDe(c);
    for (const alvo of CADEIRAS) {
      if (alvo === c || !this.humanoAtivo(alvo)) continue;
      if (alvo === parceiro) this.o.enviar(this.ocupantes[alvo].id!, 'sinal', { de: c, sinal });
      else if (this.rand() < (this.o.chanceInterceptarSinal ?? 0)) {
        this.o.enviar(this.ocupantes[alvo].id!, 'sinal', { de: c, sinal, interceptado: true });
      }
    }
  }

  fala(id: string, fala: unknown): void {
    const c = this.cadeiraDe(id);
    if (c === null || !this.estado || !ehFala(fala) || !this.podeMandar(c)) return;
    this.paraHumanos((destino) => this.o.enviar(destino, 'fala', { de: c, fala }));
  }

  // ---------- internos ----------

  private aplicar(acao: AcaoJogador, idHumano?: string): void {
    if (!this.estado) return;
    try {
      this.estado = reduce(this.estado, acao);
    } catch (e) {
      if (e instanceof ErroJogada) {
        if (idHumano) this.erro(idHumano, e.message);
        return;
      }
      throw e;
    }
    this.paraHumanos((destino) => this.o.enviar(destino, 'acao', { cadeira: acao.cadeira, tipo: acao.tipo }));
    this.atualizar();
  }

  private atualizar(): void {
    this.cancelarTimers();
    this.prazo = null;
    const s = this.estado;
    if (!s) {
      this.enviarEstados();
      return;
    }
    if (s.fase === 'fimPartida') {
      this.enviarEstados();
      if (!this.terminou) {
        this.terminou = true;
        this.o.aoTerminar?.(s);
      }
      return;
    }
    if (s.fase === 'aguardandoDistribuicao') {
      this.agendar(this.tempos.pausaMaoMs, () => this.distribuir());
      this.enviarEstados();
      return;
    }
    const agentes = quemDeveAgir(s);
    const humanos = agentes.filter((c) => this.humanoAtivo(c));
    for (const c of agentes) if (!this.humanoAtivo(c)) this.agendar(this.tempos.botMs, () => this.jogarBot(c));
    if (humanos.length > 0) {
      this.prazo = { cadeiras: humanos, ate: this.relogio.agora() + this.tempos.jogadaMs };
      this.agendar(this.tempos.jogadaMs, () => this.estourouTempo(humanos[0]));
    }
    this.enviarEstados();
  }

  private distribuir(): void {
    if (!this.estado) return;
    this.estado = reduce(this.estado, { tipo: 'distribuir', baralho: embaralhar(novoBaralho(), this.rand) });
    this.atualizar();
  }

  private jogarBot(c: Cadeira): void {
    const s = this.estado;
    if (!s) return;
    const escolhida = this.o.nivelBot === 'dificil' ? botDificil(visaoDoJogador(s, c), this.rand) : botFacil(s, c);
    this.aplicar(escolhida ?? jogadaAutomatica(s, c));
  }

  private estourouTempo(c: Cadeira): void {
    if (this.estado) this.aplicar(jogadaAutomatica(this.estado, c));
  }

  private enviarEstados(): void {
    const cadeiras = this.infoCadeiras();
    const s = this.estado;
    for (const c of CADEIRAS) {
      const o = this.ocupantes[c];
      if (!o.humano || !o.conectado || !o.id) continue;
      const msg: MsgEstado = {
        minhaCadeira: c,
        cadeiras,
        visao: s ? visaoDoJogador(s, c) : null,
        prazo: this.prazo,
        minhasAcoes: s ? acoesValidas(s, c) : [],
      };
      this.o.enviar(o.id, 'estado', msg);
    }
  }

  private infoCadeiras(): InfoCadeira[] {
    return this.ocupantes.map((o) => ({
      tipo: o.humano ? 'humano' : o.nome ? 'bot' : 'vazia',
      nome: o.nome,
      conectado: o.humano ? o.conectado : true,
    }));
  }

  private virarBot(c: Cadeira): void {
    this.ocupantes[c] = {
      id: null,
      nome: `Bot ${NOMES_BOT[this.bots++ % NOMES_BOT.length]}`,
      humano: false,
      conectado: true,
      ultimaMensagem: -Infinity,
    };
  }

  private humanoAtivo(c: Cadeira): boolean {
    const o = this.ocupantes[c];
    return o.humano && o.conectado && o.id !== null;
  }

  private humanosSentados(): number {
    return this.ocupantes.filter((o) => o.humano && o.id !== null).length;
  }

  private dono(): Cadeira | undefined {
    return ORDEM_SENTAR.find((c) => this.ocupantes[c].humano);
  }

  private podeMandar(c: Cadeira): boolean {
    const agora = this.relogio.agora();
    if (agora - this.ocupantes[c].ultimaMensagem < this.tempos.intervaloMensagemMs) return false;
    this.ocupantes[c].ultimaMensagem = agora;
    return true;
  }

  private paraHumanos(fn: (id: string) => void): void {
    for (const c of CADEIRAS) if (this.humanoAtivo(c)) fn(this.ocupantes[c].id!);
  }

  private erro(id: string, mensagem: string): void {
    this.o.enviar(id, 'erro', { mensagem });
  }

  private agendar(ms: number, fn: () => void): void {
    this.cancelamentos.push(this.relogio.agendar(ms, fn));
  }

  private cancelarTimers(): void {
    for (const cancelar of this.cancelamentos) cancelar();
    this.cancelamentos = [];
  }
}
```

**Step 5: Rodar e ver passar**

Run: `pnpm --filter @truco/server test; pnpm --filter @truco/server typecheck`
Expected: PASS.

**Step 6: Commit**

```powershell
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add -A
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "feat(server): Mesa com lobby, bots, timer e sinais"
```

---

### Task 5: `Mesa` — ações, visão e erros

**Files:**
- Test: `apps/server/test/mesa-acoes.test.ts`

**Step 1: Testes**

```ts
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { avancarAte, criarMesa } from './mesa-helpers';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function mesaComHumanoNaVez() {
  const t = criarMesa();
  t.mesa.sentar('a', 'Ana');
  avancarAte(() => !!t.estado('a')?.prazo?.cadeiras.includes(0));
  return t;
}

describe('ações', () => {
  test('distribui após a pausa e manda só a visão do próprio jogador', () => {
    const { mesa, estado } = criarMesa();
    mesa.sentar('a', 'Ana');
    avancarAte(() => !!estado('a')?.visao?.mao);
    const e = estado('a')!;
    expect(e.minhaCadeira).toBe(0);
    expect(e.visao!.cadeira).toBe(0);
    expect(JSON.stringify(e)).not.toContain('"maos"');
  });

  test('a cadeira enviada pelo cliente é ignorada', () => {
    const { mesa, de } = mesaComHumanoNaVez();
    mesa.acao('a', { tipo: 'jogar', cadeira: 1, indice: 0 });
    expect(de('a', 'erro')).toHaveLength(0);
    expect(de('a', 'acao').at(-1)).toEqual({ cadeira: 0, tipo: 'jogar' });
  });

  test('minhasAcoes lista as jogadas na sua vez', () => {
    const { estado } = mesaComHumanoNaVez();
    const acoes = estado('a')!.minhasAcoes;
    expect(acoes.some((a) => a.tipo === 'jogar')).toBe(true);
    expect(acoes.every((a) => a.cadeira === 0)).toBe(true);
  });

  test('cliente não pode distribuir', () => {
    const { mesa, de } = mesaComHumanoNaVez();
    mesa.acao('a', { tipo: 'distribuir', baralho: [] });
    expect(de('a', 'erro')).toEqual([{ mensagem: 'ação inválida' }]);
  });

  test('jogada fora da vez gera erro só para quem mandou', () => {
    const { mesa, de } = mesaComHumanoNaVez();
    mesa.acao('a', { tipo: 'jogar', indice: 0 });
    // Se `a` venceu a rodada a vez volta para ele; o timer dele acaba jogando e a vez passa.
    avancarAte(() => mesa.partida!.fase === 'jogando' && mesa.partida!.mao!.vez !== 0);
    mesa.acao('a', { tipo: 'jogar', indice: 0 });
    expect(de('a', 'erro')).toEqual([{ mensagem: 'não é sua vez' }]);
  });

  test('lixo não derruba a mesa', () => {
    const { mesa, de } = mesaComHumanoNaVez();
    for (const lixo of [null, 'x', 42, { tipo: 'jogar', indice: 'a' }, { tipo: 'hackear' }]) {
      expect(() => mesa.acao('a', lixo)).not.toThrow();
    }
    expect(de('a', 'erro')).toHaveLength(5);
  });

  test('id desconhecido é ignorado', () => {
    const { mesa, caixa } = mesaComHumanoNaVez();
    mesa.acao('intruso', { tipo: 'jogar', indice: 0 });
    expect(caixa.has('intruso')).toBe(false);
  });
});
```

> A mensagem `'não é sua vez'` vem de `jogar` no reducer da engine; se ela tiver sido alterada, use a mensagem atual.

**Step 2: Rodar**

Run: `pnpm --filter @truco/server test`
Expected: PASS (a implementação veio na Task 4). Para garantir que os testes testam algo, comente temporariamente a linha `cadeira: cad` em `Mesa.acao` e confirme que "a cadeira enviada pelo cliente é ignorada" **falha**; desfaça.

**Step 3: Commit**

```powershell
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add -A
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "test(server): ações, visão e erros da Mesa"
```

---

### Task 6: `Mesa` — tempo, bots, desconexão e fim de partida

**Files:**
- Test: `apps/server/test/mesa-tempo.test.ts`

**Step 1: Testes**

```ts
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { TEMPOS, avancarAte, criarMesa } from './mesa-helpers';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const minhaVez = (t: ReturnType<typeof criarMesa>) => !!t.estado('a')?.prazo?.cadeiras.includes(0);

describe('tempo e bots', () => {
  test('bots jogam sozinhos', () => {
    const t = criarMesa();
    t.mesa.sentar('a', 'Ana');
    avancarAte(() => t.de('a', 'acao').some((x) => x.cadeira !== 0));
  });

  test('prazo informa até quando', () => {
    const t = criarMesa();
    t.mesa.sentar('a', 'Ana');
    avancarAte(() => minhaVez(t));
    const restante = t.estado('a')!.prazo!.ate - Date.now();
    expect(restante).toBeLessThanOrEqual(TEMPOS.jogadaMs);
    expect(restante).toBeGreaterThan(TEMPOS.jogadaMs - 20);
  });

  test('tempo estourado: joga automaticamente por você', () => {
    const t = criarMesa();
    t.mesa.sentar('a', 'Ana');
    avancarAte(() => minhaVez(t));
    const antes = t.de('a', 'acao').length;
    vi.advanceTimersByTime(TEMPOS.jogadaMs);
    expect(t.de('a', 'acao')[antes]).toEqual({ cadeira: 0, tipo: 'jogar' });
  });

  test('desconectado: bot assume na hora e nada é enviado', () => {
    const t = criarMesa();
    t.mesa.sentar('a', 'Ana');
    avancarAte(() => minhaVez(t));
    const enviados = t.caixa.get('a')!.length;
    const cartasAntes = t.mesa.partida!.mao!.maos[0].length;
    t.mesa.desconectar('a');
    vi.advanceTimersByTime(TEMPOS.botMs);
    expect(t.caixa.get('a')!.length).toBe(enviados);
    const m = t.mesa.partida!.mao;
    // jogou por ele: ou a mão acabou (mao null durante a pausa) ou ele tem uma carta a menos
    expect(m === null || m.maos[0].length === cartasAntes - 1).toBe(true);
  });

  test('reconectar reenvia o estado', () => {
    const t = criarMesa();
    t.mesa.sentar('a', 'Ana');
    avancarAte(() => !!t.estado('a')?.visao?.mao);
    t.mesa.desconectar('a');
    const n = t.de('a', 'estado').length;
    t.mesa.reconectar('a');
    expect(t.de('a', 'estado').length).toBe(n + 1);
    expect(t.estado('a')!.cadeiras[0]).toMatchObject({ tipo: 'humano', conectado: true });
  });

  test('sair depois do início: bot permanente', () => {
    const t = criarMesa({ humanosEsperados: 2 });
    t.mesa.sentar('a', 'Ana');
    t.mesa.sentar('b', 'Bia');
    t.mesa.sair('b');
    expect(t.estado('a')!.cadeiras[2].tipo).toBe('bot');
    expect(t.mesa.cadeiraDe('b')).toBeNull();
  });

  test('partida inteira termina e chama aoTerminar uma vez', () => {
    const aoTerminar = vi.fn();
    const t = criarMesa({ aoTerminar });
    t.mesa.sentar('a', 'Ana');
    t.mesa.desconectar('a');
    avancarAte(() => aoTerminar.mock.calls.length > 0, 10, 5_000_000);
    t.mesa.reconectar('a');
    expect(aoTerminar).toHaveBeenCalledTimes(1);
    expect(t.estado('a')!.visao!.fase).toBe('fimPartida');
    expect(t.estado('a')!.visao!.vencedor).not.toBeNull();
  });

  test('bot difícil conduz uma mão inteira', () => {
    const t = criarMesa({ nivelBot: 'dificil' });
    t.mesa.sentar('a', 'Ana');
    t.mesa.desconectar('a');
    avancarAte(() => t.mesa.partida!.ultimaMao !== null, 10, 600_000);
  }, 60_000);
});
```

**Step 2: Rodar**

Run: `pnpm --filter @truco/server test`
Expected: PASS. Se algum teste falhar, investigue (@superpowers:systematic-debugging) antes de mexer na `Mesa`; não mude o código só para o teste passar sem entender o porquê.

**Step 3: Commit**

```powershell
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add -A
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "test(server): timer, bots, desconexão e fim de partida"
```

---

### Task 7: `Mesa` — sinais e falas

**Files:**
- Test: `apps/server/test/mesa-sinais.test.ts`

**Step 1: Testes**

```ts
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { TEMPOS, criarMesa } from './mesa-helpers';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** a=0, b=2 (parceiros), c=1, d=3 */
function mesaCheia(chanceInterceptarSinal = 0) {
  const t = criarMesa({ humanosEsperados: 4, chanceInterceptarSinal });
  for (const id of ['a', 'b', 'c', 'd']) t.mesa.sentar(id, id);
  return t;
}

describe('sinais', () => {
  test('só o parceiro vê', () => {
    const t = mesaCheia();
    t.mesa.sinal('a', 'zap');
    expect(t.de('b', 'sinal')).toEqual([{ de: 0, sinal: 'zap' }]);
    expect(t.de('c', 'sinal')).toEqual([]);
    expect(t.de('d', 'sinal')).toEqual([]);
    expect(t.de('a', 'sinal')).toEqual([]);
  });

  test('adversário pode interceptar', () => {
    const t = mesaCheia(1);
    t.mesa.sinal('a', 'copas');
    expect(t.de('c', 'sinal')).toEqual([{ de: 0, sinal: 'copas', interceptado: true }]);
    expect(t.de('d', 'sinal')).toEqual([{ de: 0, sinal: 'copas', interceptado: true }]);
  });

  test('sinal inválido é ignorado', () => {
    const t = mesaCheia();
    t.mesa.sinal('a', 'olhar feio');
    expect(t.de('b', 'sinal')).toEqual([]);
  });

  test('limite de frequência', () => {
    const t = mesaCheia();
    t.mesa.sinal('a', 'zap');
    t.mesa.sinal('a', 'tres');
    expect(t.de('b', 'sinal')).toHaveLength(1);
    vi.advanceTimersByTime(TEMPOS.intervaloMensagemMs);
    t.mesa.sinal('a', 'tres');
    expect(t.de('b', 'sinal')).toHaveLength(2);
  });
});

describe('falas', () => {
  test('todos ouvem', () => {
    const t = mesaCheia();
    t.mesa.fala('c', 'truco');
    for (const id of ['a', 'b', 'c', 'd']) expect(t.de(id, 'fala')).toEqual([{ de: 1, fala: 'truco' }]);
  });

  test('fala inválida é ignorada', () => {
    const t = mesaCheia();
    t.mesa.fala('c', '<script>');
    expect(t.de('a', 'fala')).toEqual([]);
  });
});
```

**Step 2: Rodar**

Run: `pnpm --filter @truco/server test`
Expected: PASS.

**Step 3: Commit**

```powershell
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add -A
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "test(server): sinais entre parceiros e falas"
```

---

### Task 8: `MesaRoom` (Colyseus) + servidor + teste de integração

**Files:**
- Create: `apps/server/src/MesaRoom.ts`, `apps/server/src/servidor.ts`, `apps/server/src/main.ts`
- Test: `apps/server/test/integracao.test.ts`

**Step 1: Teste que falha**

`apps/server/test/integracao.test.ts`
```ts
import { boot, type ColyseusTestServer } from '@colyseus/testing';
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import { MesaRoom } from '../src/MesaRoom';
import { criarServidor } from '../src/servidor';

let colyseus: ColyseusTestServer;

beforeAll(async () => {
  MesaRoom.tempos = { botMs: 20, pausaMaoMs: 50, jogadaMs: 2_000 };
  colyseus = await boot(criarServidor());
});
afterEach(async () => {
  await colyseus.cleanup();
});
afterAll(async () => {
  await colyseus.shutdown();
});

function coletor(room: { onMessage: (tipo: '*', cb: (tipo: string | number, payload: any) => void) => unknown }) {
  const msgs: Record<string, any[]> = {};
  room.onMessage('*', (tipo, payload) => {
    (msgs[String(tipo)] ??= []).push(payload);
  });
  return msgs;
}

async function esperar(cond: () => boolean, ms = 5_000) {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error('tempo esgotado esperando condição');
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe('MesaRoom', () => {
  test('humano entra, bots completam e só a própria visão chega', async () => {
    const sala = await colyseus.createRoom('mesa', { variante: 'mineiro', humanos: 1 });
    const cliente = await colyseus.connectTo(sala, { nome: 'Ana' });
    const msgs = coletor(cliente);
    await esperar(() => !!msgs.estado?.some((m) => m.visao?.mao));
    const ultimo = msgs.estado.at(-1);
    expect(ultimo.minhaCadeira).toBe(0);
    expect(ultimo.cadeiras.filter((c: any) => c.tipo === 'bot')).toHaveLength(3);
    expect(JSON.stringify(ultimo)).not.toContain('"maos"');
  });

  test('cliente não consegue distribuir', async () => {
    const sala = await colyseus.createRoom('mesa', { humanos: 1 });
    const cliente = await colyseus.connectTo(sala, { nome: 'Ana' });
    const msgs = coletor(cliente);
    cliente.send('acao', { tipo: 'distribuir', baralho: [] });
    await esperar(() => !!msgs.erro?.length);
    expect(msgs.erro[0]).toEqual({ mensagem: 'ação inválida' });
  });

  test('sala cheia recusa mais gente', async () => {
    const sala = await colyseus.createRoom('mesa', { humanos: 1 });
    await colyseus.connectTo(sala, { nome: 'Ana' });
    await expect(colyseus.connectTo(sala, { nome: 'Bia' })).rejects.toThrow();
  });

  test('dois humanos ficam parceiros', async () => {
    const sala = await colyseus.createRoom('mesa', { humanos: 2 });
    const a = await colyseus.connectTo(sala, { nome: 'Ana' });
    const ma = coletor(a);
    const b = await colyseus.connectTo(sala, { nome: 'Bia' });
    const mb = coletor(b);
    await esperar(() => !!ma.estado?.length && !!mb.estado?.length);
    expect(ma.estado.at(-1).minhaCadeira).toBe(0);
    expect(mb.estado.at(-1).minhaCadeira).toBe(2);
  });
});
```

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/server test`
Expected: FAIL — `Failed to load url ../src/MesaRoom`.

**Step 3: Implementação**

`apps/server/src/MesaRoom.ts`
```ts
import { type Client, Room } from '@colyseus/core';
import { randomInt } from 'node:crypto';
import { Mesa, type Tempos } from './mesa/Mesa';
import { opcoesDaSala } from './mesa/protocolo';

const randCripto = () => randomInt(0, 2 ** 32) / 2 ** 32;

export class MesaRoom extends Room {
  /** Sobrescrito nos testes para acelerar. */
  static tempos: Partial<Tempos> = {};

  private mesa!: Mesa;

  onCreate(options: unknown) {
    const { regras, humanos, nivelBot } = opcoesDaSala(options);
    this.maxClients = humanos;
    this.mesa = new Mesa({
      regras,
      nivelBot,
      humanosEsperados: humanos,
      tempos: MesaRoom.tempos,
      rand: randCripto,
      relogio: {
        agendar: (ms, fn) => {
          const d = this.clock.setTimeout(fn, ms);
          return () => d.clear();
        },
        agora: () => Date.now(),
      },
      enviar: (id, tipo, payload) => this.clients.get(id)?.send(tipo, payload),
      aoTerminar: () => {
        // Plano 4: registrar partida e Elo.
      },
    });

    this.onMessage('acao', (client, payload) => this.mesa.acao(client.sessionId, payload));
    this.onMessage('sinal', (client, payload) => this.mesa.sinal(client.sessionId, payload));
    this.onMessage('fala', (client, payload) => this.mesa.fala(client.sessionId, payload));
    this.onMessage('iniciar', (client) => this.mesa.iniciar(client.sessionId));
  }

  onJoin(client: Client, options?: { nome?: unknown }) {
    const nome = typeof options?.nome === 'string' ? options.nome : 'Jogador';
    if (this.mesa.sentar(client.sessionId, nome) === null) throw new Error('mesa cheia ou já iniciada');
    if (this.mesa.iniciada) void this.lock();
  }

  onDrop(client: Client) {
    this.mesa.desconectar(client.sessionId);
    this.allowReconnection(client, 60);
  }

  onReconnect(client: Client) {
    this.mesa.reconectar(client.sessionId);
  }

  onLeave(client: Client) {
    this.mesa.sair(client.sessionId);
  }

  onDispose() {
    this.mesa.dispose();
  }
}
```

`apps/server/src/servidor.ts`
```ts
import { defineRoom, defineServer } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { MesaRoom } from './MesaRoom';

export function criarServidor() {
  return defineServer({
    transport: new WebSocketTransport(),
    rooms: { mesa: defineRoom(MesaRoom) },
  });
}
```

`apps/server/src/main.ts`
```ts
import { criarServidor } from './servidor';

const porta = Number(process.env.PORT ?? 2567);
await criarServidor().listen(porta);
console.log(`truco: servidor ouvindo na porta ${porta}`);
```

> Notas Colyseus 0.18 (conferidas no código-fonte do pacote):
> - Sem `state`, a sala não sincroniza Schema; `connectTo` não espera estado inicial.
> - `this.clients.get(sessionId)` é a busca O(1) (o antigo `getById` está deprecado).
> - `onDrop` + `allowReconnection(client, segundos)` permite reconectar; `onLeave` só quando sai de vez.
> - `allowReconnection` devolve um Deferred que rejeita se o cliente nunca terminou de entrar — por isso não usamos `await` sem `catch`. Se aparecer `UnhandledPromiseRejection` nos testes, troque por `this.allowReconnection(client, 60).catch(() => {})`.
> - Se algum nome de API divergir na versão instalada, confira em `node_modules/@colyseus/core/build/Room.d.ts` e ajuste — **reporte cada ajuste**.

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/server test; pnpm --filter @truco/server typecheck`
Expected: PASS. O servidor de teste usa a porta 2568; se estiver ocupada, feche o processo que a usa.

**Step 5: Commit**

```powershell
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add -A
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "feat(server): MesaRoom no Colyseus e teste de integração"
```

---

### Task 9: Rodar de verdade + verificação final

**Files:**
- Modify: `package.json` (raiz) — script `"dev:server": "pnpm --filter @truco/server dev"`

**Step 1: Subir o servidor**

Run (em background): `pnpm dev:server`
Expected: log `truco: servidor ouvindo na porta 2567`.

**Step 2: Fumaça com o SDK** — crie um script temporário no scratchpad (não commitar):

```ts
// smoke.ts — rode com: pnpm --filter @truco/server exec tsx <caminho>/smoke.ts
import { ColyseusSDK } from '@colyseus/sdk';
const sdk = new ColyseusSDK('ws://127.0.0.1:2567');
const sala = await sdk.create('mesa', { variante: 'paulista', humanos: 1, nome: 'Teste' });
sala.onMessage('*', (tipo, p) => console.log(tipo, JSON.stringify(p).slice(0, 160)));
setTimeout(() => process.exit(0), 5_000);
```

Expected: mensagens `estado` chegando, com `visao.mao` após ~2 s e eventos `acao` dos bots.

Pare o servidor.

**Step 3: Tudo verde**

Run: `pnpm test; pnpm typecheck`
Expected: engine + server PASS; sem erros de tipo.

**Step 4: Commit**

```powershell
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add -A
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "chore: script dev:server"
```

---

## Pronto quando

- `pnpm test` e `pnpm typecheck` verdes na raiz.
- Benchmark: bot difícil vence o fácil em ≥ 60% (registrado no relatório).
- Servidor sobe localmente e uma sala de 1 humano + 3 bots joga sozinha.

## Fora deste plano

- Interface web (Plano 3) — consome `MsgEstado`, `acao`, `sinal`, `fala`, `erro`.
- Contas, Elo, matchmaking, mesas ranqueadas, lista de salas e deploy no Railway (Plano 4). `aoTerminar` já é o gancho para gravar resultado.
- Bots lendo sinais do parceiro (o bot difícil não usa sinais ainda).
