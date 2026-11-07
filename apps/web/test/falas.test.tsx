import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { FALA_TEXTO } from '../src/logica/eventos';
import { arquivoDaFala, FALAS, falaDoBalao, type IdFala, VOZES, VOZES_PESSOAIS } from '../src/som/falas';
import type { EstadoLoja } from '../src/rede/loja';
import { TelaMesa } from '../src/telas/Mesa';
import { distribuida, msgEstado, PAULISTA } from './fixtures';

const tocados: string[] = [];
vi.mock('../src/som/sintese', () => ({ destravarAudio: vi.fn(), sintetizar: vi.fn(), tocarArquivo: (u: string) => tocados.push(u) }));
beforeEach(() => {
  localStorage.clear();
  tocados.length = 0;
});

describe('falas gravadas', () => {
  test('toda fala do painel e todo grito de aposta têm voz', () => {
    for (const texto of Object.values(FALA_TEXTO)) expect(falaDoBalao(texto), texto).not.toBeNull();
    expect(falaDoBalao('Embaralhando…')).toBeNull();
  });

  test('existe um .mp3 para cada voz × fala × jeito de dizer', () => {
    const publico = join(__dirname, '..', 'public');
    const faltando: string[] = [];
    for (const tipo of [...VOZES.keys(), ...(Object.keys(VOZES_PESSOAIS) as (keyof typeof VOZES_PESSOAIS)[])])
      for (const [id, f] of Object.entries(FALAS) as [IdFala, { ditos: readonly string[] }][])
        f.ditos.forEach((_, n) => {
          const url = arquivoDaFala(tipo, id, n);
          if (!existsSync(join(publico, url))) faltando.push(url);
        });
    expect(faltando).toEqual([]);
  });

  test('balão novo na mesa toca a fala na voz de quem falou; o primeiro estado não toca', () => {
    const snap = (eventos: EstadoLoja['eventos']): EstadoLoja => ({ status: 'na-mesa', msg: msgEstado(distribuida(PAULISTA)), eventos, erro: null, chat: [], salaId: 'r1' });
    const acoes = { enviarAcao: vi.fn(), enviarSinal: vi.fn(), enviarFala: vi.fn(), sair: vi.fn() };
    const antigo = { id: 1, em: Date.now(), tipo: 'acao' as const, de: 1 as const, texto: 'Corro!' };
    const { rerender } = render(<TelaMesa snap={snap([antigo])} acoes={acoes} />);
    expect(tocados).toEqual([]);
    rerender(<TelaMesa snap={snap([antigo, { id: 2, em: Date.now(), tipo: 'acao', de: 1, texto: 'TRUCO!' }])} acoes={acoes} />);
    expect(tocados).toHaveLength(1);
    expect(tocados[0]).toMatch(/^\/vozes\/[0-5]-truco-[01]\.mp3$/);
  });

  test('cadeira com voz pessoal (conta dona, marcada pelo servidor) fala com ela', () => {
    const base = msgEstado(distribuida(PAULISTA));
    const cadeiras = base.cadeiras.map((c, i) => (i === 0 ? { ...c, voz: 'andre' } : c));
    const snap = (eventos: EstadoLoja['eventos']): EstadoLoja => ({ status: 'na-mesa', msg: { ...base, cadeiras }, eventos, erro: null, chat: [], salaId: 'r1' });
    const acoes = { enviarAcao: vi.fn(), enviarSinal: vi.fn(), enviarFala: vi.fn(), sair: vi.fn() };
    const { rerender } = render(<TelaMesa snap={snap([])} acoes={acoes} />);
    rerender(<TelaMesa snap={snap([{ id: 1, em: Date.now(), tipo: 'acao', de: 0, texto: 'TRUCO!' }])} acoes={acoes} />);
    expect(tocados.at(-1)).toMatch(/^\/vozes\/andre-truco-[01]\.mp3$/);
  });
});
