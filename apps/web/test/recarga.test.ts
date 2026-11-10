import { describe, expect, test, vi } from 'vitest';
import { avisoDeAtualizacao, importarComRecarga } from '../src/rede/recarga';

/**
 * Ciclo 4 (service worker e deploy): uma aba aberta antes do deploy pede um pedaço de código
 * (chunk) com o hash antigo, que o servidor novo já não tem. O `import()` falha com
 * "Failed to fetch dynamically imported module" e, antes, o "Jogar agora" falhava em silêncio.
 */
function ambiente(online = true) {
  const guardado = new Map<string, string>();
  return {
    recarregar: vi.fn(),
    online: () => online,
    agora: () => 100_000,
    armazenamento: {
      getItem: (k: string) => guardado.get(k) ?? null,
      setItem: (k: string, v: string) => void guardado.set(k, v),
      removeItem: (k: string) => void guardado.delete(k),
    },
    guardado,
  };
}

const chunkSumiu = () => Promise.reject(new TypeError('Failed to fetch dynamically imported module: http://x/assets/index-Cnai96a0.js'));

describe('importarComRecarga', () => {
  test('import que funciona devolve o módulo e não recarrega', async () => {
    const amb = ambiente();
    await expect(importarComRecarga(() => Promise.resolve({ ok: 1 }), amb)).resolves.toEqual({ ok: 1 });
    expect(amb.recarregar).not.toHaveBeenCalled();
  });

  test('chunk sumiu depois de um deploy (online): recarrega uma vez e marca o aviso', async () => {
    const amb = ambiente();
    const p = importarComRecarga(chunkSumiu, amb);
    await expect(Promise.race([p.then(() => 'resolveu', () => 'rejeitou'), new Promise((r) => setTimeout(() => r('pendente'), 20))])).resolves.toBe('pendente');
    expect(amb.recarregar).toHaveBeenCalledTimes(1);
    expect(avisoDeAtualizacao(amb.armazenamento)).toBe('Recarregamos a página para terminar de carregar o Truco. Tente de novo.');
    // O aviso é lido uma vez só.
    expect(avisoDeAtualizacao(amb.armazenamento)).toBeNull();
  });

  test.each([
    'Importing a module script failed.', // Safari
    'error loading dynamically imported module: http://x/assets/cena-a.js', // Firefox
  ])('reconhece o erro de chunk de outros navegadores: %s', async (texto) => {
    const amb = ambiente();
    void importarComRecarga(() => Promise.reject(new TypeError(texto)), amb);
    await new Promise((r) => setTimeout(r, 0));
    expect(amb.recarregar).toHaveBeenCalledTimes(1);
  });

  test('não recarrega em loop: se já recarregou há pouco, devolve o erro', async () => {
    const amb = ambiente();
    void importarComRecarga(chunkSumiu, amb);
    await new Promise((r) => setTimeout(r, 0));
    await expect(importarComRecarga(chunkSumiu, amb)).rejects.toThrow(/dynamically imported module/);
    expect(amb.recarregar).toHaveBeenCalledTimes(1);
  });

  test('cada atualização avisa uma vez, inclusive uma segunda na mesma sessão', async () => {
    let t = 100_000;
    const amb = { ...ambiente(), agora: () => t };
    void importarComRecarga(chunkSumiu, amb);
    await new Promise((r) => setTimeout(r, 0));
    expect(avisoDeAtualizacao(amb.armazenamento)).not.toBeNull();
    t += 120_000; // outro deploy, bem depois
    void importarComRecarga(chunkSumiu, amb);
    await new Promise((r) => setTimeout(r, 0));
    expect(amb.recarregar).toHaveBeenCalledTimes(2);
    expect(avisoDeAtualizacao(amb.armazenamento)).toBe('Recarregamos a página para terminar de carregar o Truco. Tente de novo.');
  });

  test('sem internet não recarrega (a página offline tomaria o lugar da mesa): devolve o erro', async () => {
    const amb = ambiente(false);
    await expect(importarComRecarga(chunkSumiu, amb)).rejects.toThrow(/dynamically imported module/);
    expect(amb.recarregar).not.toHaveBeenCalled();
  });

  test('outro erro do módulo não recarrega', async () => {
    const amb = ambiente();
    await expect(importarComRecarga(() => Promise.reject(new Error('WebGL indisponível')), amb)).rejects.toThrow('WebGL indisponível');
    expect(amb.recarregar).not.toHaveBeenCalled();
  });
});
