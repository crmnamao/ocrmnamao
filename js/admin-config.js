// CRM NA MÃO — Configuração do painel de admin
//
// E-mails com acesso ao painel de administração (site/admin.html) e ao
// link "Painel Admin" na plataforma do aluno. Adicione outros e-mails da
// equipe CRM na Mão nesta lista conforme necessário.
//
// TODO (pendência): isso só controla o que aparece na TELA -- hoje não
// existe backend, então qualquer pessoa que ver o código-fonte vê essa
// lista e os dados do AlunosStore (localStorage) não têm proteção real.
// Quando o backend existir, a validação de quem é admin precisa acontecer
// no servidor (Apps Script), não só aqui.

window.ADMIN_EMAILS = ["leonardoac.alves2@gmail.com", "contato@facilitandocrmnamao.com"];
