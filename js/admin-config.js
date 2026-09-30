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

// Worker que importa vídeos do Google Drive pro R2 (ver /worker, fora deste
// repo) e guarda o catálogo de vínculos ano/estação/tipo -> URL pública.
window.VIDEO_WORKER_URL = "https://crmnamao-video-import.empty-frost-231e.workers.dev";
window.VIDEOS_PUBLIC_BASE_URL = "https://pub-476829c8b5f74e27b0e7ec82532961bf.r2.dev";
