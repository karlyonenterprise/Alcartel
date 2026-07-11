/**
 * ══════════════════════════════════════════════════════════
 * ALCARTEL — Partilhar Vaga
 *
 * Liga o botão ".vaga-share__btn" gerado em cada página de vaga
 * (scripts/gerar-site.js → blocoPartilha) à Web Share API nativa
 * quando disponível (a maioria dos telemóveis), e a um pequeno
 * menu de recurso (WhatsApp, Facebook, LinkedIn, X, Telegram,
 * Copiar Link) quando o navegador não suporta a Web Share API
 * (a maioria dos desktops).
 *
 * Não depende de nenhum outro ficheiro nem de nenhuma biblioteca —
 * lê os dados a partilhar directamente dos atributos data-titulo /
 * data-url / data-texto do contentor ".vaga-share", que já vêm
 * preenchidos automaticamente a partir do conteúdo da vaga.
 * ══════════════════════════════════════════════════════════
 */
(function () {
  "use strict";

  function montarLinks(dados) {
    var url = encodeURIComponent(dados.url);
    var texto = encodeURIComponent(dados.texto);
    var titulo = encodeURIComponent(dados.titulo);
    return [
      { nome: "WhatsApp", classe: "vaga-share__link--whatsapp", href: "https://wa.me/?text=" + texto + "%20" + url },
      { nome: "Facebook", classe: "vaga-share__link--facebook", href: "https://www.facebook.com/sharer/sharer.php?u=" + url },
      { nome: "LinkedIn", classe: "vaga-share__link--linkedin", href: "https://www.linkedin.com/sharing/share-offsite/?url=" + url },
      { nome: "X (Twitter)", classe: "vaga-share__link--x", href: "https://twitter.com/intent/tweet?text=" + titulo + "&url=" + url },
      { nome: "Telegram", classe: "vaga-share__link--telegram", href: "https://t.me/share/url?url=" + url + "&text=" + titulo }
    ];
  }

  function copiarFallback(url, aoConcluir) {
    var temp = document.createElement("textarea");
    temp.value = url;
    temp.setAttribute("readonly", "");
    temp.style.position = "fixed";
    temp.style.left = "-9999px";
    document.body.appendChild(temp);
    temp.select();
    try { document.execCommand("copy"); } catch (erro) { /* ignora — sem forma de copiar aqui */ }
    document.body.removeChild(temp);
    aoConcluir();
  }

  function copiarLink(url, botao) {
    var textoOriginal = botao.textContent;
    function concluido() {
      botao.textContent = "Link copiado!";
      botao.classList.add("vaga-share__link--copiado");
      setTimeout(function () {
        botao.textContent = textoOriginal;
        botao.classList.remove("vaga-share__link--copiado");
      }, 2000);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(concluido).catch(function () {
        copiarFallback(url, concluido);
      });
    } else {
      copiarFallback(url, concluido);
    }
  }

  function construirMenu(menu, dados) {
    var links = montarLinks(dados);
    var html = links.map(function (l) {
      return '<a href="' + l.href + '" target="_blank" rel="noopener noreferrer" class="vaga-share__link ' + l.classe + '" role="menuitem">' + l.nome + "</a>";
    }).join("");
    html += '<button type="button" class="vaga-share__link vaga-share__link--copiar" role="menuitem" data-copiar>Copiar Link</button>';
    menu.innerHTML = html;
    menu.querySelector("[data-copiar]").addEventListener("click", function (e) {
      copiarLink(dados.url, e.currentTarget);
    });
  }

  function fecharMenu(botao, menu) {
    if (menu.hidden) return;
    menu.hidden = true;
    botao.setAttribute("aria-expanded", "false");
  }

  function abrirMenu(botao, menu) {
    menu.hidden = false;
    botao.setAttribute("aria-expanded", "true");
  }

  function iniciar(container) {
    var botao = container.querySelector(".vaga-share__btn");
    var menu = container.querySelector(".vaga-share__menu");
    if (!botao || !menu) return;

    var dados = {
      titulo: container.getAttribute("data-titulo") || document.title,
      url: container.getAttribute("data-url") || window.location.href,
      texto: container.getAttribute("data-texto") || document.title
    };

    var menuConstruido = false;

    botao.addEventListener("click", function (e) {
      e.stopPropagation();

      // Web Share API nativa — a maioria dos telemóveis (Android/iOS)
      // e alguns navegadores desktop mais recentes.
      if (navigator.share) {
        navigator.share({ title: dados.titulo, text: dados.texto, url: dados.url }).catch(function () {
          // Utilizador cancelou a partilha nativa — não faz nada.
        });
        return;
      }

      // Sem Web Share API: alterna o menu de recurso com as redes sociais.
      if (!menuConstruido) {
        construirMenu(menu, dados);
        menuConstruido = true;
      }
      if (menu.hidden) {
        abrirMenu(botao, menu);
      } else {
        fecharMenu(botao, menu);
      }
    });

    document.addEventListener("click", function (e) {
      if (!container.contains(e.target)) fecharMenu(botao, menu);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        fecharMenu(botao, menu);
        botao.focus();
      }
    });
  }

  var containers = document.querySelectorAll(".vaga-share");
  for (var i = 0; i < containers.length; i++) iniciar(containers[i]);
})();
