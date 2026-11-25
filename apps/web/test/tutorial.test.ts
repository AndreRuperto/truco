import { type EstadoPartida, reduce } from '@truco/engine';
import { beforeEach, describe, expect, test } from 'vitest';
import { CHAVE_TUTORIAL, marcarTutorial, passoDoTutorial, TOPICOS, topicosVistos, tutorialPendente } from '../src/logica/tutorial';
import { distribuida, jogar, msgEstado, naSegundaRodada, noRitual, PAULISTA, MINEIRO } from './fixtures';

const nome = (c: number) => `Jogador ${c}`;
const passo = (...a: Parameters<typeof msgEstado>) => passoDoTutorial(msgEstado(...a), nome);

beforeEach(() => localStorage.clear());

// Pedido do André (2026-11-20): o tutorial cobre tudo o que acontece na primeira partida (família,
// mão de 11, cangada…), explicando cada situação na hora em que ela aparece.
describe('passo do tutorial (sai só do estado da mesa)', () => {
  test('ritual: quem embaralha, quem corta, como dar — para mim e para os outros', () => {
    const ritual = noRitual(PAULISTA); // pé = 3: a 3 embaralha e dá, a 2 corta
    expect(passo(ritual, 3)).toMatchObject({ id: 'embaralhar', topico: 'ritual' });
    expect(passo(ritual, 0)).toMatchObject({ id: 'embaralhar-outro', texto: expect.stringContaining('Jogador 3') });
    const corte = reduce(ritual, { tipo: 'passarCorte', cadeira: 3 });
    expect(passo(corte, 2)?.id).toBe('cortar');
    expect(passo(corte, 0)).toMatchObject({ id: 'cortar-outro', texto: expect.stringContaining('Jogador 2') });
  });

  // O tutorial é no mineiro: manilhas fixas e truco valendo 4 (correr dá 2).
  test('no mineiro: a 1ª carta fala das manilhas fixas e o truco vale 4', () => {
    const s = distribuida(MINEIRO);
    expect(passo(s, 0)).toMatchObject({ id: 'primeira-carta', texto: expect.stringContaining('zap (4 de paus)') });
    const r2 = naSegundaRodada(s);
    expect(passo(r2, r2.mao!.vez)).toMatchObject({ id: 'truco', texto: expect.stringContaining('valer 4. Se eles correrem, vocês levam 2') });
  });

  test('na mão: primeira carta (com a vira), esperar a vez, truco a partir da 2ª rodada, responder sempre', () => {
    const s = distribuida(PAULISTA);
    expect(passo(s, 0)).toMatchObject({ id: 'primeira-carta', topico: 'carta', texto: expect.stringContaining('vira') });
    expect(passo(s, 1)).toMatchObject({ id: 'esperar', texto: expect.stringContaining('Jogador 0') });
    const r2 = naSegundaRodada(s);
    expect(passo(r2, 0)).toMatchObject({ id: 'truco', topico: 'truco', texto: expect.stringContaining('valer 3. Se eles correrem, vocês levam 1') });
    const trucado = reduce(r2, { tipo: 'truco', cadeira: 0 });
    expect(passo(trucado, 1)).toMatchObject({ id: 'responder', repete: true });
    // Já trucada: no lugar do truco, a carta coberta (da 2ª rodada em diante).
    const aceito = reduce(trucado, { tipo: 'aceitar', cadeira: 1 });
    expect(passo(aceito, 0)).toMatchObject({ id: 'coberta', topico: 'coberta' });
  });

  test('família: na janela, explica e pede para decidir; conferir quando pedem fechada', () => {
    const s = distribuida({ ...PAULISTA, familia: 'fechada' });
    expect(passo(s, 0, { janelaFamilia: { ate: Date.now() + 20_000, decidiram: [] } })).toMatchObject({ id: 'familia', topico: 'familia' });
    // Quem já decidiu segue para a jogada.
    expect(passo(s, 0, { janelaFamilia: { ate: Date.now() + 20_000, decidiram: [0] } })?.id).toBe('primeira-carta');
  });

  test('mão de 11: decidir (repete) ou esperar a outra dupla; 11 a 11 é mão de ferro', () => {
    const decide = distribuida(PAULISTA, undefined, [11, 3]);
    expect(decide.fase).toBe('decisaoMao10');
    expect(passo(decide, 0)).toMatchObject({ id: 'mao-de-11', topico: 'mao11', repete: true, titulo: 'Mão de 11' });
    expect(passo(decide, 1)).toMatchObject({ id: 'mao-de-11-outro' });
    const ferro = distribuida(PAULISTA, undefined, [11, 11]);
    expect(passo(ferro, 0)).toMatchObject({ id: 'mao-de-ferro', topico: 'mao11' });
  });

  test('cangada: empilhar (texto do mineiro diz que vale a de baixo) e mostrar na vez', () => {
    const MAOS = [['3o', '5o', '6o'], ['3e', '2e', '6e'], ['4o', '5e', 'Qo'], ['4e', '5c', 'Qe']];
    let s = jogar(distribuida(MINEIRO, MAOS), [[0, 0], [1, 0], [2, 0], [3, 0]]);
    expect(s.fase).toBe('empilhando');
    expect(passo(s, 0)).toMatchObject({ id: 'cangada', topico: 'cangada', texto: expect.stringContaining('de baixo') });
    for (const cadeira of [0, 1, 2, 3] as const) s = reduce(s, { tipo: 'empilhar', cadeira, indice: 0 });
    expect(passo(s, s.mao!.vez)).toMatchObject({ id: 'cangada-mostrar', topico: 'cangada' });
  });

  test('mão nova: o placar da mão que acabou antes do ritual; fim de partida', () => {
    let s = naSegundaRodada(distribuida(PAULISTA));
    while (!s.ultimaMao) s = jogar(s, [[s.mao!.vez, 0]]);
    expect(s.fase).toBe('embaralhando');
    const quemDa = s.ritual!.embaralhador;
    const outro = ((quemDa + 1) % 4) as 0 | 1 | 2 | 3;
    expect(passo(s, outro)).toMatchObject({ id: 'fim-da-mao', texto: expect.stringContaining('até 12 pontos') });
    // Quem dá as cartas aprende a embaralhar antes.
    expect(passo(s, quemDa)?.id).toBe('embaralhar');
    const fim: EstadoPartida = { ...s, fase: 'fimPartida', vencedor: 0 };
    expect(passo(fim, 0)).toMatchObject({ id: 'fim', titulo: 'Vocês ganharam a partida!', repete: true });
  });

  test('sem visão (sala de espera), nada', () => {
    expect(passo(null, 0)).toBeNull();
  });

  test('progresso por tópico', () => {
    const vistos = topicosVistos([passo(noRitual(PAULISTA), 3)!, passo(distribuida(PAULISTA), 0)!]);
    expect([...vistos].sort()).toEqual(['carta', 'ritual']);
    expect(TOPICOS).toHaveLength(7);
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
