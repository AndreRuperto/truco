import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { VitrineMesas } from '../src/componentes/VitrineMesas';
import { opcoesDeVitrine, PREFERENCIAS_PADRAO } from '../src/logica/lobby';
import { TelaSalas } from '../src/telas/Salas';

describe('Vitrine de mesas', () => {
  test('exibe os três tipos e cria mesa pública ou privada conforme o seletor', async () => {
    const user = userEvent.setup();
    const aoCriar = vi.fn();
    const aoRanqueada = vi.fn();
    render(<VitrineMesas aoCriar={aoCriar} aoRanqueada={aoRanqueada} />);

    expect(screen.getByRole('heading', { name: 'Abra uma mesa' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Mesa Clássica' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Mesa Desafio' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Mesa Ranqueada' })).toBeInTheDocument();
    expect(screen.getByText('ELO')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(3);

    expect(screen.getByRole('radio', { name: 'Aberta ao clube' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Abrir Mesa Clássica' }));
    expect(aoCriar).toHaveBeenLastCalledWith('classica', 'publica');

    await user.click(screen.getByRole('radio', { name: /Privada · por convite/ }));
    expect(screen.getByRole('radio', { name: /Privada/ })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Abrir Mesa Desafio' }));
    expect(aoCriar).toHaveBeenLastCalledWith('desafio', 'privada');

    await user.click(screen.getByRole('button', { name: 'Ir para fila ranqueada' }));
    expect(aoRanqueada).toHaveBeenCalledOnce();
    expect(aoCriar).toHaveBeenCalledTimes(2);
  });

  test('configuração dos cards respeita regras salvas, mas força quatro lugares e bots anunciados', () => {
    const preferencias = {
      ...PREFERENCIAS_PADRAO,
      variante: 'mineiro' as const,
      pontuacao: '2-4-8-10-12' as const,
      familia: 'aberta' as const,
      humanos: 1,
      nivelBot: 'dificil' as const,
    };
    const classica = opcoesDeVitrine('classica', 'publica', ' Bia ', preferencias);
    expect(classica).toMatchObject({
      nome: 'Bia',
      modo: 'classica',
      humanos: 4,
      nivelBot: 'facil',
      variante: 'mineiro',
      regras: { pontuacao: '2-4-8-10-12', familia: 'aberta' },
    });
    expect(classica.chaveRegras).toContain('fam:aberta');

    const privada = opcoesDeVitrine('desafio', 'privada', 'Bia', preferencias);
    expect(privada).toMatchObject({
      modo: 'privada',
      humanos: 4,
      nivelBot: 'dificil',
      regras: { familia: 'aberta' },
    });
    expect(privada.chaveRegras).toBe(classica.chaveRegras);
  });

  test('a página de salas exibe os cards antes da lista sem perder a busca das mesas abertas', async () => {
    const aoCriarMesa = vi.fn();
    const aoRanqueada = vi.fn();
    const api = { salas: vi.fn(async () => ({ salas: [] })) };
    render(
      <TelaSalas
        api={api}
        aoEntrar={vi.fn()}
        aoCriarMesa={aoCriarMesa}
        aoRanqueada={aoRanqueada}
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Abra uma mesa' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Mesas abertas' })).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Ninguém sentou ainda' })).toBeInTheDocument();
    expect(api.salas).toHaveBeenCalledTimes(1);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Abrir Mesa Clássica' }));
    expect(aoCriarMesa).toHaveBeenCalledWith('classica', 'publica');
  });
});
