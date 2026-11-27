# Truco

Truco paulista e mineiro online, em tempo real: jogue contra bots, chame os amigos numa mesa privada ou entre na
ranqueada. No ar em [truco.up.railway.app](https://truco.up.railway.app).

## O que tem dentro

- **Servidor autoritativo** (Colyseus + Express 5): o servidor decide cada jogada e cada jogador recebe só a
  própria visão da mesa, então ninguém vê a carta do outro pelo protocolo (`packages/engine/src/visao.ts`).
- **Motor de regras isolado** (`packages/engine`): paulista e mineiro, família, cangada, mão de onze e mão de ferro,
  escada do truco; o mesmo código roda no servidor e nos testes. Embaralhamento com gerador criptográfico.
- **Contas** por link mágico (Resend) ou Google, sessões guardadas como hash, banimento que derruba a conexão em
  tempo real, ranking com Elo e proteção contra conluio.
- **Interface** React + TypeScript + Vite, PWA, vista 2D e 3D (Three.js), reconexão com prazo para quem cai.
- **Segurança**: CSP estrita, HSTS, limites por IP (IPv6 por /64); relatório em `docs/seguranca/`.

## Rodar e testar

```bash
pnpm install --frozen-lockfile
pnpm -r typecheck
pnpm -r test          # motor, servidor e web (Vitest)
pnpm test:e2e         # Playwright
```

Monorepo pnpm: `apps/web` (interface), `apps/server` (servidor), `packages/engine` (regras). Deploy no Railway:
`docs/deploy-railway.md`. Variáveis: `.env.example`.

## Segurança e uso

- Falhas de segurança: veja [SECURITY.md](SECURITY.md) (aviso privado, não abra issue pública).
- **Código aberto para leitura.** Todos os direitos reservados: não há licença de uso, cópia ou redistribuição.
