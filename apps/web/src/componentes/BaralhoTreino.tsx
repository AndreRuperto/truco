import { type CSSProperties, useCallback, useEffect, useState } from 'react';

/**
 * Passatempo inteiramente local da sala privada.
 * Não usa nem embaralha o monte real da partida, não envia ações ao servidor.
 */
export type TruqueBaralho = 'cascata' | 'corte' | 'leque' | 'mola';

const NOMES: Record<TruqueBaralho, string> = {
  cascata: 'Cascata com ponte',
  corte: 'Corte triplo',
  leque: 'Leque de cartas',
  mola: 'Mola de cartas',
};

const DURACAO_MS: Record<TruqueBaralho, number> = {
  cascata: 1800,
  corte: 1600,
  leque: 1900,
  mola: 1800,
};

const MOVIMENTOS: readonly TruqueBaralho[] = ['cascata', 'corte', 'leque', 'mola'];
const QUANTIDADE_CARTAS = 24;
const CARTAS = Array.from({ length: QUANTIDADE_CARTAS }, (_, i) => i);

export interface TreinoBaralho {
  animacao: { truque: TruqueBaralho; sequencia: number } | null;
  total: number;
  ultimoTruque: TruqueBaralho | null;
  iniciar: (truque: TruqueBaralho) => void;
}

/** Reinicia a animação até quando o mesmo botão é pressionado rapidamente. */
export function useBaralhoTreino(): TreinoBaralho {
  const [animacao, setAnimacao] = useState<TreinoBaralho['animacao']>(null);
  const [total, setTotal] = useState(0);
  const [ultimoTruque, setUltimoTruque] = useState<TruqueBaralho | null>(null);

  const iniciar = useCallback((truque: TruqueBaralho) => {
    setAnimacao((anterior) => ({ truque, sequencia: (anterior?.sequencia ?? 0) + 1 }));
    setTotal((n) => n + 1);
    setUltimoTruque(truque);
  }, []);

  useEffect(() => {
    if (!animacao) return;
    const { sequencia, truque } = animacao;
    const timer = window.setTimeout(() => {
      setAnimacao((atual) => (atual?.sequencia === sequencia ? null : atual));
    }, DURACAO_MS[truque]);
    return () => window.clearTimeout(timer);
  }, [animacao]);

  return { animacao, total, ultimoTruque, iniciar };
}

function estiloCarta(i: number): CSSProperties {
  const metade = QUANTIDADE_CARTAS / 2;
  const corte = Math.floor(i / (QUANTIDADE_CARTAS / 3));
  const arco = Math.sin((i / (QUANTIDADE_CARTAS - 1)) * Math.PI);
  return {
    '--indice': i,
    '--base-x': `${(i % 4) * 0.35}px`,
    '--base-y': `${(i % 6) * -0.45}px`,
    '--lado-x': i < metade ? '-46px' : '46px',
    '--lado-giro': i < metade ? '-15deg' : '15deg',
    '--entrela-y': `${-7 - (i % metade) * 1.3}px`,
    '--arco-y': `${-17 - arco * 16}px`,
    '--corte-x': ['-45px', '0px', '45px'][corte],
    '--corte-destino': ['35px', '-45px', '10px'][corte],
    '--corte-giro': ['-18deg', '5deg', '16deg'][corte],
    '--leque-x': `${(i - (QUANTIDADE_CARTAS - 1) / 2) * 5.2}px`,
    '--leque-y': `${-arco * 27}px`,
    '--leque-giro': `${(i - (QUANTIDADE_CARTAS - 1) / 2) * 4.5}deg`,
    '--mola-x': `${-52 + (i / (QUANTIDADE_CARTAS - 1)) * 104}px`,
    '--mola-y': `${-24 - Math.sin((i / (QUANTIDADE_CARTAS - 1)) * Math.PI) * 36}px`,
  } as CSSProperties;
}

/** O botão é o próprio baralho sobre a mesa redonda. */
export function MonteBaralhoTreino({ treino }: { treino: TreinoBaralho }) {
  return (
    <button
      type="button"
      className="baralho-treino-monte"
      title="Toque para embaralhar em cascata"
      aria-label="Embaralhar o baralho em cascata"
      onClick={() => treino.iniciar('cascata')}
      data-testid="baralho-treino"
      data-movimento={treino.animacao?.truque ?? 'parado'}
    >
      <span
        className={`baralho-treino-pilha${treino.animacao ? ` movimento-${treino.animacao.truque}` : ''}`}
        key={treino.animacao?.sequencia ?? 'parado'}
        aria-hidden="true"
      >
        {CARTAS.map((i) => (
          <span className="baralho-treino-carta" key={i} style={estiloCarta(i)} />
        ))}
      </span>
    </button>
  );
}

/** Os comandos ficam abaixo da mesa, sem ocupar o espaço das cadeiras. */
export function ComandosBaralhoTreino({ treino }: { treino: TreinoBaralho }) {
  return (
    <section className="sala-truques" aria-labelledby="titulo-truques">
      <div className="sala-truques-topo">
        <h2 id="titulo-truques">Brinque com o baralho</h2>
        <span>Só de treino</span>
      </div>
      <p>Enquanto a turma não chega, faça uns floreios. Isso não mexe nas cartas da partida.</p>
      <div className="sala-truques-botoes" role="group" aria-label="Truques de embaralhamento">
        {MOVIMENTOS.map((truque) => (
          <button
            key={truque}
            type="button"
            onClick={() => treino.iniciar(truque)}
            data-testid={`truque-${truque}`}
          >
            {NOMES[truque]}
          </button>
        ))}
      </div>
      <p className="sala-truques-retorno" role="status" aria-live="polite">
        {treino.ultimoTruque
          ? `${NOMES[treino.ultimoTruque]} · ${treino.total} ${treino.total === 1 ? 'movimento' : 'movimentos'}`
          : 'Toque no baralho ou escolha um truque acima.'}
      </p>
    </section>
  );
}
