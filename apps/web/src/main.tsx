import { createRoot } from 'react-dom/client';
import { App } from './App';
import './estilos.css';
import './refinamento-visual.css';
import './vitrine-mesas.css';

// Sem <StrictMode>: o efeito de reconexão do App não deve rodar duas vezes em dev.
createRoot(document.getElementById('raiz')!).render(<App />);
