// ============================================================
// PLANILHA DE LEADS/PAGAMENTOS — CRM na Mão
// ============================================================
//
// Adaptado do script usado pela Comunidade Revalida. Antes de usar,
// revise PRODUTOS, PRECOS_CENTAVOS, INFINITEPAY_HANDLE e SITE_BASE_URL
// mais abaixo -- estão com placeholders/TODO pra você preencher com os
// dados reais da CRM na Mão.
//
// COMO USAR (passo a passo):
//
// 1. Crie uma planilha Google Sheets em branco (ou abra uma já criada
//    para isso) e cole a URL dela no navegador.
//
// 2. Vá em Extensões -> Apps Script.
//
// 3. Apague o conteúdo padrão e cole TODO o conteúdo deste arquivo.
//
// 4. No topo do editor, escolha a função "setupPlanilha" no menu suspenso
//    (ao lado do botão "Depurar") e clique em "Executar" (▶). Na primeira
//    vez, o Google vai pedir autorização -- é a sua própria planilha,
//    pode autorizar. Isso monta todas as abas (Dashboard, Instruções,
//    Leads, Painel, uma "Aprovados"/"Aguardando" por produto, e uma aba
//    oculta de apoio aos gráficos) com cabeçalhos, formatação, design e
//    fórmulas automaticamente.
//
// 5. Implante como Web App (Implantar -> Nova implantação -> App da Web,
//    executar como "Eu", acesso "Qualquer pessoa"). Copie a URL gerada
//    (termina em /exec) e cole em APPS_SCRIPT_URL, no início dos arquivos
//    site/js/plano-checkout.js e site/js/cadastro.js.
//
// 6. (Opcional, automação de pagamento) Ver a aba "Instruções" da
//    própria planilha, seção "Webhook de pagamento", para entender as
//    limitações e o que precisa ser feito no painel da InfinitePay.
//
// ============================================================

const ABA_LEADS = "Leads";
const ABA_PAINEL = "Painel";
const ABA_INSTRUCOES = "Instruções";
const ABA_DASHBOARD = "Dashboard";
const ABA_DADOS_GRAFICOS = "Dados (não editar)"; // aba oculta, só com tabelas de apoio pros gráficos
const ABA_NOVO_LEAD = "Adicionar Lead Manual";

// abas de controle pros leads de "Outros Produtos" -- todo lead cujo Plano
// (coluna J da Leads) NÃO bate com nenhum nome cadastrado em PRODUTOS. É o
// caso, hoje, dos leads vindos do formulário de cadastro personalizado
// (site/cadastro.html), que grava a descrição livre do produto ali (ver
// registrarCadastroPersonalizado()). Diferente das abas por produto (uma
// pra cada item de PRODUTOS), estas duas são únicas -- juntam TODO produto
// fora da lista, não só um -- por isso têm uma coluna "Produto" própria,
// EDITÁVEL (fórmula VLOOKUP, mesma ideia da coluna Observações -- ver
// sincronizarProdutoDaLinha()): dá pra reclassificar um lead pra um dos
// produtos de PRODUTOS só digitando o nome exato ali (ou colando um já
// sugerido -- ver validação da coluna Plano em criarAbaLeads()) -- ele some
// dessas abas e aparece na aba do produto escolhido na próxima atualização.
const ABA_OUTROS_PRODUTOS = "Outros Produtos";
const ABA_OUTROS_PRODUTOS_AGUARDANDO = "Outros Produtos - Aguardando";
const COL_PRODUTO_OUTROS_APROVADOS = 20; // T -- listagem ocupa A-R (18 campos, igual às abas por produto)
const COL_OBSERVACOES_OUTROS_APROVADOS = 22; // V
const COL_PRODUTO_OUTROS_AGUARDANDO = 20; // T
const COL_APROVAR_OUTROS_AGUARDANDO = 22; // V
const COL_OBSERVACOES_OUTROS_AGUARDANDO = 24; // X

// coluna dos valores no formulário da aba "Adicionar Lead Manual" (rótulo
// fica na coluna A, valor/input na B)
const COL_MANUAL_VALOR = 2;
const LINHA_MANUAL_NOME = 4;
const LINHA_MANUAL_CPF = 5;
const LINHA_MANUAL_ENDERECO = 6;
const LINHA_MANUAL_ESTADO = 7;
const LINHA_MANUAL_PAIS = 8;
const LINHA_MANUAL_WHATSAPP = 9;
const LINHA_MANUAL_EMAIL = 10;
const LINHA_MANUAL_CATEGORIA = 11;
// só preenchido (e só é usado) quando Categoria = "Outro" -- mesmo caso do
// formulário de cadastro personalizado do site (site/cadastro.html), só
// que lançado direto na planilha em vez de vir do formulário público.
const LINHA_MANUAL_PRODUTO_PERSONALIZADO = 12;
const LINHA_MANUAL_OBSERVACOES = 13;
// campos internos da equipe -- mesmos que COL_TURMA/HORARIO_PREFERENCIA/
// ATOR_RESPONSAVEL/VENDEDOR/DESCONTO na Leads, ver comentário lá.
const LINHA_MANUAL_TURMA = 14;
const LINHA_MANUAL_HORARIO_PREFERENCIA = 15;
const LINHA_MANUAL_ATOR_RESPONSAVEL = 16;
const LINHA_MANUAL_VENDEDOR = 17;
const LINHA_MANUAL_DESCONTO = 18;
const LINHA_MANUAL_PLANO_FINAL = 19;
const LINHA_MANUAL_INSERIR = 21;
const LINHA_MANUAL_CONFIRMACAO = 24;

// ============================================================
// DESIGN -- paleta de cores extraída do site (site/css/style.css,
// bloco :root). Mesma identidade visual do site nas abas da planilha.
// ============================================================
const COR_NAVY = "#182336";         // --bg do site: fundo dos banners/cabeçalhos
const COR_NAVY_CARD = "#1e2e50";    // --card: tom secundário navy
const COR_BORDA = "#324879";        // --card-border
const COR_ACCENT = "#8fb6e3";       // --orange do site (na verdade um azul-claro): cor de destaque/ação
const COR_ACCENT_LIGHT = "#d8e0f2"; // --orange-2: tom claro do destaque
const COR_BRANCO = "#ffffff";
const COR_ZEBRA = "#eef2fa";        // linha alternada (tint claro do --card-border)
const COR_MUTED = "#5b6b8c";        // texto secundário sobre fundo claro

// "badges" de status -- fundo bem claro + texto forte na mesma cor, no
// lugar do preenchimento sólido genérico do Sheets
const COR_BADGE_VERDE_BG = "#e3f6ea";
const COR_BADGE_VERDE_TXT = "#1f7a4d";
const COR_BADGE_AMBAR_BG = "#fff2d9";
const COR_BADGE_AMBAR_TXT = "#8a5a00";
const COR_BADGE_VERMELHO_BG = "#fbe4e4";
const COR_BADGE_VERMELHO_TXT = "#b42318";

// cor de aba (tab color) de cada planilha, pra identificar de longe
const COR_TAB_APROVADOS = "#2f9e63";
const COR_TAB_AGUARDANDO = "#d99a2b";

const CABECALHOS_LEADS = [
  "ID", "Data/Hora", "Nome", "CPF", "Endereço", "Estado", "País", "WhatsApp",
  "E-mail", "Plano", "Categoria", "Status Pagamento", "Forma de Pagamento",
  "Parcelas", "Valor Pago", "Data Pagamento", "ID da Transação", "Recibo",
  "Marcar como Pago", "Observações", "Turma", "Horário de Preferência",
  "Ator Responsável", "Vendedor", "Desconto"
];
const COL_WHATSAPP = 8; // H
const COL_PLANO = 10; // J
const COL_CATEGORIA = 11; // K
const COL_STATUS_PAGAMENTO = 12; // L
const COL_FORMA_PAGAMENTO = 13; // M
const COL_PARCELAS = 14; // N
const COL_VALOR_PAGO = 15; // O
const COL_DATA_PAGAMENTO = 16; // P
const COL_ID_TRANSACAO = 17; // Q
const COL_RECIBO = 18; // R
const COL_MARCAR_PAGO = 19; // S, na aba Leads -- checkbox: marcar move o lead pra "Pago" na hora
const COL_OBSERVACOES = 20; // T, na aba Leads -- texto livre, editável a qualquer momento
// colunas extras (campos internos da equipe, não vêm do formulário público
// do site -- só preenchidos manualmente na Leads ou na aba "Adicionar Lead
// Manual"). Ficam no fim de propósito, depois de Observações, pra não
// mexer na posição de nenhuma coluna já usada em fórmula/QUERY acima.
const COL_TURMA = 21; // U
const COL_HORARIO_PREFERENCIA = 22; // V
const COL_ATOR_RESPONSAVEL = 23; // W
const COL_VENDEDOR = 24; // X
const COL_DESCONTO = 25; // Y

// coluna do botão "Aprovar" nas abas "- Aguardando" de cada produto (coluna O
// daquela aba -- ao lado da listagem ao vivo, não na Leads). A listagem ao
// vivo começa em A5 e ocupa as colunas A-M (A = ID do lead); o botão fica na
// coluna O, uma coluna de espaço depois.
const COL_APROVAR_AGUARDANDO = 20; // T
const LINHA_INICIO_LISTA_AGUARDANDO = 6; // primeira linha de dado (linha 5 é o cabeçalho da QUERY)
const QTD_LINHAS_APROVAR_AGUARDANDO = 150;

// coluna de Observações -- editável direto nas abas "Aprovados"/"Aguardando"
// de cada produto, não só na Leads. Cada célula nasce com uma fórmula
// VLOOKUP que busca o texto salvo na Leads pelo ID do lead daquela linha; ao
// digitar em cima, onEdit() grava o texto na Leads (fonte real do dado) e
// devolve a fórmula pra célula, pra ela continuar acompanhando a linha certa
// mesmo quando a lista se reorganizar (ver onEdit()).
const COL_OBSERVACOES_APROVADOS = 20; // T -- não tem botão "Aprovar" nessa aba, então usa a mesma posição
const QTD_LINHAS_OBSERVACOES_APROVADOS = 1994; // mesmo alcance da zebra da listagem
const COL_OBSERVACOES_AGUARDANDO = 22; // V -- duas colunas depois do botão "Aprovar" (T), com uma de respiro (U)
const QTD_LINHAS_OBSERVACOES_AGUARDANDO = 1994; // mesmo alcance da zebra da listagem

// Lista de produtos -- precisa ficar IDÊNTICA (mesmo texto) aos nomes usados
// em PLANOS, no início de site/js/comprar.js. Ao adicionar um produto novo
// lá, adicione o mesmo nome aqui e rode setupPlanilha() de novo -- isso cria
// a aba dedicada dele sem apagar as abas dos produtos já existentes.
const PRODUTOS = [
  "Expresso",
  "Expresso + Pense",
  "Premium",
  "Premium + Pense",
];

// ============================================================
// INTEGRAÇÃO INFINITEPAY -- gera um link de pagamento EXCLUSIVO por pedido
// (com order_nsu), pra casar o webhook de pagamento com o lead certo com
// 100% de certeza, em vez de "adivinhar" por valor + horário.
// ============================================================

const INFINITEPAY_HANDLE = "ocrmnamao"; // sem o "$"
const INFINITEPAY_LINKS_URL = "https://api.checkout.infinitepay.io/links";

// preço de cada plano em CENTAVOS (a API trabalha em centavos, igual o
// campo "amount" que já recebemos no webhook). Se o preço mudar, só
// atualizar aqui -- não precisa mexer no site.
const PRECOS_CENTAVOS = {
  "Expresso": 85000,          // R$ 850,00
  "Expresso + Pense": 135000, // R$ 1.350,00
  "Premium": 210000,          // R$ 2.100,00
  "Premium + Pense": 245000,  // R$ 2.450,00
};

// pra onde a InfinitePay redireciona o aluno depois do pagamento. SITE_BASE_URL
// é o domínio próprio; REDIRECT_URL_PAGAMENTO_FALLBACK entra se o Plano não
// bater com nenhuma categoria conhecida (não deveria acontecer, mas evita
// mandar o cliente pra uma URL quebrada).
const SITE_BASE_URL = "https://ocrmnamao.com.br";
const REDIRECT_URL_PAGAMENTO_FALLBACK = SITE_BASE_URL + "/";

// Hoje só existe uma página de boas-vindas (obrigado.html) para todos os
// planos. Se no futuro cada plano ganhar sua própria turma/grupo de
// WhatsApp, crie uma página obrigado-<plano>.html por tier e troque este
// retorno fixo por regras como as que a Comunidade Revalida usava (checar
// o texto de `plano` com regex antes de cair no fallback).
function determinarUrlRedirecionamento(plano) {
  return SITE_BASE_URL + "/obrigado.html";
}

// abas de produtos que foram renomeados -- apagadas automaticamente na
// próxima vez que setupPlanilha() rodar, pra não ficarem abas órfãs com
// nome antigo. Adicione aqui o nome antigo sempre que renomear um produto
// (vazio por enquanto -- projeto novo, sem histórico de renomeações).
const ABAS_ANTIGAS_PARA_REMOVER = [];

// ============================================================
// HELPERS DE ESTILO -- reaplicados em todas as abas pra manter a mesma
// identidade visual (banner navy, cabeçalho de tabela, zebra, badges).
// ============================================================

// converte índice de coluna (1 = A) pra letra, usado ao montar fórmulas
function colLetra(n) {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - m) / 26);
  }
  return s;
}

// banner de título no topo da aba (linha 1), largura = numColunas
function estilizarBanner(sh, titulo, numColunas) {
  const range = sh.getRange(1, 1, 1, numColunas);
  range.merge();
  range.setValue(titulo)
    .setBackground(COR_NAVY)
    .setFontColor(COR_BRANCO)
    .setFontWeight("bold")
    .setFontSize(18)
    .setFontFamily("Arial")
    .setVerticalAlignment("middle")
    .setHorizontalAlignment("left");
  sh.setRowHeight(1, 48);
  range.setBorder(false, false, true, false, false, false, COR_ACCENT, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
}

// barra de subtítulo/seção (fundo azul claro, texto navy)
function estilizarSecao(sh, linha, texto, numColunas) {
  const range = sh.getRange(linha, 1, 1, numColunas);
  range.merge();
  range.setValue(texto)
    .setBackground(COR_ACCENT_LIGHT)
    .setFontColor(COR_NAVY)
    .setFontWeight("bold")
    .setFontSize(11)
    .setVerticalAlignment("middle");
  sh.setRowHeight(linha, 26);
}

// cabeçalho de tabela (linha com nomes de coluna)
function estilizarCabecalhoTabela(range) {
  range.setBackground(COR_NAVY)
    .setFontColor(COR_BRANCO)
    .setFontWeight("bold")
    .setFontSize(10)
    .setVerticalAlignment("middle");
}

// remove bandings (zebra) antigos da aba inteira -- chamar UMA VEZ logo
// após sh.clear(), antes de qualquer aplicarZebra(), pra não duplicar ao
// rodar setupPlanilha() de novo nem apagar a zebra de outro bloco da mesma aba
function limparBandings(sh) {
  sh.getBandings().forEach((b) => b.remove());
}

// listras (zebra) numa faixa de dados, nas cores do site
function aplicarZebra(sh, range) {
  const banding = range.applyRowBanding(SpreadsheetApp.BandingTheme.BLUE, false, false);
  banding.setFirstRowColor(COR_BRANCO).setSecondRowColor(COR_ZEBRA);
}

// SpreadsheetApp.getUi().alert() só funciona quando a função é chamada a
// partir de uma interação real na interface (ex: um item de menu) -- rodar
// a função direto pelo botão "Executar" do editor do Apps Script (o jeito
// que setupPlanilha() é documentado pra rodar, no topo deste arquivo) NÃO
// conta como esse contexto, e getUi() derruba a execução inteira com
// "Cannot call SpreadsheetApp.getUi() from this context". Esse helper tenta
// mostrar o alerta e, se não der (por causa desse contexto), só registra a
// mensagem no Registro de execução (Ver -> Registros) em vez de travar tudo.
function avisar(mensagem) {
  try {
    SpreadsheetApp.getUi().alert(mensagem);
  } catch (erro) {
    Logger.log(mensagem);
  }
}

// célula de valor "chip"/badge -- usado nos KPIs do Dashboard/Painel
function estilizarValorDestaque(range, corFundo, corTexto, tamanho) {
  range.setBackground(corFundo)
    .setFontColor(corTexto)
    .setFontWeight("bold")
    .setFontSize(tamanho || 14)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
}

function setupPlanilha() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  ABAS_ANTIGAS_PARA_REMOVER.forEach((nome) => {
    const sh = ss.getSheetByName(nome);
    if (sh) ss.deleteSheet(sh);
  });

  criarAbaInstrucoes(ss);
  criarAbaLeads(ss);
  criarAbaPainel(ss);
  PRODUTOS.forEach((produto) => {
    criarAbaProduto(ss, produto);
    criarAbaAguardando(ss, produto);
  });
  criarAbaOutrosProdutos(ss);
  criarAbaOutrosProdutosAguardando(ss);
  criarAbaDadosGraficos(ss);
  criarAbaDashboard(ss);
  criarAbaNovoLeadManual(ss);

  // remove a aba padrão "Página1"/"Sheet1" se ainda existir vazia
  const padrao = ss.getSheetByName("Página1") || ss.getSheetByName("Sheet1");
  if (padrao && ss.getSheets().length > 1) {
    ss.deleteSheet(padrao);
  }

  // Dashboard sempre em primeiro, pra abrir a planilha já na visão geral
  const shDash = ss.getSheetByName(ABA_DASHBOARD);
  ss.setActiveSheet(shDash);
  ss.moveActiveSheet(1);

  ss.setActiveSheet(shDash);
  avisar("Planilha configurada! A aba 'Dashboard' já abre com a visão geral -- veja também a aba 'Instruções'.");
}

