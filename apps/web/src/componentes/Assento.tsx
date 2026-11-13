import { type Carta, idCarta, type Variante } from '@truco/engine';
import { useEffect, useRef, useState } from 'react';
import type { EfeitoProvocacao, InfoCadeira, MsgEstado } from '@truco/protocolo';
import type { Posicao } from '../logica/posicoes';
import { Avatar } from './Avatar';
import { CartaVisual } from './CartaVisual';
import { Cronometro } from './Cronometro';
import { cx } from './cx';
import { Provocacao } from './Provocacao';

/** Pedidos de aposta: o balão entra como grito de giz amarelo. */
export const GRITOS = new Set(['TRUCO!', 'SEIS!', 'NOVE!', 'DOZE!']);

interface Props {
  posicao: Posicao;
  info: InfoCadeira | undefined;
  qtdCartas: number;
  daVez: boolean;
  balao: string | null;
  /** Cartas visíveis (mão do parceiro na mão de 10). */
  maoVisivel: Carta[] | null;
  variante: Variante;
  vira: Carta | null;
  /** Prazo desta cadeira (só quando ela está em `prazo.cadeiras`): mostra um cronômetro pequeno. */
  prazo?: NonNullable<MsgEstado['prazo']> | null;
  agora?: number;
  /** Provocação que este assento está levando agora (o efeito some sozinho). */
  provocacao?: { id: number; efeito: EfeitoProvocacao } | null;
  /** Com ele, tocar no nome abre o botão "Provocar" (outros jogadores, mesa com a regra ligada). */
  aoProvocar?: () => void;
  /** Ainda dentro dos 8 s da última provocação: o botão fica desligado. */
  recarregando?: boolean;
}

export function Assento({ posicao, info, qtdCartas, daVez, balao, maoVisivel, variante, vira, prazo = null, agora = 0, provocacao = null, aoProvocar, recarregando = false }: Props) {
  const [menu, setMenu] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  // Fecha o "Provocar" com Esc ou toque fora.
  useEffect(() => {
    if (!menu) return;
    const fora = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('pointerdown', fora);
    return () => document.removeEventListener('pointerdown', fora);
  }, [menu]);
  const conteudoNome = (
    <>
      {info?.avatar && <Avatar apelido={info.nome ?? '?'} avatar={info.avatar} tamanho={22} moldura={info.visual?.moldura} />}
      <span>{info?.nome ?? '—'}</span>
      {info && !info.conectado && <span className="etiqueta off">caiu</span>}
      {daVez && <span className="etiqueta vez">{posicao === 'baixo' ? 'sua vez' : 'vez'}</span>}
    </>
  );
  return (
    <div
      ref={raiz}
      className={cx('assento', `pos-${posicao}`, daVez && 'da-vez', info && !info.conectado && 'caiu')}
      data-testid={`assento-${posicao}`}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && menu) setMenu(false);
      }}
    >
      {/* Sem etiqueta "bot": o server reserva o prefixo "Bot " aos nomes dos bots. O efeito da
          provocação fica preso à etiqueta do nome (não ao assento, que no de cima é a mesa toda). */}
      <span className="assento-alvo">
      {aoProvocar ? (
        <button
          type="button"
          className="assento-nome assento-nome-botao"
          aria-expanded={menu}
          aria-label={`${info?.nome ?? 'Jogador'}: provocar`}
          onClick={() => setMenu((m) => !m)}
        >
          {conteudoNome}
        </button>
      ) : (
        <div className="assento-nome">{conteudoNome}</div>
      )}
      {menu && aoProvocar && (
        <button
          type="button"
          className="assento-provocar"
          disabled={recarregando}
          onClick={() => {
            aoProvocar();
            setMenu(false);
          }}
        >
          {recarregando ? 'Provocar (recarregando)' : 'Provocar'}
        </button>
      )}
      {provocacao && <Provocacao key={provocacao.id} efeito={provocacao.efeito} />}
      </span>
      {prazo && <Cronometro prazo={prazo} agora={agora} rotulo={`Vez de ${info?.nome ?? 'jogador'}`} pequeno />}
      {maoVisivel ? (
        <div className="assento-cartas visivel">
          {maoVisivel.map((c) => (
            <CartaVisual key={idCarta(c)} carta={c} variante={variante} vira={vira} tamanho="pequena" />
          ))}
        </div>
      ) : qtdCartas > 0 ? (
        <div className="assento-cartas" title={`${qtdCartas} cartas`}>
          {Array.from({ length: qtdCartas }, (_, i) => (
            <CartaVisual key={i} carta={null} variante={variante} vira={vira} tamanho="pequena" />
          ))}
        </div>
      ) : null}
      {/* Sem região viva (F6.1): o pedido de truco já é anunciado na região única da mesa
          (anuncio-mesa); o balão falando junto fazia o leitor de tela repetir. */}
      {balao && (
        <div className={cx('balao', GRITOS.has(balao) && 'grito')}>
          {balao}
        </div>
      )}
    </div>
  );
}
