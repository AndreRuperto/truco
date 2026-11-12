import type { CarteiraApi, CatalogoApi, ItemLoja, PacotePila, Slot, UsuarioApi, VisualRoupa, VisualTampo, VisualVerso } from '@truco/api';
import { useEffect, useState } from 'react';
import { Avatar } from '../componentes/Avatar';
import { Personagem } from '../componentes/Personagem';
import { salvarAparenciaMesa, type AparenciaMesa } from '../logica/aparenciaMesa';
import { estadoDoItem, estiloVerso, formatarReais, formatarSaldo, MOTIVO_LANCAMENTO, NOME_MOEDA, rotuloPreco } from '../logica/lojaItens';
import { ABAS_LOJA, type AbaLoja, hrefDe } from '../logica/rotas';
import type { Api } from '../rede/api';

const NOME_ABA: Record<AbaLoja, string> = {
  verso: 'Baralho',
  roupa: 'Roupa',
  moldura: 'Moldura',
  avatar: 'Avatar',
  tampo: 'Mesa',
  pila: 'Comprar Pila',
};

interface Props {
  aba: AbaLoja;
  api: Pick<Api, 'loja'>;
  usuario: UsuarioApi | null;
  catalogo: CatalogoApi | null;
  carteira: CarteiraApi | null;
  /** Depois de comprar/equipar: a App relê a carteira (e a sessão, se o avatar mudou). */
  aoMudar: () => Promise<void>;
  /** Abre o checkout (a App troca de página). */
  aoIrParaPagamento?: (url: string) => void;
}