// Rode ESTA função (não a setupPlanilha) se a aba Leads já tem dados
// reais -- ela só ADICIONA a coluna do botão "Marcar como Pago" na aba
// Leads existente, sem apagar nenhum lead já cadastrado. setupPlanilha()
// limpa a aba Leads inteira, então não deve ser rodada de novo depois que
// leads reais começarem a chegar.
function adicionarBotaoMarcarPago() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(ABA_LEADS);
  if (!sh) {
    avisar("Aba 'Leads' não encontrada.");
    return;
  }

  sh.getRange(1, COL_MARCAR_PAGO).setValue("Marcar como Pago");
  sh.getRange(1, COL_MARCAR_PAGO)
    .setFontWeight("bold")
    .setBackground(COR_ACCENT)
    .setFontColor(COR_NAVY);
  sh.getRange(2, COL_MARCAR_PAGO, 2000, 1).insertCheckboxes();
  sh.autoResizeColumns(COL_MARCAR_PAGO, 1);

  avisar("Pronto! Coluna 'Marcar como Pago' adicionada na aba Leads, sem apagar nenhum dado.");
}

// Rode ESTA função (não a setupPlanilha) se a aba Leads já tem dados reais e
// ainda não tem a coluna "Observações" (coluna T) -- ela só ADICIONA essa
// coluna no fim da aba Leads existente, sem apagar nenhum lead já
// cadastrado. Depois de rodar essa função uma vez (ou já numa planilha
// nova, criada do zero com setupPlanilha), as abas de cada produto passam a
// ter uma coluna "Observações" editável também -- é só rodar setupPlanilha()
// de novo pra essas abas serem reconstruídas com a coluna nova (a aba Leads
// em si é protegida e não é apagada).
function adicionarColunaObservacoes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(ABA_LEADS);
  if (!sh) {
    avisar("Aba 'Leads' não encontrada.");
    return;
  }

  sh.getRange(1, COL_OBSERVACOES).setValue("Observações");
  estilizarCabecalhoTabela(sh.getRange(1, COL_OBSERVACOES, 1, 1));
  sh.autoResizeColumns(COL_OBSERVACOES, 1);

  avisar(
    "Pronto! Coluna 'Observações' adicionada no fim da aba Leads, sem apagar nenhum dado. " +
    "Rode setupPlanilha() agora pra essa coluna aparecer, editável, também nas abas de cada produto."
  );
}

// Rode ESTA função (não a setupPlanilha) se a aba Leads já tem dados reais
// e você quer o dropdown de sugestão da coluna Plano (mostra os produtos de
// PRODUTOS num clique, mas continua aceitando texto livre -- ver comentário
// em criarAbaLeads()). A trava de segurança de criarAbaLeads() impede
// setupPlanilha() de tocar na aba Leads depois que ela já tem leads reais,
// então esse ajuste nunca chegaria nela sozinho -- essa função só aplica a
// validação na coluna, sem apagar nem reformatar mais nada.
function adicionarValidacaoPlano() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA_LEADS);
  if (!sh) {
    avisar("Aba 'Leads' não encontrada.");
    return;
  }

  const planoSugerido = SpreadsheetApp.newDataValidation()
    .requireValueInList(PRODUTOS.concat([ABA_OUTROS_PRODUTOS]), true)
    .setAllowInvalid(true)
    .build();
  sh.getRange(2, COL_PLANO, 2000, 1).setDataValidation(planoSugerido);

  avisar(
    "Pronto! A coluna 'Plano' da aba Leads agora mostra um dropdown com os produtos de PRODUTOS " +
    "ao clicar numa célula (mas ainda aceita texto livre, pra não quebrar os leads de produto " +
    "personalizado). Nenhum dado foi apagado."
  );
}

// Corrige o CPF (coluna D) na aba Leads existente, em duas etapas:
// 1. Força o formato "Texto simples" na coluna inteira -- evita que o
//    Sheets continue interpretando um CPF só-números como número daqui pra
//    frente (o que derruba o zero à esquerda). registrarLead() também já
//    faz isso por linha em cada lead novo, mas essa função cobre de uma vez
//    todas as linhas já existentes na planilha.
// 2. Varre as linhas já cadastradas: onde o CPF foi salvo como NÚMERO (ou
//    seja, já perdeu o zero à esquerda), reconstrói como texto com 11
//    dígitos, preenchendo com zero(s) à esquerda até completar o tamanho
//    padrão de CPF. Assumir "faltam zeros à esquerda" é uma aposta razoável
//    (é exatamente o que o Sheets faz ao converter pra número), mas não é
//    garantido -- todo CPF alterado é logado (Nome, valor antigo, valor
//    novo) pra dar pra conferir manualmente contra o documento real do
//    cliente antes de confiar 100%.
function corrigirFormatoCpf() {
  const sh = ss_ativa().getSheetByName(ABA_LEADS);
  if (!sh) {
    avisar("Aba 'Leads' não encontrada.");
    return;
  }

  sh.getRange(2, 4, 2000, 1).setNumberFormat("@");

  const dados = sh.getDataRange().getValues();
  let corrigidos = 0;
  Logger.log("=== CPFs corrigidos (formato número -> texto, com zeros à esquerda) ===");

  for (let i = 1; i < dados.length; i++) {
    const id = dados[i][0];
    if (!id) continue; // linha vazia

    const cpfAtual = dados[i][3];
    if (typeof cpfAtual !== "number") continue; // já é texto, não precisa mexer

    const cpfCorrigido = String(cpfAtual).padStart(11, "0");
    const linhaPlanilha = i + 1;
    sh.getRange(linhaPlanilha, 4).setValue(cpfCorrigido);
    corrigidos++;
    Logger.log(`ID ${id} | Nome: "${dados[i][2]}" | CPF antigo: ${cpfAtual} -> novo: ${cpfCorrigido}`);
  }

  avisar(
    `Formato de texto aplicado na coluna CPF inteira. ${corrigidos} CPF(s) que tinham virado número foram ` +
    `reconstruídos com zero(s) à esquerda -- confira a lista completa no Registro de execução e valide contra ` +
    `o documento real do cliente quando possível.`
  );
}

// Corrige o WhatsApp (coluna H) na aba Leads existente -- mesmo problema do
// CPF (ver corrigirFormatoCpf() acima), mas com uma consequência diferente:
// aqui o número em si fica certo (WhatsApp não tem zero à esquerda), só que
// enquanto a célula for do tipo NÚMERO, ela some do resultado do QUERY() nas
// abas de cada produto (Aprovados/Aguardando), porque o QUERY() infere um
// único tipo de dado por coluna a partir da maioria das células e devolve em
// branco qualquer célula do tipo "errado" pra aquela coluna. Rode esta
// função UMA VEZ pra corrigir os leads já cadastrados; leads novos (site,
// "Adicionar Lead Manual" ou pagamento avulso) já nascem corrigidos, porque
// registrarLead() e registrarPagamento() agora forçam "Texto simples" na
// coluna WhatsApp antes de gravar (ver COL_WHATSAPP).
function corrigirFormatoWhatsApp() {
  const sh = ss_ativa().getSheetByName(ABA_LEADS);
  if (!sh) {
    avisar("Aba 'Leads' não encontrada.");
    return;
  }

  sh.getRange(2, COL_WHATSAPP, 2000, 1).setNumberFormat("@");

  const dados = sh.getDataRange().getValues();
  let corrigidos = 0;
  Logger.log("=== WhatsApp corrigidos (formato número -> texto) ===");

  for (let i = 1; i < dados.length; i++) {
    const id = dados[i][0];
    if (!id) continue; // linha vazia

    const whatsappAtual = dados[i][COL_WHATSAPP - 1];
    if (typeof whatsappAtual !== "number") continue; // já é texto, não precisa mexer

    const whatsappCorrigido = String(whatsappAtual);
    const linhaPlanilha = i + 1;
    sh.getRange(linhaPlanilha, COL_WHATSAPP).setValue(whatsappCorrigido);
    corrigidos++;
    Logger.log(`ID ${id} | Nome: "${dados[i][2]}" | WhatsApp antigo: ${whatsappAtual} -> novo: ${whatsappCorrigido}`);
  }

  avisar(
    `Formato de texto aplicado na coluna WhatsApp inteira. ${corrigidos} número(s) que tinham virado NÚMERO foram ` +
    `reconstruídos como texto. Agora rode setupPlanilha() de novo pra reconstruir as abas de cada produto -- os ` +
    `WhatsApp que estavam sumindo devem aparecer.`
  );
}

// Cria 10 vendas de FAKE/teste direto na aba Leads (sem passar pela
// InfinitePay), já como "Pago" e com datas espalhadas nos últimos ~80
// dias, pra dar pra ver os gráficos do Dashboard preenchidos (diário,
// semanal, mensal, por produto). Roda avulsa, no editor do Apps Script
// (escolha "criarVendasTeste" no menu suspenso e clique em Executar).
//
// Os nomes começam com "TESTE - " de propósito, pra ficar fácil de achar
// e apagar depois: na aba Leads, selecione essas linhas e "Excluir linhas".
function criarVendasTeste() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(ABA_LEADS);
  if (!sh) {
    avisar("Aba 'Leads' não encontrada. Rode setupPlanilha() primeiro.");
    return;
  }

  const nomesTeste = [
    "TESTE - Ana Beatriz Souza", "TESTE - Carlos Eduardo Lima", "TESTE - Fernanda Costa",
    "TESTE - Gustavo Pereira", "TESTE - Juliana Alves", "TESTE - Marcos Vinícius",
    "TESTE - Patrícia Gomes", "TESTE - Rafael Nogueira", "TESTE - Camila Ribeiro",
    "TESTE - Thiago Martins",
  ];

  // [plano, dias atrás da venda, forma de pagamento, parcelas, valor pago em R$]
  const vendas = [
    ["Expresso", 2, "pix", 1, 850],
    ["Premium", 5, "credit_card", 1, 2100],
    ["Expresso", 9, "pix", 1, 850],
    ["Premium", 14, "credit_card", 3, 2100],
    ["Expresso + Pense", 20, "pix", 1, 1350],
    ["Premium + Pense", 28, "credit_card", 1, 2450],
    ["Expresso + Pense", 40, "pix", 1, 1350],
    ["Premium + Pense", 55, "credit_card", 2, 2450],
    ["Expresso", 65, "pix", 1, 850],
    ["Premium", 80, "credit_card", 1, 2100],
  ];

  const linhaInicio = proximaLinhaVaziaPorId(sh);
  const agora = new Date();
  const linhas = vendas.map((venda, i) => {
    const [plano, diasAtras, formaPagamento, parcelas, valor] = venda;
    const dataPagamento = new Date(agora.getTime() - diasAtras * 24 * 60 * 60 * 1000);
    const dataEnvio = new Date(dataPagamento.getTime() - 60 * 60 * 1000); // formulário preenchido 1h antes
    return [
      "TESTE" + (i + 1),
      dataEnvio,
      nomesTeste[i],
      "000.000.000-00",
      "Rua de Teste, 123, Centro",
      "São Paulo",
      "Brasil",
      "(11) 90000-000" + i,
      "teste" + (i + 1) + "@exemplo.com",
      plano,
      "", // Categoria -- fórmula abaixo
      "Pago",
      formaPagamento,
      parcelas,
      valor,
      dataPagamento,
      "TESTE-TX-" + (i + 1),
      "",
      true, // Marcar como Pago
      "", // Observações
      "", "", "", "", "", // Turma, Horário de Preferência, Ator Responsável, Vendedor, Desconto
    ];
  });

  sh.getRange(linhaInicio, 1, linhas.length, 25).setValues(linhas);
  sh.getRange(linhaInicio, 2, linhas.length, 1).setNumberFormat("dd/mm/yyyy hh:mm:ss");
  sh.getRange(linhaInicio, COL_DATA_PAGAMENTO, linhas.length, 1).setNumberFormat("dd/mm/yyyy hh:mm:ss");
  sh.getRange(linhaInicio, COL_VALOR_PAGO, linhas.length, 1).setNumberFormat("R$ #,##0.00");

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhaInicio + i;
    const formulaCategoria =
      `=IF(J${linha}="";"";IF(J${linha}="${ABA_OUTROS_PRODUTOS}";"${ABA_OUTROS_PRODUTOS}";` +
      `IF(REGEXMATCH(TO_TEXT(J${linha});"(?i)premium");"Premium";` +
      `IF(REGEXMATCH(TO_TEXT(J${linha});"(?i)expresso");"Expresso";"Outro"))))`;
    sh.getRange(linha, COL_CATEGORIA).setFormula(formulaCategoria);
  }

  avisar(
    "10 vendas de teste criadas na aba Leads (nomes começando com 'TESTE - '). " +
    "Veja a aba Dashboard pra conferir os gráficos. Quando terminar de testar, apague essas " +
    "linhas manualmente na aba Leads (selecione as linhas pelo número e 'Excluir linhas')."
  );
}

