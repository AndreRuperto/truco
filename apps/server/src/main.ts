import { criarServidor } from './servidor';

const porta = Number(process.env.PORT ?? 2567);
await criarServidor().listen(porta);
console.log(`truco: servidor ouvindo na porta ${porta}`);
