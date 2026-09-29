// Formulário de cadastro do site: o cliente escolhe entre um curso com
// checkout automático ou "Outros" (produto em texto livre, sem preço fixo).
// O fluxo do curso com checkout segue o mesmo padrão de site/js/comprar.js:
// o Apps Script gera um link de pagamento EXCLUSIVO daquele pedido via
// InfinitePay (com order_nsu) e o cliente é redirecionado pra ele -- "nome"
// precisa bater com PRODUTOS no google-apps-script-planilha-setup.gs. O
// fluxo "Outros" só registra o lead na planilha como "Outros Produtos"
// (categoria fixa) pro time fechar o valor manualmente.
const VALOR_OUTROS = "outros"

// TODO: mesmo aviso de site/js/comprar.js -- troque checkoutUrlReserva pelo
// link real da InfinitePay assim que a conta estiver configurada. Deixe
// CURSOS vazio ({}) se não houver nenhum curso com checkout automático além
// do fluxo "Outros".
const CURSOS = {}

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbztG_YafW1uHKRKhuBEXdW4VeNBBRISWHn0UZXKPONci1sdsHGUgcLgW-eSqK13T9_uwg/exec"

function popularSelectDeCursos(select) {
  select.innerHTML = ""
  const placeholder = document.createElement("option")
  placeholder.value = ""
  placeholder.textContent = "Selecione o produto"
  placeholder.disabled = true
  placeholder.selected = true
  select.appendChild(placeholder)

  for (const [id, curso] of Object.entries(CURSOS)) {
    const opt = document.createElement("option")
    opt.value = id
    opt.textContent = curso.nome
    select.appendChild(opt)
  }

  const outros = document.createElement("option")
  outros.value = VALOR_OUTROS
  outros.textContent = "Outros"
  select.appendChild(outros)

  // autocomplete="off" no <select> (ver cadastro.html) evita o navegador
  // restaurar a última opção escolhida num recarregamento de página, mas
  // forçar o valor aqui também garante que o formulário SEMPRE abre sem
  // nada pré-selecionado, mesmo se o navegador tentar repopular o campo.
  select.value = ""
}

// mostra o campo de descrição livre (e o exige) só quando "Outros" está
// selecionado; pros cursos com checkout automático ele fica escondido.
function atualizarFormularioPeloCurso(form) {
  const ehOutros = form.curso.value === VALOR_OUTROS
  const produtoGrupo = document.getElementById("produtoGroup")
  const botao = document.getElementById("cadastroSubmit")

  produtoGrupo.style.display = ehOutros ? "" : "none"
  form.produto.required = ehOutros
  if (!ehOutros) limparErro(produtoGrupo)

  botao.textContent = ehOutros ? "Enviar cadastro" : "Continuar para o pagamento"
}

function mostrarErro(grupo, mensagem) {
  grupo.classList.add("has-error")
  const erroEl = grupo.querySelector(".form-error")
  if (erroEl) erroEl.textContent = mensagem
}

function limparErro(grupo) {
  grupo.classList.remove("has-error")
}

function validarFormulario(form) {
  let valido = true
  const campos = [
    { input: form.curso, msg: "Selecione o curso desejado." },
    { input: form.nome, msg: "Informe seu nome completo." },
    { input: form.email, msg: "Informe um e-mail válido." },
    { input: form.whatsapp, msg: "Informe seu WhatsApp com DDD." },
    { input: form.cpf, msg: "Informe seu CPF." },
    { input: form.endereco, msg: "Informe seu endereço completo." },
    { input: form.estado, msg: "Informe seu estado." },
    { input: form.pais, msg: "Informe seu país." },
  ]

  if (form.curso.value === VALOR_OUTROS) {
    campos.push({ input: form.produto, msg: "Descreva o produto que deseja comprar." })
  }

  for (const { input, msg } of campos) {
    const grupo = input.closest(".form-group")
    if (!input.value.trim()) {
      mostrarErro(grupo, msg)
      valido = false
    } else {
      limparErro(grupo)
    }
  }

  const grupoTermos = form.termos.closest(".form-group")
  if (!form.termos.checked) {
    mostrarErro(grupoTermos, "Você precisa aceitar o Termo de Uso para continuar.")
    valido = false
  } else {
    limparErro(grupoTermos)
  }

  return valido
}

async function enviarCadastroPersonalizado(dados) {
  if (!APPS_SCRIPT_URL) return { ok: false }

  try {
    const resposta = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(dados),
    })
    return await resposta.json()
  } catch (err) {
    console.error("Falha ao enviar cadastro:", err)
    return { ok: false }
  }
}

// Mesmo padrão de site/js/comprar.js: PRECISA ler a resposta (não usa
// mode:"no-cors"), porque precisamos do link de pagamento antes de
// redirecionar.
async function criarPedidoEObterCheckout(dados, checkoutUrlReserva) {
  if (!APPS_SCRIPT_URL) return checkoutUrlReserva

  try {
    const resposta = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(dados),
    })
    const json = await resposta.json()
    if (json && json.ok && json.checkoutUrl) {
      return json.checkoutUrl
    }
    console.error("Apps Script não devolveu um checkoutUrl válido:", json)
  } catch (err) {
    console.error("Falha ao criar pedido / gerar checkout:", err)
  }

  return checkoutUrlReserva
}

function initFormularioCadastro() {
  const form = document.getElementById("formCadastro")
  if (!form) return

  popularSelectDeCursos(form.curso)
  atualizarFormularioPeloCurso(form)
  form.curso.addEventListener("change", () => atualizarFormularioPeloCurso(form))

  const botao = document.getElementById("cadastroSubmit")
  const status = document.getElementById("cadastroStatus")

  form.addEventListener("submit", async (e) => {
    e.preventDefault()
    status.textContent = ""
    status.classList.remove("is-error")

    if (!validarFormulario(form)) {
      status.textContent = "Confira os campos destacados acima."
      status.classList.add("is-error")
      return
    }

    const cursoId = form.curso.value
    const dadosComuns = {
      nome: form.nome.value.trim(),
      email: form.email.value.trim(),
      whatsapp: form.whatsapp.value.trim(),
      cpf: form.cpf.value.trim(),
      endereco: form.endereco.value.trim(),
      estado: form.estado.value.trim(),
      pais: form.pais.value.trim(),
      dataEnvio: new Date().toISOString(),
    }

    botao.disabled = true

    if (cursoId === VALOR_OUTROS) {
      botao.textContent = "Enviando..."
      status.textContent = "Enviando seus dados..."

      const resultado = await enviarCadastroPersonalizado({
        tipo: "cadastro-personalizado",
        produto: form.produto.value.trim(),
        ...dadosComuns,
      })

      if (resultado && resultado.ok) {
        window.location.href = "obrigado-cadastro.html"
      } else {
        status.textContent = "Não conseguimos enviar seus dados agora. Tente novamente em instantes."
        status.classList.add("is-error")
        botao.disabled = false
        atualizarFormularioPeloCurso(form)
      }
      return
    }

    const curso = CURSOS[cursoId]
    if (!curso) {
      status.textContent = "Curso inválido. Recarregue a página e tente novamente."
      status.classList.add("is-error")
      botao.disabled = false
      return
    }

    botao.textContent = "Preparando seu checkout..."
    status.textContent = "Preparando seu checkout..."

    const checkoutUrl = await criarPedidoEObterCheckout(
      { ...dadosComuns, plano: curso.nome },
      curso.checkoutUrlReserva
    )

    window.location.href = checkoutUrl
  })
}

document.addEventListener("DOMContentLoaded", initFormularioCadastro)