export function TelaLoja({ aba, api, usuario, catalogo, carteira, aoMudar, aoIrParaPagamento = (u) => window.location.assign(u) }: Props) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [confirmar, setConfirmar] = useState<ItemLoja | null>(null);
  useEffect(() => setAviso(null), [aba]);

  const itens = catalogo?.itens ?? [];
  const executar = async (chave: string, fn: () => Promise<unknown>, ok: string) => {
    setOcupado(chave);
    setAviso(null);
    try {
      await fn();
      await aoMudar();
      setAviso({ tipo: 'ok', texto: ok });
    } catch (e) {
      setAviso({ tipo: 'erro', texto: e instanceof Error ? e.message : String(e) });
    } finally {
      setOcupado(null);
    }
  };
  const equiparItem = (item: ItemLoja) =>
    executar(
      item.id,
      async () => {
        await api.loja.equipar(item.slot, item.preco === null && item.slot !== 'tampo' ? null : item.id);
        // O tampo é desenhado só na sua tela: guarda também no aparelho.
        if (item.slot === 'tampo') salvarAparenciaMesa((item.visual as VisualTampo).superficie as AparenciaMesa);
      },
      `${item.nome} equipado.`,
    );
  const comprar = (item: ItemLoja) =>
    executar(
      item.id,
      async () => {
        await api.loja.comprarItem(item.id);
        await api.loja.equipar(item.slot, item.id);
        if (item.slot === 'tampo') salvarAparenciaMesa((item.visual as VisualTampo).superficie as AparenciaMesa);
      },
      `${item.nome} é seu e já está equipado.`,
    );
  const comprarPila = async (p: PacotePila) => {
    setOcupado(p.id);
    setAviso(null);
    try {
      const r = await api.loja.criarPedido(p.id);
      aoIrParaPagamento(r.url);
    } catch (e) {
      setAviso({ tipo: 'erro', texto: e instanceof Error ? e.message : String(e) });
      setOcupado(null);
    }
  };

  return (
    <main className="tela-conta tela-loja">
      <h1>Loja do boteco</h1>
      <p className="loja-intro">
        Itens só de visual: não mudam o jogo. <strong>Fichas</strong> se ganham jogando e valem nas mesas com cacife;{' '}
        <strong>Pila</strong> se compra e serve só aqui na loja. Uma não vira a outra, e nenhuma vira dinheiro.
      </p>
      {usuario && carteira ? (
        <dl className="loja-saldos" aria-label="Seus saldos">
          <div className="saldo saldo-fichas">
            <dt>Fichas</dt>
            <dd data-testid="saldo-fichas">{formatarSaldo(carteira.fichas)}</dd>
          </div>
          <div className="saldo saldo-pila">
            <dt>Pila</dt>
            <dd data-testid="saldo-pila">{formatarSaldo(carteira.pila)}</dd>
          </div>
        </dl>
      ) : (
        !usuario && (
          <p className="loja-entrar">
            Para comprar e equipar, <a href="#/entrar">entre na sua conta</a>.
          </p>
        )
      )}

      <nav className="loja-abas" aria-label="Seções da loja">
        {ABAS_LOJA.map((a) => (
          <a key={a} href={hrefDe({ tela: 'loja', aba: a })} aria-current={a === aba ? 'page' : undefined}>
            {NOME_ABA[a]}
          </a>
        ))}
      </nav>

      {aviso && (
        <p className={`loja-aviso loja-aviso-${aviso.tipo}`} role={aviso.tipo === 'erro' ? 'alert' : 'status'}>
          {aviso.texto}
        </p>
      )}

      {!catalogo ? (
        <p role="status">Carregando a loja…</p>
      ) : aba === 'pila' ? (
        <section aria-labelledby="titulo-pila">
          <h2 id="titulo-pila">Pacotes de Pila</h2>
          {!catalogo.pagamentoAtivo && (
            <p className="loja-em-breve" role="status">
              A compra de Pila abre em breve. Enquanto isso, os itens de Fichas já estão à venda.
            </p>
          )}
          <ul className="loja-grade">
            {catalogo.pacotes.map((p) => (
              <li key={p.id} className="loja-cartao loja-pacote">
                <span className="loja-pacote-pila" aria-hidden="true">
                  {formatarSaldo(p.pila)}
                </span>
                <h3>{p.nome}</h3>
                <p>{formatarSaldo(p.pila)} Pila</p>
                <button
                  type="button"
                  className="botao-principal"
                  disabled={!usuario || !catalogo.pagamentoAtivo || ocupado !== null}
                  onClick={() => void comprarPila(p)}
                  aria-label={`Comprar ${p.nome}: ${p.pila} Pila por ${formatarReais(p.centavos)}`}
                >
                  {ocupado === p.id ? 'Abrindo pagamento…' : formatarReais(p.centavos)}
                </button>
              </li>
            ))}
          </ul>
          <TermosLoja />
        </section>
      ) : (
        <section aria-labelledby="titulo-itens">
          <h2 id="titulo-itens">{NOME_ABA[aba]}</h2>
          <ul className="loja-grade">
            {itens
              .filter((i) => i.slot === aba)
              .map((item) => {
                const estado = usuario ? estadoDoItem(item, carteira, itens) : null;
                return (
                  <li key={item.id} className="loja-cartao" data-estado={estado ?? 'visitante'} data-testid={`item-${item.id}`}>
                    <Previa item={item} usuario={usuario} />
                    <h3>{item.nome}</h3>
                    <p className={`loja-preco${item.preco ? ` preco-${item.preco.moeda}` : ''}`}>{rotuloPreco(item)}</p>
                    {estado === 'equipado' ? (
                      <span className="loja-equipado">Em uso</span>
                    ) : estado === 'equipar' ? (
                      <button type="button" disabled={ocupado !== null} onClick={() => void equiparItem(item)}>
                        Equipar
                      </button>
                    ) : estado === 'comprar' ? (
                      <button type="button" className="botao-principal" disabled={ocupado !== null} onClick={() => setConfirmar(item)}>
                        Comprar
                      </button>
                    ) : estado === 'sem-saldo' ? (
                      <button type="button" disabled title={`Falta ${NOME_MOEDA[item.preco!.moeda]}`}>
                        {item.preco!.moeda === 'pila' ? 'Falta Pila' : 'Faltam Fichas'}
                      </button>
                    ) : null}
                  </li>
                );
              })}
          </ul>
        </section>
      )}

      {confirmar && carteira && (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="titulo-confirmar-compra">
          <div className="overlay-caixa loja-confirmar">
            <h2 id="titulo-confirmar-compra">Comprar {confirmar.nome}?</h2>
            <p>
              Custa <strong>{rotuloPreco(confirmar)}</strong>. Seu saldo fica em{' '}
              {formatarSaldo((confirmar.preco!.moeda === 'fichas' ? carteira.fichas : carteira.pila) - confirmar.preco!.valor)} {NOME_MOEDA[confirmar.preco!.moeda]}.
            </p>
            <div className="loja-confirmar-botoes">
              <button
                type="button"
                className="botao-principal"
                autoFocus
                onClick={() => {
                  const item = confirmar;
                  setConfirmar(null);
                  void comprar(item);
                }}
              >
                Comprar e equipar
              </button>
              <button type="button" className="botao-discreto" onClick={() => setConfirmar(null)}>
                Agora não
              </button>
            </div>
          </div>
        </div>
      )}

      {carteira && carteira.extrato.length > 0 && (
        <details className="loja-extrato">
          <summary>Extrato</summary>
          <ul>
            {carteira.extrato.map((l) => (
              <li key={l.id}>
                <span>{MOTIVO_LANCAMENTO[l.motivo] ?? l.motivo}</span>
                <span className={l.delta > 0 ? 'credito' : 'debito'}>
                  {l.delta > 0 ? '+' : '−'}
                  {formatarSaldo(Math.abs(l.delta))} {NOME_MOEDA[l.moeda]}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </main>
  );
}

function Previa({ item, usuario }: { item: ItemLoja; usuario: UsuarioApi | null }) {
  const slot: Slot = item.slot;
  if (slot === 'verso') {
    const v = estiloVerso(item.visual as VisualVerso)!;
    return (
      <span className="loja-previa previa-verso" data-verso={v.estampa} style={v.style} aria-hidden="true">
        <span className="carta verso" />
        <span className="carta verso" />
      </span>
    );
  }
  if (slot === 'roupa') {
    return (
      <span className="loja-previa previa-roupa" aria-hidden="true">
        <Personagem tipo={5} lado="cima" daVez={false} gritando={false} roupa={item.visual as VisualRoupa} />
      </span>
    );
  }
  if (slot === 'moldura') {
    return (
      <span className="loja-previa previa-moldura" aria-hidden="true">
        <Avatar apelido={usuario?.apelido ?? 'Você'} avatar={usuario?.avatar} tamanho={56} moldura={(item.visual as { estilo: string }).estilo} />
      </span>
    );
  }
  if (slot === 'avatar') {
    return (
      <span className="loja-previa previa-avatar" aria-hidden="true">
        <Avatar apelido={item.nome} avatar={`loja:${item.id}`} tamanho={64} />
      </span>
    );
  }
  const sup = (item.visual as VisualTampo).superficie;
  return (
    <span className="loja-previa previa-tampo" aria-hidden="true">
      <span className={`amostra-mesa amostra-${sup}`}>
        <span />
      </span>
    </span>
  );
}

/** Rascunho dos termos da loja: precisa de revisão do advogado antes de ligar a cobrança. */
export function TermosLoja() {
  return (
    <details className="loja-termos">
      <summary>Como funciona a compra (termos da loja)</summary>
      <ul>
        <li>Pila é uma moeda do jogo, sem valor fora dele: não pode ser sacado, trocado por dinheiro nem passado a outro jogador.</li>
        <li>Pila não vira Fichas, e Fichas não viram Pila. Pila não entra em mesa nem em aposta.</li>
        <li>Os itens são só de visual e não dão vantagem na partida.</li>
        <li>O pagamento é feito na página da InfinitePay (Pix ou cartão). O Pila entra na conta assim que o pagamento é confirmado.</li>
        <li>Arrependimento: em até 7 dias da compra, o Pila que ainda não foi usado pode ser devolvido com reembolso (Código de Defesa do Consumidor, art. 49). Fale com a gente pelo e-mail do site.</li>
        <li>Conta suspensa por violar as regras perde o acesso aos saldos.</li>
      </ul>
    </details>
  );
}

/** Voltou do checkout: confere o pedido algumas vezes até o pagamento ser confirmado. */
export function TelaLojaObrigado({ pedido, api, aoPago }: { pedido: string | null; api: Pick<Api, 'loja'>; aoPago: () => void }) {
  const [estado, setEstado] = useState<'conferindo' | 'pago' | 'pendente' | 'erro'>(pedido ? 'conferindo' : 'erro');
  const [pila, setPila] = useState<number | null>(null);
  useEffect(() => {
    if (!pedido) return;
    let vivo = true;
    let tentativas = 0;
    const conferir = async () => {
      tentativas++;
      try {
        const r = await api.loja.pedido(pedido);
        if (!vivo) return;
        if (r.pedido.status === 'pago') {
          setPila(r.pedido.pila);
          setEstado('pago');
          aoPago();
          return;
        }
      } catch {
        if (!vivo) return;
      }
      if (tentativas >= 15) setEstado('pendente');
      else timer = window.setTimeout(conferir, 2000);
    };
    let timer = window.setTimeout(conferir, 0);
    return () => {
      vivo = false;
      window.clearTimeout(timer);
    };
  }, [pedido]);
  return (
    <main className="tela-conta tela-loja">
      <h1>Compra de Pila</h1>
      {estado === 'conferindo' && <p role="status">Conferindo o pagamento com a InfinitePay…</p>}
      {estado === 'pago' && (
        <p role="status" className="loja-aviso loja-aviso-ok">
          Pagamento confirmado: {pila !== null ? `${formatarSaldo(pila)} Pila` : 'o Pila'} já está na sua conta.
        </p>
      )}
      {estado === 'pendente' && (
        <p role="status">
          Ainda não recebemos a confirmação. Pix e cartão às vezes demoram alguns minutos: o Pila entra sozinho quando a InfinitePay confirmar.
        </p>
      )}
      {estado === 'erro' && <p role="alert">Não encontramos esse pedido.</p>}
      <p>
        <a href={hrefDe({ tela: 'loja', aba: 'verso' })}>Voltar para a loja</a>
      </p>
    </main>
  );
}
