/**
 * ══════════════════════════════════════════════════════════
 * ALCARTEL — Calculadoras de Saúde e Bem-Estar
 *   1) Gotejamento: gotas/min, gotas/hora e mL/hora
 *   2) Medicamentos: Prescrição × Diluição ÷ Quantidade do Frasco
 *
 * Ferramentas de apoio ao cálculo, não substituem a verificação da
 * prescrição nem os protocolos da instituição de saúde.
 * ══════════════════════════════════════════════════════════
 */
(function () {
  "use strict";

  function numeroValido(valor) {
    var n = parseFloat(String(valor).replace(",", "."));
    return isFinite(n) ? n : NaN;
  }

  function formatar(n, casas) {
    if (!isFinite(n)) return "—";
    return n.toLocaleString("pt-PT", { minimumFractionDigits: 0, maximumFractionDigits: casas == null ? 2 : casas });
  }

  function mostrarErro(elErro, mensagem) {
    if (!elErro) return;
    elErro.textContent = mensagem;
    elErro.style.display = mensagem ? "" : "none";
  }

  // ── 1) Calculadora de Gotejamento ──────────────────────────────────
  (function calculadoraGotejamento() {
    var form = document.getElementById("form-gotejamento");
    if (!form) return;

    var campoVolume = document.getElementById("gotejamento-volume");
    var campoHoras = document.getElementById("gotejamento-horas");
    var campoMinutos = document.getElementById("gotejamento-minutos");
    var campoFactor = document.getElementById("gotejamento-factor");
    var elErro = document.getElementById("gotejamento-erro");
    var painelResultado = document.getElementById("gotejamento-resultado");
    var saidaGotasMin = document.getElementById("gotejamento-gotas-min");
    var saidaGotasHora = document.getElementById("gotejamento-gotas-hora");
    var saidaMlHora = document.getElementById("gotejamento-ml-hora");

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      mostrarErro(elErro, "");
      if (painelResultado) painelResultado.style.display = "none";

      var volume = numeroValido(campoVolume.value);
      var horas = campoHoras.value === "" ? 0 : numeroValido(campoHoras.value);
      var minutos = campoMinutos.value === "" ? 0 : numeroValido(campoMinutos.value);
      var factor = numeroValido(campoFactor.value);

      if (!volume || volume <= 0) {
        mostrarErro(elErro, "Introduza um volume do soro válido, maior que zero (em mL).");
        campoVolume.focus();
        return;
      }
      if (!isFinite(horas) || !isFinite(minutos) || horas < 0 || minutos < 0) {
        mostrarErro(elErro, "Introduza um tempo de administração válido (horas e/ou minutos).");
        return;
      }
      var tempoTotalMin = horas * 60 + minutos;
      if (tempoTotalMin <= 0) {
        mostrarErro(elErro, "O tempo total de administração tem de ser maior que zero.");
        campoHoras.focus();
        return;
      }
      if (!factor || factor <= 0) {
        mostrarErro(elErro, "Seleccione o factor de gotejamento (gotas/mL).");
        return;
      }

      var gotasPorMinuto = (volume * factor) / tempoTotalMin;
      var gotasPorHora = gotasPorMinuto * 60;
      var tempoTotalHoras = tempoTotalMin / 60;
      var mlPorHora = volume / tempoTotalHoras;

      saidaGotasMin.textContent = formatar(gotasPorMinuto, 1) + " gotas/min";
      saidaGotasHora.textContent = formatar(gotasPorHora, 0) + " gotas/h";
      saidaMlHora.textContent = formatar(mlPorHora, 1) + " mL/h";

      if (painelResultado) painelResultado.style.display = "";
    });

    form.addEventListener("reset", function () {
      mostrarErro(elErro, "");
      if (painelResultado) painelResultado.style.display = "none";
    });
  })();

  // ── 2) Calculadora de Medicamentos (Prescrição × Diluição ÷ Frasco) ─
  (function calculadoraMedicamentos() {
    var form = document.getElementById("form-medicamentos");
    if (!form) return;

    var campoPrescricao = document.getElementById("medicamentos-prescricao");
    var campoDiluicao = document.getElementById("medicamentos-diluicao");
    var campoFrasco = document.getElementById("medicamentos-frasco");
    var elErro = document.getElementById("medicamentos-erro");
    var painelResultado = document.getElementById("medicamentos-resultado");
    var saidaQuantidade = document.getElementById("medicamentos-quantidade");

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      mostrarErro(elErro, "");
      if (painelResultado) painelResultado.style.display = "none";

      var prescricao = numeroValido(campoPrescricao.value);
      var diluicao = numeroValido(campoDiluicao.value);
      var frasco = numeroValido(campoFrasco.value);

      if (!prescricao || prescricao <= 0) {
        mostrarErro(elErro, "Introduza o valor da prescrição, maior que zero.");
        campoPrescricao.focus();
        return;
      }
      if (!diluicao || diluicao <= 0) {
        mostrarErro(elErro, "Introduza o valor da diluição, maior que zero.");
        campoDiluicao.focus();
        return;
      }
      if (!frasco || frasco <= 0) {
        mostrarErro(elErro, "Introduza a quantidade do frasco, maior que zero.");
        campoFrasco.focus();
        return;
      }

      var quantidade = (prescricao * diluicao) / frasco;
      saidaQuantidade.textContent = formatar(quantidade, 2) + " mL a administrar";
      if (painelResultado) painelResultado.style.display = "";
    });

    form.addEventListener("reset", function () {
      mostrarErro(elErro, "");
      if (painelResultado) painelResultado.style.display = "none";
    });
  })();
})();
