import { useEffect, useState } from 'react';
import { NOME_MODO, NOME_VARIANTE } from '../logica/conta';
import type { Api } from '../rede/api';
import { useAgora, useCarregar } from '../rede/hooks';

interface Props {
  api: Pick<Api, 'salas'>;
  aoEntrar: (id: string) => void;
  /** Começa já uma mesa com as regras salvas, contra 3 bots. */
  aoJogarComBots?: () => void;
}

const INTERVALO_MS = 12_000;

/** "agora", "há 8 s", "há 2 min": quanto tempo faz a última atualização da lista. */
export function textoAtualizado(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 5) return 'atualizado agora';
  if (s < 60) return `atualizado há ${s} s`;
  return `atualizado há ${Math.floor(s / 60)} min`;
}

export function TelaSalas({ api, aoEntrar, aoJogarComBots }: Props) {
  const { dados, erro, carregando, recarregar } = useCarregar(() => api.salas(), []);
  const agora = useAgora(1_000);
  const [atualizadoEm, setAtualizadoEm] = useState<number | null>(null);
  useEffect(() => {
    if (dados) setAtualizadoEm(Date.now());
  }, [dados]);
  // As mesas enchem e começam rápido: a lista se atualiza sozinha.
  useEffect(() => {
    const id = setInterval(recarregar, INTERVALO_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <main className="tela-conta tela-salas">
      <h1>Mesas abertas</h1>
      <p className="salas-situacao">
        {/* Sem região viva: o texto muda a cada segundo e não deve ser lido em voz alta toda hora. */}
        <span>{carregando && !dados ? 'Procurando mesas…' : atualizadoEm ? textoAtualizado(agora - atualizadoEm) : ''}</span>
        <button type="button" onClick={recarregar} disabled={carregando}>
          Atualizar
        </button>
      </p>
      {erro && (
        <p className="erro-form" role="alert">
          {erro}
        </p>
      )}
      {dados && dados.salas.length === 0 && (
        <section className="mesa-vazia" aria-labelledby="mesa-vazia-titulo">
          <MesaVaziaDesenho />
          <h2 id="mesa-vazia-titulo">Ninguém sentou ainda</h2>
          <p>As mesas esperando gente aparecem aqui assim que alguém abre uma. Abra a sua e chame os amigos, ou comece contra os bots.</p>
          <div className="mesa-vazia-acoes">
            <a className="botao-principal botao-link" href="#/">
              Abrir uma mesa
            </a>
            {aoJogarComBots && (
              <button type="button" onClick={aoJogarComBots}>
                Jogar com bots agora
              </button>
            )}
          </div>
        </section>
      )}
      {dados && dados.salas.length > 0 && (
        <ul className="lista-dados">
          {dados.salas.map((s) => (
            <li key={s.id}>
              <span>
                {NOME_MODO[s.modo]} · {NOME_VARIANTE[s.variante]}
              </span>
              <span>
                {s.ocupados}/{s.humanos} humanos
              </span>
              <span>{s.dono ?? '—'}</span>
              <button type="button" aria-label={`Entrar na mesa de ${s.dono ?? 'alguém'}`} onClick={() => aoEntrar(s.id)}>
                Entrar
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

/** Mesa de bar vista de cima: quatro cadeiras vazias e o baralho fechado no meio. */
function MesaVaziaDesenho() {
  const cadeiras = [
    { x: 100, y: 22, r: 0 },
    { x: 178, y: 100, r: 90 },
    { x: 100, y: 178, r: 180 },
    { x: 22, y: 100, r: 270 },
  ];
  return (
    <svg className="mesa-vazia-desenho" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      {cadeiras.map((c, i) => (
        <g key={i} transform={`translate(${c.x} ${c.y}) rotate(${c.r})`}>
          <rect className="mv-cadeira" x="-22" y="-16" width="44" height="30" rx="7" />
          <rect className="mv-encosto" x="-22" y="-22" width="44" height="9" rx="4" />
        </g>
      ))}
      <circle className="mv-sombra" cx="102" cy="104" r="62" />
      <circle className="mv-tampo" cx="100" cy="100" r="62" />
      <circle className="mv-aro" cx="100" cy="100" r="54" />
      <circle className="mv-copo" cx="134" cy="72" r="9" />
      <g transform="translate(100 102) rotate(-12)">
        <rect className="mv-carta" x="-13" y="-17" width="26" height="36" rx="3" transform="translate(3 3)" />
        <rect className="mv-carta" x="-13" y="-17" width="26" height="36" rx="3" transform="translate(1.5 1.5)" />
        <rect className="mv-carta" x="-13" y="-17" width="26" height="36" rx="3" />
        <rect className="mv-verso" x="-9" y="-13" width="18" height="28" rx="2" />
      </g>
    </svg>
  );
}
