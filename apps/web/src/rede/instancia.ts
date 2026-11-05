import { criarApi } from './api';
import { gravarToken } from './conexao';
import { criarLoja } from './loja';
import { criarSessao } from './sessao';

/** A loja única da aplicação. */
export const loja = criarLoja({ persistirToken: gravarToken });
export const api = criarApi();
export const sessao = criarSessao(api);