function criarAbaLeads(ss) {
  let sh = ss.getSheetByName(ABA_LEADS);
  if (!sh) sh = ss.insertSheet(ABA_LEADS);

  // TRAVA DE SEGURANÇA: se já existe mais que só o cabeçalho (ou seja, já
  // tem lead real cadastrado), NÃO apaga essa aba -- só sai. O resto de
  // setupPlanilha() (Painel, Dashboard, abas de produto, design) continua
  // rodando normalmente; só a Leads em si fica intocada. Se um dia
  // precisar mudar a ESTRUTURA da Leads (nova coluna, reordenar) com
  // leads reais já cadastrados, isso precisa de uma função de migração
  // específica (não destrutiva) -- não mexa direto aqui.
  if (sh.getLastRow() > 1) {
    avisar(
      "A aba 'Leads' já tem dados além do cabeçalho (leads reais) -- ela NÃO foi " +
      "apagada nem reconstruída, pra proteger esses dados. As outras abas " +
      "(Painel, Dashboard, abas de cada produto, Instruções) foram atualizadas " +
      "normalmente. Se você precisa mudar a estrutura da própria aba Leads " +
      "agora, isso exige uma função de migração específica -- não use " +
      "setupPlanilha() pra isso."
    );
    return;
  }

  sh.clear();
  limparBandings(sh);
  sh.setTabColor(COR_NAVY);
  sh.setHiddenGridlines(false);

  const numColunas = CABECALHOS_LEADS.length;
  sh.getRange(1, 1, 1, numColunas).setValues([CABECALHOS_LEADS]);
  estilizarCabecalhoTabela(sh.getRange(1, 1, 1, numColunas));
  sh.setFrozenRows(1);
  sh.setRowHeight(1, 32);
  sh.autoResizeColumns(1, numColunas);

  // zebra nas linhas de dados, nas cores do site
  aplicarZebra(sh, sh.getRange(2, 1, 1999, numColunas));

  // formato de data/hora pras colunas B (Data/Hora do lead) e P (Data
  // Pagamento) inteiras, de uma vez -- sem isso, cada linha só ficava
  // formatada se quem escreveu nela (registrarLead / aprovação de
  // pagamento) formatasse a célula individualmente; assim as colunas já
  // nascem formatadas, independente de qual caminho preencheu a linha.
  sh.getRange(2, 2, 2000, 1).setNumberFormat("dd/mm/yyyy hh:mm:ss");
  sh.getRange(2, COL_DATA_PAGAMENTO, 2000, 1).setNumberFormat("dd/mm/yyyy hh:mm:ss");

  // CPF como texto puro (coluna D) -- sem isso, quando o cliente digita o
  // CPF só com números (sem pontos/traço), o Sheets entende como um NÚMERO
  // e derruba o zero à esquerda (ex: "078.377.531-86" digitado como
  // "07837753186" vira 7837753186, com um dígito a menos). Forçar o formato
  // "Texto simples" ANTES do valor chegar evita isso na origem.
  sh.getRange(2, 4, 2000, 1).setNumberFormat("@");

  // WhatsApp como texto puro (coluna H) -- mesmo motivo do CPF acima: um
  // número digitado só com dígitos (sem espaço/parênteses/traço) vira NÚMERO
  // pro Sheets. Isso não derruba dígito nenhum aqui (WhatsApp não tem zero à
  // esquerda), mas quebra o QUERY() das abas de cada produto (Aprovados/
  // Aguardando) -- QUERY() infere um único tipo de dado por coluna a partir
  // da maioria das células e devolve em BRANCO qualquer célula do tipo
  // "errado" pra aquela coluna. Era exatamente por isso que o WhatsApp
  // aparecia certinho na Leads mas sumia nas abas de Mentoria.
  sh.getRange(2, COL_WHATSAPP, 2000, 1).setNumberFormat("@");

  // validação de dados (dropdown) para Status Pagamento -- coluna L
  const statusValido = SpreadsheetApp.newDataValidation()
    .requireValueInList(["Aguardando pagamento", "Pago", "Recusado", "Cancelado"], true)
    .setAllowInvalid(true)
    .build();
  sh.getRange(2, COL_STATUS_PAGAMENTO, 2000, 1).setDataValidation(statusValido);

  // dropdown de SUGESTÃO (não trava) pra coluna Plano -- mostra os produtos
  // de PRODUTOS num clique, pra reclassificar rápido um lead de "Outros
  // Produtos" pra um produto fixo (ex: cliente do cadastro.html que decidiu
  // um plano específico) só escolhendo na lista, sem digitar o nome exato.
  // setAllowInvalid(true) é obrigatório aqui -- ainda precisa aceitar texto
  // livre nessa coluna, pra não quebrar os leads de produto personalizado
  // (cadastro.html / Categoria "Outro" na aba "Adicionar Lead Manual"), que
  // dependem de o texto NÃO bater com nenhum item de PRODUTOS pra caírem
  // nas abas "Outros Produtos" (ver condicaoOutrosProdutos()).
  const planoSugerido = SpreadsheetApp.newDataValidation()
    .requireValueInList(PRODUTOS.concat([ABA_OUTROS_PRODUTOS]), true)
    .setAllowInvalid(true)
    .build();
  sh.getRange(2, COL_PLANO, 2000, 1).setDataValidation(planoSugerido);

  // checkbox "Marcar como Pago" (coluna S) -- marcar move o lead pra "Pago" na hora,
  // via o gatilho onEdit() abaixo. É o botão manual pedido.
  sh.getRange(2, COL_MARCAR_PAGO, 2000, 1).insertCheckboxes();

  // "badges" de status: fundo bem claro + texto forte na mesma cor,
  // em vez do preenchimento sólido genérico do Sheets
  const regraPago = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("Pago")
    .setBackground(COR_BADGE_VERDE_BG)
    .setFontColor(COR_BADGE_VERDE_TXT)
    .setBold(true)
    .setRanges([sh.getRange(2, COL_STATUS_PAGAMENTO, 2000, 1)])
    .build();
  const regraAguardando = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("Aguardando pagamento")
    .setBackground(COR_BADGE_AMBAR_BG)
    .setFontColor(COR_BADGE_AMBAR_TXT)
    .setBold(true)
    .setRanges([sh.getRange(2, COL_STATUS_PAGAMENTO, 2000, 1)])
    .build();
  const regraRecusado = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("Recusado")
    .setBackground(COR_BADGE_VERMELHO_BG)
    .setFontColor(COR_BADGE_VERMELHO_TXT)
    .setBold(true)
    .setRanges([sh.getRange(2, COL_STATUS_PAGAMENTO, 2000, 1)])
    .build();
  const regraCancelado = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("Cancelado")
    .setBackground(COR_BADGE_VERMELHO_BG)
    .setFontColor(COR_BADGE_VERMELHO_TXT)
    .setBold(true)
    .setRanges([sh.getRange(2, COL_STATUS_PAGAMENTO, 2000, 1)])
    .build();
  sh.setConditionalFormatRules([regraPago, regraAguardando, regraRecusado, regraCancelado]);

  // coluna Categoria (K) calculada automaticamente a partir do Plano (J)
  // separador de argumentos ";" porque a planilha está em localidade
  // pt-BR (vírgula é separador decimal, não de argumentos de função)
  const formulaCategoria =
    `=ARRAYFORMULA(IF(ROW(J2:J)=1;;IF(J2:J="";;` +
    `IF(J2:J="${ABA_OUTROS_PRODUTOS}";"${ABA_OUTROS_PRODUTOS}";` +
    `IF(REGEXMATCH(TO_TEXT(J2:J);"(?i)premium");"Premium";` +
    `IF(REGEXMATCH(TO_TEXT(J2:J);"(?i)expresso");"Expresso";"Outro"))))))`;
  sh.getRange(2, COL_CATEGORIA).setFormula(formulaCategoria);
}

function criarAbaPainel(ss) {
  let sh = ss.getSheetByName(ABA_PAINEL);
  if (!sh) sh = ss.insertSheet(ABA_PAINEL);
  sh.clear();
  sh.setTabColor(COR_ACCENT);
  sh.setHiddenGridlines(true);

  estilizarBanner(sh, "PAINEL — CRM na Mão", 6);

  estilizarSecao(sh, 3, "Resumo geral", 6);
  const linhasResumo = [
    ["Total de leads (formulário preenchido):", `=COUNTA(${ABA_LEADS}!A2:A)`, null, null],
    ["Total pago:", `=COUNTIF(${ABA_LEADS}!L2:L;"Pago")`, COR_BADGE_VERDE_BG, COR_BADGE_VERDE_TXT],
    ["Aguardando pagamento:", `=COUNTIF(${ABA_LEADS}!L2:L;"Aguardando pagamento")`, COR_BADGE_AMBAR_BG, COR_BADGE_AMBAR_TXT],
    ["Recusado/Cancelado:", `=COUNTIF(${ABA_LEADS}!L2:L;"Recusado")+COUNTIF(${ABA_LEADS}!L2:L;"Cancelado")`, COR_BADGE_VERMELHO_BG, COR_BADGE_VERMELHO_TXT],
    ["Valor total pago (R$):", `=SUMIF(${ABA_LEADS}!L2:L;"Pago";${ABA_LEADS}!O2:O)`, COR_NAVY, COR_BRANCO],
  ];
  linhasResumo.forEach((item, i) => {
    const linha = 4 + i;
    sh.getRange(linha, 1).setValue(item[0]).setFontColor(COR_NAVY).setFontWeight("bold").setFontSize(10);
    const celulaValor = sh.getRange(linha, 2).setFormula(item[1]);
    if (item[0].indexOf("R$") !== -1) celulaValor.setNumberFormat("R$ #,##0.00");
    estilizarValorDestaque(celulaValor, item[2] || COR_ZEBRA, item[3] || COR_NAVY, 12);
    sh.setRowHeight(linha, 24);
  });

  estilizarSecao(sh, 10, "Por produto — veja a lista completa na aba de cada produto", 6);
  sh.getRange(11, 1, 1, 3).setValues([["Produto", "Aprovados", "Aguardando"]]);
  estilizarCabecalhoTabela(sh.getRange(11, 1, 1, 3));
  PRODUTOS.forEach((produto, i) => {
    const linha = 12 + i;
    sh.getRange(linha, 1).setValue(produto).setFontColor(COR_NAVY);
    estilizarValorDestaque(
      sh.getRange(linha, 2).setFormula(`=COUNTIFS(${ABA_LEADS}!J2:J;"${produto}";${ABA_LEADS}!L2:L;"Pago")`),
      COR_BADGE_VERDE_BG, COR_BADGE_VERDE_TXT, 11
    );
    estilizarValorDestaque(
      sh.getRange(linha, 3).setFormula(`=COUNTIFS(${ABA_LEADS}!J2:J;"${produto}";${ABA_LEADS}!L2:L;"Aguardando pagamento")`),
      COR_BADGE_AMBAR_BG, COR_BADGE_AMBAR_TXT, 11
    );
  });

  // linha extra pro total de "Outros Produtos" (cadastro personalizado, ver
  // criarAbaOutrosProdutos()) -- mesma lista, só que junta tudo que não é
  // nenhum item de PRODUTOS, em vez de um produto específico.
  const linhaOutros = 12 + PRODUTOS.length;
  sh.getRange(linhaOutros, 1).setValue("Outros Produtos (cadastro personalizado)").setFontColor(COR_NAVY);
  estilizarValorDestaque(
    sh.getRange(linhaOutros, 2).setFormula(formulaContagemOutros("Pago")),
    COR_BADGE_VERDE_BG, COR_BADGE_VERDE_TXT, 11
  );
  estilizarValorDestaque(
    sh.getRange(linhaOutros, 3).setFormula(formulaContagemOutros("Aguardando pagamento")),
    COR_BADGE_AMBAR_BG, COR_BADGE_AMBAR_TXT, 11
  );

  const linhaFormas = 12 + PRODUTOS.length + 2;
  estilizarSecao(sh, linhaFormas, "Por forma de pagamento (pagos)", 6);
  sh.getRange(linhaFormas + 1, 1).setValue("Pix:").setFontColor(COR_NAVY).setFontWeight("bold").setFontSize(10);
  sh.getRange(linhaFormas + 1, 2).setFormula(`=COUNTIFS(${ABA_LEADS}!L2:L;"Pago";${ABA_LEADS}!M2:M;"pix")`);
  sh.getRange(linhaFormas + 2, 1).setValue("Cartão à vista:").setFontColor(COR_NAVY).setFontWeight("bold").setFontSize(10);
  sh.getRange(linhaFormas + 2, 2).setFormula(`=COUNTIFS(${ABA_LEADS}!L2:L;"Pago";${ABA_LEADS}!M2:M;"credit_card";${ABA_LEADS}!N2:N;1)`);
  sh.getRange(linhaFormas + 3, 1).setValue("Cartão parcelado:").setFontColor(COR_NAVY).setFontWeight("bold").setFontSize(10);
  sh.getRange(linhaFormas + 3, 2).setFormula(`=COUNTIFS(${ABA_LEADS}!L2:L;"Pago";${ABA_LEADS}!M2:M;"credit_card";${ABA_LEADS}!N2:N;"<>1")`);
  [1, 2, 3].forEach((i) => {
    estilizarValorDestaque(sh.getRange(linhaFormas + i, 2), COR_ACCENT_LIGHT, COR_NAVY, 11);
  });

  sh.setColumnWidth(1, 260);
  sh.autoResizeColumns(2, 5);
}

// nomes de aba no Sheets têm limite de 100 caracteres
function nomeAbaProduto(produto) {
  return produto.length > 95 ? produto.slice(0, 95) : produto;
}

function nomeAbaAguardando(produto) {
  const sufixo = " - Aguardando";
  const base = produto.length > 95 - sufixo.length ? produto.slice(0, 95 - sufixo.length) : produto;
  return base + sufixo;
}

function criarAbaProduto(ss, produto) {
  const nomeAba = nomeAbaProduto(produto);
  let sh = ss.getSheetByName(nomeAba);
  if (!sh) sh = ss.insertSheet(nomeAba);
  sh.clear();
  limparBandings(sh);
  sh.setTabColor(COR_TAB_APROVADOS);

  estilizarBanner(sh, produto + " — Aprovados", 15);

  sh.getRange("A3").setValue("Aprovados (pagamento confirmado):").setFontColor(COR_NAVY).setFontWeight("bold").setFontSize(11);
  estilizarValorDestaque(
    sh.getRange("B3").setFormula(`=COUNTIFS(${ABA_LEADS}!J2:J;"${produto}";${ABA_LEADS}!L2:L;"Pago")`),
    COR_BADGE_VERDE_BG, COR_BADGE_VERDE_TXT, 12
  );
  sh.setRowHeight(3, 26);

  estilizarCabecalhoTabela(sh.getRange(5, 1, 1, 18));
  sh.getRange("A5").setFormula(
    `=IFERROR(QUERY(${ABA_LEADS}!A1:Y; "select A,B,C,D,E,F,G,H,I,M,N,O,P,U,V,W,X,Y where J = '${produto}' and L = 'Pago' order by B desc"; 1); "Nenhum pagamento confirmado ainda.")`
  );
  sh.setFrozenRows(5);
  aplicarZebra(sh, sh.getRange(6, 1, 1994, 18));

  // QUERY não herda o formato de data da aba Leads -- força aqui também
  // (coluna 2 = Data/Hora, coluna 13 = Data Pagamento, pela ordem do select acima, já com o ID na frente)
  sh.getRange(6, 2, 1994, 1).setNumberFormat("dd/mm/yyyy hh:mm:ss");
  sh.getRange(6, 13, 1994, 1).setNumberFormat("dd/mm/yyyy hh:mm:ss");

  // coluna "Observações", editável -- não faz parte do QUERY acima (que não
  // aceita edição em cima), fica numa coluna própria (O), uma de respiro (N)
  // depois da listagem. Cada célula nasce com uma fórmula que busca o texto
  // salvo na Leads pelo ID do lead daquela linha (coluna A); ao editar,
  // onEdit() grava o texto na Leads e devolve a fórmula pra célula (ver
  // sincronizarObservacaoDaLinha()).
  sh.getRange(5, COL_OBSERVACOES_APROVADOS).setValue("Observações");
  estilizarCabecalhoTabela(sh.getRange(5, COL_OBSERVACOES_APROVADOS, 1, 1));
  const formulasObsAprovados = [];
  for (let i = 0; i < QTD_LINHAS_OBSERVACOES_APROVADOS; i++) {
    const linha = LINHA_INICIO_LISTA_AGUARDANDO + i;
    formulasObsAprovados.push([`=IFERROR(VLOOKUP($A${linha};${ABA_LEADS}!$A:$T;20;FALSE);"")`]);
  }
  sh.getRange(LINHA_INICIO_LISTA_AGUARDANDO, COL_OBSERVACOES_APROVADOS, QTD_LINHAS_OBSERVACOES_APROVADOS, 1)
    .setFormulas(formulasObsAprovados)
    .setWrap(true)
    .setVerticalAlignment("top");
  sh.setColumnWidth(COL_OBSERVACOES_APROVADOS, 260);

  sh.autoResizeColumns(1, 18);
}

function criarAbaAguardando(ss, produto) {
  const nomeAba = nomeAbaAguardando(produto);
  let sh = ss.getSheetByName(nomeAba);
  if (!sh) sh = ss.insertSheet(nomeAba);
  sh.clear();
  limparBandings(sh);
  sh.setTabColor(COR_TAB_AGUARDANDO);

  estilizarBanner(sh, produto + " — Aguardando pagamento", 17);

  sh.getRange("A3").setValue("Aguardando pagamento:").setFontColor(COR_NAVY).setFontWeight("bold").setFontSize(11);
  estilizarValorDestaque(
    sh.getRange("B3").setFormula(`=COUNTIFS(${ABA_LEADS}!J2:J;"${produto}";${ABA_LEADS}!L2:L;"Aguardando pagamento")`),
    COR_BADGE_AMBAR_BG, COR_BADGE_AMBAR_TXT, 12
  );
  sh.setRowHeight(3, 26);

  estilizarCabecalhoTabela(sh.getRange(5, 1, 1, 18));
  sh.getRange("A5").setFormula(
    `=IFERROR(QUERY(${ABA_LEADS}!A1:Y; "select A,B,C,D,E,F,G,H,I,M,N,O,P,U,V,W,X,Y where J = '${produto}' and L = 'Aguardando pagamento' order by B desc"; 1); "Ninguém aguardando pagamento no momento.")`
  );
  sh.setFrozenRows(5);
  aplicarZebra(sh, sh.getRange(6, 1, 1994, 18));

  // QUERY não herda o formato de data da aba Leads -- força aqui também
  // (coluna 2 = Data/Hora, coluna 13 = Data Pagamento, pela ordem do select acima)
  sh.getRange(6, 2, 1994, 1).setNumberFormat("dd/mm/yyyy hh:mm:ss");
  sh.getRange(6, 13, 1994, 1).setNumberFormat("dd/mm/yyyy hh:mm:ss");

  // botão "Aprovar" -- marcar a caixa nesta linha move aquele lead pra
  // "Pago" na hora (ver onEdit()). Continua funcionando mesmo quando a
  // lista acima muda de tamanho, porque identifica o lead pelo ID (coluna
  // A), não pela posição da linha. Cor de destaque (accent) pra parecer
  // um botão de ação, diferente dos cabeçalhos informativos (navy).
  sh.getRange(5, COL_APROVAR_AGUARDANDO).setValue("Aprovar")
    .setFontWeight("bold")
    .setBackground(COR_ACCENT)
    .setFontColor(COR_NAVY)
    .setHorizontalAlignment("center");
  sh.getRange(LINHA_INICIO_LISTA_AGUARDANDO, COL_APROVAR_AGUARDANDO, QTD_LINHAS_APROVAR_AGUARDANDO, 1)
    .insertCheckboxes();

  // coluna "Observações", editável -- mesma lógica da aba "Aprovados" (ver
  // comentário lá): fórmula VLOOKUP por ID, sobrescrita ao editar e depois
  // devolvida pelo onEdit(), pra sempre acompanhar o lead certo mesmo com a
  // lista se reorganizando.
  sh.getRange(5, COL_OBSERVACOES_AGUARDANDO).setValue("Observações");
  estilizarCabecalhoTabela(sh.getRange(5, COL_OBSERVACOES_AGUARDANDO, 1, 1));
  const formulasObsAguardando = [];
  for (let i = 0; i < QTD_LINHAS_OBSERVACOES_AGUARDANDO; i++) {
    const linha = LINHA_INICIO_LISTA_AGUARDANDO + i;
    formulasObsAguardando.push([`=IFERROR(VLOOKUP($A${linha};${ABA_LEADS}!$A:$T;20;FALSE);"")`]);
  }
  sh.getRange(LINHA_INICIO_LISTA_AGUARDANDO, COL_OBSERVACOES_AGUARDANDO, QTD_LINHAS_OBSERVACOES_AGUARDANDO, 1)
    .setFormulas(formulasObsAguardando)
    .setWrap(true)
    .setVerticalAlignment("top");
  sh.setColumnWidth(COL_OBSERVACOES_AGUARDANDO, 260);

  sh.autoResizeColumns(1, 20);
}

