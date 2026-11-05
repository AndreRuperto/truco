/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL do servidor Colyseus (ex.: ws://127.0.0.1:2568). Sem ela, ver `urlServidor()`. */
  readonly VITE_SERVIDOR?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
