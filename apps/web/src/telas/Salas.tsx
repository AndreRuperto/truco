import { useEffect } from 'react';
import { NOME_MODO, NOME_VARIANTE } from '../logica/conta';
import type { Api } from '../rede/api';
import { useCarregar } from '../rede/hooks';

interface Props {
  api: Pick<Api, 'salas'>;
  aoEntrar: (id: string) => void;
}

const INTERVALO_MS = 12_000;

export function TelaSalas({ api, aoEntrar }: Props) {
  const { dados, erro, carregando, recarregar } = useCarregar(() => api.salas(), []);
  // As mesas enchem e começam rápido: a lista se atualiza sozinha.
  useEffect(() => {
    const id = setInterval(recarregar, INTERVALO_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <main className="tela-conta">
      <h1>Mesas abertas</h1>
      <p>
        <button type="button" onClick={recarregar}>
          Atualizar
        </button>
      </p>
      {carregando && !dados && <p role="status">Carregando…</p>}
      {erro && (
        <p className="erro-form" role="alert">
          {erro}
        </p>
      )}
      {dados && dados.salas.length === 0 && <p>Nenhuma mesa esperando jogadores agora. Crie uma no Início.</p>}
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
