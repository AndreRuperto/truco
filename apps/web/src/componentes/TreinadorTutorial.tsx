import type { Cadeira } from '@truco/engine';
import type { MsgEstado } from '@truco/protocolo';
import { useEffect, useRef, useState } from 'react';
import { type IdPasso, type PassoTutorial, passoDoTutorial, TOPICOS, type Topico } from '../logica/tutorial';

interface Props {
  msg: MsgEstado;
  nome: (c: Cadeira) => string;
  /** Pular a qualquer momento: o treinador some e a partida segue normal. */
  aoPular: () => void;
  /** "Terminar tutorial" (com tudo visto ou no fim da partida); a partida também segue. */
  aoTerminar: () => void;
}

/**
 * O treinador do tutorial, no lugar das dicas. Cada situação nova abre o painel uma vez; decisões
 * (responder truco, mão de 11, conferir) abrem sempre. No resto do tempo ele fica recolhido numa
 * etiqueta com o progresso, que abre de novo com um toque. "Pular tutorial" está sempre à mão.
 */
export function TreinadorTutorial({ msg, nome, aoPular, aoTerminar }: Props) {
  const bruto = passoDoTutorial(msg, nome);
  const vistos = useRef(new Map<IdPasso, PassoTutorial>());
  const [mostrado, setMostrado] = useState<IdPasso | null>(null);
  const [recolhido, setRecolhido] = useState(false);
  const [topicos, setTopicos] = useState<ReadonlySet<Topico>>(new Set());

  // Passo novo (ou que repete): abre o painel com ele; passo já visto fica recolhido.
  useEffect(() => {
    if (!bruto) return;
    if (!vistos.current.has(bruto.id) || bruto.repete) {
      vistos.current.set(bruto.id, bruto);
      setMostrado(bruto.id);
      setRecolhido(false);
      if (bruto.topico && !topicos.has(bruto.topico)) setTopicos((t) => new Set([...t, bruto.topico!]));
    }
    // só reage à troca de passo
  }, [bruto?.id]);

  const passo = bruto && bruto.id === mostrado ? bruto : null;
  const aberto = passo !== null && !recolhido;
  const tudoVisto = topicos.size === TOPICOS.length;
  const podeTerminar = tudoVisto || bruto?.id === 'fim';
  const progresso = `${topicos.size} de ${TOPICOS.length}`;

  if (!aberto) {
    return (
      <aside className="treinador-tutorial-recolhido" aria-label="Tutorial" data-testid="tutorial" data-passo="recolhido">
        <button
          type="button"
          className="treinador-etiqueta"
          aria-expanded="false"
          onClick={() => {
            if (bruto) {
              vistos.current.set(bruto.id, bruto);
              setMostrado(bruto.id);
            }
            setRecolhido(false);
          }}
          disabled={!bruto}
        >
          Tutorial · {progresso}
        </button>
        <button type="button" className="botao-discreto" onClick={aoPular}>
          Pular
        </button>
      </aside>
    );
  }

  return (
    <aside className="dica-mesa treinador-tutorial" aria-label="Tutorial" data-testid="tutorial" data-passo={passo.id}>
      <p className="treinador-cabeca">
        Tutorial <span className="treinador-progresso">· já viu {progresso}</span>
      </p>
      <div aria-live="polite">
        <h2>{passo.titulo}</h2>
        <p>{passo.texto}</p>
      </div>
      {passo.id === 'fim' && !tudoVisto && (
        <p className="treinador-faltou">
          Não apareceu nesta partida:{' '}
          {TOPICOS.filter((t) => !topicos.has(t.id))
            .map((t) => t.nome.toLowerCase())
            .join(', ')}
          . Está tudo no Manual.
        </p>
      )}
      <div className="dica-mesa-botoes">
        {podeTerminar ? (
          <button type="button" onClick={aoTerminar}>
            Terminar tutorial
          </button>
        ) : (
          <button type="button" onClick={() => setRecolhido(true)} aria-expanded="true">
            Recolher
          </button>
        )}
        <button type="button" className="botao-discreto" onClick={aoPular}>
          Pular tutorial
        </button>
      </div>
    </aside>
  );
}
