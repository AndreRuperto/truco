import type { Cadeira } from '@truco/engine';
import type { MsgBatida } from '@truco/protocolo';
import { useEffect, useRef, useState } from 'react';
import { posicaoRelativa } from '../logica/posicoes';
import { movimentoReduzido } from './animacaoMesa';
import type { Cena3D, Estado3D } from './mesa3d/tipos';

interface Props {
  estado: Estado3D;
  minha: Cadeira;
  batida?: (MsgBatida & { id: number }) | null;
  /** WebGL indisponível ou a cena quebrou: a tela volta para a mesa 2D. */
  aoFalhar: (motivo: string) => void;
}

/**
 * A mesa em 3D (three.js, carregado só quando a vista 3D é ligada). Só desenha: botões, mão e
 * placar continuam na tela 2D por cima. Decorativa para o leitor de tela (a tela repete o essencial).
 */
export function Mesa3D({ estado, minha, batida = null, aoFalhar }: Props) {
  const caixa = useRef<HTMLDivElement>(null);
  const cena = useRef<Cena3D | null>(null);
  const [pronta, setPronta] = useState(false);
  const ultimo = useRef(estado);
  ultimo.current = estado;

  useEffect(() => {
    let vivo = true;
    import('./mesa3d/cena')
      .then(({ criarCena3D }) => {
        if (!vivo || !caixa.current) return;
        const c = criarCena3D(caixa.current, { reduzido: movimentoReduzido() });
        cena.current = c;
        c.atualizar(ultimo.current);
        setPronta(true);
      })
      .catch((e: unknown) => {
        if (vivo) aoFalhar(e instanceof Error ? e.message : String(e));
      });
    return () => {
      vivo = false;
      cena.current?.destruir();
      cena.current = null;
    };
    // a cena nasce uma vez; as mudanças chegam por `atualizar`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      cena.current?.atualizar(estado);
    } catch (e) {
      aoFalhar(e instanceof Error ? e.message : String(e));
    }
  }, [estado, aoFalhar]);

  const idBatida = batida?.id;
  useEffect(() => {
    if (batida) cena.current?.bater(posicaoRelativa(minha, batida.de), batida.forca);
    // só uma batida nova (o id muda a cada uma)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idBatida]);

  return (
    <div ref={caixa} className="mesa-3d-cena" aria-hidden="true" data-pronta={pronta || undefined}>
      {!pronta && <span className="mesa-3d-carregando">Arrumando o boteco…</span>}
    </div>
  );
}
