import type { Cadeira } from '@truco/engine';
import type { MsgEstado } from '@truco/protocolo';
import { passoDoTutorial } from '../logica/tutorial';

interface Props {
  msg: MsgEstado;
  nome: (c: Cadeira) => string;
  /** Pular a qualquer momento: o treinador some e a partida segue normal. */
  aoPular: () => void;
  /** Último passo: "Terminar tutorial" (a partida também segue). */
  aoTerminar: () => void;
}

/** O treinador do tutorial: explica o passo do momento, no lugar das dicas, com "Pular" sempre à mão. */
export function TreinadorTutorial({ msg, nome, aoPular, aoTerminar }: Props) {
  const passo = passoDoTutorial(msg, nome);
  return (
    <aside className="dica-mesa treinador-tutorial" aria-label="Tutorial" data-testid="tutorial" data-passo={passo?.id ?? 'nenhum'}>
      <p className="treinador-cabeca">Tutorial</p>
      <div aria-live="polite">
        {passo ? (
          <>
            <h2>{passo.titulo}</h2>
            <p>{passo.texto}</p>
          </>
        ) : (
          <p>Acompanhe a mesa: o próximo passo aparece aqui.</p>
        )}
      </div>
      <div className="dica-mesa-botoes">
        {passo?.id === 'fim' ? (
          <button type="button" onClick={aoTerminar}>
            Terminar tutorial
          </button>
        ) : (
          <button type="button" className="botao-discreto" onClick={aoPular}>
            Pular tutorial
          </button>
        )}
      </div>
    </aside>
  );
}
