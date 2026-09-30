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

  // WORKER_URL vem de window.VIDEO_WORKER_URL (js/admin-config.js).
  // WORKER_ADMIN_TOKEN é o mesmo valor configurado com
  // `wrangler secret put ADMIN_TOKEN` no Worker (ver /worker, fora deste repo).
  var WORKER_URL = window.VIDEO_WORKER_URL || "";
  var WORKER_ADMIN_TOKEN = "1888e22c146cff203f5a2ac2bd179f10e71792a8cb86f9924326b99720b2d042";

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

  var estado = { view: "alunos", filtroStatus: "todos", busca: "" };
  var filaVideos = [];
  var cacheFeedback = [];
  var cacheAvisos = [];

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

  // ---------- Render principal (seletor de view + delega pra cada aba) ----------

  function renderAdmin() {
    var abasView = [
      { chave: "alunos", rotulo: "Alunos" },
      { chave: "feedbacks", rotulo: "Feedbacks" },
      { chave: "avisos", rotulo: "Avisos" },
      { chave: "videos", rotulo: "Vídeos" }
    ];
    elMain.innerHTML =
      '<div class="admin-view-switch">' +
        abasView.map(function (v) {
          return '<button type="button" class="admin-view-tab ' + (estado.view === v.chave ? "is-ativa" : "") + '" data-view="' + v.chave + '">' + v.rotulo + "</button>";
        }).join("") +
      "</div>" +
      '<div id="adminViewBody"></div>';

    elMain.querySelectorAll(".admin-view-tab").forEach(function (btn) {
      btn.addEventListener("click", function () {
        estado.view = btn.getAttribute("data-view");
        renderAdmin();
      });
    });

    if (estado.view === "feedbacks") renderFeedbacksView();
    else if (estado.view === "avisos") renderAvisosView();
    else if (estado.view === "videos") renderVideosView();
    else renderAlunosView();
  }

  // ---------- View: Alunos ----------

  function renderAlunosView() {
    var elViewBody = document.getElementById("adminViewBody");
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

    elViewBody.innerHTML = html;

    document.getElementById("btnNovoAluno").addEventListener("click", function () { abrirModalAluno(null); });

    elViewBody.querySelectorAll(".admin-aba").forEach(function (btn) {
      btn.addEventListener("click", function () {
        estado.filtroStatus = btn.getAttribute("data-filtro");
        renderAlunosView();
      });
    });

    var elBusca = document.getElementById("adminBusca");
    elBusca.addEventListener("input", function () {
      estado.busca = elBusca.value;
      renderAlunosView();
      var novoInput = document.getElementById("adminBusca");
      novoInput.focus();
      novoInput.setSelectionRange(novoInput.value.length, novoInput.value.length);
    });

    elViewBody.querySelectorAll('[data-acao="editar"]').forEach(function (btn) {
      btn.addEventListener("click", function () { abrirModalAluno(btn.getAttribute("data-id")); });
    });
    elViewBody.querySelectorAll('[data-acao="historico"]').forEach(function (btn) {
      btn.addEventListener("click", function () { abrirModalHistorico(btn.getAttribute("data-id")); });
    });
    elViewBody.querySelectorAll('[data-acao="remover"]').forEach(function (btn) {
      btn.addEventListener("click", function () {
        var aluno = AlunosStore.buscarPorId(btn.getAttribute("data-id"));
        if (!aluno) return;
        if (window.confirm('Remover "' + aluno.nome + '" (' + aluno.email + ")? Essa ação não pode ser desfeita.")) {
          AlunosStore.remover(aluno.id);
          renderAlunosView();
        }
      });
    });
  }

  // ---------- View: Feedbacks ----------

  var FEEDBACK_STATUS_LABELS = { "Aberto": "Aberto", "Respondido": "Respondido" };

  function renderFeedbacksView() {
    var elViewBody = document.getElementById("adminViewBody");
    elViewBody.innerHTML = '<p class="admin-vazio">Carregando feedbacks...</p>';

    window.FeedbackAPI.listarAdmin().then(function (resultado) {
      if (estado.view !== "feedbacks") return; // usuário já trocou de aba
      if (!resultado || !resultado.ok) {
        elViewBody.innerHTML = '<p class="admin-vazio">Não foi possível carregar os feedbacks agora. Confira se o Apps Script já foi reimplantado com as abas novas.</p>';
        return;
      }
      cacheFeedback = resultado.itens.sort(function (a, b) { return new Date(b.dataHora) - new Date(a.dataHora); });

      if (!cacheFeedback.length) {
        elViewBody.innerHTML = '<p class="admin-vazio">Nenhum feedback recebido ainda.</p>';
        return;
      }

      elViewBody.innerHTML =
        '<div class="admin-tabela-wrap"><table class="admin-tabela">' +
          "<thead><tr><th>Nome</th><th>E-mail</th><th>Categoria</th><th>Mensagem</th><th>Status</th><th>Data</th><th></th></tr></thead>" +
          "<tbody>" +
          cacheFeedback.map(function (f) {
            return (
              "<tr>" +
                "<td>" + escapeHtml(f.nome) + "</td>" +
                "<td>" + escapeHtml(f.email) + "</td>" +
                "<td>" + escapeHtml(f.categoria) + "</td>" +
                "<td>" + escapeHtml((f.mensagem || "").slice(0, 60)) + ((f.mensagem || "").length > 60 ? "…" : "") + "</td>" +
                '<td><span class="admin-status admin-status-' + (f.status === "Respondido" ? "ativo" : "pendente") + '">' + (FEEDBACK_STATUS_LABELS[f.status] || f.status) + "</span></td>" +
                "<td>" + new Date(f.dataHora).toLocaleDateString("pt-BR") + "</td>" +
                '<td class="admin-acoes"><button type="button" class="admin-link" data-id="' + f.id + '">' + (f.status === "Respondido" ? "Ver / editar resposta" : "Responder") + "</button></td>" +
              "</tr>"
            );
          }).join("") +
          "</tbody></table></div>";

      elViewBody.querySelectorAll("[data-id]").forEach(function (btn) {
        btn.addEventListener("click", function () { abrirModalResponderFeedback(btn.getAttribute("data-id")); });
      });
    });
  }

  function abrirModalResponderFeedback(id) {
    var item = cacheFeedback.find(function (f) { return f.id === id; });
    if (!item) return;

    var html =
      '<div class="admin-modal-card">' +
        '<div class="admin-modal-topo">' +
          "<h2>Feedback de " + escapeHtml(item.nome) + "</h2>" +
          '<button type="button" class="quiz-modal-fechar" id="modalFechar" aria-label="Fechar">✕</button>' +
        "</div>" +
        '<p class="admin-modal-ajuda"><strong>' + escapeHtml(item.categoria) + '</strong> · ' + escapeHtml(item.email) + " · " + new Date(item.dataHora).toLocaleString("pt-BR") + "</p>" +
        '<div class="admin-modal-campo"><label>Mensagem do aluno</label><p class="admin-feedback-mensagem">' + escapeHtml(item.mensagem) + "</p></div>" +
        '<div class="admin-modal-campo">' +
          "<label>Sua resposta</label>" +
          '<textarea id="campoResposta" rows="5">' + escapeHtml(item.resposta || "") + "</textarea>" +
        "</div>" +
        '<div class="admin-modal-acoes">' +
          '<button type="button" class="btn btn-plan-outline" id="modalCancelar">Cancelar</button>' +
          '<button type="button" class="btn btn-plan" id="modalResponder">Enviar resposta</button>' +
        "</div>" +
      "</div>";

    elModalOverlay.innerHTML = html;
    elModalOverlay.hidden = false;
    document.body.classList.add("plat-modal-aberto");
    document.getElementById("modalFechar").addEventListener("click", fecharModal);
    document.getElementById("modalCancelar").addEventListener("click", fecharModal);
    document.getElementById("modalResponder").addEventListener("click", function () {
      var resposta = document.getElementById("campoResposta").value.trim();
      if (!resposta) { window.alert("Escreva uma resposta antes de enviar."); return; }
      var botao = document.getElementById("modalResponder");
      botao.disabled = true;
      botao.textContent = "Enviando...";
      window.FeedbackAPI.responder(item.id, resposta).then(function (resultado) {
        if (!resultado || !resultado.ok) {
          window.alert("Não deu pra enviar a resposta agora. Tente de novo.");
          botao.disabled = false;
          botao.textContent = "Enviar resposta";
          return;
        }
        fecharModal();
        renderFeedbacksView();
      });
    });
  }

  // ---------- View: Avisos ----------

  function renderAvisosView() {
    var elViewBody = document.getElementById("adminViewBody");
    elViewBody.innerHTML = '<p class="admin-vazio">Carregando avisos...</p>';

    window.FeedbackAPI.listarAvisos(true).then(function (resultado) {
      if (estado.view !== "avisos") return;
      cacheAvisos = (resultado && resultado.ok) ? resultado.itens.sort(function (a, b) { return new Date(b.dataHora) - new Date(a.dataHora); }) : [];

      var html =
        '<div class="admin-cabecalho"><h1>Avisos aos alunos</h1></div>' +
        '<div class="admin-modal-campo">' +
          '<label>Título</label><input type="text" id="avisoTitulo" placeholder="Ex: Nova edição liberada" />' +
        "</div>" +
        '<div class="admin-modal-campo">' +
          '<label>Mensagem</label><textarea id="avisoMensagem" rows="3" placeholder="Ex: Já liberamos as aulas da edição 2026.1!"></textarea>' +
        "</div>" +
        '<button type="button" class="btn btn-plan" id="avisoCriar">Publicar aviso</button>';

      if (!resultado || !resultado.ok) {
        html += '<p class="admin-vazio" style="margin-top:20px;">Não foi possível carregar os avisos existentes agora. Confira se o Apps Script já foi reimplantado com as abas novas.</p>';
      } else if (!cacheAvisos.length) {
        html += '<p class="admin-vazio" style="margin-top:20px;">Nenhum aviso publicado ainda.</p>';
      } else {
        html +=
          '<div class="admin-tabela-wrap" style="margin-top:24px;"><table class="admin-tabela">' +
            "<thead><tr><th>Título</th><th>Mensagem</th><th>Data</th><th>Status</th><th></th></tr></thead>" +
            "<tbody>" +
            cacheAvisos.map(function (a) {
              return (
                "<tr>" +
                  "<td>" + escapeHtml(a.titulo) + "</td>" +
                  "<td>" + escapeHtml((a.mensagem || "").slice(0, 60)) + ((a.mensagem || "").length > 60 ? "…" : "") + "</td>" +
                  "<td>" + new Date(a.dataHora).toLocaleDateString("pt-BR") + "</td>" +
                  '<td><span class="admin-status admin-status-' + (a.ativo ? "ativo" : "removido") + '">' + (a.ativo ? "Ativo" : "Desativado") + "</span></td>" +
                  '<td class="admin-acoes">' + (a.ativo ? '<button type="button" class="admin-link admin-link-remover" data-id="' + a.id + '">Desativar</button>' : "") + "</td>" +
                "</tr>"
              );
            }).join("") +
            "</tbody></table></div>";
      }

      elViewBody.innerHTML = html;

      document.getElementById("avisoCriar").addEventListener("click", function () {
        var titulo = document.getElementById("avisoTitulo").value.trim();
        var mensagem = document.getElementById("avisoMensagem").value.trim();
        if (!titulo || !mensagem) { window.alert("Preencha título e mensagem."); return; }
        var botao = document.getElementById("avisoCriar");
        botao.disabled = true;
        botao.textContent = "Publicando...";
        window.FeedbackAPI.criarAviso(titulo, mensagem).then(function (resultado2) {
          if (!resultado2 || !resultado2.ok) {
            window.alert("Não deu pra publicar agora. Tente de novo.");
            botao.disabled = false;
            botao.textContent = "Publicar aviso";
            return;
          }
          renderAvisosView();
        });
      });

      elViewBody.querySelectorAll(".admin-link-remover[data-id]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (!window.confirm("Desativar este aviso? Ele deixa de aparecer pros alunos.")) return;
          window.FeedbackAPI.desativarAviso(btn.getAttribute("data-id")).then(function () { renderAvisosView(); });
        });
      });
    });
  }

  // ---------- View: Vídeos (importar do Google Drive pro R2 + biblioteca) ----------

  var TAMANHO_PAGINA_BIBLIOTECA = 25;
  var biblioteca = [];
  var paginaBiblioteca = 1;
  var filtroAnoBiblioteca = "todos";
  var slotsEmEdicao = {}; // "itemId|tipo" -> true enquanto o admin está trocando o vídeo daquele slot
  var rascunhosClassificacao = {}; // id do vídeo -> {grupoId, itemId, tipo} (edição não salva ainda)

  var ROTULO_TIPO_VIDEO = { original: "Original (prova)", comentado: "Comentado (professor)" };

  function extrairDriveId(linha) {
    var texto = linha.trim();
    if (!texto) return null;
    var porCaminho = texto.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/);
    if (porCaminho) return porCaminho[1];
    var porQuery = texto.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
    if (porQuery) return porQuery[1];
    if (/^[a-zA-Z0-9_-]{10,}$/.test(texto)) return texto;
    return null;
  }

  function gruposEdicao() {
    return (window.PLATAFORMA_DADOS ? window.PLATAFORMA_DADOS.grupos : []).filter(function (g) { return g.tipo === "edicao"; });
  }

  function estacoesDoGrupo(grupoId) {
    var grupo = gruposEdicao().filter(function (g) { return g.id === grupoId; })[0];
    if (!grupo) return [];
    return grupo.itens.filter(function (i) { return i.tipo === "video"; });
  }

  function formatarTamanho(bytes) {
    if (!bytes) return "";
    var mb = bytes / (1024 * 1024);
    return mb >= 1024 ? (mb / 1024).toFixed(1) + " GB" : Math.round(mb) + " MB";
  }

  function renderFilaVideos() {
    var elLista = document.getElementById("videoFilaLista");
    if (!elLista) return;

    if (!filaVideos.length) {
      elLista.innerHTML = "";
      return;
    }

    var ROTULO_STATUS = { pendente: "Pendente", enviando: "Enviando...", concluido: "Concluído", erro: "Erro" };

    elLista.innerHTML =
      '<div class="admin-tabela-wrap" style="margin-top:20px;"><table class="admin-tabela">' +
        "<thead><tr><th>Arquivo</th><th>Status</th><th>URL pública</th></tr></thead>" +
        "<tbody>" +
        filaVideos.map(function (item) {
          return (
            "<tr>" +
              "<td>" + escapeHtml(item.nomeArquivo || item.driveId) + "</td>" +
              '<td><span class="admin-status admin-status-' + (item.status === "concluido" ? "ativo" : item.status === "erro" ? "removido" : "pendente") + '">' +
                ROTULO_STATUS[item.status] + "</span></td>" +
              "<td>" +
                (item.status === "concluido"
                  ? '<a href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener">' + escapeHtml(item.url) + "</a>"
                  : item.status === "erro"
                    ? escapeHtml(item.erro || "")
                    : "—") +
              "</td>" +
            "</tr>"
          );
        }).join("") +
        "</tbody></table></div>";
  }

  async function importarUmVideo(item) {
    item.status = "enviando";
    renderFilaVideos();

    try {
      var resp = await fetch(WORKER_URL.replace(/\/$/, "") + "/import", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": WORKER_ADMIN_TOKEN },
        body: JSON.stringify({ driveId: item.driveId }),
      });
      var dados = await resp.json();
      if (!resp.ok || !dados.ok) throw new Error(dados.error || "Falha desconhecida (HTTP " + resp.status + ")");
      item.status = "concluido";
      item.nomeArquivo = dados.nomeArquivo;
      item.url = dados.url;
    } catch (erro) {
      item.status = "erro";
      item.erro = String(erro && erro.message ? erro.message : erro);
    }
    renderFilaVideos();
  }

  async function importarFilaVideos() {
    for (var i = 0; i < filaVideos.length; i++) {
      if (filaVideos[i].status === "pendente") {
        await importarUmVideo(filaVideos[i]);
      }
    }
    carregarBiblioteca();
  }

  // ---------- Biblioteca de vídeos (persistente, paginada) ----------

  async function carregarBiblioteca() {
    var elLista = document.getElementById("bibliotecaLista");
    if (elLista) elLista.innerHTML = '<p class="admin-vazio">Carregando biblioteca...</p>';

    try {
      var resp = await fetch(WORKER_URL.replace(/\/$/, "") + "/biblioteca", {
        headers: { "X-Admin-Token": WORKER_ADMIN_TOKEN },
      });
      var dados = await resp.json();
      biblioteca = (dados && dados.ok) ? dados.itens : [];
    } catch (erro) {
      biblioteca = [];
    }
    paginaBiblioteca = 1;
    renderBiblioteca();
  }

  function draftDe(item) {
    if (!rascunhosClassificacao[item.id]) {
      rascunhosClassificacao[item.id] = { grupoId: item.grupoId || "", itemId: item.itemId || "", tipo: item.tipo || "original" };
    }
    return rascunhosClassificacao[item.id];
  }

  function renderLinhaBiblioteca(item) {
    var d = draftDe(item);
    var opcoesAno = '<option value="">Ano</option>' +
      gruposEdicao().map(function (g) {
        return '<option value="' + escapeHtml(g.id) + '"' + (d.grupoId === g.id ? " selected" : "") + '>' + escapeHtml(g.titulo) + "</option>";
      }).join("");

    var estacoes = d.grupoId ? estacoesDoGrupo(d.grupoId) : [];
    var opcoesEstacao = '<option value="">' + (d.grupoId ? "Estação" : "Escolha o ano") + '</option>' +
      estacoes.map(function (i) {
        return '<option value="' + escapeHtml(i.id) + '"' + (d.itemId === i.id ? " selected" : "") + '>' + escapeHtml(i.titulo) + "</option>";
      }).join("");

    var grupoAtual = item.grupoId ? gruposEdicao().filter(function (g) { return g.id === item.grupoId; })[0] : null;
    var estacaoAtual = (item.grupoId && item.itemId) ? estacoesDoGrupo(item.grupoId).filter(function (i) { return i.id === item.itemId; })[0] : null;
    var vinculoAtual = (grupoAtual && estacaoAtual)
      ? grupoAtual.titulo + " — " + estacaoAtual.titulo + " — " + ROTULO_TIPO_VIDEO[item.tipo]
      : "Não vinculado";

    return (
      "<tr>" +
        "<td>" +
          '<a href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener">' + escapeHtml(item.nomeArquivo) + "</a>" +
          '<div class="admin-video-meta">' + formatarTamanho(item.tamanho) + (item.criadoEm ? " · " + new Date(item.criadoEm).toLocaleDateString("pt-BR") : "") + "</div>" +
          '<div class="admin-video-url-editar">' +
            '<input type="text" class="videoInputUrl" data-id="' + escapeHtml(item.id) + '" value="' + escapeHtml(item.url) + '" />' +
            '<button type="button" class="admin-link videoBtnSalvarUrl" data-id="' + escapeHtml(item.id) + '">Salvar link</button>' +
          "</div>" +
        "</td>" +
        "<td>" +
          '<p class="admin-video-vinculo-atual' + (grupoAtual ? " is-vinculado" : "") + '">' + escapeHtml(vinculoAtual) + "</p>" +
        "</td>" +
        "<td>" +
          '<div class="admin-video-classificar" data-id="' + escapeHtml(item.id) + '">' +
            '<select class="videoSelectAno" data-id="' + escapeHtml(item.id) + '">' + opcoesAno + "</select>" +
            '<select class="videoSelectEstacao" data-id="' + escapeHtml(item.id) + '"' + (!d.grupoId ? " disabled" : "") + '>' + opcoesEstacao + "</select>" +
            '<select class="videoSelectTipo" data-id="' + escapeHtml(item.id) + '">' +
              '<option value="original"' + (d.tipo === "original" ? " selected" : "") + '>' + ROTULO_TIPO_VIDEO.original + "</option>" +
              '<option value="comentado"' + (d.tipo === "comentado" ? " selected" : "") + '>' + ROTULO_TIPO_VIDEO.comentado + "</option>" +
            "</select>" +
            '<button type="button" class="admin-link videoBtnSalvar" data-id="' + escapeHtml(item.id) + '">Salvar</button>' +
            (grupoAtual ? '<button type="button" class="admin-link admin-link-remover videoBtnDesvincular" data-id="' + escapeHtml(item.id) + '">Desvincular</button>' : "") +
          "</div>" +
        "</td>" +
      "</tr>"
    );
  }

  function bibliotecaFiltrada() {
    if (filtroAnoBiblioteca === "todos") return biblioteca;
    if (filtroAnoBiblioteca === "nao-vinculados") return biblioteca.filter(function (v) { return !v.itemId; });
    return biblioteca.filter(function (v) { return v.grupoId === filtroAnoBiblioteca; });
  }

  function renderSlotVideo(grupoId, estacao, tipo) {
    var vinculado = buscarRegistroVinculado(estacao.id, tipo);
    var chaveSlot = estacao.id + "|" + tipo;
    var trocando = slotsEmEdicao[chaveSlot];
    var rotuloTipo = ROTULO_TIPO_VIDEO[tipo];

    if (vinculado && !trocando) {
      return (
        '<div class="admin-slot-video">' +
          '<p class="admin-slot-titulo">' + escapeHtml(estacao.titulo) + " — " + rotuloTipo + "</p>" +
          '<a class="admin-slot-atual" href="' + escapeHtml(vinculado.url) + '" target="_blank" rel="noopener">' + escapeHtml(vinculado.nomeArquivo) + "</a>" +
          '<button type="button" class="admin-link slotBtnTrocar" data-slot="' + escapeHtml(chaveSlot) + '">Substituir</button>' +
        "</div>"
      );
    }

    var opcoesExistentes = '<option value="">Selecionar vídeo já importado...</option>' +
      naoVinculados().map(function (v) { return '<option value="' + escapeHtml(v.id) + '">' + escapeHtml(v.nomeArquivo) + "</option>"; }).join("");

    return (
      '<div class="admin-slot-video">' +
        '<p class="admin-slot-titulo">' + escapeHtml(estacao.titulo) + " — " + rotuloTipo + "</p>" +
        (vinculado ? '<p class="admin-slot-substituindo">Substituindo: ' + escapeHtml(vinculado.nomeArquivo) + "</p>" : "") +
        '<select class="slotSelectExistente" data-grupo="' + escapeHtml(grupoId) + '" data-item="' + escapeHtml(estacao.id) + '" data-tipo="' + tipo + '">' + opcoesExistentes + "</select>" +
        '<div class="admin-slot-novo">' +
          '<input type="text" class="slotInputNovo" placeholder="Ou cole um link/ID novo do Drive" data-grupo="' + escapeHtml(grupoId) + '" data-item="' + escapeHtml(estacao.id) + '" data-tipo="' + tipo + '" />' +
          '<button type="button" class="admin-link slotBtnImportarNovo" data-grupo="' + escapeHtml(grupoId) + '" data-item="' + escapeHtml(estacao.id) + '" data-tipo="' + tipo + '">Importar</button>' +
        "</div>" +
        (vinculado ? '<button type="button" class="admin-link admin-link-remover slotBtnCancelarTroca" data-slot="' + escapeHtml(chaveSlot) + '">Cancelar</button>' : "") +
      "</div>"
    );
  }

  function renderGradeImportacao() {
    var elGrade = document.getElementById("bibliotecaGrade");
    if (!elGrade) return;

    var grupoId = filtroAnoBiblioteca;
    var grupo = gruposEdicao().filter(function (g) { return g.id === grupoId; })[0];
    if (!grupo) { elGrade.innerHTML = ""; return; }

    var estacoes = estacoesDoGrupo(grupoId);

    elGrade.innerHTML =
      '<div class="admin-cabecalho" style="margin-top:0;"><h2>Importar direto nas estações de ' + escapeHtml(grupo.titulo) + "</h2></div>" +
      '<div class="admin-grade-importacao">' +
        estacoes.map(function (estacao) {
          return (
            '<div class="admin-grade-estacao">' +
              renderSlotVideo(grupoId, estacao, "original") +
              renderSlotVideo(grupoId, estacao, "comentado") +
            "</div>"
          );
        }).join("") +
      "</div>";
  }

  function renderFiltroBiblioteca() {
    var elFiltro = document.getElementById("bibliotecaFiltroAno");
    if (!elFiltro) return;
    elFiltro.innerHTML =
      '<option value="todos"' + (filtroAnoBiblioteca === "todos" ? " selected" : "") + '>Todos os vídeos (' + biblioteca.length + ")</option>" +
      '<option value="nao-vinculados"' + (filtroAnoBiblioteca === "nao-vinculados" ? " selected" : "") + '>Não vinculados (' + biblioteca.filter(function (v) { return !v.itemId; }).length + ")</option>" +
      gruposEdicao().map(function (g) {
        var qtd = biblioteca.filter(function (v) { return v.grupoId === g.id; }).length;
        return '<option value="' + escapeHtml(g.id) + '"' + (filtroAnoBiblioteca === g.id ? " selected" : "") + '>' + escapeHtml(g.titulo) + " (" + qtd + ")</option>";
      }).join("");
  }

  function renderBiblioteca() {
    var elLista = document.getElementById("bibliotecaLista");
    var elPaginacao = document.getElementById("bibliotecaPaginacao");
    if (!elLista) return;

    renderFiltroBiblioteca();
    renderGradeImportacao();

    var lista = bibliotecaFiltrada();

    if (!lista.length) {
      elLista.innerHTML = '<p class="admin-vazio">' + (biblioteca.length ? "Nenhum vídeo nesse filtro." : "Nenhum vídeo importado ainda.") + "</p>";
      if (elPaginacao) elPaginacao.innerHTML = "";
      return;
    }

    var totalPaginas = Math.max(1, Math.ceil(lista.length / TAMANHO_PAGINA_BIBLIOTECA));
    if (paginaBiblioteca > totalPaginas) paginaBiblioteca = totalPaginas;
    var inicio = (paginaBiblioteca - 1) * TAMANHO_PAGINA_BIBLIOTECA;
    var pagina = lista.slice(inicio, inicio + TAMANHO_PAGINA_BIBLIOTECA);

    elLista.innerHTML =
      '<div class="admin-tabela-wrap"><table class="admin-tabela">' +
        "<thead><tr><th>Arquivo</th><th>Vínculo atual</th><th>Classificar</th></tr></thead>" +
        "<tbody>" + pagina.map(renderLinhaBiblioteca).join("") + "</tbody>" +
      "</table></div>";

    if (elPaginacao) {
      elPaginacao.innerHTML =
        '<button type="button" class="btn btn-plan-outline" id="bibliotecaAnterior"' + (paginaBiblioteca <= 1 ? " disabled" : "") + '>Anterior</button>' +
        '<span class="admin-paginacao-info">Página ' + paginaBiblioteca + " de " + totalPaginas + " (" + lista.length + " vídeos)</span>" +
        '<button type="button" class="btn btn-plan-outline" id="bibliotecaProxima"' + (paginaBiblioteca >= totalPaginas ? " disabled" : "") + '>Próxima</button>';

      var elAnterior = document.getElementById("bibliotecaAnterior");
      var elProxima = document.getElementById("bibliotecaProxima");
      if (elAnterior) elAnterior.addEventListener("click", function () { paginaBiblioteca--; renderBiblioteca(); });
      if (elProxima) elProxima.addEventListener("click", function () { paginaBiblioteca++; renderBiblioteca(); });
    }
  }

  // ---------- Chamadas "cruas" ao Worker (sem confirm/alert), reaproveitadas
  // pelos botões manuais da tabela e pela grade de importação por estação ----------

  async function classificarRaw(id, grupoId, itemId, tipo) {
    var resp = await fetch(WORKER_URL.replace(/\/$/, "") + "/biblioteca/classificar", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Token": WORKER_ADMIN_TOKEN },
      body: JSON.stringify({ id: id, grupoId: grupoId, itemId: itemId, tipo: tipo }),
    });
    var dados = await resp.json();
    if (!resp.ok || !dados.ok) throw new Error(dados.error || "Falha desconhecida (HTTP " + resp.status + ")");
    var registro = biblioteca.filter(function (v) { return v.id === id; })[0];
    if (registro) { registro.grupoId = dados.item.grupoId; registro.itemId = dados.item.itemId; registro.tipo = dados.item.tipo; }
    return dados.item;
  }

  async function desvincularRaw(id) {
    var resp = await fetch(WORKER_URL.replace(/\/$/, "") + "/biblioteca/desvincular", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Token": WORKER_ADMIN_TOKEN },
      body: JSON.stringify({ id: id }),
    });
    var dados = await resp.json();
    if (!resp.ok || !dados.ok) throw new Error(dados.error || "Falha desconhecida (HTTP " + resp.status + ")");
    var registro = biblioteca.filter(function (v) { return v.id === id; })[0];
    if (registro) { registro.grupoId = null; registro.itemId = null; registro.tipo = null; }
  }

  async function importarRaw(driveId) {
    var resp = await fetch(WORKER_URL.replace(/\/$/, "") + "/import", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Token": WORKER_ADMIN_TOKEN },
      body: JSON.stringify({ driveId: driveId }),
    });
    var dados = await resp.json();
    if (!resp.ok || !dados.ok) throw new Error(dados.error || "Falha desconhecida (HTTP " + resp.status + ")");
    var registro = {
      id: dados.id, chave: dados.chave, nomeArquivo: dados.nomeArquivo, url: dados.url,
      tamanho: dados.tamanhoOriginal, criadoEm: new Date().toISOString(), grupoId: null, itemId: null, tipo: null,
    };
    biblioteca.unshift(registro);
    return registro;
  }

  async function salvarClassificacaoBiblioteca(id, botao) {
    var draft = rascunhosClassificacao[id];
    if (!draft || !draft.grupoId || !draft.itemId) {
      window.alert("Escolha o ano e a estação antes de salvar.");
      return;
    }

    botao.disabled = true;
    botao.textContent = "Salvando...";

    try {
      await classificarRaw(id, draft.grupoId, draft.itemId, draft.tipo);
      delete rascunhosClassificacao[id];
    } catch (erro) {
      window.alert("Não deu pra salvar agora: " + (erro && erro.message ? erro.message : erro));
    }
    renderBiblioteca();
  }

  async function desvincularBiblioteca(id) {
    if (!window.confirm("Desvincular este vídeo da estação atual? Ele continua na biblioteca, só some da plataforma do aluno.")) return;

    try {
      await desvincularRaw(id);
      delete rascunhosClassificacao[id];
    } catch (erro) {
      window.alert("Não deu pra desvincular agora: " + (erro && erro.message ? erro.message : erro));
    }
    renderBiblioteca();
  }

  function buscarRegistroVinculado(itemId, tipo) {
    return biblioteca.filter(function (v) { return v.itemId === itemId && v.tipo === tipo; })[0] || null;
  }

  function naoVinculados() {
    return biblioteca.filter(function (v) { return !v.itemId; });
  }

  async function vincularExistenteSlot(select) {
    var idExistente = select.value;
    if (!idExistente) return;
    var grupoId = select.getAttribute("data-grupo");
    var itemId = select.getAttribute("data-item");
    var tipo = select.getAttribute("data-tipo");
    var chaveSlot = itemId + "|" + tipo;
    var antigo = buscarRegistroVinculado(itemId, tipo);

    try {
      if (antigo && antigo.id !== idExistente) await desvincularRaw(antigo.id);
      await classificarRaw(idExistente, grupoId, itemId, tipo);
      delete slotsEmEdicao[chaveSlot];
    } catch (erro) {
      window.alert("Não deu pra vincular agora: " + (erro && erro.message ? erro.message : erro));
    }
    renderBiblioteca();
  }

  async function importarEVincularSlot(input, botao) {
    var driveId = extrairDriveId(input.value);
    if (!driveId) {
      window.alert("Link ou ID do Drive inválido.");
      return;
    }
    var grupoId = botao.getAttribute("data-grupo");
    var itemId = botao.getAttribute("data-item");
    var tipo = botao.getAttribute("data-tipo");
    var chaveSlot = itemId + "|" + tipo;
    var antigo = buscarRegistroVinculado(itemId, tipo);

    botao.disabled = true;
    botao.textContent = "Importando...";

    try {
      var novo = await importarRaw(driveId);
      if (antigo) await desvincularRaw(antigo.id);
      await classificarRaw(novo.id, grupoId, itemId, tipo);
      delete slotsEmEdicao[chaveSlot];
    } catch (erro) {
      window.alert("Não deu pra importar/vincular agora: " + (erro && erro.message ? erro.message : erro));
    }
    renderBiblioteca();
  }

  async function salvarUrlBiblioteca(id, novaUrl, botao) {
    novaUrl = novaUrl.trim();
    if (!novaUrl) {
      window.alert("O link não pode ficar vazio.");
      return;
    }

    botao.disabled = true;
    botao.textContent = "Salvando...";

    try {
      var resp = await fetch(WORKER_URL.replace(/\/$/, "") + "/biblioteca/editar-url", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": WORKER_ADMIN_TOKEN },
        body: JSON.stringify({ id: id, url: novaUrl }),
      });
      var dados = await resp.json();
      if (!resp.ok || !dados.ok) throw new Error(dados.error || "Falha desconhecida (HTTP " + resp.status + ")");
      var registro = biblioteca.filter(function (v) { return v.id === id; })[0];
      if (registro) registro.url = dados.item.url;
    } catch (erro) {
      window.alert("Não deu pra salvar o link agora: " + (erro && erro.message ? erro.message : erro));
    }
    renderBiblioteca();
  }

  function renderVideosView() {
    var elViewBody = document.getElementById("adminViewBody");

    elViewBody.innerHTML =
      '<div class="admin-cabecalho"><h1>Importar vídeos do Google Drive</h1></div>' +
      '<p class="admin-modal-ajuda">' +
        "Cole abaixo um link ou ID do Google Drive por linha (marque os arquivos como \"Qualquer pessoa com o link\" antes de importar, e pode voltar a deixar privado depois). " +
        "Cada vídeo é copiado direto do Drive pro R2, sem passar pelo seu computador." +
      "</p>" +
      '<div class="admin-modal-campo">' +
        '<label>Links ou IDs do Drive (um por linha)</label>' +
        '<textarea id="videoLinksInput" rows="6" placeholder="https://drive.google.com/file/d/XXXXXXXXXXXX/view\nhttps://drive.google.com/file/d/YYYYYYYYYYYY/view"></textarea>' +
      "</div>" +
      '<button type="button" class="btn btn-plan" id="btnImportarVideos">Importar vídeos</button>' +
      '<div id="videoFilaLista"></div>' +
      '<div class="admin-cabecalho" style="margin-top:36px;"><h1>Biblioteca de vídeos</h1></div>' +
      '<div class="admin-modal-campo admin-biblioteca-filtro">' +
        '<label>Filtrar por ano</label>' +
        '<select id="bibliotecaFiltroAno"></select>' +
      "</div>" +
      '<div id="bibliotecaGrade"></div>' +
      '<div id="bibliotecaLista"></div>' +
      '<div class="admin-paginacao" id="bibliotecaPaginacao"></div>';

    renderFilaVideos();
    carregarBiblioteca();

    document.getElementById("bibliotecaFiltroAno").addEventListener("change", function (ev) {
      filtroAnoBiblioteca = ev.target.value;
      paginaBiblioteca = 1;
      renderBiblioteca();
    });

    document.getElementById("btnImportarVideos").addEventListener("click", function () {
      var linhas = document.getElementById("videoLinksInput").value.split("\n");
      var novos = [];
      linhas.forEach(function (linha) {
        var driveId = extrairDriveId(linha);
        if (driveId) novos.push({ driveId: driveId, status: "pendente", nomeArquivo: null, url: null, erro: null });
      });
      if (!novos.length) {
        window.alert("Nenhum link ou ID válido encontrado. Confira o que foi colado.");
        return;
      }
      filaVideos = filaVideos.concat(novos);
      document.getElementById("videoLinksInput").value = "";
      importarFilaVideos();
    });

    var elBibliotecaGrade = document.getElementById("bibliotecaGrade");

    elBibliotecaGrade.addEventListener("change", function (ev) {
      if (ev.target.classList.contains("slotSelectExistente")) {
        vincularExistenteSlot(ev.target);
      }
    });

    elBibliotecaGrade.addEventListener("click", function (ev) {
      if (ev.target.classList.contains("slotBtnTrocar")) {
        slotsEmEdicao[ev.target.getAttribute("data-slot")] = true;
        renderBiblioteca();
      } else if (ev.target.classList.contains("slotBtnCancelarTroca")) {
        delete slotsEmEdicao[ev.target.getAttribute("data-slot")];
        renderBiblioteca();
      } else if (ev.target.classList.contains("slotBtnImportarNovo")) {
        var input = ev.target.parentElement.querySelector(".slotInputNovo");
        importarEVincularSlot(input, ev.target);
      }
    });

    var elBibliotecaLista = document.getElementById("bibliotecaLista");

    elBibliotecaLista.addEventListener("change", function (ev) {
      var id = ev.target.getAttribute("data-id");
      if (id === null) return;
      var item = biblioteca.filter(function (v) { return v.id === id; })[0];
      if (!item) return;
      var draft = draftDe(item);

      if (ev.target.classList.contains("videoSelectAno")) {
        draft.grupoId = ev.target.value;
        draft.itemId = "";
        renderBiblioteca();
      } else if (ev.target.classList.contains("videoSelectEstacao")) {
        draft.itemId = ev.target.value;
      } else if (ev.target.classList.contains("videoSelectTipo")) {
        draft.tipo = ev.target.value;
      }
    });

    elBibliotecaLista.addEventListener("click", function (ev) {
      if (ev.target.classList.contains("videoBtnSalvar")) {
        salvarClassificacaoBiblioteca(ev.target.getAttribute("data-id"), ev.target);
      } else if (ev.target.classList.contains("videoBtnDesvincular")) {
        desvincularBiblioteca(ev.target.getAttribute("data-id"));
      }
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

    (window.PLATAFORMA_DADOS ? PLATAFORMA_DADOS.grupos : []).forEach(function (grupo) {
      var linhasItens = [];
      grupo.itens.forEach(function (item) {
        var p = progresso[item.id];
        if (!p) return;

        var videosAssistidos = (p.videos || []).filter(Boolean).length;
        var totalVideos = item.videos.length;
        var todosVideosAssistidos = totalVideos > 0 && videosAssistidos === totalVideos;
        var quiz = p.quiz || { tentativas: 0 };
        var temQuiz = !!item.quiz;
        var quizFeito = temQuiz && quiz.tentativas > 0;
        var concluida = temQuiz ? (todosVideosAssistidos && quizFeito) : todosVideosAssistidos;

        if (quizFeito) {
          totalQuizzesFeitos += 1;
          somaMelhorAproveitamento += quiz.totalPerguntas ? (quiz.melhorAcertos / quiz.totalPerguntas) : 0;
        }
        if (concluida) totalEstacoesConcluidas += 1;

        linhasItens.push(
          "<tr>" +
            "<td>" + escapeHtml(item.titulo) + "</td>" +
            "<td>" + videosAssistidos + "/" + totalVideos + " vídeos" +
              (temQuiz ? (quizFeito ? " · Quiz: " + quiz.melhorAcertos + "/" + quiz.totalPerguntas : " · Quiz pendente") : "") +
            "</td>" +
            "<td>" + (concluida ? "✓ Concluída" : "Em andamento") + "</td>" +
          "</tr>"
        );
      });
      if (linhasItens.length) {
        linhasEdicoes.push(
          '<div class="admin-historico-edicao">' +
            "<h3>" + escapeHtml(grupo.titulo) + "</h3>" +
            '<table class="admin-tabela admin-tabela-compacta"><tbody>' + linhasItens.join("") + "</tbody></table>" +
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
