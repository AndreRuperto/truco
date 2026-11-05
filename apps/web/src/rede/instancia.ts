import { criarApi } from './api';
import { abrirFila, entrarComReserva, gravarToken } from './conexao';
import { criarLojaFila, type SalaFilaLike } from './fila';
import { criarLoja } from './loja';
import { navegar } from './rota';
import { criarSessao } from './sessao';

/** A loja única da aplicação. */
export const loja = criarLoja({
  persistirToken: gravarToken,
  // Ranqueada cancelada antes de começar (alguém não apareceu): de volta à fila, mesmas opções.
  aoCancelarRanqueada: () => {
    navegar({ tela: 'fila' });
    void lojaFila.reentrar();
  },
});
// 401 numa chamada que exige login = a sessão expirou: volta a convidado.
export const api = criarApi(undefined, '', () => sessao.definirUsuario(null));
export const sessao = criarSessao(api);

export const lojaFila = criarLojaFila({
  abrir: async (o) => (await abrirFila(o)) as SalaFilaLike,
  aoParear: (reserva) => entrarComReserva(loja, reserva),
});
