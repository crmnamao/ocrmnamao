// CRM NA MÃO — Perfil, Feedback e Notificações da Plataforma do Aluno
//
// Roda DEPOIS de js/plataforma.js (usa window.PlataformaCtx, exposto no fim
// daquele arquivo, pra reaproveitar sessão/aluno/avatar sem duplicar lógica
// de autenticação). Feedback e Avisos falam com a planilha via
// window.FeedbackAPI (js/feedback-store.js) -- só esses dois usam rede;
// perfil continua salvo local (AlunosStore/localStorage), mesma limitação
// já documentada no resto da plataforma.

(function () {
  "use strict";

  if (!window.PlataformaCtx) return; // acesso bloqueado / sem sessão -- js/plataforma.js já tratou isso

  var ctx = window.PlataformaCtx;
  var sessao = ctx.sessao;
  var escapeHtml = ctx.escapeHtml;

  var CHAVE_AVISOS_VISTOS = "crmnamao_avisos_vistos";

  function avisosVistos() {
    try {
      return JSON.parse(localStorage.getItem(CHAVE_AVISOS_VISTOS) || "[]");
    } catch (erro) {
      return [];
    }
  }

  function marcarAvisoVisto(id) {
    var vistos = avisosVistos();
    if (vistos.indexOf(id) === -1) {
      vistos.push(id);
      localStorage.setItem(CHAVE_AVISOS_VISTOS, JSON.stringify(vistos));
    }
  }

  function formatarData(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("pt-BR") + " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  // ================= PERFIL =================

  var elPerfilOverlay = document.getElementById("perfilOverlay");
  var elBtnAbrirPerfil = document.getElementById("btnAbrirPerfil");

  function fecharModalGenerico(overlay) {
    overlay.hidden = true;
    overlay.innerHTML = "";
    document.body.classList.remove("plat-modal-aberto");
  }

  function abrirPerfil() {
    var aluno = window.AlunosStore.buscarPorId(ctx.aluno.id) || ctx.aluno;
    var fotoAtual = aluno.foto || sessao.foto || "";

    elPerfilOverlay.innerHTML =
      '<div class="quiz-modal-card plat-form-modal">' +
        '<div class="quiz-modal-topo">' +
          "<h2>Meu perfil</h2>" +
          '<button type="button" class="quiz-modal-fechar" id="perfilFechar" aria-label="Fechar">✕</button>' +
        "</div>" +
        '<div class="plat-perfil-foto-linha">' +
          '<div class="plat-avatar plat-avatar-grande" id="perfilAvatarPreview">' +
            (fotoAtual ? '<img src="' + fotoAtual + '" alt="" />' : escapeHtml((aluno.nome || "A").charAt(0).toUpperCase())) +
          "</div>" +
          '<label class="btn btn-plan-outline plat-btn-upload">Trocar foto<input type="file" accept="image/*" id="perfilFotoInput" hidden /></label>' +
        "</div>" +
        '<label class="plat-form-label">Nome<input type="text" id="perfilNomeInput" value="' + escapeHtml(aluno.nome || "") + '" /></label>' +
        '<label class="plat-form-label">E-mail<input type="text" value="' + escapeHtml(aluno.email || "") + '" disabled /></label>' +
        '<p class="plat-form-nota">Só a equipe CRM na Mão pode alterar seu e-mail.</p>' +
        '<button type="button" class="btn btn-plan" id="perfilSalvar">Salvar alterações</button>' +
        '<p class="plat-form-status" id="perfilStatus" hidden></p>' +
      "</div>";

    elPerfilOverlay.hidden = false;
    document.body.classList.add("plat-modal-aberto");
    document.getElementById("perfilFechar").addEventListener("click", function () { fecharModalGenerico(elPerfilOverlay); });

    var fotoNova = null;

    document.getElementById("perfilFotoInput").addEventListener("change", function (ev) {
      var arquivo = ev.target.files && ev.target.files[0];
      if (!arquivo) return;
      var img = new Image();
      var leitor = new FileReader();
      leitor.onload = function () {
        img.onload = function () {
          var tam = 160;
          var canvas = document.createElement("canvas");
          canvas.width = tam;
          canvas.height = tam;
          var ctx2d = canvas.getContext("2d");
          var lado = Math.min(img.width, img.height);
          var sx = (img.width - lado) / 2;
          var sy = (img.height - lado) / 2;
          ctx2d.drawImage(img, sx, sy, lado, lado, 0, 0, tam, tam);
          fotoNova = canvas.toDataURL("image/jpeg", 0.85);
          document.getElementById("perfilAvatarPreview").innerHTML = '<img src="' + fotoNova + '" alt="" />';
        };
        img.src = leitor.result;
      };
      leitor.readAsDataURL(arquivo);
    });

    document.getElementById("perfilSalvar").addEventListener("click", function () {
      var novoNome = document.getElementById("perfilNomeInput").value.trim();
      var patch = { nome: novoNome || aluno.nome };
      if (fotoNova) patch.foto = fotoNova;
      window.AlunosStore.atualizar(aluno.id, patch);
      ctx.aluno.nome = patch.nome;
      if (patch.foto) ctx.aluno.foto = patch.foto;

      var elUserNome = document.getElementById("userNome");
      if (elUserNome) elUserNome.textContent = patch.nome;
      ctx.atualizarAvatar();

      var status = document.getElementById("perfilStatus");
      status.hidden = false;
      status.textContent = "Perfil atualizado!";
      setTimeout(function () { fecharModalGenerico(elPerfilOverlay); }, 900);
    });
  }

  if (elBtnAbrirPerfil) elBtnAbrirPerfil.addEventListener("click", abrirPerfil);

  // ================= FEEDBACK (formulário) =================

  var elFeedbackOverlay = document.getElementById("feedbackOverlay");
  var elBtnAbrirFeedback = document.getElementById("btnAbrirFeedback");

  function abrirFeedback() {
    elFeedbackOverlay.innerHTML =
      '<div class="quiz-modal-card plat-form-modal">' +
        '<div class="quiz-modal-topo">' +
          "<h2>Fale com a gente</h2>" +
          '<button type="button" class="quiz-modal-fechar" id="feedbackFechar" aria-label="Fechar">✕</button>' +
        "</div>" +
        '<p class="plat-form-nota">Dúvida, erro na plataforma ou sugestão — sua mensagem cai direto na nossa equipe.</p>' +
        '<label class="plat-form-label">Categoria' +
          '<select id="feedbackCategoria">' +
            '<option value="Dúvida">Dúvida</option>' +
            '<option value="Erro na plataforma">Erro na plataforma</option>' +
            '<option value="Feedback">Feedback/sugestão</option>' +
          "</select>" +
        "</label>" +
        '<label class="plat-form-label">Mensagem<textarea id="feedbackMensagem" rows="5"></textarea></label>' +
        '<button type="button" class="btn btn-plan" id="feedbackEnviar">Enviar</button>' +
        '<p class="plat-form-status" id="feedbackStatus" hidden></p>' +
      "</div>";

    elFeedbackOverlay.hidden = false;
    document.body.classList.add("plat-modal-aberto");
    document.getElementById("feedbackFechar").addEventListener("click", function () { fecharModalGenerico(elFeedbackOverlay); });

    document.getElementById("feedbackEnviar").addEventListener("click", function () {
      var mensagem = document.getElementById("feedbackMensagem").value.trim();
      var status = document.getElementById("feedbackStatus");
      if (!mensagem) {
        status.hidden = false;
        status.textContent = "Escreva sua mensagem antes de enviar.";
        return;
      }
      var btn = document.getElementById("feedbackEnviar");
      btn.disabled = true;
      btn.textContent = "Enviando...";
      window.FeedbackAPI.enviar({
        nome: ctx.aluno.nome || sessao.nome,
        email: sessao.email,
        categoria: document.getElementById("feedbackCategoria").value,
        mensagem: mensagem
      }).then(function (resultado) {
        status.hidden = false;
        status.textContent = resultado && resultado.ok ? "Mensagem enviada! A equipe vai responder por aqui mesmo." : "Não deu pra enviar agora, tente de novo em instantes.";
        if (resultado && resultado.ok) {
          setTimeout(function () { fecharModalGenerico(elFeedbackOverlay); }, 1400);
        } else {
          btn.disabled = false;
          btn.textContent = "Enviar";
        }
      });
    });
  }

  if (elBtnAbrirFeedback) elBtnAbrirFeedback.addEventListener("click", abrirFeedback);

  // ================= NOTIFICAÇÕES (sino) =================

  var elBtnNotif = document.getElementById("btnNotificacoes");
  var elNotifBadge = document.getElementById("notifBadge");
  var elNotifPainel = document.getElementById("notifPainel");

  var estadoNotif = { feedbacks: [], avisos: [] };

  function itensNaoLidos() {
    var respostasNaoLidas = estadoNotif.feedbacks.filter(function (f) {
      return f.status === "Respondido" && !f.lidoPeloAluno;
    });
    var vistos = avisosVistos();
    var avisosNaoVistos = estadoNotif.avisos.filter(function (a) {
      return vistos.indexOf(a.id) === -1;
    });
    return { respostas: respostasNaoLidas, avisos: avisosNaoVistos };
  }

  function atualizarBadge() {
    var naoLidos = itensNaoLidos();
    var total = naoLidos.respostas.length + naoLidos.avisos.length;
    if (total > 0) {
      elNotifBadge.hidden = false;
      elNotifBadge.textContent = total > 9 ? "9+" : String(total);
    } else {
      elNotifBadge.hidden = true;
    }
  }

  function renderNotifPainel() {
    var itens = [];

    estadoNotif.avisos.forEach(function (a) {
      itens.push({ tipo: "aviso", data: a.dataHora, titulo: a.titulo, corpo: a.mensagem, id: a.id, lido: avisosVistos().indexOf(a.id) !== -1 });
    });
    estadoNotif.feedbacks.forEach(function (f) {
      if (f.status !== "Respondido") return;
      itens.push({ tipo: "resposta", data: f.dataResposta, titulo: "Resposta da equipe", corpo: f.resposta, id: f.id, lido: f.lidoPeloAluno, mensagemOriginal: f.mensagem });
    });

    itens.sort(function (a, b) { return new Date(b.data) - new Date(a.data); });

    if (!itens.length) {
      elNotifPainel.innerHTML = '<p class="plat-notif-vazio">Nenhuma notificação por aqui ainda.</p>';
      return;
    }

    elNotifPainel.innerHTML = itens.map(function (item) {
      return (
        '<button type="button" class="plat-notif-item ' + (item.lido ? "" : "is-novo") + '" data-tipo="' + item.tipo + '" data-id="' + item.id + '">' +
          '<span class="plat-notif-item-titulo">' + (item.tipo === "aviso" ? "📣 " : "💬 ") + escapeHtml(item.titulo) + "</span>" +
          '<span class="plat-notif-item-corpo">' + escapeHtml(item.corpo) + "</span>" +
          '<span class="plat-notif-item-data">' + formatarData(item.data) + "</span>" +
        "</button>"
      );
    }).join("");

    elNotifPainel.querySelectorAll(".plat-notif-item").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-id");
        var tipo = btn.getAttribute("data-tipo");
        if (tipo === "aviso") {
          marcarAvisoVisto(id);
        } else {
          window.FeedbackAPI.marcarLido(id);
          estadoNotif.feedbacks.forEach(function (f) { if (f.id === id) f.lidoPeloAluno = true; });
        }
        btn.classList.remove("is-novo");
        atualizarBadge();
      });
    });
  }

  if (elBtnNotif) {
    elBtnNotif.addEventListener("click", function (ev) {
      ev.stopPropagation();
      var abrir = elNotifPainel.hidden;
      elNotifPainel.hidden = !abrir;
      if (abrir) renderNotifPainel();
    });
    document.addEventListener("click", function (ev) {
      if (!elNotifPainel.hidden && !elNotifPainel.contains(ev.target) && ev.target !== elBtnNotif) {
        elNotifPainel.hidden = true;
      }
    });
  }

  function carregarNotificacoes() {
    if (!window.FeedbackAPI) return;
    Promise.all([
      window.FeedbackAPI.meus(sessao.email),
      window.FeedbackAPI.listarAvisos()
    ]).then(function (resultados) {
      var respFeedback = resultados[0];
      var respAvisos = resultados[1];
      estadoNotif.feedbacks = (respFeedback && respFeedback.ok) ? respFeedback.itens : [];
      estadoNotif.avisos = (respAvisos && respAvisos.ok) ? respAvisos.itens : [];
      atualizarBadge();
    });
  }

  carregarNotificacoes();
})();
