// CRM NA MÃO — Dados da Plataforma do Aluno
//
// PENDÊNCIA DE CONTEÚDO: este arquivo define a ESTRUTURA da plataforma
// (Esqueletos, Aulas com Especialistas e as 12 edições do Revalida INEP),
// com vídeos, material de apoio e quiz preenchidos com CONTEÚDO DE
// EXEMPLO/placeholder. O mecanismo de exibição, progresso e quiz já
// funciona por completo com esses dados -- assim que os vídeos, PDFs e
// questões reais forem enviados, basta editar os campos abaixo.
//
// Formato geral: PLATAFORMA_DADOS.grupos é uma lista de "grupos" (Esqueletos,
// Aulas com Especialistas, cada edição do Revalida). Cada grupo tem uma
// lista PLANA de "itens", todos tipo "video" -- cada item é uma única linha
// na barra lateral, com os vídeos, material de apoio e (quando existe) o
// quiz da estação TODOS dentro da mesma página. O quiz só fica liberado
// depois que o aluno assiste todos os vídeos do item (ver itemConcluido/
// renderQuizSecaoEmbutida em plataforma.js).
//
// item tipo "video":
// {
//   id, tipo: "video", titulo: string, emBreve: boolean,
//   videos: [{ titulo: string, url: string|null }, ...],  // url=null -> "em breve"
//   material: { titulo: string, url: string|null } | null,
//   quiz: [{ pergunta, alternativas:[4], correta: 0-3, explicacao }, ...] | undefined
// }

(function () {
  "use strict";

  var EDICOES_LABELS = [
    "2020", "2021", "2022.1", "2022.2", "2023.1", "2023.2",
    "2024.1", "2024.2", "2025.1", "2025.2", "2026.1", "2026.2"
  ];

  var AREAS_ESQUELETOS = [
    "Clínica Médica", "Cirurgia", "Pediatria",
    "Ginecologia e Obstetrícia", "Medicina de Família e Comunidade", "Emergências Clínicas"
  ];

  // nomes exatamente como no material de referência do usuário (inclui
  // "Cirurgia" repetida -- duas aulas de especialistas diferentes na mesma área)
  var AREAS_ESPECIALISTAS = [
    "Clínica Médica", "Cirurgia", "Emergências Clínicas",
    "Medicina de Família e Comunidade", "Pediatria", "Cirurgia", "Ginecologia"
  ];

  function slug(texto) {
    return String(texto).toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  function gerarQuizPlaceholder(contexto) {
    var perguntas = [];
    for (var i = 1; i <= 3; i++) {
      perguntas.push({
        pergunta: "[Exemplo] Pergunta " + i + " (" + contexto + "). Substitua pelo conteúdo real quando enviado.",
        alternativas: ["Alternativa A (exemplo)", "Alternativa B (exemplo)", "Alternativa C (exemplo)", "Alternativa D (exemplo)"],
        correta: 0,
        explicacao: "Explicação de exemplo: aqui entra o texto dizendo por que a alternativa correta está certa."
      });
    }
    return perguntas;
  }

  function itemVideoSimples(grupoSlug, area) {
    return {
      id: grupoSlug + "-" + slug(area),
      tipo: "video",
      titulo: area,
      emBreve: false,
      videos: [{ titulo: "Aula", url: null }],
      material: { titulo: "Esqueleto de " + area + " (PDF)", url: null }
    };
  }

  function gerarGrupoLista(id, titulo, areas) {
    return {
      id: id,
      titulo: titulo,
      tipo: "lista",
      itens: areas.map(function (area, idx) {
        var item = itemVideoSimples(id, area);
        item.id = item.id + "-" + (idx + 1); // evita ID duplicado (ex: "Cirurgia" 2x em Especialistas)
        return item;
      })
    };
  }

  function gerarItensEdicao(edicaoLabel) {
    var edSlug = slug(edicaoLabel);
    var itens = [];
    for (var n = 1; n <= 10; n++) {
      itens.push({
        id: "edicao-" + edSlug + "-estacao-" + n,
        tipo: "video",
        titulo: "Estação " + (n < 10 ? "0" + n : n),
        emBreve: false,
        videos: [{ titulo: "Aula", url: null }, { titulo: "Aula comentada", url: null }],
        material: { titulo: "Resumo da aula (PDF)", url: null },
        quiz: gerarQuizPlaceholder("Revalida " + edicaoLabel + ", Estação " + n)
      });
    }
    return itens;
  }

  var grupos = [
    gerarGrupoLista("esqueletos", "Esqueletos", AREAS_ESQUELETOS),
    gerarGrupoLista("aulas-especialistas", "Aulas com Especialistas", AREAS_ESPECIALISTAS)
  ].concat(EDICOES_LABELS.map(function (label) {
    return {
      id: "edicao-" + slug(label),
      titulo: "Revalida INEP " + label,
      tipo: "edicao",
      itens: gerarItensEdicao(label)
    };
  }));

  window.PLATAFORMA_DADOS = { grupos: grupos };
})();
