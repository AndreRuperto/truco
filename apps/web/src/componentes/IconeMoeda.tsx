/**
 * Ícones das duas moedas da loja (CSS em loja.css: `.icone-moeda`).
 * Fichas = ficha de mesa (redonda, com as marcas na borda). Pila = cédula dobrada em maço.
 * Formas diferentes de propósito: dá para distinguir sem depender da cor.
 * Decorativo: quem usa põe o nome da moeda no rótulo (aria-label ou texto ao lado).
 */
export function IconeMoeda({ moeda }: { moeda: 'fichas' | 'pila' }) {
  return (
    <svg className={`icone-moeda moeda-${moeda}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {moeda === 'fichas' ? (
        <>
          <circle className="corpo" cx="12" cy="12" r="11" />
          {/* oito marcas na borda, como nas fichas de cassino */}
          <circle className="marcas" cx="12" cy="12" r="9" />
          <circle className="traco" cx="12" cy="12" r="5.6" />
          <circle className="miolo" cx="12" cy="12" r="2.2" />
        </>
      ) : (
        <>
          <rect className="verso" x="3.5" y="3" width="19" height="12.5" rx="2" transform="rotate(-8 13 9)" />
          <rect className="corpo" x="1.5" y="7.5" width="21" height="13" rx="2" />
          <rect className="traco" x="3.6" y="9.6" width="16.8" height="8.8" rx="1" />
          <circle className="miolo" cx="12" cy="14" r="2.6" />
        </>
      )}
    </svg>
  );
}
