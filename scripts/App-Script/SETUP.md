# Configurar o backend do "Alerta de Vagas" (Google Sheets + Apps Script)

Estes passos correm na conta Google da Karlyon — não no repositório.
Demora uns 10 minutos.

## 1. Criar a folha de cálculo

1. Aceda a [sheets.google.com](https://sheets.google.com) e crie uma folha nova.
2. Chame-lhe **"Alcartel — Alertas"**.
3. Não precisa de criar colunas manualmente — o script cria a folha
   `Inscricoes` e o cabeçalho sozinho na primeira vez que for chamado.

## 2. Criar o projecto Apps Script

1. Na folha, vá a **Extensões → Apps Script**.
2. Apague o conteúdo do ficheiro `Código.gs` que abre por omissão.
3. Copie todo o conteúdo de `scripts/apps-script/Code.gs` (neste repositório)
   e cole no editor.
4. Guarde (ícone da disquete ou Ctrl+S). Dê ao projecto o nome
   **"Alcartel — Alerta de Vagas"**.

## 3. Definir o token secreto

1. No editor do Apps Script, vá a **Definições do projecto** (ícone de
   engrenagem, no menu lateral esquerdo).
2. Em **Propriedades do script**, clique em **Adicionar propriedade do script**.
3. Nome: `WEBHOOK_TOKEN` — Valor: uma frase longa e aleatória à sua escolha
   (ex.: gere uma em [1password.com/password-generator](https://1password.com/password-generator/)
   ou qualquer gerador de senhas). Guarde este valor — vai precisar dele
   no passo 5.

## 4. Publicar como Aplicação Web

1. No editor, clique em **Implementar → Nova implementação**.
2. Tipo: **Aplicação Web**.
3. "Executar como": **Eu (a sua conta)**.
4. "Quem tem acesso": **Qualquer pessoa**.
5. Clique em **Implementar** e autorize as permissões pedidas (é o seu
   próprio script, é seguro aceitar).
6. Copie o **URL da aplicação Web** gerado (termina em `/exec`).

## 5. Ligar o site ao Apps Script

**a) Formulário do site** — em `js/formulario.js`, substitua o valor de
`APPS_SCRIPT_URL` pelo URL copiado no passo 4.6.

**b) Notificações de vagas novas (GitHub Actions)** — no GitHub, vá a
`Settings → Secrets and variables → Actions` do repositório e crie/actualize
dois secrets:

| Nome                          | Valor                                    |
|--------------------------------|-------------------------------------------|
| `APPS_SCRIPT_URL`              | o mesmo URL do passo 4.6                  |
| `APPS_SCRIPT_WEBHOOK_TOKEN`    | o mesmo valor de `WEBHOOK_TOKEN` do passo 3 |

Isto já está preparado no workflow `.github/workflows/notificar-vagas.yml`,
que dispara automaticamente sempre que uma vaga nova é publicada via CMS
(`content/vagas/*.json` novo em `main`).

## Como fica a folha "Inscricoes"

| ID | Nome | Email | Contacto Telefónico | Categoria de Interesse | Data de Registo |
|----|------|-------|----------------------|--------------------------|-------------------|

- Uma pessoa pode aparecer várias vezes com o mesmo e-mail, desde que a
  categoria seja diferente de cada vez (ex.: Motorista + Construção).
- O mesmo e-mail + a mesma categoria não é aceite duas vezes
  (mensagem "Este e-mail já está inscrito para receber alertas.").

## Testar

1. Preencha o formulário "Receber Alerta de Emprego" no site em produção.
2. Confirme que aparece uma linha nova na folha "Inscricoes".
3. Publique uma vaga nova via `/admin/` na categoria que usou no teste e
   confirme que recebe o e-mail de notificação (pode demorar 1-2 min,
   depende do GitHub Action e do deploy do Vercel).

## Se precisar de reimplantar depois de editar o Code.gs

Sempre que alterar `Code.gs`, tem de criar **uma nova implementação**
(Implementar → Gerir implementações → ✏️ → Nova versão) para que as
alterações fiquem activas no URL público — editar o código sozinho não é
suficiente.
