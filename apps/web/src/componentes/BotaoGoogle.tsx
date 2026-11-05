import { useEffect, useRef, useState } from 'react';

/** O pedaço do Google Identity Services (`google.accounts.id`) que usamos. */
export interface GoogleId {
  initialize(o: { client_id: string; callback: (r: { credential: string }) => void }): void;
  renderButton(el: HTMLElement, o: Record<string, unknown>): void;
}

export type CarregarGoogle = () => Promise<GoogleId>;

let carregando: Promise<GoogleId> | null = null;

/** Carrega https://accounts.google.com/gsi/client uma vez (só quando o servidor tem GOOGLE_CLIENT_ID). */
export const carregarGsi: CarregarGoogle = () => {
  carregando ??= new Promise<GoogleId>((ok, falha) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => {
      const g = (window as unknown as { google?: { accounts?: { id?: GoogleId } } }).google?.accounts?.id;
      if (g) ok(g);
      else falha(new Error('Google Identity Services indisponível'));
    };
    s.onerror = () => {
      carregando = null;
      falha(new Error('não foi possível carregar o login do Google'));
    };
    document.head.appendChild(s);
  });
  return carregando;
};

interface Props {
  clientId: string;
  aoCredencial: (credencial: string) => void;
  carregar?: CarregarGoogle;
}

export function BotaoGoogle({ clientId, aoCredencial, carregar = carregarGsi }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(aoCredencial);
  cb.current = aoCredencial;
  const [falhou, setFalhou] = useState(false);
  useEffect(() => {
    let vivo = true;
    setFalhou(false);
    carregar().then(
      (g) => {
        if (!vivo || !ref.current) return;
        g.initialize({ client_id: clientId, callback: (r) => cb.current(r.credential) });
        g.renderButton(ref.current, { theme: 'outline', size: 'large', text: 'signin_with', locale: 'pt-BR' });
      },
      (e: unknown) => {
        console.warn('[google]', e);
        if (vivo) setFalhou(true);
      },
    );
    return () => {
      vivo = false;
    };
  }, [clientId, carregar]);
  return (
    <>
      <div ref={ref} className="botao-google" data-testid="botao-google" />
      {falhou && <p className="nota">Login com Google indisponível agora.</p>}
    </>
  );
}
