# Verificação da entrega — 16/11/2026

- Importação real: 51 registros de Ponto Verde + 35 de URPV = 86 pontos, 9 regionais, 2 fontes.
- Nenhuma linha rejeitada na importação dos arquivos selecionados.
- Na base atual, nenhum par possui coordenadas idênticas. Foram identificados 30 pares com endereço compartilhado: 17 entre Pontos Verdes e 13 entre Ponto Verde e URPV. Os registros foram preservados, pois compartilhar endereço não comprova duplicidade.
- 5 testes Python passaram: indexação literal, validação de coordenadas, origem distinta do esquema e duplicados exatos, preservação da saída em lote inválido e formatação de números de imóveis.
- 8 testes Node passaram: carregamento real, identificadores únicos, acentos, interseção dos filtros, qualquer/todos, ordenação e raio de distância e ausência de resultados.
- 9 testes Chromium passaram: mapa e lista sincronizados, limpar filtros, detalhes, metadados, GPS simulado, endereço, marcação no mapa, tratamento de falhas, layout de celular, captura visual e mensagem para material sem pontos identificados.
- O primeiro teste de navegador identificou conflito entre o ID do botão reset e o método reset do formulário. Corrigido com HTMLFormElement.prototype.reset.call; a suíte completa de navegador passou após a correção.
- Endereço nos testes automatizados usa resposta controlada do Photon para reprodutibilidade. Consulta HTTP real de Praça Sete retornou sugestões em Belo Horizonte; disponibilidade futura do serviço não é garantida.
- GPS foi validado com permissão e coordenadas simuladas do navegador, sem acessar a localização pessoal do usuário.
- Capturas em test-results (não versionadas); visualização desktop inspecionada.
- Integração com PBH usa os CSVs locais de referência 03/11/2026; não há alegação de atualização automática em tempo real.
- Campos desconhecidos de download e recurso específico permanecem não informados na interface e nos metadados.