// condição (linguagem de consulta do QUERY) que pega todo lead cujo Plano
// (coluna J) não é nenhum dos nomes cadastrados em PRODUTOS -- usada pelas
// duas abas "Outros Produtos" abaixo. Exclui também J vazio (linhas de
// pagamento avulso sem correspondência, ver registrarPagamento(), que não
// têm Plano nem os outros dados do lead preenchidos).
function condicaoOutrosProdutos() {
  return ["J != ''"].concat(PRODUTOS.map((p) => `J != '${p}'`)).join(" and ");
}

// mesma lógica que condicaoOutrosProdutos(), só que como critérios de
// COUNTIFS (pro badge de contagem no topo das abas "Outros Produtos"),
// em vez de "where" do QUERY.
function formulaContagemOutros(statusTexto) {
  const criteriosProdutos = PRODUTOS.map((p) => `${ABA_LEADS}!J2:J;"<>${p}"`).join(";");
  return `=COUNTIFS(${ABA_LEADS}!J2:J;"<>";${criteriosProdutos};${ABA_LEADS}!L2:L;"${statusTexto}")`;
}

// aba única (não uma por produto) que junta TODO lead de produto fora da
// lista PRODUTOS -- hoje, na prática, os leads do formulário de cadastro
// personalizado (site/cadastro.html, ver registrarCadastroPersonalizado()).
// A listagem em si (via QUERY) é igual à de criarAbaProduto() -- SEM a
// coluna J/Plano, porque essa QUERY preenche um array de fórmulas que não
// aceita edição em cima. A coluna "Produto" fica separada (ver comentário
// em COL_PRODUTO_OUTROS_APROVADOS, no topo do script), EDITÁVEL, pra dar
// pra reclassificar o lead pra um produto de PRODUTOS só digitando ali.
function criarAbaOutrosProdutos(ss) {
  let sh = ss.getSheetByName(ABA_OUTROS_PRODUTOS);
  if (!sh) sh = ss.insertSheet(ABA_OUTROS_PRODUTOS);
  sh.clear();
  // sh.clear() nem sempre remove validação de dados (ex: checkboxes
  // inseridos por insertCheckboxes()) -- sem isso, um checkbox que ficava
  // numa coluna antiga (de uma versão anterior do layout desta aba) some do
  // conteúdo mas continua "grudado" na célula depois de reconstruída.
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations();
  limparBandings(sh);
  sh.setTabColor(COR_TAB_APROVADOS);

  estilizarBanner(sh, "Outros Produtos — Aprovados", 17);

  sh.getRange("A3").setValue("Aprovados (pagamento confirmado):").setFontColor(COR_NAVY).setFontWeight("bold").setFontSize(11);
  estilizarValorDestaque(
    sh.getRange("B3").setFormula(formulaContagemOutros("Pago")),
    COR_BADGE_VERDE_BG, COR_BADGE_VERDE_TXT, 12
  );
  sh.setRowHeight(3, 26);

  estilizarCabecalhoTabela(sh.getRange(5, 1, 1, 18));
  sh.getRange("A5").setFormula(
    `=IFERROR(QUERY(${ABA_LEADS}!A1:Y; "select A,B,C,D,E,F,G,H,I,M,N,O,P,U,V,W,X,Y where ${condicaoOutrosProdutos()} and L = 'Pago' order by B desc"; 1); "Nenhum pagamento confirmado ainda.")`
  );
  sh.setFrozenRows(5);
  aplicarZebra(sh, sh.getRange(6, 1, 1994, 18));

  // QUERY não herda o formato de data da aba Leads -- força aqui também
  // (coluna 2 = Data/Hora, coluna 13 = Data Pagamento, pela ordem do select acima)
  sh.getRange(6, 2, 1994, 1).setNumberFormat("dd/mm/yyyy hh:mm:ss");
  sh.getRange(6, 13, 1994, 1).setNumberFormat("dd/mm/yyyy hh:mm:ss");

  // coluna "Produto", editável -- mesma técnica da Observações (fórmula
  // VLOOKUP por ID, sobrescrita ao editar e devolvida por onEdit(), ver
  // sincronizarProdutoDaLinha()), só que aponta pra coluna J (Plano) da
  // Leads em vez da T (Observações). Editar aqui MOVE o lead pra fora
  // dessa aba assim que o texto bater com um nome de PRODUTOS.
  sh.getRange(5, COL_PRODUTO_OUTROS_APROVADOS).setValue("Produto");
  estilizarCabecalhoTabela(sh.getRange(5, COL_PRODUTO_OUTROS_APROVADOS, 1, 1));
  const formulasProdutoAprovados = [];
  for (let i = 0; i < QTD_LINHAS_OBSERVACOES_APROVADOS; i++) {
    const linha = LINHA_INICIO_LISTA_AGUARDANDO + i;
    formulasProdutoAprovados.push([`=IFERROR(VLOOKUP($A${linha};${ABA_LEADS}!$A:$T;10;FALSE);"")`]);
  }
  sh.getRange(LINHA_INICIO_LISTA_AGUARDANDO, COL_PRODUTO_OUTROS_APROVADOS, QTD_LINHAS_OBSERVACOES_APROVADOS, 1)
    .setFormulas(formulasProdutoAprovados)
    .setWrap(true)
    .setVerticalAlignment("top");
  sh.setColumnWidth(COL_PRODUTO_OUTROS_APROVADOS, 260);

  // coluna "Observações", editável -- mesma lógica das abas por produto
  // (ver comentário em criarAbaProduto()).
  sh.getRange(5, COL_OBSERVACOES_OUTROS_APROVADOS).setValue("Observações");
  estilizarCabecalhoTabela(sh.getRange(5, COL_OBSERVACOES_OUTROS_APROVADOS, 1, 1));
  const formulasObsOutrosAprovados = [];
  for (let i = 0; i < QTD_LINHAS_OBSERVACOES_APROVADOS; i++) {
    const linha = LINHA_INICIO_LISTA_AGUARDANDO + i;
    formulasObsOutrosAprovados.push([`=IFERROR(VLOOKUP($A${linha};${ABA_LEADS}!$A:$T;20;FALSE);"")`]);
  }
  sh.getRange(LINHA_INICIO_LISTA_AGUARDANDO, COL_OBSERVACOES_OUTROS_APROVADOS, QTD_LINHAS_OBSERVACOES_APROVADOS, 1)
    .setFormulas(formulasObsOutrosAprovados)
    .setWrap(true)
    .setVerticalAlignment("top");
  sh.setColumnWidth(COL_OBSERVACOES_OUTROS_APROVADOS, 260);

  sh.autoResizeColumns(1, 18);
}

// par "- Aguardando" da aba acima -- mesmo raciocínio de
// criarAbaAguardando(), com botão "Aprovar" (ver onEdit()) e coluna
// "Produto" editável (ver comentário em criarAbaOutrosProdutos()), só que
// juntando todo produto fora de PRODUTOS em vez de um produto só.
function criarAbaOutrosProdutosAguardando(ss) {
  let sh = ss.getSheetByName(ABA_OUTROS_PRODUTOS_AGUARDANDO);
  if (!sh) sh = ss.insertSheet(ABA_OUTROS_PRODUTOS_AGUARDANDO);
  sh.clear();
  // ver comentário equivalente em criarAbaOutrosProdutos() -- sem isso, o
  // checkbox "Aprovar" que ficava na coluna P numa versão anterior deste
  // layout (antes da coluna "Produto" ser adicionada) continua ali mesmo
  // depois da aba reconstruída, já que sh.clear() sozinho não é confiável
  // pra remover validação de dados.
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations();
  limparBandings(sh);
  sh.setTabColor(COR_TAB_AGUARDANDO);

  estilizarBanner(sh, "Outros Produtos — Aguardando pagamento", 19);

  sh.getRange("A3").setValue("Aguardando pagamento:").setFontColor(COR_NAVY).setFontWeight("bold").setFontSize(11);
  estilizarValorDestaque(
    sh.getRange("B3").setFormula(formulaContagemOutros("Aguardando pagamento")),
    COR_BADGE_AMBAR_BG, COR_BADGE_AMBAR_TXT, 12
  );
  sh.setRowHeight(3, 26);

  estilizarCabecalhoTabela(sh.getRange(5, 1, 1, 18));
  sh.getRange("A5").setFormula(
    `=IFERROR(QUERY(${ABA_LEADS}!A1:Y; "select A,B,C,D,E,F,G,H,I,M,N,O,P,U,V,W,X,Y where ${condicaoOutrosProdutos()} and L = 'Aguardando pagamento' order by B desc"; 1); "Ninguém aguardando pagamento no momento.")`
  );
  sh.setFrozenRows(5);
  aplicarZebra(sh, sh.getRange(6, 1, 1994, 18));

  sh.getRange(6, 2, 1994, 1).setNumberFormat("dd/mm/yyyy hh:mm:ss");
  sh.getRange(6, 13, 1994, 1).setNumberFormat("dd/mm/yyyy hh:mm:ss");

  // coluna "Produto", editável -- ver comentário em criarAbaOutrosProdutos().
  sh.getRange(5, COL_PRODUTO_OUTROS_AGUARDANDO).setValue("Produto");
  estilizarCabecalhoTabela(sh.getRange(5, COL_PRODUTO_OUTROS_AGUARDANDO, 1, 1));
  const formulasProdutoAguardando = [];
  for (let i = 0; i < QTD_LINHAS_OBSERVACOES_AGUARDANDO; i++) {
    const linha = LINHA_INICIO_LISTA_AGUARDANDO + i;
    formulasProdutoAguardando.push([`=IFERROR(VLOOKUP($A${linha};${ABA_LEADS}!$A:$T;10;FALSE);"")`]);
  }
  sh.getRange(LINHA_INICIO_LISTA_AGUARDANDO, COL_PRODUTO_OUTROS_AGUARDANDO, QTD_LINHAS_OBSERVACOES_AGUARDANDO, 1)
    .setFormulas(formulasProdutoAguardando)
    .setWrap(true)
    .setVerticalAlignment("top");
  sh.setColumnWidth(COL_PRODUTO_OUTROS_AGUARDANDO, 260);

  // botão "Aprovar" -- mesma lógica de criarAbaAguardando(): identifica o
  // lead pelo ID (coluna A), não pela posição da linha (ver onEdit()).
  sh.getRange(5, COL_APROVAR_OUTROS_AGUARDANDO).setValue("Aprovar")
    .setFontWeight("bold")
    .setBackground(COR_ACCENT)
    .setFontColor(COR_NAVY)
    .setHorizontalAlignment("center");
  sh.getRange(LINHA_INICIO_LISTA_AGUARDANDO, COL_APROVAR_OUTROS_AGUARDANDO, QTD_LINHAS_APROVAR_AGUARDANDO, 1)
    .insertCheckboxes();

  sh.getRange(5, COL_OBSERVACOES_OUTROS_AGUARDANDO).setValue("Observações");
  estilizarCabecalhoTabela(sh.getRange(5, COL_OBSERVACOES_OUTROS_AGUARDANDO, 1, 1));
  const formulasObsOutrosAguardando = [];
  for (let i = 0; i < QTD_LINHAS_OBSERVACOES_AGUARDANDO; i++) {
    const linha = LINHA_INICIO_LISTA_AGUARDANDO + i;
    formulasObsOutrosAguardando.push([`=IFERROR(VLOOKUP($A${linha};${ABA_LEADS}!$A:$T;20;FALSE);"")`]);
  }
  sh.getRange(LINHA_INICIO_LISTA_AGUARDANDO, COL_OBSERVACOES_OUTROS_AGUARDANDO, QTD_LINHAS_OBSERVACOES_AGUARDANDO, 1)
    .setFormulas(formulasObsOutrosAguardando)
    .setWrap(true)
    .setVerticalAlignment("top");
  sh.setColumnWidth(COL_OBSERVACOES_OUTROS_AGUARDANDO, 260);

  sh.autoResizeColumns(1, 22);
}

function criarAbaInstrucoes(ss) {
  let sh = ss.getSheetByName(ABA_INSTRUCOES);
  if (!sh) sh = ss.insertSheet(ABA_INSTRUCOES);
  sh.clear();
  sh.setTabColor(COR_MUTED);
  sh.setHiddenGridlines(true);

  const linhas = [
    ["", ""],
    ["", ""],
    ["O que é cada aba", ""],
    ["Leads", "Uma linha por formulário preenchido em comprar.html. Preenchida automaticamente pelo webhook do site. Não edite manualmente."],
    ["Painel", "Resumo geral (totais e contagem rápida por produto) calculado a partir da aba Leads. Não edite manualmente."],
    ["Duas abas por produto", "Cada produto listado em PRODUTOS (no topo do script) ganha DUAS abas separadas: uma só com quem já teve o pagamento aprovado, e outra (com o sufixo ' - Aguardando') só com quem ainda está aguardando pagamento. Os dados vêm da aba Leads e não são editáveis nessas abas -- EXCETO a coluna 'Observações', que é editável ali também (ver mais abaixo)."],
    ["Para adicionar um produto novo:", "Adicione o mesmo nome do plano em dois lugares -- em PLANOS (site/js/comprar.js) e em PRODUTOS (google-apps-script-planilha-setup.gs) -- e rode a função setupPlanilha() de novo. Isso cria as duas abas do produto novo sem apagar as dos produtos já existentes."],
    ["", ""],
    ["Como funciona o preenchimento automático", ""],
    ["1.", "O aluno preenche o formulário em comprar.html e clica em 'Continuar para o pagamento'."],
    ["2.", "O site envia os dados para este Apps Script (via APPS_SCRIPT_URL em js/comprar.js), que grava uma linha nova na aba Leads com Status Pagamento = 'Aguardando pagamento'."],
    ["3.", "O aluno é redirecionado para o link de checkout da InfinitePay correspondente ao plano escolhido."],
    ["", ""],
    ["Webhook de pagamento (status 'Pago' automático)", ""],
    ["Como funciona hoje:", "Cada pedido gera um link de pagamento EXCLUSIVO na InfinitePay (via API, chamada pelo Apps Script), com um order_nsu = ID daquele lead. Quando o aluno paga, a InfinitePay avisa este mesmo Apps Script (webhook) devolvendo esse order_nsu, e o Status Pagamento muda pra 'Pago' automaticamente, casando com o lead certo com certeza -- não depende mais de adivinhar por valor/horário."],
    ["Configuração necessária na InfinitePay:", "Precisa ter o 'Checkout Integrado' habilitado na conta (Vendas -> Checkout). O handle, o preço de cada plano (PRECOS_CENTAVOS) e o endereço da API (INFINITEPAY_LINKS_URL) ficam configurados no topo deste script -- ajuste ali se algo mudar."],
    ["Se a chamada à InfinitePay falhar:", "O lead ainda é registrado normalmente como 'Aguardando pagamento' (a venda nunca trava), mas sem order_nsu -- nesse caso o botão manual 'Aprovar' (nas abas '- Aguardando') ou o checkbox 'Marcar como Pago' (na Leads) resolvem."],
    ["", ""],
    ["Colunas da aba Leads", ""],
    ["ID", "Código único gerado automaticamente para cada envio do formulário."],
    ["Categoria", "Calculada automaticamente a partir do texto do Plano (Expresso/Premium/Outro) -- não editar."],
    ["Status Pagamento", "Aguardando pagamento / Pago / Recusado / Cancelado. Editável manualmente se precisar corrigir."],
    ["Marcar como Pago (checkbox)", "O BOTÃO MANUAL: marque essa caixa em qualquer linha pra mover aquele lead direto pra 'Pago' -- ele some da aba '- Aguardando' e aparece na aba de aprovados do produto na hora, sem precisar mexer no Status Pagamento."],
    ["Forma de Pagamento, Parcelas, Valor Pago, Data Pagamento, ID da Transação, Recibo", "Preenchidos automaticamente pelo webhook de pagamento, quando disponível."],
    ["Observações", "Campo de texto livre pra anotar detalhes da venda (forma combinada, condição especial, combinado por WhatsApp etc.). Editável em QUALQUER lugar onde o lead aparece: na própria Leads, no formulário 'Adicionar Lead Manual', ou direto nas abas 'Aprovados'/'Aguardando' daquele produto -- editar em qualquer um desses lugares atualiza os outros automaticamente (o texto é sempre gravado na Leads, que é a fonte real do dado, e as outras abas só espelham ela)."],
    ["Turma, Horário de Preferência, Ator Responsável, Vendedor, Desconto", "Campos internos da equipe, opcionais -- não vêm do formulário público do site, só são preenchidos manualmente na própria Leads ou no formulário 'Adicionar Lead Manual'. Também aparecem (visíveis, mas não editáveis ali) nas abas 'Aprovados'/'Aguardando' de cada produto."],
    ["", ""],
    ["Formulário de cadastro personalizado (site/cadastro.html)", "Pra pedidos sem preço fixo (o cliente descreve em texto livre qual produto quer, no lugar de escolher um Plano da lista). Grava o lead na Leads como 'Aguardando pagamento', com Plano e Categoria SEMPRE 'Outros Produtos' (a descrição que o cliente realmente digitou vai pras Observações, não pra coluna Plano -- ver comentário em registrarCadastroPersonalizado() no script). NÃO gera link de pagamento automático pela InfinitePay -- o time manda manualmente um link de desconto pro cliente e confirma o pagamento depois (botão 'Aprovar' na aba 'Outros Produtos - Aguardando', ou o checkbox 'Marcar como Pago' na Leads). Esses leads caem nas abas 'Outros Produtos' / 'Outros Produtos - Aguardando' (ver item abaixo)."],
    ["Abas 'Outros Produtos' / 'Outros Produtos - Aguardando'", "Igual às duas abas por produto (ver item acima), mas juntam TODO lead cujo Plano não é nenhum dos nomes cadastrados em PRODUTOS -- na prática, os leads do formulário de cadastro personalizado, que sempre entram com Plano = 'Outros Produtos'. Têm uma coluna 'Produto' A MAIS, EDITÁVEL, que espelha a coluna Plano da Leads: pra reclassificar um lead pra um produto específico (ex: o cliente decidiu por 'Premium'), edite o texto dessa coluna com o nome EXATO do produto (a coluna Plano da aba Leads tem um menu suspenso com os nomes certos -- incluindo 'Outros Produtos', pra mandar um lead de volta pra cá -- pra evitar erro de digitação) -- o lead sai dessas abas e aparece na aba daquele produto na próxima atualização. A descrição real que o cliente pediu fica na coluna 'Observações' ao lado, editável também. Mesmo botão 'Aprovar' das abas por produto."],
  ];

  sh.getRange(1, 1, linhas.length, 2).setValues(linhas);
  sh.getRange(4, 1, linhas.length - 3, 2).setFontColor(COR_NAVY).setFontSize(10);
  estilizarBanner(sh, "INSTRUÇÕES — Planilha de Leads/Pagamentos da CRM na Mão", 2);
  estilizarSecao(sh, 3, "O que é cada aba", 2);
  estilizarSecao(sh, 9, "Como funciona o preenchimento automático", 2);
  estilizarSecao(sh, 14, "Webhook de pagamento (status 'Pago' automático)", 2);
  estilizarSecao(sh, 19, "Colunas da aba Leads", 2);
  sh.setColumnWidth(1, 260);
  sh.setColumnWidth(2, 700);
  sh.getRange(1, 1, linhas.length, 2).setWrap(true);
  sh.getRange(1, 1, linhas.length, 2).setVerticalAlignment("top");
}

