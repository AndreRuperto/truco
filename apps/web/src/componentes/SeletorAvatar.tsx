import { AVATARES_PRONTOS } from '@truco/api';
import { useId, useRef, useState } from 'react';
import { Avatar, DesenhoAvatar, NOME_AVATAR, reduzirFoto } from './Avatar';

interface Props {
  apelido: string;
  valor: string | null;
  /** Recebe `pronto:<id>`, uma imagem `data:` (já reduzida) ou null; pode demorar (salvar na conta). */
  aoMudar: (avatar: string | null) => void | Promise<void>;
}

/**
 * Foto ao lado do apelido: um botão redondo com a foto atual que abre os ícones do site,
 * "Enviar foto" e "Sem foto". Serve para quem tem conta e para quem só pôs o apelido.
 */
export function SeletorAvatar({ apelido, valor, aoMudar }: Props) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);
  const id = useId();
  const escolher = async (v: string | null | Promise<string>) => {
    setErro(null);
    setSalvando(true);
    try {
      await aoMudar(await v);
      setAberto(false);
    } catch (x) {
      setErro(x instanceof Error ? x.message : String(x));
    } finally {
      setSalvando(false);
    }
  };
  return (
    <div className="seletor-avatar">
      <button
        type="button"
        className="seletor-avatar-botao"
        aria-expanded={aberto}
        aria-controls={id}
        aria-label="Escolher foto"
        title="Escolher foto"
        onClick={() => setAberto((x) => !x)}
      >
        <Avatar apelido={apelido || '?'} avatar={valor} tamanho={44} />
        <span className="seletor-avatar-lapis" aria-hidden="true">
          ✎
        </span>
      </button>
      {aberto && (
        <div className="seletor-avatar-painel" id={id} role="group" aria-label="Foto" aria-busy={salvando}>
          <ul className="avatares-prontos">
            {AVATARES_PRONTOS.map((a) => (
              <li key={a}>
                <button
                  type="button"
                  aria-pressed={valor === `pronto:${a}`}
                  aria-label={NOME_AVATAR[a]}
                  title={NOME_AVATAR[a]}
                  disabled={salvando}
                  onClick={() => void escolher(`pronto:${a}`)}
                >
                  <DesenhoAvatar id={a} />
                </button>
              </li>
            ))}
          </ul>
          <div className="seletor-avatar-acoes">
            <button type="button" onClick={() => arquivo.current?.click()} disabled={salvando}>
              Enviar foto
            </button>
            {valor && (
              <button type="button" onClick={() => void escolher(null)} disabled={salvando}>
                Sem foto
              </button>
            )}
            <input
              ref={arquivo}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              data-testid="seletor-avatar-arquivo"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void escolher(reduzirFoto(f));
              }}
            />
          </div>
          {erro && (
            <p className="erro-form" role="alert">
              {erro}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
