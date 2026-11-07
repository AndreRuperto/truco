import type { ReactNode } from 'react';

/** Ícones de traço da barra da mesa (24×24, cor do texto). Decorativos: o botão tem o nome. */
function Icone({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

/** Sinais (piscadas e caretas): um olho. */
export const IconeSinais = () => (
  <Icone>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </Icone>
);

/** Falas (truco, desce, vixe...): balão com exclamação. */
export const IconeFalas = () => (
  <Icone>
    <path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.6-5.2A8.4 8.4 0 1 1 21 11.5z" />
    <path d="M12 8v4" />
    <path d="M12 15.5h.01" />
  </Icone>
);

/** Chat da mesa privada: balão de conversa. */
export const IconeChat = () => (
  <Icone>
    <path d="M4 5h16v11H9l-5 4z" />
    <path d="M8 9.5h8M8 12.5h5" />
  </Icone>
);

/** Vista 3D: um cubo. */
export const Icone3D = () => (
  <Icone>
    <path d="M12 2.5 20.5 7v10L12 21.5 3.5 17V7z" />
    <path d="M3.5 7 12 11.5 20.5 7M12 11.5v10" />
  </Icone>
);

export const IconeSom = ({ ligado }: { ligado: boolean }) => (
  <Icone>
    <path d="M4 9h4l5-4v14l-5-4H4z" />
    {ligado ? (
      <>
        <path d="M16 9.5a3.5 3.5 0 0 1 0 5" />
        <path d="M18.5 7a7 7 0 0 1 0 10" />
      </>
    ) : (
      <path d="M17 9.5l4.5 5M21.5 9.5 17 14.5" />
    )}
  </Icone>
);

/** Como jogar (o manual): livro aberto. */
export const IconeManual = () => (
  <Icone>
    <path d="M2.5 5H9a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H2.5z" />
    <path d="M21.5 5H15a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7.5z" />
  </Icone>
);

export const IconeSair = () => (
  <Icone>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5M21 12H9" />
  </Icone>
);