// ============================================================
// DASHBOARD -- estatísticas de vendas por produto, linha do tempo
// (diária/semanal/mensal) e gráficos. As tabelas de apoio dos gráficos
// ficam numa aba oculta separada (ABA_DADOS_GRAFICOS) pra não poluir a
// visão do Dashboard; tudo calculado por fórmula em cima da aba Leads,
// então atualiza sozinho conforme novos leads/pagamentos chegam.
// ============================================================

// monta um bloco de vendas agregadas por período (dia/semana/mês) na aba
// de apoio: uma linha por período, com contagem e valor vendido (Pago)
// de cada produto, mais os totais. calcularInicio(i) e calcularFim(linha)
// são funções que devolvem o texto da fórmula da data de início/fim de
// cada período -- assim a mesma função serve pra diário, semanal e mensal.
function preencherBlocoTemporal(sh, linhaTitulo, numPeriodos, calcularInicio, calcularFim, titulo, formatoData) {
  const linhaCabecalho = linhaTitulo + 1;
  const linhaDados = linhaCabecalho + 1;
  const numColunas = 1 + PRODUTOS.length * 2 + 2;

  sh.getRange(linhaTitulo, 1, 1, numColunas).merge()
    .setValue(titulo)
    .setBackground(COR_NAVY)
    .setFontColor(COR_BRANCO)
    .setFontWeight("bold")
    .setFontSize(12)
    .setVerticalAlignment("middle");
  sh.setRowHeight(linhaTitulo, 28);

  const cabecalhos = ["Período"];
  PRODUTOS.forEach((p) => cabecalhos.push("Vendas " + p, "Valor " + p));
  cabecalhos.push("Total Vendas", "Total Valor (R$)");
  sh.getRange(linhaCabecalho, 1, 1, numColunas).setValues([cabecalhos]);
  estilizarCabecalhoTabela(sh.getRange(linhaCabecalho, 1, 1, numColunas));

  const colTotalVendas = numColunas - 1;
  const colTotalValor = numColunas;

  for (let i = 0; i < numPeriodos; i++) {
    const linha = linhaDados + i;
    sh.getRange(linha, 1).setFormula(calcularInicio(i)).setNumberFormat(formatoData);
    const fim = calcularFim(linha);
    const letrasVendas = [];
    const letrasValor = [];
    PRODUTOS.forEach((produto, j) => {
      const colVendas = 2 + j * 2;
      const colValor = 3 + j * 2;
      sh.getRange(linha, colVendas).setFormula(
        `=COUNTIFS(${ABA_LEADS}!$J$2:$J;"${produto}";${ABA_LEADS}!$L$2:$L;"Pago";${ABA_LEADS}!$P$2:$P;">="&A${linha};${ABA_LEADS}!$P$2:$P;"<"&(${fim}))`
      );
      sh.getRange(linha, colValor).setFormula(
        `=SUMIFS(${ABA_LEADS}!$O$2:$O;${ABA_LEADS}!$J$2:$J;"${produto}";${ABA_LEADS}!$L$2:$L;"Pago";${ABA_LEADS}!$P$2:$P;">="&A${linha};${ABA_LEADS}!$P$2:$P;"<"&(${fim}))`
      );
      letrasVendas.push(colLetra(colVendas) + linha);
      letrasValor.push(colLetra(colValor) + linha);
    });
    sh.getRange(linha, colTotalVendas).setFormula(`=${letrasVendas.join("+")}`);
    sh.getRange(linha, colTotalValor).setFormula(`=${letrasValor.join("+")}`);
  }

  aplicarZebra(sh, sh.getRange(linhaDados, 1, numPeriodos, numColunas));

  return { linhaTitulo, linhaCabecalho, linhaDados, numColunas, colTotalVendas, colTotalValor };
}

// conta quantas linhas de dado um bloco QUERY realmente preencheu abaixo
// do cabeçalho (o resultado do QUERY sempre vem contíguo, sem buracos, então
// para no primeiro vazio). Devolve 0 se o QUERY caiu no fallback do
// IFERROR (nenhum dado ainda) -- usado pra NÃO mandar linhas em branco
// pros gráficos de País/Estado, que têm tamanho variável (diferente dos
// blocos temporais, que sempre têm um número fixo de períodos).
function contarLinhasPreenchidas(sh, linhaCabecalho, maxLinhas, textoFallback) {
  SpreadsheetApp.flush();
  const cabecalho = sh.getRange(linhaCabecalho, 1).getValue();
  if (String(cabecalho).indexOf(textoFallback) !== -1) return 0;
  const valores = sh.getRange(linhaCabecalho + 1, 1, maxLinhas, 1).getValues();
  let total = 0;
  for (let i = 0; i < valores.length; i++) {
    if (valores[i][0] === "" || valores[i][0] === null) break;
    total++;
  }
  return total;
}

// aba oculta só com as tabelas de apoio dos gráficos do Dashboard --
// não deve ser editada manualmente, por isso fica escondida.
function criarAbaDadosGraficos(ss) {
  let sh = ss.getSheetByName(ABA_DADOS_GRAFICOS);
  if (!sh) sh = ss.insertSheet(ABA_DADOS_GRAFICOS);
  sh.showSheet();
  sh.clear();
  limparBandings(sh);

  preencherBlocoTemporal(
    sh, 1, 30,
    (i) => `=TODAY()-${29 - i}`,
    (linha) => `(A${linha}+1)`,
    "Vendas diárias (últimos 30 dias)",
    "dd/mm"
  );

  preencherBlocoTemporal(
    sh, 35, 12,
    (i) => `=TODAY()-WEEKDAY(TODAY();3)-7*${11 - i}`,
    (linha) => `(A${linha}+7)`,
    "Vendas semanais (últimas 12 semanas, início na segunda-feira)",
    "dd/mm"
  );

  preencherBlocoTemporal(
    sh, 51, 12,
    (i) => `=EDATE(DATE(YEAR(TODAY());MONTH(TODAY());1);-${11 - i})`,
    (linha) => `EDATE(A${linha};1)`,
    "Vendas mensais (últimos 12 meses)",
    "mmm/yyyy"
  );

  // bloco pro gráfico de pizza: valor vendido x valor pendente por produto.
  // "Valor pendente" é estimado (contagem de Aguardando x preço do plano),
  // já que o valor real só existe depois que o pagamento é confirmado.
  const linhaTituloProdutos = 67;
  const linhaCabecalhoProdutos = 68;
  const linhaDadosProdutos = 69;
  sh.getRange(linhaTituloProdutos, 1, 1, 3).merge()
    .setValue("Valor por produto (vendido x pendente)")
    .setBackground(COR_NAVY)
    .setFontColor(COR_BRANCO)
    .setFontWeight("bold")
    .setFontSize(12)
    .setVerticalAlignment("middle");
  sh.setRowHeight(linhaTituloProdutos, 28);
  sh.getRange(linhaCabecalhoProdutos, 1, 1, 3).setValues([["Produto", "Valor Vendido (R$)", "Valor Pendente (R$)"]]);
  estilizarCabecalhoTabela(sh.getRange(linhaCabecalhoProdutos, 1, 1, 3));
  PRODUTOS.forEach((produto, i) => {
    const linha = linhaDadosProdutos + i;
    const precoReais = (PRECOS_CENTAVOS[produto] || 0) / 100;
    sh.getRange(linha, 1).setValue(produto);
    sh.getRange(linha, 2).setFormula(`=SUMIFS(${ABA_LEADS}!$O$2:$O;${ABA_LEADS}!$J$2:$J;"${produto}";${ABA_LEADS}!$L$2:$L;"Pago")`);
    sh.getRange(linha, 3).setFormula(`=COUNTIFS(${ABA_LEADS}!$J$2:$J;"${produto}";${ABA_LEADS}!$L$2:$L;"Aguardando pagamento")*${precoReais}`);
  });
  aplicarZebra(sh, sh.getRange(linhaDadosProdutos, 1, PRODUTOS.length, 3));

  // ---- blocos pro mapa/ranking geográfico ----
  // País e Estado são campos de texto livre no formulário (sem dropdown
  // padronizado), então agrupamos pelo texto exatamente como foi digitado
  // -- mantém o nome bem escrito (ex: "Brasil") pro mapa reconhecer, mas
  // "Brasil" e "brasil" contam como países diferentes. Reserva 25 linhas
  // cada; o Dashboard usa só as linhas realmente preenchidas (ver
  // contarLinhasPreenchidas), pra não mandar linha em branco pro gráfico.
  const linhaTituloPais = 76;
  const linhaCabecalhoPais = 77;
  const numLinhasPais = 25;
  sh.getRange(linhaTituloPais, 1, 1, 2).merge()
    .setValue("Valor vendido por país (Pago)")
    .setBackground(COR_NAVY)
    .setFontColor(COR_BRANCO)
    .setFontWeight("bold")
    .setFontSize(12)
    .setVerticalAlignment("middle");
  sh.setRowHeight(linhaTituloPais, 28);
  sh.getRange(linhaCabecalhoPais, 1).setFormula(
    `=IFERROR(QUERY(${ABA_LEADS}!A1:S; "select G, sum(O) where L='Pago' and G<>'' group by G order by sum(O) desc"; 1); "Sem vendas com país preenchido ainda.")`
  );
  estilizarCabecalhoTabela(sh.getRange(linhaCabecalhoPais, 1, 1, 2));
  aplicarZebra(sh, sh.getRange(linhaCabecalhoPais + 1, 1, numLinhasPais, 2));

  const linhaTituloEstado = linhaTituloPais + numLinhasPais + 4;
  const linhaCabecalhoEstado = linhaTituloEstado + 1;
  const numLinhasEstado = 25;
  sh.getRange(linhaTituloEstado, 1, 1, 2).merge()
    .setValue("Valor vendido por estado (Pago)")
    .setBackground(COR_NAVY)
    .setFontColor(COR_BRANCO)
    .setFontWeight("bold")
    .setFontSize(12)
    .setVerticalAlignment("middle");
  sh.setRowHeight(linhaTituloEstado, 28);
  sh.getRange(linhaCabecalhoEstado, 1).setFormula(
    `=IFERROR(QUERY(${ABA_LEADS}!A1:S; "select F, sum(O) where L='Pago' and F<>'' group by F order by sum(O) desc"; 1); "Sem vendas com estado preenchido ainda.")`
  );
  estilizarCabecalhoTabela(sh.getRange(linhaCabecalhoEstado, 1, 1, 2));
  aplicarZebra(sh, sh.getRange(linhaCabecalhoEstado + 1, 1, numLinhasEstado, 2));

  sh.autoResizeColumns(1, 7);
  sh.hideSheet();
}

