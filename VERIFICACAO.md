# Verificação da entrega — estado em 16/11/2026, antes do Galpão

- Importação real: 51 registros de Ponto Verde + 35 de URPV = 86 pontos, 9 regionais, 2 fontes.
- Nenhuma linha rejeitada na importação dos arquivos selecionados.
- Na base atual, nenhum par possui coordenadas idênticas. Foram identificados 30 pares com endereço compartilhado: 17 entre Pontos Verdes e 13 entre Ponto Verde e URPV. Os registros foram preservados, pois compartilhar endereço não comprova duplicidade.
- 5 testes Python passaram: indexação literal, validação de coordenadas, origem distinta do esquema e duplicados exatos, preservação da saída em lote inválido e formatação de números de imóveis.
- 9 testes Node passaram: carregamento real, identificadores únicos, acentos, interseção dos filtros, qualquer/todos, ordenação e raio de distância e ausência de resultados.
- 9 testes Chromium passaram: mapa e lista sincronizados, limpar filtros, detalhes, metadados, GPS simulado, endereço, marcação no mapa, tratamento de falhas, layout de celular, captura visual e mensagem para material sem pontos identificados.
- O primeiro teste de navegador identificou conflito entre o ID do botão reset e o método reset do formulário. Corrigido com HTMLFormElement.prototype.reset.call; a suíte completa de navegador passou após a correção.
- Endereço nos testes automatizados usa resposta controlada do Photon para reprodutibilidade. Consulta HTTP real de Praça Sete retornou sugestões em Belo Horizonte; disponibilidade futura do serviço não é garantida.
- GPS foi validado com permissão e coordenadas simuladas do navegador, sem acessar a localização pessoal do usuário.
- Capturas em test-results (não versionadas); visualização desktop inspecionada.
- Integração com PBH usa os CSVs locais de referência 03/11/2026; não há alegação de atualização automática em tempo real.
- Campos desconhecidos de download e recurso específico permanecem não informados na interface e nos metadados.

## Melhorias de interface e localização

- Busca complementar: quando não existem pontos dentro do raio selecionado, a plataforma apresenta até cinco pontos mais próximos, mantendo os filtros de material, regional e tipo.
- Os resultados complementares são identificados como pontos fora do raio original. As distâncias continuam sendo calculadas em linha reta.
- A busca complementar foi validada manualmente no navegador e por teste automatizado com dados controlados.
- O logotipo foi atualizado para uma imagem de maior resolução e fundo transparente.
- As janelas de detalhes apresentam fotografias de referência para Ponto Verde, URPV e Galpão, com indicação de que não representam necessariamente a unidade selecionada. A foto do Galpão é da fachada da Asmare, enviada pela equipe e armazenada no repositório.
- As fotos de Ponto Verde e URPV são carregadas de URLs externas da PBH; a do Galpão é servida localmente.
## Atualização com Galpão de Reciclagem — 17/11/2026

- O CSV `20261103_galpao_reciclagem.csv` foi incluído no manifesto e processado junto com as fontes anteriores.
- Execução de 17/11/2026 às 17:10:46 UTC: 51 registros de Ponto Verde, 35 de URPV e 8 de Galpão; 94 feições no total, sem rejeições nem duplicatas exatas integradas.
- Os oito galpões foram convertidos para EPSG:4326. A associação/cooperativa é preservada como atributo e exibida nos detalhes; o mapa tem marcador próprio para esse tipo.
- Permanecem 30 pares com endereço compartilhado, preservados para revisão. Não há pares com coordenadas coincidentes.
- Verificação após a atualização: 6 testes Python, 10 testes Node e 10 testes Chromium passaram. As suítes incluem o mapeamento/associação do Galpão, sua recuperação por tipo e material, e sua presença na legenda, nos marcadores e nos detalhes. Os testes Playwright foram executados numa cópia temporária para não deixar dependências de desenvolvimento no repositório.


## Foto ilustrativa para Galpão — 18/11/2026

- Os detalhes dos Galpões exibem uma foto própria da fachada da Asmare, enviada pela equipe do projeto, com crédito e aviso de que é uma referência visual e não representa todos os galpões nem necessariamente a aparência atual da unidade.
- A imagem é servida localmente por `dist/imagens/galpao-asmare-equipe.jpeg`; as suítes automatizadas não foram repetidas após esta alteração visual.
