// CRM NA MÃO — Dados da Plataforma do Aluno
//
// PENDÊNCIA DE CONTEÚDO: este arquivo só define a ESTRUTURA das edições e
// estações (12 edições x 10 estações = 120 estações), com vídeos, material
// de apoio e quiz preenchidos com CONTEÚDO DE EXEMPLO/placeholder. O
// mecanismo de exibição, progresso e quiz da plataforma já funciona por
// completo com esses dados -- assim que os vídeos, PDFs e questões reais
// forem enviados, basta editar os campos de cada estação abaixo.
//
// Formato de uma estação:
// {
//   id: string (único),
//   numero: number (1 a 10),
//   tema: string,
//   videos: [
//     { titulo: string, url: string|null },  // url=null -> mostra "em breve"
//                                             // com botão manual de "marcar
//                                             // como assistido". Preencha
//                                             // com a URL real (mp4 ou
//                                             // embed) quando disponível.
//     { titulo: string, url: string|null }
//   ],
//   material: { titulo: string, url: string|null }, // PDF para download
//   quiz: [
//     { pergunta: string, alternativas: [string,string,string,string], correta: 0-3, explicacao: string },
//     ... (na versão real, ~10 perguntas por estação)
//   ]
// }

(function () {
  "use strict";

  // Edições do Revalida INEP cobertas pela plataforma. Ajuste esta lista
  // quando novas edições forem lançadas.
  var EDICOES_LABELS = [
    "2020",
    "2021",
    "2022.1",
    "2022.2",
    "2023.1",
    "2023.2",
    "2024.1",
    "2024.2",
    "2025.1",
    "2025.2",
    "2026.1",
    "2026.2"
  ];

  function slug(texto) {
    return String(texto).toLowerCase().replace(/\./g, "-");
  }

  function gerarQuizPlaceholder(edicaoLabel, estacaoNumero) {
    var perguntas = [];
    for (var i = 1; i <= 3; i++) {
      perguntas.push({
        pergunta:
          "[Exemplo] Pergunta " + i + " da Estação " + estacaoNumero +
          " (Revalida " + edicaoLabel + "). Substitua pelo conteúdo real quando enviado.",
        alternativas: [
          "Alternativa A (exemplo)",
          "Alternativa B (exemplo)",
          "Alternativa C (exemplo)",
          "Alternativa D (exemplo)"
        ],
        correta: 0,
        explicacao:
          "Explicação de exemplo: aqui entra o texto dizendo por que a alternativa correta está certa " +
          "e, se quiser, por que as demais estão erradas."
      });
    }
    return perguntas;
  }

  function gerarEstacoes(edicaoLabel) {
    var estacoes = [];
    for (var n = 1; n <= 10; n++) {
      estacoes.push({
        id: "edicao-" + slug(edicaoLabel) + "-estacao-" + n,
        numero: n,
        tema: "Estação " + n + " — tema a definir",
        videos: [
          { titulo: "Aula", url: null },
          { titulo: "Aula comentada", url: null }
        ],
        material: { titulo: "Resumo da aula (PDF)", url: null },
        quiz: gerarQuizPlaceholder(edicaoLabel, n)
      });
    }
    return estacoes;
  }

  var edicoes = EDICOES_LABELS.map(function (label) {
    return {
      id: "edicao-" + slug(label),
      titulo: "Revalida INEP " + label,
      estacoes: gerarEstacoes(label)
    };
  });

  window.PLATAFORMA_DADOS = { edicoes: edicoes };
})();
