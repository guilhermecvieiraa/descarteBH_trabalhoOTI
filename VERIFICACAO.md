# Verificação da entrega — 16/11/2026

- Importação real: 51 registros de Ponto Verde + 35 de URPV = 86 pontos, 9 regionais, 2 fontes.
- Nenhuma linha rejeitada na importação dos arquivos selecionados.
- 17 pares com mesma coordenada ou endereço foram sinalizados para revisão manual e preservados na visualização.
- 4 testes Python passaram: indexação literal, coordenadas, origem distinta do esquema, duplicados exatos e preservação da saída diante de lote sem pontos válidos.
- 8 testes Node passaram: carregamento real, identificadores únicos, acentos, interseção dos filtros, qualquer/todos, ordenação e raio de distância e ausência de resultados.
- 8 testes Chromium passaram: mapa e lista sincronizados, limpar filtros, detalhes, metadados, GPS simulado, endereço, marcação no mapa, tratamento de falhas, layout de celular e captura visual.
- O primeiro teste de navegador identificou conflito entre o ID do botão reset e o método reset do formulário. Corrigido com HTMLFormElement.prototype.reset.call; a suíte completa de navegador passou após a correção.
- Endereço nos testes automatizados usa resposta controlada do Photon para reprodutibilidade. Consulta HTTP real de Praça Sete retornou sugestões em Belo Horizonte; disponibilidade futura do serviço não é garantida.
- GPS foi validado com permissão e coordenadas simuladas do navegador, sem acessar a localização pessoal do usuário.
- Capturas em test-results (não versionadas); visualização desktop inspecionada.
- Integração com PBH usa os CSVs locais de referência 03/11/2026; não há alegação de atualização automática em tempo real.
- Campos desconhecidos de download e recurso específico permanecem não informados na interface e nos metadados.
