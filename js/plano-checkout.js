// Script compartilhado pelas páginas de plano (plano-expresso.html,
// plano-expresso-pense.html, plano-premium.html, plano-premium-pense.html).
// Cada uma dessas páginas já "chega" com o plano certo (não tem <select> --
// só o formulário de dados), então define window.PLANO_ATUAL ANTES de
// carregar este script, com o formato:
//   window.PLANO_ATUAL = { nome: "Expresso", checkoutUrlReserva: "..." }
// "nome" precisa bater com PRODUTOS no google-apps-script-planilha-setup.gs.
//
// checkoutUrlReserva é usado SÓ se a chamada à InfinitePay falhar (fora do
// ar, erro de rede etc.) -- pra nunca travar uma venda.

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbztG_YafW1uHKRKhuBEXdW4VeNBBRISWHn0UZXKPONci1sdsHGUgcLgW-eSqK13T9_uwg/exec"

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
    { input: form.nome, msg: "Informe seu nome completo." },
    { input: form.email, msg: "Informe um e-mail válido." },
    { input: form.whatsapp, msg: "Informe seu WhatsApp com DDD." },
    { input: form.cpf, msg: "Informe seu CPF." },
    { input: form.endereco, msg: "Informe seu endereço completo." },
    { input: form.estado, msg: "Informe seu estado." },
    { input: form.pais, msg: "Informe seu país." },
  ]

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

  // qualquer falha acima (rede, resposta inválida etc.) cai aqui --
  // prioriza nunca travar a compra do aluno.
  return checkoutUrlReserva
}

function initFormularioPlano() {
  const form = document.getElementById("formCompra")
  const plano = window.PLANO_ATUAL
  if (!form || !plano) return

  const botao = document.getElementById("compraSubmit")
  const status = document.getElementById("compraStatus")

  form.addEventListener("submit", async (e) => {
    e.preventDefault()
    status.textContent = ""
    status.classList.remove("is-error")

    if (!validarFormulario(form)) {
      status.textContent = "Confira os campos destacados acima."
      status.classList.add("is-error")
      return
    }

    const dados = {
      nome: form.nome.value.trim(),
      email: form.email.value.trim(),
      whatsapp: form.whatsapp.value.trim(),
      cpf: form.cpf.value.trim(),
      endereco: form.endereco.value.trim(),
      estado: form.estado.value.trim(),
      pais: form.pais.value.trim(),
      plano: plano.nome,
      dataEnvio: new Date().toISOString(),
    }

    botao.disabled = true
    botao.textContent = "Enviando..."
    status.textContent = "Preparando seu checkout..."

    const checkoutUrl = await criarPedidoEObterCheckout(dados, plano.checkoutUrlReserva)

    window.location.href = checkoutUrl
  })
}

document.addEventListener("DOMContentLoaded", initFormularioPlano)
