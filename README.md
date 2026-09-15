# Jéssica Freire — Central de Conteúdo

Painel para organizar pautas, roteiros, referências e canais do YouTube, com métricas coletadas automaticamente.

Site: https://kalebnobre7-bit.github.io/jessicafreire/

## Como funciona

- **Este repositório (público)** tem só o código do site, publicado pelo GitHub Pages. Nenhum dado fica aqui.
- **[jessicafreire-data](https://github.com/kalebnobre7-bit/jessicafreire-data) (privado)** é o banco:
  - `db.json`: pautas, roteiros, checklist, referências e canais, gravados pelo painel via API do GitHub.
  - `metrics.json`: inscritos, views e likes dos últimos 15 vídeos de cada canal, coletados sem chave de API por um GitHub Actions às 06h e 18h (ou pelo botão "Atualizar agora").
- O painel cruza as métricas com as pautas: vídeos acima da média do canal, temas em alta no radar, ritmo de postagem e pautas que parecem já ter sido publicadas.

## Conectar um navegador

1. Crie um token *fine-grained* em https://github.com/settings/personal-access-tokens/new
   - Repository access: **Only select repositories → jessicafreire-data**
   - Permissions: **Contents: Read and write** e **Actions: Read and write**
2. No painel, clique no status do banco (canto inferior da barra lateral) e cole o token.

Atalho para outro aparelho: abra `https://kalebnobre7-bit.github.io/jessicafreire/#conectar=SEU_TOKEN` uma vez. O token é salvo só naquele navegador e some da barra de endereço.

## Rodar localmente

```bash
python3 -m http.server 4180
```

Abra `http://localhost:4180`.

## Estrutura

- `index.html`: estrutura da interface
- `styles.css`: estilos e responsividade
- `app.js`: estado, renderização e eventos
- `github.js`: leitura e gravação do banco pela API do GitHub
- `insights.js`: análise das métricas e leituras automáticas
