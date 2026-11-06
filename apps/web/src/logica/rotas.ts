import type { Variante } from '@truco/engine';

export type Rota =
  | { tela: 'inicio' }
  | { tela: 'entrar'; token: string | null }
  | { tela: 'perfil'; id: number | null }
  | { tela: 'historico' }
  | { tela: 'ranking'; variante: Variante }
  | { tela: 'salas' }
  | { tela: 'privada'; codigo: string }
  | { tela: 'fila' }
  | { tela: 'manual' };

export function lerRota(hash: string): Rota {
  const [caminho, busca = ''] = hash.replace(/^#/, '').split('?');
  const partes = caminho.split('/').filter(Boolean);
  switch (partes[0]) {
    case 'entrar':
      return { tela: 'entrar', token: new URLSearchParams(busca).get('token') || null };
    case 'perfil': {
      const id = Number(partes[1]);
      return { tela: 'perfil', id: Number.isInteger(id) && id > 0 ? id : null };
    }
    case 'historico':
      return { tela: 'historico' };
    case 'ranking':
      return { tela: 'ranking', variante: partes[1] === 'mineiro' ? 'mineiro' : 'paulista' };
    case 'salas':
      return { tela: 'salas' };
    case 'privada':
      return partes[1] && /^[A-Za-z0-9_-]{4,40}$/.test(partes[1]) ? { tela: 'privada', codigo: partes[1] } : { tela: 'inicio' };
    case 'fila':
      return { tela: 'fila' };
    case 'como-jogar':
      return { tela: 'manual' };
    default:
      return { tela: 'inicio' };
  }
}

export function hrefDe(r: Rota): string {
  switch (r.tela) {
    case 'inicio':
      return '#/';
    case 'entrar':
      return r.token ? `#/entrar?token=${encodeURIComponent(r.token)}` : '#/entrar';
    case 'perfil':
      return r.id ? `#/perfil/${r.id}` : '#/perfil';
    case 'historico':
      return '#/historico';
    case 'ranking':
      return `#/ranking/${r.variante}`;
    case 'salas':
      return '#/salas';
    case 'privada':
      return `#/privada/${r.codigo}`;
    case 'fila':
      return '#/fila';
    case 'manual':
      return '#/como-jogar';
  }
}

/** Link para mandar aos amigos (mesa privada). */
export const linkConvite = (origem: string, codigo: string): string => `${origem}/${hrefDe({ tela: 'privada', codigo })}`;
