import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { InstalarTruco } from '../src/componentes/InstalarTruco';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Instalação PWA', () => {
  test('apresenta instruções quando navegador não oferece instalação nativa', async () => {
    const user = userEvent.setup();
    render(<InstalarTruco />);
    await user.click(screen.getByRole('button', { name: 'Instalar' }));
    expect(screen.getByRole('status')).toHaveTextContent(/Abr(a|ir).*Chrome|Abra este site no Chrome/i);
  });

  test('usa o prompt nativo do Android quando o navegador disponibiliza', async () => {
    const user = userEvent.setup();
    const prompt = vi.fn().mockResolvedValue(undefined);
    const { unmount } = render(<InstalarTruco />);
    const evento = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    });
    act(() => window.dispatchEvent(evento));
    expect(evento.defaultPrevented).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Instalar' }));
    expect(prompt).toHaveBeenCalledOnce();
    act(() => window.dispatchEvent(new Event('appinstalled')));
    expect(screen.queryByRole('button', { name: 'Instalar' })).toBeNull();
    unmount();
  });
});