function criarAbaDashboard(ss) {
  let sh = ss.getSheetByName(ABA_DASHBOARD);
  if (!sh) sh = ss.insertSheet(ABA_DASHBOARD);
  sh.clear();
  sh.getCharts().forEach((c) => sh.removeChart(c));
  sh.setTabColor(COR_ACCENT);
  sh.setHiddenGridlines(true);

  const shDados = ss.getSheetByName(ABA_DADOS_GRAFICOS);

  estilizarBanner(sh, "📊 DASHBOARD — CRM na Mão", 16);
  sh.getRange(2, 1, 1, 16).merge()
    .setValue("Atualizado automaticamente a partir da aba Leads.")
    .setFontColor(COR_MUTED)
    .setFontStyle("italic")
    .setFontSize(10);

  // paleta usada tanto na legenda de cores quanto nos gráficos abaixo --
  // UMA cor por produto, sempre na mesma ordem de PRODUTOS, pra "verde =
  // Premium" (por exemplo) significar sempre a mesma coisa em qualquer
  // gráfico do Dashboard.
  const paletaGraficos = [COR_ACCENT, COR_NAVY, COR_BADGE_VERDE_TXT, COR_BADGE_AMBAR_TXT, COR_BADGE_VERMELHO_TXT];

  // ---- KPIs ----
  estilizarSecao(sh, 4, "📊 Visão geral", 16);

  const formulaValorPendente = "=" + PRODUTOS.map((p) => {
    const preco = (PRECOS_CENTAVOS[p] || 0) / 100;
    return `COUNTIFS(${ABA_LEADS}!$J$2:$J;"${p}";${ABA_LEADS}!$L$2:$L;"Aguardando pagamento")*${preco}`;
  }).join("+");

  const kpis = [
    {
      icone: "💰",
      titulo: "VALOR TOTAL VENDIDO",
      formula: `=SUMIF(${ABA_LEADS}!L2:L;"Pago";${ABA_LEADS}!O2:O)`,
      formato: "R$ #,##0.00",
      corFundo: COR_NAVY, corTexto: COR_BRANCO,
    },
    {
      icone: "⏳",
      titulo: "VALOR TOTAL PENDENTE",
      formula: formulaValorPendente,
      formato: "R$ #,##0.00",
      corFundo: COR_BADGE_AMBAR_BG, corTexto: COR_BADGE_AMBAR_TXT,
    },
    {
      icone: "✅",
      titulo: "VENDAS CONFIRMADAS",
      formula: `=COUNTIF(${ABA_LEADS}!L2:L;"Pago")`,
      formato: "0",
      corFundo: COR_BADGE_VERDE_BG, corTexto: COR_BADGE_VERDE_TXT,
    },
    {
      icone: "⚠️",
      titulo: "PAGAMENTOS PENDENTES",
      formula: `=COUNTIF(${ABA_LEADS}!L2:L;"Aguardando pagamento")`,
      formato: "0",
      corFundo: COR_ACCENT_LIGHT, corTexto: COR_NAVY,
    },
  ];

  const larguraCard = 4; // 3 colunas de card + 1 de respiro
  kpis.forEach((kpi, i) => {
    const colInicio = 1 + i * larguraCard;
    sh.getRange(5, colInicio, 1, 3).merge()
      .setValue(`${kpi.icone}  ${kpi.titulo}`)
      .setFontColor(COR_MUTED)
      .setFontWeight("bold")
      .setFontSize(10)
      .setHorizontalAlignment("center");
    const celulaValor = sh.getRange(6, colInicio, 1, 3).merge();
    celulaValor.setFormula(kpi.formula).setNumberFormat(kpi.formato);
    estilizarValorDestaque(celulaValor, kpi.corFundo, kpi.corTexto, 18);
  });
  sh.setRowHeight(6, 40);

  // ---- Legenda de cores ----
  // painel explícito (não depende da legenda automática do gráfico, que
  // às vezes corta nome comprido) -- um quadradinho colorido + o nome
  // completo do produto, na MESMA cor/ordem usada em todos os gráficos
  // de linha/coluna/pizza abaixo (diário, semanal, mensal, valor vendido,
  // valor pendente). 2 produtos por linha, com bastante largura pro nome
  // completo caber numa linha só, sem cortar.
  estilizarSecao(sh, 8, "🎨 Legenda de cores — produtos usados nos gráficos abaixo", 16);
  const larguraLegenda = 8; // 1 coluna de cor + 7 de texto, 2 por linha
  PRODUTOS.forEach((produto, i) => {
    const linha = 9 + Math.floor(i / 2);
    const colInicio = 1 + (i % 2) * larguraLegenda;
    sh.getRange(linha, colInicio)
      .setBackground(paletaGraficos[i] || COR_MUTED)
      .setBorder(true, true, true, true, false, false, COR_NAVY, SpreadsheetApp.BorderStyle.SOLID);
    sh.getRange(linha, colInicio + 1, 1, larguraLegenda - 1).merge()
      .setValue(produto)
      .setFontColor(COR_NAVY)
      .setFontWeight("bold")
      .setFontSize(11)
      .setVerticalAlignment("middle");
    sh.setRowHeight(linha, 26);
  });
  const linhaFimLegenda = 9 + Math.ceil(PRODUTOS.length / 2) - 1;

  // ---- Valor vendido e pendências por produto ----
  // "Valor Pendente (R$)" é uma ESTIMATIVA (quantidade de leads aguardando
  // pagamento naquele plano x preço do plano) -- mostra quanto dinheiro
  // ainda pode entrar (ou já "escapou") se esses leads não converterem.
  const linhaTituloTabelaProduto = linhaFimLegenda + 2;
  const linhaCabecalhoTabelaProduto = linhaTituloTabelaProduto + 1;
  estilizarSecao(sh, linhaTituloTabelaProduto, "💵 Valor vendido e pendências, por produto", 16);
  // Produto: colunas 1-6 | Valor Vendido: 7-10 | Pendentes (qtd): 11-13 | Valor Pendente: 14-16
  sh.getRange(linhaCabecalhoTabelaProduto, 1, 1, 6).merge().setValue("🎓 Produto");
  sh.getRange(linhaCabecalhoTabelaProduto, 7, 1, 4).merge().setValue("💵 Valor Vendido (R$)");
  sh.getRange(linhaCabecalhoTabelaProduto, 11, 1, 3).merge().setValue("⏳ Pendentes (qtd)");
  sh.getRange(linhaCabecalhoTabelaProduto, 14, 1, 3).merge().setValue("💸 Valor Pendente Estimado (R$)");
  estilizarCabecalhoTabela(sh.getRange(linhaCabecalhoTabelaProduto, 1, 1, 16));
  PRODUTOS.forEach((produto, i) => {
    const linha = linhaCabecalhoTabelaProduto + 1 + i;
    const preco = (PRECOS_CENTAVOS[produto] || 0) / 100;
    sh.getRange(linha, 1, 1, 6).merge()
      .setValue(produto)
      .setFontColor(COR_NAVY)
      .setFontWeight("bold")
      .setFontSize(11)
      .setVerticalAlignment("middle")
      .setBorder(false, true, false, false, false, false, paletaGraficos[i] || COR_MUTED, SpreadsheetApp.BorderStyle.SOLID_THICK);
    estilizarValorDestaque(
      sh.getRange(linha, 7, 1, 4).merge()
        .setFormula(`=SUMIFS(${ABA_LEADS}!O2:O;${ABA_LEADS}!J2:J;"${produto}";${ABA_LEADS}!L2:L;"Pago")`)
        .setNumberFormat("R$ #,##0.00"),
      COR_BADGE_VERDE_BG, COR_BADGE_VERDE_TXT, 12
    );
    estilizarValorDestaque(
      sh.getRange(linha, 11, 1, 3).merge()
        .setFormula(`=COUNTIFS(${ABA_LEADS}!J2:J;"${produto}";${ABA_LEADS}!L2:L;"Aguardando pagamento")`),
      COR_BADGE_AMBAR_BG, COR_BADGE_AMBAR_TXT, 12
    );
    estilizarValorDestaque(
      sh.getRange(linha, 14, 1, 3).merge()
        .setFormula(`=COUNTIFS(${ABA_LEADS}!J2:J;"${produto}";${ABA_LEADS}!L2:L;"Aguardando pagamento")*${preco}`)
        .setNumberFormat("R$ #,##0.00"),
      COR_BADGE_VERMELHO_BG, COR_BADGE_VERMELHO_TXT, 12
    );
    sh.setRowHeight(linha, 28);
  });
  const linhaFimTabelaProduto = linhaCabecalhoTabelaProduto + PRODUTOS.length;
  // linha onde a grade de gráficos começa -- calculada a partir do fim da
  // tabela acima (em vez de fixa), pra não sobrepor se a tabela crescer
  const linhaGraficos = linhaFimTabelaProduto + 3;

  // ---- Gráficos ----
  const diarioCabecalho = 2, diarioDados = 3, numPeriodosDiario = 30;
  const semanalCabecalho = 36, semanalDados = 37, numPeriodosSemanal = 12;
  const mensalCabecalho = 52, mensalDados = 53, numPeriodosMensal = 12;

  function rangeColuna(linhaCabecalho, numPeriodos, coluna) {
    return shDados.getRange(linhaCabecalho, coluna, numPeriodos + 1, 1);
  }

  // linha do tempo diária -- valor vendido por produto, últimos 30 dias
  let chartDiario = sh.newChart().asLineChart().addRange(rangeColuna(diarioCabecalho, numPeriodosDiario, 1));
  PRODUTOS.forEach((_, j) => {
    chartDiario = chartDiario.addRange(rangeColuna(diarioCabecalho, numPeriodosDiario, 3 + j * 2));
  });
  sh.insertChart(
    chartDiario
      .setOption("title", "📈 Vendas diárias por valor (últimos 30 dias)")
      .setOption("titleTextStyle", { color: COR_NAVY, fontSize: 13, bold: true })
      .setOption("legend", { position: "bottom", textStyle: { color: COR_MUTED } })
      .setOption("colors", paletaGraficos)
      .setOption("curveType", "function")
      .setOption("backgroundColor", COR_BRANCO)
      .setOption("width", 480)
      .setOption("height", 300)
      .setPosition(linhaGraficos, 1, 0, 0)
      .build()
  );

  // vendas semanais -- valor por produto, empilhado, últimas 12 semanas
  let chartSemanal = sh.newChart().asColumnChart().addRange(rangeColuna(semanalCabecalho, numPeriodosSemanal, 1));
  PRODUTOS.forEach((_, j) => {
    chartSemanal = chartSemanal.addRange(rangeColuna(semanalCabecalho, numPeriodosSemanal, 3 + j * 2));
  });
  sh.insertChart(
    chartSemanal
      .setOption("title", "📅 Vendas semanais por valor (últimas 12 semanas)")
      .setOption("titleTextStyle", { color: COR_NAVY, fontSize: 13, bold: true })
      .setOption("legend", { position: "bottom", textStyle: { color: COR_MUTED } })
      .setOption("colors", paletaGraficos)
      .setOption("isStacked", true)
      .setOption("backgroundColor", COR_BRANCO)
      .setOption("width", 480)
      .setOption("height", 300)
      .setPosition(linhaGraficos, 11, 0, 0)
      .build()
  );

  // vendas mensais -- valor por produto, empilhado, últimos 12 meses
  let chartMensal = sh.newChart().asColumnChart().addRange(rangeColuna(mensalCabecalho, numPeriodosMensal, 1));
  PRODUTOS.forEach((_, j) => {
    chartMensal = chartMensal.addRange(rangeColuna(mensalCabecalho, numPeriodosMensal, 3 + j * 2));
  });
  sh.insertChart(
    chartMensal
      .setOption("title", "🗓️ Vendas mensais por valor (últimos 12 meses)")
      .setOption("titleTextStyle", { color: COR_NAVY, fontSize: 13, bold: true })
      .setOption("legend", { position: "bottom", textStyle: { color: COR_MUTED } })
      .setOption("colors", paletaGraficos)
      .setOption("isStacked", true)
      .setOption("backgroundColor", COR_BRANCO)
      .setOption("width", 480)
      .setOption("height", 300)
      .setPosition(linhaGraficos + 17, 1, 0, 0)
      .build()
  );

  // pizzas -- valor vendido x valor pendente por produto
  const linhaCabecalhoProdutos = 68, numProdutos = PRODUTOS.length;
  const rangeProdutoNomes = shDados.getRange(linhaCabecalhoProdutos, 1, numProdutos + 1, 1);
  const rangeValorVendido = shDados.getRange(linhaCabecalhoProdutos, 2, numProdutos + 1, 1);
  const rangeValorPendente = shDados.getRange(linhaCabecalhoProdutos, 3, numProdutos + 1, 1);

  sh.insertChart(
    sh.newChart().asPieChart()
      .addRange(rangeProdutoNomes)
      .addRange(rangeValorVendido)
      .setOption("title", "🍩 Valor vendido por produto")
      .setOption("titleTextStyle", { color: COR_NAVY, fontSize: 13, bold: true })
      .setOption("legend", { position: "bottom", textStyle: { color: COR_MUTED } })
      .setOption("colors", paletaGraficos)
      .setOption("backgroundColor", COR_BRANCO)
      .setOption("pieHole", 0.45)
      .setOption("pieSliceText", "value")
      .setOption("width", 420)
      .setOption("height", 300)
      .setPosition(linhaGraficos + 17, 11, 0, 0)
      .build()
  );

  sh.insertChart(
    sh.newChart().asPieChart()
      .addRange(rangeProdutoNomes)
      .addRange(rangeValorPendente)
      .setOption("title", "🍩 Valor pendente por produto")
      .setOption("titleTextStyle", { color: COR_NAVY, fontSize: 13, bold: true })
      .setOption("legend", { position: "bottom", textStyle: { color: COR_MUTED } })
      .setOption("colors", [COR_BADGE_AMBAR_TXT, COR_BADGE_VERMELHO_TXT, COR_NAVY, COR_ACCENT, COR_BADGE_VERDE_TXT])
      .setOption("backgroundColor", COR_BRANCO)
      .setOption("pieHole", 0.45)
      .setOption("pieSliceText", "value")
      .setOption("width", 420)
      .setOption("height", 300)
      .setPosition(linhaGraficos + 34, 1, 0, 0)
      .build()
  );

  // mapa -- valor vendido por país, focado na América do Sul. País é campo
  // livre no formulário (sem dropdown padronizado), então o mapeamento
  // depende do texto digitado bater com o nome do país reconhecido pelo
  // Google (ex: "Brasil"); nomes muito fora do padrão podem não aparecer.
  // Só insere o gráfico se já existir pelo menos 1 venda com país
  // preenchido -- um GeoChart com linhas em branco no range dá erro.
  const linhaCabecalhoPais = 77, maxLinhasPais = 25;
  const numPaisPreenchidos = contarLinhasPreenchidas(shDados, linhaCabecalhoPais, maxLinhasPais, "Sem vendas com país");
  if (numPaisPreenchidos > 0) {
    const rangePaisNomes = shDados.getRange(linhaCabecalhoPais, 1, numPaisPreenchidos + 1, 1);
    const rangePaisValor = shDados.getRange(linhaCabecalhoPais, 2, numPaisPreenchidos + 1, 1);
    sh.insertChart(
      sh.newChart()
        .setChartType(Charts.ChartType.GEO)
        .addRange(rangePaisNomes)
        .addRange(rangePaisValor)
        .setOption("region", "005") // código da América do Sul
        .setOption("title", "🌎 Valor vendido por país (América do Sul)")
        .setOption("titleTextStyle", { color: COR_NAVY, fontSize: 13, bold: true })
        .setOption("colorAxis", { colors: [COR_ACCENT_LIGHT, COR_NAVY] })
        .setOption("backgroundColor", COR_BRANCO)
        .setOption("width", 480)
        .setOption("height", 320)
        .setPosition(linhaGraficos + 51, 1, 0, 0)
        .build()
    );
  }

  // ranking por estado -- um mapa de estados exigiria código ISO (ex:
  // "BR-SP"), que o campo de texto livre não garante; um ranking em
  // barras é mais confiável com o dado que realmente temos. Mesma lógica
  // de só usar as linhas realmente preenchidas.
  const linhaCabecalhoEstado = 106, maxLinhasEstado = 25;
  const numEstadoPreenchidos = contarLinhasPreenchidas(shDados, linhaCabecalhoEstado, maxLinhasEstado, "Sem vendas com estado");
  if (numEstadoPreenchidos > 0) {
    const rangeEstadoNomes = shDados.getRange(linhaCabecalhoEstado, 1, numEstadoPreenchidos + 1, 1);
    const rangeEstadoValor = shDados.getRange(linhaCabecalhoEstado, 2, numEstadoPreenchidos + 1, 1);
    sh.insertChart(
      sh.newChart().asBarChart()
        .addRange(rangeEstadoNomes)
        .addRange(rangeEstadoValor)
        .setOption("title", "📍 Valor vendido por estado")
        .setOption("titleTextStyle", { color: COR_NAVY, fontSize: 13, bold: true })
        .setOption("legend", { position: "none" })
        .setOption("colors", [COR_ACCENT])
        .setOption("backgroundColor", COR_BRANCO)
        .setOption("width", 480)
        .setOption("height", 320)
        .setPosition(linhaGraficos + 51, 11, 0, 0)
        .build()
    );
  }

  sh.setColumnWidths(1, 16, 55);
}

