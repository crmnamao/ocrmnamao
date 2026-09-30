// CRM NA MÃO — Plataforma do Aluno
//
// PENDÊNCIA: o cadastro de alunos e o progresso (vídeos assistidos, notas
// do quiz) hoje vivem no AlunosStore (js/alunos-store.js), que salva tudo
// no localStorage do navegador -- não existe backend/banco de dados ainda.
// Quando o backend existir, o AlunosStore passa a chamar uma API em vez do
// localStorage, e este arquivo não precisa mudar.

(function () {
  "use strict";

  var CHAVE_SESSAO = "crmnamao_sessao";
  var ADMIN_EMAILS = window.ADMIN_EMAILS || [];

  // ---------- Sessão / autenticação ----------

  function getSessao() {
    try {
      var bruto = localStorage.getItem(CHAVE_SESSAO);
      return bruto ? JSON.parse(bruto) : null;
    } catch (erro) {
      return null;
    }
  }

  function limparSessao() {
    localStorage.removeItem(CHAVE_SESSAO);
  }

  var sessao = getSessao();
  if (!sessao) {
    window.location.href = "login.html";
    return;
  }

  var aluno = AlunosStore.buscarPorEmail(sessao.email) || AlunosStore.registrarPendente(sessao);

  var ehAdmin = ADMIN_EMAILS.indexOf((sessao.email || "").toLowerCase()) !== -1;
  if (ehAdmin && aluno.status !== "ativo") {
    aluno = AlunosStore.atualizar(aluno.id, { status: "ativo" });
  }

  function acessoLiberado(a) {
    if (ehAdmin) return true;
    if (!a) return false;
    if (a.status !== "ativo") return false;
    if (a.dataExpiracao && new Date(a.dataExpiracao) < new Date()) return false;
    return true;
  }

  // ---------- Progresso (vídeos assistidos + quiz), via AlunosStore ----------

  function progressoAtual() {
    var atual = AlunosStore.buscarPorId(aluno.id);
    return (atual && atual.progresso) || {};
  }

  function getEstacaoProgresso(estacaoId, totalVideos) {
    return AlunosStore.obterProgressoEstacao(aluno.id, estacaoId, totalVideos);
  }

  function marcarVideoAssistido(estacaoId, idx, totalVideos) {
    AlunosStore.marcarVideoAssistido(aluno.id, estacaoId, idx, totalVideos);
  }

  function salvarResultadoQuiz(estacaoId, acertos, total) {
    AlunosStore.salvarResultadoQuiz(aluno.id, estacaoId, acertos, total);
  }

  // ---------- Utilidades ----------

  function escapeHtml(texto) {
    return String(texto == null ? "" : texto).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function encontrarEstacao(edicaoId, estacaoId) {
    var edicao = PLATAFORMA_DADOS.edicoes.find(function (e) { return e.id === edicaoId; });
    if (!edicao) return null;
    var estacao = edicao.estacoes.find(function (e) { return e.id === estacaoId; });
    return estacao ? { edicao: edicao, estacao: estacao } : null;
  }

  // ---------- Elementos ----------

  var elSidebar = document.getElementById("plataformaSidebar");
  var elMain = document.getElementById("plataformaMain");
  var elUserNome = document.getElementById("userNome");
  var elUserEmail = document.getElementById("userEmail");
  var elUserAvatar = document.getElementById("userAvatar");
  var elBtnSair = document.getElementById("btnSair");

  var estadoAtual = { edicaoId: null, estacaoId: null };

  var CURSO_LABELS = { "1-fase": "1ª Fase", "2-fase": "2ª Fase" };

  // ---------- Topbar ----------

  if (elUserNome) elUserNome.textContent = sessao.nome || "Aluno(a)";
  if (elUserEmail) {
    var rotuloCurso = aluno.curso && CURSO_LABELS[aluno.curso] ? " · Turma: " + CURSO_LABELS[aluno.curso] : "";
    elUserEmail.textContent = (sessao.email || "") + rotuloCurso;
  }
  if (elUserAvatar) {
    if (sessao.foto) {
      elUserAvatar.innerHTML = '<img src="' + escapeHtml(sessao.foto) + '" alt="" />';
    } else {
      var inicial = (sessao.nome || sessao.email || "A").trim().charAt(0).toUpperCase();
      elUserAvatar.textContent = inicial;
    }
  }
  if (elBtnSair) {
    elBtnSair.addEventListener("click", function () {
      limparSessao();
      window.location.href = "login.html";
    });

    if (ADMIN_EMAILS.indexOf((sessao.email || "").toLowerCase()) !== -1) {
      var linkAdmin = document.createElement("a");
      linkAdmin.href = "admin.html";
      linkAdmin.className = "plat-btn-sair";
      linkAdmin.style.marginRight = "10px";
      linkAdmin.textContent = "Painel Admin";
      elBtnSair.parentNode.insertBefore(linkAdmin, elBtnSair);
    }
  }

  // ---------- Bloqueio de acesso (pendente / removido / expirado) ----------

  if (!acessoLiberado(aluno)) {
    var elShell = document.querySelector(".plat-shell");
    var mensagem = "Seu acesso não está disponível no momento.";
    if (aluno.status === "pendente") {
      mensagem = "Seu cadastro foi recebido e está aguardando aprovação da equipe CRM na Mão. Assim que for liberado, este aviso desaparece e o conteúdo fica disponível aqui.";
    } else if (aluno.status === "removido") {
      mensagem = "Seu acesso à plataforma foi desativado. Se você acha que isso é um engano, entre em contato com a equipe CRM na Mão.";
    } else if (aluno.dataExpiracao && new Date(aluno.dataExpiracao) < new Date()) {
      mensagem = "Seu acesso expirou em " + new Date(aluno.dataExpiracao).toLocaleDateString("pt-BR") + ". Entre em contato com a equipe CRM na Mão para renovar.";
    }
    if (elShell) {
      elShell.innerHTML = '<div class="plat-boas-vindas plat-bloqueio"><h1>Acesso indisponível</h1><p>' + escapeHtml(mensagem) + "</p></div>";
    }
    return;
  }

  // ---------- Sidebar (cascata de edições / estações) ----------

  function contarConcluidas(edicao) {
    var progresso = progressoAtual();
    var concluidas = 0;
    edicao.estacoes.forEach(function (est) {
      var p = progresso[est.id];
      if (p && p.videos.every(Boolean)) concluidas += 1;
    });
    return concluidas;
  }

  function renderSidebar() {
    var html = "";
    PLATAFORMA_DADOS.edicoes.forEach(function (edicao) {
      var aberta = edicao.id === estadoAtual.edicaoId;
      var concluidas = contarConcluidas(edicao);
      html +=
        '<div class="plat-edicao ' + (aberta ? "is-aberta" : "") + '">' +
          '<button type="button" class="plat-edicao-cabecalho" data-edicao="' + edicao.id + '">' +
            '<span>' + escapeHtml(edicao.titulo) + '</span>' +
            '<span class="plat-edicao-progresso">' + concluidas + '/10</span>' +
          '</button>' +
          '<div class="plat-estacoes-lista">' +
            edicao.estacoes.map(function (est) {
              var progresso = progressoAtual()[est.id];
              var videosOk = progresso && progresso.videos.every(Boolean);
              var quizFeito = progresso && progresso.quiz && progresso.quiz.tentativas > 0;
              var ativa = est.id === estadoAtual.estacaoId;
              var iconeStatus = quizFeito ? "✅" : videosOk ? "🟡" : "⚪";
              return (
                '<button type="button" class="plat-estacao-item ' + (ativa ? "is-ativa" : "") + '" ' +
                  'data-edicao="' + edicao.id + '" data-estacao="' + est.id + '">' +
                  '<span class="plat-estacao-status">' + iconeStatus + '</span>' +
                  '<span>Estação ' + est.numero + '</span>' +
                '</button>'
              );
            }).join("") +
          '</div>' +
        '</div>';
    });
    elSidebar.innerHTML = html;

    elSidebar.querySelectorAll(".plat-edicao-cabecalho").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var edicaoId = btn.getAttribute("data-edicao");
        estadoAtual.edicaoId = estadoAtual.edicaoId === edicaoId ? null : edicaoId;
        renderSidebar();
      });
    });

    elSidebar.querySelectorAll(".plat-estacao-item").forEach(function (btn) {
      btn.addEventListener("click", function () {
        selecionarEstacao(btn.getAttribute("data-edicao"), btn.getAttribute("data-estacao"));
      });
    });
  }

  // ---------- Conteúdo principal (estação selecionada) ----------

  function renderVideoCard(estacao, idx) {
    var video = estacao.videos[idx];
    var progresso = getEstacaoProgresso(estacao.id, estacao.videos.length);
    var assistido = !!progresso.videos[idx];

    if (video.url) {
      return (
        '<div class="plat-video-card">' +
          '<p class="plat-video-titulo">' + escapeHtml(video.titulo) + '</p>' +
          '<video controls class="plat-video-player" data-estacao="' + estacao.id + '" data-idx="' + idx + '" src="' + escapeHtml(video.url) + '"></video>' +
          '<p class="plat-video-status ' + (assistido ? "is-ok" : "") + '">' +
            (assistido ? "✓ Assistido" : "Assista até o fim para marcar como concluído") +
          '</p>' +
        '</div>'
      );
    }

    return (
      '<div class="plat-video-card plat-video-card-pendente">' +
        '<p class="plat-video-titulo">' + escapeHtml(video.titulo) + '</p>' +
        '<div class="plat-video-placeholder">🎬 Vídeo em produção — em breve disponível aqui</div>' +
        '<button type="button" class="plat-btn-marcar ' + (assistido ? "is-marcado" : "") + '" data-estacao="' + estacao.id + '" data-idx="' + idx + '">' +
          (assistido ? "✓ Marcado como assistido" : "Marcar como assistido") +
        '</button>' +
      '</div>'
    );
  }

  function renderMaterialCard(estacao) {
    var material = estacao.material;
    if (material.url) {
      return (
        '<a class="plat-material-card" href="' + escapeHtml(material.url) + '" download target="_blank" rel="noopener">' +
          '<span>📄 ' + escapeHtml(material.titulo) + '</span>' +
          '<span class="plat-material-baixar">Baixar</span>' +
        '</a>'
      );
    }
    return (
      '<div class="plat-material-card plat-material-card-pendente">' +
        '<span>📄 ' + escapeHtml(material.titulo) + '</span>' +
        '<span class="plat-material-baixar">Em breve</span>' +
      '</div>'
    );
  }

  function renderQuizSection(estacao) {
    var progresso = getEstacaoProgresso(estacao.id, estacao.videos.length);
    var liberado = progresso.videos.every(Boolean);
    var quizInfo = progresso.quiz;

    var historico = "";
    if (quizInfo.tentativas > 0) {
      historico =
        '<p class="plat-quiz-historico">Última nota: <strong>' + quizInfo.ultimoAcertos + '/' + quizInfo.totalPerguntas + '</strong>' +
        ' · Melhor nota: <strong>' + quizInfo.melhorAcertos + '/' + quizInfo.totalPerguntas + '</strong>' +
        ' · ' + quizInfo.tentativas + ' tentativa(s)</p>';
    }

    var rotuloBotao = quizInfo.tentativas > 0 ? "Refazer quiz" : "Fazer quiz";

    return (
      '<div class="plat-quiz-box">' +
        '<h3>Quiz da estação</h3>' +
        (liberado
          ? '<button type="button" class="btn btn-plan plat-btn-quiz" id="btnIniciarQuiz">' + rotuloBotao + '</button>' + historico
          : '<p class="plat-quiz-bloqueado">🔒 Assista aos ' + estacao.videos.length + ' vídeos acima para liberar o quiz desta estação.</p>') +
      '</div>'
    );
  }

  function renderMain() {
    var achado = encontrarEstacao(estadoAtual.edicaoId, estadoAtual.estacaoId);
    if (!achado) {
      elMain.innerHTML =
        '<div class="plat-boas-vindas">' +
          '<h1>Olá, ' + escapeHtml((sessao.nome || "").split(" ")[0] || "aluno(a)") + '!</h1>' +
          '<p>Escolha uma edição do Revalida e uma estação no menu ao lado para começar a estudar.</p>' +
        '</div>';
      return;
    }

    var edicao = achado.edicao;
    var estacao = achado.estacao;

    elMain.innerHTML =
      '<div class="plat-breadcrumb">' + escapeHtml(edicao.titulo) + ' · Estação ' + estacao.numero + '</div>' +
      '<h1 class="plat-tema">' + escapeHtml(estacao.tema) + '</h1>' +
      '<div class="plat-videos-grid">' +
        estacao.videos.map(function (v, idx) { return renderVideoCard(estacao, idx); }).join("") +
      '</div>' +
      renderMaterialCard(estacao) +
      renderQuizSection(estacao);

    elMain.querySelectorAll(".plat-video-player").forEach(function (videoEl) {
      videoEl.addEventListener("ended", function () {
        var estId = videoEl.getAttribute("data-estacao");
        var idx = parseInt(videoEl.getAttribute("data-idx"), 10);
        marcarVideoAssistido(estId, idx, estacao.videos.length);
        renderSidebar();
        renderMain();
      });
    });

    elMain.querySelectorAll(".plat-btn-marcar").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var estId = btn.getAttribute("data-estacao");
        var idx = parseInt(btn.getAttribute("data-idx"), 10);
        marcarVideoAssistido(estId, idx, estacao.videos.length);
        renderSidebar();
        renderMain();
      });
    });

    var btnQuiz = document.getElementById("btnIniciarQuiz");
    if (btnQuiz) {
      btnQuiz.addEventListener("click", function () {
        abrirQuiz(estacao);
      });
    }
  }

  function selecionarEstacao(edicaoId, estacaoId) {
    estadoAtual.edicaoId = edicaoId;
    estadoAtual.estacaoId = estacaoId;
    renderSidebar();
    renderMain();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---------- Quiz (modal estilo MedClass) ----------

  var elQuizOverlay = document.getElementById("quizOverlay");
  var quizState = null;

  function abrirQuiz(estacao) {
    quizState = {
      estacao: estacao,
      perguntas: estacao.quiz,
      indice: 0,
      acertos: 0,
      pendente: null,
      respondida: false
    };
    elQuizOverlay.hidden = false;
    document.body.classList.add("plat-modal-aberto");
    renderQuizPergunta();
  }

  function fecharQuiz() {
    elQuizOverlay.hidden = true;
    document.body.classList.remove("plat-modal-aberto");
    quizState = null;
    renderSidebar();
    renderMain();
  }

  function renderQuizPergunta() {
    quizState.pendente = null;
    quizState.respondida = false;

    var pergunta = quizState.perguntas[quizState.indice];
    var total = quizState.perguntas.length;

    var html =
      '<div class="quiz-modal-card">' +
        '<div class="quiz-modal-topo">' +
          '<span class="quiz-modal-progresso">Questão ' + (quizState.indice + 1) + ' de ' + total + '</span>' +
          '<button type="button" class="quiz-modal-fechar" id="quizFechar" aria-label="Fechar quiz">✕</button>' +
        '</div>' +
        '<p class="quiz-pergunta">' + escapeHtml(pergunta.pergunta) + '</p>' +
        '<div class="quiz-opcoes">' +
          pergunta.alternativas.map(function (alt, idx) {
            return (
              '<button type="button" class="quiz-opcao" data-idx="' + idx + '">' +
                '<span class="quiz-opcao-letra">' + String.fromCharCode(65 + idx) + '</span>' +
                '<span>' + escapeHtml(alt) + '</span>' +
              '</button>'
            );
          }).join("") +
        '</div>' +
        '<div class="quiz-feedback" id="quizFeedback" hidden></div>' +
        '<button type="button" class="btn btn-plan quiz-btn-acao" id="quizBtnAcao" disabled>Confirmar resposta</button>' +
      '</div>';

    elQuizOverlay.innerHTML = html;

    document.getElementById("quizFechar").addEventListener("click", fecharQuiz);

    var opcoes = elQuizOverlay.querySelectorAll(".quiz-opcao");
    var btnAcao = document.getElementById("quizBtnAcao");

    opcoes.forEach(function (op) {
      op.addEventListener("click", function () {
        if (quizState.respondida) return;
        opcoes.forEach(function (o) { o.classList.remove("is-pendente"); });
        op.classList.add("is-pendente");
        quizState.pendente = parseInt(op.getAttribute("data-idx"), 10);
        btnAcao.disabled = false;
      });
    });

    btnAcao.addEventListener("click", function () {
      if (!quizState.respondida) {
        confirmarResposta();
      } else if (quizState.indice + 1 < total) {
        quizState.indice += 1;
        renderQuizPergunta();
      } else {
        finalizarQuiz();
      }
    });
  }

  function confirmarResposta() {
    var pergunta = quizState.perguntas[quizState.indice];
    var opcoes = elQuizOverlay.querySelectorAll(".quiz-opcao");
    var acertou = quizState.pendente === pergunta.correta;

    if (acertou) quizState.acertos += 1;
    quizState.respondida = true;

    opcoes.forEach(function (op) {
      var idx = parseInt(op.getAttribute("data-idx"), 10);
      op.classList.remove("is-pendente");
      op.disabled = true;
      if (idx === pergunta.correta) {
        op.classList.add("is-correta");
        op.insertAdjacentHTML("beforeend", '<span class="quiz-opcao-marca">✓</span>');
      } else if (idx === quizState.pendente) {
        op.classList.add("is-incorreta");
        op.insertAdjacentHTML("beforeend", '<span class="quiz-opcao-marca">✕</span>');
      }
    });

    var elFeedback = document.getElementById("quizFeedback");
    elFeedback.hidden = false;
    elFeedback.className = "quiz-feedback " + (acertou ? "is-correta" : "is-incorreta");
    elFeedback.innerHTML =
      '<p class="quiz-feedback-titulo">' + (acertou ? "🎉 Resposta correta!" : "❌ Resposta incorreta.") + '</p>' +
      '<p class="quiz-feedback-explicacao">' + escapeHtml(pergunta.explicacao) + '</p>';

    var btnAcao = document.getElementById("quizBtnAcao");
    var ultima = quizState.indice + 1 >= quizState.perguntas.length;
    btnAcao.textContent = ultima ? "Ver resultado" : "Próxima pergunta";
    btnAcao.disabled = false;
  }

  function finalizarQuiz() {
    var total = quizState.perguntas.length;
    var acertos = quizState.acertos;
    var porcentagem = Math.round((acertos / total) * 100);

    salvarResultadoQuiz(quizState.estacao.id, acertos, total);

    elQuizOverlay.innerHTML =
      '<div class="quiz-modal-card quiz-resultado">' +
        '<div class="quiz-resultado-icone">🏆</div>' +
        '<p class="quiz-resultado-nota">' + acertos + '/' + total + '</p>' +
        '<p class="quiz-resultado-detalhe">' + porcentagem + '% de aproveitamento</p>' +
        '<div class="quiz-resultado-acoes">' +
          '<button type="button" class="btn btn-plan-outline" id="quizRefazer">Refazer quiz</button>' +
          '<button type="button" class="btn btn-plan" id="quizFecharResultado">Fechar</button>' +
        '</div>' +
      '</div>';

    document.getElementById("quizRefazer").addEventListener("click", function () {
      abrirQuiz(quizState.estacao);
    });
    document.getElementById("quizFecharResultado").addEventListener("click", fecharQuiz);
  }

  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && elQuizOverlay && !elQuizOverlay.hidden) {
      fecharQuiz();
    }
  });

  // ---------- Início ----------

  renderSidebar();
  renderMain();
})();
