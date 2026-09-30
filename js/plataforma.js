// CRM NA MÃO — Plataforma do Aluno
//
// PENDÊNCIA: o cadastro de alunos e o progresso (vídeos assistidos, notas
// do quiz, "concluída") hoje vivem no AlunosStore (js/alunos-store.js), que
// salva tudo no localStorage do navegador -- não existe backend/banco de
// dados pra isso ainda (feedback/avisos já usam a planilha via
// js/feedback-store.js, mas o progresso do aluno em si continua local).
// Quando o backend existir, o AlunosStore passa a chamar uma API em vez do
// localStorage, e este arquivo não precisa mudar.

(function () {
  "use strict";

  var CHAVE_SESSAO = "crmnamao_sessao";
  var ADMIN_EMAILS = window.ADMIN_EMAILS || [];

  var ICONE_DOC =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M7 3.5h7l4 4v13a1 1 0 01-1 1H7a1 1 0 01-1-1v-16a1 1 0 011-1z"/><path d="M14 3.5V8h4"/>' +
    '<path d="M9 12.5h6M9 15.5h6M9 18.5h3"/></svg>';
  var ICONE_CONFERIDO =
    '<svg viewBox="0 0 24 24" fill="currentColor">' +
    '<path d="M12 2a10 10 0 100 20 10 10 0 000-20zm-1.2 14.6l-4.4-4.4 1.4-1.4 3 3 6-6 1.4 1.4-7.4 7.4z"/></svg>';

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

  // ---------- Progresso (vídeos assistidos + quiz + "concluída"), via AlunosStore ----------

  function progressoAtual() {
    var atual = AlunosStore.buscarPorId(aluno.id);
    return (atual && atual.progresso) || {};
  }

  function getItemProgresso(itemId, totalVideos) {
    return AlunosStore.obterProgressoEstacao(aluno.id, itemId, totalVideos);
  }

  function marcarVideoAssistido(itemId, idx, totalVideos) {
    AlunosStore.marcarVideoAssistido(aluno.id, itemId, idx, totalVideos);
  }

  function salvarResultadoQuiz(itemId, acertos, total) {
    AlunosStore.salvarResultadoQuiz(aluno.id, itemId, acertos, total);
  }

  // ---------- Utilidades ----------

  function escapeHtml(texto) {
    return String(texto == null ? "" : texto).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function encontrarItem(grupoId, itemId) {
    var grupo = PLATAFORMA_DADOS.grupos.find(function (g) { return g.id === grupoId; });
    if (!grupo) return null;
    var item = grupo.itens.find(function (i) { return i.id === itemId; });
    return item ? { grupo: grupo, item: item } : null;
  }

  function itemConcluido(item) {
    var progresso = progressoAtual()[item.id];
    if (!progresso) return false;
    var todosVideosAssistidos = item.videos.length > 0 && item.videos.every(function (v, idx) { return !!progresso.videos[idx]; });
    if (item.quiz) {
      return todosVideosAssistidos && !!(progresso.quiz && progresso.quiz.tentativas > 0);
    }
    return todosVideosAssistidos;
  }

  // ---------- Elementos ----------

  var elSidebar = document.getElementById("plataformaSidebar");
  var elMain = document.getElementById("plataformaMain");
  var elUserNome = document.getElementById("userNome");
  var elUserEmail = document.getElementById("userEmail");
  var elUserAvatar = document.getElementById("userAvatar");
  var elBtnSair = document.getElementById("btnSair");
  var elUserDropWrapper = document.getElementById("userDropWrapper");
  var elBtnUserDrop = document.getElementById("btnUserDrop");
  var elUserDropPainel = document.getElementById("userDropPainel");

  var estadoAtual = { grupoId: null, itemId: null };

  var CURSO_LABELS = { "1-fase": "1ª Fase", "2-fase": "2ª Fase" };

  // ---------- Topbar ----------

  function atualizarAvatar() {
    if (!elUserAvatar) return;
    var fotoPersonalizada = aluno.foto;
    if (fotoPersonalizada) {
      elUserAvatar.innerHTML = '<img src="' + fotoPersonalizada + '" alt="" />';
    } else if (sessao.foto) {
      elUserAvatar.innerHTML = '<img src="' + escapeHtml(sessao.foto) + '" alt="" />';
    } else {
      var inicial = (aluno.nome || sessao.nome || sessao.email || "A").trim().charAt(0).toUpperCase();
      elUserAvatar.textContent = inicial;
    }
  }

  if (elUserNome) elUserNome.textContent = aluno.nome || sessao.nome || "Aluno(a)";
  if (elUserEmail) {
    var rotuloCurso = aluno.curso && CURSO_LABELS[aluno.curso] ? " · Turma: " + CURSO_LABELS[aluno.curso] : "";
    elUserEmail.textContent = (sessao.email || "") + rotuloCurso;
  }
  atualizarAvatar();

  if (elBtnSair) {
    elBtnSair.addEventListener("click", function () {
      limparSessao();
      window.location.href = "login.html";
    });

    if (ehAdmin) {
      var linkAdmin = document.createElement("a");
      linkAdmin.href = "admin.html";
      linkAdmin.className = "plat-userdrop-item";
      linkAdmin.textContent = "Painel Admin";
      elBtnSair.parentNode.insertBefore(linkAdmin, elBtnSair);
    }
  }

  if (elBtnUserDrop && elUserDropPainel && elUserDropWrapper) {
    elBtnUserDrop.addEventListener("click", function (ev) {
      ev.stopPropagation();
      var abrir = elUserDropPainel.hidden;
      elUserDropPainel.hidden = !abrir;
      elBtnUserDrop.setAttribute("aria-expanded", abrir ? "true" : "false");
    });
    document.addEventListener("click", function (ev) {
      if (!elUserDropPainel.hidden && !elUserDropWrapper.contains(ev.target)) {
        elUserDropPainel.hidden = true;
        elBtnUserDrop.setAttribute("aria-expanded", "false");
      }
    });
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

  // ---------- Sidebar (grupos: Esqueletos, Aulas com Especialistas, Edições) ----------

  function contarConcluidos(grupo) {
    var concluidas = 0;
    grupo.itens.forEach(function (item) {
      if (itemConcluido(item)) concluidas += 1;
    });
    return concluidas;
  }

  function renderSidebar() {
    var html = "";
    PLATAFORMA_DADOS.grupos.forEach(function (grupo) {
      var aberta = grupo.id === estadoAtual.grupoId;
      var concluidas = contarConcluidos(grupo);
      html +=
        '<div class="plat-edicao ' + (aberta ? "is-aberta" : "") + '">' +
          '<button type="button" class="plat-edicao-cabecalho" data-grupo="' + grupo.id + '">' +
            '<span>' + escapeHtml(grupo.titulo) + '</span>' +
            '<span class="plat-edicao-progresso">' + concluidas + '/' + grupo.itens.length + '</span>' +
          '</button>' +
          '<div class="plat-estacoes-lista">' +
            grupo.itens.map(function (item) {
              var ativa = item.id === estadoAtual.itemId;
              var concluido = itemConcluido(item);
              var rotulo = escapeHtml(item.titulo) + (item.emBreve ? " - EM BREVE" : "");
              return (
                '<button type="button" class="plat-estacao-item ' + (ativa ? "is-ativa" : "") + (concluido ? " is-concluida" : "") + '" ' +
                  'data-grupo="' + grupo.id + '" data-item="' + item.id + '">' +
                  '<span class="plat-estacao-icone">' + ICONE_DOC + '</span>' +
                  '<span>' + rotulo + '</span>' +
                  (concluido ? '<span class="plat-estacao-check">' + ICONE_CONFERIDO + '</span>' : "") +
                '</button>'
              );
            }).join("") +
          '</div>' +
        '</div>';
    });
    elSidebar.innerHTML = html;

    elSidebar.querySelectorAll(".plat-edicao-cabecalho").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var grupoId = btn.getAttribute("data-grupo");
        estadoAtual.grupoId = estadoAtual.grupoId === grupoId ? null : grupoId;
        renderSidebar();
      });
    });

    elSidebar.querySelectorAll(".plat-estacao-item").forEach(function (btn) {
      btn.addEventListener("click", function () {
        selecionarItem(btn.getAttribute("data-grupo"), btn.getAttribute("data-item"));
      });
    });
  }

  // ---------- Conteúdo principal (item selecionado) ----------

  var DESCRICAO_VIDEO_ESTACAO = [
    "Vídeo 1: simulação da prova desta estação, do jeito que ela cai no exame.",
    "Vídeo 2: a mesma simulação, comentada por um professor explicando a condução ideal."
  ];

  function renderVideoCard(item, idx) {
    var video = item.videos[idx];
    var progresso = getItemProgresso(item.id, item.videos.length);
    var assistido = !!progresso.videos[idx];
    var descricaoPadrao = item.videos.length === 2 ? DESCRICAO_VIDEO_ESTACAO[idx] : null;

    if (video.url) {
      return (
        '<div class="plat-video-card">' +
          '<p class="plat-video-titulo">' + escapeHtml(video.titulo) + '</p>' +
          (descricaoPadrao ? '<p class="plat-video-descricao">' + escapeHtml(descricaoPadrao) + '</p>' : "") +
          '<video controls playsinline webkit-playsinline controlsList="nodownload" class="plat-video-player" data-item="' + item.id + '" data-idx="' + idx + '" src="' + escapeHtml(video.url) + '"></video>' +
          '<p class="plat-video-status ' + (assistido ? "is-ok" : "") + '">' +
            (assistido ? "✓ Assistido" : "Assista até o fim (100%) para marcar como concluído") +
          '</p>' +
          '<button type="button" class="plat-btn-marcar" data-item="' + item.id + '" data-idx="' + idx + '" data-acao="' + (assistido ? "reassistir" : "marcar") + '">' +
            (assistido ? "Assistir novamente" : "Já assisti, marcar como concluído") +
          '</button>' +
        '</div>'
      );
    }

    return (
      '<div class="plat-video-card plat-video-card-pendente">' +
        '<p class="plat-video-titulo">' + escapeHtml(video.titulo) + '</p>' +
        (descricaoPadrao ? '<p class="plat-video-descricao">' + escapeHtml(descricaoPadrao) + '</p>' : "") +
        '<div class="plat-video-placeholder">🎬 Vídeo em produção — em breve disponível aqui</div>' +
        '<button type="button" class="plat-btn-marcar ' + (assistido ? "is-marcado" : "") + '" data-item="' + item.id + '" data-idx="' + idx + '" data-acao="marcar">' +
          (assistido ? "✓ Marcado como assistido" : "Marcar como assistido") +
        '</button>' +
      '</div>'
    );
  }

  function renderMaterialCard(item) {
    var material = item.material;
    if (!material) return "";
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

  function renderQuizSecaoEmbutida(item) {
    var progresso = getItemProgresso(item.id, item.videos.length);
    var todosAssistidos = item.videos.every(function (v, idx) { return !!progresso.videos[idx]; });
    var quizInfo = progresso.quiz;
    var totalPerguntas = item.quiz.length;
    var rotuloPerguntas = totalPerguntas + (totalPerguntas > 1 ? " perguntas" : " pergunta");

    if (!todosAssistidos) {
      return (
        '<div class="plat-quiz-box plat-quiz-bloqueado">' +
          '<h3>Quiz (' + rotuloPerguntas + ')</h3>' +
          '<p class="plat-quiz-aviso">🔒 Assista os vídeos desta estação até o fim pra liberar o quiz.</p>' +
        '</div>'
      );
    }

    var historico = "";
    if (quizInfo.tentativas > 0) {
      historico =
        '<p class="plat-quiz-historico">Última nota: <strong>' + quizInfo.ultimoAcertos + '/' + quizInfo.totalPerguntas + '</strong>' +
        ' · Melhor nota: <strong>' + quizInfo.melhorAcertos + '/' + quizInfo.totalPerguntas + '</strong>' +
        ' · ' + quizInfo.tentativas + ' tentativa(s)</p>';
    }
    var rotuloBotao = quizInfo.tentativas > 0 ? "Refazer quiz" : "Iniciar quiz";
    return (
      '<div class="plat-quiz-box">' +
        '<h3>Quiz (' + rotuloPerguntas + ')</h3>' +
        '<button type="button" class="btn btn-plan plat-btn-quiz" id="btnIniciarQuiz">' + rotuloBotao + '</button>' +
        historico +
      '</div>'
    );
  }

  function renderMain() {
    var achado = encontrarItem(estadoAtual.grupoId, estadoAtual.itemId);
    if (!achado) {
      elMain.innerHTML =
        '<div class="plat-boas-vindas">' +
          '<h1>Olá, ' + escapeHtml((aluno.nome || sessao.nome || "").split(" ")[0] || "aluno(a)") + '!</h1>' +
          '<p>Escolha um item no menu ao lado para começar a estudar.</p>' +
        '</div>';
      return;
    }

    var grupo = achado.grupo;
    var item = achado.item;

    elMain.innerHTML =
      '<div class="plat-breadcrumb">' + escapeHtml(grupo.titulo) + '</div>' +
      '<h1 class="plat-tema">' + escapeHtml(item.titulo) + '</h1>' +
      '<div class="plat-videos-grid">' +
        item.videos.map(function (v, idx) { return renderVideoCard(item, idx); }).join("") +
      '</div>' +
      renderMaterialCard(item) +
      (item.quiz ? renderQuizSecaoEmbutida(item) : "");

    elMain.querySelectorAll(".plat-video-player").forEach(function (videoEl) {
      var maiorTempoAssistido = 0;
      videoEl.addEventListener("timeupdate", function () {
        if (!videoEl.seeking) maiorTempoAssistido = Math.max(maiorTempoAssistido, videoEl.currentTime);
      });
      videoEl.addEventListener("seeking", function () {
        // Impede pular pra frente sem assistir -- só permite voltar pra rever trechos.
        if (videoEl.currentTime > maiorTempoAssistido + 1) videoEl.currentTime = maiorTempoAssistido;
      });
      videoEl.addEventListener("ended", function () {
        var idx = parseInt(videoEl.getAttribute("data-idx"), 10);
        marcarVideoAssistido(item.id, idx, item.videos.length);
        renderSidebar();
        renderMain();
      });
    });

    elMain.querySelectorAll(".plat-btn-marcar").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var idx = parseInt(btn.getAttribute("data-idx"), 10);
        if (btn.getAttribute("data-acao") === "reassistir") {
          var videoEl = elMain.querySelector('.plat-video-player[data-idx="' + idx + '"]');
          if (videoEl) { videoEl.currentTime = 0; videoEl.play(); }
          return;
        }
        marcarVideoAssistido(item.id, idx, item.videos.length);
        renderSidebar();
        renderMain();
      });
    });

    var btnQuiz = document.getElementById("btnIniciarQuiz");
    if (btnQuiz) {
      btnQuiz.addEventListener("click", function () { abrirQuiz(item); });
    }
  }

  function selecionarItem(grupoId, itemId) {
    estadoAtual.grupoId = grupoId;
    estadoAtual.itemId = itemId;
    renderSidebar();
    renderMain();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---------- Quiz (modal estilo MedClass) ----------

  var elQuizOverlay = document.getElementById("quizOverlay");
  var quizState = null;

  function abrirQuiz(item) {
    quizState = {
      item: item,
      perguntas: item.quiz,
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

    salvarResultadoQuiz(quizState.item.id, acertos, total);

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
      abrirQuiz(quizState.item);
    });
    document.getElementById("quizFecharResultado").addEventListener("click", fecharQuiz);
  }

  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && elQuizOverlay && !elQuizOverlay.hidden) {
      fecharQuiz();
    }
  });

  // ---------- Catálogo de vídeos (ano/estação/tipo -> URL real no R2) ----------
  //
  // Preenchido pelo admin (aba Vídeos) via Worker; fica salvo como
  // catalogo.json no mesmo bucket R2 dos vídeos. Aqui só sobrescrevemos os
  // campos `url` (null por padrão) do PLATAFORMA_DADOS gerado.

  function aplicarCatalogoVideos(catalogo) {
    if (!catalogo) return;
    PLATAFORMA_DADOS.grupos.forEach(function (grupo) {
      grupo.itens.forEach(function (item) {
        if (item.tipo !== "video") return;
        var entrada = catalogo[item.id];
        if (!entrada) return;
        // Estações com 2 vídeos (Revalida): slot 0 = original, slot 1 = comentado.
        // Itens com 1 vídeo (Esqueletos, Aulas com Especialistas): só usa "original".
        if (entrada.original) item.videos[0].url = entrada.original;
        if (entrada.comentado && item.videos[1]) item.videos[1].url = entrada.comentado;
      });
    });
  }

  if (window.VIDEOS_PUBLIC_BASE_URL) {
    fetch(window.VIDEOS_PUBLIC_BASE_URL.replace(/\/$/, "") + "/catalogo.json", { cache: "no-store" })
      .then(function (resp) { return resp.ok ? resp.json() : null; })
      .catch(function () { return null; })
      .then(function (catalogo) {
        if (!catalogo) return;
        aplicarCatalogoVideos(catalogo);
        renderSidebar();
        renderMain();
      });
  }

  // ---------- Início ----------

  renderSidebar();
  renderMain();

  window.PlataformaCtx = { sessao: sessao, aluno: aluno, atualizarAvatar: atualizarAvatar, escapeHtml: escapeHtml };
})();
