import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SAIDA_FILA_SUBSTITUIDA } from '@truco/protocolo';
import { EventEmitter } from 'node:events';
import { describe, expect, test, vi } from 'vitest';
import { criarLojaFila, type EstadoFila, type SalaFilaLike } from '../src/rede/fila';
import { TelaFila } from '../src/telas/Fila';

class FilaFalsa extends EventEmitter implements SalaFilaLike {
  saiu = false;
  onMessage(tipo: string, cb: (p: any) => void) {
    this.on(`msg:${tipo}`, cb);
  }
  onLeave(cb: (code: number) => void) {
    this.on('leave', cb);
  }
  async leave() {
    this.saiu = true;
    return 4000;
  }
}

const OPC = { variante: 'paulista', formato: '1x1' } as const;

describe('loja da fila', () => {
  test('entra, recebe status, é pareada: sai da fila e consome a reserva', async () => {
    const sala = new FilaFalsa();
    const aoParear = vi.fn(async () => {});
    const f = criarLojaFila({ abrir: vi.fn(async () => sala), aoParear });
    await f.entrar(OPC);
    expect(f.getSnapshot().status).toBe('na-fila');
    sala.emit('msg:status', { esperaS: 3, faixa: 100, naFila: 2, aguardandoParceiro: false });
    expect(f.getSnapshot().info?.naFila).toBe(2);
    sala.emit('msg:pareado', { reserva: { roomId: 'r9' } });
    expect(sala.saiu).toBe(true);
    expect(aoParear).toHaveBeenCalledWith({ roomId: 'r9' });
    await vi.waitFor(() => expect(f.getSnapshot().status).toBe('fora'));
  });

  test('servidor recusa (bloqueio): fica fora com a mensagem traduzida', async () => {
    const f = criarLojaFila({ abrir: vi.fn(async () => Promise.reject(new Error('entre na sua conta para jogar ranqueada'))), aoParear: vi.fn() });
    await f.entrar(OPC);
    expect(f.getSnapshot()).toMatchObject({ status: 'fora', erro: 'Entre na sua conta para jogar ranqueada.' });
  });

  test('cancelar sai da sala; queda inesperada avisa', async () => {
    const sala = new FilaFalsa();
    const f = criarLojaFila({ abrir: vi.fn(async () => sala), aoParear: vi.fn() });
    await f.entrar(OPC);
    await f.cancelar();
    expect(sala.saiu).toBe(true);
    expect(f.getSnapshot().status).toBe('fora');
    const outra = new FilaFalsa();
    const g = criarLojaFila({ abrir: vi.fn(async () => outra), aoParear: vi.fn() });
    await g.entrar(OPC);
    outra.emit('leave', 1006);
    expect(g.getSnapshot()).toMatchObject({ status: 'fora', erro: 'Você saiu da fila.' });
  });

  test('servidor derruba com SAIDA_FILA_SUBSTITUIDA (outra aba): avisa', async () => {
    const sala = new FilaFalsa();
    const f = criarLojaFila({ abrir: vi.fn(async () => sala), aoParear: vi.fn() });
    await f.entrar(OPC);
    sala.emit('leave', SAIDA_FILA_SUBSTITUIDA);
    expect(f.getSnapshot()).toMatchObject({ status: 'fora', erro: 'Você entrou na fila em outra aba.' });
  });

  test('cancelar e entrar de novo antes da primeira abrir: a sala atrasada é largada', async () => {
    const velha = new FilaFalsa();
    const nova = new FilaFalsa();
    const pendentes: ((s: SalaFilaLike) => void)[] = [];
    const abrir = vi.fn(() => new Promise<SalaFilaLike>((ok) => pendentes.push(ok)));
    const f = criarLojaFila({ abrir, aoParear: vi.fn() });
    const p1 = f.entrar(OPC);
    await f.cancelar();
    const p2 = f.entrar({ variante: 'mineiro', formato: '2x2' });
    pendentes[0](velha);
    await p1;
    expect(velha.saiu).toBe(true);
    expect(f.getSnapshot().status).toBe('entrando');
    pendentes[1](nova);
    await p2;
    expect(nova.saiu).toBe(false);
    expect(f.getSnapshot()).toMatchObject({ status: 'na-fila', opcoes: { variante: 'mineiro' } });
    velha.emit('msg:status', { esperaS: 1, faixa: 1, naFila: 9, aguardandoParceiro: false });
    expect(f.getSnapshot().info).toBeNull();
  });

  test('cancelar enquanto entra sai da sala assim que ela abre', async () => {
    const sala = new FilaFalsa();
    let abrir!: (s: FilaFalsa) => void;
    const f = criarLojaFila({ abrir: () => new Promise((r) => (abrir = r)), aoParear: vi.fn() });
    const entrando = f.entrar(OPC);
    expect(f.getSnapshot().status).toBe('entrando');
    await f.cancelar();
    abrir(sala);
    await entrando;
    expect(sala.saiu).toBe(true);
    expect(f.getSnapshot().status).toBe('fora');
  });
});

const FORA: EstadoFila = { status: 'fora', opcoes: null, info: null, erro: null };

describe('TelaFila', () => {
  test('escolhe variante, formato e código de dupla', async () => {
    const user = userEvent.setup();
    const aoEntrar = vi.fn();
    render(<TelaFila estado={FORA} aoEntrar={aoEntrar} aoCancelar={vi.fn()} />);
    expect(screen.queryByLabelText('Código da dupla (opcional)')).toBeNull();
    await user.selectOptions(screen.getByLabelText('Variante'), 'mineiro');
    await user.selectOptions(screen.getByLabelText('Formato'), '2x2');
    await user.type(screen.getByLabelText('Código da dupla (opcional)'), 'amigos');
    expect(screen.getByText(/família fechada/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Entrar na fila' }));
    expect(aoEntrar).toHaveBeenCalledWith({ variante: 'mineiro', formato: '2x2', codigoDupla: 'amigos' });
  });

  test('na fila: tempo, faixa e cancelar; erro como alerta', async () => {
    const user = userEvent.setup();
    const aoCancelar = vi.fn();
    const { rerender } = render(
      <TelaFila
        estado={{ status: 'na-fila', opcoes: { ...OPC }, info: { esperaS: 75, faixa: 300, naFila: 4, aguardandoParceiro: false }, erro: null }}
        aoEntrar={vi.fn()}
        aoCancelar={aoCancelar}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Procurando adversário…');
    expect(screen.getByRole('status')).toHaveTextContent('1:15 · faixa ±300 · 4 na fila');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(aoCancelar).toHaveBeenCalled();
    rerender(<TelaFila estado={{ ...FORA, erro: 'Fila bloqueada até 12:05 por abandono de partida ranqueada.' }} aoEntrar={vi.fn()} aoCancelar={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Fila bloqueada');
  });
});
