# JF Studio: central do canal da Jéssica Freire

Painel operado pela Nobre Designs para acompanhar o canal @jessicafreireff: desempenho dos vídeos, radar de concorrentes, biblioteca de referências, pipeline de pautas, recomendações do que gravar e relatórios.

Site: **https://jessicafreire.vercel.app** (o endereço antigo no GitHub Pages redireciona para cá)

## Stack

Vite, React 19, TypeScript, Tailwind v4, lucide-react, React Router (hash) e @dnd-kit. Funções serverless em `api/` na Vercel.

## Acesso

Entra com **senha** e o aparelho fica lembrado (cookie de sessão de 180 dias, assinado). O token do GitHub vive só nas variáveis de ambiente da Vercel: o navegador nunca o vê.

| Variável (Vercel) | Para quê |
|---|---|
| `APP_PASSWORD` | Senha de entrada. Trocar aqui muda a senha de todo mundo. |
| `SESSION_SECRET` | Assina o cookie de sessão. Trocar desloga todos. |
| `GITHUB_TOKEN` | Token fine-grained com Contents e Actions no `jessicafreire-data`. |

As tentativas de login são limitadas por IP (8 a cada 10 minutos).

## Dados

- **Este repositório (público)** tem o código do painel e das funções. Nenhum dado fica aqui.
- **[jessicafreire-data](https://github.com/kalebnobre7-bit/jessicafreire-data) (privado)** é o banco:
  - `db.json`: pautas, roteiros, biblioteca, canais e relatórios.
  - `metrics.json`: inscritos, views totais e os últimos 15 vídeos de cada canal, com histórico de 180 dias. Coletado sem chave de API por um Actions às 06h e 18h.
  - `ai-ideas.json`: ideias geradas pelo Claude (workflow `recommend.yml`, chave no secret `ANTHROPIC_API_KEY`).
  - `refs/`: prints salvos na biblioteca.

## Páginas

- **Visão geral:** métricas por período, último vídeo, leituras automáticas, próximas publicações e o que gravar.
- **Vídeos:** tabela ordenável e página por vídeo com curva de views e pauta ligada.
- **Pautas:** quadro com arrastar e soltar (Ideia → Publicado), lista e editor de roteiro.
- **O que gravar:** sugestões calculadas dos dados e ideias geradas pelo Claude.
- **Radar:** vídeos em alta, comparação de canais, temas e uma página por canal monitorado.
- **Biblioteca:** links, prints e textos (thumb, vídeo, ideia, gancho, título, formato) com tags.
- **Relatórios:** editor com números automáticos e a visão de leitura em `#/r`.

## Rodar e publicar

```bash
npm install
npm run dev          # http://localhost:5173 (as rotas /api só rodam na Vercel ou com `vercel dev`)
npx vercel deploy --prod   # publica
```

O projeto não está ligado ao GitHub pela Vercel, então o deploy é por esse comando.
