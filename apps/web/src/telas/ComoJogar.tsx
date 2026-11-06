import { Manual } from '../componentes/Manual';
import { lerPreferenciasLocais, PREFERENCIAS_PADRAO } from '../logica/lobby';

/** #/como-jogar: o manual inteiro numa página. */
export function TelaComoJogar() {
  return (
    <main className="tela-manual">
      <h1>Como jogar truco</h1>
      <p className="manual-intro">
        Tudo o que você precisa para sentar na mesa: o paulista e o mineiro, do básico às regras da casa. Dá para abrir este
        manual também durante a partida, no botão <strong>?</strong> embaixo da mesa.
      </p>
      {/* Abre no guia da variante que a pessoa costuma jogar. */}
      <Manual varianteInicial={lerPreferenciasLocais()?.variante ?? PREFERENCIAS_PADRAO.variante} />
    </main>
  );
}
