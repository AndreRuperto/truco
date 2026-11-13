import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { TelaPrivacidade } from '../src/telas/Privacidade';
import { TelaTermos } from '../src/telas/Termos';

describe('páginas legais (F6.4)', () => {
  test('Privacidade: rascunho marcado e o conteúdo mínimo da LGPD', () => {
    render(<TelaPrivacidade />);
    expect(screen.getByRole('heading', { level: 1, name: 'Privacidade' })).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('Rascunho');
    for (const t of ['Quem cuida dos dados', 'O que guardamos', 'Para que usamos', 'Com quem compartilhamos', 'Por quanto tempo', 'Seus direitos', 'Menores de idade']) {
      expect(screen.getByRole('heading', { level: 2, name: t })).toBeInTheDocument();
    }
    const texto = document.body.textContent ?? '';
    for (const termo of ['e-mail', 'apelido', 'foto', 'Google', 'IP', 'cookie', 'Railway', 'Resend', 'InfinitePay', '15 minutos', '30 dias', 'Jogador removido', 'LGPD']) {
      expect(texto).toContain(termo);
    }
    expect(screen.getByRole('link', { name: 'Perfil' })).toHaveAttribute('href', '#/perfil?editar');
    expect(screen.getByRole('link', { name: 'Termos de uso' })).toHaveAttribute('href', '#/termos');
  });

  test('Termos: conduta, banimento, ranking, moedas sem valor em dinheiro e disponibilidade', () => {
    render(<TelaTermos />);
    expect(screen.getByRole('note')).toHaveTextContent('Rascunho');
    for (const t of ['Conduta na mesa', 'Banimento', 'Ranking', 'Fichas e Pila', 'Disponibilidade']) {
      expect(screen.getByRole('heading', { level: 2, name: t })).toBeInTheDocument();
    }
    const texto = document.body.textContent ?? '';
    expect(texto).toContain('não têm valor em dinheiro');
    // O mesmo texto dos termos da loja.
    expect(texto).toContain('Pila não vira Fichas, e Fichas não viram Pila.');
    expect(screen.getByRole('link', { name: 'Privacidade' })).toHaveAttribute('href', '#/privacidade');
  });
});
