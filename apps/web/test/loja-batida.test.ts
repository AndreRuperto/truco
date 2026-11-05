import { describe, expect, test } from 'vitest';
import { criarLoja } from '../src/rede/loja';
import { SalaFalsa } from './sala-falsa';

describe('loja: bater na mesa', () => {
  test('envia a batida com a força e guarda a última recebida (com id e hora de chegada)', () => {
    let agora = 5_000;
    const loja = criarLoja({ agora: () => agora });
    const sala = new SalaFalsa();
    loja.conectar(sala);
    loja.enviarBatida(0.7);
    expect(sala.enviados.at(-1)).toEqual(['batida', { forca: 0.7 }]);
    expect(loja.getSnapshot().batida ?? null).toBeNull();
    const msg = { de: 1, forca: 0.9, rachadura: { id: 1, cadeira: 1, x: 0.9, y: 0.5, angulo: 180, tamanho: 0.3, semente: 3 } };
    sala.receber('batida', msg);
    const b1 = loja.getSnapshot().batida!;
    expect(b1).toMatchObject({ ...msg, em: 5_000 });
    agora += 10;
    sala.receber('batida', { de: 2, forca: 0.1 });
    const b2 = loja.getSnapshot().batida!;
    expect(b2).toMatchObject({ de: 2, forca: 0.1, em: 5_010 });
    expect(b2.id).toBeGreaterThan(b1.id);
    // sair limpa
    void loja.sair();
    expect(loja.getSnapshot().batida ?? null).toBeNull();
  });
});
