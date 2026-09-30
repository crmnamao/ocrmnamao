// CRM NA MÃO — Cliente de Feedback/Avisos da Plataforma do Aluno
//
// Fala com a mesma planilha (Google Sheets via Apps Script) já usada pra
// leads/pagamentos, mas numa aba própria (Feedback / Avisos) -- ver
// ABA_FEEDBACK/ABA_AVISOS em google-apps-script-planilha-setup.gs. Segue o
// mesmo padrão de fetch de site/js/cadastro.js e site/js/plano-checkout.js:
// POST com Content-Type: text/plain (evita preflight de CORS no Apps
// Script) e um campo "tipo" no corpo que o doPost() usa pra rotear.
//
// Usado por site/plataforma.html (aluno envia feedback, vê respostas e
// avisos) e site/admin.html (equipe lista/responde feedback, cria avisos).

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbztG_YafW1uHKRKhuBEXdW4VeNBBRISWHn0UZXKPONci1sdsHGUgcLgW-eSqK13T9_uwg/exec";

async function chamarFeedbackAPI(payload) {
  try {
    const resposta = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload),
    });
    return await resposta.json();
  } catch (erro) {
    console.error("Falha ao falar com a Apps Script (feedback/avisos):", erro);
    return { ok: false, erro: String(erro) };
  }
}

window.FeedbackAPI = {
  enviar: function (dados) {
    return chamarFeedbackAPI({ tipo: "feedback-enviar", nome: dados.nome, email: dados.email, categoria: dados.categoria, mensagem: dados.mensagem });
  },
  listarAdmin: function () {
    return chamarFeedbackAPI({ tipo: "feedback-listar-admin" });
  },
  meus: function (email) {
    return chamarFeedbackAPI({ tipo: "feedback-meus", email: email });
  },
  responder: function (id, resposta) {
    return chamarFeedbackAPI({ tipo: "feedback-responder", id: id, resposta: resposta });
  },
  marcarLido: function (id) {
    return chamarFeedbackAPI({ tipo: "feedback-marcar-lido", id: id });
  },
  criarAviso: function (titulo, mensagem) {
    return chamarFeedbackAPI({ tipo: "aviso-criar", titulo: titulo, mensagem: mensagem });
  },
  listarAvisos: function (incluirInativos) {
    return chamarFeedbackAPI({ tipo: "aviso-listar", incluirInativos: !!incluirInativos });
  },
  desativarAviso: function (id) {
    return chamarFeedbackAPI({ tipo: "aviso-desativar", id: id });
  },
};
