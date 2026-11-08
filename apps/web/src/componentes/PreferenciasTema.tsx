import { useState } from 'react';
import { aplicarTema, lerTema, type Tema, TEMAS } from '../logica/tema';

/**
 * Preferência visual local do dispositivo.
 * O site aplica o tema inicial no index.html, antes do React montar a tela.
 * A escolha continua funcionando sem rede e sem modificar dados da conta.
 */
export function PreferenciasTema() {
  const [tema, setTema] = useState<Tema>(lerTema);

  return (
    <section className="preferencias-tema" aria-labelledby="titulo-preferencias-tema">
      <div className="preferencias-tema-cabecalho">
        <span className="preferencias-tema-icone" aria-hidden="true">◐</span>
        <div>
          <h3 id="titulo-preferencias-tema">Aparência do site</h3>
          <p>Escolha como o Truco aparece neste aparelho.</p>
        </div>
      </div>
      <div className="preferencias-tema-opcoes" role="group" aria-label="Tema do site">
        {TEMAS.map(({ valor, rotulo }) => (
          <button
            type="button"
            key={valor}
            aria-pressed={tema === valor}
            onClick={() => {
              aplicarTema(valor);
              setTema(valor);
            }}
          >
            <span aria-hidden="true" className={`preferencias-tema-amostra amostra-${valor}`}>
              {valor === 'auto' ? '◐' : valor === 'claro' ? '☀' : '☾'}
            </span>
            <span>{rotulo}</span>
          </button>
        ))}
      </div>
      <p className="preferencias-tema-nota">Automático acompanha o modo claro ou escuro do aparelho. Sua escolha fica salva neste navegador.</p>
    </section>
  );
}
