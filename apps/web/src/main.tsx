import { createRoot } from 'react-dom/client';
import { App } from './App';
import { instalarRelatorioDeErros } from './rede/errosCliente';
import './estilos.css';
import './refinamento-visual.css';
import './vitrine-mesas.css';
import './mesa-partida-feltro.css';
import './visualizacao-mesa.css';
import './mesa-mobile.css';
import './polimento-v2.css';
import './tema-perfil.css';
import './loja.css';

// Sem <StrictMode>: o efeito de reconexão do App não deve rodar duas vezes em dev.
// Erros do navegador vão para o log do operador (só no build de produção).
if (import.meta.env.PROD) instalarRelatorioDeErros();

createRoot(document.getElementById('raiz')!).render(<App />);

// PWA só em produção: desenvolvimento e testes não devem manter workers ativos.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((erro: unknown) => {
      console.warn('[PWA] Service worker indisponível:', erro);
    });
  });
}
