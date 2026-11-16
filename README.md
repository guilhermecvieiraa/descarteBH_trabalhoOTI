# Descarte BH

Plataforma acadêmica funcional conforme o diagnóstico e a entrega técnica: dados reais da PBH, mapa Leaflet/OpenStreetMap, recuperação por material e localização, metadados e auditoria.

O projeto é um site estático independente, pronto para um repositório no GitHub e hospedagem no GitHub Pages. A pasta `plataforma` deve ser a raiz do repositório: nela ficam `.github`, `dist`, `dados_brutos`, `fontes.json` e `pipeline.py`.

## Abrir

No terminal desta pasta:

```powershell
python -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Acesse http://127.0.0.1:4173 . Não abra index.html diretamente por duplo clique: a interface usa fetch para carregar a base.

## Conexão dos dados

`dados_brutos/*.csv → pipeline.py → dist/dados/pontos.geojson → dist/app.js → mapa e lista`

O navegador carrega GeoJSON, metadados e relatório por HTTP. Todos os filtros são aplicados à mesma coleção para sincronizar mapa, contagem e lista. Não há banco SQL necessário nesta entrega. Os dados representam uma versão de referência, não consulta em tempo real à PBH.

Os arquivos de referência são `dados_brutos/20261103_ponto_verde.csv` e `dados_brutos/20261103_unidade_recebimento_pequenos_volumes.csv`. Esses CSVs, internos a esta pasta, são a entrada efetiva da plataforma. A origem declarada do arquivo fica separada do tipo identificado no registro. O importador aceita cabeçalhos URPV dentro de um conjunto declarado Ponto Verde e mantém essa origem; não reclassifica o conjunto inteiro. Duplicados exatos são integrados, preservando ambas as origens. Possíveis sobreposições não exatas ficam no relatório para revisão manual.

## Enviar ao GitHub

1. Crie no GitHub um repositório vazio, por exemplo `descarte-bh`. Não inicialize esse repositório remoto com README, licença ou .gitignore, pois os arquivos locais já existem.
2. Abra um terminal dentro da pasta `plataforma`. O repositório Git local já existe. Confira os arquivos com `git status`.
3. Execute os comandos abaixo, substituindo `SEU_USUARIO` e o nome do repositório pelos seus. A autenticação é feita pelo Git/GitHub, fora do código da plataforma.

```powershell
git add .
git commit -m "Preparar Descarte BH para GitHub Pages"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/descarte-bh.git
git push -u origin main
```

Não há remoto configurado no estado preparado desta entrega. Se você já tiver adicionado `origin` depois disso, confira `git remote -v` e use `git remote set-url origin URL_DO_SEU_REPOSITORIO` em vez de adicioná-lo novamente.

Se estiver copiando os arquivos para uma pasta nova que não contém `.git`, execute `git init -b main` antes desses comandos. Não envie `node_modules`, caches ou resultados de testes; eles estão no `.gitignore`. Envie `dist` com todos os seus arquivos, incluindo `logo.png`, `vendor` e `dados`, além dos CSVs originais e código do projeto. Para clonar, executar ou publicar, não é necessária nenhuma ferramenta proprietária de hospedagem.

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

Digite bairro, regional ou termos do endereço para filtrar os campos locais. Para distância, use GPS (com permissão), marque no mapa ou clique em Localizar endereço. Nesse último caso, o texto é enviado ao Photon/Komoot somente após ação explícita, sem autocomplete remoto, com cache em memória e timeout. Resultados ficam limitados ao entorno de BH; o usuário escolhe uma sugestão. Falhas mantêm o filtro textual. URL do serviço e tiles podem ser alterados em `dist/config.json`. O serviço público Photon é apropriado para uso moderado de protótipo e não garante disponibilidade. Em escala, configure instância/provedor próprio. Coordenadas GPS não são persistidas. Distâncias usam Haversine (linha reta), não rotas. A rota é aberta externamente no Google Maps.

Os tiles OpenStreetMap, geocodificador e fontes tipográficas precisam de internet. Leaflet está incluído localmente; mesmo se o fundo do mapa falhar, lista e filtros permanecem disponíveis. Créditos OSM são visíveis no mapa. Leaflet: licença BSD-2-Clause em `dist/vendor/LEAFLET-LICENSE`.

## Verificação

```powershell
python -m unittest discover -s tests -p "test_*.py"
npm test
npm run test:browser
```

Para preparar os testes de navegador em outro computador: `npm install` e `npx playwright install chromium`. Node não é necessário para servir ou utilizar o site; apenas para manutenção das dependências e testes.

Consulte DOCUMENTACAO.md para requisitos, esquema de metadados e modelo ER. A implementação não representa o relatório acadêmico integral da Etapa 2.
