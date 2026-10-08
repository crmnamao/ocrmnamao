// CRM NA MÃO — Tutorial guiado do primeiro acesso à plataforma
//
// Roda DEPOIS de js/plataforma.js (usa window.PlataformaCtx, igual
// plataforma-extra.js). Mostra uma sequência de popups com um "spotlight"
// destacando cada parte da tela (menu lateral, vídeo normal, vídeo
// comentado, botão de marcar como assistido, material de apoio e quiz),
// na ordem que o aluno deve seguir pra estudar uma estação. Cada popup
// tem um avatar de "médico" animado fazendo gesto de explicação.
//
// Aparece automaticamente na primeira vez (aluno.tutorialVisto ainda não
// gravado) e pode ser revisto a qualquer momento pelo botão flutuante
// "Rever tutorial" no lado direito da tela. Se o aluno fechar a aba no
// meio do tutorial sem terminar nem pular, ele aparece de novo sozinho no
// próximo login -- comportamento aceitável, evita guardar progresso
// parcial do tutorial.

(function () {
  "use strict";

  if (!window.PlataformaCtx) return; // acesso bloqueado / sem sessão -- js/plataforma.js já tratou isso
  if (!window.AlunosStore || !window.PLATAFORMA_DADOS) return;

  var ctx = window.PlataformaCtx;
  var aluno = ctx.aluno;

  // Acha a primeira "edição" (grupo com itens de 2 vídeos + quiz) pra
  // demonstrar o fluxo completo (aula normal -> comentada -> material ->
  // quiz). Esqueletos/Aulas com Especialistas têm só 1 vídeo e sem quiz,
  // por isso não servem pra essa demonstração.
  function encontrarItemDemo() {
    var grupos = window.PLATAFORMA_DADOS.grupos;
    for (var i = 0; i < grupos.length; i++) {
      var grupo = grupos[i];
      if (grupo.tipo === "edicao" && grupo.itens && grupo.itens.length) {
        return { grupo: grupo, item: grupo.itens[0] };
      }
    }
    return null;
  }

  var demo = encontrarItemDemo();
  if (!demo) return; // sem conteúdo pra demonstrar, não mostra um tutorial quebrado

  // 6 poses estáticas do mesmo personagem (recortadas de imagens geradas
  // pelo usuário). Sem troca automática/animação -- cada passo do
  // tutorial usa uma pose fixa diferente (ver escolherPoseDoPasso).
  var AVATAR_FRAMES = [
    "assets/avatar-medico-tutorial-1.webp",
    "assets/avatar-medico-tutorial-2.webp",
    "assets/avatar-medico-tutorial-3.webp",
    "assets/avatar-medico-tutorial-4.webp",
    "assets/avatar-medico-tutorial-5.webp",
    "assets/avatar-medico-tutorial-6.webp"
  ];

  AVATAR_FRAMES.forEach(function (src) { var pre = new Image(); pre.src = src; });

  function escolherPoseDoPasso(indice) {
    return AVATAR_FRAMES[indice % AVATAR_FRAMES.length];
  }

  var PASSOS = [
    {
      titulo: "Bem-vindo(a) à plataforma!",
      texto: "Antes de começar, um tour rápido pra você saber exatamente como estudar cada estação. Leva menos de 1 minuto.",
      seletor: null
    },
    {
      titulo: "Menu lateral",
      texto: "Aqui ficam todos os conteúdos: Esqueletos, Aulas com Especialistas e as edições do Revalida INEP. Clique em um grupo pra abrir e escolher a estação que quer estudar.",
      seletor: ".plat-sidebar"
    },
    {
      titulo: "1º: assista a aula normal",
      texto: "Comece sempre pelo primeiro vídeo: é a simulação da estação do jeito que ela cai na prova de verdade.",
      seletor: ".plat-videos-grid .plat-video-card:first-child",
      antes: function () { ctx.selecionarItem(demo.grupo.id, demo.item.id); }
    },
    {
      titulo: "2º: assista a aula comentada",
      texto: "Depois, assista o segundo vídeo — a mesma simulação, só que comentada por um professor explicando a conduta ideal passo a passo.",
      seletor: ".plat-videos-grid .plat-video-card:last-child"
    },
    {
      titulo: "Marque como assistido",
      texto: "Assistindo até o fim o vídeo já é marcado sozinho. Se preferir marcar manualmente, use o botão \"Já assisti, marcar como concluído\" embaixo de cada vídeo — é isso que conta seu progresso.",
      seletor: ".plat-videos-grid .plat-video-card:first-child .plat-btn-marcar"
    },
    {
      titulo: "Material de apoio",
      texto: "Logo abaixo dos vídeos fica o material de apoio da estação — um resumo em PDF pra acompanhar enquanto assiste ou revisar depois.",
      seletor: ".plat-material-card"
    },
    {
      titulo: "Quiz da estação",
      texto: "O quiz fica bloqueado até você marcar os 2 vídeos (normal + comentada) como assistidos. Assim que os dois estiverem concluídos, ele libera sozinho aqui embaixo.",
      seletor: ".plat-quiz-box"
    },
    {
      titulo: "Pronto!",
      texto: "Agora é só escolher uma estação no menu lateral e seguir esse mesmo passo a passo: aula normal, aula comentada, material de apoio e quiz. Qualquer dúvida, use o botão \"Fale com a gente\" no topo da página.",
      seletor: null
    }
  ];

  var passoAtual = 0;
  var elOverlay, elSpot, elCard;
  var timeoutPosicionar = null;

  function criarOverlay() {
    elOverlay = document.createElement("div");
    elOverlay.className = "tutorial-overlay";

    elSpot = document.createElement("div");
    elSpot.className = "tutorial-spot";

    elCard = document.createElement("div");
    elCard.className = "tutorial-card";

    elOverlay.appendChild(elSpot);
    elOverlay.appendChild(elCard);
    document.body.appendChild(elOverlay);
    document.body.classList.add("plat-modal-aberto");

    window.addEventListener("resize", onResize);
  }

  function onResize() {
    desenhar(PASSOS[passoAtual]);
  }

  function encerrarTutorial() {
    if (timeoutPosicionar) clearTimeout(timeoutPosicionar);
    window.removeEventListener("resize", onResize);
    if (elOverlay && elOverlay.parentNode) elOverlay.parentNode.removeChild(elOverlay);
    document.body.classList.remove("plat-modal-aberto");
    elOverlay = elSpot = elCard = null;
    if (!aluno.tutorialVisto) {
      aluno = window.AlunosStore.atualizar(aluno.id, { tutorialVisto: true }) || aluno;
    }
  }

  function desenhar(passo) {
    var alvo = passo.seletor ? document.querySelector(passo.seletor) : null;
    var rect = alvo ? alvo.getBoundingClientRect() : null;

    if (rect) {
      elOverlay.classList.add("tem-alvo");
      var pad = 8;
      elSpot.style.display = "block";
      elSpot.style.top = Math.max(0, rect.top - pad) + "px";
      elSpot.style.left = Math.max(0, rect.left - pad) + "px";
      elSpot.style.width = (rect.width + pad * 2) + "px";
      elSpot.style.height = (rect.height + pad * 2) + "px";
    } else {
      elOverlay.classList.remove("tem-alvo");
      elSpot.style.display = "none";
    }

    var ultimo = passoAtual === PASSOS.length - 1;
    // Alterna o lado do avatar a cada passo (esquerda/direita) e usa uma
    // pose fixa diferente por passo -- nada se move sozinho.
    elCard.classList.toggle("tutorial-card-inverso", passoAtual % 2 === 1);
    elCard.innerHTML =
      '<div class="tutorial-card-flex">' +
        '<div class="tutorial-avatar"><img src="' + escolherPoseDoPasso(passoAtual) + '" alt="" /></div>' +
        '<div class="tutorial-card-corpo">' +
          '<p class="tutorial-passo-contador">Passo ' + (passoAtual + 1) + " de " + PASSOS.length + "</p>" +
          "<h3>" + ctx.escapeHtml(passo.titulo) + "</h3>" +
          "<p>" + ctx.escapeHtml(passo.texto) + "</p>" +
        "</div>" +
      "</div>" +
      '<div class="tutorial-card-acoes">' +
        '<button type="button" class="btn btn-plan-outline" id="tutorialPular">Pular tutorial</button>' +
        '<button type="button" class="btn btn-plan" id="tutorialProximo">' + (ultimo ? "Entendi!" : "Próximo") + "</button>" +
      "</div>";

    document.getElementById("tutorialPular").addEventListener("click", encerrarTutorial);
    document.getElementById("tutorialProximo").addEventListener("click", function () {
      passoAtual += 1;
      if (passoAtual >= PASSOS.length) { encerrarTutorial(); return; }
      executarPasso();
    });
  }

  function executarPasso() {
    var passo = PASSOS[passoAtual];
    if (passo.antes) passo.antes();

    // Dá um tempo pro DOM re-renderizar (ex.: depois de selecionarItem)
    // e pro scroll suave terminar antes de medir a posição do alvo.
    if (timeoutPosicionar) clearTimeout(timeoutPosicionar);
    var alvo = passo.seletor ? document.querySelector(passo.seletor) : null;
    if (alvo) alvo.scrollIntoView({ behavior: "smooth", block: "center" });

    timeoutPosicionar = setTimeout(function () {
      desenhar(passo);
    }, (passo.antes || alvo) ? 380 : 0);
  }

  function iniciarTutorial() {
    if (elOverlay) return; // já está rodando
    passoAtual = 0;
    criarOverlay();
    executarPasso();
  }

  // ---------- Botão flutuante "Rever tutorial" ----------

  var fab = document.createElement("button");
  fab.type = "button";
  fab.className = "tutorial-fab";
  fab.innerHTML = '<span class="tutorial-fab-icone">🎓</span><span class="tutorial-fab-texto">Rever tutorial</span>';
  fab.addEventListener("click", iniciarTutorial);
  document.body.appendChild(fab);

  // ---------- Início automático (só na 1ª vez) ----------

  if (!aluno.tutorialVisto) {
    iniciarTutorial();
  }
})();
