# Jéssica Freire — Central de Conteúdo

Painel estático para organizar conteúdos, referências, roteiros e canais do YouTube.

## Rodar localmente

```bash
python3 -m http.server 4173
```

Abra `http://localhost:4173` no navegador.

## Estrutura

- `index.html`: estrutura da interface
- `styles.css`: estilos e responsividade
- `app.js`: dados locais e interações

Os dados do painel são locais ao navegador. Integração com YouTube e persistência em banco de dados não estão incluídas nesta versão.
