import { describe, expect, test, vi } from 'vitest';
import { criarLoja } from '../src/rede/loja';
import { distribuida, jogar, msgEstado, PAULISTA } from './fixtures';
import { SalaFalsa } from './sala-falsa';

function montar() {
  let agora = 1_000;
  const tokens: (string | null)[] = [];
  const loja = criarLoja({ agora: () => agora, persistirToken: (t) => tokens.push(t) });
  const sala = new SalaFalsa();
  return { loja, sala, tokens, passar: (ms: number) => (agora += ms) };
}

describe('loja', () => {
  test('registra todos os handlers antes de pedir sincronizar', () => {
    const { loja, sala, tokens } = montar();
    loja.conectar(sala);
    expect(sala.enviados).toEqual([['sincronizar', undefined]]);
    expect(sala.ouvintesNoEnvio[0]).toEqual({ estado: 1, acao: 1, sinal: 1, fala: 1, erro: 1, chat: 1, batida: 1 });
    expect(loja.getSnapshot().status).toBe('na-mesa');
    expect(tokens).toEqual(['r1:t1']);
  });

  test('estado novo troca o snapshot e avisa quem assina', () => {
    const { loja, sala } = montar();
    loja.conectar(sala);
    const ouvinte = vi.fn();
    const sair = loja.subscribe(ouvinte);
    const antes = loja.getSnapshot();
    const msg = msgEstado(distribuida(PAULISTA));
    sala.receber('estado', msg);
    expect(loja.getSnapshot()).not.toBe(antes);
    expect(loja.getSnapshot().msg).toBe(msg);
    expect(ouvinte).toHaveBeenCalledTimes(1);
    sair();
    sala.receber('estado', msg);
    expect(ouvinte).toHaveBeenCalledTimes(1);
  });

  test('ação de truco vira balão com o nível do estado anterior; jogar não', () => {
    const { loja, sala } = montar();
    loja.conectar(sala);
    sala.receber('estado', msgEstado(distribuida(PAULISTA)));
    sala.receber('acao', { cadeira: 0, tipo: 'jogar' });
    sala.receber('acao', { cadeira: 0, tipo: 'truco' });
    expect(loja.getSnapshot().eventos).toEqual([{ id: expect.any(Number), em: 1_000, tipo: 'acao', de: 0, texto: 'TRUCO!' }]);
  });

  test('toda mensagem acao vira um movimento (para as animações), com id crescente', () => {
    const { loja, sala } = montar();
    loja.conectar(sala);
    sala.receber('acao', { cadeira: 3, tipo: 'embaralhar' });
    sala.receber('acao', { cadeira: 3, tipo: 'distribuir', modo: 'porCima', ordem: [0, 1, 2, 3] });
    const mov = loja.getSnapshot().movimentos!;
    expect(mov.map((m) => m.msg.tipo)).toEqual(['embaralhar', 'distribuir']);
    expect(mov[1].id).toBeGreaterThan(mov[0].id);
  });

  test('falas e sinais entram no feed', () => {
    const { loja, sala, passar } = montar();
    loja.conectar(sala);
    sala.receber('fala', { de: 2, fala: 'bora' });
    passar(10);
    sala.receber('sinal', { de: 2, sinal: 'zap' });
    sala.receber('sinal', { de: 1, sinal: 'tres', interceptado: true });
    expect(loja.getSnapshot().eventos.map(({ id: _id, ...e }) => e)).toEqual([
      { tipo: 'fala', de: 2, texto: 'Bora!', em: 1_000 },
      { tipo: 'sinal', de: 2, sinal: 'zap', interceptado: false, em: 1_010 },
      { tipo: 'sinal', de: 1, sinal: 'tres', interceptado: true, em: 1_010 },
    ]);
  });

  test('sinal que chega antes do estado da mão nova não se perde', () => {
    // Os bots sinalizam dentro de `distribuir`: o `sinal` pode chegar antes do `estado` da mão nova.
    const { loja, sala } = montar();
    loja.conectar(sala);
    sala.receber('estado', msgEstado(jogar(distribuida(PAULISTA), [[0, 0]])));
    sala.receber('sinal', { de: 2, sinal: 'zap' });
    sala.receber('estado', msgEstado(distribuida(PAULISTA)));
    expect(loja.getSnapshot().eventos).toMatchObject([{ tipo: 'sinal', de: 2, sinal: 'zap' }]);
  });

  test('feed guarda no máximo 30 eventos', () => {
    const { loja, sala } = montar();
    loja.conectar(sala);
    for (let i = 0; i < 40; i++) sala.receber('fala', { de: 1, fala: 'boa' });
    expect(loja.getSnapshot().eventos).toHaveLength(30);
  });

  test('erro do servidor vira toast e some com limparErro', () => {
    const { loja, sala } = montar();
    loja.conectar(sala);
    sala.receber('erro', { mensagem: 'não é sua vez' });
    const erro = loja.getSnapshot().erro!;
    expect(erro.mensagem).toBe('não é sua vez');
    loja.limparErro(erro.id + 1); // id velho não apaga um erro novo
    expect(loja.getSnapshot().erro).not.toBeNull();
    loja.limparErro(erro.id);
    expect(loja.getSnapshot().erro).toBeNull();
  });

  test('queda descarta estado e animações obsoletos até nova sincronização', () => {
    const { loja, sala } = montar();
    loja.conectar(sala);
    sala.receber('estado', msgEstado(distribuida(PAULISTA)));
    sala.receber('acao', { cadeira: 3, tipo: 'embaralhar' });
    sala.receber('batida', { de: 0, forca: 1 });
    expect(loja.getSnapshot().msg).not.toBeNull();
    expect(loja.getSnapshot().movimentos).toHaveLength(1);
    sala.emit('drop', 1006);
    expect(loja.getSnapshot()).toMatchObject({
      status: 'reconectando', msg: null, movimentos: [], batida: null,
    });
    sala.emit('reconnect');
    expect(loja.getSnapshot().msg).toBeNull();
    sala.receber('estado', msgEstado(distribuida(PAULISTA)));
    expect(loja.getSnapshot().msg).not.toBeNull();
  });

  // Ciclo 4: durante a queda a mesa continua na tela (esmaecida, só leitura) com o último
  // estado do servidor. `msg` segue sendo só a verdade atual; `estadoAnterior` só serve para exibir.
  test('queda guarda o último estado só para exibir; o estado novo o substitui', () => {
    const { loja, sala } = montar();
    loja.conectar(sala);
    const visto = msgEstado(distribuida(PAULISTA));
    sala.receber('estado', visto);
    expect(loja.getSnapshot().estadoAnterior ?? null).toBeNull();
    sala.emit('drop', 1006);
    expect(loja.getSnapshot()).toMatchObject({ status: 'reconectando', msg: null, estadoAnterior: visto });
    sala.emit('reconnect');
    expect(loja.getSnapshot()).toMatchObject({ status: 'na-mesa', msg: null, estadoAnterior: visto });
    const novo = msgEstado(distribuida(PAULISTA));
    sala.receber('estado', novo);
    expect(loja.getSnapshot()).toMatchObject({ msg: novo, estadoAnterior: null });
  });

  test('nova tentativa na mesma sala (F5 não, retry do app) mantém o estado anterior até o novo chegar', () => {
    const { loja, sala } = montar();
    loja.conectar(sala);
    const visto = msgEstado(distribuida(PAULISTA));
    sala.receber('estado', visto);
    sala.emit('leave', 1006);
    expect(loja.getSnapshot().estadoAnterior).toBe(visto);
    loja.marcarReconectando();
    loja.marcarConectando();
    expect(loja.getSnapshot().estadoAnterior).toBe(visto);
    const mesmaSala = new SalaFalsa();
    loja.conectar(mesmaSala);
    expect(loja.getSnapshot()).toMatchObject({ status: 'na-mesa', msg: null, estadoAnterior: visto });
  });

  test('outra sala, desistir ou sair descartam o estado anterior', () => {
    const { loja, sala } = montar();
    loja.conectar(sala);
    sala.receber('estado', msgEstado(distribuida(PAULISTA)));
    sala.emit('drop', 1006);
    const outra = new SalaFalsa();
    outra.roomId = 'r2';
    loja.conectar(outra);
    expect(loja.getSnapshot().estadoAnterior ?? null).toBeNull();

    outra.receber('estado', msgEstado(distribuida(PAULISTA)));
    outra.emit('drop', 1006);
    loja.desistirReconexao();
    expect(loja.getSnapshot().estadoAnterior ?? null).toBeNull();
  });

  test('queda e reconexão automática do SDK', async () => {
    const { loja, sala, tokens } = montar();
    loja.conectar(sala);
    sala.emit('drop', 1006);
    expect(loja.getSnapshot().status).toBe('reconectando');
    // O SDK 0.18 chama onReconnect ANTES de trocar `reconnectionToken` (a troca fica no `finally`).
    sala.emit('reconnect');
    sala.reconnectionToken = 'r1:t2';
    expect(loja.getSnapshot().status).toBe('na-mesa');
    expect(sala.enviados.at(-1)).toEqual(['sincronizar', undefined]);
    await Promise.resolve();
    expect(tokens.at(-1)).toBe('r1:t2');
  });

  test('não envia ações durante queda; retoma após sincronização', () => {
    const { loja, sala } = montar();
    loja.conectar(sala);
    sala.emit('drop', 1006);
    const antes = sala.enviados.length;
    loja.enviarAcao({ tipo: 'truco', cadeira: 0 });
    loja.enviarSinal('zap');
    loja.enviarFala('boa');
    loja.enviarChat('oi');
    loja.enviarRevanche();
    loja.enviarBatida(1);
    loja.iniciar();
    expect(sala.enviados).toHaveLength(antes);
    sala.emit('reconnect');
    expect(sala.enviados.at(-1)).toEqual(['sincronizar', undefined]);
    const antesDoEstado = sala.enviados.length;
    loja.enviarAcao({ tipo: 'truco', cadeira: 0 });
    expect(sala.enviados).toHaveLength(antesDoEstado);
    sala.receber('estado', msgEstado(distribuida(PAULISTA)));
    loja.enviarAcao({ tipo: 'truco', cadeira: 0 });
    expect(sala.enviados.at(-1)).toEqual(['acao', { tipo: 'truco', cadeira: 0 }]);
  });

  test('saída consentida do servidor (4000): lobby sem toast e esquece o token', () => {
    const { loja, sala, tokens } = montar();
    loja.conectar(sala);
    sala.emit('leave', 4000);
    expect(loja.getSnapshot()).toMatchObject({ status: 'fora', erro: null });
    expect(tokens.at(-1)).toBeNull();
  });

  test('queda involuntária preserva a cadeira e mantém recuperação automática', () => {
    const { loja, sala, tokens } = montar();
    loja.conectar(sala);
    sala.emit('leave', 1006);
    expect(loja.getSnapshot()).toMatchObject({ status: 'reconectando', msg: null, erro: null });
    expect(tokens.at(-1)).toBe('r1:t1');
  });

  test('queda depois do fim da partida esquece o token', () => {
    const { loja, sala, tokens } = montar();
    loja.conectar(sala);
    const m = msgEstado(distribuida(PAULISTA));
    sala.receber('estado', { ...m, visao: { ...m.visao!, fase: 'fimPartida' } });
    sala.emit('leave', 4003);
    expect(loja.getSnapshot().status).toBe('fora');
    expect(tokens.at(-1)).toBeNull();
  });

  test('conectar com outra sala aberta sai da antiga (consentido)', () => {
    const { loja, sala, tokens } = montar();
    loja.conectar(sala);
    const nova = new SalaFalsa();
    nova.reconnectionToken = 'r2:t1';
    const sair = vi.spyOn(sala, 'leave');
    loja.conectar(nova);
    expect(sair).toHaveBeenCalledWith(true);
    expect(loja.getSnapshot()).toMatchObject({ status: 'na-mesa', erro: null });
    expect(tokens.at(-1)).toBe('r2:t1');
    loja.iniciar();
    expect(nova.enviados.at(-1)).toEqual(['iniciar', undefined]);
  });

  test('mensagens atrasadas da sala anterior não sobrescrevem a partida atual', () => {
    const { loja, sala: antiga, tokens } = montar();
    loja.conectar(antiga);
    const nova = new SalaFalsa();
    nova.roomId = 'r2';
    nova.reconnectionToken = 'r2:t1';
    loja.conectar(nova);
    const atual = msgEstado(distribuida(PAULISTA));
    nova.receber('estado', atual);
    antiga.receber('estado', msgEstado(distribuida(PAULISTA)));
    antiga.receber('acao', { cadeira: 1, tipo: 'embaralhar' });
    antiga.receber('erro', { mensagem: 'erro antigo' });
    antiga.emit('drop', 1006);
    antiga.emit('reconnect');
    antiga.emit('leave', 1006);
    expect(loja.getSnapshot()).toMatchObject({
      status: 'na-mesa', salaId: 'r2', msg: atual, erro: null, movimentos: [],
    });
    expect(tokens.at(-1)).toBe('r2:t1');
    expect(nova.enviados).toEqual([['sincronizar', undefined]]);
  });

  test('envia ações, sinais, falas e iniciar', () => {
    const { loja, sala } = montar();
    loja.conectar(sala);
    loja.enviarAcao({ tipo: 'truco', cadeira: 0 });
    loja.enviarSinal('zap');
    loja.enviarFala('desce');
    loja.iniciar();
    expect(sala.enviados.slice(1)).toEqual([
      ['acao', { tipo: 'truco', cadeira: 0 }],
      ['sinal', 'zap'],
      ['fala', 'desce'],
      ['iniciar', undefined],
    ]);
  });

  test('sair: leave consentido limpa tudo e esquece o token', async () => {
    const { loja, sala, tokens } = montar();
    loja.conectar(sala);
    sala.receber('estado', msgEstado(distribuida(PAULISTA)));
    await loja.sair();
    expect(loja.getSnapshot()).toMatchObject({ status: 'fora', msg: null, eventos: [] });
    expect(tokens.at(-1)).toBeNull();
    loja.enviarAcao({ tipo: 'truco', cadeira: 0 });
    expect(sala.enviados).toHaveLength(1);
  });

  test('sair não trava a UI se o leave nunca resolve (socket meio aberto)', () => {
    const { loja, sala, tokens } = montar();
    loja.conectar(sala);
    vi.spyOn(sala, 'leave').mockReturnValue(new Promise(() => {}));
    void loja.sair();
    expect(sala.leave).toHaveBeenCalledWith(true);
    expect(loja.getSnapshot().status).toBe('fora');
    expect(tokens.at(-1)).toBeNull();
  });

  test('falha de conexão volta ao lobby, com ou sem mensagem', () => {
    const { loja } = montar();
    loja.marcarConectando();
    expect(loja.getSnapshot().status).toBe('conectando');
    loja.falhouConexao('sem servidor');
    expect(loja.getSnapshot()).toMatchObject({ status: 'fora', erro: { mensagem: 'sem servidor' } });
    loja.limparErro(loja.getSnapshot().erro!.id);
    loja.falhouConexao();
    expect(loja.getSnapshot().erro).toBeNull();
  });
});
