# Plano 1 — Monorepo + Engine de Regras

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Criar o monorepo e o pacote `@truco/engine`: regras puras de Truco Paulista e Mineiro (configuráveis), visão filtrada por jogador e bot fácil, tudo coberto por testes.

**Architecture:** Máquina de estados pura e determinística: `reduce(estado, acao) → novoEstado`, sem I/O e sem aleatoriedade interna (o baralho embaralhado entra pela ação `distribuir`). Ações inválidas lançam `ErroJogada`. `acoesValidas` enumera jogadas legais (usada por testes property-based e bots). `visaoDoJogador` remove informação oculta para envio ao cliente.

**Tech Stack:** Node ≥ 20, pnpm 9 (workspaces), TypeScript 5.6, Vitest 2, fast-check 3.

**Design de referência:** `docs/plans/2026-11-05-truco-design.md`

**Próximos planos (não fazem parte deste):** 2 — servidor Colyseus + bots na mesa; 3 — web React; 4 — contas, Elo, matchmaking, deploy Railway.

---

## Convenções

- Cadeiras `0..3`; dupla = `cadeira % 2` (0 e 2 vs 1 e 3). Parceiro = `(cadeira + 2) % 4`.
- Distribuição começa em `(pe + 1) % 4`; nos testes usamos `pe = 3` para que a cadeira 0 seja a primeira. Posição no baralho: `rodada*4 + cadeira` (cartas 0–11); vira na posição 12.
- Notação de carta nos testes: valor + inicial do naipe — `o` ouros, `e` espadas, `c` copas, `p` paus. Ex.: `4p` = zap no mineiro.
- Força: comuns `4=1 … 3=10`; manilhas `11..14` (♦ < ♠ < ♥ < ♣); carta coberta = `0`.
- Git neste drive exige safe.directory. Se `git` reclamar de "dubious ownership", rode uma vez:
  `git config --global --add safe.directory "D:/01 Projetos/Projetos/truco"`
- Todos os comandos rodam na raiz `D:\01 Projetos\Projetos\truco` (PowerShell).

---

### Task 1: Monorepo e pacote engine

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `.gitattributes`
- Create: `packages/engine/package.json`, `packages/engine/tsconfig.json`, `packages/engine/vitest.config.ts`
- Create: `packages/engine/src/index.ts`, `packages/engine/test/sanidade.test.ts`

**Step 1: Garantir pnpm**

Run: `corepack enable; pnpm -v`
Expected: versão `9.x` (se falhar: `npm i -g pnpm@9`).

**Step 2: Arquivos da raiz**

`package.json`
```json
{
  "name": "truco",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "scripts": {
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck"
  }
}
```

`pnpm-workspace.yaml`
```yaml
packages:
  - "packages/*"
  - "apps/*"
```

`tsconfig.base.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "lib": ["ES2022"],
    "types": ["node"]
  }
}
```

`.gitignore`
```
node_modules/
dist/
coverage/
*.log
.env
```

`.gitattributes`
```
* text=auto eol=lf
```

**Step 3: Pacote engine**

`packages/engine/package.json`
```json
{
  "name": "@truco/engine",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/node": "^20.16.0",
    "fast-check": "^3.22.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

`packages/engine/tsconfig.json`
```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "test", "vitest.config.ts"]
}
```

`packages/engine/vitest.config.ts`
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { include: ['test/**/*.test.ts'] } });
```

`packages/engine/src/index.ts`
```ts
export {};
```

`packages/engine/test/sanidade.test.ts`
```ts
import { expect, test } from 'vitest';

test('vitest roda', () => {
  expect(1 + 1).toBe(2);
});
```

**Step 4: Instalar e rodar**

Run: `pnpm install; pnpm test`
Expected: `1 passed`.

**Step 5: Commit**

```powershell
git add -A
git commit -m "chore: monorepo pnpm e pacote engine"
```

---

### Task 2: Cartas e RNG

**Files:**
- Create: `packages/engine/src/cartas.ts`, `packages/engine/src/rng.ts`
- Test: `packages/engine/test/cartas.test.ts`

**Step 1: Teste que falha**

```ts
import { describe, expect, test } from 'vitest';
import { idCarta, novoBaralho } from '../src/cartas';
import { embaralhar, mulberry32 } from '../src/rng';

describe('baralho', () => {
  test('tem 40 cartas únicas, sem 8, 9, 10', () => {
    const b = novoBaralho();
    expect(b).toHaveLength(40);
    expect(new Set(b.map(idCarta)).size).toBe(40);
    expect(b.some((c) => ['8', '9', '10'].includes(c.valor))).toBe(false);
  });

  test('idCarta usa valor + inicial do naipe', () => {
    expect(idCarta({ valor: '4', naipe: 'paus' })).toBe('4p');
    expect(idCarta({ valor: 'A', naipe: 'espadas' })).toBe('Ae');
  });
});

describe('rng', () => {
  test('embaralhar é determinístico por seed e preserva cartas', () => {
    const a = embaralhar(novoBaralho(), mulberry32(42)).map(idCarta);
    const b = embaralhar(novoBaralho(), mulberry32(42)).map(idCarta);
    const c = embaralhar(novoBaralho(), mulberry32(7)).map(idCarta);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect([...a].sort()).toEqual(novoBaralho().map(idCarta).sort());
  });
});
```

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/engine test`
Expected: FAIL — `Cannot find module '../src/cartas'`.

**Step 3: Implementação**

`packages/engine/src/cartas.ts`
```ts
export const NAIPES = ['ouros', 'espadas', 'copas', 'paus'] as const;
export type Naipe = (typeof NAIPES)[number];

/** Ordem de força das cartas comuns, da mais fraca para a mais forte. */
export const VALORES = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'] as const;
export type Valor = (typeof VALORES)[number];

export interface Carta {
  valor: Valor;
  naipe: Naipe;
}

export function novoBaralho(): Carta[] {
  const b: Carta[] = [];
  for (const valor of VALORES) for (const naipe of NAIPES) b.push({ valor, naipe });
  return b;
}

