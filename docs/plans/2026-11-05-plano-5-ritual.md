# Plano 5 — Ritual da mão (monte, embaralhar, cortar, distribuir, família conferida)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Trocar o "servidor sorteia e distribui" pelo ritual de boteco: monte físico persistente entre mãos, o pé embaralha (riffle GSR com a sorte vinda do servidor) e passa para o da esquerda cortar (3 movimentos: cortar, embaralhar, abrir 3, dar 3, devolver), o pé escolhe como dar (por cima, por baixo, subindo alternado) e a família passa a trocar as cartas de quem pede — fechada pode ser blefe e a dupla adversária pode conferir (valor base da mão para quem acertou), aberta mostra e não pontua. Bots fazem todas as etapas, o tempo esgotado faz a etapa padrão, a web mostra o monte, as etapas, as famílias e anima tudo.

**Architecture:** O engine continua puro: a aleatoriedade entra como dado nas ações (`embaralhar.bits`, `cortar.ponto`), preenchida por `completarSorte(acao, estado, rand)` — só o servidor chama isso com o seu `rand` (CSPRNG). O estado ganha `monte` (índice 0 = topo), `ritual` (embaralhador, cortador, contagens, abertas, dadas) e, na mão, `familias`/`familiaPendente`/`abertasNoCorte`/`modo`/`pulada`; fases novas `aguardandoMonte`, `embaralhando`, `cortando`, `escolhendoDistribuicao`, `conferindoFamilia`. A ação de servidor `distribuir{baralho}` some e dá lugar a `monte{baralho}` (só na 1ª mão); `distribuir{modo}` vira ação do pé. `atalhos.ts` (`distribuirSemRitual`, `ritualMinimo`) deixa os testes antigos pularem o ritual com uma linha. A `Mesa` aplica toda ação com `completarSorte(semSorte(acao))`, ganha prazos por etapa e jogada automática em lote; a web lê `visao.ritual`/`qtdMonte`/`mao.familias` e anima a partir das mensagens `acao` (que agora levam modo/ordem/para/fração).

**Tech Stack:** TypeScript 5.6, Vitest 2.1 (+ fast-check 3.22 no engine), Colyseus 0.18 (`@colyseus/testing` na integração), React 18.3 + Testing Library, Web Animations API, Playwright 1.63.

**Design:** `docs/plans/2026-11-05-ritual-da-mao-design.md` (regras, decisões e tabela de fases). **Pré-requisitos:** Planos 1–4 concluídos e verdes.

---

## Restrições (valem para todas as tarefas)

- Drive D: é **exFAT** (sem symlinks): `.npmrc` com `node-linker=hoisted` — **mantenha**; nenhum pacote local entra via `workspace:*` (server/web resolvem `@truco/engine` e `@truco/protocolo` por alias).
- Git: **nunca** mude config. Sempre `git -c "safe.directory=D:/01 Projetos/Projetos/truco" ...`; commit **só** dos caminhos da tarefa com `git ... commit -m "<msg>" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- <caminhos>` (o segundo `-m` cria a linha em branco + a assinatura). Arquivos novos: `git ... add -- <caminhos>` antes. **Não faça push.**
- Vitest do server: `pool: 'threads'`; **todos** os testes de integração ficam em `apps/server/test/integracao.test.ts` (porta fixa 2568).
- Vitest do web: `pool: 'forks'` com `--no-experimental-webstorage` (já no `vite.config.ts`; não mexa).
- Comandos na raiz `D:\01 Projetos\Projetos\truco`. Filtrar: `pnpm --filter <pacote> test <trecho-do-arquivo>`.
- Arquivos em LF (`.gitattributes` força). Textos de UI em português do Brasil.

## Janela vermelha (leia antes de começar)

A Task 2 troca o formato do estado e das ações do engine. Server e web importam o engine por alias, então **ficam vermelhos** de propósito até as tarefas deles: o server volta ao verde na **Task 10** e o web na **Task 14** (a Task 13 já deixa verdes os testes de lógica que ela toca). Nas Tasks 2–8 rode só `pnpm --filter @truco/engine test` e `pnpm --filter @truco/engine typecheck`. Não "conserte" server/web antes da hora.

## Nomes reais usados (não invente outros)

Engine: `novaPartida`, `reduce`, `ErroJogada`, `ehAcaoJogador`, `escada`, `tipoDaMao`, `finalizarMao` (interno do reducer), `acoesValidas`, `todasAcoesValidas`, `visaoDoJogador`, `quemDeveAgir`, `amostrarMundo`, `botFacil`, `botDificil`, `ehFamilia`, `baralhoDaMesa`, `novoBaralho`, `idCarta`, `embaralhar`, `mulberry32`, `forca`, `FORCA_MANILHA_MIN`, `ESCADAS`, `PONTOS_VITORIA`, `REGRAS_RANQUEADA`, `duplaDe`, `parceiroDe`, `proximaCadeira`; tipos `EstadoPartida`, `EstadoMao`, `AcaoJogador`, `AcaoServidor`, `Acao`, `Visao`, `VisaoMao`, `VisaoResultadoMao`, `Jogada`, `JogadaVisivel`, `ResultadoMao`, `SituacaoVez`. Helpers de teste do engine (`packages/engine/test/helpers.ts`): `c`, `PAULISTA`, `MINEIRO`, `MINEIRO_LIMPA`, `baralhoCom`, `partida` (pe = 3), `distribuida`, `jogarSeq`, `MAOS_DUPLA0_VENCE`. Server: `Mesa`, `jogadaAutomatica`, `Tempos`, `TEMPOS_PADRAO`, `TEMPOS_RAPIDOS`, `temposDoAmbiente`, `msgDaAcao`, `MsgAcao`, `MsgEstado`, `RegistroMesa`, `contarAcao`; helpers `criarMesa`, `avancarAte`, `TEMPOS` (`apps/server/test/mesa-helpers.ts`). Web: `agruparAcoes`, `BotaoAcao`, `textoDaAcao`, `criarLoja`, `EstadoLoja`, `CentroMesa`, `TelaMesa`, `useAnimacaoJogadas`, `movimentoReduzido`, `posicaoRelativa`, `Posicao`; fixtures `distribuida`, `jogar`, `msgEstado`, `PAULISTA`, `MINEIRO`, `c`, `baralhoCom` (`apps/web/test/fixtures.ts`).

## Mapa das tarefas

| # | Pacote | Tarefa |
|---|---|---|
| 1 | engine | Funções puras do monte (`ritual.ts`) |
| 2 | engine | Estado, fases e ações do ritual + sorte + recolhimento + migração dos testes |
| 3 | engine | Visão do ritual e das famílias; `amostrarMundo` com monte |
| 4 | engine | Abrir 3 e dar 3 |
| 5 | engine | Família fechada/aberta, conferir, limite e pontos |
| 6 | engine | `acoesValidas` e `quemDeveAgir` nas fases novas |
| 7 | engine | Bots no ritual, na família e no conferir |
| 8 | engine | Propriedades: partidas inteiras com ritual aleatório |
| 9 | server | Protocolo (`MsgAcao`, `msgDaAcao`) e tempos novos |
| 10 | server | `Mesa`: sorte do servidor, monte inicial, prazos por etapa, tempo esgotado em lote |
| 11 | server | `Mesa`: janela de família dos bots, conferir, dicas; `RegistroMesa` |
| 12 | server | Integração do ritual pela sala real |
| 13 | web | Lógica: botões, textos, eventos, loja (`movimentos`), fixtures |
| 14 | web | Monte, famílias na mesa, centro e `TelaMesa` (+ CSS) |
| 15 | web | Animações do ritual (`useAnimacaoRitual`) |
| 16 | web | E2E existentes adaptados ao ritual |
| 17 | web | E2E novo: ritual com família fechada conferida |
| 18 | todos | Verificação final e atualização do design geral |

---

### Task 1: Engine — funções puras do monte

Riffle GSR, corte, limites do corte, ordem e modos de distribuição, conversão do baralho "roda a roda" antigo. Nada usa o estado ainda.

**Files:**
- Create: `packages/engine/src/ritual.ts`
- Modify: `packages/engine/src/index.ts`
- Test: `packages/engine/test/ritual-puro.test.ts`

**Step 1: Teste que falha**

`packages/engine/test/ritual-puro.test.ts`
```ts
import { describe, expect, test } from 'vitest';
import { cortarMonte, darCartas, limitesCorte, monteRodaARoda, ordemDistribuicao, riffle } from '../src/ritual';
import { mulberry32 } from '../src/rng';

const seq = (n: number) => Array.from({ length: n }, (_, i) => i);

describe('riffle (Gilbert–Shannon–Reeds com bits)', () => {
  test('bits todos 0 ou todos 1 não mexem no monte', () => {
    expect(riffle(seq(6), [0, 0, 0, 0, 0, 0])).toEqual(seq(6));
    expect(riffle(seq(6), [1, 1, 1, 1, 1, 1])).toEqual(seq(6));
  });

  test('os zeros dizem o tamanho do pacote de cima e por onde cada posição puxa', () => {
    // 2 zeros: pacote de cima [a, b], de baixo [c, d]
    expect(riffle(['a', 'b', 'c', 'd'], [0, 1, 0, 1])).toEqual(['a', 'c', 'b', 'd']);
    // 1 zero: pacote de cima [a], de baixo [b, c, d]
    expect(riffle(['a', 'b', 'c', 'd'], [1, 0, 1, 1])).toEqual(['b', 'a', 'c', 'd']);
  });

  test('sempre é uma permutação', () => {
    const rand = mulberry32(5);
    for (let k = 0; k < 50; k++) {
      const bits = seq(40).map(() => (rand() < 0.5 ? 0 : 1));
      expect([...riffle(seq(40), bits)].sort((x, y) => x - y)).toEqual(seq(40));
    }
  });

  test('distribuição GSR: com 3 cartas, a identidade sai em 4 das 8 sequências de bits', () => {
    let identidades = 0;
    for (let m = 0; m < 8; m++) {
      const bits = [(m >> 2) & 1, (m >> 1) & 1, m & 1];
      if (riffle(seq(3), bits).join() === '0,1,2') identidades++;
    }
    expect(identidades).toBe(4);
  });

  test('um bit por carta', () => {
    expect(() => riffle(seq(3), [0, 1])).toThrow(RangeError);
  });
});

describe('corte', () => {
  test('limites: de 30% a 70% do monte', () => {
    expect(limitesCorte(40)).toEqual([12, 28]);
    expect(limitesCorte(29)).toEqual([9, 20]);
    expect(limitesCorte(26)).toEqual([8, 18]);
  });

  test('a parte de baixo vai para cima', () => {
    expect(cortarMonte(['a', 'b', 'c', 'd', 'e'], 2)).toEqual(['c', 'd', 'e', 'a', 'b']);
  });
});

describe('distribuição', () => {
  test('ordem: a partir de pe + 1, pulando quem ganhou o "dar 3"', () => {
    expect(ordemDistribuicao(3, null)).toEqual([0, 1, 2, 3]);
    expect(ordemDistribuicao(0, 1)).toEqual([2, 3, 0]);
  });

  test('por cima: 3 de uma vez do topo; a vira é a próxima de cima', () => {
    const r = darCartas(seq(20), [0, 1, 2, 3], 'porCima', true);
    expect(r.maos).toEqual([[0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11]]);
    expect(r.vira).toBe(12);
    expect(r.resto).toEqual(seq(20).slice(13));
  });

  test('por baixo: 3 de uma vez do fundo; a vira é a próxima do fundo', () => {
    const r = darCartas(seq(20), [0, 1, 2, 3], 'porBaixo', true);
    expect(r.maos).toEqual([[19, 18, 17], [16, 15, 14], [13, 12, 11], [10, 9, 8]]);
    expect(r.vira).toBe(7);
    expect(r.resto).toEqual(seq(7));
  });

  test('subindo alternado: do fundo, 1 por vez, 3 voltas', () => {
    const r = darCartas(seq(20), [0, 1, 2, 3], 'subindo', false);
    expect(r.maos).toEqual([[19, 15, 11], [18, 14, 10], [17, 13, 9], [16, 12, 8]]);
    expect(r.vira).toBeNull();
    expect(r.resto).toEqual(seq(8));
  });

  test('quem ficou fora da ordem não recebe', () => {
    const r = darCartas(seq(20), [2, 3, 0], 'porCima', false);
    expect(r.maos).toEqual([[6, 7, 8], [], [0, 1, 2], [3, 4, 5]]);
  });
});

describe('monteRodaARoda', () => {
  test('o monte que, dado por cima, entrega as mesmas mãos da distribuição roda a roda antiga', () => {
    expect(monteRodaARoda(seq(16))).toEqual([0, 4, 8, 1, 5, 9, 2, 6, 10, 3, 7, 11, 12, 13, 14, 15]);
  });
});
```

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/engine test ritual-puro`
Expected: FAIL — `Failed to load url ../src/ritual`.

**Step 3: Implementação**

`packages/engine/src/ritual.ts`
```ts
import type { Cadeira } from './estado';

export type ModoDistribuicao = 'porCima' | 'porBaixo' | 'subindo';
export const MODOS_DISTRIBUICAO: readonly ModoDistribuicao[] = Object.freeze(['porCima', 'porBaixo', 'subindo'] as const);

/** Limite técnico de embaralhadas do pé por mão. */
export const LIMITE_EMBARALHADAS = 20;
/** Movimentos do cortador (cada corte ou embaralhada gasta 1; abrir/dar 3 gastam os 3). */
export const MOVIMENTOS_CORTE = 3;
/** Famílias fechadas por mão (o "abrir 3" do corte conta como uma). */
export const LIMITE_FAMILIAS_FECHADAS = 3;

/**
 * Riffle no modelo Gilbert–Shannon–Reeds, com a sorte em `bits` (um por carta, 0 ou 1):
 * o pacote de cima tem tantas cartas quantos zeros há; a posição i do resultado puxa a próxima
 * carta do pacote de cima se `bits[i]` = 0, senão do de baixo. Com bits uniformes isso é exatamente
 * o GSR (corte binomial + intercalação uniforme). Índice 0 = topo.
 */
export function riffle<T>(monte: readonly T[], bits: readonly number[]): T[] {
  if (bits.length !== monte.length) throw new RangeError('riffle: um bit por carta');
  let cima = 0;
  let baixo = bits.reduce((n, b) => n + (b === 0 ? 1 : 0), 0);
  return bits.map((b) => monte[b === 0 ? cima++ : baixo++]);
}

/** Menor e maior ponto de corte (30% a 70% do monte, ao menos 1 carta de cada lado). */
export function limitesCorte(n: number): [number, number] {
  const min = Math.max(1, Math.ceil(n * 0.3));
  const max = Math.max(min, Math.min(n - 1, Math.floor(n * 0.7)));
  return [min, max];
}

/** Corte normal: divide em `ponto` e a parte de baixo vai para cima. */
export function cortarMonte<T>(monte: readonly T[], ponto: number): T[] {
  return [...monte.slice(ponto), ...monte.slice(0, ponto)];
}

/** Quem recebe, na ordem: (pe+1), (pe+2), (pe+3), pe — sem quem ganhou o "dar 3". */
export function ordemDistribuicao(pe: Cadeira, pulada: Cadeira | null): Cadeira[] {
  return [1, 2, 3, 4].map((k) => ((pe + k) % 4) as Cadeira).filter((c) => c !== pulada);
}

export interface CartasDadas<T> {
  maos: T[][];
  vira: T | null;
  resto: T[];
}

/**
 * Distribui 3 cartas para cada cadeira de `ordem`. Por cima: 3 de uma vez do topo. Por baixo: 3 de
 * uma vez do fundo (a do fundo primeiro). Subindo: do fundo, 1 por vez, 3 voltas. A vira (se houver)
 * é a próxima carta na mesma direção.
 */
export function darCartas<T>(monte: readonly T[], ordem: readonly Cadeira[], modo: ModoDistribuicao, comVira: boolean): CartasDadas<T> {
  const resto = [...monte];
  const maos: T[][] = [[], [], [], []];
  const tirar = (): T => {
    const c = modo === 'porCima' ? resto.shift() : resto.pop();
    if (c === undefined) throw new Error('monte acabou na distribuição');
    return c;
  };
  if (modo === 'subindo') {
    for (let volta = 0; volta < 3; volta++) for (const c of ordem) maos[c].push(tirar());
  } else {
    for (const c of ordem) for (let i = 0; i < 3; i++) maos[c].push(tirar());
  }
  return { maos, vira: comVira ? tirar() : null, resto };
}

/**
 * Converte um baralho na ordem "roda a roda" de antes do ritual (1 carta por vez a partir de pe+1;
 * a 13ª era a vira) no monte que, dado por cima, entrega as mesmas mãos e a mesma vira.
 */
export function monteRodaARoda<T>(baralho: readonly T[]): T[] {
  const topo = [0, 1, 2, 3].flatMap((k) => [baralho[k], baralho[k + 4], baralho[k + 8]]);
  return [...topo, ...baralho.slice(12)];
}
```

Em `packages/engine/src/index.ts`, logo depois de `export * from './manilhas';`:
```ts
export * from './ritual';
```

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/engine test ritual-puro` → PASS. Run: `pnpm --filter @truco/engine test` → tudo PASS.

**Step 5: Commit**
```bash
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add -- packages/engine/src/ritual.ts packages/engine/test/ritual-puro.test.ts
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "feat(engine): riffle GSR, corte e modos de distribuição puros" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- packages/engine/src/ritual.ts packages/engine/src/index.ts packages/engine/test/ritual-puro.test.ts
```

---

### Task 2: Engine — estado, fases e ações do ritual; sorte; recolhimento; migração dos testes

O monte entra no estado; `distribuir{baralho}` some (vira `monte{baralho}` na 1ª mão); o pé embaralha/passa, o cortador corta/embaralha/devolve, o pé distribui nos 3 modos; no fim da mão as cartas voltam por cima do monte e o pé seguinte recomeça o ritual. A família ainda "redistribui" (recolhe e o mesmo pé refaz o ritual) — vira a regra nova na Task 5. Abrir 3 / dar 3 / conferir já têm tipo mas só ganham `reduce` nas Tasks 4 e 5. A visão já esconde o monte (o resto da visão do ritual é a Task 3).

**Files:**
- Modify: `packages/engine/src/estado.ts`, `packages/engine/src/reducer.ts`, `packages/engine/src/ritual.ts`, `packages/engine/src/visao.ts`, `packages/engine/src/bots/dificil.ts`, `packages/engine/src/index.ts`
- Create: `packages/engine/src/atalhos.ts`
- Test: `packages/engine/test/ritual.test.ts` (novo); migrar `helpers.ts`, `distribuir.test.ts`, `bot-facil.test.ts`, `bot-dificil.test.ts`, `extras.test.ts`, `mao-limpa.test.ts`, `referencias.test.ts`, `validacao.test.ts`, `propriedades.test.ts`, `api.test.ts`

**Step 1: Teste que falha**

`packages/engine/test/ritual.test.ts`
```ts
import { describe, expect, test } from 'vitest';
import { distribuirSemRitual, ritualMinimo } from '../src/atalhos';
import { type Carta, idCarta, novoBaralho } from '../src/cartas';
import { type EstadoPartida, novaPartida } from '../src/estado';
import { ErroJogada, reduce } from '../src/reducer';
import { cartasDaPartida, completarSorte, cortarMonte, limitesCorte, riffle, semSorte } from '../src/ritual';
import type { RegrasMesa } from '../src/regras';
import { mulberry32 } from '../src/rng';
import { MAOS_DUPLA0_VENCE, MINEIRO, PAULISTA, baralhoCom, distribuida, jogarSeq, partida } from './helpers';

const ids = (cs: readonly Carta[]) => cs.map(idCarta);
const B = novoBaralho().map(idCarta);
/** pe = 3: embaralhador 3, cortador 2 (à esquerda), parceiro do cortador 0. */
const comMonte = (regras: RegrasMesa = MINEIRO) => reduce(partida(regras), { tipo: 'monte', baralho: novoBaralho() });
const cortando = (regras: RegrasMesa = MINEIRO) => reduce(comMonte(regras), { tipo: 'passarCorte', cadeira: 3 });
const prontoPraDar = (regras: RegrasMesa = MINEIRO) => reduce(cortando(regras), { tipo: 'devolver', cadeira: 2 });
const zeros = (s: EstadoPartida) => s.monte.map(() => 0 as const);
const DUAS_RODADAS: [0 | 1 | 2 | 3, number][] = [[0, 0], [1, 0], [2, 0], [3, 0], [0, 0], [1, 0], [2, 0], [3, 0]];

describe('monte', () => {
  test('novaPartida espera o monte; o monte começa o ritual com o pé embaralhando', () => {
    const s0 = novaPartida(MINEIRO, 3);
    expect(s0.fase).toBe('aguardandoMonte');
    expect(s0.monte).toEqual([]);
    const s = comMonte();
    expect(s.fase).toBe('embaralhando');
    expect(ids(s.monte)).toEqual(B);
    expect(s.ritual).toEqual({ embaralhador: 3, cortador: 2, embaralhadas: 0, movimentos: 0, abertas: [], dadas: null });
  });

  test('só entra uma vez e é validado contra o baralho da mesa', () => {
    expect(() => reduce(comMonte(), { tipo: 'monte', baralho: novoBaralho() })).toThrow(ErroJogada);
    expect(() => reduce(partida(MINEIRO), { tipo: 'monte', baralho: novoBaralho().slice(1) })).toThrow(ErroJogada);
  });
});

describe('embaralhar e passar', () => {
  test('riffle com os bits do servidor, só o embaralhador, até 20 vezes', () => {
    const s = comMonte();
    const bits = s.monte.map((_, i) => (i % 2) as 0 | 1);
    const t = reduce(s, { tipo: 'embaralhar', cadeira: 3, bits });
    expect(ids(t.monte)).toEqual(ids(riffle(s.monte, bits)));
    expect(t.ritual!.embaralhadas).toBe(1);
    expect(() => reduce(s, { tipo: 'embaralhar', cadeira: 0, bits })).toThrow(ErroJogada);
    expect(() => reduce(s, { tipo: 'embaralhar', cadeira: 3 })).toThrow(/sorte/);
    expect(() => reduce(s, { tipo: 'embaralhar', cadeira: 3, bits: [0, 1] })).toThrow(ErroJogada);
    let u = s;
    for (let i = 0; i < 20; i++) u = reduce(u, { tipo: 'embaralhar', cadeira: 3, bits: zeros(u) });
    expect(() => reduce(u, { tipo: 'embaralhar', cadeira: 3, bits: zeros(u) })).toThrow(ErroJogada);
  });

  test('passar pra cortar: o monte vai para a esquerda do embaralhador', () => {
    const t = cortando();
    expect(t.fase).toBe('cortando');
    expect(() => reduce(comMonte(), { tipo: 'passarCorte', cadeira: 2 })).toThrow(ErroJogada);
    expect(() => reduce(t, { tipo: 'cortar', cadeira: 3, ponto: 20 })).toThrow(ErroJogada);
  });
});

describe('cortar', () => {
  test('ponto entre 30% e 70%; inverte as metades; cada movimento gasta 1; no 3º devolve sozinho', () => {
    const t = cortando();
    const [min, max] = limitesCorte(40);
    expect(() => reduce(t, { tipo: 'cortar', cadeira: 2, ponto: min - 1 })).toThrow(ErroJogada);
    expect(() => reduce(t, { tipo: 'cortar', cadeira: 2, ponto: max + 1 })).toThrow(ErroJogada);
    expect(() => reduce(t, { tipo: 'cortar', cadeira: 2 })).toThrow(/sorte/);
    const c1 = reduce(t, { tipo: 'cortar', cadeira: 2, ponto: 12 });
    expect(ids(c1.monte)).toEqual(ids(cortarMonte(t.monte, 12)));
    expect(c1.ritual!.movimentos).toBe(1);
    expect(c1.fase).toBe('cortando');
    const c2 = reduce(c1, { tipo: 'embaralhar', cadeira: 2, bits: zeros(c1) });
    expect(c2.ritual!.movimentos).toBe(2);
    expect(c2.ritual!.embaralhadas).toBe(0);
    const c3 = reduce(c2, { tipo: 'cortar', cadeira: 2, ponto: 20 });
    expect(c3.ritual!.movimentos).toBe(3);
    expect(c3.fase).toBe('escolhendoDistribuicao');
  });

  test('devolver antes dos 3 movimentos; só o cortador devolve', () => {
    expect(prontoPraDar().fase).toBe('escolhendoDistribuicao');
    expect(() => reduce(cortando(), { tipo: 'devolver', cadeira: 3 })).toThrow(ErroJogada);
  });
});

describe('distribuir', () => {
  test('por cima: 3 de uma vez a partir de pe + 1; a vira paulista é a próxima de cima', () => {
    const s = reduce(prontoPraDar(PAULISTA), { tipo: 'distribuir', cadeira: 3, modo: 'porCima' });
    expect(s.fase).toBe('jogando');
    expect(s.ritual).toBeNull();
    expect(s.mao!.maos.map(ids)).toEqual([B.slice(0, 3), B.slice(3, 6), B.slice(6, 9), B.slice(9, 12)]);
    expect(idCarta(s.mao!.vira!)).toBe(B[12]);
    expect(s.monte).toHaveLength(27);
    expect(s.mao!.vez).toBe(0);
    expect(s.mao!).toMatchObject({ modo: 'porCima', pulada: null, abertasNoCorte: [], familias: [], familiaPendente: null });
    expect(() => reduce(prontoPraDar(PAULISTA), { tipo: 'distribuir', cadeira: 2, modo: 'porCima' })).toThrow(ErroJogada);
  });

  test('por baixo e subindo tiram do fundo (a vira também)', () => {
    const baixo = reduce(prontoPraDar(PAULISTA), { tipo: 'distribuir', cadeira: 3, modo: 'porBaixo' });
    expect(baixo.mao!.maos.map(ids)).toEqual([
      [B[39], B[38], B[37]],
      [B[36], B[35], B[34]],
      [B[33], B[32], B[31]],
      [B[30], B[29], B[28]],
    ]);
    expect(idCarta(baixo.mao!.vira!)).toBe(B[27]);
    const sobe = reduce(prontoPraDar(PAULISTA), { tipo: 'distribuir', cadeira: 3, modo: 'subindo' });
    expect(sobe.mao!.maos.map(ids)).toEqual([
      [B[39], B[35], B[31]],
      [B[38], B[34], B[30]],
      [B[37], B[33], B[29]],
      [B[36], B[32], B[28]],
    ]);
    expect(ids(sobe.monte)).toEqual(B.slice(0, 27));
  });
});

describe('recolhimento', () => {
  test('no fim da mão as cartas voltam por cima do monte, na ordem, e o pé seguinte embaralha', () => {
    const base = baralhoCom(MAOS_DUPLA0_VENCE);
    const fim = jogarSeq(distribuida(MINEIRO, MAOS_DUPLA0_VENCE), DUAS_RODADAS);
    expect(fim.mao).toBeNull();
    expect(fim.placar).toEqual([2, 0]);
    expect(fim.fase).toBe('embaralhando');
    expect(fim.pe).toBe(0);
    expect(fim.ritual).toMatchObject({ embaralhador: 0, cortador: 3, embaralhadas: 0, movimentos: 0 });
    expect(ids(fim.monte)).toEqual([
      ...['4p', '3e', 'Qo', '2e', '5o', '5e', 'Jo', '5c'],
      ...['6o', '6e', 'Ko', '6c'],
      ...ids(base.slice(12)),
    ]);
  });

  test('quem correu: a rodada incompleta vem antes das mãos', () => {
    let s = jogarSeq(distribuida(MINEIRO, MAOS_DUPLA0_VENCE), [[0, 0]]);
    s = reduce(s, { tipo: 'truco', cadeira: 1 });
    s = reduce(s, { tipo: 'correr', cadeira: 0 });
    expect(ids(s.monte).slice(0, 12)).toEqual(['4p', '5o', '6o', '3e', '5e', '6e', 'Qo', 'Jo', 'Ko', '2e', '5c', '6c']);
    expect(cartasDaPartida(s)).toHaveLength(40);
  });
});

describe('sorte e atalhos', () => {
  test('completarSorte só usa o rand; semSorte tira; o resto passa igual', () => {
    const s = comMonte();
    const e = completarSorte({ tipo: 'embaralhar', cadeira: 3 }, s, mulberry32(1));
    expect(e.tipo === 'embaralhar' && e.bits!.length).toBe(40);
    expect(e.tipo === 'embaralhar' && e.bits!.every((b) => b === 0 || b === 1)).toBe(true);
    const k = completarSorte({ tipo: 'cortar', cadeira: 2 }, s, () => 0.999);
    expect(k).toEqual({ tipo: 'cortar', cadeira: 2, ponto: 28 });
    expect(semSorte(k)).toEqual({ tipo: 'cortar', cadeira: 2 });
    expect(semSorte(e)).toEqual({ tipo: 'embaralhar', cadeira: 3 });
    expect(completarSorte({ tipo: 'truco', cadeira: 0 }, s, Math.random)).toEqual({ tipo: 'truco', cadeira: 0 });
  });

  test('distribuirSemRitual mantém as mãos roda a roda dos testes antigos; ritualMinimo serve no meio da partida', () => {
    const s = distribuirSemRitual(partida(MINEIRO), baralhoCom(MAOS_DUPLA0_VENCE));
    expect(s.mao!.maos.map(ids)).toEqual(MAOS_DUPLA0_VENCE);
    const prox = ritualMinimo(jogarSeq(s, DUAS_RODADAS));
    expect(prox.fase).toBe('jogando');
    expect(prox.pe).toBe(0);
    expect(prox.mao!.vez).toBe(1);
    expect(() => ritualMinimo(prox)).toThrow();
  });
});
```

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/engine test ritual.test`
Expected: FAIL — `Failed to load url ../src/atalhos` (e tipos/fases inexistentes).

**Step 3: Implementação**

`packages/engine/src/estado.ts` (arquivo inteiro):
```ts
import type { Carta } from './cartas';
import type { RegrasMesa } from './regras';
import type { ModoDistribuicao } from './ritual';

