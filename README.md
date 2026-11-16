# Descarte BH

Plataforma acadêmica funcional conforme o diagnóstico e a entrega técnica: dados reais da PBH, mapa Leaflet/OpenStreetMap, recuperação por material e localização, metadados e auditoria.

## Abrir

No terminal desta pasta:

```powershell
python -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Acesse http://127.0.0.1:4173 . Não abra index.html diretamente por duplo clique: a interface usa fetch para carregar a base.

## Conexão dos dados

`dados_brutos/*.csv → pipeline.py → dist/dados/pontos.geojson → dist/app.js → mapa e lista`

O navegador carrega GeoJSON, metadados e relatório por HTTP. Todos os filtros são aplicados à mesma coleção para sincronizar mapa, contagem e lista. Não há banco SQL necessário nesta entrega. Os dados representam uma versão de referência, não consulta em tempo real à PBH.

Foram usados os downloads locais `20261103_ponto_verde.csv` e `20261103_unidade_recebimento_pequenos_volumes.csv`, encontrados em Downloads. Os dois arquivos originais da pasta superior, que eram idênticos, foram preservados sem alteração. A origem declarada do arquivo fica separada do tipo identificado no registro. O importador aceita cabeçalhos URPV dentro de um conjunto declarado Ponto Verde e mantém essa origem; não reclassifica o conjunto inteiro. Duplicados exatos são integrados, preservando ambas as origens. Possíveis sobreposições não exatas ficam no relatório para revisão manual.

## Atualizar a base

1. Baixe a versão CSV desejada em cada portal oficial e preserve o nome original em `dados_brutos`.
2. Atualize `fontes.json` com nome do arquivo, conjunto, data de referência, URL específica do recurso e data real do download, quando conhecidas. Não use data de modificação da página como data do conteúdo.
3. Instale as dependências, se necessário: `python -m pip install -r requirements.txt`.
4. Execute `python pipeline.py`.
5. Confira `dist/dados/relatorio_qualidade.json` e uma amostra dos pontos antes de publicar novamente a pasta `dist`.

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
