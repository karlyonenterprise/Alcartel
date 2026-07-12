/* ══════════════════════════════════════════════════════════════
   ALCARTEL — js/categorias-vaga.js
   Mapa de Categorias → Subcategorias usado no formulário de
   "Alerta de Emprego" (#alerta-form). Consumido por js/formulario.js
   para preencher dinamicamente o campo "Subcategoria da vaga
   pretendida" consoante a "Categoria da vaga pretendida" escolhida.

   Para adicionar/editar categorias ou subcategorias, basta editar
   este objecto — o formulário e a validação adaptam-se automaticamente.

   IMPORTANTE: as chaves deste objecto têm de coincidir exactamente
   com a lista CATEGORIAS_OFICIAIS em scripts/gerar-site.js (que
   regenera as opções do campo "Categoria" em cada build do site).
   ══════════════════════════════════════════════════════════════ */

window.ALCARTEL_CATEGORIAS_VAGA = {
  "Saúde": [
    "Medicina Geral",
    "Enfermagem Geral",
    "Enfermagem de Saúde Materno-Infantil",
    "Farmácia",
    "Laboratório Clínico",
    "Nutrição",
    "Fisioterapia",
    "Psicologia",
    "Saúde Pública",
    "Odontologia",
    "Imagiologia",
    "Anestesiologia",
    "Neonatologia",
    "Instrumentação Cirúrgica",
    "Administração Hospitalar",
    "Oftalmologia"
  ],
  "Educação e Professorado": [
    "Professor do Ensino Primário",
    "Professor de Português",
    "Professor de Matemática",
    "Professor de Física",
    "Professor de Química",
    "Professor de Biologia",
    "Professor de História",
    "Professor de Geografia",
    "Professor de Inglês",
    "Professor de Informática",
    "Educação Especial",
    "Educação Física"
  ],
  "Tecnologias de Informação": [
    "Programação",
    "Desenvolvimento Web",
    "Desenvolvimento Mobile",
    "Redes Informáticas",
    "Administração de Sistemas",
    "Base de Dados",
    "Cibersegurança",
    "Suporte Técnico",
    "Inteligência Artificial"
  ],
  "Administração e Gestão": [
    "Administração",
    "Gestão Empresarial",
    "Gestão de Projetos",
    "Gestão Pública"
  ],
  "Contabilidade e Finanças": [
    "Contabilidade",
    "Finanças",
    "Auditoria",
    "Fiscalidade"
  ],
  "Hotelaria e Turismo": [
    "Receção",
    "Cozinha",
    "Pastelaria",
    "Restaurante e Bar",
    "Turismo",
    "Guia Turístico",
    "Governanta"
  ],
  "Comércio e Vendas": [
    "Vendas",
    "Caixa",
    "Atendimento ao Cliente",
    "Representante Comercial"
  ],
  "Recursos Humanos": [
    "Recrutamento",
    "Formação",
    "Administração de Pessoal"
  ],
  "Engenharia": [
    "Engenharia Civil",
    "Engenharia Mecânica",
    "Engenharia Elétrica",
    "Engenharia Informática",
    "Engenharia Industrial"
  ],
  "Construção Civil": [
    "Pedreiro",
    "Carpinteiro",
    "Pintor",
    "Armador",
    "Canalizador"
  ],
  "Electricidade e Electrónica": [
    "Electricista",
    "Técnico de Electrónica",
    "Instalações Elétricas"
  ],
  "Mecânica": [
    "Mecânico Automóvel",
    "Mecânico Industrial",
    "Soldador"
  ],
  "Agricultura e Pecuária": [
    "Agricultura",
    "Pecuária",
    "Agropecuária"
  ],
  "Transportes e Logística": [
    "Motorista",
    "Operador de Empilhador",
    "Logística",
    "Armazém"
  ],
  "Direito e Justiça": [
    "Advogado",
    "Assistente Jurídico",
    "Oficial de Justiça"
  ],
  "Comunicação e Marketing": [
    "Marketing Digital",
    "Design Gráfico",
    "Jornalismo",
    "Comunicação"
  ],
  "Indústria": [
    "Operador de Produção",
    "Controlo de Qualidade",
    "Supervisor de Produção"
  ],
  "Segurança": [
    "Segurança Privada",
    "Vigilante",
    "Supervisor de Segurança"
  ],
  "Limpeza e Serviços Gerais": [
    "Limpeza",
    "Lavandaria",
    "Jardinagem"
  ],
  "Arte e Design": [
    "Designer Gráfico",
    "Fotografia",
    "Multimédia"
  ],
  "Outros": [
    "Outro"
  ]
};
