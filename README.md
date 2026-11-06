# Meu Ap 🏠

Painel de acompanhamento de imóveis para aluguel em Fortaleza–CE.

## Funcionalidades da primeira versão
- Layout responsivo com lista à esquerda e mapa OpenStreetMap/Leaflet à direita.
- Filtros por bairro, texto, orçamento e favoritos.
- Ficha lateral deslizante com detalhes e link do anúncio.
- **Sem fotos falsas:** mostra aviso quando não há foto verificada.
- **Sem pins fictícios:** só mostra marcadores quando existem coordenadas explícitas.
- Fallback visual com **dados de exemplo históricos** enquanto a API não estiver configurada.

## Banco de dados
A planilha mestre é [Meu Ap no Google Sheets](https://docs.google.com/spreadsheets/d/1dWHX2-sZqZlSeDKercMS7NUiRHabmg7DqB1f_fttmeY/edit). Manter somente as abas **Imóveis** e **Configurações**.

### Integração segura (pendente)
O endpoint `GET /api/imoveis` lê a planilha pelo Google Sheets API usando **conta de serviço**. Configurar no projeto Vercel:
- `GOOGLE_SHEET_ID`: ID da planilha (opcional; há padrão configurado).
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: e-mail da conta de serviço.
- `GOOGLE_PRIVATE_KEY`: chave privada da conta de serviço (segredo, **nunca enviar ao GitHub**).

Compartilhe a planilha com o e-mail da conta de serviço como **Leitor**. Não cole a chave privada no chat, em issues ou no repositório. Configure-a diretamente nas variáveis de ambiente da Vercel.

**Atenção à privacidade:** a rota pública devolve somente campos explicitamente autorizados no código. Não devolve contatos nem endereços completos. Para acesso privado e edição bidirecional, será necessário acrescentar autenticação e autorização no backend. **A edição no painel ainda não está habilitada**; por enquanto edite diretamente no Google Sheets.

## Desenvolvimento
O front-end é `index.html` e pode ser aberto diretamente no navegador no modo de exemplo. Para a API, execute `npm install` e use Vercel para desenvolvimento/deploy. O GitHub armazena código, mas não hospeda a API automaticamente.

## Estado
- Interface inicial: implementada.
- Integração com Google Sheets: código de leitura preparado, credenciais/deploy pendentes.
- Escrita no Sheets e autenticação: pendentes.
- Publicação: pendente.
- Fotos dos anúncios e coordenadas: não verificadas.
- A lista de demonstração é **parcial** e não substitui os registros da planilha.
