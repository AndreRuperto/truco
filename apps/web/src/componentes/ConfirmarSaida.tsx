interface Props {
  ranqueada: boolean;
  aoSair: () => void;
  aoCancelar: () => void;
  /** Texto do botão que desiste de sair. */
  textoFicar?: string;
}

/** Confirmação de saída da mesa; na ranqueada avisa que conta como abandono. */
export function ConfirmarSaida({ ranqueada, aoSair, aoCancelar, textoFicar = 'Continuar jogando' }: Props) {
  return (
    <div className="confirmar-saida" role="alertdialog" aria-label="Sair da mesa">
      <p>{ranqueada ? 'Sair agora conta como derrota e bloqueia a fila ranqueada por 5 minutos.' : 'Um bot assume o seu lugar até o fim da partida.'}</p>
      <button type="button" className="botao-principal" onClick={aoSair}>
        Sair da mesa
      </button>
      <button type="button" onClick={aoCancelar}>
        {textoFicar}
      </button>
    </div>
  );
}
