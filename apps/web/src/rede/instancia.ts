import { gravarToken } from './conexao';
import { criarLoja } from './loja';

/** A loja única da aplicação. */
export const loja = criarLoja({ persistirToken: gravarToken });
