// CRM NA MÃO — Painel de Admin (gestão de alunos)
//
// PENDÊNCIA: lê/escreve tudo no AlunosStore (js/alunos-store.js), que hoje
// é só localStorage -- ou seja, o que você cadastra/aprova aqui só existe
// neste navegador. Ver pendência "Publicar o Apps Script" para o próximo
// passo (roster real, compartilhado entre admin e alunos).

(function () {
  "use strict";

  var CHAVE_SESSAO = "crmnamao_sessao";
  var ADMIN_EMAILS = window.ADMIN_EMAILS || [];

  // Mantenha esta lista igual ao array PRODUTOS do
  // google-apps-script-planilha-setup.gs.
  var PLANOS = ["Expresso", "Expresso + Pense", "Premium", "Premium + Pense", "Outro"];
  var CURSO_LABELS = { "1-fase": "1ª Fase", "2-fase": "2ª Fase" };
  var STATUS_LABELS = { pendente: "Pendente", ativo: "Ativo", removido: "Removido" };

  function getSessao() {
    try {
      var bruto = localStorage.getItem(CHAVE_SESSAO);
      return bruto ? JSON.parse(bruto) : null;
    } catch (erro) {
      return null;
    }
  }

  var sessao = getSessao();
  if (!sessao) {
    window.location.href = "login.html";
    return;
  }

  function escapeHtml(texto) {
    return String(texto == null ? "" : texto).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ---------- Topbar ----------

  var elUserNome = document.getElementById("userNome");
  var elUserEmail = document.getElementById("userEmail");
  var elUserAvatar = document.getElementById("userAvatar");
  var elBtnSair = document.getElementById("btnSair");

  if (elUserNome) elUserNome.textContent = sessao.nome || "Admin";
  if (elUserEmail) elUserEmail.textContent = sessao.email || "";
  if (elUserAvatar) {
    if (sessao.foto) {
      elUserAvatar.innerHTML = '<img src="' + escapeHtml(sessao.foto) + '" alt="" />';
    } else {
      elUserAvatar.textContent = (sessao.nome || sessao.email || "A").trim().charAt(0).toUpperCase();
    }
  }
  if (elBtnSair) {
    elBtnSair.addEventListener("click", function () {
      localStorage.removeItem(CHAVE_SESSAO);
      window.location.href = "login.html";
    });
  }

  var elMain = document.getElementById("adminMain");
  var elModalOverlay = document.getElementById("adminModalOverlay");

  // ---------- Gate: só e-mails de admin entram ----------

  if (ADMIN_EMAILS.indexOf((sessao.email || "").toLowerCase()) === -1) {
    elMain.innerHTML =
      '<div class="plat-bloqueio">' +
        "<h1>Acesso restrito</h1>" +
        "<p>Esta conta (" + escapeHtml(sessao.email || "") + ") não tem permissão de administrador.</p>" +
        '<p style="margin-top: 14px;"><a class="btn btn-plan-outline" href="plataforma.html">Voltar para a plataforma</a></p>' +
      "</div>";
    return;
  }

  // ---------- Estado ----------

  var estado = { filtroStatus: "todos", busca: "" };

  function alunoDeCadaEmail() {
    return AlunosStore.listar();
  }

  function alunosFiltrados() {
    var lista = alunoDeCadaEmail();
    if (estado.filtroStatus !== "todos") {
      lista = lista.filter(function (a) { return a.status === estado.filtroStatus; });
    }
    if (estado.busca.trim()) {
      var alvo = estado.busca.trim().toLowerCase();
      lista = lista.filter(function (a) {
        return (a.nome || "").toLowerCase().indexOf(alvo) !== -1 || (a.email || "").toLowerCase().indexOf(alvo) !== -1;
      });
    }
    return lista.sort(function (a, b) { return (b.criadoEm || "").localeCompare(a.criadoEm || ""); });
  }

  function estaExpirado(aluno) {
    return !!aluno.dataExpiracao && new Date(aluno.dataExpiracao) < new Date();
  }

  // ---------- Render principal ----------

  function renderAdmin() {
    var todos = alunoDeCadaEmail();
    var contagens = {
      todos: todos.length,
      pendente: todos.filter(function (a) { return a.status === "pendente"; }).length,
      ativo: todos.filter(function (a) { return a.status === "ativo"; }).length,
      removido: todos.filter(function (a) { return a.status === "removido"; }).length
    };

    var abas = [
      { chave: "todos", rotulo: "Todos" },
      { chave: "pendente", rotulo: "Pendentes" },
      { chave: "ativo", rotulo: "Ativos" },
      { chave: "removido", rotulo: "Removidos" }
    ];

    var lista = alunosFiltrados();

    var html =
      '<div class="admin-cabecalho">' +
        "<h1>Gestão de Alunos</h1>" +
        '<button type="button" class="btn btn-plan" id="btnNovoAluno">+ Adicionar aluno</button>' +
      "</div>" +
      '<div class="admin-filtros">' +
        '<div class="admin-abas">' +
          abas.map(function (a) {
            return (
              '<button type="button" class="admin-aba ' + (estado.filtroStatus === a.chave ? "is-ativa" : "") + '" data-filtro="' + a.chave + '">' +
                a.rotulo + ' <span class="admin-aba-contagem">' + contagens[a.chave] + "</span>" +
              "</button>"
            );
          }).join("") +
        "</div>" +
        '<input type="search" id="adminBusca" class="admin-busca" placeholder="Buscar por nome ou e-mail..." value="' + escapeHtml(estado.busca) + '" />' +
      "</div>";

    if (!lista.length) {
      html += '<p class="admin-vazio">Nenhum aluno encontrado.</p>';
    } else {
      html +=
        '<div class="admin-tabela-wrap"><table class="admin-tabela">' +
          "<thead><tr><th>Nome</th><th>E-mail</th><th>Turma</th><th>Plano</th><th>Status</th><th>Expiração</th><th></th></tr></thead>" +
          "<tbody>" +
          lista.map(function (a) {
            var expirado = estaExpirado(a);
            return (
              "<tr>" +
                "<td>" + escapeHtml(a.nome) + "</td>" +
                "<td>" + escapeHtml(a.email) + "</td>" +
                "<td>" + (a.curso && CURSO_LABELS[a.curso] ? CURSO_LABELS[a.curso] : "—") + "</td>" +
                "<td>" + (a.plano ? escapeHtml(a.plano) : "—") + "</td>" +
                "<td>" +
                  '<span class="admin-status admin-status-' + a.status + '">' + STATUS_LABELS[a.status] + "</span>" +
                  (expirado ? ' <span class="admin-status admin-status-expirado">Expirado</span>' : "") +
                "</td>" +
                "<td>" + (a.dataExpiracao ? new Date(a.dataExpiracao).toLocaleDateString("pt-BR") : "Sem expiração") + "</td>" +
                '<td class="admin-acoes">' +
                  (a.status === "pendente" ? '<button type="button" class="admin-link" data-acao="editar" data-id="' + a.id + '">Aprovar</button>' : '<button type="button" class="admin-link" data-acao="editar" data-id="' + a.id + '">Editar</button>') +
                  '<button type="button" class="admin-link" data-acao="historico" data-id="' + a.id + '">Histórico</button>' +
                  '<button type="button" class="admin-link admin-link-remover" data-acao="remover" data-id="' + a.id + '">Remover</button>' +
                "</td>" +
              "</tr>"
            );
          }).join("") +
          "</tbody></table></div>";
    }

    elMain.innerHTML = html;

    document.getElementById("btnNovoAluno").addEventListener("click", function () { abrirModalAluno(null); });

    elMain.querySelectorAll(".admin-aba").forEach(function (btn) {
      btn.addEventListener("click", function () {
        estado.filtroStatus = btn.getAttribute("data-filtro");
        renderAdmin();
      });
    });

    var elBusca = document.getElementById("adminBusca");
    elBusca.addEventListener("input", function () {
      estado.busca = elBusca.value;
      renderAdmin();
      var novoInput = document.getElementById("adminBusca");
      novoInput.focus();
      novoInput.setSelectionRange(novoInput.value.length, novoInput.value.length);
    });

    elMain.querySelectorAll('[data-acao="editar"]').forEach(function (btn) {
      btn.addEventListener("click", function () { abrirModalAluno(btn.getAttribute("data-id")); });
    });
    elMain.querySelectorAll('[data-acao="historico"]').forEach(function (btn) {
      btn.addEventListener("click", function () { abrirModalHistorico(btn.getAttribute("data-id")); });
    });
    elMain.querySelectorAll('[data-acao="remover"]').forEach(function (btn) {
      btn.addEventListener("click", function () {
        var aluno = AlunosStore.buscarPorId(btn.getAttribute("data-id"));
        if (!aluno) return;
        if (window.confirm('Remover "' + aluno.nome + '" (' + aluno.email + ")? Essa ação não pode ser desfeita.")) {
          AlunosStore.remover(aluno.id);
          renderAdmin();
        }
      });
    });
  }

  // ---------- Modal: adicionar/editar aluno ----------

  function fecharModal() {
    elModalOverlay.hidden = true;
    elModalOverlay.innerHTML = "";
    document.body.classList.remove("plat-modal-aberto");
  }

  function toDatetimeLocalValue(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    var pad = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function abrirModalAluno(alunoId) {
    var aluno = alunoId ? AlunosStore.buscarPorId(alunoId) : null;
    var ehNovo = !aluno;

    var html =
      '<div class="admin-modal-card">' +
        '<div class="admin-modal-topo">' +
          "<h2>" + (ehNovo ? "Adicionar aluno" : "Editar aluno") + "</h2>" +
          '<button type="button" class="quiz-modal-fechar" id="modalFechar" aria-label="Fechar">✕</button>' +
        "</div>" +
        '<div class="admin-modal-campo">' +
          "<label>Nome</label>" +
          '<input type="text" id="campoNome" value="' + escapeHtml(aluno ? aluno.nome : "") + '" />' +
        "</div>" +
        '<div class="admin-modal-campo">' +
          "<label>E-mail</label>" +
          '<input type="email" id="campoEmail" value="' + escapeHtml(aluno ? aluno.email : "") + '" ' + (ehNovo ? "" : "disabled") + " />" +
        "</div>" +
        '<div class="admin-modal-linha">' +
          '<div class="admin-modal-campo">' +
            "<label>Turma</label>" +
            '<select id="campoCurso">' +
              '<option value="">— não definida —</option>' +
              '<option value="1-fase"' + (aluno && aluno.curso === "1-fase" ? " selected" : "") + ">1ª Fase</option>" +
              '<option value="2-fase"' + (aluno && aluno.curso === "2-fase" ? " selected" : "") + ">2ª Fase</option>" +
            "</select>" +
          "</div>" +
          '<div class="admin-modal-campo">' +
            "<label>Plano</label>" +
            '<select id="campoPlano">' +
              '<option value="">— não definido —</option>' +
              PLANOS.map(function (p) { return '<option value="' + escapeHtml(p) + '"' + (aluno && aluno.plano === p ? " selected" : "") + ">" + escapeHtml(p) + "</option>"; }).join("") +
            "</select>" +
          "</div>" +
        "</div>" +
        '<div class="admin-modal-campo">' +
          "<label>Status</label>" +
          '<select id="campoStatus">' +
            '<option value="pendente"' + (aluno && aluno.status === "pendente" ? " selected" : "") + ">Pendente</option>" +
            '<option value="ativo"' + (ehNovo || (aluno && aluno.status === "ativo") ? " selected" : "") + ">Ativo</option>" +
            '<option value="removido"' + (aluno && aluno.status === "removido" ? " selected" : "") + ">Removido</option>" +
          "</select>" +
        "</div>" +
        '<div class="admin-modal-campo">' +
          "<label>Data de expiração do acesso</label>" +
          '<input type="datetime-local" id="campoExpiracao" value="' + toDatetimeLocalValue(aluno ? aluno.dataExpiracao : null) + '" />' +
          '<div class="admin-modal-atalhos">' +
            '<button type="button" class="btn btn-plan-outline" data-dias="30">+30 dias</button>' +
            '<button type="button" class="btn btn-plan-outline" data-dias="90">+90 dias</button>' +
            '<button type="button" class="btn btn-plan-outline" data-dias="0">Sem expiração</button>' +
          "</div>" +
          '<p class="admin-modal-ajuda">Depois dessa data o acesso é bloqueado automaticamente. Deixe em branco para não expirar.</p>' +
        "</div>" +
        '<div class="admin-modal-acoes">' +
          '<button type="button" class="btn btn-plan-outline" id="modalCancelar">Cancelar</button>' +
          '<button type="button" class="btn btn-plan" id="modalSalvar">Salvar</button>' +
        "</div>" +
      "</div>";

    elModalOverlay.innerHTML = html;
    elModalOverlay.hidden = false;
    document.body.classList.add("plat-modal-aberto");

    document.getElementById("modalFechar").addEventListener("click", fecharModal);
    document.getElementById("modalCancelar").addEventListener("click", fecharModal);

    elModalOverlay.querySelectorAll("[data-dias]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var dias = parseInt(btn.getAttribute("data-dias"), 10);
        var campo = document.getElementById("campoExpiracao");
        if (dias === 0) {
          campo.value = "";
        } else {
          var data = new Date();
          data.setDate(data.getDate() + dias);
          campo.value = toDatetimeLocalValue(data.toISOString());
        }
      });
    });

    document.getElementById("modalSalvar").addEventListener("click", function () {
      var nome = document.getElementById("campoNome").value.trim();
      var email = document.getElementById("campoEmail").value.trim();
      var expiracaoValor = document.getElementById("campoExpiracao").value;

      if (!nome || !email) {
        window.alert("Preencha nome e e-mail.");
        return;
      }

      var dados = {
        nome: nome,
        email: email,
        curso: document.getElementById("campoCurso").value || null,
        plano: document.getElementById("campoPlano").value || null,
        status: document.getElementById("campoStatus").value,
        dataExpiracao: expiracaoValor ? new Date(expiracaoValor).toISOString() : null
      };

      if (ehNovo) {
        if (AlunosStore.buscarPorEmail(email)) {
          window.alert("Já existe um aluno cadastrado com esse e-mail.");
          return;
        }
        AlunosStore.criar(dados);
      } else {
        AlunosStore.atualizar(aluno.id, dados);
      }

      fecharModal();
      renderAdmin();
    });
  }

  // ---------- Modal: histórico de treinamento ----------

  function abrirModalHistorico(alunoId) {
    var aluno = AlunosStore.buscarPorId(alunoId);
    if (!aluno) return;

    var progresso = aluno.progresso || {};
    var linhasEdicoes = [];
    var totalEstacoesConcluidas = 0;
    var totalQuizzesFeitos = 0;
    var somaMelhorAproveitamento = 0;

    (window.PLATAFORMA_DADOS ? PLATAFORMA_DADOS.edicoes : []).forEach(function (edicao) {
      var linhasEstacoes = [];
      edicao.estacoes.forEach(function (est) {
        var p = progresso[est.id];
        if (!p) return;
        var videosAssistidos = (p.videos || []).filter(Boolean).length;
        var totalVideos = est.videos.length;
        if (videosAssistidos === totalVideos) totalEstacoesConcluidas += 1;
        var quiz = p.quiz || { tentativas: 0 };
        if (quiz.tentativas > 0) {
          totalQuizzesFeitos += 1;
          somaMelhorAproveitamento += quiz.totalPerguntas ? (quiz.melhorAcertos / quiz.totalPerguntas) : 0;
        }
        linhasEstacoes.push(
          "<tr>" +
            "<td>Estação " + est.numero + "</td>" +
            "<td>" + videosAssistidos + "/" + totalVideos + " vídeos</td>" +
            "<td>" + (quiz.tentativas > 0 ? ("Melhor: " + quiz.melhorAcertos + "/" + quiz.totalPerguntas + " · " + quiz.tentativas + " tentativa(s)") : "Não fez o quiz") + "</td>" +
          "</tr>"
        );
      });
      if (linhasEstacoes.length) {
        linhasEdicoes.push(
          '<div class="admin-historico-edicao">' +
            "<h3>" + escapeHtml(edicao.titulo) + "</h3>" +
            '<table class="admin-tabela admin-tabela-compacta"><tbody>' + linhasEstacoes.join("") + "</tbody></table>" +
          "</div>"
        );
      }
    });

    var mediaAproveitamento = totalQuizzesFeitos ? Math.round((somaMelhorAproveitamento / totalQuizzesFeitos) * 100) : 0;

    var html =
      '<div class="admin-modal-card admin-modal-historico">' +
        '<div class="admin-modal-topo">' +
          "<h2>Histórico — " + escapeHtml(aluno.nome) + "</h2>" +
          '<button type="button" class="quiz-modal-fechar" id="modalFechar" aria-label="Fechar">✕</button>' +
        "</div>" +
        '<div class="admin-historico-resumo">' +
          '<div><strong>' + totalEstacoesConcluidas + "</strong><span>estações concluídas</span></div>" +
          '<div><strong>' + totalQuizzesFeitos + "</strong><span>quizzes realizados</span></div>" +
          '<div><strong>' + mediaAproveitamento + "%</strong><span>aproveitamento médio</span></div>" +
        "</div>" +
        (linhasEdicoes.length ? linhasEdicoes.join("") : '<p class="admin-vazio">Este aluno ainda não iniciou nenhuma estação.</p>') +
      "</div>";

    elModalOverlay.innerHTML = html;
    elModalOverlay.hidden = false;
    document.body.classList.add("plat-modal-aberto");
    document.getElementById("modalFechar").addEventListener("click", fecharModal);
  }

  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && elModalOverlay && !elModalOverlay.hidden) fecharModal();
  });

  renderAdmin();
})();
