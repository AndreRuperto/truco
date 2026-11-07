import { describe, expect, test } from 'vitest';
import { hrefDe, lerRota, linkConvite } from '../src/logica/rotas';

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
    expect(lerRota('#/admin')).toEqual({ tela: 'admin', aba: 'resumo' });
    expect(lerRota('#/admin/usuarios')).toEqual({ tela: 'admin', aba: 'usuarios' });
    expect(lerRota('#/admin/xyz')).toEqual({ tela: 'admin', aba: 'resumo' });
    expect(lerRota('#/nada')).toEqual({ tela: 'inicio' });
  });

  test('hrefDe é o inverso de lerRota', () => {
    for (const h of ['#/', '#/entrar', '#/entrar?token=t1', '#/perfil', '#/perfil?editar', '#/perfil/3', '#/historico', '#/ranking/mineiro', '#/salas', '#/privada/abcd', '#/fila', '#/como-jogar', '#/admin', '#/admin/mesas']) {
      expect(hrefDe(lerRota(h))).toBe(h);
    }
  });

  test('linkConvite', () => {
    expect(linkConvite('https://truco.app', 'abcd')).toBe('https://truco.app/#/privada/abcd');
  });
});