export function idCarta(c: Carta): string {
  return `${c.valor}${c.naipe[0]}`;
}
```

`packages/engine/src/rng.ts`
```ts
/** PRNG determinístico (para testes e simulações). O servidor usa seed de crypto. */
export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function embaralhar<T>(arr: readonly T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
```

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/engine test`
Expected: PASS.

**Step 5: Commit**

```powershell
git add -A
git commit -m "feat(engine): baralho e rng determinístico"
```

---

### Task 3: Regras de mesa e força das cartas

**Files:**
- Create: `packages/engine/src/regras.ts`, `packages/engine/src/forca.ts`
- Test: `packages/engine/test/forca.test.ts`

**Step 1: Teste que falha**

```ts
import { describe, expect, test } from 'vitest';
import type { Carta, Naipe, Valor } from '../src/cartas';
import { forca } from '../src/forca';

const N: Record<string, Naipe> = { o: 'ouros', e: 'espadas', c: 'copas', p: 'paus' };
const c = (s: string): Carta => ({ valor: s.slice(0, -1) as Valor, naipe: N[s.slice(-1)] });

describe('paulista (vira)', () => {
  test('vira 7 → manilha é Q, com ordem ♣ > ♥ > ♠ > ♦', () => {
    const vira = c('7o');
    expect(forca(c('Qp'), 'paulista', vira)).toBe(14);
    expect(forca(c('Qc'), 'paulista', vira)).toBe(13);
    expect(forca(c('Qe'), 'paulista', vira)).toBe(12);
    expect(forca(c('Qo'), 'paulista', vira)).toBe(11);
    expect(forca(c('3e'), 'paulista', vira)).toBe(10);
    expect(forca(c('4o'), 'paulista', vira)).toBe(1);
  });

  test('vira 3 → manilha volta para o 4', () => {
    expect(forca(c('4p'), 'paulista', c('3e'))).toBe(14);
    expect(forca(c('3p'), 'paulista', c('3e'))).toBe(10);
  });

  test('paulista sem vira é erro', () => {
    expect(() => forca(c('4p'), 'paulista', null)).toThrow();
  });
});

describe('mineiro (manilhas fixas)', () => {
  test('zap 4♣ > 7♥ > espadilha A♠ > 7♦', () => {
    expect(forca(c('4p'), 'mineiro', null)).toBe(14);
    expect(forca(c('7c'), 'mineiro', null)).toBe(13);
    expect(forca(c('Ae'), 'mineiro', null)).toBe(12);
    expect(forca(c('7o'), 'mineiro', null)).toBe(11);
  });

  test('demais cartas seguem a ordem comum', () => {
    expect(forca(c('7e'), 'mineiro', null)).toBe(4);
    expect(forca(c('Ac'), 'mineiro', null)).toBe(8);
    expect(forca(c('4o'), 'mineiro', null)).toBe(1);
    expect(forca(c('3o'), 'mineiro', null)).toBe(10);
  });
});
```

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/engine test`
Expected: FAIL — `Cannot find module '../src/forca'`.

**Step 3: Implementação**

`packages/engine/src/regras.ts`
```ts
export type Variante = 'paulista' | 'mineiro';
export type Pontuacao = '1-3-6-9-12' | '2-4-8-10-12';

export interface RegrasMesa {
  variante: Variante;
  pontuacao: Pontuacao;
  /** Dupla com 10 vê as cartas do parceiro e decide jogar ou correr. */
  maoDe10: boolean;
  /** Mão de ferro: todos jogam às cegas, sem truco. */
  maoDe11: 'off' | 'qualquerDupla' | 'onzeAOnze';
  familia: 'off' | 'aberta' | 'fechada';
}

/** Valor da mão por nível de aposta: [mão, truco, seis, nove, doze]. */
export const ESCADAS: Record<Pontuacao, readonly number[]> = {
  '1-3-6-9-12': [1, 3, 6, 9, 12],
  '2-4-8-10-12': [2, 4, 8, 10, 12],
};

export const NIVEL_MAXIMO = 4;
export const PONTOS_VITORIA = 12;

export const REGRAS_RANQUEADA: Record<Variante, RegrasMesa> = {
  paulista: {
    variante: 'paulista',
    pontuacao: '1-3-6-9-12',
    maoDe10: false,
    maoDe11: 'qualquerDupla',
    familia: 'off',
  },
  mineiro: {
    variante: 'mineiro',
    pontuacao: '2-4-8-10-12',
    maoDe10: true,
    maoDe11: 'off',
    familia: 'fechada',
  },
};
```

`packages/engine/src/forca.ts`
```ts
import { type Carta, idCarta, type Naipe, type Valor, VALORES } from './cartas';
import type { Variante } from './regras';

const ORDEM_NAIPE_MANILHA: Record<Naipe, number> = { ouros: 0, espadas: 1, copas: 2, paus: 3 };
const MANILHAS_MINEIRO: Record<string, number> = { '4p': 14, '7c': 13, Ae: 12, '7o': 11 };

export function valorManilhaPaulista(vira: Carta): Valor {
  const i = VALORES.indexOf(vira.valor);
  return VALORES[(i + 1) % VALORES.length];
}

export function forca(c: Carta, variante: Variante, vira: Carta | null): number {
  if (variante === 'mineiro') {
    const m = MANILHAS_MINEIRO[idCarta(c)];
    if (m) return m;
  } else {
    if (!vira) throw new Error('truco paulista exige vira');
    if (c.valor === valorManilhaPaulista(vira)) return 11 + ORDEM_NAIPE_MANILHA[c.naipe];
  }
  return VALORES.indexOf(c.valor) + 1;
}
```

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/engine test`
Expected: PASS.

**Step 5: Commit**

```powershell
git add -A
git commit -m "feat(engine): regras de mesa, escadas e força das manilhas"
```

---

### Task 4: Resolução de rodada e de mão (cangou)

**Files:**
- Create: `packages/engine/src/estado.ts`, `packages/engine/src/mao.ts`
- Test: `packages/engine/test/mao.test.ts`

**Step 1: Teste que falha**

```ts
import { describe, expect, test } from 'vitest';
import type { Jogada } from '../src/estado';
import { resolverRodada, vencedorMao } from '../src/mao';

const j = (cadeira: 0 | 1 | 2 | 3, forca: number): Jogada => ({
  cadeira,
  forca,
  coberta: forca === 0,
  carta: { valor: '4', naipe: 'ouros' },
});

describe('resolverRodada', () => {
  test('maior carta vence e começa a próxima', () => {
    expect(resolverRodada([j(0, 3), j(1, 9), j(2, 5), j(3, 2)])).toEqual({ resultado: 1, proximo: 1 });
  });
  test('empate entre duplas adversárias = cangou', () => {
    expect(resolverRodada([j(0, 9), j(1, 9), j(2, 1), j(3, 2)]).resultado).toBe('empate');
  });
  test('empate dentro da mesma dupla não é cangar', () => {
    expect(resolverRodada([j(0, 9), j(1, 3), j(2, 9), j(3, 2)])).toEqual({ resultado: 0, proximo: 0 });
  });
  test('todas cobertas = empate', () => {
    expect(resolverRodada([j(0, 0), j(1, 0), j(2, 0), j(3, 0)]).resultado).toBe('empate');
  });
});

describe('vencedorMao', () => {
  test.each([
    [[], 'continua'],
    [[0], 'continua'],
    [[0, 0], 0],
    [[0, 1], 'continua'],
    [[0, 1, 1], 1],
    [[0, 1, 'empate'], 0],
    [[0, 'empate'], 0],
    [['empate'], 'continua'],
    [['empate', 1], 1],
    [['empate', 'empate'], 'continua'],
    [['empate', 'empate', 0], 0],
    [['empate', 'empate', 'empate'], null],
  ] as const)('%j → %s', (rodadas, esperado) => {
    expect(vencedorMao([...rodadas])).toBe(esperado);
  });
});
```

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/engine test`
Expected: FAIL — módulos inexistentes.

**Step 3: Implementação**

`packages/engine/src/estado.ts`
```ts
import type { Carta } from './cartas';
import type { RegrasMesa } from './regras';

export type Cadeira = 0 | 1 | 2 | 3;
export type Dupla = 0 | 1;
export const duplaDe = (c: Cadeira): Dupla => (c % 2) as Dupla;
export const parceiroDe = (c: Cadeira): Cadeira => ((c + 2) % 4) as Cadeira;
export const proximaCadeira = (c: Cadeira): Cadeira => ((c + 1) % 4) as Cadeira;

export type Fase = 'aguardandoDistribuicao' | 'decisaoMao10' | 'jogando' | 'respondendoTruco' | 'fimPartida';
export type TipoMao = 'normal' | 'mao10' | 'mao11';
export type ResultadoRodada = Dupla | 'empate';

export interface Jogada {
  cadeira: Cadeira;
  carta: Carta;
  coberta: boolean;
  forca: number;
}

export interface EstadoMao {
  tipo: TipoMao;
  vira: Carta | null;
  maos: Carta[][];
  /** Jogadas da rodada em andamento. */
  mesa: Jogada[];
  /** Jogadas das rodadas já encerradas. */
  rodadasJogadas: Jogada[][];
  rodadas: ResultadoRodada[];
  vez: Cadeira;
  /** Índice em ESCADAS[pontuacao]: 0 = mão, 1 = truco, 2 = seis, 3 = nove, 4 = doze. */
  nivel: number;
  /** Dupla cuja aposta foi aceita por último; ela não pode aumentar de novo. */
  ultimoAumento: Dupla | null;
  trucoPendente: { dupla: Dupla; proposto: number } | null;
  duplaNoDez: Dupla | null;
}

export interface ResultadoMao {
  vencedor: Dupla | null;
  pontos: number;
  motivo: 'rodadas' | 'correu' | 'mao10Correu';
}

export interface EstadoPartida {
  regras: RegrasMesa;
  placar: [number, number];
  pe: Cadeira;
  fase: Fase;
  mao: EstadoMao | null;
  ultimaMao: ResultadoMao | null;
  /** Último pedido de família; cartas só aparecem na família aberta. */
  ultimaFamilia: { cadeira: Cadeira; cartas: Carta[] | null } | null;
  vencedor: Dupla | null;
}

export type Acao =
  | { tipo: 'distribuir'; baralho: Carta[] }
  | { tipo: 'jogar'; cadeira: Cadeira; indice: number; coberta?: boolean }
  | { tipo: 'truco'; cadeira: Cadeira }
  | { tipo: 'aceitar'; cadeira: Cadeira }
  | { tipo: 'correr'; cadeira: Cadeira }
  | { tipo: 'aumentar'; cadeira: Cadeira }
  | { tipo: 'familia'; cadeira: Cadeira }
  | { tipo: 'mao10'; cadeira: Cadeira; jogar: boolean };

export function novaPartida(regras: RegrasMesa, pe: Cadeira = 0): EstadoPartida {
  return {
    regras,
    placar: [0, 0],
    pe,
    fase: 'aguardandoDistribuicao',
    mao: null,
    ultimaMao: null,
    ultimaFamilia: null,
    vencedor: null,
  };
}
```

`packages/engine/src/mao.ts`
```ts
import { type Cadeira, type Dupla, duplaDe, type Jogada, type ResultadoRodada } from './estado';

export function resolverRodada(mesa: Jogada[]): { resultado: ResultadoRodada; proximo: Cadeira } {
  const max = Math.max(...mesa.map((j) => j.forca));
  const topo = mesa.filter((j) => j.forca === max);
  const duplas = new Set(topo.map((j) => duplaDe(j.cadeira)));
  if (max === 0 || duplas.size > 1) return { resultado: 'empate', proximo: topo[0].cadeira };
  return { resultado: duplaDe(topo[0].cadeira), proximo: topo[0].cadeira };
}

/** Dupla vencedora, null (todas empataram) ou 'continua'. */
export function vencedorMao(r: ResultadoRodada[]): Dupla | null | 'continua' {
  const vit = [0, 0];
  for (const x of r) if (x !== 'empate') vit[x]++;
  if (vit[0] >= 2) return 0;
  if (vit[1] >= 2) return 1;
  if (r.length === 0) return 'continua';

  if (r[0] === 'empate') {
    if (r.length >= 2 && r[1] !== 'empate') return r[1];
    if (r.length === 3) return r[2] === 'empate' ? null : r[2];
    return 'continua';
  }
  // 1ª rodada tem vencedor: quem fez a primeira leva em caso de cangar depois.
  if (r.length >= 2 && r[1] === 'empate') return r[0];
  if (r.length === 3) return r[2] === 'empate' ? r[0] : r[2];
  return 'continua';
}
```

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/engine test`
Expected: PASS.

**Step 5: Commit**

```powershell
git add -A
git commit -m "feat(engine): tipos de estado, resolução de rodada e regra do cangou"
```

---

### Task 5: Helpers de teste + distribuir

**Files:**
- Create: `packages/engine/test/helpers.ts`, `packages/engine/src/reducer.ts`
- Test: `packages/engine/test/distribuir.test.ts`

**Step 1: Helpers**

`packages/engine/test/helpers.ts`
```ts
import { type Carta, idCarta, type Naipe, novoBaralho, type Valor } from '../src/cartas';
import { type Cadeira, type EstadoPartida, novaPartida } from '../src/estado';
import { reduce } from '../src/reducer';
import type { RegrasMesa } from '../src/regras';

const N: Record<string, Naipe> = { o: 'ouros', e: 'espadas', c: 'copas', p: 'paus' };
export const c = (s: string): Carta => ({ valor: s.slice(0, -1) as Valor, naipe: N[s.slice(-1)] });

export const PAULISTA: RegrasMesa = {
  variante: 'paulista',
  pontuacao: '1-3-6-9-12',
  maoDe10: false,
  maoDe11: 'qualquerDupla',
  familia: 'off',
};
export const MINEIRO: RegrasMesa = {
  variante: 'mineiro',
  pontuacao: '2-4-8-10-12',
  maoDe10: true,
  maoDe11: 'off',
  familia: 'fechada',
};

/** Baralho que entrega `maos[cadeira]` com pe = 3 (cadeira 0 começa). */
export function baralhoCom(maos: string[][], vira?: string): Carta[] {
  const fixas: (Carta | undefined)[] = new Array(40).fill(undefined);
  maos.forEach((mao, cad) => mao.forEach((s, i) => (fixas[i * 4 + cad] = c(s))));
  if (vira) fixas[12] = c(vira);
  const usadas = new Set(fixas.filter((x): x is Carta => !!x).map(idCarta));
  const resto = novoBaralho().filter((x) => !usadas.has(idCarta(x)));
  return fixas.map((x) => x ?? resto.shift()!);
}

export function partida(regras: RegrasMesa, placar: [number, number] = [0, 0]): EstadoPartida {
  const s = novaPartida(regras, 3);
  s.placar = placar;
  return s;
}

export function distribuida(regras: RegrasMesa, maos: string[][], vira?: string, placar?: [number, number]) {
  return reduce(partida(regras, placar), { tipo: 'distribuir', baralho: baralhoCom(maos, vira) });
}

export function jogarSeq(s: EstadoPartida, seq: [Cadeira, number][]): EstadoPartida {
  return seq.reduce((acc, [cadeira, indice]) => reduce(acc, { tipo: 'jogar', cadeira, indice }), s);
}

/**
 * No mineiro a dupla 0 vence as duas primeiras rodadas jogando sempre o índice 0
 * (R1: zap 4p; R2: Jo da cadeira 2). No paulista use vira '5p' (manilha 6).
 */
export const MAOS_DUPLA0_VENCE = [
  ['4p', '5o', '6o'],
  ['3e', '5e', '6e'],
  ['Qo', 'Jo', 'Ko'],
  ['2e', '5c', '6c'],
];
```

**Step 2: Teste que falha**

`packages/engine/test/distribuir.test.ts`
```ts
import { describe, expect, test } from 'vitest';
import { idCarta } from '../src/cartas';
import { reduce } from '../src/reducer';
import { MAOS_DUPLA0_VENCE, MINEIRO, PAULISTA, baralhoCom, distribuida, partida } from './helpers';

describe('distribuir', () => {
  test('entrega 3 cartas por cadeira a partir de pe+1', () => {
    const s = distribuida(MINEIRO, MAOS_DUPLA0_VENCE);
    expect(s.fase).toBe('jogando');
    expect(s.mao!.maos.map((m) => m.map(idCarta))).toEqual(MAOS_DUPLA0_VENCE);
    expect(s.mao!.vez).toBe(0);
    expect(s.mao!.vira).toBeNull();
    expect(s.mao!.tipo).toBe('normal');
  });

  test('paulista revela a vira', () => {
    const s = distribuida(PAULISTA, MAOS_DUPLA0_VENCE, '5p');
    expect(idCarta(s.mao!.vira!)).toBe('5p');
  });

  test('não distribui fora de hora nem baralho incompleto', () => {
    const s = distribuida(MINEIRO, MAOS_DUPLA0_VENCE);
    expect(() => reduce(s, { tipo: 'distribuir', baralho: [] })).toThrow();
    expect(() => reduce(partida(MINEIRO), { tipo: 'distribuir', baralho: [] })).toThrow();
  });

  test('reduce não muta o estado de entrada', () => {
    const antes = partida(MINEIRO);
    const copia = structuredClone(antes);
    reduce(antes, { tipo: 'distribuir', baralho: baralhoCom(MAOS_DUPLA0_VENCE) });
    expect(antes).toEqual(copia);
  });
});
```

**Step 3: Rodar e ver falhar**

Run: `pnpm --filter @truco/engine test`
Expected: FAIL — `Cannot find module '../src/reducer'`.

**Step 4: Implementação**

`packages/engine/src/reducer.ts`
```ts
import type { Carta } from './cartas';
import {
  type Acao,
  type Cadeira,
  type Dupla,
  type EstadoMao,
  type EstadoPartida,
  type ResultadoMao,
  type TipoMao,
  proximaCadeira,
} from './estado';
import { ESCADAS, PONTOS_VITORIA } from './regras';

export class ErroJogada extends Error {}

function falha(msg: string): never {
  throw new ErroJogada(msg);
}

export function reduce(estado: EstadoPartida, acao: Acao): EstadoPartida {
  const s = structuredClone(estado);
  switch (acao.tipo) {
    case 'distribuir':
      distribuir(s, acao.baralho);
      break;
    default:
      falha(`ação desconhecida: ${(acao as Acao).tipo}`);
  }
  return s;
}

export function escada(s: EstadoPartida): readonly number[] {
  return ESCADAS[s.regras.pontuacao];
}

export function tipoDaMao(s: EstadoPartida): TipoMao {
  const [a, b] = s.placar;
  const { maoDe10, maoDe11 } = s.regras;
  if (maoDe11 === 'qualquerDupla' && (a === 11 || b === 11)) return 'mao11';
  if (maoDe11 === 'onzeAOnze' && a === 11 && b === 11) return 'mao11';
  if (maoDe10 && (a === 10) !== (b === 10)) return 'mao10';
  return 'normal';
}

function distribuir(s: EstadoPartida, baralho: Carta[]): void {
  if (s.fase !== 'aguardandoDistribuicao') falha('não é hora de distribuir');
  if (baralho.length !== 40) falha('baralho deve ter 40 cartas');

  const maos: Carta[][] = [[], [], [], []];
  let i = 0;
  for (let rodada = 0; rodada < 3; rodada++) {
    for (let k = 1; k <= 4; k++) maos[(s.pe + k) % 4].push(baralho[i++]);
  }
  const tipo = tipoDaMao(s);
  const mao: EstadoMao = {
    tipo,
    vira: s.regras.variante === 'paulista' ? baralho[12] : null,
    maos,
    mesa: [],
    rodadasJogadas: [],
    rodadas: [],
    vez: proximaCadeira(s.pe),
    nivel: 0,
    ultimoAumento: null,
    trucoPendente: null,
    duplaNoDez: tipo === 'mao10' ? (s.placar[0] === 10 ? 0 : 1) : null,
  };
  s.mao = mao;
  s.fase = tipo === 'mao10' ? 'decisaoMao10' : 'jogando';
}

export function finalizarMao(
  s: EstadoPartida,
  vencedor: Dupla | null,
  pontos: number,
  motivo: ResultadoMao['motivo'],
): void {
  if (vencedor !== null) s.placar[vencedor] += pontos;
  s.ultimaMao = { vencedor, pontos: vencedor === null ? 0 : pontos, motivo };
  s.mao = null;
  if (vencedor !== null && s.placar[vencedor] >= PONTOS_VITORIA) {
    s.vencedor = vencedor;
    s.fase = 'fimPartida';
    return;
  }
  s.pe = proximaCadeira(s.pe) as Cadeira;
  s.fase = 'aguardandoDistribuicao';
}
```

**Step 5: Rodar e ver passar**

Run: `pnpm --filter @truco/engine test`
Expected: PASS.

**Step 6: Commit**

```powershell
git add -A
git commit -m "feat(engine): reducer com distribuir e tipo da mão"
```

---

### Task 6: Jogar cartas, carta coberta e fim de mão

**Files:**
- Modify: `packages/engine/src/reducer.ts`
- Test: `packages/engine/test/jogar.test.ts`

**Step 1: Teste que falha**

```ts
import { describe, expect, test } from 'vitest';
import { ErroJogada, reduce } from '../src/reducer';
import { MAOS_DUPLA0_VENCE, MINEIRO, PAULISTA, distribuida, jogarSeq } from './helpers';

const RODADA: [0 | 1 | 2 | 3, number][] = [[0, 0], [1, 0], [2, 0], [3, 0]];

describe('jogar', () => {
  test('rodada completa passa a vez para quem venceu', () => {
    const s = jogarSeq(distribuida(MINEIRO, MAOS_DUPLA0_VENCE), RODADA);
    expect(s.mao!.rodadas).toEqual([0]);
    expect(s.mao!.vez).toBe(0);
    expect(s.mao!.mesa).toHaveLength(0);
    expect(s.mao!.rodadasJogadas[0]).toHaveLength(4);
  });

  test('duas rodadas da mesma dupla fecham a mão com o valor base (mineiro = 2)', () => {
    let s = distribuida(MINEIRO, MAOS_DUPLA0_VENCE);
    s = jogarSeq(s, [...RODADA, ...RODADA]);
    expect(s.placar).toEqual([2, 0]);
    expect(s.ultimaMao).toEqual({ vencedor: 0, pontos: 2, motivo: 'rodadas' });
    expect(s.fase).toBe('aguardandoDistribuicao');
    expect(s.mao).toBeNull();
    expect(s.pe).toBe(0);
  });

  test('paulista vale 1 no preset 1-3-6-9-12', () => {
    let s = distribuida(PAULISTA, MAOS_DUPLA0_VENCE, '5p'); // manilha = 6
    s = jogarSeq(s, [[0, 2], [1, 0], [2, 2], [3, 0]]); // 6o, 3e, Ko, 2e → dupla 0 (6o manilha)
    s = jogarSeq(s, [[0, 1], [1, 1], [2, 1], [3, 1]]); // 5o, 6e(manilha 12), Jo, 6c(manilha 14) → dupla 1
    s = jogarSeq(s, [[3, 0], [0, 0], [1, 0], [2, 0]]); // 5c, 4p, 5e, Qo(5) → dupla 0
    expect(s.placar).toEqual([1, 0]);
  });

  test('jogar fora da vez é erro', () => {
    const s = distribuida(MINEIRO, MAOS_DUPLA0_VENCE);
    expect(() => reduce(s, { tipo: 'jogar', cadeira: 1, indice: 0 })).toThrow(ErroJogada);
  });

  test('índice inválido é erro', () => {
    const s = distribuida(MINEIRO, MAOS_DUPLA0_VENCE);
    expect(() => reduce(s, { tipo: 'jogar', cadeira: 0, indice: 3 })).toThrow(ErroJogada);
  });

  test('carta coberta: proibida na 1ª rodada, vale 0 depois', () => {
    let s = distribuida(MINEIRO, MAOS_DUPLA0_VENCE);
    expect(() => reduce(s, { tipo: 'jogar', cadeira: 0, indice: 0, coberta: true })).toThrow(ErroJogada);
    s = jogarSeq(s, RODADA);
    s = reduce(s, { tipo: 'jogar', cadeira: 0, indice: 0, coberta: true });
    expect(s.mao!.mesa[0]).toMatchObject({ coberta: true, forca: 0 });
  });
});
```

> Verificação manual do teste paulista (vira 5p → manilha 6; ordem ♦11 ♠12 ♥13 ♣14):
> R1: 6o=11, 3e=10, Ko=7, 2e=9 → dupla 0, vez cad0. R2 (cad0 tem [4p,5o]): 5o=2, cad1 [5e,6e] → 6e=12, cad2 [Qo,Jo] → Jo=6, cad3 [5c,6c] → 6c=14 → dupla 1, vez cad3. R3: 5c=2, 4p=1, 5e=2, Qo=5 → dupla 0. Placar [1,0]. Ajuste os índices se mudar as mãos.

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/engine test`
Expected: FAIL — `ação desconhecida: jogar`.

**Step 3: Implementação** — em `reducer.ts`:

Adicione imports:
```ts
import { forca } from './forca';
import { resolverRodada, vencedorMao } from './mao';
```

Adicione o case no `switch`:
```ts
    case 'jogar':
      jogar(s, acao.cadeira, acao.indice, acao.coberta ?? false);
      break;
```

Adicione as funções:
```ts
function maoAtual(s: EstadoPartida): EstadoMao {
  if (!s.mao) falha('nenhuma mão em andamento');
  return s.mao;
}

function jogar(s: EstadoPartida, cadeira: Cadeira, indice: number, coberta: boolean): void {
  const m = maoAtual(s);
  if (s.fase !== 'jogando') falha('não é hora de jogar carta');
  if (m.vez !== cadeira) falha('não é sua vez');
  const mao = m.maos[cadeira];
  if (!Number.isInteger(indice) || indice < 0 || indice >= mao.length) falha('carta inválida');
  if (coberta && (m.rodadas.length === 0 || m.tipo === 'mao11')) falha('carta coberta só a partir da 2ª rodada');

  const [carta] = mao.splice(indice, 1);
  m.mesa.push({
    cadeira,
    carta,
    coberta,
    forca: coberta ? 0 : forca(carta, s.regras.variante, m.vira),
  });
  s.ultimaFamilia = null;

  if (m.mesa.length < 4) {
    m.vez = proximaCadeira(cadeira);
    return;
  }

  const { resultado, proximo } = resolverRodada(m.mesa);
  m.rodadas.push(resultado);
  m.rodadasJogadas.push(m.mesa);
  m.mesa = [];
  const v = vencedorMao(m.rodadas);
  if (v === 'continua') {
    m.vez = proximo;
    return;
  }
  finalizarMao(s, v, escada(s)[m.nivel], 'rodadas');
}
```

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/engine test`
Expected: PASS.

**Step 5: Commit**

```powershell
git add -A
git commit -m "feat(engine): jogar carta, carta coberta e fim de mão"
```

---

### Task 7: Truco — pedir, aceitar, correr, aumentar

**Files:**
- Modify: `packages/engine/src/reducer.ts`
- Test: `packages/engine/test/truco.test.ts`

**Step 1: Teste que falha**

```ts
import { describe, expect, test } from 'vitest';
import type { Acao } from '../src/estado';
import { ErroJogada, reduce } from '../src/reducer';
import { MAOS_DUPLA0_VENCE, MINEIRO, PAULISTA, distribuida, jogarSeq } from './helpers';

const seq = (s: ReturnType<typeof distribuida>, acoes: Acao[]) => acoes.reduce(reduce, s);
const base = () => distribuida(PAULISTA, MAOS_DUPLA0_VENCE, '5p');

describe('truco', () => {
  test('pedir pausa a mão; aceitar sobe para 3 e devolve a vez', () => {
    let s = reduce(base(), { tipo: 'truco', cadeira: 0 });
    expect(s.fase).toBe('respondendoTruco');
    expect(s.mao!.trucoPendente).toEqual({ dupla: 0, proposto: 1 });
    s = reduce(s, { tipo: 'aceitar', cadeira: 1 });
    expect(s.fase).toBe('jogando');
    expect(s.mao!.nivel).toBe(1);
    expect(s.mao!.vez).toBe(0);
  });

  test('correr do truco dá o valor anterior (1) a quem pediu', () => {
    const s = seq(base(), [{ tipo: 'truco', cadeira: 0 }, { tipo: 'correr', cadeira: 3 }]);
    expect(s.placar).toEqual([1, 0]);
    expect(s.ultimaMao!.motivo).toBe('correu');
  });

  test('aumentar para seis; correr do seis dá 3 a quem aumentou', () => {
    let s = seq(base(), [{ tipo: 'truco', cadeira: 0 }, { tipo: 'aumentar', cadeira: 1 }]);
    expect(s.mao!.nivel).toBe(1);
    expect(s.mao!.trucoPendente).toEqual({ dupla: 1, proposto: 2 });
    s = reduce(s, { tipo: 'correr', cadeira: 2 });
    expect(s.placar).toEqual([0, 3]);
  });

  test('escada vai até doze e para (mineiro: dupla 0 vence jogando índice 0)', () => {
    let s = seq(distribuida(MINEIRO, MAOS_DUPLA0_VENCE), [
      { tipo: 'truco', cadeira: 0 },
      { tipo: 'aumentar', cadeira: 1 },
      { tipo: 'aumentar', cadeira: 0 },
      { tipo: 'aumentar', cadeira: 1 },
    ]);
    expect(s.mao!.trucoPendente).toEqual({ dupla: 1, proposto: 4 });
    expect(() => reduce(s, { tipo: 'aumentar', cadeira: 0 })).toThrow(ErroJogada);
    s = reduce(s, { tipo: 'aceitar', cadeira: 2 });
    expect(s.mao!.nivel).toBe(4);
    s = jogarSeq(s, [[0, 0], [1, 0], [2, 0], [3, 0], [0, 0], [1, 0], [2, 0], [3, 0]]);
    expect(s.placar[0] + s.placar[1]).toBe(12);
    expect(s.fase).toBe('fimPartida');
  });

  test('no preset 2-4-8-10-12 truco aceito vale 4', () => {
    let s = distribuida(MINEIRO, MAOS_DUPLA0_VENCE);
    s = seq(s, [{ tipo: 'truco', cadeira: 0 }, { tipo: 'aceitar', cadeira: 1 }]);
    s = jogarSeq(s, [[0, 0], [1, 0], [2, 0], [3, 0], [0, 0], [1, 0], [2, 0], [3, 0]]);
    expect(s.placar).toEqual([4, 0]);
  });

  test('quem teve a aposta aceita não pode aumentar de novo', () => {
    const s = seq(base(), [{ tipo: 'truco', cadeira: 0 }, { tipo: 'aceitar', cadeira: 1 }]);
    expect(() => reduce(s, { tipo: 'truco', cadeira: 0 })).toThrow(ErroJogada);
  });

  test('truco fora da vez e resposta da própria dupla são erro', () => {
    expect(() => reduce(base(), { tipo: 'truco', cadeira: 1 })).toThrow(ErroJogada);
    const s = reduce(base(), { tipo: 'truco', cadeira: 0 });
    expect(() => reduce(s, { tipo: 'aceitar', cadeira: 2 })).toThrow(ErroJogada);
    expect(() => reduce(s, { tipo: 'jogar', cadeira: 0, indice: 0 })).toThrow(ErroJogada);
  });
});
```

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/engine test`
Expected: FAIL — `ação desconhecida: truco`.

**Step 3: Implementação** — em `reducer.ts`:

Import adicional: `duplaDe` de `./estado` e `NIVEL_MAXIMO` de `./regras`.

Cases:
```ts
    case 'truco':
      pedirTruco(s, acao.cadeira);
      break;
    case 'aceitar':
    case 'correr':
    case 'aumentar':
      responderTruco(s, acao.cadeira, acao.tipo);
      break;
```

Funções:
```ts
function pedirTruco(s: EstadoPartida, cadeira: Cadeira): void {
  const m = maoAtual(s);
  if (s.fase !== 'jogando') falha('não é hora de trucar');
  if (m.vez !== cadeira) falha('só pode trucar na sua vez');
  if (m.tipo !== 'normal') falha('não se truca nesta mão');
  const dupla = duplaDe(cadeira);
  if (m.ultimoAumento === dupla) falha('sua dupla não pode aumentar agora');
  if (m.nivel >= NIVEL_MAXIMO) falha('aposta já está no máximo');
  m.trucoPendente = { dupla, proposto: m.nivel + 1 };
  s.fase = 'respondendoTruco';
}

function responderTruco(s: EstadoPartida, cadeira: Cadeira, resposta: 'aceitar' | 'correr' | 'aumentar'): void {
  const m = maoAtual(s);
  const p = m.trucoPendente;
  if (s.fase !== 'respondendoTruco' || !p) falha('não há truco para responder');
  const dupla = duplaDe(cadeira);
  if (dupla === p.dupla) falha('quem pediu não responde');

  if (resposta === 'correr') {
    finalizarMao(s, p.dupla, escada(s)[m.nivel], 'correu');
    return;
  }
  if (resposta === 'aceitar') {
    m.nivel = p.proposto;
    m.ultimoAumento = p.dupla;
    m.trucoPendente = null;
    s.fase = 'jogando';
    return;
  }
  if (p.proposto >= NIVEL_MAXIMO) falha('aposta já está no máximo');
  m.nivel = p.proposto;
  m.trucoPendente = { dupla, proposto: p.proposto + 1 };
}
```

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/engine test`
Expected: PASS.

**Step 5: Commit**

```powershell
git add -A
git commit -m "feat(engine): truco com aceitar, correr e aumentar até doze"
```

---

### Task 8: Mão de 10 e mão de 11 (ferro)

**Files:**
- Modify: `packages/engine/src/reducer.ts`
- Test: `packages/engine/test/maos-especiais.test.ts`

**Step 1: Teste que falha**

```ts
import { describe, expect, test } from 'vitest';
import { ErroJogada, reduce } from '../src/reducer';
import { MAOS_DUPLA0_VENCE, MINEIRO, PAULISTA, distribuida, jogarSeq } from './helpers';

const DUAS_RODADAS: [0 | 1 | 2 | 3, number][] = [[0, 0], [1, 0], [2, 0], [3, 0], [0, 0], [1, 0], [2, 0], [3, 0]];

describe('mão de 10', () => {
  const s0 = () => distribuida(MINEIRO, MAOS_DUPLA0_VENCE, undefined, [10, 4]);

  test('dupla com 10 decide antes de jogar', () => {
    const s = s0();
    expect(s.mao!.tipo).toBe('mao10');
    expect(s.fase).toBe('decisaoMao10');
    expect(s.mao!.duplaNoDez).toBe(0);
    expect(() => reduce(s, { tipo: 'mao10', cadeira: 1, jogar: true })).toThrow(ErroJogada);
    expect(() => reduce(s, { tipo: 'jogar', cadeira: 0, indice: 0 })).toThrow(ErroJogada);
  });

  test('correr dá o valor base ao adversário', () => {
    const s = reduce(s0(), { tipo: 'mao10', cadeira: 2, jogar: false });
    expect(s.placar).toEqual([10, 6]);
    expect(s.ultimaMao!.motivo).toBe('mao10Correu');
  });

  test('jogar vale o truco (4 no mineiro), sem pedir truco', () => {
    let s = reduce(s0(), { tipo: 'mao10', cadeira: 0, jogar: true });
    expect(s.mao!.nivel).toBe(1);
    expect(() => reduce(s, { tipo: 'truco', cadeira: 0 })).toThrow(ErroJogada);
    s = jogarSeq(s, DUAS_RODADAS);
    expect(s.placar).toEqual([14, 4]);
    expect(s.fase).toBe('fimPartida');
    expect(s.vencedor).toBe(0);
  });

  test('as duas duplas com 10 = mão normal', () => {
    expect(distribuida(MINEIRO, MAOS_DUPLA0_VENCE, undefined, [10, 10]).mao!.tipo).toBe('normal');
  });
});

describe('mão de 11 (ferro)', () => {
  test('qualquer dupla com 11: sem truco e sem coberta', () => {
    let s = distribuida(PAULISTA, MAOS_DUPLA0_VENCE, '5p', [11, 3]);
    expect(s.mao!.tipo).toBe('mao11');
    expect(s.fase).toBe('jogando');
    expect(() => reduce(s, { tipo: 'truco', cadeira: 0 })).toThrow(ErroJogada);
    s = jogarSeq(s, [[0, 0], [1, 0], [2, 0], [3, 0]]);
    expect(() => reduce(s, { tipo: 'jogar', cadeira: s.mao!.vez, indice: 0, coberta: true })).toThrow(ErroJogada);
  });

  test('opção onzeAOnze só ativa no 11 a 11', () => {
    const regras = { ...PAULISTA, maoDe11: 'onzeAOnze' as const };
    expect(distribuida(regras, MAOS_DUPLA0_VENCE, '5p', [11, 3]).mao!.tipo).toBe('normal');
    expect(distribuida(regras, MAOS_DUPLA0_VENCE, '5p', [11, 11]).mao!.tipo).toBe('mao11');
  });

  test('maoDe11 off nunca ativa', () => {
    const regras = { ...PAULISTA, maoDe11: 'off' as const };
    expect(distribuida(regras, MAOS_DUPLA0_VENCE, '5p', [11, 11]).mao!.tipo).toBe('normal');
  });
});
```

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/engine test`
Expected: FAIL — `ação desconhecida: mao10` (os testes de mão de 11 já podem passar; tudo bem).

**Step 3: Implementação** — em `reducer.ts`:

Case:
```ts
    case 'mao10':
      decidirMao10(s, acao.cadeira, acao.jogar);
      break;
```

Função:
```ts
function decidirMao10(s: EstadoPartida, cadeira: Cadeira, jogarMao: boolean): void {
  const m = maoAtual(s);
  if (s.fase !== 'decisaoMao10') falha('não há mão de 10 para decidir');
  const dupla = duplaDe(cadeira);
  if (dupla !== m.duplaNoDez) falha('só a dupla com 10 decide');
  if (!jogarMao) {
    finalizarMao(s, (1 - dupla) as Dupla, escada(s)[0], 'mao10Correu');
    return;
  }
  m.nivel = 1;
  s.fase = 'jogando';
}
```

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/engine test`
Expected: PASS.

**Step 5: Commit**

```powershell
git add -A
git commit -m "feat(engine): mão de 10 e mão de 11 (ferro)"
```

---

### Task 9: Família (aberta / fechada)

**Files:**
- Create: `packages/engine/src/familia.ts`
- Modify: `packages/engine/src/reducer.ts`
- Test: `packages/engine/test/familia.test.ts`

**Step 1: Teste que falha**

```ts
import { describe, expect, test } from 'vitest';
import { idCarta } from '../src/cartas';
import { ehFamilia } from '../src/familia';
import { ErroJogada, reduce } from '../src/reducer';
import { MINEIRO, c, distribuida } from './helpers';

const MAOS = [
  ['Qo', 'Jo', 'Ae'],
  ['3e', '5e', '6e'],
  ['4p', '7c', 'Ko'],
  ['2e', '5c', '6c'],
];

describe('ehFamilia', () => {
  test('3 cartas só de Q, J, K, A', () => {
    expect(ehFamilia(['Qo', 'Jc', 'Kp'].map(c))).toBe(true);
    expect(ehFamilia(['Ao', 'Ac', 'Ae'].map(c))).toBe(true);
    expect(ehFamilia(['Qo', 'Jc', '3p'].map(c))).toBe(false);
    expect(ehFamilia(['Qo', 'Jc'].map(c))).toBe(false);
  });
});

describe('pedir família', () => {
  test('fechada: redistribui sem revelar as cartas, mesmo pé', () => {
    const s = reduce(distribuida(MINEIRO, MAOS), { tipo: 'familia', cadeira: 0 });
    expect(s.fase).toBe('aguardandoDistribuicao');
    expect(s.mao).toBeNull();
    expect(s.pe).toBe(3);
    expect(s.ultimaFamilia).toEqual({ cadeira: 0, cartas: null });
    expect(s.placar).toEqual([0, 0]);
  });

  test('aberta: revela as cartas', () => {
    const regras = { ...MINEIRO, familia: 'aberta' as const };
    const s = reduce(distribuida(regras, MAOS), { tipo: 'familia', cadeira: 0 });
    expect(s.ultimaFamilia!.cartas!.map(idCarta)).toEqual(['Qo', 'Jo', 'Ae']);
  });

  test('mão que não é família, depois da 1ª carta, ou com família desligada → erro', () => {
    const s = distribuida(MINEIRO, MAOS);
    expect(() => reduce(s, { tipo: 'familia', cadeira: 1 })).toThrow(ErroJogada);
    const depois = reduce(s, { tipo: 'jogar', cadeira: 0, indice: 2 });
    expect(() => reduce(depois, { tipo: 'familia', cadeira: 0 })).toThrow(ErroJogada);
    const off = distribuida({ ...MINEIRO, familia: 'off' }, MAOS);
    expect(() => reduce(off, { tipo: 'familia', cadeira: 0 })).toThrow(ErroJogada);
  });
});
```

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/engine test`
Expected: FAIL — `Cannot find module '../src/familia'`.

**Step 3: Implementação**

`packages/engine/src/familia.ts`
```ts
import type { Carta } from './cartas';

const FIGURAS = new Set(['Q', 'J', 'K', 'A']);

/** Família: 3 cartas só de Q, J, K, A (inclusive A♠, se o jogador quiser). */
export function ehFamilia(mao: Carta[]): boolean {
  return mao.length === 3 && mao.every((c) => FIGURAS.has(c.valor));
}
```

Em `reducer.ts` — import `ehFamilia` de `./familia`; case:
```ts
    case 'familia':
      pedirFamilia(s, acao.cadeira);
      break;
```

Função:
```ts
function pedirFamilia(s: EstadoPartida, cadeira: Cadeira): void {
  const m = maoAtual(s);
  if (s.regras.familia === 'off') falha('família desligada nesta mesa');
  if (s.fase !== 'jogando' || m.tipo !== 'normal') falha('não é hora de pedir família');
  if (m.rodadas.length > 0 || m.mesa.length > 0 || m.nivel > 0) falha('família só antes da 1ª carta');
  const mao = m.maos[cadeira];
  if (!ehFamilia(mao)) falha('isso não é família');
  s.ultimaFamilia = { cadeira, cartas: s.regras.familia === 'aberta' ? [...mao] : null };
  s.mao = null;
  s.fase = 'aguardandoDistribuicao';
}
```

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/engine test`
Expected: PASS.

**Step 5: Commit**

```powershell
git add -A
git commit -m "feat(engine): pedir família aberta ou fechada"
```

---

### Task 10: `acoesValidas` + testes property-based

**Files:**
- Create: `packages/engine/src/acoes.ts`
- Test: `packages/engine/test/propriedades.test.ts`

**Step 1: Teste que falha**

```ts
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { acoesValidas } from '../src/acoes';
import { type Carta, idCarta, novoBaralho } from '../src/cartas';
import { type EstadoPartida, novaPartida } from '../src/estado';
import { reduce } from '../src/reducer';
import type { RegrasMesa } from '../src/regras';
import { embaralhar, mulberry32 } from '../src/rng';
import { MINEIRO, PAULISTA, distribuida, MAOS_DUPLA0_VENCE } from './helpers';

const TODAS_REGRAS: RegrasMesa[] = [
  PAULISTA,
  MINEIRO,
  { ...PAULISTA, pontuacao: '2-4-8-10-12', maoDe10: true, familia: 'aberta' },
  { ...MINEIRO, pontuacao: '1-3-6-9-12', maoDe11: 'onzeAOnze', familia: 'off' },
];

function cartasEmJogo(s: EstadoPartida): Carta[] {
  const m = s.mao;
  if (!m) return [];
  return [
    ...m.maos.flat(),
    ...m.mesa.map((j) => j.carta),
    ...m.rodadasJogadas.flat().map((j) => j.carta),
    ...(m.vira ? [m.vira] : []),
  ];
}

describe('acoesValidas', () => {
  test('início da mão: só quem está na vez joga ou truca', () => {
    const acoes = acoesValidas(distribuida(PAULISTA, MAOS_DUPLA0_VENCE, '5p'));
    expect(acoes.every((a) => 'cadeira' in a && a.cadeira === 0)).toBe(true);
    expect(acoes.filter((a) => a.tipo === 'jogar')).toHaveLength(3);
    expect(acoes.some((a) => a.tipo === 'truco')).toBe(true);
  });
});

describe('propriedades: partidas aleatórias', () => {
  test('sempre terminam, sem cartas duplicadas e com placar monotônico', () => {
    fc.assert(
      fc.property(fc.integer(), fc.constantFrom(...TODAS_REGRAS), (seed, regras) => {
        const rand = mulberry32(seed);
        let s = novaPartida(regras);
        let passos = 0;
        while (s.fase !== 'fimPartida') {
          if (++passos > 5000) throw new Error('partida não terminou');
          if (s.fase === 'aguardandoDistribuicao') {
            s = reduce(s, { tipo: 'distribuir', baralho: embaralhar(novoBaralho(), rand) });
          } else {
            const acoes = acoesValidas(s);
            expect(acoes.length).toBeGreaterThan(0);
            const antes = [...s.placar];
            s = reduce(s, acoes[Math.floor(rand() * acoes.length)]);
            expect(s.placar[0]).toBeGreaterThanOrEqual(antes[0]);
            expect(s.placar[1]).toBeGreaterThanOrEqual(antes[1]);
          }
          const ids = cartasEmJogo(s).map(idCarta);
          expect(new Set(ids).size).toBe(ids.length);
        }
        expect(Math.max(...s.placar)).toBeGreaterThanOrEqual(12);
        expect(s.vencedor).not.toBeNull();
      }),
      { numRuns: 200 },
    );
  });
});
```

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/engine test`
Expected: FAIL — `Cannot find module '../src/acoes'`.

**Step 3: Implementação**

`packages/engine/src/acoes.ts`
```ts
import type { Acao, Cadeira, EstadoPartida } from './estado';
import { ErroJogada, reduce } from './reducer';

const CADEIRAS: Cadeira[] = [0, 1, 2, 3];

function candidatas(cadeira: Cadeira): Acao[] {
  return [
    { tipo: 'jogar', cadeira, indice: 0 },
    { tipo: 'jogar', cadeira, indice: 1 },
    { tipo: 'jogar', cadeira, indice: 2 },
    { tipo: 'jogar', cadeira, indice: 0, coberta: true },
    { tipo: 'jogar', cadeira, indice: 1, coberta: true },
    { tipo: 'jogar', cadeira, indice: 2, coberta: true },
    { tipo: 'truco', cadeira },
    { tipo: 'aceitar', cadeira },
    { tipo: 'correr', cadeira },
    { tipo: 'aumentar', cadeira },
    { tipo: 'familia', cadeira },
    { tipo: 'mao10', cadeira, jogar: true },
    { tipo: 'mao10', cadeira, jogar: false },
  ];
}

/** Todas as ações legais (exceto distribuir). Opcionalmente filtra por cadeira. */
export function acoesValidas(s: EstadoPartida, cadeira?: Cadeira): Acao[] {
  const cadeiras = cadeira === undefined ? CADEIRAS : [cadeira];
  return cadeiras.flatMap(candidatas).filter((a) => {
    try {
      reduce(s, a);
      return true;
    } catch (e) {
      if (e instanceof ErroJogada) return false;
      throw e;
    }
  });
}
```

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/engine test`
Expected: PASS. Se o property test falhar, o fast-check imprime a `seed` e o contra-exemplo mínimo — use @superpowers:systematic-debugging, escreva um teste unitário reproduzindo e corrija o reducer.

**Step 5: Commit**

```powershell
git add -A
git commit -m "feat(engine): acoesValidas e testes property-based"
```

---

### Task 11: Visão do jogador (informação oculta)

**Files:**
- Create: `packages/engine/src/visao.ts`
- Test: `packages/engine/test/visao.test.ts`

**Step 1: Teste que falha**

```ts
import { describe, expect, test } from 'vitest';
import { type Carta, idCarta } from '../src/cartas';
import type { Cadeira } from '../src/estado';
import { reduce } from '../src/reducer';
import { visaoDoJogador } from '../src/visao';
import { MAOS_DUPLA0_VENCE, MINEIRO, PAULISTA, distribuida, jogarSeq } from './helpers';

/** Coleta todo objeto com formato de carta dentro de um valor qualquer. */
function cartasDentro(x: unknown, out: string[] = []): string[] {
  if (Array.isArray(x)) x.forEach((y) => cartasDentro(y, out));
  else if (x && typeof x === 'object') {
    const o = x as Record<string, unknown>;
    if (typeof o.valor === 'string' && typeof o.naipe === 'string') out.push(idCarta(o as unknown as Carta));
    else Object.values(o).forEach((y) => cartasDentro(y, out));
  }
  return out;
}

describe('visaoDoJogador', () => {
  test('não vaza cartas dos outros', () => {
    const s = distribuida(MINEIRO, MAOS_DUPLA0_VENCE);
    for (const cad of [0, 1, 2, 3] as Cadeira[]) {
      const v = visaoDoJogador(s, cad);
      const vistas = cartasDentro(v);
      expect(vistas.sort()).toEqual([...MAOS_DUPLA0_VENCE[cad]].sort());
      expect(v.mao!.qtdCartas).toEqual([3, 3, 3, 3]);
    }
  });

  test('carta coberta só aparece para quem jogou', () => {
    let s = distribuida(MINEIRO, MAOS_DUPLA0_VENCE);
    s = jogarSeq(s, [[0, 0], [1, 0], [2, 0], [3, 0]]);
    s = reduce(s, { tipo: 'jogar', cadeira: 0, indice: 0, coberta: true });
    expect(visaoDoJogador(s, 1).mao!.mesa[0].carta).toBeNull();
    expect(idCarta(visaoDoJogador(s, 0).mao!.mesa[0].carta!)).toBe('5o');
  });

  test('mão de 10: dupla no dez vê o parceiro; adversário não', () => {
    const s = distribuida(MINEIRO, MAOS_DUPLA0_VENCE, undefined, [10, 0]);
    expect(visaoDoJogador(s, 0).mao!.maoParceiro!.map(idCarta)).toEqual(MAOS_DUPLA0_VENCE[2]);
    expect(visaoDoJogador(s, 1).mao!.maoParceiro).toBeNull();
  });

  test('mão de 11: ninguém vê a própria mão', () => {
    const s = distribuida(PAULISTA, MAOS_DUPLA0_VENCE, '5p', [11, 0]);
    expect(visaoDoJogador(s, 0).mao!.minhaMao).toEqual([null, null, null]);
  });
});
```

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/engine test`
Expected: FAIL — `Cannot find module '../src/visao'`.

**Step 3: Implementação**

`packages/engine/src/visao.ts`
```ts
import type { Carta } from './cartas';
import { type Cadeira, duplaDe, type EstadoMao, type EstadoPartida, type Jogada, parceiroDe } from './estado';

export type JogadaVisivel = Omit<Jogada, 'carta'> & { carta: Carta | null };

export interface VisaoMao extends Omit<EstadoMao, 'maos' | 'mesa' | 'rodadasJogadas'> {
  /** null = carta virada (mão de ferro). */
  minhaMao: (Carta | null)[];
  maoParceiro: Carta[] | null;
  qtdCartas: number[];
  mesa: JogadaVisivel[];
  rodadasJogadas: JogadaVisivel[][];
}

export interface Visao extends Omit<EstadoPartida, 'mao'> {
  cadeira: Cadeira;
  mao: VisaoMao | null;
}

export function visaoDoJogador(estado: EstadoPartida, cadeira: Cadeira): Visao {
  const s = structuredClone(estado);
  if (!s.mao) return { ...s, cadeira, mao: null };

  const { maos, mesa, rodadasJogadas, ...resto } = s.mao;
  const esconder = (j: Jogada): JogadaVisivel =>
    j.coberta && j.cadeira !== cadeira ? { ...j, carta: null } : j;
  const veParceiro = resto.tipo === 'mao10' && resto.duplaNoDez === duplaDe(cadeira);

  return {
    ...s,
    cadeira,
    mao: {
      ...resto,
      minhaMao: resto.tipo === 'mao11' ? maos[cadeira].map(() => null) : maos[cadeira],
      maoParceiro: veParceiro ? maos[parceiroDe(cadeira)] : null,
      qtdCartas: maos.map((m) => m.length),
      mesa: mesa.map(esconder),
      rodadasJogadas: rodadasJogadas.map((r) => r.map(esconder)),
    },
  };
}
```

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/engine test`
Expected: PASS.

**Step 5: Commit**

```powershell
git add -A
git commit -m "feat(engine): visão filtrada por jogador"
```

---

### Task 12: Bot fácil

**Files:**
- Create: `packages/engine/src/bots/facil.ts`
- Test: `packages/engine/test/bot-facil.test.ts`

**Step 1: Teste que falha**

```ts
import { describe, expect, test } from 'vitest';
import { acoesValidas } from '../src/acoes';
import { botFacil } from '../src/bots/facil';
import { novoBaralho } from '../src/cartas';
import { type Cadeira, novaPartida } from '../src/estado';
import { reduce } from '../src/reducer';
import { embaralhar, mulberry32 } from '../src/rng';
import { MAOS_DUPLA0_VENCE, MINEIRO, PAULISTA, distribuida } from './helpers';

describe('botFacil', () => {
  test('aceita truco com manilha, corre sem', () => {
    // mineiro: cad1 = [3e,5e,6e] sem manilha; cad3 = [2e,5c,6c] sem manilha
    const s = reduce(distribuida(MINEIRO, MAOS_DUPLA0_VENCE), { tipo: 'truco', cadeira: 0 });
    expect(botFacil(s, 1)).toEqual({ tipo: 'correr', cadeira: 1 });
    const s2 = reduce(
      distribuida(MINEIRO, [['3e', '5e', '6e'], ['4p', '5o', '6o'], ['Qo', 'Jo', 'Ko'], ['2e', '5c', '6c']]),
      { tipo: 'truco', cadeira: 0 },
    );
    expect(botFacil(s2, 1)).toEqual({ tipo: 'aceitar', cadeira: 1 });
  });

  test('não age fora da vez', () => {
    expect(botFacil(distribuida(MINEIRO, MAOS_DUPLA0_VENCE), 1)).toBeNull();
  });

  test('sempre devolve ação válida e 4 bots terminam a partida', () => {
    for (const regras of [PAULISTA, MINEIRO]) {
      const rand = mulberry32(123);
      let s = novaPartida(regras);
      for (let passos = 0; s.fase !== 'fimPartida'; passos++) {
        if (passos > 2000) throw new Error('não terminou');
        if (s.fase === 'aguardandoDistribuicao') {
          s = reduce(s, { tipo: 'distribuir', baralho: embaralhar(novoBaralho(), rand) });
          continue;
        }
        const acao = ([0, 1, 2, 3] as Cadeira[]).map((c) => botFacil(s, c)).find((a) => a !== null);
        expect(acao).toBeDefined();
        expect(acoesValidas(s)).toContainEqual(acao);
        s = reduce(s, acao!);
      }
      expect(s.vencedor).not.toBeNull();
    }
  });
});
```

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/engine test`
Expected: FAIL — `Cannot find module '../src/bots/facil'`.

**Step 3: Implementação**

`packages/engine/src/bots/facil.ts`
```ts
import type { Carta } from '../cartas';
import { type Acao, type Cadeira, duplaDe, type EstadoPartida, type Jogada, parceiroDe } from '../estado';
import { forca } from '../forca';

const MANILHA = 11;

/** Bot fácil: nunca truca; aceita com manilha; joga a menor carta que vence a mesa. */
export function botFacil(s: EstadoPartida, cadeira: Cadeira): Acao | null {
  const m = s.mao;
  if (!m) return null;
  const dupla = duplaDe(cadeira);
  const f = (c: Carta) => forca(c, s.regras.variante, m.vira);
  const minha = m.maos[cadeira];

  if (s.fase === 'respondendoTruco') {
    if (!m.trucoPendente || m.trucoPendente.dupla === dupla) return null;
    return { tipo: minha.some((c) => f(c) >= MANILHA) ? 'aceitar' : 'correr', cadeira };
  }

  if (s.fase === 'decisaoMao10') {
    if (m.duplaNoDez !== dupla) return null;
    const boa = [...minha, ...m.maos[parceiroDe(cadeira)]].some((c) => f(c) >= MANILHA);
    return { tipo: 'mao10', cadeira, jogar: boa };
  }

  if (s.fase !== 'jogando' || m.vez !== cadeira) return null;
  if (m.tipo === 'mao11') return { tipo: 'jogar', cadeira, indice: 0 };

  const ordenadas = minha.map((c, i) => ({ i, f: f(c) })).sort((a, b) => a.f - b.f);
  const melhor = m.mesa.reduce<Jogada | null>((b, j) => (!b || j.forca > b.forca ? j : b), null);
  if (melhor && duplaDe(melhor.cadeira) === dupla) return { tipo: 'jogar', cadeira, indice: ordenadas[0].i };
  const vence = ordenadas.find((x) => !melhor || x.f > melhor.forca);
  return { tipo: 'jogar', cadeira, indice: (vence ?? ordenadas[0]).i };
}
```

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/engine test`
Expected: PASS.

**Step 5: Commit**

```powershell
git add -A
git commit -m "feat(engine): bot fácil"
```

---

### Task 13: API pública e typecheck

**Files:**
- Modify: `packages/engine/src/index.ts`
- Delete: `packages/engine/test/sanidade.test.ts`
- Test: `packages/engine/test/api.test.ts`

**Step 1: Teste que falha**

```ts
import { expect, test } from 'vitest';
import * as engine from '../src';

test('API pública exporta o essencial', () => {
  for (const nome of [
    'novaPartida', 'reduce', 'ErroJogada', 'acoesValidas', 'visaoDoJogador', 'botFacil',
    'novoBaralho', 'embaralhar', 'mulberry32', 'forca', 'ehFamilia', 'ESCADAS', 'REGRAS_RANQUEADA',
  ]) {
    expect(engine).toHaveProperty(nome);
  }
});
```

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/engine test`
Expected: FAIL — propriedades ausentes.

**Step 3: Implementação**

`packages/engine/src/index.ts`
```ts
export * from './cartas';
export * from './rng';
export * from './regras';
export * from './forca';
export * from './estado';
export * from './mao';
export * from './familia';
export { reduce, ErroJogada, escada, tipoDaMao } from './reducer';
export * from './acoes';
export * from './visao';
export * from './bots/facil';
```

Remova `packages/engine/test/sanidade.test.ts`.

**Step 4: Rodar testes e typecheck**

Run: `pnpm test; pnpm typecheck`
Expected: todos os testes PASS; `tsc --noEmit` sem erros.

**Step 5: Commit**

```powershell
git add -A
git commit -m "feat(engine): API pública"
```

---

## Pronto quando

- `pnpm test` verde (inclui 200 partidas aleatórias em 4 configurações e partida completa entre 4 bots).
- `pnpm typecheck` sem erros.
- Engine sem nenhuma dependência de runtime.

## Fora deste plano (próximos)

- Bot difícil (amostragem Monte Carlo, blefe, sinais) — Plano 2, junto do servidor.
- Sinais/falas são eventos de mesa, não regra — Plano 2.
- Timer e jogada automática — Plano 2 (servidor).