// ============================================================
// ADICIONAR LEAD MANUAL -- aba com um "formulário" pra cadastrar um lead
// direto na planilha (ex: cliente que pagou por fora, por PIX direto,
// WhatsApp etc.), sem precisar passar pelo site. Marcar a caixa
// "Inserir" dispara inserirLeadManual() via onEdit(), que grava o lead
// na aba Leads (como "Aguardando pagamento") e limpa o formulário.
// ============================================================
function criarAbaNovoLeadManual(ss) {
  let sh = ss.getSheetByName(ABA_NOVO_LEAD);
  if (!sh) sh = ss.insertSheet(ABA_NOVO_LEAD);
  sh.clear();
  sh.setTabColor(COR_TAB_APROVADOS);
  sh.setHiddenGridlines(true);

  estilizarBanner(sh, "Adicionar Lead Manual", 4);
  sh.getRange(2, 1, 1, 4).merge()
    .setValue("Preencha os campos abaixo, escolha a Categoria, e marque \"Inserir\" pra criar o lead na aba Leads. Ele entra como \"Aguardando pagamento\" -- use o botão \"Aprovar\" na aba do produto depois, se já estiver pago. Categoria \"Outro\" é pra um produto fora da lista de PRODUTOS (preencha a descrição no campo \"Produto personalizado\" que aparece embaixo) -- o lead cai nas abas \"Outros Produtos\".")
    .setFontColor(COR_MUTED)
    .setFontStyle("italic")
    .setFontSize(12)
    .setWrap(true);
  sh.setRowHeight(2, 48);

  const campos = [
    [LINHA_MANUAL_NOME, "Nome completo"],
    [LINHA_MANUAL_CPF, "CPF"],
    [LINHA_MANUAL_ENDERECO, "Endereço completo"],
    [LINHA_MANUAL_ESTADO, "Estado"],
    [LINHA_MANUAL_PAIS, "País"],
    [LINHA_MANUAL_WHATSAPP, "WhatsApp"],
    [LINHA_MANUAL_EMAIL, "E-mail"],
  ];
  campos.forEach(([linha, rotulo]) => {
    sh.getRange(linha, 1).setValue(rotulo).setFontColor(COR_NAVY).setFontWeight("bold").setFontSize(13);
    sh.getRange(linha, COL_MANUAL_VALOR)
      .setBackground(COR_ZEBRA)
      .setBorder(true, true, true, true, false, false, COR_BORDA, SpreadsheetApp.BorderStyle.SOLID)
      .setFontSize(13)
      .setVerticalAlignment("middle");
    sh.setRowHeight(linha, 34);
  });

  sh.getRange(LINHA_MANUAL_CATEGORIA, 1).setValue("Categoria").setFontColor(COR_NAVY).setFontWeight("bold").setFontSize(13);
  const validacaoCategoria = SpreadsheetApp.newDataValidation()
    .requireValueInList(["Expresso", "Expresso + Pense", "Premium", "Premium + Pense", "Outro"], true)
    .setAllowInvalid(false)
    .build();
  sh.getRange(LINHA_MANUAL_CATEGORIA, COL_MANUAL_VALOR).setDataValidation(validacaoCategoria).setBackground(COR_ZEBRA).setFontSize(13).setVerticalAlignment("middle");
  sh.setRowHeight(LINHA_MANUAL_CATEGORIA, 34);

  // Produto personalizado -- só preenchido (e só é usado) quando Categoria
  // = "Outro". Mesma ideia do campo livre do cadastro.html: descrição do
  // produto que não está em PRODUTOS. Vai direto pra coluna "Plano" da
  // Leads (ver inserirLeadManual()), então esse lead cai nas abas "Outros
  // Produtos" (ver condicaoOutrosProdutos()), igual um lead vindo do site.
  sh.getRange(LINHA_MANUAL_PRODUTO_PERSONALIZADO, 1).setValue("Produto personalizado (só se Categoria = Outro)").setFontColor(COR_NAVY).setFontWeight("bold").setFontSize(13);
  sh.getRange(LINHA_MANUAL_PRODUTO_PERSONALIZADO, COL_MANUAL_VALOR)
    .setBackground(COR_ZEBRA)
    .setBorder(true, true, true, true, false, false, COR_BORDA, SpreadsheetApp.BorderStyle.SOLID)
    .setFontSize(13)
    .setWrap(true)
    .setVerticalAlignment("top");
  sh.setRowHeight(LINHA_MANUAL_PRODUTO_PERSONALIZADO, 48);

  // Observações -- campo opcional (não entra na validação de "faltou
  // preencher" de inserirLeadManual), pra anotar detalhes da venda (forma
  // combinada, condição especial etc.). Vai junto pra aba Leads e, dali,
  // também aparece (editável) nas abas Aprovados/Aguardando do produto.
  sh.getRange(LINHA_MANUAL_OBSERVACOES, 1).setValue("Observações (opcional)").setFontColor(COR_NAVY).setFontWeight("bold").setFontSize(13);
  sh.getRange(LINHA_MANUAL_OBSERVACOES, COL_MANUAL_VALOR)
    .setBackground(COR_ZEBRA)
    .setBorder(true, true, true, true, false, false, COR_BORDA, SpreadsheetApp.BorderStyle.SOLID)
    .setFontSize(13)
    .setWrap(true)
    .setVerticalAlignment("top");
  sh.setRowHeight(LINHA_MANUAL_OBSERVACOES, 60);

  // Campos internos da equipe (opcionais) -- mesma ideia de Observações,
  // só que cada um na sua própria coluna na Leads (COL_TURMA etc.), pra dar
  // pra filtrar/agrupar por eles depois. Vieram do controle antigo em
  // Excel (Turma, Horário, Ator responsável, Vendedor, Desconto).
  const camposInternos = [
    [LINHA_MANUAL_TURMA, "Turma (opcional)"],
    [LINHA_MANUAL_HORARIO_PREFERENCIA, "Horário de preferência (opcional)"],
    [LINHA_MANUAL_ATOR_RESPONSAVEL, "Ator responsável (opcional)"],
    [LINHA_MANUAL_VENDEDOR, "Vendedor (opcional)"],
    [LINHA_MANUAL_DESCONTO, "Desconto (opcional)"],
  ];
  camposInternos.forEach(([linha, rotulo]) => {
    sh.getRange(linha, 1).setValue(rotulo).setFontColor(COR_NAVY).setFontWeight("bold").setFontSize(13);
    sh.getRange(linha, COL_MANUAL_VALOR)
      .setBackground(COR_ZEBRA)
      .setBorder(true, true, true, true, false, false, COR_BORDA, SpreadsheetApp.BorderStyle.SOLID)
      .setFontSize(13)
      .setVerticalAlignment("middle");
    sh.setRowHeight(linha, 34);
  });

  // preview do plano final -- só informativo. Como a Categoria já usa o
  // nome EXATO de cada plano em PRODUTOS, o "Plano final" é só um espelho
  // da Categoria escolhida (sem cruzamento nenhum) -- exceto "Outro", que
  // vira ABA_OUTROS_PRODUTOS.
  sh.getRange(LINHA_MANUAL_PLANO_FINAL, 1).setValue("Plano final (automático)").setFontColor(COR_NAVY).setFontWeight("bold").setFontSize(13);
  estilizarValorDestaque(
    sh.getRange(LINHA_MANUAL_PLANO_FINAL, COL_MANUAL_VALOR).setFormula(
      `=IF(B${LINHA_MANUAL_CATEGORIA}="";"(selecione a Categoria)";` +
      `IF(B${LINHA_MANUAL_CATEGORIA}="Outro";IF(B${LINHA_MANUAL_PRODUTO_PERSONALIZADO}="";"(preencha o Produto personalizado)";"${ABA_OUTROS_PRODUTOS}");` +
      `B${LINHA_MANUAL_CATEGORIA}))`
    ),
    COR_ACCENT_LIGHT, COR_NAVY, 12
  );
  sh.setRowHeight(LINHA_MANUAL_PLANO_FINAL, 32);

  sh.getRange(LINHA_MANUAL_INSERIR, 1).setValue("Marque para inserir ➜")
    .setFontWeight("bold")
    .setFontSize(13)
    .setBackground(COR_ACCENT)
    .setFontColor(COR_NAVY)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  sh.getRange(LINHA_MANUAL_INSERIR, COL_MANUAL_VALOR).insertCheckboxes();
  sh.setRowHeight(LINHA_MANUAL_INSERIR, 36);

  sh.getRange(LINHA_MANUAL_CONFIRMACAO - 1, 1).setValue("Última confirmação").setFontColor(COR_MUTED).setFontWeight("bold").setFontSize(11);
  sh.getRange(LINHA_MANUAL_CONFIRMACAO, 1, 1, 4).merge()
    .setFontColor(COR_MUTED)
    .setFontStyle("italic")
    .setFontSize(12)
    .setWrap(true);

  sh.setColumnWidth(1, 260);
  sh.setColumnWidth(2, 460);
}

// ============================================================
// WEBHOOK -- recebe tanto o formulário de compra (comprar.html)
// quanto (se configurado) a notificação de pagamento da InfinitePay
// ============================================================

// gatilho simples do Sheets: roda sozinho toda vez que alguém edita uma
// célula na planilha. Usado por:
// 1. Checkbox "Marcar como Pago" na aba Leads (coluna S) -- marca ali direto.
// 2. Checkbox "Aprovar" em cada aba "- Aguardando" (coluna O) -- marca ali
//    perto da listagem ao vivo do produto, sem precisar abrir a aba Leads.
// 3. Coluna "Observações", editável tanto na aba Leads quanto nas abas
//    "Aprovados"/"Aguardando" de cada produto: editar na Leads já propaga
//    sozinho pras outras abas (elas leem a Leads por fórmula); editar numa
//    dessas abas grava o texto de volta na Leads pelo ID do lead (ver
//    sincronizarObservacaoDaLinha()), que é sempre a fonte real do dado.
function onEdit(e) {
  const sh = e.range.getSheet();
  const nomeAba = sh.getName();

  if (nomeAba === ABA_LEADS) {
    if (e.range.getColumn() !== COL_MARCAR_PAGO) return;
    if (e.value !== "TRUE") return;
    const linha = e.range.getRow();
    if (linha === 1) return; // cabeçalho
    aprovarLinhaLeadsPorNumeroDeLinha(sh, linha);
    return;
  }

  if (nomeAba === ABA_NOVO_LEAD) {
    if (e.range.getColumn() !== COL_MANUAL_VALOR || e.range.getRow() !== LINHA_MANUAL_INSERIR) return;
    if (e.value !== "TRUE") return;
    inserirLeadManual(sh, ss_ativa());
    return;
  }

  if (ehAbaProdutoAprovados(nomeAba)) {
    if (e.range.getColumn() !== COL_OBSERVACOES_APROVADOS) return;
    const linha = e.range.getRow();
    if (linha < LINHA_INICIO_LISTA_AGUARDANDO) return; // cabeçalho/banner
    sincronizarObservacaoDaLinha(sh, linha, COL_OBSERVACOES_APROVADOS, ss_ativa());
    return;
  }

  // aba "Outros Produtos" (não a "- Aguardando") -- checada ANTES do bloco
  // genérico de " - Aguardando" logo abaixo, porque "Outros Produtos -
  // Aguardando" também bate nesse sufixo, mas usa colunas diferentes das
  // abas por produto (ver constantes COL_*_OUTROS_* no topo do script).
  if (nomeAba === ABA_OUTROS_PRODUTOS) {
    const coluna = e.range.getColumn();
    const linha = e.range.getRow();
    if (linha < LINHA_INICIO_LISTA_AGUARDANDO) return; // cabeçalho/banner

    if (coluna === COL_PRODUTO_OUTROS_APROVADOS) {
      sincronizarProdutoDaLinha(sh, linha, COL_PRODUTO_OUTROS_APROVADOS, ss_ativa());
      return;
    }
    if (coluna === COL_OBSERVACOES_OUTROS_APROVADOS) {
      sincronizarObservacaoDaLinha(sh, linha, COL_OBSERVACOES_OUTROS_APROVADOS, ss_ativa());
      return;
    }
    return;
  }

  if (nomeAba === ABA_OUTROS_PRODUTOS_AGUARDANDO) {
    const coluna = e.range.getColumn();
    const linha = e.range.getRow();
    if (linha < LINHA_INICIO_LISTA_AGUARDANDO) return; // cabeçalho da lista

    if (coluna === COL_PRODUTO_OUTROS_AGUARDANDO) {
      sincronizarProdutoDaLinha(sh, linha, COL_PRODUTO_OUTROS_AGUARDANDO, ss_ativa());
      return;
    }

    if (coluna === COL_OBSERVACOES_OUTROS_AGUARDANDO) {
      sincronizarObservacaoDaLinha(sh, linha, COL_OBSERVACOES_OUTROS_AGUARDANDO, ss_ativa());
      return;
    }

    if (coluna !== COL_APROVAR_OUTROS_AGUARDANDO) return;
    if (e.value !== "TRUE") return;

    const id = sh.getRange(linha, 1).getValue(); // coluna A da lista = ID do lead
    if (!id) {
      e.range.setValue(false);
      return;
    }

    aprovarLeadPorId(ss_ativa(), id);

    sh.getRange(LINHA_INICIO_LISTA_AGUARDANDO, COL_APROVAR_OUTROS_AGUARDANDO, QTD_LINHAS_APROVAR_AGUARDANDO, 1)
      .setValue(false);
    return;
  }

  if (nomeAba.endsWith(" - Aguardando")) {
    const coluna = e.range.getColumn();
    const linha = e.range.getRow();
    if (linha < LINHA_INICIO_LISTA_AGUARDANDO) return; // cabeçalho da lista

    if (coluna === COL_OBSERVACOES_AGUARDANDO) {
      sincronizarObservacaoDaLinha(sh, linha, COL_OBSERVACOES_AGUARDANDO, ss_ativa());
      return;
    }

    if (coluna !== COL_APROVAR_AGUARDANDO) return;
    if (e.value !== "TRUE") return;

    const id = sh.getRange(linha, 1).getValue(); // coluna A da lista = ID do lead
    if (!id) {
      // checkbox sobrando abaixo da lista (sem lead correspondente) -- ignora
      e.range.setValue(false);
      return;
    }

    aprovarLeadPorId(ss_ativa(), id);

    // reseta TODAS as caixas dessa lista: como a lista ao vivo se reorganiza
    // assim que o lead vira "Pago" (ele sai da lista de Aguardando), manter
    // caixas marcadas em posições antigas confundiria qual linha é qual.
    sh.getRange(LINHA_INICIO_LISTA_AGUARDANDO, COL_APROVAR_AGUARDANDO, QTD_LINHAS_APROVAR_AGUARDANDO, 1)
      .setValue(false);
    return;
  }
}

// aba "Aprovados" (não "- Aguardando") de algum produto de PRODUTOS?
function ehAbaProdutoAprovados(nomeAba) {
  return PRODUTOS.some((p) => nomeAbaProduto(p) === nomeAba);
}

// lê o texto que acabou de ser digitado numa célula de Observações (nas
// abas Aprovados/Aguardando de um produto), grava esse texto na aba Leads
// pelo ID do lead daquela linha (fonte real do dado) e devolve a célula pra
// fórmula de novo -- assim ela volta a acompanhar a linha certa mesmo depois
// que a lista se reorganizar (a listagem é reordenada por data toda vez que
// um lead muda de status; ver comentário no botão "Aprovar" acima).
function sincronizarObservacaoDaLinha(sh, linha, colObservacao, ss) {
  const id = sh.getRange(linha, 1).getValue();
  if (!id) return; // linha sem lead correspondente (sobra da fórmula)

  const texto = String(sh.getRange(linha, colObservacao).getValue() || "").trim();
  const shLeads = ss.getSheetByName(ABA_LEADS);
  const linhaLeads = encontrarLinhaLeadPorId(shLeads, id);
  if (linhaLeads !== -1) {
    shLeads.getRange(linhaLeads, COL_OBSERVACOES).setValue(texto);
  }

  sh.getRange(linha, colObservacao).setFormula(
    `=IFERROR(VLOOKUP($A${linha};${ABA_LEADS}!$A:$T;20;FALSE);"")`
  );
}

// mesma ideia de sincronizarObservacaoDaLinha(), pra coluna "Produto" das
// abas "Outros Produtos" (ver COL_PRODUTO_OUTROS_APROVADOS/AGUARDANDO):
// grava o texto editado na coluna Plano (J, índice 10 dentro de A:T) da
// Leads -- é assim que se RECLASSIFICA um lead: digitando ali o nome exato
// de um produto de PRODUTOS, o lead sai dessas abas e aparece na aba
// daquele produto na próxima atualização (a condição dessas abas exige que
// o Plano NÃO bata com nenhum nome de PRODUTOS -- ver condicaoOutrosProdutos()).
function sincronizarProdutoDaLinha(sh, linha, colProduto, ss) {
  const id = sh.getRange(linha, 1).getValue();
  if (!id) return; // linha sem lead correspondente (sobra da fórmula)

  const texto = String(sh.getRange(linha, colProduto).getValue() || "").trim();
  const shLeads = ss.getSheetByName(ABA_LEADS);
  const linhaLeads = encontrarLinhaLeadPorId(shLeads, id);
  if (linhaLeads !== -1) {
    shLeads.getRange(linhaLeads, COL_PLANO).setValue(texto);
  }

  sh.getRange(linha, colProduto).setFormula(
    `=IFERROR(VLOOKUP($A${linha};${ABA_LEADS}!$A:$T;10;FALSE);"")`
  );
}

// acha em que linha da Leads está o lead com esse ID (coluna A) -- usado
// tanto pra aprovar um lead (botão "Aprovar") quanto pra sincronizar
// Observações editadas fora da Leads.
function encontrarLinhaLeadPorId(shLeads, id) {
  const dados = shLeads.getDataRange().getValues();
  for (let i = 1; i < dados.length; i++) {
    if (String(dados[i][0]) === String(id)) return i + 1; // +1: array 0-indexed, planilha 1-indexed
  }
  return -1;
}

function ss_ativa() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

// Diagnóstico avulso -- roda pra investigar leads com CPF em branco na aba
// Leads. Não altera nada, só lista no Registro de execução (Ver -> Registros,
// ou Execuções no menu lateral do editor) cada linha afetada com Nome,
// Status Pagamento e Forma de Pagamento, e separa em dois grupos:
// "pagamento avulso sem correspondência" (nome com esse texto exato -- é o
// comportamento esperado de registrarPagamento() quando um webhook de
// pagamento chega sem order_nsu batendo com nenhum pedido) e "outros" (CPF
// em branco por algum outro motivo -- provavelmente uma linha digitada
// direto na aba Leads, sem passar pelo formulário do site nem pela aba
// "Adicionar Lead Manual", que bloqueiam envio sem CPF).
function diagnosticarCpfFaltando() {
  const sh = ss_ativa().getSheetByName(ABA_LEADS);
  const dados = sh.getDataRange().getValues();

  const avulsos = [];
  const outros = [];

  for (let i = 1; i < dados.length; i++) {
    const linha = dados[i];
    const id = linha[0];
    if (!id) continue; // linha vazia
    const cpf = String(linha[3] || "").trim();
    if (cpf) continue; // CPF preenchido, não é o que estamos procurando

    const nome = linha[2];
    const statusPagamento = linha[11];
    const formaPagamento = linha[12];
    const registro = `ID ${id} | Nome: "${nome}" | Status: ${statusPagamento} | Forma: ${formaPagamento}`;

    if (String(nome).indexOf("pagamento sem correspondência") !== -1) {
      avulsos.push(registro);
    } else {
      outros.push(registro);
    }
  }

  Logger.log(`=== CPF em branco: ${avulsos.length + outros.length} linha(s) no total ===`);
  Logger.log(`--- Pagamento avulso sem correspondência (esperado, ver Instruções): ${avulsos.length} ---`);
  avulsos.forEach((r) => Logger.log(r));
  Logger.log(`--- Outros motivos (provavelmente digitado direto na Leads): ${outros.length} ---`);
  outros.forEach((r) => Logger.log(r));

  avisar(
    `CPF em branco: ${avulsos.length + outros.length} linha(s) no total ` +
    `(${avulsos.length} são pagamento avulso sem correspondência, esperado; ` +
    `${outros.length} são de outro motivo). Detalhes no Registro de execução.`
  );
}

// valida que a Categoria escolhida no formulário manual (aba "Adicionar
// Lead Manual") é um nome EXATO de PRODUTOS -- devolve o próprio nome, ou
// null se não bater com nenhum plano cadastrado.
function determinarPlanoManual(categoria) {
  if (!categoria) return null;
  return PRODUTOS.indexOf(categoria) !== -1 ? categoria : null;
}

function aprovarLinhaLeadsPorNumeroDeLinha(shLeads, linha) {
  shLeads.getRange(linha, COL_STATUS_PAGAMENTO).setValue("Pago");
  if (!shLeads.getRange(linha, COL_DATA_PAGAMENTO).getValue()) {
    shLeads.getRange(linha, COL_DATA_PAGAMENTO).setValue(new Date());
  }
}

