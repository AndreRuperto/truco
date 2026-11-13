import type { Variante } from '@truco/engine';

export type Rota =
  | { tela: 'inicio' }
  | { tela: 'entrar'; token: string | null }
  | { tela: 'perfil'; id: number | null; editar?: true }
  | { tela: 'historico' }
  | { tela: 'ranking'; variante: Variante }
  | { tela: 'salas' }
  | { tela: 'privada'; codigo: string }
  | { tela: 'fila' }
  | { tela: 'manual' }
  | { tela: 'privacidade' }
  | { tela: 'termos' }
  | { tela: 'admin'; aba: AbaAdmin }
  | { tela: 'loja'; aba: AbaLoja }
  | { tela: 'lojaObrigado'; pedido: string | null };

/** Abas da loja: os slots de itens e os pacotes de Pila. */
export const ABAS_LOJA = ['verso', 'roupa', 'moldura', 'avatar', 'tampo', 'pila'] as const;
export type AbaLoja = (typeof ABAS_LOJA)[number];

export const ABAS_ADMIN = ['resumo', 'usuarios', 'pedidos', 'auditoria', 'mesas', 'partidas'] as const;
export type AbaAdmin = (typeof ABAS_ADMIN)[number];

export function lerRota(hash: string): Rota {
  const [caminho, busca = ''] = hash.replace(/^#/, '').split('?');
  const partes = caminho.split('/').filter(Boolean);
  switch (partes[0]) {
    case 'entrar':
      return { tela: 'entrar', token: new URLSearchParams(busca).get('token') || null };
    case 'perfil': {
      const n = Number(partes[1]);
      const id = Number.isInteger(n) && n > 0 ? n : null;
      // "?editar" (só no próprio perfil) leva direto ao bloco de edição.
      return id === null && new URLSearchParams(busca).has('editar') ? { tela: 'perfil', id, editar: true } : { tela: 'perfil', id };
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
    case 'privacidade':
      return { tela: 'privacidade' };
    case 'termos':
      return { tela: 'termos' };
    case 'admin':
      return { tela: 'admin', aba: (ABAS_ADMIN as readonly string[]).includes(partes[1]) ? (partes[1] as AbaAdmin) : 'resumo' };
    case 'loja': {
      if (partes[1] === 'obrigado') {
        const id = new URLSearchParams(busca).get('pedido');
        return { tela: 'lojaObrigado', pedido: id && /^[0-9a-f-]{36}$/.test(id) ? id : null };
      }
      return { tela: 'loja', aba: (ABAS_LOJA as readonly string[]).includes(partes[1]) ? (partes[1] as AbaLoja) : 'verso' };
    }
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
      return r.id ? `#/perfil/${r.id}` : r.editar ? '#/perfil?editar' : '#/perfil';
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
    case 'privacidade':
      return '#/privacidade';
    case 'termos':
      return '#/termos';
    case 'admin':
      return r.aba === 'resumo' ? '#/admin' : `#/admin/${r.aba}`;
    case 'loja':
      return r.aba === 'verso' ? '#/loja' : `#/loja/${r.aba}`;
    case 'lojaObrigado':
      return r.pedido ? `#/loja/obrigado?pedido=${r.pedido}` : '#/loja/obrigado';
  }
}

/** Link para mandar aos amigos (mesa privada). */
export const linkConvite = (origem: string, codigo: string): string => `${origem}/${hrefDe({ tela: 'privada', codigo })}`;
