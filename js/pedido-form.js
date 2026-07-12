/* ══════════════════════════════════════════════════════════════
   ALCARTEL — js/pedido-form.js
   Responsável pelo "Formulário de Pedido" (#pedido-form) na página
   de Serviços:
     1. Preenche dinamicamente "Serviço desejado" consoante a
        "Categoria do serviço" escolhida (inclui todos os cursos
        de formação profissional disponíveis em Moçambique).
     2. Valida os campos obrigatórios.
     3. Monta a mensagem e abre o WhatsApp (+258 82 130 0088) com
        o pedido já preenchido, pronto a enviar.
   ══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var NUMERO_WHATSAPP = '258821300088'; // +258 82 130 0088

  var SERVICOS_POR_CATEGORIA = {
    'Social Media & Marketing': [
      'Gestão de redes sociais',
      'Criação de conteúdo digital',
      'Estratégias de crescimento online',
      'Gestão de campanhas publicitárias'
    ],
    'Currículos & Consultoria': [
      'Criação de CV profissional',
      'Cartas de apresentação',
      'Monografias académicas',
      'Consultoria de carreira'
    ],
    'Design Gráfico': [
      'Panfletos e flyers',
      'Cartões de visita',
      'Cartazes e banners',
      'Identidade visual'
    ],
    'Desenvolvimento Digital': [
      'Websites profissionais',
      'Lojas online',
      'Sistemas escolares',
      'Bases de dados'
    ],
    // Cursos técnicos, superiores e de curta duração mais procurados
    // e disponíveis em Moçambique (institutos médios, IFPELAC/CFP,
    // universidades e centros de formação profissional).
    'Cursos & Formação Profissional': [
      'Informática na Óptica do Utilizador',
      'Suporte e Manutenção Informática',
      'Programação e Desenvolvimento de Software',
      'Redes e Telecomunicações',
      'Contabilidade e Gestão Financeira',
      'Gestão Aduaneira e Logística',
      'Gestão de Recursos Humanos',
      'Gestão de Empresas e Empreendedorismo',
      'Marketing Digital',
      'Secretariado Executivo e Relações Públicas',
      'Electricidade Industrial',
      'Electrónica e Telecomunicações',
      'Mecânica Industrial e Automóvel',
      'Soldadura e Canalização',
      'Construção Civil',
      'Topografia',
      'Enfermagem Geral',
      'Saúde, Ambiente e Segurança no Trabalho (SST)',
      'Agropecuária e Agroprocessamento',
      'Avicultura e Horticultura',
      'Turismo e Hotelaria',
      'Transportes e Logística',
      'Inglês e Línguas Estrangeiras',
      'Culinária e Gastronomia',
      'Corte e Costura / Moda',
      'Fotografia e Produção de Vídeo',
      'Educação e Pedagogia',
      'Direito',
      'Engenharia Civil',
      'Engenharia Informática',
      'Medicina e Saúde Pública',
      'Carta de Condução (Categoria B)',
      'Outro curso (especificar na descrição)'
    ]
  };

  document.addEventListener('DOMContentLoaded', function () {
    var form = document.getElementById('pedido-form');
    if (!form) return;

    var selectCategoria = document.getElementById('pedido-categoria');
    var selectServico = document.getElementById('pedido-servico');
    var msgEl = document.getElementById('pedido-msg');
    var btnSubmit = form.querySelector('button[type="submit"]');
    var textoOriginalBtn = btnSubmit ? btnSubmit.textContent : 'Enviar Pedido';

    // ── Preenche "Serviço desejado" consoante a categoria ──────
    selectCategoria.addEventListener('change', function () {
      var categoria = selectCategoria.value;
      var lista = SERVICOS_POR_CATEGORIA[categoria] || [];

      selectServico.innerHTML = '';

      if (!categoria) {
        selectServico.disabled = true;
        var optVazio = document.createElement('option');
        optVazio.value = '';
        optVazio.textContent = 'Seleccione primeiro a categoria';
        selectServico.appendChild(optVazio);
        return;
      }

      selectServico.disabled = false;
      var optPlaceholder = document.createElement('option');
      optPlaceholder.value = '';
      optPlaceholder.textContent = 'Seleccione o serviço desejado';
      selectServico.appendChild(optPlaceholder);

      lista.forEach(function (servico) {
        var opt = document.createElement('option');
        opt.value = servico;
        opt.textContent = servico;
        selectServico.appendChild(opt);
      });
    });

    // ── Mensagens de feedback ───────────────────────────────────
    function mostrarMensagem(texto, tipo) {
      if (!msgEl) return;
      var estilosBase = 'display:block;margin-top:12px;padding:12px 16px;border-radius:8px;' +
        'font-size:0.9rem;font-weight:600;text-align:center;';
      var estilosTipo = tipo === 'erro'
        ? 'background:#f8d7da;color:#721c24;border:1px solid #f5c6cb;'
        : 'background:#d4edda;color:#155724;border:1px solid #c3e6cb;';
      msgEl.style.cssText = estilosBase + estilosTipo;
      msgEl.textContent = texto;
    }

    function valorCampo(seletor) {
      var el = form.querySelector(seletor);
      return el ? String(el.value || '').trim() : '';
    }

    function formatarData(valor) {
      if (!valor) return '';
      var partes = valor.split('-');
      if (partes.length !== 3) return valor;
      return partes[2] + '/' + partes[1] + '/' + partes[0];
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var dados = {
        nome: valorCampo('#pedido-nome'),
        telefone: valorCampo('#pedido-telefone').replace(/\D/g, ''),
        categoria: valorCampo('#pedido-categoria'),
        servico: valorCampo('#pedido-servico'),
        data: valorCampo('#pedido-data'),
        hora: valorCampo('#pedido-hora'),
        descricao: valorCampo('#pedido-descricao')
      };

      if (!dados.nome || dados.nome.length < 2) {
        mostrarMensagem('⚠️ Por favor, indique o seu nome completo.', 'erro');
        return;
      }
      if (!dados.telefone || dados.telefone.length !== 9) {
        mostrarMensagem('⚠️ Por favor, indique um número de WhatsApp válido (9 dígitos).', 'erro');
        return;
      }
      if (!dados.categoria) {
        mostrarMensagem('⚠️ Por favor, seleccione a categoria do serviço.', 'erro');
        return;
      }
      if (!dados.servico) {
        mostrarMensagem('⚠️ Por favor, seleccione o serviço desejado.', 'erro');
        return;
      }
      if (!dados.data) {
        mostrarMensagem('⚠️ Por favor, indique a data pretendida.', 'erro');
        return;
      }
      if (!dados.hora) {
        mostrarMensagem('⚠️ Por favor, indique a hora pretendida.', 'erro');
        return;
      }
      if (!dados.descricao || dados.descricao.length < 5) {
        mostrarMensagem('⚠️ Por favor, descreva o seu pedido com mais detalhe.', 'erro');
        return;
      }

      var mensagem = 'Novo Pedido de Serviço – Alcartel\n\n' +
        'Nome: ' + dados.nome + '\n' +
        'WhatsApp: +258 ' + dados.telefone + '\n' +
        'Categoria: ' + dados.categoria + '\n' +
        'Serviço: ' + dados.servico + '\n' +
        'Data pretendida: ' + formatarData(dados.data) + '\n' +
        'Hora pretendida: ' + dados.hora + '\n\n' +
        'Descrição:\n' + dados.descricao;

      var url = 'https://wa.me/' + NUMERO_WHATSAPP + '?text=' + encodeURIComponent(mensagem);

      mostrarMensagem('✅ A abrir o WhatsApp com o seu pedido...', 'sucesso');
      window.open(url, '_blank', 'noopener');

      if (btnSubmit) btnSubmit.textContent = textoOriginalBtn;
    });
  });
})();
