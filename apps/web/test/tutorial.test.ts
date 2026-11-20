import { reduce } from '@truco/engine';
import { beforeEach, describe, expect, test } from 'vitest';
import { CHAVE_TUTORIAL, marcarTutorial, passoDoTutorial, tutorialPendente } from '../src/logica/tutorial';
import { distribuida, jogar, msgEstado, naSegundaRodada, noRitual, PAULISTA } from './fixtures';

const nome = (c: number) => `Jogador ${c}`;
const passo = (...a: Parameters<typeof msgEstado>) => passoDoTutorial(msgEstado(...a), nome);

beforeEach(() => localStorage.clear());

// Pedido do André (2026-11-20), depois do retorno "no início demora pra entender o que tá acontecendo":
// uma partida guiada, oferecida na 1ª visita, com "Pular tutorial" sempre na tela.
describe('passo do tutorial (sai só do estado da mesa)', () => {
  test('ritual: quem embaralha, quem corta, como dar — para mim e para os outros', () => {
    const ritual = noRitual(PAULISTA); // pé = 3: a 3 embaralha e dá, a 2 corta
    expect(passo(ritual, 3)?.id).toBe('embaralhar');
    expect(passo(ritual, 0)).toMatchObject({ id: 'embaralhar-outro', texto: expect.stringContaining('Jogador 3') });
    const corte = reduce(ritual, { tipo: 'passarCorte', cadeira: 3 });
    expect(passo(corte, 2)?.id).toBe('cortar');
    expect(passo(corte, 0)).toMatchObject({ id: 'cortar-outro', texto: expect.stringContaining('Jogador 2') });
  });

  test('na mão: primeira carta (com a vira), esperar a vez, truco a partir da 2ª rodada', () => {
    const s = distribuida(PAULISTA);
    expect(passo(s, 0)).toMatchObject({ id: 'primeira-carta', texto: expect.stringContaining('vira') });
    expect(passo(s, 1)).toMatchObject({ id: 'esperar', texto: expect.stringContaining('Jogador 0') });
    const r2 = naSegundaRodada(s);
    expect(passo(r2, 0)?.id).toBe('truco');
    const trucado = reduce(r2, { tipo: 'truco', cadeira: 0 });
    expect(passo(trucado, 1)?.id).toBe('responder');
    // Já trucada: não insiste no truco, só explica a jogada.
    const aceito = reduce(trucado, { tipo: 'aceitar', cadeira: 1 });
    expect(passo(aceito, 0)?.id).toBe('jogar');
  });

  test('fim da primeira mão: o passo final', () => {
    let s = naSegundaRodada(distribuida(PAULISTA));
    while (!s.ultimaMao) s = jogar(s, [[s.mao!.vez, 0]]);
    expect(passo(s, 0)).toMatchObject({ id: 'fim', titulo: 'Pronto, é isso!' });
  });

  test('sem visão (sala de espera), nada', () => {
    expect(passo(null, 0)).toBeNull();
  });
});

describe('convite da 1ª visita', () => {
  test('pendente até fazer ou pular', () => {
    expect(tutorialPendente()).toBe(true);
    marcarTutorial('pulado');
    expect(tutorialPendente()).toBe(false);
    expect(localStorage.getItem(CHAVE_TUTORIAL)).toBe('pulado');
  });
});
