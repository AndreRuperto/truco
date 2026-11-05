import { describe, expect, test, vi } from 'vitest';
import { formPadrao, opcoesDeEntrada } from '../src/logica/lobby';
import { CHAVE_TOKEN, entrarNaMesa, gravarToken, lerToken, tentarReconectar } from '../src/rede/conexao';
import { criarLoja } from '../src/rede/loja';
import { SalaFalsa } from './sala-falsa';

const opcoes = opcoesDeEntrada(formPadrao('paulista', 'Ana'));
const novaLoja = () => criarLoja({ persistirToken: gravarToken });

describe('token de reconexão', () => {
  test('grava e apaga no sessionStorage', () => {
    expect(lerToken()).toBeNull();
    gravarToken('r1:t1');
    expect(sessionStorage.getItem(CHAVE_TOKEN)).toBe('r1:t1');
    gravarToken(null);
    expect(lerToken()).toBeNull();
  });
});

describe('entrarNaMesa', () => {
  test('joinOrCreate("mesa", opções) e conecta a loja', async () => {
    const sala = new SalaFalsa();
    const cliente = { joinOrCreate: vi.fn(async () => sala), reconnect: vi.fn() };
    const loja = novaLoja();
    await entrarNaMesa(loja, opcoes, cliente);
    expect(cliente.joinOrCreate).toHaveBeenCalledWith('mesa', opcoes);
    expect(loja.getSnapshot().status).toBe('na-mesa');
    expect(sala.enviados).toEqual([['sincronizar', undefined]]);
    expect(lerToken()).toBe('r1:t1');
  });

  test('clique duplo não cria duas salas', async () => {
    const cliente = { joinOrCreate: vi.fn(async () => new SalaFalsa()), reconnect: vi.fn() };
    const loja = novaLoja();
    await Promise.all([entrarNaMesa(loja, opcoes, cliente), entrarNaMesa(loja, opcoes, cliente)]);
    expect(cliente.joinOrCreate).toHaveBeenCalledTimes(1);
    expect(loja.getSnapshot().status).toBe('na-mesa');
  });

  test('falha ao entrar volta ao lobby com erro', async () => {
    const cliente = { joinOrCreate: vi.fn(async () => Promise.reject(new Error('mesa cheia ou já iniciada'))), reconnect: vi.fn() };
    const loja = novaLoja();
    await entrarNaMesa(loja, opcoes, cliente);
    expect(loja.getSnapshot().status).toBe('fora');
    expect(loja.getSnapshot().erro?.mensagem).toBe('Não foi possível entrar na mesa: mesa cheia ou já iniciada');
  });
});

describe('tentarReconectar', () => {
  test('sem token não tenta', async () => {
    const cliente = { joinOrCreate: vi.fn(), reconnect: vi.fn() };
    expect(await tentarReconectar(novaLoja(), cliente)).toBe(false);
    expect(cliente.reconnect).not.toHaveBeenCalled();
  });

  test('com token volta para a mesma sala e pede sincronizar', async () => {
    gravarToken('r1:t1');
    const sala = new SalaFalsa();
    const cliente = { joinOrCreate: vi.fn(), reconnect: vi.fn(async () => sala) };
    const loja = novaLoja();
    expect(await tentarReconectar(loja, cliente)).toBe(true);
    expect(cliente.reconnect).toHaveBeenCalledWith('r1:t1');
    expect(loja.getSnapshot().status).toBe('na-mesa');
    expect(sala.enviados).toEqual([['sincronizar', undefined]]);
  });

  test('chamadas simultâneas (StrictMode) reconectam uma vez só', async () => {
    gravarToken('r1:t1');
    const cliente = { joinOrCreate: vi.fn(), reconnect: vi.fn(async () => new SalaFalsa()) };
    const loja = novaLoja();
    const [a, b] = await Promise.all([tentarReconectar(loja, cliente), tentarReconectar(loja, cliente)]);
    expect([a, b]).toEqual([true, true]);
    expect(cliente.reconnect).toHaveBeenCalledTimes(1);
  });

  test('com a loja já na mesa (re-render/Fast Refresh) não reconecta nem apaga o token', async () => {
    gravarToken('r1:t1');
    const cliente = { joinOrCreate: vi.fn(), reconnect: vi.fn(async () => new SalaFalsa()) };
    const loja = novaLoja();
    loja.conectar(new SalaFalsa());
    loja.marcarConectando();
    expect(await tentarReconectar(loja, cliente)).toBe(false);
    loja.conectar(new SalaFalsa());
    expect(await tentarReconectar(loja, cliente)).toBe(false);
    expect(cliente.reconnect).not.toHaveBeenCalled();
    expect(lerToken()).toBe('r1:t1');
    expect(loja.getSnapshot().status).toBe('na-mesa');
  });

  test('token vencido é apagado e fica no lobby sem toast', async () => {
    gravarToken('r1:velho');
    const cliente = { joinOrCreate: vi.fn(), reconnect: vi.fn(async () => Promise.reject(new Error('expirou'))) };
    const loja = novaLoja();
    expect(await tentarReconectar(loja, cliente)).toBe(false);
    expect(lerToken()).toBeNull();
    expect(loja.getSnapshot()).toMatchObject({ status: 'fora', erro: null });
  });
});
