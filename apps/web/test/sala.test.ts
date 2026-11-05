import type { InfoCadeira } from '@truco/protocolo';
import { describe, expect, test } from 'vitest';
import { donoDaMesa, souDono } from '../src/logica/sala';
import { msgEstado } from './fixtures';

const cadeiras: InfoCadeira[] = [
  { tipo: 'humano', nome: 'Ana', conectado: false },
  { tipo: 'vazia', nome: null, conectado: true },
  { tipo: 'humano', nome: 'Bia', conectado: true },
  { tipo: 'vazia', nome: null, conectado: true },
];

describe('dono da mesa (o servidor aceita "iniciar" do primeiro humano conectado)', () => {
  test('primeiro humano conectado, na ordem das cadeiras', () => {
    expect(donoDaMesa(cadeiras)).toBe(2);
    expect(donoDaMesa([{ tipo: 'vazia', nome: null, conectado: true }])).toBeNull();
  });

  test('souDono', () => {
    expect(souDono(msgEstado(null, 2, { cadeiras }))).toBe(true);
    expect(souDono(msgEstado(null, 0, { cadeiras }))).toBe(false);
  });
});
