import type { Anuncio } from '../logica/eventos';

interface Props {
  anuncio: Anuncio | null;
  /** Nome de quem pediu ("Você" quando fui eu). */
  quem: string;
}

/**
 * A palavra do pedido grande, riscada a giz no meio da mesa (TRUCO!, SEIS!..., FAMÍLIA FECHADA!).
 * Não pega cliques e fica fora do leitor de tela: o pedido já é lido pela região da mesa
 * ("Pediram Truco! Vale 3.") e a família pela linha da etapa; aqui seria a mesma leitura duas vezes.
 * A `key` com o id do evento reinicia a animação a cada pedido novo (truco e logo depois seis).
 */
export function AnuncioGrande({ anuncio, quem }: Props) {
  if (!anuncio) return null;
  return (
    <div key={anuncio.id} className="anuncio-grande" data-tipo={anuncio.tipo} data-testid="anuncio-grande" aria-hidden="true">
      <span className="anuncio-grande-quem">{quem}</span>
      <strong className="anuncio-grande-palavra">{anuncio.texto}</strong>
    </div>
  );
}