export type Cadeira = 0 | 1 | 2 | 3;
export type Dupla = 0 | 1;
export const duplaDe = (c: Cadeira): Dupla => (c % 2) as Dupla;
export const parceiroDe = (c: Cadeira): Cadeira => ((c + 2) % 4) as Cadeira;
export const proximaCadeira = (c: Cadeira): Cadeira => ((c + 1) % 4) as Cadeira;

export type Fase =
  | 'aguardandoMonte'
  | 'embaralhando'
  | 'cortando'
  | 'escolhendoDistribuicao'
  | 'decisaoMao10'
  | 'jogando'
  | 'respondendoTruco'
  | 'conferindoFamilia'
  | 'fimPartida';

const FASES_RITUAL: readonly Fase[] = ['embaralhando', 'cortando', 'escolhendoDistribuicao'];
/** Embaralhar, cortar ou escolher como dar (o monte está na mão de alguém). */
export const ehFaseRitual = (f: Fase): boolean => FASES_RITUAL.includes(f);

export type TipoMao = 'normal' | 'mao10' | 'mao11';
export type ResultadoRodada = Dupla | 'empate';

export interface Jogada {
  cadeira: Cadeira;
  carta: Carta;
  coberta: boolean;
  forca: number;
}

export interface EstadoRitual {
  /** Quem embaralha e dá as cartas (= pe). */
  embaralhador: Cadeira;
  /** Quem corta: à esquerda do embaralhador, (pe + 3) % 4. */
  cortador: Cadeira;
  /** Riffles do embaralhador nesta mão. */
  embaralhadas: number;
  /** Movimentos já gastos pelo cortador (0..3). */
  movimentos: number;
  /** "Abrir 3": as 3 de cima, viradas para todos; saem desta mão. */
  abertas: Carta[];
  /** "Dar 3": as 3 de cima, fechadas, são a mão do parceiro do cortador. */
  dadas: { cadeira: Cadeira; cartas: Carta[] } | null;
}

export interface FamiliaPedida {
  cadeira: Cadeira;
  tipo: 'fechada' | 'aberta';
  /** As 3 cartas que quem pediu pôs na mesa (fechada pode ser blefe). */
  cartas: Carta[];
  /** null = ninguém conferiu (ainda, ou não vai mais). */
  conferida: { por: Cadeira; real: boolean } | null;
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
  /** Como o pé deu as cartas. */
  modo: ModoDistribuicao;
  /** Quem recebeu o "dar 3" e ficou fora da distribuição. */
  pulada: Cadeira | null;
  /** As 3 do "abrir 3" (contam como uma família fechada no limite). */
  abertasNoCorte: Carta[];
  /** Famílias pedidas nesta mão, na ordem. */
  familias: FamiliaPedida[];
  /** Índice em `familias` da fechada esperando a dupla adversária conferir. */
  familiaPendente: number | null;
}

export interface ResultadoMao {
  vencedor: Dupla | null;
  pontos: number;
  motivo: 'rodadas' | 'correu' | 'mao10Correu' | 'familia';
  /** Resultado de cada rodada encerrada. */
  rodadas: ResultadoRodada[];
  /**
   * Cartas jogadas na mão, por rodada. Se a mão acabou no meio de uma rodada
   * (correu), a última entrada é a rodada incompleta e não tem item em `rodadas`.
   */
  rodadasJogadas: Jogada[][];
  vira: Carta | null;
}

export interface EstadoPartida {
  regras: RegrasMesa;
  placar: [number, number];
  pe: Cadeira;
  fase: Fase;
  /** Monte físico (índice 0 = topo). Persiste entre mãos; ninguém vê a ordem. */
  monte: Carta[];
  /** Embaralhar/cortar/escolher como dar; null fora dessas fases. */
  ritual: EstadoRitual | null;
  mao: EstadoMao | null;
  ultimaMao: ResultadoMao | null;
  /** Último pedido de família; cartas só aparecem na família aberta. (Sai na Task 5.) */
  ultimaFamilia: { cadeira: Cadeira; cartas: Carta[] | null } | null;
  vencedor: Dupla | null;
}

/**
 * Ações que um jogador (humano ou bot) pode enviar. `bits` e `ponto` são a sorte do
 * servidor: quem decide manda sem, e só o servidor completa (ver `completarSorte`).
 */
export type AcaoJogador =
  | { tipo: 'jogar'; cadeira: Cadeira; indice: number; coberta?: boolean }
  | { tipo: 'truco'; cadeira: Cadeira }
  | { tipo: 'aceitar'; cadeira: Cadeira }
  | { tipo: 'correr'; cadeira: Cadeira }
  | { tipo: 'aumentar'; cadeira: Cadeira }
  | { tipo: 'familia'; cadeira: Cadeira }
  | { tipo: 'mao10'; cadeira: Cadeira; jogar: boolean }
  | { tipo: 'embaralhar'; cadeira: Cadeira; bits?: (0 | 1)[] }
  | { tipo: 'passarCorte'; cadeira: Cadeira }
  | { tipo: 'cortar'; cadeira: Cadeira; ponto?: number }
  | { tipo: 'abrir3'; cadeira: Cadeira }
  | { tipo: 'dar3'; cadeira: Cadeira }
  | { tipo: 'devolver'; cadeira: Cadeira }
  | { tipo: 'distribuir'; cadeira: Cadeira; modo: ModoDistribuicao }
  | { tipo: 'conferir'; cadeira: Cadeira; conferir: boolean };

/** Ações exclusivas do servidor; nunca aceite de um cliente. Só na 1ª mão da partida. */
export type AcaoServidor = { tipo: 'monte'; baralho: Carta[] };

export type Acao = AcaoJogador | AcaoServidor;

export function novaPartida(regras: RegrasMesa, pe: Cadeira = 0): EstadoPartida {
  return {
    regras: { ...regras },
    placar: [0, 0],
    pe,
    fase: 'aguardandoMonte',
    monte: [],
    ritual: null,
    mao: null,
    ultimaMao: null,
    ultimaFamilia: null,
    vencedor: null,
  };
}
```

Em `packages/engine/src/ritual.ts` troque o import do topo por
```ts
import type { Carta } from './cartas';
import type { AcaoJogador, Cadeira, EstadoMao, EstadoPartida } from './estado';
```
e acrescente ao fim:
```ts
/**
 * Ordem do recolhimento no fim da mão: jogadas na ordem em que saíram (a rodada incompleta por
 * último), mãos não jogadas (cadeiras 0→3), abertas do corte, famílias (na ordem dos pedidos), vira.
 * A primeira carta da lista vai para o topo do monte.
 */
export function recolher(m: Pick<EstadoMao, 'rodadasJogadas' | 'mesa' | 'maos' | 'abertasNoCorte' | 'familias' | 'vira'>): Carta[] {
  return [
    ...[...m.rodadasJogadas.flat(), ...m.mesa].map((j) => j.carta),
    ...m.maos.flat(),
    ...m.abertasNoCorte,
    ...m.familias.flatMap((f) => f.cartas),
    ...(m.vira ? [m.vira] : []),
  ];
}

/** Toda carta da partida, onde estiver (monte, ritual, mão). Server/teste: revela tudo. */
export function cartasDaPartida(s: Pick<EstadoPartida, 'monte' | 'ritual' | 'mao'>): Carta[] {
  const r = s.ritual;
  return [...s.monte, ...(r ? [...r.abertas, ...(r.dadas?.cartas ?? [])] : []), ...(s.mao ? recolher(s.mao) : [])];
}

/** Preenche a sorte (bits do riffle, ponto do corte) com `rand`. Só o servidor chama com o rand de verdade. */
export function completarSorte(a: AcaoJogador, s: Pick<EstadoPartida, 'monte'>, rand: () => number): AcaoJogador {
  if (a.tipo === 'embaralhar') return { ...a, bits: s.monte.map(() => (rand() < 0.5 ? 0 : 1)) };
  if (a.tipo === 'cortar') {
    const [min, max] = limitesCorte(s.monte.length);
    return { ...a, ponto: min + Math.floor(rand() * (max - min + 1)) };
  }
  return a;
}

/** Tira a sorte de uma ação (a de um cliente ou de um bot nunca conta). */
export function semSorte(a: AcaoJogador): AcaoJogador {
  if (a.tipo === 'embaralhar') {
    const { bits: _b, ...resto } = a;
    return resto;
  }
  if (a.tipo === 'cortar') {
    const { ponto: _p, ...resto } = a;
    return resto;
  }
  return a;
}
```

`packages/engine/src/reducer.ts` — imports novos (substituem os atuais):
```ts
import { baralhoDaMesa, type Carta, idCarta, NAIPES } from './cartas';
import {
  type Acao,
  type AcaoJogador,
  type Cadeira,
  type Dupla,
  type EstadoMao,
  type EstadoPartida,
  type EstadoRitual,
  type ResultadoMao,
  type TipoMao,
  duplaDe,
  proximaCadeira,
} from './estado';
import { ehFamilia } from './familia';
import { forca } from './forca';
import { resolverRodada, vencedorMao } from './mao';
import { ESCADAS, NIVEL_MAXIMO, PONTOS_VITORIA, type RegrasMesa } from './regras';
import {
  cortarMonte,
  darCartas,
  LIMITE_EMBARALHADAS,
  limitesCorte,
  type ModoDistribuicao,
  MODOS_DISTRIBUICAO,
  MOVIMENTOS_CORTE,
  ordemDistribuicao,
  recolher,
  riffle,
} from './ritual';
```
(`ErroJogada`, `falha`, `ehCadeira`, `validarAcao`, `idSeCarta`, `validarBaralho`, `escada`, `tipoDaMao`, `maoAtual`, `jogar`, `pedirTruco`, `responderTruco`, `decidirMao10` ficam como estão.)

`problemaDeFormato` inteiro:
```ts
function problemaDeFormato(x: unknown): string | null {
  if (typeof x !== 'object' || x === null) return 'ação malformada';
  const a = x as Record<string, unknown>;
  switch (a.tipo) {
    case 'monte':
      return Array.isArray(a.baralho) ? null : 'baralho malformado';
    case 'jogar':
      if (!ehCadeira(a.cadeira)) return 'cadeira inválida';
      if (!Number.isInteger(a.indice)) return 'índice inválido';
      if (a.coberta !== undefined && typeof a.coberta !== 'boolean') return 'coberta deve ser booleano';
      return null;
    case 'mao10':
      if (!ehCadeira(a.cadeira)) return 'cadeira inválida';
      return typeof a.jogar === 'boolean' ? null : 'jogar deve ser booleano';
    case 'embaralhar':
      if (!ehCadeira(a.cadeira)) return 'cadeira inválida';
      if (a.bits === undefined) return null;
      return Array.isArray(a.bits) && a.bits.every((b) => b === 0 || b === 1) ? null : 'bits do embaralho malformados';
    case 'cortar':
      if (!ehCadeira(a.cadeira)) return 'cadeira inválida';
      return a.ponto === undefined || Number.isInteger(a.ponto) ? null : 'ponto de corte inválido';
    case 'distribuir':
      if (!ehCadeira(a.cadeira)) return 'cadeira inválida';
      return (MODOS_DISTRIBUICAO as readonly unknown[]).includes(a.modo) ? null : 'modo de distribuir inválido';
    case 'conferir':
      if (!ehCadeira(a.cadeira)) return 'cadeira inválida';
      return typeof a.conferir === 'boolean' ? null : 'conferir deve ser booleano';
    case 'truco':
    case 'aceitar':
    case 'correr':
    case 'aumentar':
    case 'familia':
    case 'passarCorte':
    case 'abrir3':
    case 'dar3':
    case 'devolver':
      return ehCadeira(a.cadeira) ? null : 'cadeira inválida';
    default:
      return `ação desconhecida: ${String(a.tipo)}`;
  }
}
```

`ehAcaoJogador`:
```ts
/**
 * Verifica se uma mensagem crua (ex.: vinda de um cliente) é uma ação de jogador
 * bem formada. Rejeita `monte`, que só o servidor pode emitir. Não verifica
 * se a ação é legal no estado atual — isso é papel do `reduce`.
 */
export function ehAcaoJogador(x: unknown): x is AcaoJogador {
  return problemaDeFormato(x) === null && (x as Acao).tipo !== 'monte';
}
```

`reduce` inteiro:
```ts
export function reduce(estado: EstadoPartida, acao: Acao): EstadoPartida {
  validarAcao(acao);
  const s = structuredClone(estado);
  switch (acao.tipo) {
    case 'monte':
      porMonte(s, acao.baralho);
      break;
    case 'embaralhar':
      embaralharMonte(s, acao.cadeira, acao.bits);
      break;
    case 'passarCorte':
      passarCorte(s, acao.cadeira);
      break;
    case 'cortar':
      cortar(s, acao.cadeira, acao.ponto);
      break;
    case 'devolver':
      devolver(s, acao.cadeira);
      break;
    case 'distribuir':
      distribuir(s, acao.cadeira, acao.modo);
      break;
    case 'jogar':
      jogar(s, acao.cadeira, acao.indice, acao.coberta ?? false);
      break;
    case 'truco':
      pedirTruco(s, acao.cadeira);
      break;
    case 'aceitar':
    case 'correr':
    case 'aumentar':
      responderTruco(s, acao.cadeira, acao.tipo);
      break;
    case 'mao10':
      decidirMao10(s, acao.cadeira, acao.jogar);
      break;
    case 'familia':
      pedirFamilia(s, acao.cadeira);
      break;
    default:
      falha(`ação desconhecida: ${(acao as Acao).tipo}`);
  }
  return s;
}
```

Apague a função `distribuir(s, baralho)` antiga e ponha no lugar dela:
```ts
function novoRitual(pe: Cadeira): EstadoRitual {
  return { embaralhador: pe, cortador: ((pe + 3) % 4) as Cadeira, embaralhadas: 0, movimentos: 0, abertas: [], dadas: null };
}

function comecarRitual(s: EstadoPartida): void {
  s.ritual = novoRitual(s.pe);
  s.fase = 'embaralhando';
}

function ritualAtual(s: EstadoPartida): EstadoRitual {
  if (!s.ritual) falha('não há ritual em andamento');
  return s.ritual;
}

function porMonte(s: EstadoPartida, baralho: Carta[]): void {
  if (s.fase !== 'aguardandoMonte') falha('o monte já está na mesa');
  validarBaralho(baralho, s.regras);
  s.monte = baralho.map((c) => ({ ...c }));
  comecarRitual(s);
}

function gastarMovimento(s: EstadoPartida, r: EstadoRitual): void {
  r.movimentos++;
  if (r.movimentos >= MOVIMENTOS_CORTE) s.fase = 'escolhendoDistribuicao';
}

function embaralharMonte(s: EstadoPartida, cadeira: Cadeira, bits: (0 | 1)[] | undefined): void {
  const r = ritualAtual(s);
  if (s.fase !== 'embaralhando' && s.fase !== 'cortando') falha('não é hora de embaralhar');
  if (s.fase === 'embaralhando' && cadeira !== r.embaralhador) falha('só quem dá as cartas embaralha');
  if (s.fase === 'cortando' && cadeira !== r.cortador) falha('agora quem mexe no monte é quem corta');
  if (s.fase === 'embaralhando' && r.embaralhadas >= LIMITE_EMBARALHADAS) falha('já embaralhou demais');
  if (bits === undefined) falha('embaralhar precisa da sorte do servidor');
  if (bits.length !== s.monte.length) falha('sorte do embaralho com tamanho errado');
  s.monte = riffle(s.monte, bits);
  if (s.fase === 'embaralhando') r.embaralhadas++;
  else gastarMovimento(s, r);
}

function passarCorte(s: EstadoPartida, cadeira: Cadeira): void {
  const r = ritualAtual(s);
  if (s.fase !== 'embaralhando') falha('não é hora de passar pra cortar');
  if (cadeira !== r.embaralhador) falha('só quem embaralha passa o monte');
  s.fase = 'cortando';
}

function exigirCortador(s: EstadoPartida, cadeira: Cadeira): EstadoRitual {
  const r = ritualAtual(s);
  if (s.fase !== 'cortando') falha('não é hora de cortar');
  if (cadeira !== r.cortador) falha('não é você quem corta');
  return r;
}

function cortar(s: EstadoPartida, cadeira: Cadeira, ponto: number | undefined): void {
  const r = exigirCortador(s, cadeira);
  if (ponto === undefined) falha('cortar precisa da sorte do servidor');
  const [min, max] = limitesCorte(s.monte.length);
  if (!Number.isInteger(ponto) || ponto < min || ponto > max) falha('ponto de corte inválido');
  s.monte = cortarMonte(s.monte, ponto);
  gastarMovimento(s, r);
}

function devolver(s: EstadoPartida, cadeira: Cadeira): void {
  exigirCortador(s, cadeira);
  s.fase = 'escolhendoDistribuicao';
}

function distribuir(s: EstadoPartida, cadeira: Cadeira, modo: ModoDistribuicao): void {
  const r = ritualAtual(s);
  if (s.fase !== 'escolhendoDistribuicao') falha('não é hora de distribuir');
  if (cadeira !== r.embaralhador) falha('só quem embaralhou dá as cartas');
  const pulada = r.dadas?.cadeira ?? null;
  const dadas = darCartas(s.monte, ordemDistribuicao(s.pe, pulada), modo, s.regras.variante === 'paulista');
  if (r.dadas) dadas.maos[r.dadas.cadeira] = r.dadas.cartas;
  s.monte = dadas.resto;
  const tipo = tipoDaMao(s);
  const mao: EstadoMao = {
    tipo,
    vira: dadas.vira,
    maos: dadas.maos,
    mesa: [],
    rodadasJogadas: [],
    rodadas: [],
    vez: proximaCadeira(s.pe),
    nivel: 0,
    ultimoAumento: null,
    trucoPendente: null,
    duplaNoDez: tipo === 'mao10' ? (s.placar[0] === 10 ? 0 : 1) : null,
    modo,
    pulada,
    abertasNoCorte: r.abertas,
    familias: [],
    familiaPendente: null,
  };
  s.mao = mao;
  s.ritual = null;
  s.fase = tipo === 'mao10' ? 'decisaoMao10' : 'jogando';
}
```

`finalizarMao` inteiro:
```ts
export function finalizarMao(
  s: EstadoPartida,
  vencedor: Dupla | null,
  pontos: number,
  motivo: ResultadoMao['motivo'],
): void {
  const m = maoAtual(s);
  if (vencedor !== null) s.placar[vencedor] += pontos;
  s.ultimaMao = {
    vencedor,
    pontos: vencedor === null ? 0 : pontos,
    motivo,
    rodadas: m.rodadas,
    rodadasJogadas: m.mesa.length > 0 ? [...m.rodadasJogadas, m.mesa] : m.rodadasJogadas,
    vira: m.vira,
  };
  s.monte = [...recolher(m), ...s.monte];
  s.mao = null;
  if (vencedor !== null && s.placar[vencedor] >= PONTOS_VITORIA) {
    s.vencedor = vencedor;
    s.fase = 'fimPartida';
    return;
  }
  s.pe = proximaCadeira(s.pe);
  comecarRitual(s);
}
```

`pedirFamilia` — troque só as três últimas linhas (`s.ultimaFamilia = ...; s.mao = null; s.fase = 'aguardandoDistribuicao';`) por:
```ts
  s.ultimaFamilia = { cadeira, cartas: s.regras.familia === 'aberta' ? [...mao] : null };
  // Provisório (a Task 5 troca): a família ainda "redistribui" — tudo volta ao monte e o mesmo pé refaz o ritual.
  s.monte = [...recolher(m), ...s.monte];
  s.mao = null;
  comecarRitual(s);
```

`packages/engine/src/atalhos.ts`
```ts
import type { Carta } from './cartas';
import type { EstadoPartida } from './estado';
import { reduce } from './reducer';
import { monteRodaARoda } from './ritual';

/**
 * Testes e simulações: ritual mínimo — o pé passa sem embaralhar, o cortador devolve e as
 * cartas saem por cima. Exige a partida no começo do ritual (`embaralhando`).
 */
export function ritualMinimo(s: EstadoPartida): EstadoPartida {
  const r = s.ritual;
  if (s.fase !== 'embaralhando' || !r) throw new Error('ritualMinimo: a partida não está no começo do ritual');
  let t = reduce(s, { tipo: 'passarCorte', cadeira: r.embaralhador });
  t = reduce(t, { tipo: 'devolver', cadeira: r.cortador });
  return reduce(t, { tipo: 'distribuir', cadeira: r.embaralhador, modo: 'porCima' });
}

/**
 * Testes e simulações: põe o monte no começo da partida e distribui sem ritual. `baralho` vem na
 * ordem "roda a roda" de antes do ritual (ver `monteRodaARoda`): as mãos e a vira saem iguais.
 */
export function distribuirSemRitual(s: EstadoPartida, baralho: readonly Carta[]): EstadoPartida {
  return ritualMinimo(reduce(s, { tipo: 'monte', baralho: monteRodaARoda(baralho) }));
}
```

`packages/engine/src/index.ts`: depois de `export * from './ritual';` acrescente `export * from './atalhos';`.

`packages/engine/src/visao.ts` — o monte nunca vai para a visão (o resto da visão do ritual é a Task 3). Troque a interface `Visao` e o começo de `visaoDoJogador`:
```ts
export interface Visao extends Omit<EstadoPartida, 'mao' | 'ultimaMao' | 'monte'> {
  cadeira: Cadeira;
  mao: VisaoMao | null;
  ultimaMao: VisaoResultadoMao | null;
  /** Cartas no monte (a ordem ninguém vê). */
  qtdMonte: number;
}

