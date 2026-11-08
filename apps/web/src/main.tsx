import { createRoot } from 'react-dom/client';
import { App } from './App';
import './estilos.css';
import './refinamento-visual.css';
import './vitrine-mesas.css';
import './mesa-partida-feltro.css';
import './visualizacao-mesa.css';
import './mesa-mobile.css';

// Sem <StrictMode>: o efeito de reconexão do App não deve rodar duas vezes em dev.
createRoot(document.getElementById('raiz')!).render(<App />);

// PWA só em produção: desenvolvimento e testes não devem manter workers ativos.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((erro: unknown) => {
      console.warn('[PWA] Service worker indisponível:', erro);
    });
  });
}
