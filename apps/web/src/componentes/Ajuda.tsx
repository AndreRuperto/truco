interface Props {
  /** O nome da regra, como aparece no rótulo ("Variante"). */
  tema: string;
  aberta: boolean;
  /** id do parágrafo com a explicação. */
  controla: string;
  aoAlternar: () => void;
}

/**
 * O "?" ao lado de uma regra: abre e fecha a explicação logo abaixo dela. O nome acessível vem do
 * texto escondido ("O que é Variante?"), não de aria-label, para não competir com o rótulo do campo
 * na busca por rótulo (leitores de tela e testes encontram o campo pelo nome dele).
 */
export function BotaoAjuda({ tema, aberta, controla, aoAlternar }: Props) {
  return (
    <button type="button" className="botao-ajuda-regra" aria-expanded={aberta} aria-controls={controla} onClick={aoAlternar}>
      <span aria-hidden="true">?</span>
      <span className="so-leitor">O que é {tema}?</span>
    </button>
  );
}
