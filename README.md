# JF Studio: central do canal da Jéssica Freire

Painel operado pela Nobre Designs para acompanhar o canal @jessicafreireff: desempenho dos vídeos, radar de concorrentes, pipeline de pautas e relatórios para a Jéssica.

Site: https://kalebnobre7-bit.github.io/jessicafreire/

## Stack

Vite, React 19, TypeScript, Tailwind v4, lucide-react, React Router (hash) e @dnd-kit. Deploy no GitHub Pages pelo workflow `.github/workflows/deploy.yml` a cada push na `main`.

## Dados

- **Este repositório (público)** tem só o código. Nenhum dado fica aqui.
- **[jessicafreire-data](https://github.com/kalebnobre7-bit/jessicafreire-data) (privado)** é o banco:
  - `db.json`: pautas, roteiros, referências, canais e relatórios, gravados pelo painel via API do GitHub.
  - `metrics.json`: inscritos, views totais e os últimos 15 vídeos de cada canal, com histórico de 180 dias. Coletado sem chave de API por um Actions às 06h e 18h ou pelo botão "Atualizar métricas".

## Acessos

| Quem | Token fine-grained (só no `jessicafreire-data`) | Como entra |
|---|---|---|
| Kaleb (editor) | Contents + Actions: Read and write | Cola o token na tela de conexão |
| Jéssica (leitura) | Contents: Read-only | Link gerado em Configurações → Link da Jéssica (`#/r?acesso=…`) |

## Páginas

- **Visão geral:** views, inscritos e publicações por período, último vídeo, leituras automáticas, próximas publicações e radar.
- **Vídeos:** tabela ordenável e página por vídeo com curva de views e pauta ligada.
- **Pautas:** quadro com arrastar e soltar (Ideia → Publicado), lista e editor de roteiro.
- **Radar:** vídeos em alta, comparação de canais, temas recorrentes e referências salvas.
- **Relatórios:** editor com números automáticos, publicação e leitura para a Jéssica (imprime em PDF).

## Rodar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:5173/jessicafreire/`.
