import { type AparenciaMesa, TAMPOS_DA_LOJA } from '../logica/aparenciaMesa';

interface Props {
  valor: AparenciaMesa;
  temConta: boolean;
  /** Itens da conta: os tampos da loja só aparecem para quem tem. */
  inventario?: readonly string[];
  aoEscolher: (valor: AparenciaMesa) => void;
  aoFechar: () => void;
}

const OPCOES = [
  {
    id: 'madeira',
    titulo: 'Madeira de boteco',
    descricao: 'A clássica do Truco, para todo mundo.',
    selo: 'GRÁTIS',
  },
  {
    id: 'feltro',
    titulo: 'Feltro de clube',
    descricao: 'Mesa oval, aro de madeira e acabamento premium.',
    selo: 'PREMIUM · PRÉVIA',
  },
  {
    id: 'plastico',
    titulo: 'Plástico de bar',
    descricao: 'A amarela da resenha, com estampa da casa.',
    selo: 'GRÁTIS',
  },
  {
    id: 'marmore',
    titulo: 'Mármore de bar',
    descricao: 'Pedra fria de balcão antigo, com veios cinzentos.',
    selo: 'DA LOJA',
  },
  {
    id: 'formica',
    titulo: 'Fórmica anos 70',
    descricao: 'Verde-água de cozinha de vó, com borda de alumínio.',
    selo: 'DA LOJA',
  },
] as const;

export function SeletorAparenciaMesa({ valor, temConta, inventario = [], aoEscolher, aoFechar }: Props) {
  return (
    <aside className="personalizar-mesa" id="personalizar-mesa" aria-labelledby="titulo-aparencia">
      <header className="personalizar-mesa-cabecalho">
        <div>
          <h2 id="titulo-aparencia">Aparência da mesa</h2>
        </div>
        <button type="button" className="personalizar-mesa-fechar" onClick={aoFechar} aria-label="Fechar personalização">×</button>
      </header>
      <p className="personalizar-mesa-explica">
        A escolha é só sua: não muda a partida nem a mesa que os outros enxergam.
      </p>
      <div className="personalizar-mesa-hero" aria-hidden="true">
        <div className={`personalizar-mesa-preview amostra-${valor}`}><span className="preview-aro"><span className="preview-cartas">♠ ♣ ♦</span></span></div>
      </div>
      <div className="personalizar-mesa-opcoes" role="group" aria-label="Escolher aparência da mesa">
        {OPCOES.filter((o) => {
          const item = TAMPOS_DA_LOJA[o.id];
          return !item || (temConta && inventario.includes(item));
        }).map((o) => {
          const bloqueada = o.id === 'feltro' && !temConta;
          return (
            <button
              type="button"
              key={o.id}
              className={`personalizar-mesa-opcao opcao-${o.id}`}
              data-testid={`aparencia-${o.id}`}
              aria-pressed={valor === o.id}
              disabled={bloqueada}
              onClick={() => aoEscolher(o.id)}
            >
              <span className={`amostra-mesa amostra-${o.id}`} aria-hidden="true"><span /></span>
              <span className="personalizar-mesa-descricao">
                <strong>{o.titulo}{valor === o.id && <span className="personalizar-selecionada" aria-hidden="true"> ✓</span>}</strong>
                <small>{o.descricao}</small>
                <em>{bloqueada ? 'ENTRE NA CONTA PARA EXPERIMENTAR' : o.selo}</em>
              </span>
            </button>
          );
        })}
      </div>
      <p className="personalizar-mesa-rodape">
        {temConta
          ? 'O feltro Premium está em prévia gratuita para contas. Ainda não há assinatura ou cobrança.'
          : 'Visitantes usam madeira por padrão. Entre na sua conta para experimentar o feltro Premium.'}
        {' '}Outros tampos ficam na <a href="#/loja/tampo">loja</a>.
        {' '}Quando uma mesa quebra durante a partida, o plástico aparece automaticamente.
      </p>
    </aside>
  );
}