// procura o lead pelo ID (coluna A da Leads) e marca como Pago -- usado
// pelo botão "Aprovar" das abas "- Aguardando", que identifica o lead
// pelo ID (não pela posição da linha, que muda toda hora).
function aprovarLeadPorId(ss, id) {
  const shLeads = ss.getSheetByName(ABA_LEADS);
  const linha = encontrarLinhaLeadPorId(shLeads, id);
  if (linha !== -1) aprovarLinhaLeadsPorNumeroDeLinha(shLeads, linha);
}

// lê o formulário da aba "Adicionar Lead Manual", valida, registra o lead
// na aba Leads (reaproveitando registrarLead -- mesmo formato/colunas de
// um lead vindo do site) e limpa o formulário pro próximo cadastro. Entra
// sempre como "Aguardando pagamento" -- se já estiver pago, use o botão
// "Aprovar" na aba "- Aguardando" do produto depois de criado.
function inserirLeadManual(shManual, ss) {
  const get = (linha) => shManual.getRange(linha, COL_MANUAL_VALOR).getValue();

  const nome = String(get(LINHA_MANUAL_NOME) || "").trim();
  const cpf = String(get(LINHA_MANUAL_CPF) || "").trim();
  const endereco = String(get(LINHA_MANUAL_ENDERECO) || "").trim();
  const estado = String(get(LINHA_MANUAL_ESTADO) || "").trim();
  const pais = String(get(LINHA_MANUAL_PAIS) || "").trim();
  const whatsapp = String(get(LINHA_MANUAL_WHATSAPP) || "").trim();
  const email = String(get(LINHA_MANUAL_EMAIL) || "").trim();
  const categoria = String(get(LINHA_MANUAL_CATEGORIA) || "").trim();
  const produtoPersonalizado = String(get(LINHA_MANUAL_PRODUTO_PERSONALIZADO) || "").trim();
  const observacoes = String(get(LINHA_MANUAL_OBSERVACOES) || "").trim(); // opcional
  const turma = String(get(LINHA_MANUAL_TURMA) || "").trim(); // opcional
  const horarioPreferencia = String(get(LINHA_MANUAL_HORARIO_PREFERENCIA) || "").trim(); // opcional
  const atorResponsavel = String(get(LINHA_MANUAL_ATOR_RESPONSAVEL) || "").trim(); // opcional
  const vendedor = String(get(LINHA_MANUAL_VENDEDOR) || "").trim(); // opcional
  const desconto = String(get(LINHA_MANUAL_DESCONTO) || "").trim(); // opcional
  const ehOutro = categoria === "Outro";

  // desmarca a caixa já de cara -- se faltar campo, ela não fica travada
  // marcada esperando um novo edit pra disparar o onEdit de novo
  shManual.getRange(LINHA_MANUAL_INSERIR, COL_MANUAL_VALOR).setValue(false);

  if (!nome || !cpf || !endereco || !estado || !pais || !whatsapp || !email || !categoria) {
    SpreadsheetApp.getActiveSpreadsheet().toast("Preencha todos os campos antes de marcar 'Inserir'.", "Campo faltando", 6);
    return;
  }
  if (ehOutro && !produtoPersonalizado) {
    SpreadsheetApp.getActiveSpreadsheet().toast("Categoria 'Outro' precisa do campo 'Produto personalizado' preenchido.", "Campo faltando", 6);
    return;
  }

  // Categoria "Outro" -- Plano vira o texto fixo "Outros Produtos" (=
  // ABA_OUTROS_PRODUTOS), igual ao lead vindo do cadastro.html (ver
  // registrarCadastroPersonalizado()) -- é isso que faz Categoria também
  // sair "Outros Produtos" (ver fórmula em registrarLead()) e o lead cair
  // nas abas "Outros Produtos" (ver condicaoOutrosProdutos()). A descrição
  // que foi digitada no Produto personalizado não se perde -- vai pras
  // Observações, junto com qualquer observação que já tivesse sido
  // digitada. Outras categorias continuam batendo contra PRODUTOS, como antes.
  const plano = ehOutro ? ABA_OUTROS_PRODUTOS : determinarPlanoManual(categoria);
  if (!plano) {
    SpreadsheetApp.getActiveSpreadsheet().toast("Categoria inválida -- use o menu suspenso.", "Erro", 6);
    return;
  }
  const observacoesFinal = ehOutro
    ? [`Produto solicitado: ${produtoPersonalizado}`, observacoes].filter(Boolean).join(" | ")
    : observacoes;

  const shLeads = ss.getSheetByName(ABA_LEADS);
  registrarLead(shLeads, {
    nome, cpf, endereco, estado, pais, whatsapp, email, plano,
    observacoes: observacoesFinal,
    turma, horarioPreferencia, atorResponsavel, vendedor, desconto,
    dataEnvio: new Date().toISOString(),
  });

  // limpa o formulário pro próximo cadastro
  [
    LINHA_MANUAL_NOME, LINHA_MANUAL_CPF, LINHA_MANUAL_ENDERECO, LINHA_MANUAL_ESTADO,
    LINHA_MANUAL_PAIS, LINHA_MANUAL_WHATSAPP, LINHA_MANUAL_EMAIL,
    LINHA_MANUAL_CATEGORIA, LINHA_MANUAL_PRODUTO_PERSONALIZADO,
    LINHA_MANUAL_OBSERVACOES, LINHA_MANUAL_TURMA, LINHA_MANUAL_HORARIO_PREFERENCIA,
    LINHA_MANUAL_ATOR_RESPONSAVEL, LINHA_MANUAL_VENDEDOR, LINHA_MANUAL_DESCONTO,
  ].forEach((linha) => shManual.getRange(linha, COL_MANUAL_VALOR).setValue(""));

  shManual.getRange(LINHA_MANUAL_CONFIRMACAO, COL_MANUAL_VALOR).setValue(
    `"${nome}" adicionado(a) em "${plano}" às ${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss")}. Status inicial: Aguardando pagamento.`
  );

  SpreadsheetApp.getActiveSpreadsheet().toast(`Lead "${nome}" criado com sucesso!`, "Pronto", 5);
}

function doPost(e) {
  try {
    // log do payload bruto recebido -- pra ver EXATAMENTE o que a InfinitePay
    // manda no webhook de pagamento (ou o que o formulário do site manda).
    // Ver em Execuções, na aba "Registro" de cada execução de doPost.
    Logger.log("doPost recebeu: " + e.postData.contents);

    const dados = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(ABA_LEADS);

    // heurística: payload da InfinitePay (webhook de pagamento) tem "amount"
    // e/ou "transaction_nsu"; payload do nosso formulário (comprar.html) tem
    // "nome" e "plano".
    const ehPagamento = dados.amount !== undefined || dados.transaction_nsu !== undefined;

    if (ehPagamento) {
      registrarPagamento(sh, dados);
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // formulário de cadastro com produto em texto livre (site/cadastro.html
    // + site/js/cadastro.js) -- SEM link automático de pagamento, ver
    // registrarCadastroPersonalizado().
    if (dados.tipo === "cadastro-personalizado") {
      const resultadoCadastro = registrarCadastroPersonalizado(sh, dados);
      return ContentService
        .createTextOutput(JSON.stringify(resultadoCadastro))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // não é pagamento -- é um novo pedido vindo do formulário. Gera um link
    // de pagamento exclusivo (com order_nsu) e devolve pro site redirecionar.
    const resultado = criarPedidoInfinitePay(sh, dados);
    return ContentService
      .createTextOutput(JSON.stringify(resultado))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (erro) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, erro: String(erro) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Formulário de cadastro com produto em texto livre (site/cadastro.html +
// site/js/cadastro.js) -- usado pra verificação manual: não existe preço
// fixo pra esse "produto" (é uma descrição livre, não bate com nada em
// PRECOS_CENTAVOS), então diferente de criarPedidoInfinitePay() NÃO
// chamamos a API da InfinitePay aqui. Só grava o lead como "Aguardando
// pagamento". O time manda um link de desconto manualmente pro cliente e
// confirma o pagamento na planilha depois (checkbox "Marcar como Pago").
//
// A coluna "Plano" NÃO recebe a descrição livre que o cliente digitou --
// recebe sempre o texto fixo "Outros Produtos" (= ABA_OUTROS_PRODUTOS),
// pra Categoria também sair "Outros Produtos" (ver registrarLead()) e pro
// Painel/Dashboard contarem esse lead de forma consistente. A descrição
// que o cliente realmente digitou vai pras Observações, onde continua
// visível -- inclusive editável -- na aba "Outros Produtos" (ver
// COL_OBSERVACOES_OUTROS_APROVADOS/AGUARDANDO).
function registrarCadastroPersonalizado(sh, dados) {
  const produto = String(dados.produto || "").trim();
  registrarLead(sh, {
    nome: dados.nome,
    cpf: dados.cpf,
    endereco: dados.endereco,
    estado: dados.estado,
    pais: dados.pais,
    whatsapp: dados.whatsapp,
    email: dados.email,
    plano: ABA_OUTROS_PRODUTOS,
    observacoes: produto ? `Produto solicitado pelo cliente: ${produto}` : "",
    dataEnvio: dados.dataEnvio,
  });
  return { ok: true };
}

// Cria o pedido: gera um ID único (que dobra como order_nsu), registra o
// lead na Leads já com esse ID, chama a API da InfinitePay pra gerar um
// link de pagamento exclusivo daquele pedido, e devolve esse link.
// Se a chamada à InfinitePay falhar por qualquer motivo, o lead ainda é
// registrado normalmente (não perde a venda) e devolvemos ok:false pro
// site cair no link de reserva (ver js/comprar.js).
function criarPedidoInfinitePay(sh, dados) {
  const id = Utilities.getUuid().slice(0, 8);
  registrarLead(sh, dados, id);

  const preco = PRECOS_CENTAVOS[dados.plano];
  if (!preco) {
    return { ok: false, erro: "Plano sem preço cadastrado em PRECOS_CENTAVOS: " + dados.plano };
  }

  const payload = {
    handle: INFINITEPAY_HANDLE,
    order_nsu: id,
    redirect_url: determinarUrlRedirecionamento(dados.plano),
    webhook_url: ScriptApp.getService().getUrl(),
    items: [
      { quantity: 1, price: preco, description: dados.plano },
    ],
  };

  try {
    const resposta = UrlFetchApp.fetch(INFINITEPAY_LINKS_URL, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    const codigo = resposta.getResponseCode();
    const corpo = JSON.parse(resposta.getContentText());

    if (codigo >= 200 && codigo < 300 && corpo.url) {
      return { ok: true, checkoutUrl: corpo.url };
    }
    Logger.log("InfinitePay recusou a criação do link (" + codigo + "): " + resposta.getContentText());
    return { ok: false, erro: "Resposta inesperada da InfinitePay (" + codigo + "): " + resposta.getContentText() };
  } catch (erro) {
    Logger.log("Falha ao chamar a InfinitePay: " + String(erro));
    return { ok: false, erro: "Falha ao chamar a InfinitePay: " + String(erro) };
  }
}

// acha a próxima linha realmente vazia olhando só a coluna A (ID) -- NÃO
// usar appendRow()/getLastRow() aqui: os 2000 checkboxes pré-inseridos na
// coluna S (Marcar como Pago) contam como "conteúdo" pro Sheets, então
// getLastRow() devolve ~2001 mesmo com a planilha vazia de leads, e
// appendRow() acaba jogando o lead lá pra linha 2002+ (e a fórmula de
// Categoria alguma linha no meio do caminho, gerando #REF! na ARRAYFORMULA).
function proximaLinhaVaziaPorId(sh) {
  const ultimaLinhaFolha = sh.getMaxRows();
  if (ultimaLinhaFolha < 2) return 2;
  const idsColunaA = sh.getRange(2, 1, ultimaLinhaFolha - 1, 1).getValues();
  for (let i = 0; i < idsColunaA.length; i++) {
    if (!idsColunaA[i][0]) return i + 2;
  }
  return ultimaLinhaFolha + 1;
}

function registrarLead(sh, dados, idFixo) {
  const id = idFixo || Utilities.getUuid().slice(0, 8);
  const linha = proximaLinhaVaziaPorId(sh);
  // precisa vir ANTES do setValues abaixo: se a célula ainda estiver com
  // formato "Automático" no momento em que o CPF é escrito, o Sheets
  // interpreta um CPF só-números como número e derruba o zero à esquerda
  // (ver comentário em criarAbaLeads()). Forçar "Texto simples" antes evita
  // isso mesmo em linhas fora do range de 2000 já pré-formatado lá.
  sh.getRange(linha, 4).setNumberFormat("@");
  // mesmo motivo pro WhatsApp (coluna H) -- ver comentário em criarAbaLeads()
  // sobre por que isso quebrava o QUERY() das abas de cada produto.
  sh.getRange(linha, COL_WHATSAPP).setNumberFormat("@");
  sh.getRange(linha, 1, 1, 25).setValues([[
    id,
    new Date(dados.dataEnvio || new Date()),
    dados.nome || "",
    dados.cpf || "",
    dados.endereco || "",
    dados.estado || "",
    dados.pais || "",
    dados.whatsapp || "",
    dados.email || "",
    dados.plano || "",
    "", // Categoria -- coluna com fórmula, deixa em branco
    "Aguardando pagamento",
    "", "", "", "", "", "",
    false, // Marcar como Pago (checkbox)
    dados.observacoes || "",
    dados.turma || "",
    dados.horarioPreferencia || "",
    dados.atorResponsavel || "",
    dados.vendedor || "",
    dados.desconto || "",
  ]]);
  // sem isso, a coluna Data/Hora às vezes mostra o número de série bruto
  // (ex: 46277,76759) em vez da data formatada
  sh.getRange(linha, 2).setNumberFormat("dd/mm/yyyy hh:mm:ss");
  const formulaCategoria =
    `=IF(J${linha}="";"";IF(J${linha}="${ABA_OUTROS_PRODUTOS}";"${ABA_OUTROS_PRODUTOS}";` +
    `IF(REGEXMATCH(TO_TEXT(J${linha});"(?i)premium");"Premium";` +
    `IF(REGEXMATCH(TO_TEXT(J${linha});"(?i)expresso");"Expresso";"Outro"))))`;
  sh.getRange(linha, COL_CATEGORIA).setFormula(formulaCategoria);
}

function registrarPagamento(sh, dados) {
  const valorPago = (dados.paid_amount || dados.amount || 0) / 100; // centavos -> reais
  const agora = new Date();
  const linhas = sh.getDataRange().getValues();

  // casa por order_nsu -- coluna A = ID. Único critério aceito: nunca casar
  // por valor/horário, pra garantir 100% de certeza no pagamento marcado
  // como Pago. Pagamento sem order_nsu (ou sem correspondência) cai como
  // avulso pra revisão manual (ver bloco abaixo).
  let linhaAlvo = -1;
  if (dados.order_nsu) {
    for (let i = 1; i < linhas.length; i++) {
      if (String(linhas[i][0]) === String(dados.order_nsu)) { linhaAlvo = i; break; }
    }
  }

  if (linhaAlvo === -1) {
    // não achou par -- registra como pagamento avulso pra revisão manual
    // (usa a mesma busca por linha vazia da coluna A -- ver comentário em
    // proximaLinhaVaziaPorId, o mesmo problema de appendRow/getLastRow se
    // aplica aqui)
    const linhaAvulsa = proximaLinhaVaziaPorId(sh);
    sh.getRange(linhaAvulsa, 4).setNumberFormat("@"); // CPF
    sh.getRange(linhaAvulsa, COL_WHATSAPP).setNumberFormat("@");
    sh.getRange(linhaAvulsa, 1, 1, 25).setValues([[
      Utilities.getUuid().slice(0, 8),
      agora,
      "(pagamento sem correspondência -- revisar manualmente)",
      "", "", "", "", "", "", "", "", // CPF, Endereço, Estado, País, WhatsApp, E-mail, Plano, Categoria
      "Pago",
      dados.capture_method || "",
      dados.installments || "",
      valorPago,
      agora,
      dados.transaction_nsu || "",
      dados.receipt_url || "",
      true, // Marcar como Pago (checkbox)
      "", // Observações
      "", "", "", "", "", // Turma, Horário de Preferência, Ator Responsável, Vendedor, Desconto
    ]]);
    return;
  }

  const linhaPlanilha = linhaAlvo + 1; // +1 porque getDataRange é 0-indexed e a planilha é 1-indexed
  sh.getRange(linhaPlanilha, COL_STATUS_PAGAMENTO).setValue("Pago");
  sh.getRange(linhaPlanilha, COL_FORMA_PAGAMENTO).setValue(dados.capture_method || "");
  sh.getRange(linhaPlanilha, COL_PARCELAS).setValue(dados.installments || "");
  sh.getRange(linhaPlanilha, COL_VALOR_PAGO).setValue(valorPago);
  sh.getRange(linhaPlanilha, COL_DATA_PAGAMENTO).setValue(agora);
  sh.getRange(linhaPlanilha, COL_ID_TRANSACAO).setValue(dados.transaction_nsu || "");
  sh.getRange(linhaPlanilha, COL_MARCAR_PAGO).setValue(true);
  sh.getRange(linhaPlanilha, COL_RECIBO).setValue(dados.receipt_url || "");
}