export function visaoDoJogador(estado: EstadoPartida, cadeira: Cadeira): Visao {
  const { monte, ...s } = structuredClone(estado);
  const esconder = (j: Jogada): JogadaVisivel =>
    j.coberta && j.cadeira !== cadeira ? { ...j, carta: null } : j;
  const ultimaMao: VisaoResultadoMao | null = s.ultimaMao && {
    ...s.ultimaMao,
    rodadasJogadas: s.ultimaMao.rodadasJogadas.map((r) => r.map(esconder)),
  };
  if (!s.mao) return { ...s, cadeira, ultimaMao, qtdMonte: monte.length, mao: null };
```
e no `return` final acrescente `qtdMonte: monte.length,` logo depois da linha `ultimaMao,`.

`packages/engine/src/bots/dificil.ts` — no objeto devolvido por `amostrarMundo`, depois de `fase: v.fase,` ponha `monte: [], ritual: v.ritual,` (provisório: a Task 3 reconstrói o monte).

**Step 4: Migrar os testes antigos (uma linha cada; mesmas mãos)**

`packages/engine/test/helpers.ts` — imports novos: `import { distribuirSemRitual } from '../src/atalhos';`, `import { completarSorte } from '../src/ritual';`, `import { embaralhar } from '../src/rng';`. Troque `distribuida` e acrescente:
```ts
export function distribuida(regras: RegrasMesa, maos: string[][], vira?: string, placar?: [number, number]) {
  return distribuirSemRitual(partida(regras, placar), baralhoCom(maos, vira, baralhoDaMesa(regras)));
}

/** Ritual com um riffle e um corte sorteados por `rand` (partidas simuladas nos testes). */
export function ritualSorteado(s: EstadoPartida, rand: () => number): EstadoPartida {
  const r = s.ritual!;
  let t = reduce(s, completarSorte({ tipo: 'embaralhar', cadeira: r.embaralhador }, s, rand));
  t = reduce(t, { tipo: 'passarCorte', cadeira: r.embaralhador });
  t = reduce(t, completarSorte({ tipo: 'cortar', cadeira: r.cortador }, t, rand));
  t = reduce(t, { tipo: 'devolver', cadeira: r.cortador });
  return reduce(t, { tipo: 'distribuir', cadeira: r.embaralhador, modo: 'porCima' });
}

/** O que acontece sem jogador: monte sorteado no começo e ritual sorteado entre mãos; null se não é o caso. */
export function avancarSemJogadas(s: EstadoPartida, rand: () => number): EstadoPartida | null {
  if (s.fase === 'aguardandoMonte') return reduce(s, { tipo: 'monte', baralho: embaralhar(baralhoDaMesa(s.regras), rand) });
  if (s.fase === 'embaralhando') return ritualSorteado(s, rand);
  return null;
}
```

Troca mecânica de `distribuir{baralho}` por `monte{baralho}` nos testes de validação:
```bash
sed -i "s/tipo: 'distribuir', baralho/tipo: 'monte', baralho/g" packages/engine/test/validacao.test.ts packages/engine/test/mao-limpa.test.ts
```
Depois, à mão:
- `validacao.test.ts`: `describe('distribuir valida o baralho'` → `describe('monte valida o baralho'`; na tabela de "→ ErroJogada", `['distribuir sem baralho', { tipo: 'distribuir' }]` → `['monte sem baralho', { tipo: 'monte' }]` e acrescente `['distribuir sem modo', { tipo: 'distribuir', cadeira: 0 }]`, `['embaralhar com bit 2', { tipo: 'embaralhar', cadeira: 0, bits: [2] }]`, `['cortar com ponto fracionário', { tipo: 'cortar', cadeira: 0, ponto: 1.5 }]`, `['conferir sem booleano', { tipo: 'conferir', cadeira: 1 }]`. Em `describe('ehAcaoJogador')`, `test('rejeita distribuir'` → `test('rejeita monte'` com `expect(ehAcaoJogador({ tipo: 'monte', baralho: [] })).toBe(false)` e `expect(ehAcaoJogador({ tipo: 'monte', baralho: novoBaralho() })).toBe(false)`; em "aceita ações de jogador bem formadas" acrescente `expect(ehAcaoJogador({ tipo: 'distribuir', cadeira: 3, modo: 'subindo' })).toBe(true)` e `expect(ehAcaoJogador({ tipo: 'embaralhar', cadeira: 3 })).toBe(true)`.
- `mao-limpa.test.ts`: renomeie `describe('distribuir valida contra o baralho da mesa'` → `'o monte valida contra o baralho da mesa'`; o primeiro teste vira `const s = distribuirSemRitual(partida(MINEIRO_LIMPA), b);` (importe `distribuirSemRitual` de `'../src/atalhos'`); os de recusa já usam `monte` pelo `sed`. A linha do `amostrarMundo` (~113) vira `const s = distribuirSemRitual(partida(MINEIRO_LIMPA), embaralhar(baralhoDaMesa(MINEIRO_LIMPA), rand));`.
- `referencias.test.ts`: `const s = distribuirSemRitual(partida(PAULISTA), baralho);` (o comentário "1ª carta → cadeira 0" continua certo).
- `distribuir.test.ts`: os dois primeiros testes ficam; troque os dois últimos por:
```ts
  test('não distribui fora de hora nem põe o monte duas vezes', () => {
    const s = distribuida(MINEIRO, MAOS_DUPLA0_VENCE);
    expect(() => reduce(s, { tipo: 'monte', baralho: [] })).toThrow();
    expect(() => reduce(partida(MINEIRO), { tipo: 'monte', baralho: [] })).toThrow();
    expect(() => reduce(s, { tipo: 'distribuir', cadeira: 3, modo: 'porCima' })).toThrow();
  });

  test('reduce não muta o estado de entrada', () => {
    const antes = partida(MINEIRO);
    const copia = structuredClone(antes);
    reduce(antes, { tipo: 'monte', baralho: baralhoCom(MAOS_DUPLA0_VENCE) });
    expect(antes).toEqual(copia);
  });
```
- `extras.test.ts`, "rotação do pé": dentro do `for`, `s = reduce(s, { tipo: 'distribuir', baralho: embaralhar(novoBaralho(), rand) });` vira `s = s.fase === 'aguardandoMonte' ? distribuirSemRitual(s, embaralhar(novoBaralho(), rand)) : ritualSorteado(s, rand);`. Em "família mantém o mesmo pé", `s = reduce(s, { tipo: 'distribuir', baralho: baralhoCom(MAOS_DUPLA0_VENCE) });` vira `s = ritualMinimo(s);` (importe `distribuirSemRitual`/`ritualMinimo` de `'../src/atalhos'` e `ritualSorteado` de `'./helpers'`).
- `bot-facil.test.ts` (loop), `bot-dificil.test.ts` (loop de "quatro bots difíceis") e `propriedades.test.ts` (loop): o bloco `if (s.fase === 'aguardandoDistribuicao') { s = reduce(s, { tipo: 'distribuir', baralho: embaralhar(...) }); continue; }` vira
```ts
        const semJogada = avancarSemJogadas(s, rand);
        if (semJogada) {
          s = semJogada;
          continue;
        }
```
  (no `propriedades.test.ts` o `if/else` vira `const semJogada = avancarSemJogadas(s, rand); if (semJogada) s = semJogada; else { ...o bloco de ações como está... }`; importe `avancarSemJogadas` de `./helpers`). Em `bot-dificil.test.ts`, `estadoAleatorio`: `let s = distribuirSemRitual(novaPartida(regras), embaralhar(baralhoDaMesa(regras), rand));`.
- `api.test.ts`: acrescente à lista de nomes exportados `'riffle', 'completarSorte', 'semSorte', 'cartasDaPartida', 'distribuirSemRitual', 'ritualMinimo', 'ehFaseRitual'`.
- `vez.test.ts`, teste "sem mão (antes da distribuição, entre mãos ou fim): ninguém": continua passando nesta tarefa (a Task 6 muda a expectativa de "entre mãos").

**Step 5: Rodar e ver passar**

Run: `pnpm --filter @truco/engine test` → PASS (todos). Run: `pnpm --filter @truco/engine typecheck` → sem erros. (Server e web estão vermelhos de propósito.)

**Step 6: Commit**
```bash
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add -- packages/engine/src/atalhos.ts packages/engine/test/ritual.test.ts
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "feat(engine): monte persistente, embaralhar, cortar e distribuir nos 3 modos" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- packages/engine/src packages/engine/test
```

---
### Task 3: Engine — visão do ritual e das famílias; `amostrarMundo` com monte

Ninguém vê a ordem do monte nem as cartas do "dar 3"; todos veem as abertas do corte; família fechada é verso para os outros (o dono continua vendo as próprias), aberta e conferida são de todos. O bot difícil passa a reconstruir monte e famílias.

**Files:**
- Modify: `packages/engine/src/visao.ts`, `packages/engine/src/bots/dificil.ts`
- Test: `packages/engine/test/visao-ritual.test.ts`

**Step 1: Teste que falha**

`packages/engine/test/visao-ritual.test.ts`
```ts
import { describe, expect, test } from 'vitest';
import { amostrarMundo } from '../src/bots/dificil';
import { baralhoDaMesa, type Carta, idCarta, novoBaralho } from '../src/cartas';
import type { Cadeira, EstadoPartida } from '../src/estado';
import { reduce } from '../src/reducer';
import { cartasDaPartida } from '../src/ritual';
import { mulberry32 } from '../src/rng';
import { visaoDoJogador } from '../src/visao';
import { MINEIRO, distribuida, partida } from './helpers';

const CADEIRAS: Cadeira[] = [0, 1, 2, 3];
const ids = (cs: readonly Carta[]) => cs.map(idCarta);
const comMonte = () => reduce(partida(MINEIRO), { tipo: 'monte', baralho: novoBaralho() });

/** Mão com uma família fechada (cadeira 0) já na mesa — montada à mão: a ação vem na Task 5. */
function comFamiliaFechada(conferida: boolean): EstadoPartida {
  const s = distribuida(MINEIRO, [['Qo', 'Jo', 'Ae']]);
  const m = s.mao!;
  m.familias.push({ cadeira: 0, tipo: 'fechada', cartas: m.maos[0], conferida: conferida ? { por: 1, real: true } : null });
  m.maos[0] = s.monte.splice(0, 3);
  return s;
}

describe('visão do ritual', () => {
  test('ninguém vê o monte: só o tamanho; nenhuma carta aparece antes de dar', () => {
    for (const c of CADEIRAS) {
      const v = visaoDoJogador(comMonte(), c);
      expect('monte' in v).toBe(false);
      expect(v.qtdMonte).toBe(40);
      expect(v.ritual).toEqual({ embaralhador: 3, cortador: 2, embaralhadas: 0, movimentos: 0, abertas: [], dadas: null });
      expect(JSON.stringify(v)).not.toContain('"naipe"');
    }
  });

  test('dar 3: todos sabem quem recebe, ninguém vê as cartas', () => {
    const s = comMonte();
    s.fase = 'escolhendoDistribuicao';
    s.ritual!.dadas = { cadeira: 0, cartas: s.monte.splice(0, 3) };
    for (const c of CADEIRAS) {
      const v = visaoDoJogador(s, c);
      expect(v.ritual!.dadas).toBe(0);
      expect(JSON.stringify(v)).not.toContain('"naipe"');
    }
  });

  test('abrir 3: as abertas são de todos', () => {
    const s = comMonte();
    s.ritual!.abertas = s.monte.splice(0, 3);
    for (const c of CADEIRAS) expect(ids(visaoDoJogador(s, c).ritual!.abertas)).toEqual(['4o', '4e', '4c']);
  });
});

describe('visão das famílias', () => {
  test('fechada: 3 versos para os outros; o dono vê as próprias', () => {
    const s = comFamiliaFechada(false);
    expect(ids(visaoDoJogador(s, 0).mao!.familias[0].cartas!)).toEqual(['Qo', 'Jo', 'Ae']);
    for (const c of [1, 2, 3] as Cadeira[]) expect(visaoDoJogador(s, c).mao!.familias[0].cartas).toBeNull();
  });

  test('conferida (ou aberta): todos veem', () => {
    const s = comFamiliaFechada(true);
    for (const c of CADEIRAS) expect(ids(visaoDoJogador(s, c).mao!.familias[0].cartas!)).toEqual(['Qo', 'Jo', 'Ae']);
    const a = comFamiliaFechada(false);
    a.mao!.familias[0].tipo = 'aberta';
    expect(visaoDoJogador(a, 2).mao!.familias[0].cartas).not.toBeNull();
  });
});

describe('amostrarMundo com monte e famílias', () => {
  test('o mundo sorteado é coerente: mesma visão, mesmo tamanho de monte, 40 cartas sem repetir', () => {
    const s = comFamiliaFechada(false);
    const doBaralho = new Set(ids(baralhoDaMesa(MINEIRO)));
    for (let seed = 1; seed <= 20; seed++) {
      for (const c of CADEIRAS) {
        const v = visaoDoJogador(s, c);
        const mundo = amostrarMundo(v, mulberry32(seed));
        expect(visaoDoJogador(mundo, c).mao).toEqual(v.mao);
        expect(mundo.monte).toHaveLength(v.qtdMonte);
        const todas = ids(cartasDaPartida(mundo));
        expect(new Set(todas).size).toBe(40);
        expect(todas.every((id) => doBaralho.has(id))).toBe(true);
      }
    }
  });
});
```

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/engine test visao-ritual`
Expected: FAIL — `dadas` vem com as cartas, `familias[0].cartas` aparece para todos, `mundo.monte` tem 0 cartas.

**Step 3: Implementação**

`packages/engine/src/visao.ts` (arquivo inteiro):
```ts
import type { Carta } from './cartas';
import {
  type Cadeira,
  duplaDe,
  type EstadoMao,
  type EstadoPartida,
  type EstadoRitual,
  type FamiliaPedida,
  type Jogada,
  parceiroDe,
  type ResultadoMao,
} from './estado';

export type JogadaVisivel = Omit<Jogada, 'carta'> & { carta: Carta | null };

export interface FamiliaVisivel extends Omit<FamiliaPedida, 'cartas'> {
  /** null = fechada e não conferida, vista por quem não pediu (3 versos). */
  cartas: Carta[] | null;
}

export interface VisaoMao extends Omit<EstadoMao, 'maos' | 'mesa' | 'rodadasJogadas' | 'familias'> {
  /** null = carta virada (mão de ferro). */
  minhaMao: (Carta | null)[];
  maoParceiro: Carta[] | null;
  qtdCartas: number[];
  mesa: JogadaVisivel[];
  rodadasJogadas: JogadaVisivel[][];
  familias: FamiliaVisivel[];
}

export interface VisaoRitual extends Omit<EstadoRitual, 'dadas'> {
  /** Quem vai receber o "dar 3"; as cartas ninguém vê. */
  dadas: Cadeira | null;
}

export interface VisaoResultadoMao extends Omit<ResultadoMao, 'rodadasJogadas'> {
  rodadasJogadas: JogadaVisivel[][];
}

export interface Visao extends Omit<EstadoPartida, 'mao' | 'ultimaMao' | 'monte' | 'ritual'> {
  cadeira: Cadeira;
  mao: VisaoMao | null;
  ultimaMao: VisaoResultadoMao | null;
  /** Cartas no monte (a ordem ninguém vê). */
  qtdMonte: number;
  ritual: VisaoRitual | null;
}

export function visaoDoJogador(estado: EstadoPartida, cadeira: Cadeira): Visao {
  const { monte, ritual, ...s } = structuredClone(estado);
  const esconder = (j: Jogada): JogadaVisivel =>
    j.coberta && j.cadeira !== cadeira ? { ...j, carta: null } : j;
  const ultimaMao: VisaoResultadoMao | null = s.ultimaMao && {
    ...s.ultimaMao,
    rodadasJogadas: s.ultimaMao.rodadasJogadas.map((r) => r.map(esconder)),
  };
  const base = {
    ...s,
    cadeira,
    ultimaMao,
    qtdMonte: monte.length,
    ritual: ritual ? { ...ritual, dadas: ritual.dadas?.cadeira ?? null } : null,
  };
  if (!s.mao) return { ...base, mao: null };

  const { maos, mesa, rodadasJogadas, familias, ...resto } = s.mao;
  const veParceiro = resto.tipo === 'mao10' && resto.duplaNoDez === duplaDe(cadeira);
  const familia = (f: FamiliaPedida): FamiliaVisivel => ({
    ...f,
    cartas: f.tipo === 'aberta' || f.conferida !== null || f.cadeira === cadeira ? f.cartas : null,
  });

  return {
    ...base,
    mao: {
      ...resto,
      minhaMao: resto.tipo === 'mao11' ? maos[cadeira].map(() => null) : maos[cadeira],
      maoParceiro: veParceiro ? maos[parceiroDe(cadeira)] : null,
      qtdCartas: maos.map((m) => m.length),
      mesa: mesa.map(esconder),
      rodadasJogadas: rodadasJogadas.map((r) => r.map(esconder)),
      familias: familias.map(familia),
    },
  };
}
```

`packages/engine/src/bots/dificil.ts` — em `amostrarMundo`, marque também o que é público (logo depois de `m.rodadasJogadas.flat().forEach((j) => marcar(j.carta));`):
```ts
  m.abertasNoCorte.forEach(marcar);
  m.familias.forEach((f) => f.cartas?.forEach(marcar));
```
e troque o final da função (de `const revelar = ...` até o fim do `return`) por:
```ts
  const revelar = (j: JogadaVisivel): Jogada => ({ ...j, carta: j.carta ?? tirar() });
  const { minhaMao: _a, maoParceiro: _b, qtdCartas: _c, mesa, rodadasJogadas, familias, ...resto } = m;
  const mesaReal = mesa.map(revelar);
  const rodadasReais = rodadasJogadas.map((r) => r.map(revelar));
  const familiasReais = familias.map((f) => ({ ...f, cartas: f.cartas ? f.cartas.map((x) => ({ ...x })) : [tirar(), tirar(), tirar()] }));
  // O que sobrou é o monte (a ordem não importa para a simulação).
  if (monte.length !== v.qtdMonte) throw new Error('amostrarMundo: o monte não bate com a visão');
  return {
    regras: { ...v.regras },
    placar: [v.placar[0], v.placar[1]],
    pe: v.pe,
    fase: v.fase,
    monte,
    ritual: null,
    ultimaMao: null,
    ultimaFamilia: null,
    vencedor: v.vencedor,
    mao: {
      ...structuredClone(resto),
      maos,
      mesa: mesaReal,
      rodadasJogadas: rodadasReais,
      familias: familiasReais,
    },
  };
```
(As mãos já foram sorteadas antes, em `const maos = ...`; mantenha a ordem: mãos → cobertas → famílias escondidas → o resto é o monte. Isto substitui o `monte: [], ritual: v.ritual` provisório da Task 2.)

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/engine test` → PASS. Run: `pnpm --filter @truco/engine typecheck` → ok.

**Step 5: Commit**
```bash
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add -- packages/engine/test/visao-ritual.test.ts
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "feat(engine): visão esconde o monte, o dar 3 e as famílias fechadas" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- packages/engine/src/visao.ts packages/engine/src/bots/dificil.ts packages/engine/test/visao-ritual.test.ts
```

---

### Task 4: Engine — abrir 3 e dar 3

**Files:**
- Modify: `packages/engine/src/reducer.ts`
- Test: `packages/engine/test/ritual-corte.test.ts`

**Step 1: Teste que falha**

`packages/engine/test/ritual-corte.test.ts`
```ts
import { describe, expect, test } from 'vitest';
import { type Carta, idCarta, novoBaralho } from '../src/cartas';
import { ErroJogada, reduce } from '../src/reducer';
import type { RegrasMesa } from '../src/regras';
import type { ModoDistribuicao } from '../src/ritual';
import { MINEIRO, PAULISTA, partida } from './helpers';

const ids = (cs: readonly Carta[]) => cs.map(idCarta);
const B = novoBaralho().map(idCarta);
/** pe = 3: embaralhador 3, cortador 2, parceiro do cortador 0. */
const cortando = (regras: RegrasMesa = PAULISTA) =>
  reduce(reduce(partida(regras), { tipo: 'monte', baralho: novoBaralho() }), { tipo: 'passarCorte', cadeira: 3 });
const dar = (regras: RegrasMesa, corte: 'abrir3' | 'dar3', modo: ModoDistribuicao = 'porCima') =>
  reduce(reduce(cortando(regras), { tipo: corte, cadeira: 2 }), { tipo: 'distribuir', cadeira: 3, modo });

describe('abrir 3', () => {
  test('as 3 de cima ficam viradas, gastam os 3 movimentos e saem da mão', () => {
    const t = reduce(cortando(), { tipo: 'abrir3', cadeira: 2 });
    expect(ids(t.ritual!.abertas)).toEqual(B.slice(0, 3));
    expect(t.ritual!.movimentos).toBe(3);
    expect(t.fase).toBe('escolhendoDistribuicao');
    expect(t.monte).toHaveLength(37);
    const s = dar(PAULISTA, 'abrir3');
    expect(ids(s.mao!.abertasNoCorte)).toEqual(B.slice(0, 3));
    expect(s.mao!.maos.map(ids)).toEqual([B.slice(3, 6), B.slice(6, 9), B.slice(9, 12), B.slice(12, 15)]);
    expect(idCarta(s.mao!.vira!)).toBe(B[15]);
  });

  test('só como primeiro movimento e só o cortador', () => {
    const t = reduce(cortando(), { tipo: 'cortar', cadeira: 2, ponto: 20 });
    expect(() => reduce(t, { tipo: 'abrir3', cadeira: 2 })).toThrow(ErroJogada);
    expect(() => reduce(cortando(), { tipo: 'abrir3', cadeira: 3 })).toThrow(ErroJogada);
  });

  test('no fim da mão as abertas voltam ao monte depois das mãos', () => {
    let s = dar(MINEIRO, 'abrir3');
    s = reduce(s, { tipo: 'truco', cadeira: 0 });
    s = reduce(s, { tipo: 'correr', cadeira: 1 });
    expect(ids(s.monte)).toEqual([...B.slice(3, 15), ...B.slice(0, 3), ...B.slice(15)]);
  });
});

describe('dar 3', () => {
  test('as 3 de cima viram a mão do parceiro do cortador, que é pulado', () => {
    const t = reduce(cortando(), { tipo: 'dar3', cadeira: 2 });
    expect(t.ritual!.dadas!.cadeira).toBe(0);
    expect(t.fase).toBe('escolhendoDistribuicao');
    const s = dar(PAULISTA, 'dar3');
    expect(s.mao!.pulada).toBe(0);
    expect(s.mao!.maos.map(ids)).toEqual([B.slice(0, 3), B.slice(3, 6), B.slice(6, 9), B.slice(9, 12)]);
    expect(idCarta(s.mao!.vira!)).toBe(B[12]);
  });

  test('subindo alternado com dar 3: só os outros três recebem, do fundo', () => {
    const s = dar(PAULISTA, 'dar3', 'subindo');
    expect(s.mao!.maos.map(ids)).toEqual([
      B.slice(0, 3),
      [B[39], B[36], B[33]],
      [B[38], B[35], B[32]],
      [B[37], B[34], B[31]],
    ]);
    expect(idCarta(s.mao!.vira!)).toBe(B[30]);
  });

  test('não depois de outro movimento', () => {
    const t = reduce(cortando(), { tipo: 'embaralhar', cadeira: 2, bits: novoBaralho().map(() => 0 as const) });
    expect(() => reduce(t, { tipo: 'dar3', cadeira: 2 })).toThrow(ErroJogada);
  });
});
```

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/engine test ritual-corte`
Expected: FAIL — `ação desconhecida: abrir3`.

**Step 3: Implementação**

`packages/engine/src/reducer.ts` — importe `parceiroDe` de `./estado`; no `switch` do `reduce`, depois de `case 'devolver'`:
```ts
    case 'abrir3':
    case 'dar3':
      cortarDe3(s, acao.cadeira, acao.tipo);
      break;
```
e, depois de `devolver`:
```ts
/** Abrir 3 / dar 3: gastam os 3 movimentos de uma vez (só como primeiro movimento) e encerram o corte. */
function cortarDe3(s: EstadoPartida, cadeira: Cadeira, tipo: 'abrir3' | 'dar3'): void {
  const r = exigirCortador(s, cadeira);
  if (r.movimentos > 0) falha(`${tipo === 'abrir3' ? 'abrir' : 'dar'} 3 gasta os 3 movimentos: só no começo do corte`);
  const tres = s.monte.splice(0, 3);
  if (tipo === 'abrir3') r.abertas = tres;
  else r.dadas = { cadeira: parceiroDe(cadeira), cartas: tres };
  r.movimentos = MOVIMENTOS_CORTE;
  s.fase = 'escolhendoDistribuicao';
}
```

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/engine test` → PASS.

**Step 5: Commit**
```bash
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add -- packages/engine/test/ritual-corte.test.ts
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "feat(engine): abrir 3 e dar 3 no corte" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- packages/engine/src/reducer.ts packages/engine/test/ritual-corte.test.ts
```

---

### Task 5: Engine — família fechada/aberta, conferir, limite e pontos

A família deixa de redistribuir: quem pede troca as 3 cartas pelas 3 de cima do monte. Fechada pode ser blefe e abre a fase `conferindoFamilia` para a dupla adversária; aberta precisa ser real e não pontua. Some `ultimaFamilia`.

**Files:**
- Modify: `packages/engine/src/familia.ts`, `packages/engine/src/reducer.ts`, `packages/engine/src/estado.ts`, `packages/engine/src/bots/dificil.ts`
- Test: `packages/engine/test/familia.test.ts` (reescrito), `packages/engine/test/extras.test.ts`

**Step 1: Teste que falha**

`packages/engine/test/familia.test.ts` (arquivo inteiro):
```ts
import { describe, expect, test } from 'vitest';
import { type Carta, idCarta, novoBaralho } from '../src/cartas';
import type { EstadoPartida } from '../src/estado';
import { ehFamilia, fechadasUsadas, janelaDeFamilia, tipoDaProximaFamilia } from '../src/familia';
import { ErroJogada, reduce } from '../src/reducer';
import { cartasDaPartida } from '../src/ritual';
import { MINEIRO, c, distribuida, partida } from './helpers';

const ids = (cs: readonly Carta[]) => cs.map(idCarta);
/** Mineiro (base 2), pe = 3, a cadeira 0 começa e tem família real (Ae conta, mesmo sendo manilha). */
const MAOS = [
  ['Qo', 'Jo', 'Ae'],
  ['3e', '5e', '6e'],
  ['4p', '7c', 'Ko'],
  ['2e', '5c', '6c'],
];
const pedir = (s: EstadoPartida, cadeira: 0 | 1 | 2 | 3) => reduce(s, { tipo: 'familia', cadeira });
const conferir = (s: EstadoPartida, cadeira: 0 | 1 | 2 | 3, sim: boolean) => reduce(s, { tipo: 'conferir', cadeira, conferir: sim });

describe('ehFamilia', () => {
  test('3 cartas só de Q, J, K, A; coringa não conta', () => {
    expect(ehFamilia(['Qo', 'Jc', 'Kp'].map(c))).toBe(true);
    expect(ehFamilia(['Ao', 'Ac', 'Ae'].map(c))).toBe(true);
    expect(ehFamilia(['Qo', 'Jc', '3p'].map(c))).toBe(false);
    expect(ehFamilia(['Qo', 'Jc'].map(c))).toBe(false);
    expect(ehFamilia(['Qo', 'Jc', 'Cc'].map(c))).toBe(false);
  });
});

describe('família fechada', () => {
  test('põe as 3 na mesa, recebe as 3 de cima e espera a dupla adversária', () => {
    const s = distribuida(MINEIRO, MAOS);
    const topo = ids(s.monte.slice(0, 3));
    const t = pedir(s, 0);
    expect(t.fase).toBe('conferindoFamilia');
    expect(ids(t.mao!.maos[0])).toEqual(topo);
    expect(t.mao!.familias).toEqual([{ cadeira: 0, tipo: 'fechada', cartas: MAOS[0].map(c), conferida: null }]);
    expect(t.mao!.familiaPendente).toBe(0);
    expect(t.monte).toHaveLength(25);
    expect(t.placar).toEqual([0, 0]);
    expect(t.pe).toBe(3);
    expect(t.mao!.vez).toBe(0);
    expect(cartasDaPartida(t)).toHaveLength(40);
  });

  test('conferiu e era família: a dupla de quem pediu ganha o valor base da mão', () => {
    const t = pedir(distribuida(MINEIRO, MAOS), 0);
    expect(() => conferir(t, 2, true)).toThrow(ErroJogada);
    const u = conferir(t, 1, true);
    expect(u.placar).toEqual([2, 0]);
    expect(u.mao!.familias[0].conferida).toEqual({ por: 1, real: true });
    expect(u.fase).toBe('jogando');
    expect(u.mao!.familiaPendente).toBeNull();
  });

  test('conferiu e era blefe: a dupla de quem conferiu ganha', () => {
    const t = pedir(distribuida(MINEIRO, MAOS), 1); // 3e 5e 6e: blefe vale na fechada
    const u = conferir(t, 0, true);
    expect(u.placar).toEqual([2, 0]);
    expect(u.mao!.familias[0].conferida).toEqual({ por: 0, real: false });
  });

  test('ninguém conferiu: ninguém pontua e as cartas continuam viradas', () => {
    const u = conferir(pedir(distribuida(MINEIRO, MAOS), 0), 3, false);
    expect(u.placar).toEqual([0, 0]);
    expect(u.mao!.familias[0].conferida).toBeNull();
    expect(u.fase).toBe('jogando');
  });

  test('limite: 3 fechadas por mão; depois só aberta, que precisa ser real', () => {
    let s = distribuida(MINEIRO, MAOS);
    for (let i = 0; i < 3; i++) s = conferir(pedir(s, 1), 0, false);
    expect(fechadasUsadas(s.mao!)).toBe(3);
    expect(tipoDaProximaFamilia(s)).toBe('aberta');
    expect(() => pedir(s, 1)).toThrow(/não é família/); // a cadeira 1 recebeu cartas baixas
    const a = pedir(s, 0); // a 0 ainda tem a família real
    expect(a.fase).toBe('jogando');
    expect(a.mao!.familias[3].tipo).toBe('aberta');
    expect(a.placar).toEqual([0, 0]);
  });

  test('o "abrir 3" do corte conta como uma fechada', () => {
    let s = reduce(partida(MINEIRO), { tipo: 'monte', baralho: novoBaralho() });
    s = reduce(s, { tipo: 'passarCorte', cadeira: 3 });
    s = reduce(s, { tipo: 'abrir3', cadeira: 2 });
    s = reduce(s, { tipo: 'distribuir', cadeira: 3, modo: 'porCima' });
    expect(fechadasUsadas(s.mao!)).toBe(1);
    s = conferir(pedir(s, 0), 1, false);
    s = conferir(pedir(s, 0), 1, false);
    expect(tipoDaProximaFamilia(s)).toBe('aberta');
  });
});

describe('família aberta', () => {
  const ABERTA = { ...MINEIRO, familia: 'aberta' as const };

  test('mostra, troca as cartas, ninguém pontua, não tem conferir', () => {
    const t = pedir(distribuida(ABERTA, MAOS), 0);
    expect(t.fase).toBe('jogando');
    expect(t.mao!.familias[0]).toMatchObject({ cadeira: 0, tipo: 'aberta', conferida: null });
    expect(t.placar).toEqual([0, 0]);
    expect(() => pedir(distribuida(ABERTA, MAOS), 1)).toThrow(/não é família/);
  });

  test('vários pedidos: as cartas novas saem do topo na ordem dos pedidos', () => {
    const s = distribuida(ABERTA, [['Qo', 'Jo', 'Ae'], ['3e', '5e', '6e'], ['Kp', 'Jc', 'Qe'], ['2e', '5c', '6c']]);
    const topo = ids(s.monte.slice(0, 6));
    const t = pedir(pedir(s, 2), 0);
    expect(ids(t.mao!.maos[2])).toEqual(topo.slice(0, 3));
    expect(ids(t.mao!.maos[0])).toEqual(topo.slice(3, 6));
    expect(t.mao!.familias.map((f) => f.cadeira)).toEqual([2, 0]);
  });
});

describe('quando pode', () => {
  test('sem 3 cartas no monte para repor: proibido', () => {
    const s = distribuida(MINEIRO, MAOS);
    s.monte = s.monte.slice(0, 2);
    expect(() => pedir(s, 0)).toThrow(/monte/);
  });

  test('só antes da 1ª carta, em mão normal, com família ligada (bloqueada na mão de 10 e na de ferro)', () => {
    const s = distribuida(MINEIRO, MAOS);
    expect(janelaDeFamilia(s)).toBe(true);
    expect(() => pedir(reduce(s, { tipo: 'jogar', cadeira: 0, indice: 2 }), 1)).toThrow(ErroJogada);
    expect(() => pedir(distribuida({ ...MINEIRO, familia: 'off' }, MAOS), 0)).toThrow(ErroJogada);
    const dez = distribuida(MINEIRO, MAOS, undefined, [10, 4]);
    expect(dez.fase).toBe('decisaoMao10');
    expect(() => pedir(dez, 0)).toThrow(ErroJogada);
    expect(() => pedir(reduce(dez, { tipo: 'mao10', cadeira: 0, jogar: true }), 0)).toThrow(ErroJogada);
    const ferro = distribuida({ ...MINEIRO, maoDe11: 'qualquerDupla' }, MAOS, undefined, [11, 0]);
    expect(ferro.mao!.tipo).toBe('mao11');
    expect(() => pedir(ferro, 0)).toThrow(ErroJogada);
    const trucada = reduce(reduce(s, { tipo: 'truco', cadeira: 0 }), { tipo: 'aceitar', cadeira: 1 });
    expect(() => pedir(trucada, 2)).toThrow(ErroJogada);
  });

  test('pontos de família podem fechar a partida', () => {
    const t = pedir(distribuida({ ...MINEIRO, maoDe10: false }, MAOS, undefined, [10, 3]), 0);
    const fim = conferir(t, 1, true);
    expect(fim.placar).toEqual([12, 3]);
    expect(fim.fase).toBe('fimPartida');
    expect(fim.vencedor).toBe(0);
    expect(fim.mao).toBeNull();
    expect(fim.ultimaMao).toMatchObject({ vencedor: 0, pontos: 2, motivo: 'familia' });
    expect(cartasDaPartida(fim)).toHaveLength(40);
  });
});
```

Em `packages/engine/test/extras.test.ts`, troque o teste "família mantém o mesmo pé" por:
```ts
  test('família não encerra a mão nem troca o pé', () => {
    const FAMILIA = [
      ['Qo', 'Jo', 'Ae'],
      ['3e', '5e', '6e'],
      ['4p', '7c', 'Ko'],
      ['2e', '5c', '6c'],
    ];
    let s = reduce(distribuida({ ...MINEIRO, familia: 'aberta' }, FAMILIA), { tipo: 'familia', cadeira: 0 });
    expect(s.pe).toBe(3);
    expect(s.fase).toBe('jogando');
    expect(s.mao!.vez).toBe(0);
    s = encerrar(s);
    expect(s.pe).toBe(0);
  });
```
(e tire os imports que ficarem sem uso, como `ritualMinimo`/`baralhoCom`, se o typecheck reclamar).

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/engine test familia extras`
Expected: FAIL — `fechadasUsadas`/`janelaDeFamilia`/`tipoDaProximaFamilia` não exportados; família ainda zera a mão.

**Step 3: Implementação**

`packages/engine/src/familia.ts` (arquivo inteiro):
```ts
import type { Carta } from './cartas';
import type { Fase, FamiliaPedida, TipoMao } from './estado';
import type { RegrasMesa } from './regras';
import { LIMITE_FAMILIAS_FECHADAS } from './ritual';

const FIGURAS = new Set(['Q', 'J', 'K', 'A']);

/** Família: 3 cartas só de Q, J, K, A (inclusive A♠, se o jogador quiser). */
export function ehFamilia(mao: readonly Carta[]): boolean {
  return mao.length === 3 && mao.every((c) => FIGURAS.has(c.valor));
}

/** O mínimo para decidir sobre família: serve para `EstadoPartida` e para `Visao`. */
export interface SituacaoFamilia {
  regras: Pick<RegrasMesa, 'familia'>;
  fase: Fase;
  mao: {
    tipo: TipoMao;
    rodadas: readonly unknown[];
    mesa: readonly unknown[];
    nivel: number;
    abertasNoCorte: readonly unknown[];
    familias: readonly Pick<FamiliaPedida, 'tipo'>[];
  } | null;
}

/** Fechadas já usadas na mão (o "abrir 3" do corte conta como uma). */
export function fechadasUsadas(m: NonNullable<SituacaoFamilia['mao']>): number {
  return m.familias.filter((f) => f.tipo === 'fechada').length + (m.abertasNoCorte.length > 0 ? 1 : 0);
}

/** Como sai o próximo pedido: mesa aberta → aberta; mesa fechada → fechada até o limite, depois aberta. */
export function tipoDaProximaFamilia(s: Pick<SituacaoFamilia, 'regras' | 'mao'>): 'fechada' | 'aberta' | null {
  if (!s.mao || s.regras.familia === 'off') return null;
  if (s.regras.familia === 'aberta') return 'aberta';
  return fechadasUsadas(s.mao) < LIMITE_FAMILIAS_FECHADAS ? 'fechada' : 'aberta';
}

/** Janela: família ligada, mão normal, nenhuma carta jogada e sem truco aceito. */
export function janelaDeFamilia(s: SituacaoFamilia): boolean {
  const m = s.mao;
  return (
    s.regras.familia !== 'off' &&
    s.fase === 'jogando' &&
    !!m &&
    m.tipo === 'normal' &&
    m.rodadas.length === 0 &&
    m.mesa.length === 0 &&
    m.nivel === 0
  );
}
```

`packages/engine/src/estado.ts`: apague o campo `ultimaFamilia` de `EstadoPartida` e a linha `ultimaFamilia: null,` de `novaPartida`.
`packages/engine/src/bots/dificil.ts`: apague `ultimaFamilia: null,` do retorno de `amostrarMundo`.

`packages/engine/src/reducer.ts`:
- import: `import { ehFamilia, janelaDeFamilia, tipoDaProximaFamilia } from './familia';`
- em `jogar`, apague `s.ultimaFamilia = null;`
- no `switch` do `reduce`, depois de `case 'familia'`:
```ts
    case 'conferir':
      conferirFamilia(s, acao.cadeira, acao.conferir);
      break;
```
- `pedirFamilia` inteiro (substitui o provisório) e as funções novas:
```ts
function pedirFamilia(s: EstadoPartida, cadeira: Cadeira): void {
  const m = maoAtual(s);
  if (s.regras.familia === 'off') falha('família desligada nesta mesa');
  if (!janelaDeFamilia(s)) falha('família só antes da 1ª carta, em mão normal');
  const tipo = tipoDaProximaFamilia(s)!;
  if (s.monte.length < 3) falha('o monte não tem cartas para repor a família');
  const mao = m.maos[cadeira];
  if (tipo === 'aberta' && !ehFamilia(mao)) falha('isso não é família');
  m.familias.push({ cadeira, tipo, cartas: mao.splice(0, mao.length), conferida: null });
  m.maos[cadeira] = s.monte.splice(0, 3);
  if (tipo === 'fechada') {
    m.familiaPendente = m.familias.length - 1;
    s.fase = 'conferindoFamilia';
  }
}

function conferirFamilia(s: EstadoPartida, cadeira: Cadeira, conferir: boolean): void {
  const m = maoAtual(s);
  if (s.fase !== 'conferindoFamilia' || m.familiaPendente === null) falha('não há família para conferir');
  const f = m.familias[m.familiaPendente];
  if (duplaDe(cadeira) === duplaDe(f.cadeira)) falha('só a dupla adversária confere');
  m.familiaPendente = null;
  s.fase = 'jogando';
  if (!conferir) return;
  const real = ehFamilia(f.cartas);
  f.conferida = { por: cadeira, real };
  pontuarFamilia(s, real ? duplaDe(f.cadeira) : duplaDe(cadeira));
}

/** Valor base da mão para a dupla; se fechar a partida, encerra pela via normal (recolhe tudo). */
function pontuarFamilia(s: EstadoPartida, dupla: Dupla): void {
  const base = escada(s)[0];
  if (s.placar[dupla] + base >= PONTOS_VITORIA) {
    finalizarMao(s, dupla, base, 'familia');
    return;
  }
  s.placar[dupla] += base;
}
```

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/engine test` → PASS. Run: `pnpm --filter @truco/engine typecheck` → ok (se `propriedades.test.ts` ou outro teste ainda citar `ultimaFamilia`, apague a menção).

**Step 5: Commit**
```bash
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "feat(engine): família troca as cartas; fechada pode ser blefe e ser conferida" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- packages/engine/src packages/engine/test
```

---

### Task 6: Engine — `acoesValidas` e `quemDeveAgir` nas fases novas

**Files:**
- Modify: `packages/engine/src/acoes.ts`, `packages/engine/src/vez.ts`
- Test: `packages/engine/test/ritual-acoes.test.ts`, `packages/engine/test/vez.test.ts`

**Step 1: Teste que falha**

`packages/engine/test/ritual-acoes.test.ts`
```ts
import { describe, expect, test } from 'vitest';
import { acoesValidas } from '../src/acoes';
import { novoBaralho } from '../src/cartas';
import type { Cadeira, EstadoPartida } from '../src/estado';
import { reduce } from '../src/reducer';
import { quemDeveAgir } from '../src/vez';
import { visaoDoJogador } from '../src/visao';
import { MINEIRO, distribuida, partida } from './helpers';

const tipos = (s: EstadoPartida, c: Cadeira) => acoesValidas(s, c).map((a) => a.tipo).sort();
/** pe = 3: embaralhador 3, cortador 2. */
const comMonte = () => reduce(partida(MINEIRO), { tipo: 'monte', baralho: novoBaralho() });
const cortando = () => reduce(comMonte(), { tipo: 'passarCorte', cadeira: 3 });

describe('ritual: quem age e o que pode', () => {
  test('embaralhando: só o embaralhador; embaralhar ou passar', () => {
    const s = comMonte();
    expect(quemDeveAgir(s)).toEqual([3]);
    expect(quemDeveAgir(visaoDoJogador(s, 1))).toEqual([3]);
    expect(tipos(s, 3)).toEqual(['embaralhar', 'passarCorte']);
    expect(acoesValidas(s, 0)).toEqual([]);
    expect(JSON.stringify(acoesValidas(s, 3))).not.toMatch(/bits|ponto/);
  });

  test('depois de 20 embaralhadas só dá para passar', () => {
    let s = comMonte();
    for (let i = 0; i < 20; i++) s = reduce(s, { tipo: 'embaralhar', cadeira: 3, bits: s.monte.map(() => 0 as const) });
    expect(tipos(s, 3)).toEqual(['passarCorte']);
  });

  test('cortando: só o cortador; abrir/dar 3 só antes do primeiro movimento', () => {
    const t = cortando();
    expect(quemDeveAgir(t)).toEqual([2]);
    expect(tipos(t, 2)).toEqual(['abrir3', 'cortar', 'dar3', 'devolver', 'embaralhar']);
    expect(acoesValidas(t, 3)).toEqual([]);
    const u = reduce(t, { tipo: 'cortar', cadeira: 2, ponto: 15 });
    expect(tipos(u, 2)).toEqual(['cortar', 'devolver', 'embaralhar']);
    expect(JSON.stringify(acoesValidas(t, 2))).not.toMatch(/bits|ponto/);
  });

  test('escolhendo como dar: o embaralhador, nos 3 modos', () => {
    const u = reduce(cortando(), { tipo: 'devolver', cadeira: 2 });
    expect(quemDeveAgir(u)).toEqual([3]);
    expect(acoesValidas(u, 3)).toEqual([
      { tipo: 'distribuir', cadeira: 3, modo: 'porCima' },
      { tipo: 'distribuir', cadeira: 3, modo: 'porBaixo' },
      { tipo: 'distribuir', cadeira: 3, modo: 'subindo' },
    ]);
  });
});

describe('família: janela e conferir', () => {
  const MAOS = [['Qo', 'Jo', 'Ae'], ['3e', '5e', '6e'], ['4p', '7c', 'Ko'], ['2e', '5c', '6c']];

  test('na janela qualquer um pode pedir fechada (blefe vale), mesmo fora da vez', () => {
    const s = distribuida(MINEIRO, MAOS);
    expect(acoesValidas(s, 1)).toEqual([{ tipo: 'familia', cadeira: 1 }]);
    expect(quemDeveAgir(s)).toEqual([0]);
  });

  test('conferindo: a dupla adversária de quem pediu, com conferir ou deixar passar', () => {
    const t = reduce(distribuida(MINEIRO, MAOS), { tipo: 'familia', cadeira: 0 });
    expect(quemDeveAgir(t)).toEqual([1, 3]);
    expect(quemDeveAgir(visaoDoJogador(t, 0))).toEqual([1, 3]);
    expect(acoesValidas(t, 1)).toEqual([
      { tipo: 'conferir', cadeira: 1, conferir: true },
      { tipo: 'conferir', cadeira: 1, conferir: false },
    ]);
    expect(acoesValidas(t, 0)).toEqual([]);
    expect(acoesValidas(t, 2)).toEqual([]);
  });
});
```

Em `packages/engine/test/vez.test.ts`, troque o teste "sem mão (antes da distribuição, entre mãos ou fim): ninguém" por:
```ts
  test('esperando o monte: ninguém; entre mãos: o pé novo, que embaralha', () => {
    expect(quemDeveAgir(novaPartida(MINEIRO))).toEqual([]);
    const s = reduce(inicio(MINEIRO, [10, 0]), { tipo: 'mao10', cadeira: 0, jogar: false });
    expect(s.mao).toBeNull();
    expect(s.pe).toBe(0);
    expect(quemDeveAgir(s)).toEqual([0]);
    expect(quemDeveAgir(visaoDoJogador(s, 2))).toEqual([0]);
  });
```

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/engine test ritual-acoes vez`
Expected: FAIL — `quemDeveAgir` devolve `[]` no ritual e `acoesValidas` não conhece as ações novas.

**Step 3: Implementação**

`packages/engine/src/acoes.ts` — importe `import { completarSorte } from './ritual';` e troque `candidatas` e `legais`:
```ts
function candidatas(cadeira: Cadeira): AcaoJogador[] {
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
    { tipo: 'embaralhar', cadeira },
    { tipo: 'passarCorte', cadeira },
    { tipo: 'cortar', cadeira },
    { tipo: 'abrir3', cadeira },
    { tipo: 'dar3', cadeira },
    { tipo: 'devolver', cadeira },
    { tipo: 'distribuir', cadeira, modo: 'porCima' },
    { tipo: 'distribuir', cadeira, modo: 'porBaixo' },
    { tipo: 'distribuir', cadeira, modo: 'subindo' },
    { tipo: 'conferir', cadeira, conferir: true },
    { tipo: 'conferir', cadeira, conferir: false },
  ];
}

/** Testa cada candidata; embaralhar/cortar são testados com uma sorte qualquer e devolvidos sem ela. */
function legais(s: EstadoPartida, acoes: AcaoJogador[]): AcaoJogador[] {
  return acoes.filter((a) => {
    try {
      reduce(s, completarSorte(a, s, () => 0));
      return true;
    } catch (e) {
      if (e instanceof ErroJogada) return false;
      throw e;
    }
  });
}
```
(atualize os comentários de `acoesValidas`/`todasAcoesValidas`: "exceto monte").

`packages/engine/src/vez.ts` (arquivo inteiro):
```ts
import { type Cadeira, duplaDe, type EstadoMao, type EstadoRitual, type Fase } from './estado';

const CADEIRAS: Cadeira[] = [0, 1, 2, 3];

/** O mínimo para saber de quem é a vez: serve tanto para `EstadoPartida` quanto para `Visao`. */
export interface SituacaoVez {
  fase: Fase;
  mao:
    | (Pick<EstadoMao, 'vez' | 'trucoPendente' | 'duplaNoDez' | 'familiaPendente'> & {
        familias: readonly { cadeira: Cadeira }[];
      })
    | null;
  ritual?: Pick<EstadoRitual, 'embaralhador' | 'cortador'> | null;
}

/**
 * Cadeiras que precisam agir agora: no ritual, quem está com o monte (embaralhador ou
 * cortador); a da vez ao jogar; a dupla que não pediu durante um truco pendente ou uma
 * família fechada esperando conferência; a dupla no dez na decisão da mão de 10.
 */
export function quemDeveAgir(s: SituacaoVez): Cadeira[] {
  const r = s.ritual;
  if (r && (s.fase === 'embaralhando' || s.fase === 'escolhendoDistribuicao')) return [r.embaralhador];
  if (r && s.fase === 'cortando') return [r.cortador];
  const m = s.mao;
  if (!m) return [];
  if (s.fase === 'jogando') return [m.vez];
  if (s.fase === 'respondendoTruco' && m.trucoPendente) {
    const pediu = m.trucoPendente.dupla;
    return CADEIRAS.filter((c) => duplaDe(c) !== pediu);
  }
  if (s.fase === 'conferindoFamilia' && m.familiaPendente !== null) {
    const pediu = duplaDe(m.familias[m.familiaPendente].cadeira);
    return CADEIRAS.filter((c) => duplaDe(c) !== pediu);
  }
  if (s.fase === 'decisaoMao10') return CADEIRAS.filter((c) => duplaDe(c) === m.duplaNoDez);
  return [];
}
```

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/engine test` → PASS (o `propriedades.test.ts` antigo fica mais lento — 24 candidatas; se passar de 60 s, baixe `numRuns` dele para 200).

**Step 5: Commit**
```bash
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add -- packages/engine/test/ritual-acoes.test.ts
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "feat(engine): acoesValidas e quemDeveAgir no ritual e no conferir" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- packages/engine/src/acoes.ts packages/engine/src/vez.ts packages/engine/test
```

---

### Task 7: Engine — bots no ritual, na família e no conferir

**Files:**
- Create: `packages/engine/src/bots/ritual.ts`
- Modify: `packages/engine/src/bots/facil.ts`, `packages/engine/src/bots/dificil.ts`, `packages/engine/src/index.ts`
- Test: `packages/engine/test/bots-ritual.test.ts`; ajustar loops de `bot-facil.test.ts` e `bot-dificil.test.ts`

**Step 1: Teste que falha**

`packages/engine/test/bots-ritual.test.ts`
```ts
import { describe, expect, test } from 'vitest';
import { acoesValidas } from '../src/acoes';
import { botDificil } from '../src/bots/dificil';
import { botFacil } from '../src/bots/facil';
import { chanceDeFamilia, decidirEtapa, querFamilia } from '../src/bots/ritual';
import { baralhoDaMesa, novoBaralho } from '../src/cartas';
import { type EstadoPartida, ehFaseRitual } from '../src/estado';
import { quemDeveAgir } from '../src/vez';
import { reduce } from '../src/reducer';
import type { RegrasMesa } from '../src/regras';
import { completarSorte } from '../src/ritual';
import { mulberry32 } from '../src/rng';
import { visaoDoJogador } from '../src/visao';
import { MINEIRO, MINEIRO_LIMPA, PAULISTA, distribuida, partida } from './helpers';

/** pe = 3: embaralhador 3, cortador 2. */
const comMonte = (regras: RegrasMesa = MINEIRO) => reduce(partida(regras), { tipo: 'monte', baralho: baralhoDaMesa(regras) });
const aplicar = (s: EstadoPartida, a: Parameters<typeof completarSorte>[0], rand = mulberry32(1)) => reduce(s, completarSorte(a, s, rand));
/** Cadeira 1 com família real sem manilha (Ke não é manilha no mineiro). */
const MAOS_F = [['3e', '5e', '6e'], ['Qo', 'Jo', 'Ke'], ['4p', '7c', 'Ko'], ['2e', '5c', '6c']];

describe('bot fácil no ritual', () => {
  test('embaralha 3 vezes e passa; corta 1 vez e devolve; dá por cima', () => {
    let s = comMonte();
    for (let i = 0; i < 3; i++) {
      expect(botFacil(s, 3)).toEqual({ tipo: 'embaralhar', cadeira: 3 });
      s = aplicar(s, botFacil(s, 3)!);
    }
    expect(botFacil(s, 3)).toEqual({ tipo: 'passarCorte', cadeira: 3 });
    expect(botFacil(s, 2)).toBeNull();
    s = aplicar(s, botFacil(s, 3)!);
    expect(botFacil(s, 2)).toEqual({ tipo: 'cortar', cadeira: 2 });
    s = aplicar(s, botFacil(s, 2)!);
    expect(botFacil(s, 2)).toEqual({ tipo: 'devolver', cadeira: 2 });
    s = aplicar(s, botFacil(s, 2)!);
    expect(botFacil(s, 3)).toEqual({ tipo: 'distribuir', cadeira: 3, modo: 'porCima' });
  });
});

describe('bot fácil e família', () => {
  test('pede com família real sem manilha, mesmo fora da vez; com manilha não', () => {
    expect(botFacil(distribuida(MINEIRO, MAOS_F), 1)).toEqual({ tipo: 'familia', cadeira: 1 });
    const comManilha = [['3e', '5e', '6e'], ['Qo', 'Jo', 'Ae'], ['4p', '7c', 'Ko'], ['2e', '5c', '6c']];
    expect(botFacil(distribuida(MINEIRO, comManilha), 1)).toBeNull();
  });

  test('confere a 2ª fechada da mesma cadeira; a 1ª deixa passar', () => {
    const t = reduce(distribuida(MINEIRO, MAOS_F), { tipo: 'familia', cadeira: 1 });
    expect(botFacil(t, 0)).toEqual({ tipo: 'conferir', cadeira: 0, conferir: false });
    expect(botFacil(t, 3)).toBeNull();
    const u = reduce(t, { tipo: 'conferir', cadeira: 0, conferir: false });
    const w = reduce(u, { tipo: 'familia', cadeira: 1 });
    expect(botFacil(w, 2)).toEqual({ tipo: 'conferir', cadeira: 2, conferir: true });
  });
});

describe('desconfiança', () => {
  test('chance de família entre as cartas que não viu', () => {
    expect(chanceDeFamilia(visaoDoJogador(comMonte(MINEIRO), 0))).toBeCloseTo((16 * 15 * 14) / (40 * 39 * 38));
    expect(chanceDeFamilia(visaoDoJogador(comMonte(MINEIRO_LIMPA), 0))).toBeCloseTo((16 * 15 * 14) / (29 * 28 * 27));
  });

  test('difícil blefa família fechada com mão fraca só quando o sorteio deixa', () => {
    const fraca = distribuida(MINEIRO, [['5o', '6e', 'Jc']]);
    const v = visaoDoJogador(fraca, 0);
    expect(querFamilia(v, () => 0, 'dificil')).toBe(true);
    expect(querFamilia(v, () => 0.99, 'dificil')).toBe(false);
    expect(querFamilia(v, () => 0, 'facil')).toBe(false);
  });
});

describe('bot difícil no ritual', () => {
  test('sempre escolhe ações legais até a mão sair', () => {
    for (const regras of [PAULISTA, MINEIRO, MINEIRO_LIMPA]) {
      for (let seed = 1; seed <= 30; seed++) {
        const rand = mulberry32(seed);
        let s = comMonte(regras);
        for (let passos = 0; ehFaseRitual(s.fase); passos++) {
          if (passos > 40) throw new Error('ritual não acabou');
          const [c] = quemDeveAgir(s);
          const a = botDificil(visaoDoJogador(s, c), rand);
          expect(a).not.toBeNull();
          expect(acoesValidas(s, c)).toContainEqual(a);
          s = aplicar(s, a!, rand);
        }
        expect(s.mao).not.toBeNull();
      }
    }
  });

  test('decidirEtapa não age por quem não está com o monte', () => {
    expect(decidirEtapa(visaoDoJogador(comMonte(), 0), Math.random, 'dificil')).toBeNull();
    expect(decidirEtapa(visaoDoJogador(reduce(partida(MINEIRO), { tipo: 'monte', baralho: novoBaralho() }), 3), () => 0.99, 'dificil')).toEqual({
      tipo: 'embaralhar',
      cadeira: 3,
    });
  });
});
```

Nos loops de partida inteira, os bots agora fazem o ritual: em `bot-facil.test.ts` ("sempre devolve ação válida e 4 bots terminam a partida") e `bot-dificil.test.ts` ("quatro bots difíceis terminam uma partida"), troque o bloco `avancarSemJogadas` (da Task 2) por
```ts
        if (s.fase === 'aguardandoMonte') {
          s = reduce(s, { tipo: 'monte', baralho: embaralhar(baralhoDaMesa(regras), rand) });
          continue;
        }
```
e a aplicação da ação `s = reduce(s, acao!);` por `s = reduce(s, completarSorte(acao!, s, rand));` (importe `completarSorte` de `'../src/ritual'`). O limite de passos do difícil sobe para 6000.

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/engine test bots-ritual bot-facil bot-dificil`
Expected: FAIL — `../src/bots/ritual` não existe; bots devolvem `null` no ritual.

**Step 3: Implementação**

`packages/engine/src/bots/ritual.ts`
```ts
import { baralhoDaMesa, type Carta, idCarta } from '../cartas';
import { type AcaoJogador, duplaDe } from '../estado';
import { ehFamilia, janelaDeFamilia, tipoDaProximaFamilia } from '../familia';
import { FORCA_MANILHA_MIN, forca } from '../forca';
import { LIMITE_EMBARALHADAS } from '../ritual';
import type { Visao } from '../visao';

export type EstiloBot = 'facil' | 'dificil';

const FIGURAS = new Set(['Q', 'J', 'K', 'A']);
const FRACAS = new Set(['4', '5', '6', '7', 'Q', 'J']);
/** Abaixo disto o difícil desconfia de uma família fechada. */
export const LIMIAR_DESCONFIANCA = 0.035;
export const CHANCE_BLEFE_FAMILIA = 0.05;

/** Cartas que `v.cadeira` ainda não viu (mãos alheias, monte, famílias fechadas alheias, cobertas). */
export function cartasDesconhecidas(v: Visao): Carta[] {
  const vistas = new Set<string>();
  const marcar = (c: Carta | null | undefined) => {
    if (c) vistas.add(idCarta(c));
  };
  v.ritual?.abertas.forEach(marcar);
  const m = v.mao;
  if (m) {
    m.minhaMao.forEach(marcar);
    m.maoParceiro?.forEach(marcar);
    marcar(m.vira);
    m.mesa.forEach((j) => marcar(j.carta));
    m.rodadasJogadas.flat().forEach((j) => marcar(j.carta));
    m.abertasNoCorte.forEach(marcar);
    m.familias.forEach((f) => f.cartas?.forEach(marcar));
  }
  return baralhoDaMesa(v.regras).filter((c) => !vistas.has(idCarta(c)));
}

/** Chance de 3 cartas tiradas das que não viu serem todas Q/J/K/A: C(F,3)/C(N,3). */
export function chanceDeFamilia(v: Visao): number {
  const d = cartasDesconhecidas(v);
  const f = d.filter((c) => FIGURAS.has(c.valor)).length;
  const n = d.length;
  if (n < 3) return 0;
  return (f * (f - 1) * (f - 2)) / (n * (n - 1) * (n - 2));
}

function deveConferir(v: Visao, rand: () => number, estilo: EstiloBot): boolean {
  const m = v.mao!;
  const i = m.familiaPendente!;
  const f = m.familias[i];
  const repetiu = m.familias.some((x, j) => j < i && x.cadeira === f.cadeira && x.tipo === 'fechada');
  const p = chanceDeFamilia(v);
  if (p === 0 || repetiu) return true;
  if (estilo === 'facil') return false;
  return p < LIMIAR_DESCONFIANCA || rand() < 0.1;
}

/** Pede família na janela? Fácil: só com família real e sem manilha. Difícil: também blefa às vezes. */
export function querFamilia(v: Visao, rand: () => number, estilo: EstiloBot): boolean {
  const m = v.mao;
  if (!m || !janelaDeFamilia(v) || v.qtdMonte < 3) return false;
  const mao = m.minhaMao.filter((c): c is Carta => c !== null);
  if (mao.length !== 3) return false;
  const semManilha = mao.every((c) => forca(c, v.regras.variante, m.vira) < FORCA_MANILHA_MIN);
  if (ehFamilia(mao) && semManilha) return true;
  if (estilo === 'facil' || tipoDaProximaFamilia(v) !== 'fechada') return false;
  const fraca = semManilha && mao.every((c) => FRACAS.has(c.valor));
  return fraca && rand() < CHANCE_BLEFE_FAMILIA;
}

/** Etapas do ritual e o conferir. null = esta cadeira não tem nada a decidir agora. */
export function decidirEtapa(v: Visao, rand: () => number, estilo: EstiloBot): AcaoJogador | null {
  const cadeira = v.cadeira;
  const r = v.ritual;
  switch (v.fase) {
    case 'embaralhando': {
      if (!r || r.embaralhador !== cadeira) return null;
      const mais = estilo === 'facil' ? r.embaralhadas < 3 : r.embaralhadas < 2 || (r.embaralhadas < 6 && rand() < 0.5);
      return mais && r.embaralhadas < LIMITE_EMBARALHADAS ? { tipo: 'embaralhar', cadeira } : { tipo: 'passarCorte', cadeira };
    }
    case 'cortando': {
      if (!r || r.cortador !== cadeira) return null;
      if (estilo === 'facil') return r.movimentos === 0 ? { tipo: 'cortar', cadeira } : { tipo: 'devolver', cadeira };
      if (r.movimentos === 0) {
        const x = rand();
        if (x < 0.04) return { tipo: 'abrir3', cadeira };
        if (x < 0.08) return { tipo: 'dar3', cadeira };
        if (x < 0.2) return { tipo: 'embaralhar', cadeira };
        return { tipo: 'cortar', cadeira };
      }
      return rand() < 0.3 ? { tipo: 'cortar', cadeira } : { tipo: 'devolver', cadeira };
    }
    case 'escolhendoDistribuicao': {
      if (!r || r.embaralhador !== cadeira) return null;
      if (estilo === 'facil') return { tipo: 'distribuir', cadeira, modo: 'porCima' };
      const x = rand();
      return { tipo: 'distribuir', cadeira, modo: x < 0.6 ? 'porCima' : x < 0.85 ? 'porBaixo' : 'subindo' };
    }
    case 'conferindoFamilia': {
      const m = v.mao;
      if (!m || m.familiaPendente === null) return null;
      if (duplaDe(m.familias[m.familiaPendente].cadeira) === duplaDe(cadeira)) return null;
      return { tipo: 'conferir', cadeira, conferir: deveConferir(v, rand, estilo) };
    }
    default:
      return null;
  }
}
```

`packages/engine/src/bots/facil.ts` — imports `import { janelaDeFamilia } from '../familia';`, `import { visaoDoJogador } from '../visao';`, `import { decidirEtapa, querFamilia } from './ritual';`; o começo de `botFacil` fica:
```ts
/** Bot fácil: nunca truca; aceita com manilha; joga a menor carta que vence a mesa; ritual sempre igual. */
export function botFacil(s: EstadoPartida, cadeira: Cadeira): AcaoJogador | null {
  const m = s.mao;
  if (!m || s.fase === 'conferindoFamilia') return decidirEtapa(visaoDoJogador(s, cadeira), () => 0, 'facil');
  const dupla = duplaDe(cadeira);
```
e, logo antes de `if (s.fase !== 'jogando' || m.vez !== cadeira) return null;`:
```ts
  if (janelaDeFamilia(s) && querFamilia(visaoDoJogador(s, cadeira), () => 1, 'facil')) return { tipo: 'familia', cadeira };
```

`packages/engine/src/bots/dificil.ts` — import `import { decidirEtapa, querFamilia } from './ritual';`; em `botDificil` troque `if (!v.mao) return null;` por
```ts
  if (!v.mao || v.fase === 'conferindoFamilia') return decidirEtapa(v, rand, 'dificil');
  if (querFamilia(v, rand, 'dificil')) return { tipo: 'familia', cadeira: v.cadeira };
```
e `const candidatas = acoesValidas(primeiro, v.cadeira);` por
```ts
  // Família é decidida pela política acima, não pela simulação.
  const candidatas = acoesValidas(primeiro, v.cadeira).filter((a) => a.tipo !== 'familia');
```

`packages/engine/src/index.ts`: acrescente `export * from './bots/ritual';`.

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/engine test` → PASS. Run: `pnpm --filter @truco/engine typecheck` → ok.

**Step 5: Commit**
```bash
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add -- packages/engine/src/bots/ritual.ts packages/engine/test/bots-ritual.test.ts
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "feat(engine): bots embaralham, cortam, dão, pedem e conferem família" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- packages/engine/src packages/engine/test
```

---

### Task 8: Engine — propriedades: partidas inteiras com ritual aleatório

Nenhuma carta duplicada ou perdida: monte + ritual + mãos + mesa + fora somam sempre o baralho da mesa; ninguém vê o monte; limite de fechadas; partida termina.

**Files:**
- Test: `packages/engine/test/ritual-propriedades.test.ts`

**Step 1: Escrever o teste (deve passar de primeira; se falhar, é bug real — corrija o engine, não o teste)**

`packages/engine/test/ritual-propriedades.test.ts`
```ts
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { todasAcoesValidas } from '../src/acoes';
import { baralhoDaMesa, idCarta } from '../src/cartas';
import { type Cadeira, novaPartida } from '../src/estado';
import { fechadasUsadas } from '../src/familia';
import { escada, reduce } from '../src/reducer';
import type { RegrasMesa } from '../src/regras';
import { cartasDaPartida, completarSorte, LIMITE_FAMILIAS_FECHADAS } from '../src/ritual';
import { embaralhar, mulberry32 } from '../src/rng';
import { quemDeveAgir } from '../src/vez';
import { visaoDoJogador } from '../src/visao';
import { MINEIRO, MINEIRO_LIMPA, PAULISTA } from './helpers';

const TODAS_REGRAS: RegrasMesa[] = [
  PAULISTA,
  MINEIRO,
  { ...PAULISTA, pontuacao: '2-4-8-10-12', maoDe10: true, familia: 'aberta' },
  { ...PAULISTA, familia: 'fechada', maoDe11: 'onzeAOnze' },
  { ...MINEIRO, pontuacao: '1-3-6-9-12', maoDe11: 'onzeAOnze', familia: 'off' },
  MINEIRO_LIMPA,
  { ...MINEIRO_LIMPA, familia: 'aberta', maoDe11: 'qualquerDupla' },
];
const CADEIRAS: Cadeira[] = [0, 1, 2, 3];

describe('propriedades do ritual', () => {
  test('partidas inteiras com ritual aleatório: as cartas se conservam, ninguém vê o monte, terminam', () => {
    fc.assert(
      fc.property(fc.integer(), fc.constantFrom(...TODAS_REGRAS), (seed, regras) => {
        const rand = mulberry32(seed);
        const baralho = baralhoDaMesa(regras).map(idCarta).sort();
        let s = reduce(novaPartida(regras, (Math.abs(seed) % 4) as Cadeira), {
          tipo: 'monte',
          baralho: embaralhar(baralhoDaMesa(regras), rand),
        });
        for (let passos = 0; s.fase !== 'fimPartida'; passos++) {
          if (passos > 20_000) throw new Error('partida não terminou');
          const acoes = todasAcoesValidas(s);
          expect(acoes.length).toBeGreaterThan(0);
          expect(quemDeveAgir(s).length).toBeGreaterThan(0);
          const antes = [...s.placar];
          const a = acoes[Math.floor(rand() * acoes.length)];
          s = reduce(s, completarSorte(a, s, rand));
          for (const d of [0, 1] as const) {
            const delta = s.placar[d] - antes[d];
            if (delta !== 0) expect(escada(s)).toContain(delta);
          }
          expect(cartasDaPartida(s).map(idCarta).sort()).toEqual(baralho);
          if (s.mao) {
            const m = s.mao;
            expect(fechadasUsadas(m)).toBeLessThanOrEqual(LIMITE_FAMILIAS_FECHADAS);
            expect(m.maos.flat().length + m.mesa.length + m.rodadasJogadas.flat().length).toBe(12);
          }
          if (passos % 7 === 0) {
            for (const c of CADEIRAS) {
              const v = visaoDoJogador(s, c);
              expect('monte' in v).toBe(false);
              expect(v.qtdMonte).toBe(s.monte.length);
            }
          }
        }
        expect(s.vencedor).not.toBeNull();
        expect(Math.max(...s.placar)).toBeGreaterThanOrEqual(12);
        expect(cartasDaPartida(s).map(idCarta).sort()).toEqual(baralho);
      }),
      { numRuns: 80 },
    );
  }, 180_000);
});
```

**Step 2: Rodar**

Run: `pnpm --filter @truco/engine test ritual-propriedades`
Expected: PASS (pode levar ~1 min). Se estourar o tempo, baixe `numRuns` para 50 — não aumente o timeout além de 180 s.

**Step 3: Rodar o pacote inteiro**

Run: `pnpm --filter @truco/engine test` e `pnpm --filter @truco/engine typecheck` → PASS.

**Step 4: Commit**
```bash
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add -- packages/engine/test/ritual-propriedades.test.ts
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "test(engine): propriedades do ritual (cartas se conservam em partidas inteiras)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- packages/engine/test/ritual-propriedades.test.ts
```

---
### Task 9: Server — protocolo (`MsgAcao`, `msgDaAcao`) e tempos novos

A mensagem pública `acao` passa a levar o que a UI precisa para animar (modo e ordem da distribuição, quem recebeu o "dar 3", a fração do corte, se a família é aberta, se conferiu) — nunca `bits` nem `ponto`. Tempos novos: `ritualMs`, `conferirMs`, `janelaFamiliaMs`.

**Files:**
- Modify: `apps/server/src/mesa/protocolo.ts`, `apps/server/src/mesa/Mesa.ts` (só `Tempos` e `TEMPOS_PADRAO`), `apps/server/src/tempos.ts`
- Test: `apps/server/test/protocolo.test.ts`, `apps/server/test/tempos.test.ts`

**Step 1: Teste que falha**

Acrescente a `apps/server/test/protocolo.test.ts` (e importe `distribuirSemRitual, novaPartida, novoBaralho, reduce` de `@truco/engine` e `msgDaAcao` de `../src/mesa/protocolo`):
```ts
describe('msgDaAcao do ritual', () => {
  const comMonte = () => reduce(novaPartida(REGRAS_RANQUEADA.mineiro, 3), { tipo: 'monte', baralho: novoBaralho() });

  test('embaralhar não leva os bits; cortar leva só a fração', () => {
    const s = comMonte();
    expect(msgDaAcao({ tipo: 'embaralhar', cadeira: 3, bits: s.monte.map(() => 0 as const) }, s)).toEqual({ cadeira: 3, tipo: 'embaralhar' });
    const c = reduce(s, { tipo: 'passarCorte', cadeira: 3 });
    expect(msgDaAcao({ tipo: 'cortar', cadeira: 2, ponto: 20 }, c)).toEqual({ cadeira: 2, tipo: 'cortar', fracao: 0.5 });
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
```
Em `apps/server/test/tempos.test.ts`, no primeiro teste acrescente:
```ts
    expect(TEMPOS_RAPIDOS.ritualMs).toBeLessThanOrEqual(3_000);
    expect(TEMPOS_RAPIDOS.conferirMs).toBeUndefined();
```

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/server test protocolo tempos`
Expected: FAIL — `msgDaAcao` devolve só `{ cadeira, tipo }`; `ritualMs` indefinido.

**Step 3: Implementação**

`apps/server/src/mesa/protocolo.ts` — import do engine:
```ts
import {
  type AcaoJogador,
  type Cadeira,
  type EstadoPartida,
  type ModoDistribuicao,
  ordemDistribuicao,
  parceiroDe,
  REGRAS_RANQUEADA,
  type RegrasMesa,
  tipoDaProximaFamilia,
  type Variante,
  type Visao,
} from '@truco/engine';
```
e troque `MsgAcao`/`msgDaAcao`:
```ts
export interface MsgAcao {
  cadeira: Cadeira;
  tipo: AcaoJogador['tipo'];
  /** Só em `mao10`: true = jogou a mão, false = correu. */
  jogar?: boolean;
  /** `distribuir`: como o pé deu. */
  modo?: ModoDistribuicao;
  /** `distribuir`: quem recebeu, na ordem (sem quem ganhou o "dar 3"). */
  ordem?: Cadeira[];
  /** `dar3`: quem recebeu as 3 de cima. */
  para?: Cadeira;
  /** `cortar`: fração do monte que passou para cima (0–1, 2 casas). Só para a animação. */
  fracao?: number;
  /** `familia`: true = aberta (as cartas aparecem no `estado`). */
  aberta?: boolean;
  /** `conferir`: true = conferiu. */
  conferir?: boolean;
}

/**
 * O aviso público de uma ação (sem índice/carta: a jogada em si chega pelo `estado`).
 * `antes` = estado em que a ação foi aplicada (para a ordem da distribuição, a fração do
 * corte e o tipo da família). Nunca leva a sorte (`bits`, `ponto`).
 */
export function msgDaAcao(a: AcaoJogador, antes: EstadoPartida | null = null): MsgAcao {
  const base: MsgAcao = { cadeira: a.cadeira, tipo: a.tipo };
  switch (a.tipo) {
    case 'mao10':
      return { ...base, jogar: a.jogar };
    case 'distribuir':
      return antes ? { ...base, modo: a.modo, ordem: ordemDistribuicao(antes.pe, antes.ritual?.dadas?.cadeira ?? null) } : { ...base, modo: a.modo };
    case 'dar3':
      return { ...base, para: parceiroDe(a.cadeira) };
    case 'cortar': {
      const n = antes?.monte.length ?? 0;
      return a.ponto !== undefined && n > 0 ? { ...base, fracao: Math.round((a.ponto / n) * 100) / 100 } : base;
    }
    case 'familia':
      return antes ? { ...base, aberta: tipoDaProximaFamilia(antes) === 'aberta' } : base;
    case 'conferir':
      return { ...base, conferir: a.conferir };
    default:
      return base;
  }
}
```

`apps/server/src/mesa/Mesa.ts` — `Tempos` e `TEMPOS_PADRAO`:
```ts
export interface Tempos {
  jogadaMs: number;
  botMs: number;
  pausaMaoMs: number;
  intervaloMensagemMs: number;
  /** Prazo do humano em cada etapa do ritual (embaralhar, cortar, escolher como dar). */
  ritualMs: number;
  /** Prazo da dupla adversária para conferir uma família fechada. */
  conferirMs: number;
  /** Quanto o bot da vez espera antes da 1ª carta quando a família está ligada. */
  janelaFamiliaMs: number;
}

export const TEMPOS_PADRAO: Tempos = {
  jogadaMs: 20_000,
  botMs: 900,
  pausaMaoMs: 1_800,
  intervaloMensagemMs: 1_000,
  ritualMs: 12_000,
  conferirMs: 6_000,
  janelaFamiliaMs: 2_500,
};
```

`apps/server/src/tempos.ts`:
```ts
/** Para o E2E: bots, pausas e etapas do ritual curtos; o prazo de jogar carta continua o padrão (20 s). */
export const TEMPOS_RAPIDOS: Readonly<Partial<Tempos>> = Object.freeze({ botMs: 60, pausaMaoMs: 400, ritualMs: 3_000 });
```

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/server test protocolo tempos` → PASS. (O resto do server ainda está vermelho até a Task 10.)

**Step 5: Commit**
```bash
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "feat(server): MsgAcao do ritual (modo, ordem, para, fração) e tempos por etapa" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- apps/server/src/mesa/protocolo.ts apps/server/src/mesa/Mesa.ts apps/server/src/tempos.ts apps/server/test/protocolo.test.ts apps/server/test/tempos.test.ts
```

---

### Task 10: Server — `Mesa`: sorte do servidor, monte inicial, prazos por etapa, tempo esgotado em lote

**Files:**
- Modify: `apps/server/src/mesa/Mesa.ts`
- Test: `apps/server/test/mesa-ritual.test.ts` (novo); migrar `mesa-helpers.ts`, `mesa-tempo.test.ts`, `mesa-acoes.test.ts`, `mesa-auxiliares.test.ts`, `social.test.ts`, `integracao.test.ts`

**Step 1: Migrar os helpers e escrever o teste que falha**

`apps/server/test/mesa-helpers.ts` — troque `TEMPOS` e o padrão de regras, e acrescente dois helpers:
```ts
import { type Cadeira, mulberry32, REGRAS_RANQUEADA } from '@truco/engine';
// ...
export const TEMPOS = { jogadaMs: 1_000, botMs: 10, pausaMaoMs: 20, intervaloMensagemMs: 100, ritualMs: 1_000, conferirMs: 500, janelaFamiliaMs: 30 };

/** Regras padrão dos testes da Mesa: mineiro ranqueado sem família (família tem testes próprios). */
export const MINEIRO_SEM_FAMILIA = { ...REGRAS_RANQUEADA.mineiro, familia: 'off' as const };
```
em `criarMesa`, `regras: REGRAS_RANQUEADA.mineiro,` → `regras: MINEIRO_SEM_FAMILIA,`; e no fim do arquivo:
```ts
/** A cadeira `c` de `id` tem prazo para jogar carta (não para uma etapa do ritual). */
export function vezDeJogar(t: ReturnType<typeof criarMesa>, id = 'a', c: Cadeira = 0): boolean {
  const e = t.estado(id);
  return e?.visao?.fase === 'jogando' && !!e.prazo?.cadeiras.includes(c);
}

/** Avança até o humano 'a' (cadeira 0) estar com o monte na `fase` (no embaralhar, antes da 1ª embaralhada). */
export function ateEtapa(t: ReturnType<typeof criarMesa>, fase: 'embaralhando' | 'cortando' | 'escolhendoDistribuicao'): void {
  avancarAte(() => {
    const v = t.estado('a')?.visao;
    if (!v?.ritual || v.fase !== fase) return false;
    const dono = fase === 'cortando' ? v.ritual.cortador : v.ritual.embaralhador;
    return dono === 0 && (fase !== 'embaralhando' || v.ritual.embaralhadas === 0);
  });
}
```
- `mesa-tempo.test.ts`: `const minhaVez = (t: ReturnType<typeof criarMesa>) => vezDeJogar(t);` (importe `vezDeJogar`).
- `mesa-acoes.test.ts`: em `mesaComHumanoNaVez`, `avancarAte(() => vezDeJogar(t));`; o teste "cliente não pode distribuir" vira "cliente não pode pôr o monte" com `mesa.acao('a', { tipo: 'monte', baralho: [] });` (mesma expectativa `'ação inválida'`).
- `mesa-auxiliares.test.ts`: `inicio` termina com `return distribuirSemRitual(s, novoBaralho());` (importe de `@truco/engine`) e acrescente:
```ts
  test('no ritual: embaralha até 3 vezes e passa; corta e devolve; dá por cima; não confere', () => {
    let s = reduce(novaPartida(REGRAS_RANQUEADA.mineiro, 3), { tipo: 'monte', baralho: novoBaralho() });
    expect(jogadaAutomatica(s, 3)).toEqual({ tipo: 'embaralhar', cadeira: 3 });
    s.ritual!.embaralhadas = 3;
    expect(jogadaAutomatica(s, 3)).toEqual({ tipo: 'passarCorte', cadeira: 3 });
    s = reduce(s, { tipo: 'passarCorte', cadeira: 3 });
    expect(jogadaAutomatica(s, 2)).toEqual({ tipo: 'cortar', cadeira: 2 });
    s = reduce(s, { tipo: 'cortar', cadeira: 2, ponto: 20 });
    expect(jogadaAutomatica(s, 2)).toEqual({ tipo: 'devolver', cadeira: 2 });
    s = reduce(s, { tipo: 'devolver', cadeira: 2 });
    expect(jogadaAutomatica(s, 3)).toEqual({ tipo: 'distribuir', cadeira: 3, modo: 'porCima' });
    const f = reduce(inicio(), { tipo: 'familia', cadeira: 0 });
    expect(jogadaAutomatica(f, 1)).toEqual({ tipo: 'conferir', cadeira: 1, conferir: false });
  });
```
- `social.test.ts` (~74): `const inicio = distribuirSemRitual(novaPartida(REGRAS_RANQUEADA.mineiro, 3), novoBaralho());`.
- `integracao.test.ts`: no `beforeAll`, `MesaRoom.tempos = { botMs: 20, pausaMaoMs: 50, jogadaMs: 2_000, ritualMs: 300, conferirMs: 200, janelaFamiliaMs: 20 };`; no "caminho feliz", `MesaRoom.tempos = { botMs: 1, pausaMaoMs: 1, jogadaMs: 5, ritualMs: 5, conferirMs: 5, janelaFamiliaMs: 1 };`; o teste "cliente não consegue distribuir" vira "cliente não consegue pôr o monte" mandando `cliente.send('acao', { tipo: 'monte', baralho: [] });`.

`apps/server/test/mesa-ritual.test.ts`
```ts
import { idCarta } from '@truco/engine';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { randCripto } from '../src/mesa/Mesa';
import { TEMPOS, ateEtapa, avancarAte, criarMesa } from './mesa-helpers';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

type T = ReturnType<typeof criarMesa>;
const novas = (t: T, desde: number) => t.de('a', 'acao').slice(desde);
const comAna = (extra: Parameters<typeof criarMesa>[0] = {}) => {
  const t = criarMesa(extra);
  t.mesa.sentar('a', 'Ana');
  return t;
};

describe('ritual na Mesa', () => {
  test('a sorte é do servidor: bits que o cliente manda são ignorados', () => {
    const t = comAna();
    ateEtapa(t, 'embaralhando');
    const antes = t.mesa.partida!.monte.map(idCarta);
    t.mesa.acao('a', { tipo: 'embaralhar', bits: antes.map(() => 0) });
    expect(t.de('a', 'erro')).toEqual([]);
    expect(t.mesa.partida!.ritual!.embaralhadas).toBe(1);
    // Bits todos 0 deixariam o monte igual; os do servidor mexem.
    expect(t.mesa.partida!.monte.map(idCarta)).not.toEqual(antes);
  });

  test('as mensagens acao nunca levam a sorte; distribuir leva modo e ordem; cortar, a fração', () => {
    const t = comAna();
    avancarAte(() => t.de('a', 'acao').some((a) => a.tipo === 'distribuir'));
    const msgs = t.de('a', 'acao');
    expect(JSON.stringify(msgs)).not.toMatch(/bits|ponto/);
    const d = msgs.find((a) => a.tipo === 'distribuir')!;
    expect(d.modo).toBe('porCima');
    expect(d.ordem).toHaveLength(4);
    for (const c of msgs.filter((a) => a.tipo === 'cortar')) {
      expect(c.fracao).toBeGreaterThanOrEqual(0.3);
      expect(c.fracao).toBeLessThanOrEqual(0.7);
    }
  });

  test('prazo do ritual é ritualMs; tempo esgotado embaralha 3 vezes e passa', () => {
    const t = comAna();
    ateEtapa(t, 'embaralhando');
    const restante = t.estado('a')!.prazo!.ate - Date.now();
    expect(restante).toBeLessThanOrEqual(TEMPOS.ritualMs);
    expect(restante).toBeGreaterThan(TEMPOS.ritualMs - 20);
    const n = t.de('a', 'acao').length;
    vi.advanceTimersByTime(TEMPOS.ritualMs);
    expect(novas(t, n).slice(0, 4)).toEqual([
      { cadeira: 0, tipo: 'embaralhar' },
      { cadeira: 0, tipo: 'embaralhar' },
      { cadeira: 0, tipo: 'embaralhar' },
      { cadeira: 0, tipo: 'passarCorte' },
    ]);
  });

  test('cortador humano: tempo esgotado corta e devolve', () => {
    const t = comAna();
    ateEtapa(t, 'cortando');
    const n = t.de('a', 'acao').length;
    vi.advanceTimersByTime(TEMPOS.ritualMs);
    const [corte, devolveu] = novas(t, n);
    expect(corte).toMatchObject({ cadeira: 0, tipo: 'cortar' });
    expect(devolveu).toEqual({ cadeira: 0, tipo: 'devolver' });
  });

  test('quem dá escolhe por baixo; tempo esgotado na escolha dá por cima', () => {
    const t = comAna();
    ateEtapa(t, 'escolhendoDistribuicao');
    t.mesa.acao('a', { tipo: 'distribuir', modo: 'porBaixo' });
    expect(t.de('a', 'acao').at(-1)).toEqual({ cadeira: 0, tipo: 'distribuir', modo: 'porBaixo', ordem: [1, 2, 3, 0] });
    expect(t.estado('a')!.visao!.mao!.modo).toBe('porBaixo');
    ateEtapa(t, 'escolhendoDistribuicao');
    const n = t.de('a', 'acao').length;
    vi.advanceTimersByTime(TEMPOS.ritualMs);
    expect(novas(t, n)[0]).toMatchObject({ cadeira: 0, tipo: 'distribuir', modo: 'porCima' });
  });

  test('aoAplicar recebe as ações sem a sorte', () => {
    const vistas: unknown[] = [];
    const t = comAna({ aoAplicar: (a) => vistas.push(a) });
    avancarAte(() => !!t.estado('a')?.visao?.mao);
    expect(vistas.length).toBeGreaterThan(0);
    expect(JSON.stringify(vistas)).not.toMatch(/bits|ponto/);
  });

  test('a sorte padrão é CSPRNG e a mesa joga com ela', () => {
    for (let i = 0; i < 100; i++) {
      const x = randCripto();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
    const t = comAna({ rand: undefined });
    avancarAte(() => !!t.estado('a')?.visao?.mao);
    expect(t.de('a', 'erro')).toEqual([]);
  });
});
```

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/server test mesa-ritual`
Expected: FAIL — `randCripto` não existe; a `Mesa` ainda manda `distribuir{baralho}` (ErroJogada) e nunca sai de `aguardandoMonte`.

**Step 3: Implementação (`apps/server/src/mesa/Mesa.ts`)**

Imports do engine (substituem os atuais):
```ts
import { webcrypto } from 'node:crypto';
import {
  type AcaoJogador,
  acoesValidas,
  baralhoDaMesa,
  botDificil,
  botFacil,
  type Cadeira,
  type Carta,
  completarSorte,
  ehAcaoJogador,
  ehFaseRitual,
  embaralhar,
  ErroJogada,
  type EstadoPartida,
  forca,
  novaPartida,
  parceiroDe,
  quemDeveAgir,
  reduce,
  type RegrasMesa,
  semSorte,
  visaoDoJogador,
} from '@truco/engine';
```

Depois de `relogioReal`:
```ts
/** Sorte do servidor (CSPRNG): monte inicial, riffles, cortes, quem começa. */
export function randCripto(): number {
  return webcrypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
}
```
No construtor: `this.rand = o.rand ?? randCripto;` (o comentário de `OpcoesMesa.rand` vira "Padrão: `randCripto`.").

`jogadaAutomatica` inteira:
```ts
/**
 * Jogada quando o tempo estoura: no ritual, a etapa padrão (embaralha até 3 vezes e passa;
 * corta uma vez e devolve; dá por cima); não confere família; corre do truco e da mão de 10;
 * senão joga a carta mais fraca.
 */
export function jogadaAutomatica(s: EstadoPartida, cadeira: Cadeira): AcaoJogador {
  const r = s.ritual;
  if (s.fase === 'embaralhando') return r && r.embaralhadas < 3 ? { tipo: 'embaralhar', cadeira } : { tipo: 'passarCorte', cadeira };
  if (s.fase === 'cortando') return r && r.movimentos === 0 ? { tipo: 'cortar', cadeira } : { tipo: 'devolver', cadeira };
  if (s.fase === 'escolhendoDistribuicao') return { tipo: 'distribuir', cadeira, modo: 'porCima' };
  if (s.fase === 'conferindoFamilia') return { tipo: 'conferir', cadeira, conferir: false };
  if (s.fase === 'respondendoTruco') return { tipo: 'correr', cadeira };
  if (s.fase === 'decisaoMao10') return { tipo: 'mao10', cadeira, jogar: false };
  const m = s.mao;
  if (!m || m.tipo === 'mao11') return { tipo: 'jogar', cadeira, indice: 0 };
  const forcas = m.maos[cadeira].map((c) => forca(c, s.regras.variante, m.vira));
  return { tipo: 'jogar', cadeira, indice: forcas.indexOf(Math.min(...forcas)) };
}
```

`acao` inteira:
```ts
  acao(id: string, bruto: unknown): void {
    const cad = this.cadeiraDe(id);
    if (cad === null || !this.estado) return;
    // A sorte é sempre do servidor: bits/ponto que venham do cliente são descartados.
    let comCadeira: unknown = bruto;
    if (bruto && typeof bruto === 'object') {
      const { bits: _b, ponto: _p, ...resto } = bruto as Record<string, unknown>;
      comCadeira = { ...resto, cadeira: cad };
    }
    if (!ehAcaoJogador(comCadeira)) {
      this.erro(id, 'ação inválida');
      return;
    }
    this.aplicar(comCadeira, id);
  }
```

`aplicar` inteira:
```ts
  /** Aplica a ação com a sorte do servidor; devolve se deu certo. Erro de humano vai para ele; de bot, para `aoErro`. */
  private aplicar(acao: AcaoJogador, idHumano?: string): boolean {
    if (!this.estado) return false;
    const antes = this.estado;
    const completa = completarSorte(semSorte(acao), antes, this.rand);
    try {
      this.estado = reduce(antes, completa);
    } catch (e) {
      if (idHumano) this.erro(idHumano, e instanceof ErroJogada ? e.message : 'erro interno');
      if (!idHumano || !(e instanceof ErroJogada)) this.falha(e);
      return false;
    }
    this.versao++;
    try {
      this.o.aoAplicar?.(semSorte(completa), idHumano !== undefined);
    } catch (e) {
      this.falha(e);
    }
    this.paraHumanos((destino) => this.o.enviar(destino, 'acao', msgDaAcao(completa, antes)));
    if (completa.tipo === 'jogar') this.comentarRodada(antes, this.estado);
    if (completa.tipo === 'distribuir') {
      this.dicas = [null, null, null, null];
      this.sinaisDosBots();
    }
    this.atualizar();
    return true;
  }
```

Em `atualizar`, troque o bloco `if (s.fase === 'aguardandoDistribuicao') { ... }` e o que vem depois dele até o `this.enviarEstados();` final por:
```ts
    if (s.fase === 'aguardandoMonte') {
      this.agendar(this.tempos.pausaMaoMs, () => this.porMonte());
      this.enviarEstados();
      return;
    }
    // Os agentes são sempre de uma só dupla (ou uma cadeira, no ritual). Havendo humano ativo
    // entre eles, ninguém decide por ele: espera o prazo; no fim, o parceiro bot (se houver) decide.
    const agentes = quemDeveAgir(s);
    const humanos = agentes.filter((c) => this.humanoAtivo(c));
    if (humanos.length > 0) {
      const ms = this.prazoMs(s);
      const substituto = agentes.find((c) => !this.humanoAtivo(c));
      this.prazo = { cadeiras: humanos, ate: this.relogio.agora() + ms };
      this.agendar(ms, () => (substituto !== undefined ? this.jogarBot(substituto) : this.estourouTempo(humanos[0])));
    } else {
      const ms = this.atrasoBot(s);
      for (const c of agentes) this.agendar(ms, () => this.jogarBot(c));
    }
    this.enviarEstados();
```

Apague `private distribuir()` e ponha:
```ts
  /** Prazo do humano: etapa do ritual, conferir família ou jogada. */
  private prazoMs(s: EstadoPartida): number {
    if (ehFaseRitual(s.fase)) return this.tempos.ritualMs;
    if (s.fase === 'conferindoFamilia') return this.tempos.conferirMs;
    return this.tempos.jogadaMs;
  }

  /** Espera do bot. A 1ª embaralhada de uma mão nova espera a pausa (o resumo da mão anterior aparece). */
  private atrasoBot(s: EstadoPartida): number {
    if (s.fase === 'embaralhando' && s.ritual?.embaralhadas === 0 && s.ultimaMao) return this.tempos.pausaMaoMs;
    return this.tempos.botMs;
  }

  /** 1ª mão: o servidor põe o monte sorteado na mesa. */
  private porMonte(): void {
    if (!this.estado) return;
    try {
      this.estado = reduce(this.estado, { tipo: 'monte', baralho: embaralhar(baralhoDaMesa(this.estado.regras), this.rand) });
      this.versao++;
    } catch (e) {
      this.falha(e);
    }
    this.atualizar(true);
  }
```

`estourouTempo` inteira:
```ts
  /** Tempo esgotado. No ritual faz a etapa inteira de uma vez (ex.: 3 embaralhadas e passa). */
  private estourouTempo(c: Cadeira): void {
    for (let i = 0; i < 8; i++) {
      const versao = this.versao;
      this.agirPor(c);
      const s = this.estado;
      if (!s || this.versao === versao || !ehFaseRitual(s.fase) || !quemDeveAgir(s).includes(c)) return;
    }
  }
```

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/server test` → PASS (todos, inclusive integração). Run: `pnpm --filter @truco/server typecheck` → ok. Se algum teste antigo da `Mesa` esperar "minha vez" com `prazo?.cadeiras.includes(0)`, troque por `vezDeJogar(t)` — a cadeira 0 agora também tem prazo no ritual.

**Step 5: Commit**
```bash
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add -- apps/server/test/mesa-ritual.test.ts
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "feat(server): ritual na Mesa com sorte CSPRNG, prazos por etapa e tempo esgotado em lote" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- apps/server/src/mesa/Mesa.ts apps/server/test
```

---

### Task 11: Server — `Mesa`: janela de família dos bots, conferir, dicas; `RegistroMesa`

**Files:**
- Modify: `apps/server/src/mesa/Mesa.ts`
- Test: `apps/server/test/mesa-familia.test.ts` (novo), `apps/server/test/resultado.test.ts`

**Step 1: Teste que falha**

`apps/server/test/mesa-familia.test.ts`
```ts
import { type AcaoJogador, botFacil, type Cadeira, type EstadoPartida, janelaDeFamilia, REGRAS_RANQUEADA } from '@truco/engine';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { TEMPOS, avancarAte, criarMesa } from './mesa-helpers';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** Família fechada ligada. */
const MINEIRO = REGRAS_RANQUEADA.mineiro;

/**
 * O bot da cadeira 1 pede família fechada uma vez, na primeira janela; no resto é o bot fácil,
 * mas sem pedir outras famílias (assim o teste não depende das mãos sorteadas).
 */
function pedeUmaVez() {
  let pediu = false;
  return (s: EstadoPartida, c: Cadeira): AcaoJogador | null => {
    if (!pediu && c === 1 && janelaDeFamilia(s)) {
      pediu = true;
      return { tipo: 'familia', cadeira: 1 };
    }
    const a = botFacil(s, c);
    return a?.tipo === 'familia' ? null : a;
  };
}

function ateConferir() {
  const t = criarMesa({ regras: MINEIRO, decidirBot: pedeUmaVez() });
  t.mesa.sentar('a', 'Ana');
  avancarAte(() => t.estado('a')?.visao?.fase === 'conferindoFamilia');
  return t;
}

describe('família na Mesa', () => {
  test('bot pede na janela; a dupla humana tem conferirMs e confere', () => {
    const t = ateConferir();
    const e = t.estado('a')!;
    expect(t.de('a', 'acao').at(-1)).toEqual({ cadeira: 1, tipo: 'familia', aberta: false });
    expect(e.prazo!.cadeiras).toEqual([0]);
    expect(e.prazo!.ate - Date.now()).toBeLessThanOrEqual(TEMPOS.conferirMs);
    expect(e.minhasAcoes).toEqual([
      { tipo: 'conferir', cadeira: 0, conferir: true },
      { tipo: 'conferir', cadeira: 0, conferir: false },
    ]);
    expect(e.visao!.mao!.familias[0].cartas).toBeNull();
    const [a, b] = e.visao!.placar;
    t.mesa.acao('a', { tipo: 'conferir', conferir: true });
    expect(t.de('a', 'acao').at(-1)).toEqual({ cadeira: 0, tipo: 'conferir', conferir: true });
    const v = t.estado('a')!.visao!;
    expect(v.mao!.familias[0].conferida!.por).toBe(0);
    expect(v.mao!.familias[0].cartas).toHaveLength(3);
    expect(v.placar[0] + v.placar[1]).toBe(a + b + 2);
  });

  test('prazo do conferir acaba: o parceiro bot decide (o fácil deixa passar a 1ª)', () => {
    const t = ateConferir();
    const placar = [...t.estado('a')!.visao!.placar];
    vi.advanceTimersByTime(TEMPOS.conferirMs);
    expect(t.de('a', 'acao').find((x) => x.tipo === 'conferir')).toEqual({ cadeira: 2, tipo: 'conferir', conferir: false });
    expect(t.estado('a')!.visao!.placar).toEqual(placar);
  });

  test('o bot da vez espera a janela de família antes da 1ª carta', () => {
    const t = criarMesa({ regras: MINEIRO, tempos: { ...TEMPOS, janelaFamiliaMs: 400 } });
    t.mesa.sentar('a', 'Ana');
    avancarAte(() => t.de('a', 'acao').at(-1)?.tipo === 'distribuir', 1);
    const t0 = Date.now();
    const n = t.de('a', 'acao').length;
    avancarAte(() => t.de('a', 'acao').slice(n).some((x) => x.tipo === 'jogar'), 1);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(400);
  });
});
```

Acrescente a `apps/server/test/resultado.test.ts`, no `describe` de `contarAcao`:
```ts
  test('ritual e família não contam como truco nem corrida', () => {
    let c = contadoresZerados();
    const acoes: AcaoJogador[] = [
      { tipo: 'embaralhar', cadeira: 0 },
      { tipo: 'passarCorte', cadeira: 0 },
      { tipo: 'cortar', cadeira: 0 },
      { tipo: 'abrir3', cadeira: 0 },
      { tipo: 'dar3', cadeira: 0 },
      { tipo: 'devolver', cadeira: 0 },
      { tipo: 'distribuir', cadeira: 0, modo: 'subindo' },
      { tipo: 'familia', cadeira: 0 },
      { tipo: 'conferir', cadeira: 0, conferir: true },
    ];
    for (const a of acoes) c = contarAcao(c, a);
    expect(c).toEqual(contadoresZerados());
  });
```
(importe `type AcaoJogador` de `@truco/engine`).

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/server test mesa-familia resultado`
Expected: FAIL — bots fora da vez nunca pedem família (timeout em `avancarAte`); o bot da vez joga depois de `botMs`.

**Step 3: Implementação (`apps/server/src/mesa/Mesa.ts`)**

Importe `janelaDeFamilia` de `@truco/engine`. Em `atrasoBot`, antes do `return this.tempos.botMs;`:
```ts
    // A vez espera a janela de família: dá tempo de alguém (humano) pedir antes da 1ª carta.
    if (janelaDeFamilia(s)) return Math.max(this.tempos.botMs, this.tempos.janelaFamiliaMs);
```
Em `atualizar`, logo antes do `this.enviarEstados();` final: `this.familiasDosBots(s, agentes);`. Novos métodos:
```ts
  /** Na janela de família, os bots fora da vez também podem pedir (uma consulta por mudança de estado). */
  private familiasDosBots(s: EstadoPartida, agentes: Cadeira[]): void {
    if (!janelaDeFamilia(s)) return;
    for (const c of CADEIRAS) {
      if (agentes.includes(c) || this.humanoAtivo(c)) continue;
      this.agendar(this.tempos.botMs, () => this.familiaDoBot(c));
    }
  }

  private familiaDoBot(c: Cadeira): void {
    const s = this.estado;
    if (!s || !janelaDeFamilia(s)) return;
    let a: AcaoJogador | null = null;
    try {
      a = this.decidirBot(s, c);
    } catch (e) {
      this.falha(e);
    }
    if (a?.tipo === 'familia' && a.cadeira === c) this.aplicar(a);
  }
```
Em `aplicar`, depois do bloco de `distribuir`:
```ts
    // Quem pediu família trocou as cartas: o sinal que o parceiro tinha não vale mais.
    if (completa.tipo === 'familia') this.dicas[parceiroDe(completa.cadeira)] = null;
```

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/server test` → PASS. Run: `pnpm --filter @truco/server typecheck` → ok.

**Step 5: Commit**
```bash
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add -- apps/server/test/mesa-familia.test.ts
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "feat(server): janela de família para bots, conferir com prazo e dicas" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- apps/server/src/mesa/Mesa.ts apps/server/test/mesa-familia.test.ts apps/server/test/resultado.test.ts
```

---

### Task 12: Server — integração do ritual pela sala real

**Files:**
- Test: `apps/server/test/integracao.test.ts` (o único arquivo de integração; porta 2568)

**Step 1: Escrever o teste**

No `describe('MesaRoom')` de `apps/server/test/integracao.test.ts`, depois de "cliente não consegue pôr o monte":
```ts
  test('ritual pela sala: as etapas chegam sem a sorte, a visão não traz o monte e a mão sai', async () => {
    const sala = await colyseus.createRoom('mesa', { variante: 'mineiro', humanos: 1 });
    const cliente = await colyseus.connectTo(sala, { nome: 'Ana' });
    const msgs = coletor(cliente);
    await esperar(() => !!msgs.acao?.some((a) => a.tipo === 'distribuir'), 10_000);
    const tipos: string[] = msgs.acao.map((a) => a.tipo);
    expect(tipos.indexOf('passarCorte')).toBeGreaterThanOrEqual(0);
    expect(tipos.indexOf('passarCorte')).toBeLessThan(tipos.indexOf('distribuir'));
    expect(JSON.stringify(msgs.acao)).not.toMatch(/"bits"|"ponto"/);
    const dist = msgs.acao.find((a) => a.tipo === 'distribuir');
    expect(['porCima', 'porBaixo', 'subindo']).toContain(dist.modo);
    await esperar(() => !!msgs.estado?.some((m) => m.visao?.mao));
    const ultimo = msgs.estado.at(-1);
    expect(typeof ultimo.visao.qtdMonte).toBe('number');
    expect(JSON.stringify(ultimo)).not.toContain('"monte"');
  });

  test('bits mandados pelo cliente não quebram nada: ou é a vez dele e o servidor sorteia, ou é erro de vez', async () => {
    const sala = await colyseus.createRoom('mesa', { variante: 'paulista', humanos: 1 });
    const cliente = await colyseus.connectTo(sala, { nome: 'Ana' });
    const msgs = coletor(cliente);
    await esperar(() => !!msgs.estado?.some((m) => m.visao?.ritual));
    cliente.send('acao', { tipo: 'embaralhar', bits: new Array(40).fill(0) });
    await esperar(() => !!msgs.erro?.length || !!msgs.acao?.some((a) => a.cadeira === 0 && a.tipo === 'embaralhar'));
    expect(JSON.stringify(msgs.acao ?? [])).not.toMatch(/"bits"/);
  });
```

**Step 2: Rodar**

Run: `pnpm --filter @truco/server test integracao`
Expected: PASS (os dois novos e todos os antigos). Se o segundo teste não ver nem erro nem ação, é porque o estado mudou antes do envio — ele aceita os dois casos; não o deixe mais rígido (a cadeira de quem embaralha é sorteada).

**Step 3: Rodar o server inteiro**

Run: `pnpm --filter @truco/server test` → PASS.

**Step 4: Commit**
```bash
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "test(server): integração do ritual pela sala" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- apps/server/test/integracao.test.ts
```

---
### Task 13: Web — lógica: botões, textos, eventos, loja (`movimentos`), fixtures

**Files:**
- Create: `apps/web/src/logica/ritual.ts`
- Modify: `apps/web/src/logica/acoes.ts`, `apps/web/src/logica/eventos.ts`, `apps/web/src/logica/textos.ts`, `apps/web/src/rede/loja.ts`, `apps/web/src/componentes/BarraAcoes.tsx`
- Test: `apps/web/test/ritual-logica.test.ts` (novo); `fixtures.ts`, `acoes.test.ts`, `barra-acoes.test.tsx`, `eventos.test.ts`, `loja.test.ts`, `textos.test.ts`

**Step 1: Fixtures e testes que falham**

`apps/web/test/fixtures.ts` — importe `distribuirSemRitual` de `@truco/engine` e troque `distribuida`; acrescente `noRitual`:
```ts
export function distribuida(regras: RegrasMesa, maos?: string[][], placar: [number, number] = [0, 0], vira?: string): EstadoPartida {
  const s = novaPartida(regras, 3);
  s.placar = placar;
  return distribuirSemRitual(s, baralhoCom(maos, vira, baralhoDaMesa(regras)));
}

/** Começo do ritual com pe = 3 (a 3 embaralha e dá, a 2 corta); monte na ordem do baralho da mesa. */
export function noRitual(regras: RegrasMesa = PAULISTA): EstadoPartida {
  return reduce(novaPartida(regras, 3), { tipo: 'monte', baralho: baralhoDaMesa(regras) });
}
```

`apps/web/test/acoes.test.ts` — `ui` passa a receber a visão inteira; o teste de família muda e entram os do ritual:
```ts
const ui = (s: EstadoPartida, c: Cadeira) => agruparAcoes(acoesValidas(s, c), visaoDoJogador(s, c));
```
```ts
  test('família fechada aparece para todos na janela (blefe vale)', () => {
    const s = distribuida(MINEIRO, [['Qo', 'Jo', 'Ko'], ['3e', '5e', '6e'], ['4c', '5c', '6c'], ['2e', '5p', '6p']]);
    expect(rotulos(s, 0)).toEqual(['Truco!', 'Pedir família fechada']);
    expect(rotulos(s, 1)).toEqual(['Pedir família fechada']);
  });
});

describe('agruparAcoes no ritual e na família', () => {
  test('embaralhador: Embaralhar e Passar pra cortar; cortador: Cortar, Embaralhar, Abrir 3, Dar 3, Devolver', () => {
    const s = noRitual();
    expect(rotulos(s, 3)).toEqual(['Embaralhar', 'Passar pra cortar']);
    const t = reduce(s, { tipo: 'passarCorte', cadeira: 3 });
    expect(rotulos(t, 2)).toEqual(['Cortar', 'Embaralhar', 'Abrir 3', 'Dar 3', 'Devolver']);
    expect(ui(t, 2).botoes[0].acao).toEqual({ tipo: 'cortar', cadeira: 2 });
  });

  test('quem dá: os 3 modos', () => {
    const u = reduce(reduce(noRitual(), { tipo: 'passarCorte', cadeira: 3 }), { tipo: 'devolver', cadeira: 2 });
    expect(rotulos(u, 3)).toEqual(['Por cima', 'Por baixo', 'Subindo alternado']);
  });

  test('mesa aberta pede aberta; conferir é da dupla adversária', () => {
    const fam = [['Qo', 'Jo', 'Ko']];
    expect(rotulos(distribuida({ ...PAULISTA, familia: 'aberta' }, fam), 0)).toEqual(['Truco!', 'Pedir família aberta']);
    const t = reduce(distribuida(MINEIRO, fam), { tipo: 'familia', cadeira: 0 });
    expect(rotulos(t, 1)).toEqual(['Conferir', 'Deixar passar']);
    expect(rotulos(t, 0)).toEqual([]);
  });
});
```
(importe `noRitual` de `./fixtures`.)

`apps/web/test/barra-acoes.test.tsx`: `agruparAcoes(acoesValidas(s, 1), v.mao)` → `agruparAcoes(acoesValidas(s, 1), v)`.

`apps/web/test/textos.test.ts`: tire `textoFamilia` do import e apague o teste "aviso de família"; acrescente:
```ts
  test('partida fechada por família conferida', () => {
    const u: VisaoResultadoMao = { vencedor: 0, pontos: 2, motivo: 'familia', rodadas: [], rodadasJogadas: [], vira: null };
    expect(resumoFimMao(u, 0).detalhe).toBe('+2 pontos — na família conferida');
  });
```

`apps/web/test/eventos.test.ts` — acrescente:
```ts
  test('ritual e família viram balões curtos', () => {
    expect(textoDaAcao({ cadeira: 3, tipo: 'embaralhar' }, null)).toBe('Embaralhando…');
    expect(textoDaAcao({ cadeira: 3, tipo: 'passarCorte' }, null)).toBe('Corta aí!');
    expect(textoDaAcao({ cadeira: 2, tipo: 'cortar', fracao: 0.4 }, null)).toBe('Cortei.');
    expect(textoDaAcao({ cadeira: 2, tipo: 'abrir3' }, null)).toBe('Abri 3!');
    expect(textoDaAcao({ cadeira: 2, tipo: 'dar3', para: 0 }, null)).toBe('Toma 3, parceiro!');
    expect(textoDaAcao({ cadeira: 2, tipo: 'devolver' }, null)).toBe('Pode dar.');
    expect(textoDaAcao({ cadeira: 3, tipo: 'distribuir', modo: 'subindo', ordem: [0, 1, 2, 3] }, null)).toBe('Subindo!');
    expect(textoDaAcao({ cadeira: 0, tipo: 'familia', aberta: false }, null)).toBe('Família fechada!');
    expect(textoDaAcao({ cadeira: 0, tipo: 'familia', aberta: true }, null)).toBe('Família aberta!');
    expect(textoDaAcao({ cadeira: 1, tipo: 'conferir', conferir: true }, null)).toBe('Confere!');
    expect(textoDaAcao({ cadeira: 1, tipo: 'conferir', conferir: false }, null)).toBeNull();
  });
```
(o teste antigo `textoDaAcao({ cadeira: 1, tipo: 'familia' }, null)` → `'Família!'` continua valendo.)

`apps/web/test/loja.test.ts` — acrescente:
```ts
  test('toda mensagem acao vira um movimento (para as animações), com id crescente', () => {
    const { loja, sala } = montar();
    loja.conectar(sala);
    sala.receber('acao', { cadeira: 3, tipo: 'embaralhar' });
    sala.receber('acao', { cadeira: 3, tipo: 'distribuir', modo: 'porCima', ordem: [0, 1, 2, 3] });
    const mov = loja.getSnapshot().movimentos!;
    expect(mov.map((m) => m.msg.tipo)).toEqual(['embaralhar', 'distribuir']);
    expect(mov[1].id).toBeGreaterThan(mov[0].id);
  });
```

`apps/web/test/ritual-logica.test.ts`
```ts
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
```

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/web test ritual-logica acoes barra-acoes eventos loja textos`
Expected: FAIL — `../src/logica/ritual` não existe; rótulos antigos.

**Step 3: Implementação**

`apps/web/src/logica/ritual.ts`
```ts
import { type Cadeira, duplaDe, ESCADAS, type FamiliaVisivel, MOVIMENTOS_CORTE, type Visao } from '@truco/engine';
import type { MsgAcao } from '@truco/protocolo';
import { type Posicao, posicaoRelativa } from './posicoes';

/** Quem está com o monte: no ritual, quem age (embaralhador ou cortador); na mão, o pé (quem deu). */
export function donoDoMonte(v: Pick<Visao, 'qtdMonte' | 'ritual' | 'fase' | 'mao' | 'pe'>): Cadeira | null {
  if (v.qtdMonte === 0) return null;
  const r = v.ritual;
  if (r) return v.fase === 'cortando' ? r.cortador : r.embaralhador;
  return v.mao ? v.pe : null;
}

const vezes = (n: number) => (n > 0 ? ` (${n}×)` : '');
const movimentos = (n: number) => `${n} ${n === 1 ? 'movimento' : 'movimentos'}`;

/** Linha de estado do centro da mesa (ritual e conferência). null = nada a dizer. */
export function textoEtapa(v: Visao, nome: (c: Cadeira) => string): string | null {
  const r = v.ritual;
  const eu = (c: Cadeira) => c === v.cadeira;
  if (v.fase === 'aguardandoMonte') return 'Separando o baralho…';
  if (r && v.fase === 'embaralhando')
    return eu(r.embaralhador) ? `Sua vez de embaralhar${vezes(r.embaralhadas)}` : `${nome(r.embaralhador)} está embaralhando${vezes(r.embaralhadas)}`;
  if (r && v.fase === 'cortando') {
    const restam = movimentos(MOVIMENTOS_CORTE - r.movimentos);
    return eu(r.cortador) ? `Sua vez de cortar — ${restam}` : `${nome(r.cortador)} vai cortar — ${restam}`;
  }
  if (r && v.fase === 'escolhendoDistribuicao') return eu(r.embaralhador) ? 'Como você vai dar as cartas?' : `${nome(r.embaralhador)} vai dar as cartas`;
  const m = v.mao;
  if (m && v.fase === 'conferindoFamilia' && m.familiaPendente !== null) {
    const f = m.familias[m.familiaPendente];
    if (duplaDe(f.cadeira) !== duplaDe(v.cadeira)) return `${nome(f.cadeira)} pediu família fechada. Conferir?`;
    return eu(f.cadeira) ? 'Esperando os adversários: conferem ou não?' : `${nome(f.cadeira)} pediu família fechada — esperando os adversários`;
  }
  return null;
}

/** Legenda de uma família na mesa (com o resultado, se foi conferida). */
export function textoFamilia(f: FamiliaVisivel, v: Pick<Visao, 'cadeira' | 'regras'>, nome: (c: Cadeira) => string): string {
  if (f.tipo === 'aberta') return `${nome(f.cadeira)} mostrou família`;
  if (!f.conferida) return `${nome(f.cadeira)}: família fechada`;
  const ganhou = f.conferida.real ? duplaDe(f.cadeira) : duplaDe(f.conferida.por);
  const pra = ganhou === duplaDe(v.cadeira) ? 'nós' : 'eles';
  const base = ESCADAS[v.regras.pontuacao][0];
  return `${nome(f.conferida.por)} conferiu: ${f.conferida.real ? 'era família' : 'era blefe'}! +${base} pra ${pra}`;
}

export interface PassoDistribuicao {
  pos: Posicao;
  qtd: 1 | 3;
  /** Sai do fundo do monte (por baixo, subindo). */
  deBaixo: boolean;
}

/** Os voos da animação de distribuir, na ordem e no modo certos. */
export function passosDistribuicao(a: MsgAcao, minha: Cadeira): PassoDistribuicao[] {
  if (a.tipo !== 'distribuir' || !a.modo || !a.ordem) return [];
  const deBaixo = a.modo !== 'porCima';
  const pos = a.ordem.map((c) => posicaoRelativa(minha, c));
  if (a.modo === 'subindo') return [0, 1, 2].flatMap(() => pos.map((p) => ({ pos: p, qtd: 1 as const, deBaixo })));
  return pos.map((p) => ({ pos: p, qtd: 3 as const, deBaixo }));
}

/** O resumo da mão anterior fica na tela até o pé novo embaralhar a 1ª vez. */
export function mostrarResumoMao(v: Visao): boolean {
  return !v.mao && v.fase === 'embaralhando' && v.ritual?.embaralhadas === 0 && v.ultimaMao !== null;
}
```

`apps/web/src/logica/acoes.ts` (arquivo inteiro):
```ts
import { type AcaoJogador, tipoDaProximaFamilia, type Visao } from '@truco/engine';
import { nomePedido } from './textos';

export type ChaveBotao =
  | 'aceitar'
  | 'aumentar'
  | 'truco'
  | 'familia'
  | 'conferir-sim'
  | 'conferir-nao'
  | 'mao10-sim'
  | 'correr'
  | 'mao10-nao'
  | 'cortar'
  | 'embaralhar'
  | 'passarCorte'
  | 'abrir3'
  | 'dar3'
  | 'devolver'
  | 'dist-porCima'
  | 'dist-porBaixo'
  | 'dist-subindo';

export interface BotaoAcao {
  chave: ChaveBotao;
  rotulo: string;
  /** Ação exatamente como veio em `minhasAcoes` — é o que se envia. */
  acao: AcaoJogador;
  tom: 'principal' | 'neutro' | 'perigo';
}

export interface AcoesUI {
  /** Índices de `minhaMao` jogáveis abertos. */
  jogaveis: number[];
  /** Índices jogáveis cobertos (2ª rodada em diante). */
  cobriveis: number[];
  botoes: BotaoAcao[];
}

const ORDEM: ChaveBotao[] = [
  'aceitar',
  'aumentar',
  'truco',
  'familia',
  'conferir-sim',
  'conferir-nao',
  'mao10-sim',
  'correr',
  'mao10-nao',
  'cortar',
  'embaralhar',
  'passarCorte',
  'abrir3',
  'dar3',
  'devolver',
  'dist-porCima',
  'dist-porBaixo',
  'dist-subindo',
];

const ROTULO_MODO = { porCima: 'Por cima', porBaixo: 'Por baixo', subindo: 'Subindo alternado' } as const;

/** Separa `minhasAcoes` em cartas jogáveis e botões, com rótulos ("Truco!", "Passar pra cortar"...). */
export function agruparAcoes(acoes: AcaoJogador[], v: Pick<Visao, 'mao' | 'regras'> | null): AcoesUI {
  const m = v?.mao ?? null;
  const jogaveis: number[] = [];
  const cobriveis: number[] = [];
  const botoes: BotaoAcao[] = [];
  const botao = (chave: ChaveBotao, rotulo: string, acao: AcaoJogador, tom: BotaoAcao['tom'] = 'neutro') =>
    botoes.push({ chave, rotulo, acao, tom });
  for (const a of acoes) {
    switch (a.tipo) {
      case 'jogar':
        (a.coberta ? cobriveis : jogaveis).push(a.indice);
        break;
      case 'truco':
        botao('truco', `${nomePedido((m?.nivel ?? 0) + 1)}!`, a, 'principal');
        break;
      case 'aumentar':
        botao('aumentar', `${nomePedido((m?.trucoPendente?.proposto ?? 1) + 1)}!`, a, 'principal');
        break;
      case 'aceitar':
        botao('aceitar', 'Aceitar', a);
        break;
      case 'correr':
        botao('correr', 'Correr', a, 'perigo');
        break;
      case 'familia':
        botao('familia', v && tipoDaProximaFamilia(v) === 'aberta' ? 'Pedir família aberta' : 'Pedir família fechada', a, 'principal');
        break;
      case 'conferir':
        if (a.conferir) botao('conferir-sim', 'Conferir', a, 'principal');
        else botao('conferir-nao', 'Deixar passar', a);
        break;
      case 'mao10':
        if (a.jogar) botao('mao10-sim', 'Jogar a mão', a, 'principal');
        else botao('mao10-nao', 'Correr da mão', a, 'perigo');
        break;
      case 'embaralhar':
        botao('embaralhar', 'Embaralhar', a);
        break;
      case 'passarCorte':
        botao('passarCorte', 'Passar pra cortar', a, 'principal');
        break;
      case 'cortar':
        botao('cortar', 'Cortar', a, 'principal');
        break;
      case 'abrir3':
        botao('abrir3', 'Abrir 3', a);
        break;
      case 'dar3':
        botao('dar3', 'Dar 3', a);
        break;
      case 'devolver':
        botao('devolver', 'Devolver', a);
        break;
      case 'distribuir':
        botao(`dist-${a.modo}` as const, ROTULO_MODO[a.modo], a, a.modo === 'porCima' ? 'principal' : 'neutro');
        break;
    }
  }
  botoes.sort((x, y) => ORDEM.indexOf(x.chave) - ORDEM.indexOf(y.chave));
  return { jogaveis, cobriveis, botoes };
}
```

`apps/web/src/componentes/BarraAcoes.tsx` — o mapa de estilo ganha as chaves novas:
```ts
const ESTILO: Partial<Record<BotaoAcao['chave'], string>> = {
  truco: 'grito',
  aumentar: 'grito',
  aceitar: 'aceitar',
  familia: 'papel',
  'conferir-sim': 'grito',
  'mao10-sim': 'papel',
  passarCorte: 'papel',
  cortar: 'papel',
  'dist-porCima': 'papel',
};
```

`apps/web/src/logica/eventos.ts` — o `switch` de `textoDaAcao` ganha:
```ts
    case 'familia':
      return a.aberta === undefined ? 'Família!' : a.aberta ? 'Família aberta!' : 'Família fechada!';
    case 'embaralhar':
      return 'Embaralhando…';
    case 'passarCorte':
      return 'Corta aí!';
    case 'cortar':
      return 'Cortei.';
    case 'abrir3':
      return 'Abri 3!';
    case 'dar3':
      return 'Toma 3, parceiro!';
    case 'devolver':
      return 'Pode dar.';
    case 'distribuir':
      return a.modo === 'porBaixo' ? 'Por baixo!' : a.modo === 'subindo' ? 'Subindo!' : 'Por cima!';
    case 'conferir':
      return a.conferir ? 'Confere!' : null;
```
(substitua o `case 'familia': return 'Família!';` antigo por este.)

`apps/web/src/logica/textos.ts` — apague `textoFamilia`; em `resumoFimMao`, troque o cálculo de `motivo` por:
```ts
  const motivo =
    u.motivo === 'rodadas'
      ? 'nas rodadas'
      : u.motivo === 'familia'
        ? 'na família conferida'
        : u.motivo === 'correu'
          ? nos
            ? 'eles correram'
            : 'nós corremos'
          : nos
            ? 'eles correram na mão de 10'
            : 'corremos na mão de 10';
```

`apps/web/src/rede/loja.ts`:
```ts
/** Uma mensagem `acao` recebida, para as animações (o `id` só cresce). */
export interface Movimento {
  id: number;
  msg: MsgAcao;
}
```
em `EstadoLoja`:
```ts
  /** Últimas mensagens `acao` (até 20), na ordem; ausente = nenhuma. As animações do ritual leem daqui. */
  movimentos?: Movimento[];
```
`INICIAL` e o `mudar` de `largar` e de `conectar` ganham `movimentos: []`; o handler de `acao` vira:
```ts
    s.onMessage('acao', (a: MsgAcao) => {
      if (sala !== s) return;
      mudar({ movimentos: [...(estado.movimentos ?? []), { id: ++seq, msg: a }].slice(-20) });
      const texto = textoDaAcao(a, estado.msg?.visao ?? null);
      if (texto) evento({ tipo: 'acao', de: a.cadeira, texto });
    });
```
(Se o teste "ação de truco vira balão" contar notificações de ouvinte, ajuste a contagem: agora cada `acao` notifica uma vez a mais.)

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/web test ritual-logica acoes barra-acoes eventos loja textos` → PASS. (O typecheck do web e os testes de tela voltam na Task 14: `Mesa.tsx` ainda usa `textoFamilia`/`ultimaFamilia`.)

**Step 5: Commit**
```bash
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add -- apps/web/src/logica/ritual.ts apps/web/test/ritual-logica.test.ts
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "feat(web): botões, textos e movimentos do ritual e da família" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- apps/web/src/logica apps/web/src/rede/loja.ts apps/web/src/componentes/BarraAcoes.tsx apps/web/test
```

---

### Task 14: Web — monte, famílias na mesa, centro e `TelaMesa` (+ CSS)

**Files:**
- Create: `apps/web/src/componentes/Monte.tsx`, `apps/web/src/componentes/FamiliasNaMesa.tsx`
- Modify: `apps/web/src/componentes/CentroMesa.tsx`, `apps/web/src/telas/Mesa.tsx`, `apps/web/src/componentes/animacaoMesa.ts` (só `deslizarDe`), `apps/web/src/estilos.css`
- Test: `apps/web/test/tela-mesa.test.tsx`, `apps/web/test/centro-mesa.test.tsx`

**Step 1: Testes que falham**

Em `apps/web/test/tela-mesa.test.tsx`, apague os testes "família aberta: o aviso mostra as 3 cartas de quem pediu" e "família fechada: só o aviso, sem cartas" e acrescente (importe `noRitual` de `./fixtures`):
```ts
describe('TelaMesa no ritual e na família', () => {
  test('quem embaralha: monte com a contagem do seu lado, linha de estado e os dois botões', async () => {
    const user = userEvent.setup();
    const acoes = acoesFalsas();
    render(<TelaMesa snap={snap(msgEstado(noRitual(), 3))} acoes={acoes} />);
    const monte = screen.getByTestId('monte');
    expect(monte).toHaveAccessibleName('Monte com 40 cartas');
    expect(monte).toHaveClass('monte-baixo');
    expect(screen.getByText('Sua vez de embaralhar')).toBeInTheDocument();
    const barra = screen.getByRole('toolbar', { name: 'Ações' });
    expect(within(barra).getAllByRole('button').map((b) => b.textContent)).toEqual(['Embaralhar', 'Passar pra cortar']);
    await user.click(screen.getByRole('button', { name: 'Passar pra cortar' }));
    expect(acoes.enviarAcao).toHaveBeenCalledWith({ tipo: 'passarCorte', cadeira: 3 });
    expect(screen.queryByTestId('minha-mao')).toBeNull();
  });

  test('quem corta: as 5 opções e o monte com ele', () => {
    const t = reduce(noRitual(), { tipo: 'passarCorte', cadeira: 3 });
    render(<TelaMesa snap={snap(msgEstado(t, 2))} acoes={acoesFalsas()} />);
    const barra = screen.getByRole('toolbar', { name: 'Ações' });
    expect(within(barra).getAllByRole('button').map((b) => b.textContent)).toEqual(['Cortar', 'Embaralhar', 'Abrir 3', 'Dar 3', 'Devolver']);
    expect(screen.getByTestId('monte')).toHaveClass('monte-baixo');
    expect(screen.getByText('Sua vez de cortar — 3 movimentos')).toBeInTheDocument();
  });

  test('quem dá escolhe o modo', async () => {
    const user = userEvent.setup();
    const acoes = acoesFalsas();
    const u = reduce(reduce(noRitual(), { tipo: 'passarCorte', cadeira: 3 }), { tipo: 'devolver', cadeira: 2 });
    render(<TelaMesa snap={snap(msgEstado(u, 3))} acoes={acoes} />);
    await user.click(screen.getByRole('button', { name: 'Subindo alternado' }));
    expect(acoes.enviarAcao).toHaveBeenCalledWith({ tipo: 'distribuir', cadeira: 3, modo: 'subindo' });
  });

  test('abrir 3: as abertas aparecem para todos ao lado do monte', () => {
    const t = reduce(reduce(noRitual(), { tipo: 'passarCorte', cadeira: 3 }), { tipo: 'abrir3', cadeira: 2 });
    render(<TelaMesa snap={snap(msgEstado(t, 0))} acoes={acoesFalsas()} />);
    const abertas = screen.getByTestId('abertas-corte');
    expect(within(abertas).getByRole('img', { name: /^4 de ouros/ })).toBeInTheDocument();
    expect(within(abertas).getAllByRole('img')).toHaveLength(3);
  });

  test('família fechada: 3 versos na frente de quem pediu; a dupla adversária confere', async () => {
    const user = userEvent.setup();
    const acoes = acoesFalsas();
    const t = reduce(distribuida(MINEIRO, [['Qo', 'Jo', 'Ko']]), { tipo: 'familia', cadeira: 0 });
    render(<TelaMesa snap={snap(msgEstado(t, 1))} acoes={acoes} />);
    const fam = screen.getByTestId('familia');
    expect(fam).toHaveClass('pos-esquerda');
    expect(within(fam).getAllByRole('img', { name: 'carta virada' })).toHaveLength(3);
    expect(fam).toHaveTextContent('Ana: família fechada');
    expect(screen.getByText('Ana pediu família fechada. Conferir?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Conferir' }));
    expect(acoes.enviarAcao).toHaveBeenCalledWith({ tipo: 'conferir', cadeira: 1, conferir: true });
  });

  test('conferida: todos veem as 3 cartas e o resultado', () => {
    const t = reduce(distribuida(MINEIRO, [['Qo', 'Jo', 'Ko']]), { tipo: 'familia', cadeira: 0 });
    const u = reduce(t, { tipo: 'conferir', cadeira: 1, conferir: true });
    render(<TelaMesa snap={snap(msgEstado(u, 2))} acoes={acoesFalsas()} />);
    const fam = screen.getByTestId('familia-conferida');
    expect(fam).toHaveTextContent('Bot Zé conferiu: era família! +2 pra nós');
    expect(within(fam).getByRole('img', { name: /^Dama de ouros/ })).toBeInTheDocument();
    expect(within(fam).queryAllByRole('img', { name: 'carta virada' })).toHaveLength(0);
  });

  test('entre mãos: o resumo fica até o pé novo embaralhar', () => {
    let s = distribuida(PAULISTA);
    s = reduce(reduce(s, { tipo: 'truco', cadeira: 0 }), { tipo: 'correr', cadeira: 1 });
    const { rerender } = render(<TelaMesa snap={snap(msgEstado(s, 0))} acoes={acoesFalsas()} />);
    expect(screen.getByTestId('fim-mao')).toBeInTheDocument();
    const e = reduce(s, { tipo: 'embaralhar', cadeira: s.pe, bits: s.monte.map(() => 0 as const) });
    rerender(<TelaMesa snap={snap(msgEstado(e, 0))} acoes={acoesFalsas()} />);
    expect(screen.queryByTestId('fim-mao')).toBeNull();
  });
});
```

Em `apps/web/test/centro-mesa.test.tsx`:
```ts
  test('sem mão nem última mão o centro existe e mostra o extra (monte)', () => {
    render(<CentroMesa mao={null} ultimaMao={null} minha={0} variante="paulista" extra={<span>monte aqui</span>} />);
    expect(screen.getByTestId('centro')).toHaveTextContent('monte aqui');
  });
```

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/web test tela-mesa centro-mesa`
Expected: FAIL — sem `monte`, sem botões do ritual, `extra` não existe.

**Step 3: Implementação**

`apps/web/src/componentes/animacaoMesa.ts` — acrescente (depois de `movimentoReduzido`/`podeAnimar`):
```ts
export const DUR_DESLIZE = 380;

/** FLIP: `el` já está no lugar novo; desliza de onde estava (`de`). Movimento reduzido: nada. */
export function deslizarDe(el: HTMLElement, de: DOMRect): void {
  if (movimentoReduzido() || !podeAnimar(el)) return;
  const para = el.getBoundingClientRect();
  const dx = de.left - para.left;
  const dy = de.top - para.top;
  if (dx === 0 && dy === 0) return;
  el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0px, 0px)' }], {
    duration: DUR_DESLIZE,
    easing: EASE_ARREMESSO,
  });
}
```

`apps/web/src/componentes/Monte.tsx`
```tsx
import type { Cadeira } from '@truco/engine';
import { type CSSProperties, useLayoutEffect, useRef } from 'react';
import { posicaoRelativa } from '../logica/posicoes';
import { deslizarDe } from './animacaoMesa';
import { cx } from './cx';

interface Props {
  qtd: number;
  /** Quem está com o monte (null = no meio da mesa). */
  dono: Cadeira | null;
  minha: Cadeira;
}

/** Pilha de versos com a contagem, puxada para o lado de quem está com ela; desliza quando muda de mão. */
export function Monte({ qtd, dono, minha }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const antes = useRef<{ lugar: string; ret: DOMRect } | null>(null);
  const lugar = dono === null ? 'meio' : posicaoRelativa(minha, dono);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const a = antes.current;
    if (a && a.lugar !== lugar) deslizarDe(el, a.ret);
    antes.current = { lugar, ret: el.getBoundingClientRect() };
  }, [lugar]);
  if (qtd === 0) return null;
  const camadas = Math.max(1, Math.min(5, Math.ceil(qtd / 8)));
  return (
    <div ref={ref} className={cx('monte', `monte-${lugar}`)} data-testid="monte" role="img" aria-label={`Monte com ${qtd} cartas`}>
      {Array.from({ length: camadas }, (_, i) => (
        <span key={i} className="carta verso monte-camada" style={{ '--i': i } as CSSProperties} aria-hidden="true" />
      ))}
      <span className="monte-qtd" aria-hidden="true">
        {qtd}
      </span>
    </div>
  );
}
```

`apps/web/src/componentes/FamiliasNaMesa.tsx`
```tsx
import type { Cadeira, Visao } from '@truco/engine';
import { posicaoRelativa } from '../logica/posicoes';
import { textoFamilia } from '../logica/ritual';
import { CartaVisual } from './CartaVisual';
import { cx } from './cx';

interface Props {
  visao: Visao;
  nome: (c: Cadeira) => string;
}

/** As 3 abertas no corte (ao lado do monte) e a última família de cada cadeira, na frente dela. */
export function FamiliasNaMesa({ visao, nome }: Props) {
  const m = visao.mao;
  const abertas = m?.abertasNoCorte ?? visao.ritual?.abertas ?? [];
  const familias = m?.familias ?? [];
  if (abertas.length === 0 && familias.length === 0) return null;
  const variante = visao.regras.variante;
  const vira = m?.vira ?? null;
  const ultimas = new Map<Cadeira, number>();
  familias.forEach((f, i) => ultimas.set(f.cadeira, i));
  return (
    <div className="familias">
      {abertas.length > 0 && (
        <figure className="familia abertas-corte" data-testid="abertas-corte">
          <div className="familia-cartas">
            {abertas.map((c, i) => (
              <CartaVisual key={i} carta={c} variante={variante} vira={vira} tamanho="pequena" />
            ))}
          </div>
          <figcaption>Abertas no corte</figcaption>
        </figure>
      )}
      {[...ultimas.values()].map((i) => {
        const f = familias[i];
        return (
          <figure
            key={i}
            className={cx('familia', `pos-${posicaoRelativa(visao.cadeira, f.cadeira)}`)}
            data-familia={i}
            data-conferida={f.conferida ? 'sim' : undefined}
            data-testid={f.conferida ? 'familia-conferida' : 'familia'}
          >
            <div className="familia-cartas">
              {(f.cartas ?? [null, null, null]).map((c, k) => (
                <CartaVisual key={k} carta={c} variante={variante} vira={vira} tamanho="pequena" />
              ))}
            </div>
            <figcaption>{textoFamilia(f, visao, nome)}</figcaption>
          </figure>
        );
      })}
    </div>
  );
}
```

`apps/web/src/componentes/CentroMesa.tsx` — `Props` ganha `extra` e o centro existe sempre (com `data-testid`):
```tsx
interface Props {
  mao: VisaoMao | null;
  /** Mostrada (esmaecida) entre mãos, quando `mao` é null: a carta que decidiu e a vira. */
  ultimaMao: VisaoResultadoMao | null;
  minha: Cadeira;
  variante: Variante;
  /** Monte e linha de estado do ritual (por cima da cruz). */
  extra?: ReactNode;
}

export function CentroMesa({ mao, ultimaMao, minha, variante, extra }: Props) {
```
(importe `type ReactNode` de `react`), o retorno sem `fonte` vira
```tsx
  if (!fonte)
    return (
      <>
        <div ref={centro} className="centro" data-testid="centro">
          {extra}
        </div>
        {capa}
      </>
    );
```
e, no retorno principal, `{extra}` entra como primeiro filho de `<div ref={centro} className="centro" data-testid="centro">`.

`apps/web/src/telas/Mesa.tsx` (arquivo inteiro):
```tsx
import { type Cadeira, ehFaseRitual, parceiroDe, quemDeveAgir } from '@truco/engine';
import { useState } from 'react';
import { Assento } from '../componentes/Assento';
import { BarraAcoes } from '../componentes/BarraAcoes';
import { CentroMesa } from '../componentes/CentroMesa';
import { Chat } from '../componentes/Chat';
import { ConfirmarSaida } from '../componentes/ConfirmarSaida';
import { Cronometro } from '../componentes/Cronometro';
import { FamiliasNaMesa } from '../componentes/FamiliasNaMesa';
import { Mao } from '../componentes/Mao';
import { Monte } from '../componentes/Monte';
import { FimDeMao, FimDePartida } from '../componentes/Overlays';
import { PainelFalas } from '../componentes/PainelFalas';
import { PainelSinais } from '../componentes/PainelSinais';
import { Placar } from '../componentes/Placar';
import { agruparAcoes } from '../logica/acoes';
import { baloesAtivos } from '../logica/eventos';
import { cadeiraNaPosicao } from '../logica/posicoes';
import { prazoEhMeu } from '../logica/prazo';
import { donoDoMonte, mostrarResumoMao, textoEtapa } from '../logica/ritual';
import { type SinalRecebido, temCoringa, textoSinalRecebido } from '../logica/sinais';
import { placarRelativo, resumoFimMao, resumoFimPartida, textoPedidoPendente, valorMao } from '../logica/textos';
import { useAgora } from '../rede/hooks';
import type { EstadoLoja, Loja } from '../rede/loja';

const DURACAO_SINAL_MS = 4_000;

interface Props {
  /** Precisa ter `msg.visao` (a App só mostra a mesa depois que a partida começa). */
  snap: EstadoLoja;
  acoes: Pick<Loja, 'enviarAcao' | 'enviarSinal' | 'enviarFala' | 'sair'>;
  aoChat?: (texto: string) => void;
}

export function TelaMesa({ snap, acoes, aoChat }: Props) {
  const agora = useAgora(250);
  const [painel, setPainel] = useState<'sinais' | 'falas' | 'chat' | null>(null);
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  const msg = snap.msg!;
  const modo = msg.modo;
  const v = msg.visao!;
  const m = v.mao;
  const minha = msg.minhaCadeira;
  const variante = v.regras.variante;
  const vira = m?.vira ?? null;
  const ui = agruparAcoes(msg.minhasAcoes, v);
  const baloes = baloesAtivos(snap.eventos, agora);
  const { nos, eles } = placarRelativo(v);
  const nome = (c: Cadeira) => msg.cadeiras[c]?.nome ?? `Cadeira ${c + 1}`;
  const agentes = quemDeveAgir(v);
  const daVez = (c: Cadeira) => agentes.includes(c);

  const ultimo = [...snap.eventos].reverse().find((e) => e.tipo === 'sinal');
  const sinal: (SinalRecebido & { em: number }) | null =
    ultimo && ultimo.tipo === 'sinal' ? { sinal: ultimo.sinal, interceptado: ultimo.interceptado, nome: nome(ultimo.de), em: ultimo.em } : null;

  const jogar = (indice: number, coberta: boolean) => {
    const a = msg.minhasAcoes.find((x) => x.tipo === 'jogar' && x.indice === indice && !!x.coberta === coberta);
    if (a) acoes.enviarAcao(a);
  };
  const alternar = (p: 'sinais' | 'falas' | 'chat') => setPainel((atual) => (atual === p ? null : p));

  const emRitual = ehFaseRitual(v.fase) || v.fase === 'aguardandoMonte';
  const resumoMao = mostrarResumoMao(v) && v.ultimaMao ? resumoFimMao(v.ultimaMao, minha) : null;
  // No ritual a última rodada só fica no centro enquanto o resumo está na tela (depois as cartas já voltaram ao monte).
  const ultimaVisivel = emRitual && !resumoMao ? null : v.ultimaMao;
  const etapa = textoEtapa(v, nome);
  const fim = v.fase === 'fimPartida' ? resumoFimPartida(v) : null;
  const pedido = textoPedidoPendente(v);

  return (
    <main className="tela-mesa">
      <Placar nos={nos} eles={eles} valor={m ? valorMao(v.regras, m.nivel) : null} pedido={pedido?.replace(/\.$/, '') ?? null} />
      <div className="tampo">
        {(['cima', 'esquerda', 'direita'] as const).map((pos) => {
          const c = cadeiraNaPosicao(minha, pos);
          return (
            <Assento
              key={pos}
              posicao={pos}
              info={msg.cadeiras[c]}
              qtdCartas={m?.qtdCartas[c] ?? 0}
              daVez={daVez(c)}
              balao={baloes.get(c) ?? null}
              maoVisivel={c === parceiroDe(minha) ? (m?.maoParceiro ?? null) : null}
              variante={variante}
              vira={vira}
              prazo={msg.prazo?.cadeiras.includes(c) ? msg.prazo : null}
              agora={agora}
            />
          );
        })}
        <CentroMesa
          mao={m}
          ultimaMao={ultimaVisivel}
          minha={minha}
          variante={variante}
          extra={
            <>
              <Monte qtd={v.qtdMonte} dono={donoDoMonte(v)} minha={minha} />
              {etapa && (
                <p className="etapa" role="status">
                  {etapa}
                </p>
              )}
            </>
          }
        />
        <FamiliasNaMesa visao={v} nome={nome} />
        <Assento
          posicao="baixo"
          info={msg.cadeiras[minha]}
          qtdCartas={0}
          daVez={daVez(minha)}
          balao={baloes.get(minha) ?? null}
          maoVisivel={null}
          variante={variante}
          vira={vira}
        />
      </div>
      {prazoEhMeu(msg) && msg.prazo && <Cronometro prazo={msg.prazo} agora={agora} />}
      {m ? <Mao cartas={m.minhaMao} jogaveis={ui.jogaveis} cobriveis={ui.cobriveis} variante={variante} vira={vira} aoJogar={jogar} /> : <div />}
      <div className="rodape-mesa">
        <BarraAcoes botoes={ui.botoes} pedido={pedido} aoEscolher={acoes.enviarAcao} />
        <nav className="barra-social" aria-label="Sinais e falas">
          <button type="button" aria-pressed={painel === 'sinais'} onClick={() => alternar('sinais')}>
            Sinais
          </button>
          <button type="button" aria-pressed={painel === 'falas'} onClick={() => alternar('falas')}>
            Falas
          </button>
          {modo === 'privada' && aoChat && (
            <button type="button" aria-pressed={painel === 'chat'} onClick={() => alternar('chat')}>
              Chat
            </button>
          )}
          <button type="button" onClick={() => setConfirmarSaida(true)}>
            Sair
          </button>
        </nav>
      </div>
      {painel === 'sinais' && (
        <PainelSinais
          chanceInterceptar={msg.chanceInterceptarSinal}
          ultimo={sinal}
          maoLimpa={temCoringa(msg.regras)}
          aoEnviar={(s) => {
            acoes.enviarSinal(s);
            setPainel(null);
          }}
        />
      )}
      {painel === 'falas' && (
        <PainelFalas
          aoEnviar={(f) => {
            acoes.enviarFala(f);
            setPainel(null);
          }}
        />
      )}
      {painel === 'chat' && aoChat && <Chat mensagens={snap.chat} aoEnviar={aoChat} />}
      {confirmarSaida && <ConfirmarSaida ranqueada={modo === 'ranqueada'} aoSair={() => void acoes.sair()} aoCancelar={() => setConfirmarSaida(false)} />}
      {painel !== 'sinais' && sinal && agora - sinal.em < DURACAO_SINAL_MS && (
        <div className="sinal-flutuante" role="status">
          {textoSinalRecebido(sinal)}
        </div>
      )}
      {resumoMao && <FimDeMao titulo={resumoMao.titulo} detalhe={resumoMao.detalhe} />}
      {fim && <FimDePartida titulo={fim.titulo} placar={fim.placar} venceu={fim.venceu} aoJogarDeNovo={() => void acoes.sair()} />}
    </main>
  );
}
```

`apps/web/src/estilos.css` — acrescente antes do bloco `@media (prefers-reduced-motion: reduce)`:
```css
/* ---------- Ritual: monte, linha de estado, abertas e famílias ---------- */
.centro {
  position: relative;
}
.monte {
  --monte-l: calc(var(--carta-c) * 0.8);
  position: absolute;
  z-index: 2;
  width: var(--monte-l);
  aspect-ratio: 5 / 7;
  pointer-events: none;
}
.monte .monte-camada {
  --carta-l: var(--monte-l);
  position: absolute;
  inset: 0;
  transform: translate(calc(var(--i) * -1.5px), calc(var(--i) * -1.5px));
  box-shadow: 0 1px 2px rgba(11, 8, 6, 0.35);
}
.monte[data-anim] .monte-camada {
  opacity: 0.55;
}
.monte-qtd {
  position: absolute;
  right: -0.7em;
  bottom: -0.7em;
  min-width: 1.9em;
  padding: 0.1em 0.35em;
  border: 1px solid var(--giz-suave);
  border-radius: 999px;
  background: var(--lousa);
  color: var(--giz);
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.3;
  text-align: center;
}
.monte-meio {
  left: 50%;
  top: 50%;
  translate: -50% -50%;
}
.monte-baixo {
  left: 50%;
  bottom: 0;
  translate: -50% 0;
}
.monte-cima {
  left: 50%;
  top: 0;
  translate: -50% 0;
}
.monte-esquerda {
  left: 0;
  top: 50%;
  translate: 0 -50%;
}
.monte-direita {
  right: 0;
  top: 50%;
  translate: 0 -50%;
}
.etapa {
  position: absolute;
  left: 50%;
  bottom: -1.9em;
  translate: -50% 0;
  margin: 0;
  max-width: calc(100vw - 32px);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--giz);
  font-size: 0.8rem;
  text-shadow: 0 1px 2px var(--sombra);
}
.familias {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}
.familia {
  position: absolute;
  margin: 0;
  display: grid;
  justify-items: center;
  gap: 2px;
}
.familia-cartas {
  display: flex;
}
.familia-cartas .carta + .carta {
  margin-left: calc(var(--carta-c) * -0.35);
}
.familia figcaption {
  max-width: 42vw;
  padding: 1px 6px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--lousa) 85%, transparent);
  color: var(--giz);
  font-size: 0.72rem;
  text-align: center;
}
.familia[data-conferida='sim'] figcaption {
  color: var(--grito);
}
.familia.pos-cima {
  top: 20%;
  left: 50%;
  translate: -50% 0;
}
.familia.pos-baixo {
  bottom: 22%;
  left: 50%;
  translate: -50% 0;
}
.familia.pos-esquerda {
  left: 3%;
  top: 50%;
  translate: 0 -50%;
}
.familia.pos-direita {
  right: 3%;
  top: 50%;
  translate: 0 -50%;
}
.familia.abertas-corte {
  top: 50%;
  left: 50%;
  translate: 55% -160%;
}
```

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/web test` → PASS (todos). Run: `pnpm --filter @truco/web typecheck` → ok. Confira no navegador (`pnpm dev:server` + `pnpm dev:web`, 375×667 e 1280×800): monte e linha de estado não cobrem as cartas jogadas nem os botões; famílias legíveis.

**Step 5: Commit**
```bash
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add -- apps/web/src/componentes/Monte.tsx apps/web/src/componentes/FamiliasNaMesa.tsx
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "feat(web): monte, etapas do ritual e famílias na mesa" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- apps/web/src apps/web/test
```

---

### Task 15: Web — animações do ritual (`useAnimacaoRitual`)

Riffle (o monte se abre e intercala), corte (a parte passa para baixo), monte indo ao cortador e voltando (já é o FLIP do `Monte`), cartas voando para cada assento na ordem e no modo certos, abrir 3 virando ao lado do monte, família indo à frente do jogador e 3 novas vindo do monte, conferir revelando. Tudo imperativo (Web Animations API) na camada `camada-voo`, sem estado React e sem bloquear clique; `prefers-reduced-motion` desliga.

**Files:**
- Modify: `apps/web/src/componentes/animacaoMesa.ts`, `apps/web/src/telas/Mesa.tsx`, `apps/web/src/estilos.css`
- Test: `apps/web/test/animacao-ritual.test.tsx`

**Step 1: Teste que falha**

`apps/web/test/animacao-ritual.test.tsx`
```tsx
import { act, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { DUR_RIFFLE, useAnimacaoRitual } from '../src/componentes/animacaoMesa';
import type { Movimento } from '../src/rede/loja';

function Palco({ movimentos }: { movimentos: Movimento[] }) {
  const camada = useRef<HTMLDivElement>(null);
  useAnimacaoRitual(movimentos, 0, camada);
  return (
    <div>
      <div data-testid="monte" />
      <div ref={camada} />
    </div>
  );
}
const mov = (id: number, msg: Movimento['msg']): Movimento => ({ id, msg });
const riffle = (id: number) => mov(id, { cadeira: 3, tipo: 'embaralhar' });
const anim = () => screen.getByTestId('monte').dataset.anim;

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useAnimacaoRitual', () => {
  test('o que já estava na loja ao abrir a tela não anima; o novo marca o monte e solta depois', () => {
    const { rerender } = render(<Palco movimentos={[riffle(1)]} />);
    expect(anim()).toBeUndefined();
    rerender(<Palco movimentos={[riffle(1), riffle(2)]} />);
    expect(anim()).toBe('embaralhar');
    act(() => {
      vi.advanceTimersByTime(DUR_RIFFLE);
    });
    expect(anim()).toBeUndefined();
  });

  test('distribuir e cortar marcam o monte', () => {
    const { rerender } = render(<Palco movimentos={[]} />);
    rerender(<Palco movimentos={[mov(1, { cadeira: 2, tipo: 'cortar', fracao: 0.4 })]} />);
    expect(anim()).toBe('cortar');
    rerender(<Palco movimentos={[mov(1, { cadeira: 2, tipo: 'cortar', fracao: 0.4 }), mov(2, { cadeira: 3, tipo: 'distribuir', modo: 'subindo', ordem: [0, 1, 2, 3] })]} />);
    expect(anim()).toBe('distribuir');
  });

  test('prefers-reduced-motion: nada se move', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    const { rerender } = render(<Palco movimentos={[]} />);
    rerender(<Palco movimentos={[riffle(1)]} />);
    expect(anim()).toBeUndefined();
  });
});
```

**Step 2: Rodar e ver falhar**

Run: `pnpm --filter @truco/web test animacao-ritual`
Expected: FAIL — `useAnimacaoRitual`/`DUR_RIFFLE` não exportados.

**Step 3: Implementação**

`apps/web/src/componentes/animacaoMesa.ts` — imports novos no topo:
```ts
import type { MsgAcao } from '@truco/protocolo';
import { passosDistribuicao } from '../logica/ritual';
import type { Movimento } from '../rede/loja';
```
(somados aos que já existem; `Cadeira`, `posicaoRelativa`, `Posicao`, `useRef`, `useLayoutEffect`, `useEffect` e `RefObject` já são importados) e acrescente ao fim do arquivo:
```ts
export const DUR_RIFFLE = 520;
export const DUR_CORTE = 420;
export const DUR_DADA = 300;
/** Intervalo entre um voo e o próximo na distribuição. */
export const PASSO_DADA = 70;

function retAssento(pos: Posicao): DOMRect | null {
  const r = document.querySelector(`[data-testid="assento-${pos}"]`)?.getBoundingClientRect();
  return r && r.width > 0 ? r : null;
}

/** Animações do ritual: fantasmas (pilhas de versos) na camada; o monte real só ganha `data-anim`. */
class AnimadorRitual {
  private vivas = new Set<Animation>();
  private nos = new Set<Element>();
  private timers = new Set<ReturnType<typeof setTimeout>>();

  constructor(private camada: HTMLElement) {}

  private depois(ms: number, fn: () => void) {
    const t = setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, ms);
    this.timers.add(t);
  }

  /** O CSS (e os testes) leem `data-anim` no monte enquanto a animação dura. */
  private marcar(el: HTMLElement, nome: string, ms: number) {
    el.dataset.anim = nome;
    this.depois(ms, () => {
      if (el.dataset.anim === nome) delete el.dataset.anim;
    });
  }

  private seguir(a: Animation, aoFim?: () => void) {
    this.vivas.add(a);
    const fim = () => {
      this.vivas.delete(a);
      aoFim?.();
    };
    a.onfinish = fim;
    a.oncancel = fim;
  }

  private fantasma(ret: DOMRect, qtd: number): HTMLElement {
    const base = this.camada.getBoundingClientRect();
    const f = document.createElement('div');
    f.className = 'fantasma-ritual';
    Object.assign(f.style, {
      left: `${ret.left - base.left}px`,
      top: `${ret.top - base.top}px`,
      width: `${ret.width}px`,
      height: `${ret.height}px`,
    });
    for (let i = 0; i < qtd; i++) {
      const c = document.createElement('span');
      c.className = 'carta verso';
      c.style.setProperty('--i', String(i));
      f.appendChild(c);
    }
    this.camada.appendChild(f);
    this.nos.add(f);
    return f;
  }

  private remover(f: Element) {
    f.remove();
    this.nos.delete(f);
  }

  /** Uma pilhinha voa de `de` até `para` e some ao chegar (a carta real aparece pelo estado). */
  private voo(de: DOMRect, para: DOMRect, qtd: number, desvioY = 0, virar = false) {
    const f = this.fantasma(de, qtd);
    const a = centroDe(de);
    const b = centroDe(para);
    this.seguir(
      f.animate(
        [
          { transform: `translate(0px, ${desvioY}px) scale(1)`, opacity: 1 },
          { offset: 0.85, opacity: 1 },
          { transform: `translate(${b.x - a.x}px, ${b.y - a.y}px) scale(0.8)${virar ? ' rotateY(180deg)' : ''}`, opacity: 0 },
        ],
        { duration: DUR_DADA, easing: EASE_ARREMESSO, fill: 'forwards' },
      ),
      () => this.remover(f),
    );
  }

  embaralhar(monte: HTMLElement) {
    this.marcar(monte, 'embaralhar', DUR_RIFFLE);
    if (!podeAnimar(this.camada)) return;
    const r = monte.getBoundingClientRect();
    for (const lado of [-1, 1]) {
      const f = this.fantasma(r, 3);
      this.seguir(
        f.animate(
          [
            { transform: 'translate(0px, 0px) rotate(0deg)' },
            { offset: 0.35, transform: `translate(${lado * r.width * 0.6}px, -6px) rotate(${lado * 9}deg)` },
            { offset: 0.75, transform: `translate(${lado * r.width * 0.15}px, -2px) rotate(${lado * 2}deg)`, opacity: 1 },
            { transform: 'translate(0px, 0px) rotate(0deg)', opacity: 0 },
          ],
          { duration: DUR_RIFFLE, easing: 'ease-in-out', fill: 'forwards' },
        ),
        () => this.remover(f),
      );
    }
  }

  cortar(monte: HTMLElement, fracao: number) {
    this.marcar(monte, 'cortar', DUR_CORTE);
    if (!podeAnimar(this.camada)) return;
    const r = monte.getBoundingClientRect();
    const f = this.fantasma(r, Math.max(1, Math.round(fracao * 4)));
    this.seguir(
      f.animate(
        [
          { transform: 'translate(0px, 0px)' },
          { offset: 0.3, transform: `translate(0px, ${-r.height * 0.35}px)` },
          { offset: 0.65, transform: `translate(${r.width * 1.1}px, ${-r.height * 0.35}px)` },
          { offset: 0.85, transform: `translate(${r.width * 1.1}px, 0px)`, opacity: 1 },
          { transform: 'translate(0px, 0px)', opacity: 0 },
        ],
        { duration: DUR_CORTE, easing: 'ease-in-out', fill: 'forwards' },
      ),
      () => this.remover(f),
    );
  }

  /** Cartas saindo do monte (do topo ou do fundo) para cada destino, uma leva por vez. */
  dar(monte: HTMLElement, passos: { para: DOMRect | null; qtd: number; deBaixo: boolean }[]) {
    this.marcar(monte, 'distribuir', passos.length * PASSO_DADA + DUR_DADA);
    if (!podeAnimar(this.camada)) return;
    const r = monte.getBoundingClientRect();
    passos.forEach((p, i) => {
      const para = p.para;
      if (para) this.depois(i * PASSO_DADA, () => this.voo(r, para, p.qtd, p.deBaixo ? 4 : -4));
    });
  }

  abrir(monte: HTMLElement) {
    this.marcar(monte, 'abrir', DUR_DADA);
    if (!podeAnimar(this.camada)) return;
    const r = monte.getBoundingClientRect();
    this.voo(r, new DOMRect(r.left + r.width * 1.4, r.top - r.height * 0.8, r.width, r.height), 3, -4, true);
  }

  /** As 3 da mão vão para a frente do jogador; depois 3 novas vêm do monte. */
  familia(monte: HTMLElement | null, assento: DOMRect | null) {
    if (!assento || !podeAnimar(this.camada)) return;
    const base = this.camada.getBoundingClientRect();
    const meio = new DOMRect(base.left + base.width / 2 - 20, base.top + base.height / 2 - 28, 40, 56);
    const frente = new DOMRect((assento.left + meio.left) / 2, (assento.top + meio.top) / 2, assento.width * 0.4, assento.height * 0.4);
    this.voo(assento, frente, 3);
    if (monte) this.depois(DUR_DADA, () => this.voo(monte.getBoundingClientRect(), assento, 3));
  }

  revelar(cartas: HTMLElement[]) {
    for (const c of cartas) {
      if (podeAnimar(c)) this.seguir(c.animate([{ transform: 'rotateY(90deg)' }, { transform: 'rotateY(0deg)' }], { duration: DUR_CORTE, easing: 'ease-out' }));
    }
  }

  tocar(a: MsgAcao, minha: Cadeira) {
    const monte = document.querySelector<HTMLElement>('[data-testid="monte"]');
    switch (a.tipo) {
      case 'embaralhar':
        if (monte) this.embaralhar(monte);
        break;
      case 'cortar':
        if (monte) this.cortar(monte, a.fracao ?? 0.5);
        break;
      case 'abrir3':
        if (monte) this.abrir(monte);
        break;
      case 'dar3':
        if (monte && a.para !== undefined) this.dar(monte, [{ para: retAssento(posicaoRelativa(minha, a.para)), qtd: 3, deBaixo: false }]);
        break;
      case 'distribuir':
        if (monte) this.dar(monte, passosDistribuicao(a, minha).map((p) => ({ para: retAssento(p.pos), qtd: p.qtd, deBaixo: p.deBaixo })));
        break;
      case 'familia':
        this.familia(monte, retAssento(posicaoRelativa(minha, a.cadeira)));
        break;
      case 'conferir':
        // O estado com as cartas reveladas chega logo depois da mensagem.
        if (a.conferir) this.depois(60, () => this.revelar(Array.from(document.querySelectorAll<HTMLElement>('[data-conferida="sim"] .carta'))));
        break;
      default:
        break;
    }
  }

  limpar() {
    for (const a of Array.from(this.vivas)) a.cancel();
    for (const t of this.timers) clearTimeout(t);
    for (const n of this.nos) n.remove();
    this.vivas.clear();
    this.timers.clear();
    this.nos.clear();
  }
}

/**
 * Anima as mensagens `acao` novas do ritual e da família (`movimentos` da loja). O primeiro render
 * (F5, reconexão) não anima; movimento reduzido também não. A `camada` recebe os fantasmas.
 */
export function useAnimacaoRitual(movimentos: readonly Movimento[] | undefined, minha: Cadeira, camada: RefObject<HTMLElement>) {
  const visto = useRef<number | null>(null);
  const animador = useRef<AnimadorRitual | null>(null);

  useLayoutEffect(() => {
    const lista = movimentos ?? [];
    const desde = visto.current;
    visto.current = lista.at(-1)?.id ?? desde ?? 0;
    if (desde === null || movimentoReduzido()) return;
    const capa = camada.current;
    if (!capa) return;
    const ani = (animador.current ??= new AnimadorRitual(capa));
    for (const { id, msg } of lista) if (id > desde) ani.tocar(msg, minha);
  }, [movimentos, minha, camada]);

  useEffect(
    () => () => {
      animador.current?.limpar();
      animador.current = null;
    },
    [],
  );
}
```

`apps/web/src/telas/Mesa.tsx` — `import { useRef, useState } from 'react';`, `import { useAnimacaoRitual } from '../componentes/animacaoMesa';`; logo depois de `const minha = msg.minhaCadeira;`:
```tsx
  const camadaRitual = useRef<HTMLDivElement>(null);
  useAnimacaoRitual(snap.movimentos, minha, camadaRitual);
```
e, como último filho do `<div className="tampo">`:
```tsx
        <div ref={camadaRitual} className="camada-voo" aria-hidden="true" />
```

`apps/web/src/estilos.css` — junto do bloco do ritual:
```css
.fantasma-ritual {
  position: absolute;
  pointer-events: none;
  will-change: transform, opacity;
}
.fantasma-ritual .carta {
  --carta-l: var(--carta-c);
  position: absolute;
  inset: 0;
  transform: translate(calc(var(--i) * -1.5px), calc(var(--i) * -1.5px));
}
```

**Step 4: Rodar e ver passar**

Run: `pnpm --filter @truco/web test` → PASS. Run: `pnpm --filter @truco/web typecheck` → ok. No navegador: riffle, corte, monte indo ao cortador e voltando, cartas voando para os assentos na ordem (por cima: pacotes; subindo: uma por vez), abrir 3, família e conferir; com "reduzir movimento" do sistema ligado, nada se move.

**Step 5: Commit**
```bash
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add -- apps/web/test/animacao-ritual.test.tsx
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "feat(web): animações do ritual (riffle, corte, distribuição, família, conferir)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- apps/web/src/componentes/animacaoMesa.ts apps/web/src/telas/Mesa.tsx apps/web/src/estilos.css apps/web/test/animacao-ritual.test.tsx
```

---

### Task 16: Web — E2E existentes adaptados ao ritual

O humano pode ser quem embaralha, corta ou dá: os E2E clicam na ação padrão de cada etapa (com `TRUCO_TEMPOS=rapido` o ritual por tempo esgotado também é rápido: `ritualMs` 3 s).

**Files:**
- Create: `apps/web/e2e/apoio.ts`
- Modify: `apps/web/e2e/partida.spec.ts`, `apps/web/e2e/dois-humanos.spec.ts`, `apps/web/e2e/ranqueada.spec.ts`

**Step 1: Helper**

`apps/web/e2e/apoio.ts`
```ts
import type { Page } from '@playwright/test';

/** A ação padrão de cada etapa: passar sem embaralhar, cortar (até gastar os 3), dar por cima, não conferir. */
const PADRAO = ['Passar pra cortar', 'Cortar', 'Por cima', 'Deixar passar'] as const;

/** Faz a etapa do ritual (ou do conferir) que estiver na tela; true se clicou em algo. */
export async function agirNoRitual(page: Page): Promise<boolean> {
  for (const nome of PADRAO) {
    const b = page.getByRole('button', { name: nome, exact: true });
    if (await b.isVisible()) {
      await b.click({ timeout: 1_000 });
      return true;
    }
  }
  return false;
}
```

**Step 2: Adaptar as specs**

`partida.spec.ts`: importe `agirNoRitual` de `./apoio`; troque
```ts
  await expect(page.getByTestId('minha-mao')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('centro')).toBeVisible();
```
por
```ts
  await expect(page.getByTestId('centro')).toBeVisible({ timeout: 15_000 });
```
e, dentro do `try` do loop, entre o `jogarMao` e a `carta`:
```ts
      else if (await agirNoRitual(page)) {
        // etapa do ritual feita
      }
```
(atualize o comentário: "aceitar truco > jogar a mão de 10 > etapa do ritual > primeira carta jogável").

`dois-humanos.spec.ts`: importe `agirNoRitual`; no começo do `try` de `agir`: `if (await agirNoRitual(page)) return null;`. A espera por `centro` visível continua igual (o centro agora existe desde o monte).

`ranqueada.spec.ts`: importe `agirNoRitual`; troque as duas esperas `minha-mao` de 30 s por:
```ts
    // Quem estiver com o monte faz a etapa padrão até as cartas chegarem às duas.
    const limite = Date.now() + 60_000;
    while (!(await ana.getByTestId('minha-mao').isVisible()) || !(await bia.getByTestId('minha-mao').isVisible())) {
      if (Date.now() > limite) throw new Error('as cartas não chegaram');
      await agirNoRitual(ana).catch(() => false);
      await agirNoRitual(bia).catch(() => false);
      await ana.waitForTimeout(150);
    }
```

**Step 3: Rodar**

Run: `pnpm test:e2e`
Expected: PASS nas três specs.

**Step 4: Commit**
```bash
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add -- apps/web/e2e/apoio.ts
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "test(e2e): partidas clicam nas etapas padrão do ritual" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- apps/web/e2e
```

---

### Task 17: Web — E2E novo: ritual com família fechada conferida

O humano pede família fechada duas vezes na mesma mão; o bot fácil confere a 2ª (desconfia de quem repete). Também vale se os bots conferirem uma família de outro bot — o teste espera qualquer família conferida.

**Files:**
- Create: `apps/web/e2e/ritual-familia.spec.ts`

**Step 1: Escrever a spec**

`apps/web/e2e/ritual-familia.spec.ts`
```ts
import { expect, test } from '@playwright/test';
import { agirNoRitual } from './apoio';

test('ritual completo e família fechada conferida', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Regras da mesa', { exact: true }).click();
  await page.getByLabel('Apelido').fill('Ritual E2E');
  await page.getByLabel('Variante').selectOption('mineiro');
  await page.getByLabel('Família').selectOption('fechada');
  await page.getByLabel('Humanos').selectOption('1');
  await page.getByLabel('Bots').selectOption('facil');
  await page.getByRole('button', { name: 'Jogar agora', exact: true }).click();

  const monte = page.getByTestId('monte');
  await expect(monte).toBeVisible({ timeout: 15_000 });
  await expect(monte).toHaveAccessibleName(/^Monte com \d+ cartas$/);

  const pedir = page.getByRole('button', { name: 'Pedir família fechada', exact: true });
  const jogarMao = page.getByRole('button', { name: 'Jogar a mão', exact: true });
  const carta = page.getByTestId('minha-mao').locator('button.carta-botao:enabled').first();
  const conferida = page.getByTestId('familia-conferida').first();
  const limite = Date.now() + 150_000;
  let pedidos = 0;
  let viuEtapa = false;
  while (!(await conferida.isVisible())) {
    if (Date.now() > limite) throw new Error(`nenhuma família conferida (${pedidos} pedidos)`);
    try {
      viuEtapa ||= await page.locator('.etapa').isVisible();
      // Na janela, pede (a 2ª da mesma mão os bots conferem); senão, ritual > mão de 10 > carta.
      if (await pedir.isVisible()) {
        await pedir.click({ timeout: 1_000 });
        pedidos++;
      } else if (await agirNoRitual(page)) {
        // etapa padrão feita
      } else if (await jogarMao.isVisible()) await jogarMao.click({ timeout: 1_000 });
      else if (await carta.isVisible()) await carta.click({ timeout: 1_000 });
      await page.waitForTimeout(100);
    } catch {
      // a tela mudou entre a checagem e o clique
    }
  }

  expect(viuEtapa).toBe(true);
  await expect(conferida).toContainText(/conferiu: era (família|blefe)! \+2 pra (nós|eles)/);
  await expect(conferida.locator('.carta:not(.verso)')).toHaveCount(3);
});
```

**Step 2: Rodar**

Run: `pnpm --filter @truco/web exec playwright test ritual-familia`
Expected: PASS (em geral na 1ª mão: o bot da vez espera `janelaFamiliaMs` = 2,5 s, tempo de sobra para os dois cliques).

**Step 3: Rodar todos os E2E**

Run: `pnpm test:e2e` → PASS.

**Step 4: Commit**
```bash
git -c "safe.directory=D:/01 Projetos/Projetos/truco" add -- apps/web/e2e/ritual-familia.spec.ts
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "test(e2e): ritual com família fechada conferida" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- apps/web/e2e/ritual-familia.spec.ts
```

---

### Task 18: Verificação final e atualização do design geral

**Files:**
- Modify: `docs/plans/2026-11-05-truco-design.md` (seções "Família", "Fluxo" e a lista de ações do engine)

**Step 1: Tudo verde**

Run, na raiz:
```bash
pnpm typecheck
pnpm test
pnpm test:e2e
```
Expected: tudo PASS. Se algo falhar, use superpowers:systematic-debugging — não afrouxe testes.

**Step 2: Busca por restos do modelo antigo**

Run: `git -c "safe.directory=D:/01 Projetos/Projetos/truco" grep -n -e "aguardandoDistribuicao" -e "ultimaFamilia" -e "tipo: 'distribuir', baralho" -- packages apps`
Expected: nenhuma ocorrência.

**Step 3: Design geral**

Em `docs/plans/2026-11-05-truco-design.md`:
- "### Família": troque os dois itens por "Ver `2026-11-05-ritual-da-mao-design.md`: fechada troca as cartas e pode ser blefe (a dupla adversária confere: valor base para quem acertou); aberta mostra e não pontua; até 3 fechadas por mão (o abrir 3 conta)."
- "### Fluxo", item 1: "Monte persistente: o pé embaralha (riffle com a sorte do servidor), o da esquerda corta (cortar/embaralhar/abrir 3/dar 3/devolver), o pé dá por cima, por baixo ou subindo (vira no paulista)."
- Na lista de ações do engine (seção 2): acrescente `monte`, `embaralhar`, `passarCorte`, `cortar`, `abrir3`, `dar3`, `devolver`, `distribuir{modo}`, `conferir`.

**Step 4: Commit**
```bash
git -c "safe.directory=D:/01 Projetos/Projetos/truco" commit -m "docs: design geral aponta para o ritual da mão" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- docs/plans/2026-11-05-truco-design.md
```
