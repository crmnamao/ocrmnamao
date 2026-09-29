// CRM NA MÃO — Repositório de alunos (roster + histórico de treinamento)
//
// PENDÊNCIA: hoje este repositório vive no localStorage do navegador. O que
// o admin cadastra/aprova num navegador só aparece nesse mesmo navegador, e
// o histórico de treinamento de um aluno só aparece pro admin se ele usar o
// MESMO navegador em que o aluno estudou. Para o painel de admin e a
// plataforma do aluno enxergarem os MESMOS dados em dispositivos
// diferentes, isso precisa virar uma planilha/API real (Apps Script Web
// App), igual ao que já existe pro checkout -- ver pendência "Publicar o
// Apps Script". Quando isso existir, troque as funções abaixo por chamadas
// fetch() à API, mantendo a mesma assinatura usada por admin.js e
// plataforma.js.

(function () {
  "use strict";

  var CHAVE = "crmnamao_alunos";

  // status possíveis: "pendente" | "ativo" | "removido"
  // curso possíveis: null | "1-fase" | "2-fase"

  function listar() {
    try {
      var bruto = localStorage.getItem(CHAVE);
      return bruto ? JSON.parse(bruto) : [];
    } catch (erro) {
      return [];
    }
  }

  function salvarLista(lista) {
    localStorage.setItem(CHAVE, JSON.stringify(lista));
  }

  function gerarId() {
    return "aluno-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  function buscarPorEmail(email) {
    if (!email) return null;
    var alvo = email.trim().toLowerCase();
    var achado = listar().filter(function (a) { return a.email.toLowerCase() === alvo; });
    return achado.length ? achado[0] : null;
  }

  function buscarPorId(id) {
    var achado = listar().filter(function (a) { return a.id === id; });
    return achado.length ? achado[0] : null;
  }

  // Chamado pela plataforma.js quando um e-mail loga pela 1ª vez: cria o
  // registro do aluno como "pendente", aguardando aprovação do admin.
  function registrarPendente(dados) {
    var existente = buscarPorEmail(dados.email);
    if (existente) return existente;

    var agora = new Date().toISOString();
    var novo = {
      id: gerarId(),
      nome: dados.nome || dados.email,
      email: dados.email,
      curso: null,
      plano: null,
      status: "pendente",
      dataExpiracao: null,
      criadoEm: agora,
      atualizadoEm: agora,
      progresso: {}
    };
    var lista = listar();
    lista.push(novo);
    salvarLista(lista);
    return novo;
  }

  // Cadastro manual direto pelo admin (sem esperar o aluno logar).
  function criar(dados) {
    var agora = new Date().toISOString();
    var novo = {
      id: gerarId(),
      nome: dados.nome || dados.email,
      email: dados.email,
      curso: dados.curso || null,
      plano: dados.plano || null,
      status: dados.status || "ativo",
      dataExpiracao: dados.dataExpiracao || null,
      criadoEm: agora,
      atualizadoEm: agora,
      progresso: {}
    };
    var lista = listar();
    lista.push(novo);
    salvarLista(lista);
    return novo;
  }

  function atualizar(id, patch) {
    var lista = listar();
    var idx = -1;
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].id === id) { idx = i; break; }
    }
    if (idx === -1) return null;
    var atualizado = {};
    for (var k in lista[idx]) atualizado[k] = lista[idx][k];
    for (var k2 in patch) atualizado[k2] = patch[k2];
    atualizado.atualizadoEm = new Date().toISOString();
    lista[idx] = atualizado;
    salvarLista(lista);
    return atualizado;
  }

  function remover(id) {
    salvarLista(listar().filter(function (a) { return a.id !== id; }));
  }

  // ---------- Progresso / histórico de treinamento ----------

  function obterProgressoEstacao(alunoId, estacaoId, totalVideos) {
    var aluno = buscarPorId(alunoId);
    if (!aluno) return { videos: new Array(totalVideos).fill(false), quiz: { tentativas: 0, melhorAcertos: 0, ultimoAcertos: 0, totalPerguntas: 0 } };
    if (!aluno.progresso) aluno.progresso = {};
    if (!aluno.progresso[estacaoId]) {
      return { videos: new Array(totalVideos).fill(false), quiz: { tentativas: 0, melhorAcertos: 0, ultimoAcertos: 0, totalPerguntas: 0 } };
    }
    return aluno.progresso[estacaoId];
  }

  function marcarVideoAssistido(alunoId, estacaoId, idx, totalVideos) {
    var lista = listar();
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].id !== alunoId) continue;
      if (!lista[i].progresso) lista[i].progresso = {};
      if (!lista[i].progresso[estacaoId]) {
        lista[i].progresso[estacaoId] = { videos: new Array(totalVideos).fill(false), quiz: { tentativas: 0, melhorAcertos: 0, ultimoAcertos: 0, totalPerguntas: 0 } };
      }
      lista[i].progresso[estacaoId].videos[idx] = true;
      break;
    }
    salvarLista(lista);
  }

  function salvarResultadoQuiz(alunoId, estacaoId, acertos, total) {
    var lista = listar();
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].id !== alunoId) continue;
      if (!lista[i].progresso) lista[i].progresso = {};
      if (!lista[i].progresso[estacaoId]) {
        lista[i].progresso[estacaoId] = { videos: [], quiz: { tentativas: 0, melhorAcertos: 0, ultimoAcertos: 0, totalPerguntas: 0 } };
      }
      var quiz = lista[i].progresso[estacaoId].quiz;
      quiz.tentativas += 1;
      quiz.ultimoAcertos = acertos;
      quiz.totalPerguntas = total;
      quiz.melhorAcertos = Math.max(quiz.melhorAcertos || 0, acertos);
      break;
    }
    salvarLista(lista);
  }

  window.AlunosStore = {
    listar: listar,
    buscarPorEmail: buscarPorEmail,
    buscarPorId: buscarPorId,
    registrarPendente: registrarPendente,
    criar: criar,
    atualizar: atualizar,
    remover: remover,
    obterProgressoEstacao: obterProgressoEstacao,
    marcarVideoAssistido: marcarVideoAssistido,
    salvarResultadoQuiz: salvarResultadoQuiz
  };
})();
