# Mídias do site (polaroids)

- `topo/` — fotos das polaroids do Início (lanches). `<nome>-480.webp` e `<nome>-960.webp`.
- `mural/` — fotos e vídeos do "Quem já veio". Vídeo: `<nome>.mp4` (sem som, ~540 px de largura) + `<nome>-poster.webp`.

Depois de salvar os arquivos, inclua uma linha em `src/config/midia.ts` (texto alternativo descrevendo a foto).
**Mídia de cliente só com autorização**: legenda com o @ da pessoa e `clienteAutorizado: true`.

Como gerar (exemplo com ffmpeg / qualquer editor):
- foto: exporte em WebP qualidade ~80, uma com 480 px e outra com 960 px de largura;
- vídeo: `ffmpeg -i entrada.mp4 -an -vf scale=540:-2 -c:v libx264 -crf 28 -movflags +faststart saida.mp4`.

Origem das atuais: fotos e vídeo enviados pelo Erik em 20/10/2026 (posts do @cemitaburger). Veja os produtos identificados no topo de `src/config/midia.ts`.
