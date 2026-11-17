# Descarte BH

Plataforma acadêmica funcional conforme o diagnóstico e a entrega técnica: dados reais da PBH, mapa Leaflet/OpenStreetMap, recuperação por material e localização, metadados e auditoria.

O Descarte BH é um site estático hospedado no GitHub Pages. A raiz do repositório contém `.github`, `dist`, `dados_brutos`, `fontes.json`, `pipeline.py`, testes e documentação técnica.

- Site publicado: https://guilhermecvieiraa.github.io/descarteBH_trabalhoOTI/
- Repositório: https://github.com/guilhermecvieiraa/descarteBH_trabalhoOTI

## Abrir

No terminal desta pasta:

```powershell
python -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Acesse http://127.0.0.1:4173 . Não abra index.html diretamente por duplo clique: a interface usa fetch para carregar a base.

## Conexão dos dados

`dados_brutos/*.csv → pipeline.py → dist/dados/pontos.geojson → dist/app.js → mapa e lista`

O navegador carrega GeoJSON, metadados e relatório por HTTP. Todos os filtros são aplicados à mesma coleção para sincronizar mapa, contagem e lista. Não há banco SQL necessário nesta entrega. Os dados representam uma versão de referência, não consulta em tempo real à PBH.

Os arquivos de referência são `dados_brutos/20261103_ponto_verde.csv` e `dados_brutos/20261103_unidade_recebimento_pequenos_volumes.csv`. Esses CSVs, internos a esta pasta, são a entrada efetiva da plataforma. A origem declarada do arquivo fica separada do tipo identificado no registro. O importador aceita cabeçalhos URPV dentro de um conjunto declarado Ponto Verde e mantém essa origem; não reclassifica o conjunto inteiro. Duplicados exatos são integrados, preservando ambas as origens. O relatório de qualidade distingue coordenadas coincidentes de endereços compartilhados, preservando os registros para revisão.

## Enviar alterações ao GitHub

O projeto já possui repositório remoto configurado e publicação pelo GitHub Pages.

Para enviar alterações a partir de um clone local com permissão de escrita:

```bash
git status
git add .
git commit -m "Atualiza plataforma Descarte BH"
git pull --rebase origin main
git push origin main
```

Se o Git identificar conflitos durante o rebase, eles devem ser resolvidos e os testes executados novamente antes do push.

Não envie ambientes virtuais, `node_modules`, caches ou resultados temporários de testes. Esses arquivos estão configurados no `.gitignore`.

A pasta `dist` contém o site publicado e deve ser versionada.

## Publicar no GitHub Pages

O workflow `.github/workflows/pages.yml` publica somente a pasta `dist`, usando GitHub Actions. O pipeline Python não é executado durante a publicação: isso preserva a versão dos dados e metadados que foi revisada e enviada ao repositório.

1. Após enviar os arquivos, abra o repositório no GitHub.
2. Em **Settings → Pages → Build and deployment**, selecione **GitHub Actions** como Source.
3. Em **Actions**, abra **Publicar no GitHub Pages** e execute **Run workflow** na branch `main`. Essa execução manual também permite publicar caso o primeiro push tenha ocorrido antes da ativação de Pages.
4. Quando a execução terminar, o link estará no ambiente `github-pages` e na página de configuração de Pages. Normalmente o endereço de um repositório de projeto tem o formato `https://SEU_USUARIO.github.io/descarte-bh/`.

Novos pushes na branch `main` que alterem `dist` ou o workflow iniciam a publicação. GitHub Pages precisa estar disponível para a visibilidade e o plano do repositório. O workflow usa o token automático do GitHub Actions: não adicione tokens pessoais aos arquivos.

Os caminhos do aplicativo são relativos, permitindo que logo, estilos, scripts e GeoJSON carreguem também sob `/nome-do-repositorio/`.

Documentação oficial: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

## Atualizar a base

1. Baixe a versão CSV desejada em cada portal oficial e preserve o nome original em `dados_brutos`.
2. Atualize `fontes.json` com nome do arquivo, conjunto, data de referência, URL específica do recurso e data real do download, quando conhecidas. Não use data de modificação da página como data do conteúdo.
3. Instale as dependências, se necessário: `python -m pip install -r requirements.txt`.
4. Execute `python pipeline.py`.
5. Confira `dist/dados/relatorio_qualidade.json` e uma amostra dos pontos.
6. Envie ao GitHub as mudanças dos CSVs, manifesto, histórico e arquivos gerados em `dist/dados`. O workflow publicará a nova versão de `dist`.

O pipeline preserva CSV bruto por SHA-256 em `dist/dados/brutos` e snapshots de metadados/relatório em `historico`. Não concatena automaticamente arquivos antigos: somente fontes explicitamente configuradas entram no mapa. Um lote sem pontos válidos não substitui a saída anterior. Campos de proveniência desconhecidos são nulos. Os hashes permitem verificar integridade, não autenticidade da publicação.

Galpão Reciclagem exige CSV real e mapeamento validado em `fontes.json`; nenhum ponto fictício foi acrescentado.

## Localização e serviços

Digite bairro, regional ou termos do endereço para filtrar os campos locais. Para distância, use GPS (com permissão), marque no mapa ou clique em Localizar endereço. Nesse último caso, o texto é enviado ao Photon/Komoot somente após ação explícita, sem autocomplete remoto, com cache em memória e timeout. Resultados ficam limitados ao entorno de BH; o usuário escolhe uma sugestão. Falhas mantêm o filtro textual. URL do serviço e tiles podem ser alterados em `dist/config.json`. O serviço público Photon é apropriado para uso moderado de protótipo e não garante disponibilidade. Em escala, configure instância/provedor próprio. Coordenadas GPS não são persistidas. Distâncias usam Haversine (linha reta), não rotas. A rota é aberta externamente no Google Maps. Quando não existem pontos dentro do raio escolhido, a interface apresenta até cinco pontos mais próximos fora desse raio, respeitando os demais filtros. Essa situação é informada ao usuário. Um endereço pesquisado não precisa corresponder ao endereço de um ponto de descarte.

Os tiles OpenStreetMap, geocodificador e fontes tipográficas precisam de internet. Leaflet está incluído localmente; mesmo se o fundo do mapa falhar, lista e filtros permanecem disponíveis. Créditos OSM são visíveis no mapa. Leaflet: licença BSD-2-Clause em `dist/vendor/LEAFLET-LICENSE`.

## Identificação visual dos equipamentos

As janelas de detalhes apresentam fotografias de referência dos tipos Ponto Verde e URPV.

As imagens são ilustrativas e não devem ser interpretadas como fotografias do endereço selecionado. Cada imagem apresenta crédito e acesso à publicação original da PBH.

O logotipo utiliza imagem com fundo transparente, integrada à identidade visual da plataforma.

As fotografias dependem de URLs externas, e suas condições de reutilização devem ser conferidas antes da publicação definitiva.

## Verificação

```powershell
python -m unittest discover -s tests -p "test_*.py"
npm test
npm run test:browser
```

Para preparar os testes de navegador em outro computador: `npm install` e `npx playwright install chromium`. Node não é necessário para servir ou utilizar o site; apenas para manutenção das dependências e testes.

Consulte DOCUMENTACAO.md para requisitos, esquema de metadados e modelo ER. A implementação não representa o relatório acadêmico integral da Etapa 2.
