import { type CSSProperties, useLayoutEffect, useRef, useState } from 'react';
import { formatarSaldo } from '../logica/lojaItens';
import type { AvisoBonusDados } from '../logica/lojaApp';
import { IconeMoeda } from './IconeMoeda';

/**
 * Aviso dos bônus de Fichas, pendurado no saldo do cabeçalho (CSS em loja.css: `.aviso-bonus`).
 * Bônus do dia e resgate: cartão de lousa. Boas-vindas (só uma vez): vale de papel.
 * Os dois somem sozinhos quando a barra de tempo acaba (a barra para com o mouse em cima ou o foco dentro)
 * e têm o X para fechar antes. Nada pede ação: as Fichas já estão no saldo.
 */
export function AvisoBonus({ aviso, aoFechar }: { aviso: AvisoBonusDados; aoFechar: () => void }) {
  const raiz = useRef<HTMLDivElement>(null);
  const [posicao, setPosicao] = useState<CSSProperties>({});

  // Encosta o aviso embaixo do saldo e aponta a pontinha para ele (sem saldo na tela, fica à direita, sem ponta).
  useLayoutEffect(() => {
    const medir = () => {
      const caixa = raiz.current;
      const topo = caixa?.parentElement;
      const saldo = topo?.querySelector('.cabecalho-saldo');
      if (!caixa || !topo || !saldo) return setPosicao({});
      const t = topo.getBoundingClientRect();
      const s = saldo.getBoundingClientRect();
      if (t.width === 0) return setPosicao({});
      const largura = caixa.offsetWidth;
      const direita = Math.max(12, Math.min(t.right - s.right - 12, t.width - largura - 12));
      const esquerdaDaCaixa = t.right - direita - largura;
      const ponta = Math.max(24, Math.min(s.left + s.width / 2 - esquerdaDaCaixa, largura - 24));
      setPosicao({ right: direita, '--ponta-x': `${ponta}px` } as CSSProperties);
    };
    medir();
    addEventListener('resize', medir);
    // O saldo muda de largura quando a fonte carrega ou o valor chega: mede de novo.
    const obs = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(medir);
    const topo = raiz.current?.parentElement;
    if (obs && topo) {
      obs.observe(topo);
      const saldo = topo.querySelector('.cabecalho-saldo');
      if (saldo) obs.observe(saldo);
    }
    return () => {
      removeEventListener('resize', medir);
      obs?.disconnect();
    };
  }, []);

  const vale = aviso.tipo === 'boas-vindas';
  const titulo = vale ? 'Bem-vindo ao boteco' : aviso.tipo === 'resgate' ? 'Resgate do dia' : 'Bônus do dia';
  const valor = aviso.tipo === 'resgate' ? `${formatarSaldo(aviso.fichas)} Fichas` : `+${formatarSaldo(aviso.fichas)} Fichas`;
  const detalhe = vale ? 'para jogar valendo' : aviso.tipo === 'resgate' ? 'Suas Fichas voltaram para esse valor.' : 'Já estão no seu saldo.';

  return (
    <div
      ref={raiz}
      className={`aviso-bonus ${vale ? 'aviso-vale' : 'aviso-cartao'}`}
      role="status"
      style={posicao}
      data-testid="aviso-bonus"
    >
      <span className="aviso-bonus-ficha" aria-hidden="true">
        <IconeMoeda moeda="fichas" />
      </span>
      <span className="aviso-bonus-textos">
        <span className="aviso-bonus-titulo">{titulo}</span>
        <span className="aviso-bonus-valor">{valor}</span>
        <span className="aviso-bonus-detalhe">{detalhe}</span>
      </span>
      <button type="button" className="aviso-bonus-fechar" aria-label="Fechar aviso" onClick={aoFechar}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
      <span className="aviso-bonus-tempo" data-testid="aviso-bonus-tempo" aria-hidden="true" onAnimationEnd={aoFechar} />
    </div>
  );
}
