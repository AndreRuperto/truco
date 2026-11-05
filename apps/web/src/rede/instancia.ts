import { criarApi } from './api';
import { abrirFila, entrarComReserva, gravarToken } from './conexao';
import { criarLojaFila, type SalaFilaLike } from './fila';
import { criarLoja } from './loja';
import { criarSessao } from './sessao';

/** A loja única da aplicação. */
export const loja = criarLoja({ persistirToken: gravarToken });
export const api = criarApi();
export const sessao = criarSessao(api);

export const lojaFila = criarLojaFila({
  abrir: async (o) => (await abrirFila(o)) as SalaFilaLike,
  aoParear: (reserva) => entrarComReserva(loja, reserva),
});
