import { render, screen } from '@testing-library/react';
import { ESCADAS } from '@truco/engine';
import { FALAS, SINAIS } from '@truco/protocolo';
import { expect, test } from 'vitest';

test('aliases do engine e do protocolo resolvem', () => {
  expect(ESCADAS['1-3-6-9-12']).toEqual([1, 3, 6, 9, 12]);
  expect(SINAIS).toHaveLength(9);
  expect(FALAS).toContain('truco');
});

test('jsdom + Testing Library + jest-dom funcionam', () => {
  render(<p>Truco!</p>);
  expect(screen.getByText('Truco!')).toBeInTheDocument();
});
