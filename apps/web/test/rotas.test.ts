import { describe, expect, test } from 'vitest';
import { ABAS_LOJA, hrefDe, lerRota, linkConvite } from '../src/logica/rotas';

describe('rotas por hash', () => {
  test('lerRota', () => {
    expect(lerRota('')).toEqual({ tela: 'inicio' });
    expect(lerRota('#/')).toEqual({ tela: 'inicio' });
    expect(lerRota('#/entrar')).toEqual({ tela: 'entrar', token: null });
    expect(lerRota('#/entrar?token=abc_-1')).toEqual({ tela: 'entrar', token: 'abc_-1' });
    expect(lerRota('#/perfil')).toEqual({ tela: 'perfil', id: null });
    expect(lerRota('#/perfil/12')).toEqual({ tela: 'perfil', id: 12 });
    expect(lerRota('#/perfil/x')).toEqual({ tela: 'perfil', id: null });
    expect(lerRota('#/perfil?editar')).toEqual({ tela: 'perfil', id: null, editar: true });
    expect(lerRota('#/historico')).toEqual({ tela: 'historico' });
    expect(lerRota('#/ranking')).toEqual({ tela: 'ranking', variante: 'paulista' });
    expect(lerRota('#/ranking/mineiro')).toEqual({ tela: 'ranking', variante: 'mineiro' });
    expect(lerRota('#/salas')).toEqual({ tela: 'salas' });
    expect(lerRota('#/privada/AbC123xyz')).toEqual({ tela: 'privada', codigo: 'AbC123xyz' });
    expect(lerRota('#/privada/<script>')).toEqual({ tela: 'inicio' });
    expect(lerRota('#/fila')).toEqual({ tela: 'fila' });
    expect(lerRota('#/como-jogar')).toEqual({ tela: 'manual' });
    expect(lerRota('#/privacidade')).toEqual({ tela: 'privacidade' });
    expect(lerRota('#/termos')).toEqual({ tela: 'termos' });
    expect(lerRota('#/admin')).toEqual({ tela: 'admin', aba: 'resumo' });
    expect(lerRota('#/admin/usuarios')).toEqual({ tela: 'admin', aba: 'usuarios' });
    expect(lerRota('#/admin/pedidos')).toEqual({ tela: 'admin', aba: 'pedidos' });
    expect(lerRota('#/admin/auditoria')).toEqual({ tela: 'admin', aba: 'auditoria' });
    expect(lerRota('#/admin/xyz')).toEqual({ tela: 'admin', aba: 'resumo' });
    expect(lerRota('#/nada')).toEqual({ tela: 'inicio' });
    expect(lerRota('#/loja')).toEqual({ tela: 'loja', aba: 'verso' });
    // Compra de Pila com dinheiro fechada: o link antigo cai na Loja normal.
    expect(lerRota('#/loja/pila')).toEqual({ tela: 'loja', aba: 'verso' });
    expect(ABAS_LOJA).not.toContain('pila');
    expect(lerRota('#/loja/xyz')).toEqual({ tela: 'loja', aba: 'verso' });
    const id = '0b6f0c1e-9a51-4a0b-8f53-2f6f2c4f9a10';
    expect(lerRota(`#/loja/obrigado?pedido=${id}`)).toEqual({ tela: 'lojaObrigado', pedido: id });
    expect(lerRota('#/loja/obrigado?pedido=<x>')).toEqual({ tela: 'lojaObrigado', pedido: null });
  });

  test('hrefDe é o inverso de lerRota', () => {
    for (const h of ['#/', '#/entrar', '#/entrar?token=t1', '#/perfil', '#/perfil?editar', '#/perfil/3', '#/historico', '#/ranking/mineiro', '#/salas', '#/privada/abcd', '#/fila', '#/como-jogar', '#/privacidade', '#/termos', '#/admin', '#/admin/mesas', '#/loja', '#/loja/moldura', '#/loja/obrigado?pedido=0b6f0c1e-9a51-4a0b-8f53-2f6f2c4f9a10']) {
      expect(hrefDe(lerRota(h))).toBe(h);
    }
  });

  test('linkConvite', () => {
    expect(linkConvite('https://truco.app', 'abcd')).toBe('https://truco.app/#/privada/abcd');
  });
});
