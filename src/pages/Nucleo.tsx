import { useMemo, useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Brain,
  BookOpen,
  Eye,
  Building2,
  TrendingUp,
  Activity,
  Plus,
  Trash2,
  FileText,
  Save,
  Search,
  ChevronRight,
  History,
  RotateCcw,
  Compass,
  Map as MapIcon,
  Cpu,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ---------- Types ----------

type AreaId = "biblioteca" | "consciencia" | "arquitetura" | "principios" | "atlas" | "ia-orquestradora" | "evolucao" | "estado-atual";

interface AreaMeta {
  id: AreaId;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

interface PageVersion {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  label?: string;
}

interface DocPage {
  id: string;
  areaId: AreaId;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  versions: PageVersion[];
}

// ---------- Config ----------

const AREAS: AreaMeta[] = [
  {
    id: "biblioteca",
    title: "Biblioteca do Projeto",
    description: "Documentos, referências e materiais de apoio.",
    icon: BookOpen,
    color: "#3B82F6",
  },
  {
    id: "consciencia",
    title: "Consciência",
    description: "Propósito, missão, visão e princípios do projeto.",
    icon: Eye,
    color: "#8B5CF6",
  },
  {
    id: "arquitetura",
    title: "Arquitetura",
    description: "Estrutura, módulos, fluxos e decisões técnicas.",
    icon: Building2,
    color: "#F59E0B",
  },
  {
    id: "principios",
    title: "Princípios Arquiteturais",
    description: "Princípios permanentes que orientam a evolução do Painel Central.",
    icon: Compass,
    color: "#6366F1",
  },
  {
    id: "atlas",
    title: "Atlas do Painel Central",
    description: "Mapa oficial da arquitetura da plataforma.",
    icon: MapIcon,
    color: "#0EA5E9",
  },
  {
    id: "ia-orquestradora",
    title: "IA Orquestradora (Cérebro Central)",
    description: "Inteligência central que observa, interpreta e coordena módulos, agentes e usuários.",
    icon: Cpu,
    color: "#A855F7",
  },
  {
    id: "evolucao",
    title: "Evolução do Projeto",
    description: "Marcos, aprendizados e histórico de mudanças.",
    icon: TrendingUp,
    color: "#10B981",
  },
  {
    id: "estado-atual",
    title: "Estado Atual do Sistema",
    description: "Documentação da arquitetura existente do Painel Central.",
    icon: Activity,
    color: "#EF4444",
  },
];

const STORAGE_KEY = "nucleo_painel_central_pages_v3";
const SEED_FLAG_KEY = "nucleo_biblioteca_seed_v1";
const CONSCIENCIA_SEED_FLAG_KEY = "nucleo_consciencia_seed_v1";

const CONSCIENCIA_SEED: Array<{ title: string; content: string; tags: string[] }> = [
  {
    title: "Diretrizes Operacionais da Consciência",
    tags: ["diretrizes", "operacional", "consciência", "fundamento"],
    content:
      "Diretrizes Operacionais da Consciência\n\n" +
      "Este documento reúne as diretrizes que orientam o funcionamento da Consciência do Painel Central — a camada responsável por integrar Memória, Aprendizagem, Personalidade, Regras e Especialistas em uma inteligência coerente e alinhada ao propósito do sistema.\n\n" +
      "1. Propósito\n" +
      "— Definir como a Consciência interpreta contexto, prioriza decisões e responde ao ambiente.\n\n" +
      "2. Princípios Operacionais\n" +
      "— Coerência com o Manifesto e a Constituição.\n" +
      "— Transparência das decisões e rastreabilidade das ações.\n" +
      "— Respeito às Regras e aos limites definidos.\n\n" +
      "3. Estrutura Futura\n" +
      "Esta área receberá progressivamente documentos específicos de:\n" +
      "• Memória — o que a Consciência lembra e como recupera.\n" +
      "• Aprendizagem — como evolui com base em experiência.\n" +
      "• Personalidade — tom, estilo e postura.\n" +
      "• Regras — limites, permissões e obrigações.\n" +
      "• Especialistas — perfis e domínios de conhecimento.\n" +
      "• Demais componentes da Inteligência Artificial.\n\n" +
      "— Escreva aqui as diretrizes completas conforme evoluírem.",
  },
];

const ARQUITETURA_SEED_FLAG_KEY = "nucleo_arquitetura_seed_v1";

const ARQUITETURA_SEED: Array<{ title: string; content: string; tags: string[] }> = [
  {
    title: "Visão Geral da Arquitetura",
    tags: ["arquitetura", "visão-geral", "plataforma"],
    content:
      "Visão Geral da Arquitetura\n\n" +
      "Documento-mãe da área de Arquitetura. Descreve, em alto nível, como o Painel Central está estruturado e como suas camadas se conectam.\n\n" +
      "— Escreva aqui a visão geral da plataforma.",
  },
  {
    title: "Arquitetura dos Módulos",
    tags: ["módulos", "estrutura"],
    content:
      "Arquitetura dos Módulos\n\n" +
      "Como cada módulo do Painel Central (CRM, Financeiro, Operações, Digital, Rotina, etc.) é organizado, suas responsabilidades e limites.\n\n" +
      "— Documente aqui a arquitetura de cada módulo.",
  },
  {
    title: "Arquitetura dos Agentes de IA",
    tags: ["ia", "agentes"],
    content:
      "Arquitetura dos Agentes de IA\n\n" +
      "Estrutura dos agentes de IA: papéis, contexto, ferramentas, memória, políticas de decisão e integração com a Consciência.\n\n" +
      "— Documente aqui cada agente e sua arquitetura.",
  },
  {
    title: "Banco de Dados",
    tags: ["banco-de-dados", "schema"],
    content:
      "Banco de Dados\n\n" +
      "Modelagem, tabelas, relacionamentos, políticas de acesso (RLS) e convenções do banco de dados.\n\n" +
      "— Documente aqui o schema e as regras de dados.",
  },
  {
    title: "Fluxos",
    tags: ["fluxos", "processos"],
    content:
      "Fluxos\n\n" +
      "Fluxos de dados, de usuário e de automações que atravessam o sistema (ex.: lead → venda → produção → entrega).\n\n" +
      "— Documente aqui cada fluxo relevante.",
  },
  {
    title: "APIs",
    tags: ["api", "endpoints"],
    content:
      "APIs\n\n" +
      "Endpoints internos e externos, contratos, autenticação, versionamento e exemplos de uso.\n\n" +
      "— Documente aqui as APIs expostas e consumidas.",
  },
  {
    title: "Integrações",
    tags: ["integrações", "terceiros"],
    content:
      "Integrações\n\n" +
      "Integrações com serviços externos (WhatsApp, provedores de IA, pagamentos, e-mail, etc.): configuração, limites e falhas conhecidas.\n\n" +
      "— Documente aqui cada integração ativa.",
  },
  {
    title: "Estrutura Geral da Plataforma",
    tags: ["plataforma", "infraestrutura"],
    content:
      "Estrutura Geral da Plataforma\n\n" +
      "Camadas de frontend, backend, banco, storage, edge functions, autenticação e deploy. Como tudo se encaixa.\n\n" +
      "— Documente aqui a estrutura geral.",
  },
];

const PRINCIPIOS_SEED_FLAG_KEY = "nucleo_principios_seed_v1";

const PRINCIPIOS_SEED: Array<{ title: string; content: string; tags: string[] }> = [
  {
    title: "Princípio Mestre",
    tags: ["princípio", "mestre", "fundamento"],
    content:
      "Princípio Mestre\n\n" +
      "Princípio que rege todos os demais. Define a intenção fundamental por trás de cada decisão arquitetural do Painel Central.\n\n" +
      "• Enunciado — descreva aqui, em uma frase, o princípio que orienta tudo.\n" +
      "• Motivação — por que esse princípio existe.\n" +
      "• Implicações — o que ele obriga, permite e proíbe.\n" +
      "• Exemplos — situações concretas em que ele foi aplicado.\n\n" +
      "— Edite livremente. Esta página é referência permanente para decisões futuras.",
  },
  {
    title: "Princípio da Integração Universal",
    tags: ["princípio", "integração", "universal"],
    content:
      "Princípio da Integração Universal\n\n" +
      "Todo módulo, dado e agente do Painel Central deve poder se comunicar com qualquer outro, sem barreiras artificiais.\n\n" +
      "• Enunciado — \n" +
      "• Motivação — \n" +
      "• Implicações práticas (APIs, eventos, contratos, contexto compartilhado) — \n" +
      "• Antipadrões a evitar — \n\n" +
      "— Documente aqui como a integração universal deve ser aplicada em cada evolução.",
  },
  {
    title: "Princípio da Modularidade",
    tags: ["princípio", "modularidade"],
    content:
      "Princípio da Modularidade\n\n" +
      "O sistema deve ser composto por módulos coesos, com responsabilidades claras e baixo acoplamento.\n\n" +
      "• Enunciado — \n" +
      "• Critérios de coesão e acoplamento — \n" +
      "• Regras para criação e remoção de módulos — \n" +
      "• Exemplos de boa e má modularidade — \n\n" +
      "— Edite conforme a arquitetura evolui.",
  },
  {
    title: "Princípio da Escalabilidade",
    tags: ["princípio", "escalabilidade"],
    content:
      "Princípio da Escalabilidade\n\n" +
      "Toda decisão deve considerar crescimento: em dados, em usuários, em módulos e em complexidade operacional.\n\n" +
      "• Enunciado — \n" +
      "• Dimensões de escala (dados, tráfego, times, integrações) — \n" +
      "• Estratégias adotadas (índices, paginação, cache, filas, workers) — \n" +
      "• Limites conhecidos e planos de mitigação — \n\n" +
      "— Registre aqui as diretrizes de escala do Painel Central.",
  },
  {
    title: "Princípio da Baixa Complexidade",
    tags: ["princípio", "simplicidade", "complexidade"],
    content:
      "Princípio da Baixa Complexidade\n\n" +
      "A solução mais simples que resolve o problema é a solução correta. Complexidade só se paga com valor real e comprovado.\n\n" +
      "• Enunciado — \n" +
      "• Como avaliar complexidade essencial vs acidental — \n" +
      "• Regras de simplicidade (nomes, camadas, dependências, abstrações) — \n" +
      "• Sinais de alerta (over-engineering, duplicação de conceitos, camadas inúteis) — \n\n" +
      "— Este princípio deve ser consultado antes de introduzir qualquer nova abstração.",
  },
  {
    title: "Princípio da Independência Tecnológica",
    tags: ["princípio", "independência", "tecnologia"],
    content:
      "Princípio da Independência Tecnológica\n\n" +
      "O Painel Central não deve ficar refém de nenhum fornecedor, framework ou tecnologia específica além do estritamente necessário.\n\n" +
      "• Enunciado — \n" +
      "• Camadas de isolamento (portas, adaptadores, contratos internos) — \n" +
      "• Tecnologias-chave e seus planos de substituição — \n" +
      "• Critérios para adotar ou abandonar uma tecnologia — \n\n" +
      "— Documente aqui as decisões que preservam a independência da plataforma.",
  },
  {
    title: "Princípio da Sequência de Decisão da IA",
    tags: ["princípio", "ia", "sequencia-decisao", "orquestracao"],
    content:
      "Princípio da Sequência de Decisão da IA\n\n" +
      "Princípio permanente que define a ordem obrigatória de raciocínio de toda inteligência artificial do Painel Central.\n\n" +
      "A sequência é:\n" +
      "1. Perceber — captar sinais, eventos, métricas e mudanças de estado do sistema e do ambiente.\n" +
      "2. Compreender — construir contexto a partir dos sinais captados, cruzando com histórico, objetivos e regras do Núcleo.\n" +
      "3. Priorizar — ordenar oportunidades, riscos e gargalos segundo urgência, impacto e alinhamento estratégico.\n" +
      "4. Decidir — escolher a ação mais adequada com base no contexto compreendido e nas prioridades estabelecidas.\n" +
      "5. Coordenar — delegar ações a módulos, agentes especialistas ou usuários, respeitando escopo e políticas de autonomia.\n" +
      "6. Aprender — registrar resultados, ajustar heurísticas, alimentar a memória do Núcleo e melhorar ciclos futuros.\n\n" +
      "• Nenhuma decisão da IA pode pular etapas da sequência sem justificativa documentada.\n" +
      "• Em situações de urgência extrema, a IA pode acelerar a sequência, mas nunca omiti-la por completo.\n" +
      "• O aprendizado de cada ciclo retroalimenta as etapas de Perceber e Compreender do ciclo seguinte.\n" +
      "• Este princípio se aplica à IA Orquestradora, aos agentes especialistas e a qualquer automação com capacidade de decisão.\n\n" +
      "— Este princípio é referência obrigatória para projetar, revisar e auditar qualquer fluxo de decisão da IA no Painel Central.",
  },
  {
    title: "Princípio da Coordenação por Especialistas",
    tags: ["princípio", "especialistas", "modularidade", "orquestracao"],
    content:
      "Princípio da Coordenação por Especialistas\n\n" +
      "Nenhum módulo é o centro do sistema.\n\n" +
      "Cada módulo representa um especialista em sua área — CRM, Financeiro, Produção, Digital, Rotina, Agenda e demais — com responsabilidade clara sobre seu domínio.\n\n" +
      "• Os módulos não competem entre si; complementam-se como especialistas de um mesmo ecossistema.\n" +
      "• A centralidade do sistema reside na coordenação inteligente, não em nenhum módulo isolado.\n" +
      "• A IA Orquestradora é quem observa, interpreta e coordena todos os especialistas para alcançar os objetivos definidos.\n" +
      "• Nenhum módulo pode ser projetado como dependência obrigatória de todos os outros; a arquitetura deve permitir evolução independente.\n" +
      "• Novos especialistas podem ser integrados sem alterar o centro do sistema, pois o centro é a coordenação, não um módulo.\n\n" +
      "— Este princípio orienta a divisão de responsabilidades, a priorização de evoluções e a avaliação de novos módulos no Painel Central.",
  },
  {
    title: "Princípio da Proatividade da IA",
    tags: ["princípio", "ia", "proatividade", "orquestracao", "contexto"],
    content:
      "Princípio da Proatividade da IA\n\n" +
      "A IA do Painel Central não reage apenas a comandos do usuário.\n\n" +
      "Ela observa continuamente eventos do sistema, analisa o contexto global e decide quais especialistas devem participar antes de sugerir ou executar qualquer ação.\n\n" +
      "Comportamento esperado:\n" +
      "• Observação — a IA monitora sinais, métricas, alertas e mudanças de estado dos módulos e do ambiente, mesmo sem comando explícito.\n" +
      "• Análise de contexto global — a IA cruza dados de múltiplos especialistas, histórico, objetivos e regras do Núcleo para formar uma visão unificada antes de agir.\n" +
      "• Seleção de especialistas — antes de sugerir ou executar uma ação, a IA identifica e convoca os especialistas cujos domínios são relevantes para o contexto detectado.\n" +
      "• Antecipação — a IA antecipa necessidades e gargalos com base em padrões observados, propondo ações preventivas, não apenas reativas.\n" +
      "• Coordenação inteligente — a IA Orquestradora distribui tarefas entre especialistas selecionados, garantindo que cada um atue dentro de sua competência.\n\n" +
      "Limites:\n" +
      "• A proatividade respeita as políticas de autonomia e níveis de risco configurados.\n" +
      "• Ações de alto risco ou impacto estratégico exigem aprovação do usuário, mesmo quando antecipadas pela IA.\n" +
      "• O usuário pode sempre interromper, ajustar ou redefinir as sugestões proativas da IA.\n\n" +
      "— Este princípio assegura que a IA opere como parceira inteligente, não como mera executora de comandos.",
  },
  {
    title: "Princípio da Orientação por Objetivos",
    tags: ["princípio", "ia", "objetivos", "orientacao", "orquestracao"],
    content:
      "Princípio da Orientação por Objetivos\n\n" +
      "A principal responsabilidade da IA é conduzir o usuário aos seus objetivos.\n\n" +
      "Todas as decisões, sugestões e automações da IA Orquestradora devem considerar os objetivos ativos do usuário antes de qualquer outra ação.\n\n" +
      "Regras:\n" +
      "• Os objetivos ativos são o critério máximo de prioridade para qualquer decisão da IA.\n" +
      "• Sempre que a IA sugerir, decidir ou automatizar algo, ela deve validar se a ação contribui direta ou indiretamente para um objetivo ativo.\n" +
      "• Caso existam múltiplos objetivos ativos, a IA deve priorizar segundo impacto, urgência e dependências entre eles.\n" +
      "• Nenhuma ação da IA deve ser considerada isoladamente; toda ação deve ser avaliada pelo seu efeito sobre o progresso dos objetivos ativos.\n" +
      "• Quando não houver objetivos ativos definidos, a IA deve incentivar o usuário a estabelecê-los antes de propor automações de grande escopo.\n\n" +
      "— Este princípio garante que a inteligência do Painel Central esteja sempre alinhada às intenções reais do usuário, tornando o sistema um verdadeiro facilitador de resultados.",
  },
  {
    title: "Princípio do Organismo Único",
    tags: ["princípio", "ia", "orquestracao", "organismo", "integracao"],
    content:
      "Princípio do Organismo Único\n\n" +
      "O usuário conversa com um único sistema inteligente.\n\n" +
      "A coordenação entre módulos acontece internamente pela IA Orquestradora, tornando o Painel Central um organismo único, contínuo e integrado.\n\n" +
      "Regras:\n" +
      "• O usuário nunca precisa saber qual módulo está sendo acionado; ele interage com o sistema como um todo.\n" +
      "• A IA Orquestradora é a única interface de coordenação entre especialistas; nenhum módulo expõe sua lógica interna diretamente ao usuário.\n" +
      "• Transições entre contextos (CRM → Financeiro → Produção → Digital) devem ser fluidas e transparentes, mantendo a continuidade da conversa.\n" +
      "• O sistema deve preservar o estado e o contexto da interação do usuário em todas as transições entre especialistas.\n" +
      "• Nenhum módulo pode criar uma experiência fragmentada ou exigir que o usuário recontextualize informações já fornecidas.\n" +
      "• A IA Orquestradora garante que a resposta final ao usuário seja coerente, unificada e alinhada aos objetivos ativos, independentemente de quantos especialistas participaram.\n\n" +
      "— Este princípio transforma o Painel Central de uma coleção de módulos em um organismo inteligente e contínuo.",
  },
];

const PRINCIPIO_SEQUENCIA_DECISAO_FLAG_KEY = "nucleo_principio_sequencia_decisao_v1";

const PRINCIPIO_SEQUENCIA_DECISAO_PAGE: { title: string; content: string; tags: string[] } = {
  title: "Princípio da Sequência de Decisão da IA",
  tags: ["princípio", "ia", "sequencia-decisao", "orquestracao"],
  content:
    "Princípio da Sequência de Decisão da IA\n\n" +
    "Princípio permanente que define a ordem obrigatória de raciocínio de toda inteligência artificial do Painel Central.\n\n" +
    "A sequência é:\n" +
    "1. Perceber — captar sinais, eventos, métricas e mudanças de estado do sistema e do ambiente.\n" +
    "2. Compreender — construir contexto a partir dos sinais captados, cruzando com histórico, objetivos e regras do Núcleo.\n" +
    "3. Priorizar — ordenar oportunidades, riscos e gargalos segundo urgência, impacto e alinhamento estratégico.\n" +
    "4. Decidir — escolher a ação mais adequada com base no contexto compreendido e nas prioridades estabelecidas.\n" +
    "5. Coordenar — delegar ações a módulos, agentes especialistas ou usuários, respeitando escopo e políticas de autonomia.\n" +
    "6. Aprender — registrar resultados, ajustar heurísticas, alimentar a memória do Núcleo e melhorar ciclos futuros.\n\n" +
    "• Nenhuma decisão da IA pode pular etapas da sequência sem justificativa documentada.\n" +
    "• Em situações de urgência extrema, a IA pode acelerar a sequência, mas nunca omiti-la por completo.\n" +
    "• O aprendizado de cada ciclo retroalimenta as etapas de Perceber e Compreender do ciclo seguinte.\n" +
    "• Este princípio se aplica à IA Orquestradora, aos agentes especialistas e a qualquer automação com capacidade de decisão.\n\n" +
      "— Este princípio é referência obrigatória para projetar, revisar e auditar qualquer fluxo de decisão da IA no Painel Central.",
};

const PRINCIPIO_COORDENACAO_ESPECIALISTAS_FLAG_KEY = "nucleo_principio_coordenacao_especialistas_v1";

const PRINCIPIO_COORDENACAO_ESPECIALISTAS_PAGE: { title: string; content: string; tags: string[] } = {
  title: "Princípio da Coordenação por Especialistas",
  tags: ["princípio", "especialistas", "modularidade", "orquestracao"],
  content:
    "Princípio da Coordenação por Especialistas\n\n" +
    "Nenhum módulo é o centro do sistema.\n\n" +
    "Cada módulo representa um especialista em sua área — CRM, Financeiro, Produção, Digital, Rotina, Agenda e demais — com responsabilidade clara sobre seu domínio.\n\n" +
    "• Os módulos não competem entre si; complementam-se como especialistas de um mesmo ecossistema.\n" +
    "• A centralidade do sistema reside na coordenação inteligente, não em nenhum módulo isolado.\n" +
    "• A IA Orquestradora é quem observa, interpreta e coordena todos os especialistas para alcançar os objetivos definidos.\n" +
    "• Nenhum módulo pode ser projetado como dependência obrigatória de todos os outros; a arquitetura deve permitir evolução independente.\n" +
    "• Novos especialistas podem ser integrados sem alterar o centro do sistema, pois o centro é a coordenação, não um módulo.\n\n" +
    "— Este princípio orienta a divisão de responsabilidades, a priorização de evoluções e a avaliação de novos módulos no Painel Central.",
};

const PRINCIPIO_PROATIVIDADE_IA_FLAG_KEY = "nucleo_principio_proatividade_ia_v1";

const PRINCIPIO_PROATIVIDADE_IA_PAGE: { title: string; content: string; tags: string[] } = {
  title: "Princípio da Proatividade da IA",
  tags: ["princípio", "ia", "proatividade", "orquestracao", "contexto"],
  content:
    "Princípio da Proatividade da IA\n\n" +
    "A IA do Painel Central não reage apenas a comandos do usuário.\n\n" +
    "Ela observa continuamente eventos do sistema, analisa o contexto global e decide quais especialistas devem participar antes de sugerir ou executar qualquer ação.\n\n" +
    "Comportamento esperado:\n" +
    "• Observação — a IA monitora sinais, métricas, alertas e mudanças de estado dos módulos e do ambiente, mesmo sem comando explícito.\n" +
    "• Análise de contexto global — a IA cruza dados de múltiplos especialistas, histórico, objetivos e regras do Núcleo para formar uma visão unificada antes de agir.\n" +
    "• Seleção de especialistas — antes de sugerir ou executar uma ação, a IA identifica e convoca os especialistas cujos domínios são relevantes para o contexto detectado.\n" +
    "• Antecipação — a IA antecipa necessidades e gargalos com base em padrões observados, propondo ações preventivas, não apenas reativas.\n" +
    "• Coordenação inteligente — a IA Orquestradora distribui tarefas entre especialistas selecionados, garantindo que cada um atue dentro de sua competência.\n\n" +
    "Limites:\n" +
    "• A proatividade respeita as políticas de autonomia e níveis de risco configurados.\n" +
    "• Ações de alto risco ou impacto estratégico exigem aprovação do usuário, mesmo quando antecipadas pela IA.\n" +
    "• O usuário pode sempre interromper, ajustar ou redefinir as sugestões proativas da IA.\n\n" +
    "— Este princípio assegura que a IA opere como parceira inteligente, não como mera executora de comandos.",
};

const PRINCIPIO_ORIENTACAO_OBJETIVOS_FLAG_KEY = "nucleo_principio_orientacao_objetivos_v1";

const PRINCIPIO_ORGANISMO_UNICO_FLAG_KEY = "nucleo_principio_organismo_unico_v1";
const PRINCIPIO_VERACIDADE_OPERACIONAL_FLAG_KEY = "nucleo_principio_veracidade_operacional_ia_v1";

const PRINCIPIO_ORGANISMO_UNICO_PAGE: { title: string; content: string; tags: string[] } = {
  title: "Princípio do Organismo Único",
  tags: ["princípio", "ia", "orquestracao", "organismo", "integracao"],
  content:
    "Princípio do Organismo Único\n\n" +
    "O usuário conversa com um único sistema inteligente.\n\n" +
    "A coordenação entre módulos acontece internamente pela IA Orquestradora, tornando o Painel Central um organismo único, contínuo e integrado.\n\n" +
    "Regras:\n" +
    "• O usuário nunca precisa saber qual módulo está sendo acionado; ele interage com o sistema como um todo.\n" +
    "• A IA Orquestradora é a única interface de coordenação entre especialistas; nenhum módulo expõe sua lógica interna diretamente ao usuário.\n" +
    "• Transições entre contextos (CRM → Financeiro → Produção → Digital) devem ser fluidas e transparentes, mantendo a continuidade da conversa.\n" +
    "• O sistema deve preservar o estado e o contexto da interação do usuário em todas as transições entre especialistas.\n" +
    "• Nenhum módulo pode criar uma experiência fragmentada ou exigir que o usuário recontextualize informações já fornecidas.\n" +
    "• A IA Orquestradora garante que a resposta final ao usuário seja coerente, unificada e alinhada aos objetivos ativos, independentemente de quantos especialistas participaram.\n\n" +
    "— Este princípio transforma o Painel Central de uma coleção de módulos em um organismo inteligente e contínuo.",
};

const PRINCIPIO_VERACIDADE_OPERACIONAL_PAGE: { title: string; content: string; tags: string[] } = {
  title: "Princípio da Veracidade Operacional da IA",
  tags: ["princípio", "ia", "governanca", "execucao", "auditoria"],
  content:
    "Princípio da Veracidade Operacional da IA\n\n" +
    "A IA do Painel Central nunca pode afirmar que executou uma ação sem confirmação real, explícita e auditável da camada de execução do sistema.\n\n" +
    "Regra central:\n" +
    "• Resposta não é execução. Plano não é execução. Intenção detectada não é execução.\n" +
    "• A IA só pode dizer que criou, editou, excluiu, removeu, concluiu, deu baixa ou executou algo quando houver retorno técnico confirmado da ferramenta responsável.\n" +
    "• Na ausência dessa confirmação, a IA deve declarar que está apenas propondo um plano, aguardando validação ou solicitando confirmação.\n" +
    "• Comandos críticos, especialmente exclusões, exigem identificação exata do alvo, validação contra dados existentes, análise de impacto e confirmação do usuário antes de qualquer execução.\n" +
    "• A IA não pode inventar IDs, nomes, resultados ou status de execução. Toda resposta deve separar claramente: objetivo identificado, especialistas envolvidos, plano proposto, riscos e estado real da execução.\n\n" +
    "Antipadrões proibidos:\n" +
    "• Dizer 'feito', 'excluído', 'executei', 'já removi' ou equivalente sem confirmação da camada de execução.\n" +
    "• Tratar uma resposta textual do modelo como comando executado.\n" +
    "• Executar ação destrutiva a partir de interpretação frágil, ambígua ou não validada.\n\n" +
    "— Este princípio torna a IA auditável, confiável e alinhada à Consciência e ao Núcleo do Painel Central.",
};

const ARQUITETURA_ESPECIALISTAS_FLAG_KEY = "nucleo_arquitetura_especialistas_v1";
const ARQUITETURA_ESPECIALISTAS_PAGE: { title: string; content: string; tags: string[] } = {
  title: "Arquitetura dos Especialistas",
  tags: ["arquitetura", "especialistas", "ia", "orquestracao", "motor-de-coordenacao"],
  content:
    "Arquitetura dos Especialistas\n\n" +
    "Todo módulo operacional do Painel Central deve ser tratado como um Especialista.\n\n" +
    "Regras fundamentais:\n" +
    "• Especialistas possuem conhecimento profundo do seu próprio domínio.\n" +
    "• Especialistas executam operações reais dentro do seu módulo.\n" +
    "• Especialistas não tomam decisões estratégicas.\n" +
    "• Especialistas não conversam diretamente com o usuário.\n" +
    "• Toda coordenação passa pela IA Orquestradora e pelo Motor de Coordenação.\n\n" +
    "Fluxo oficial:\n" +
    "IA Orquestradora → Motor de Coordenação → Especialista → Motor de Coordenação → IA Orquestradora → Usuário\n\n" +
    "— Este documento registra oficialmente que os módulos do Painel Central são Especialistas coordenados pela IA Orquestradora.",
};

const PRINCIPIO_ESPECIALISTAS_FLAG_KEY = "nucleo_principio_especialistas_v1";
const PRINCIPIO_ESPECIALISTAS_PAGE: { title: string; content: string; tags: string[] } = {
  title: "Princípio dos Especialistas",
  tags: ["princípio", "especialistas", "modulos", "orquestracao"],
  content:
    "Princípio dos Especialistas\n\n" +
    "Todo módulo operacional do Painel Central é um Especialista.\n\n" +
    "Cada Especialista executa apenas operações do seu próprio domínio, respeitando o Núcleo, a IA Orquestradora e o Motor de Coordenação.",
};

const CATALOGO_ESPECIALISTAS_FLAG_KEY = "nucleo_atlas_catalogo_especialistas_v1";
const CATALOGO_ESPECIALISTAS_PAGE: { title: string; content: string; tags: string[] } = {
  title: "Catálogo de Especialistas",
  tags: ["atlas", "especialistas", "catalogo"],
  content:
    "Catálogo de Especialistas\n\n" +
    "Registro oficial dos Especialistas do Painel Central. Cada Especialista abaixo deve ser detalhado nos campos: Nome, Missão, Domínio, Entidades controladas, Operações suportadas, Eventos gerados, Eventos consumidos, Status e Versão.\n\n" +
    [
      "Especialista CRM",
      "Especialista Financeiro",
      "Especialista Produção",
      "Especialista Digital",
      "Especialista Rotina",
      "Especialista Agenda",
      "Especialista Estoque",
      "Especialista Operações",
      "Especialista Compras",
      "Especialista Reuniões",
      "Especialista IA",
    ]
      .map(
        (nome) =>
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${nome}\n\n` +
          "• Nome — \n" +
          "• Missão — \n" +
          "• Domínio — \n" +
          "• Entidades controladas — \n" +
          "• Operações suportadas — \n" +
          "• Eventos gerados — \n" +
          "• Eventos consumidos — \n" +
          "• Status — \n" +
          "• Versão — \n",
      )
      .join("\n") +
    "\n— Estrutura inicial. Cada Especialista deve ser preenchido conforme for conectado ao Motor de Coordenação.",
};

const ARQUITETURA_EXECUTOR_FLAG_KEY = "nucleo_arquitetura_executor_v1";
const ARQUITETURA_EXECUTOR_PAGE: { title: string; content: string; tags: string[] } = {
  title: "Camada Executor",
  tags: ["arquitetura", "executor", "especialistas", "execucao", "motor-de-coordenacao"],
  content:
    "Camada Executor\n\n" +
    "A Camada Executor é responsável pela execução técnica das operações solicitadas pelos Especialistas.\n\n" +
    "Fluxo oficial:\n\n" +
    "Núcleo\n" +
    "↓\n" +
    "Consciência\n" +
    "↓\n" +
    "IA Orquestradora\n" +
    "↓\n" +
    "Motor de Coordenação\n" +
    "↓\n" +
    "Especialista\n" +
    "↓\n" +
    "Executor\n" +
    "↓\n" +
    "Hooks / Supabase / Banco de Dados\n" +
    "↓\n" +
    "Executor\n" +
    "↓\n" +
    "Especialista\n" +
    "↓\n" +
    "Motor de Coordenação\n" +
    "↓\n" +
    "IA Orquestradora\n" +
    "↓\n" +
    "Usuário\n\n" +
    "Definições:\n\n" +
    "• A IA Orquestradora compreende objetivos e coordena o sistema.\n" +
    "• O Motor de Coordenação encaminha a solicitação ao Especialista correto.\n" +
    "• O Especialista entende a regra de negócio do seu módulo.\n" +
    "• O Executor realiza a operação técnica no sistema.\n" +
    "• O Executor não toma decisões estratégicas.\n" +
    "• O Executor não conversa com o usuário.\n" +
    "• O Executor apenas executa, valida retorno técnico e devolve resultado ao Especialista.\n\n" +
    "— Este documento oficializa a Camada Executor como a peça que traduz a intenção do Especialista em ação técnica real no Painel Central.",
};

const CONTRATO_ESPECIALISTA_FLAG_KEY = "nucleo_contrato_oficial_especialista_v1";
const CONTRATO_ESPECIALISTA_PAGE: { title: string; content: string; tags: string[] } = {
  title: "Contrato Oficial do Especialista",
  tags: ["arquitetura", "especialistas", "contrato", "motor-de-coordenacao", "executor"],
  content:
    "Contrato Oficial do Especialista\n\n" +
    "Este documento padroniza oficialmente como todo Especialista do Painel Central deve ser definido, registrado e conectado ao Motor de Coordenação.\n\n" +
    "Todo Especialista deve possuir obrigatoriamente:\n\n" +
    "• Nome\n" +
    "• Módulo relacionado\n" +
    "• Missão\n" +
    "• Domínio de atuação\n" +
    "• Entidades controladas\n" +
    "• Operações suportadas\n" +
    "• Executor responsável\n" +
    "• Hooks / funções utilizados\n" +
    "• Eventos que pode gerar\n" +
    "• Eventos que pode consumir\n" +
    "• Status: planejado, beta ou ativo\n" +
    "• Versão\n" +
    "• Limites de atuação\n" +
    "• Regras de validação\n" +
    "• Formato de entrada\n" +
    "• Formato de saída\n" +
    "• Correlation ID obrigatório\n\n" +
    "Regras permanentes:\n\n" +
    "• O Especialista não conversa diretamente com o usuário.\n" +
    "• O Especialista não toma decisão estratégica.\n" +
    "• O Especialista executa apenas operações do seu domínio.\n" +
    "• Toda solicitação chega pelo Motor de Coordenação.\n" +
    "• Todo retorno volta pelo Motor de Coordenação.\n" +
    "• Todo Especialista deve se registrar no Registro Universal de Especialistas.\n" +
    "• Todo Especialista deve utilizar o Executor Base direta ou indiretamente.\n" +
    "• Toda execução deve retornar sucesso, erro ou pendência de forma padronizada.\n\n" +
    "— Este contrato é parte permanente da arquitetura do Núcleo do Painel Central e deve ser respeitado por todo Especialista existente ou futuro.",
};

const MODELO_CRIACAO_ESPECIALISTA_FLAG_KEY = "nucleo_modelo_criacao_especialistas_v1";
const MODELO_CRIACAO_ESPECIALISTA_PAGE: { title: string; content: string; tags: string[] } = {
  title: "Modelo Oficial de Criação de Especialistas",
  tags: ["arquitetura", "especialistas", "modelo", "criacao", "motor-de-coordenacao", "executor"],
  content:
    "Modelo Oficial de Criação de Especialistas\n\n" +
    "Este documento estabelece o processo oficial para criação de qualquer novo Especialista do Painel Central.\n\n" +
    "A partir deste registro, todo novo Especialista obrigatoriamente seguirá a sequência abaixo:\n\n" +
    "1. Definir missão\n" +
    "   — Estabelecer o propósito único do Especialista dentro do ecossistema do Painel Central.\n\n" +
    "2. Definir domínio de atuação\n" +
    "   — Delimitar claramente o escopo, as fronteiras e as responsabilidades do Especialista.\n\n" +
    "3. Definir entidades\n" +
    "   — Identificar as entidades do sistema sobre as quais o Especialista atuará.\n\n" +
    "4. Definir operações\n" +
    "   — Listar as operações genéricas que o Especialista poderá executar sobre cada entidade.\n\n" +
    "5. Registrar no Catálogo Universal de Capacidades\n" +
    "   — Declarar o módulo, as entidades, as operações e o status de cada capacidade no catálogo oficial.\n\n" +
    "6. Registrar no Registro Universal de Especialistas\n" +
    "   — Auto-registrar o Especialista e suas operações no registro runtime, tornando-o descobrível pelo Motor de Coordenação.\n\n" +
    "7. Criar Executor do Especialista\n" +
    "   — Implementar o executor específico do módulo, responsável pela tradução técnica das operações.\n\n" +
    "8. Conectar ao Executor Base\n" +
    "   — Fazer com que o Executor do Especialista utilize o Executor Base para padronização de entrada, validação e retorno.\n\n" +
    "9. Conectar aos Hooks existentes\n" +
    "   — Integrar o Executor aos hooks, funções e serviços já disponíveis no Core do Sistema.\n\n" +
    "10. Validar funcionamento\n" +
    "    — Executar testes de fluxo completo: IA Orquestradora → Motor de Coordenação → Especialista → Executor → Banco → Retorno.\n\n" +
    "11. Ativar o Especialista\n" +
    "    — Alterar o status da capacidade no catálogo para ativo e garantir que o Registro Universal esteja consistente.\n\n" +
    "Regra permanente:\n\n" +
    "• Este é o único processo oficial para criação de novos Especialistas no Painel Central.\n" +
    "• Nenhum Especialista pode ser ativado sem passar por todas as etapas acima.\n" +
    "• Desvios só são permitidos mediante registro documentado e aprovado no Núcleo.\n\n" +
    "— Este modelo é parte permanente da arquitetura do Núcleo do Painel Central e deve ser seguido em toda industrialização de Especialistas.",
};

const PRINCIPIO_SEPARACAO_FLAG_KEY = "nucleo_principio_separacao_inteligencia_regra_execucao_v1";
const PRINCIPIO_SEPARACAO_PAGE: { title: string; content: string; tags: string[] } = {
  title: "Princípio da Separação entre Inteligência, Regra e Execução",
  tags: ["princípio", "ia", "especialistas", "executor", "separacao", "arquitetura"],
  content:
    "Princípio da Separação entre Inteligência, Regra e Execução\n\n" +
    "A IA Orquestradora decide e coordena.\n\n" +
    "O Especialista interpreta a regra de negócio do módulo.\n\n" +
    "O Executor realiza a execução técnica.\n\n" +
    "Nenhuma dessas responsabilidades deve ser misturada.\n\n" +
    "Objetivo:\n" +
    "Garantir escalabilidade, segurança, baixa complexidade e facilidade para trocar ou evoluir tecnologias no futuro.",
};

const PRINCIPIO_ORIENTACAO_OBJETIVOS_PAGE: { title: string; content: string; tags: string[] } = {
  title: "Princípio da Orientação por Objetivos",
  tags: ["princípio", "ia", "objetivos", "orientacao", "orquestracao"],
  content:
    "Princípio da Orientação por Objetivos\n\n" +
    "A principal responsabilidade da IA é conduzir o usuário aos seus objetivos.\n\n" +
    "Todas as decisões, sugestões e automações da IA Orquestradora devem considerar os objetivos ativos do usuário antes de qualquer outra ação.\n\n" +
    "Regras:\n" +
    "• Os objetivos ativos são o critério máximo de prioridade para qualquer decisão da IA.\n" +
    "• Sempre que a IA sugerir, decidir ou automatizar algo, ela deve validar se a ação contribui direta ou indiretamente para um objetivo ativo.\n" +
    "• Caso existam múltiplos objetivos ativos, a IA deve priorizar segundo impacto, urgência e dependências entre eles.\n" +
    "• Nenhuma ação da IA deve ser considerada isoladamente; toda ação deve ser avaliada pelo seu efeito sobre o progresso dos objetivos ativos.\n" +
    "• Quando não houver objetivos ativos definidos, a IA deve incentivar o usuário a estabelecê-los antes de propor automações de grande escopo.\n\n" +
    "— Este princípio garante que a inteligência do Painel Central esteja sempre alinhada às intenções reais do usuário, tornando o sistema um verdadeiro facilitador de resultados.",
};

const IA_ORQUESTRADORA_SEED_FLAG_KEY = "nucleo_ia_orquestradora_seed_v1";

const IA_ORQUESTRADORA_SEED: Array<{ title: string; content: string; tags: string[] }> = [
  {
    title: "Visão Geral — IA Orquestradora (Cérebro Central)",
    tags: ["ia-orquestradora", "visao", "cerebro-central"],
    content:
      "IA Orquestradora — Cérebro Central do Painel Central\n\n" +
      "A IA Orquestradora é a inteligência central do Painel Central.\n\n" +
      "Missão:\n" +
      "• Observar continuamente o estado do sistema.\n" +
      "• Compreender o contexto operacional, estratégico e humano.\n" +
      "• Interpretar eventos relevantes emitidos por módulos, agentes e usuários.\n" +
      "• Coordenar módulos, agentes especialistas e usuários em direção aos objetivos definidos.\n" +
      "• Respeitar sempre o Núcleo do Painel Central e as políticas de autonomia vigentes.\n\n" +
      "Ela não substitui os módulos nem os agentes especialistas: ela os orquestra, garantindo coerência, prioridade e alinhamento com a estratégia.",
  },
  {
    title: "Responsabilidades",
    tags: ["ia-orquestradora", "responsabilidades"],
    content:
      "Responsabilidades da IA Orquestradora\n\n" +
      "• Observação contínua — monitorar sinais, métricas, alertas e mudanças de estado.\n" +
      "• Compreensão de contexto — cruzar dados de múltiplos módulos para formar uma visão unificada.\n" +
      "• Interpretação de eventos — classificar, priorizar e correlacionar acontecimentos.\n" +
      "• Coordenação — acionar módulos, agentes especialistas e usuários com a tarefa certa, no momento certo.\n" +
      "• Aderência ao Núcleo — validar toda decisão contra os princípios e diretrizes registrados no Núcleo.\n" +
      "• Governança de autonomia — respeitar níveis de risco, aprovação e autopilot configurados.",
  },
  {
    title: "Ciclo de Operação",
    tags: ["ia-orquestradora", "ciclo", "loop"],
    content:
      "Ciclo de Operação (Observar → Compreender → Interpretar → Coordenar → Aprender)\n\n" +
      "1. Observar — coletar eventos, métricas e sinais do sistema.\n" +
      "2. Compreender — construir contexto a partir de estado atual, histórico e objetivos.\n" +
      "3. Interpretar — identificar oportunidades, riscos, gargalos e prioridades.\n" +
      "4. Coordenar — delegar ações a módulos, agentes ou usuários, respeitando políticas.\n" +
      "5. Aprender — registrar resultados, ajustar heurísticas e alimentar a memória do Núcleo.",
  },
  {
    title: "Relação com o Núcleo",
    tags: ["ia-orquestradora", "nucleo", "governanca"],
    content:
      "Relação com o Núcleo do Painel Central\n\n" +
      "• O Núcleo é a fonte oficial de conhecimento, princípios e diretrizes.\n" +
      "• A IA Orquestradora consulta o Núcleo antes de decidir ou coordenar ações relevantes.\n" +
      "• Nenhuma decisão da Orquestradora pode contrariar princípios arquiteturais registrados.\n" +
      "• Aprendizados relevantes retornam ao Núcleo como atualizações documentais.",
  },
  {
    title: "Coordenação de Módulos, Agentes e Usuários",
    tags: ["ia-orquestradora", "coordenacao", "agentes"],
    content:
      "Coordenação\n\n" +
      "• Módulos (Especialistas) — recebem tarefas específicas dentro da sua competência.\n" +
      "• Agentes de IA — executam ações delegadas, respeitando escopo e políticas.\n" +
      "• Usuários — recebem sugestões, alertas e pedidos de decisão quando necessário.\n\n" +
      "A Orquestradora garante que cada ator atue no papel certo, evitando sobreposição, retrabalho ou conflito.",
  },
  {
    title: "Políticas de Autonomia",
    tags: ["ia-orquestradora", "autonomia", "politicas"],
    content:
      "Políticas de Autonomia\n\n" +
      "• Toda ação autônoma respeita o nível de risco (max_risk) configurado por área.\n" +
      "• Ações de baixo risco podem ser executadas em autopilot quando habilitado.\n" +
      "• Ações de alto risco exigem aprovação explícita do usuário.\n" +
      "• Toda execução autônoma é registrada, auditável e reversível quando possível.\n" +
      "• Em caso de conflito entre autonomia e princípio do Núcleo, o Núcleo prevalece.",
  },
  {
    title: "Interfaces com o Sistema",
    tags: ["ia-orquestradora", "interfaces", "integracoes"],
    content:
      "Interfaces com o Sistema\n\n" +
      "• Consciência — fornece contexto interpretado à Orquestradora.\n" +
      "• Motor de IA — provê capacidades de raciocínio (local ou nuvem).\n" +
      "• Hub Universal de Integrações — canal para acionar serviços externos.\n" +
      "• Core do Sistema — fornece dados canônicos e regras compartilhadas.\n" +
      "• Especialistas — executam ações no domínio de cada módulo.\n" +
      "• Rotina — canal preferencial para materializar tarefas junto ao usuário.",
  },
  {
    title: "Roadmap Inicial",
    tags: ["ia-orquestradora", "roadmap", "evolucao"],
    content:
      "Roadmap Inicial da IA Orquestradora\n\n" +
      "• Fase 1 — Observação: coletar eventos e construir visão unificada de contexto.\n" +
      "• Fase 2 — Interpretação: gerar insights e priorizações a partir do contexto.\n" +
      "• Fase 3 — Coordenação assistida: sugerir ações a usuários e agentes.\n" +
      "• Fase 4 — Coordenação autônoma controlada: executar ações de baixo risco em autopilot.\n" +
      "• Fase 5 — Aprendizado contínuo: retroalimentar Núcleo e políticas com resultados.",
  },
];

const IA_ORQUESTRADORA_ORIENTACAO_FLAG_KEY = "nucleo_ia_orquestradora_orientacao_objetivos_v1";

const IA_ORQUESTRADORA_ORIENTACAO_PAGE: { title: string; content: string; tags: string[] } = {
  title: "Orientação por Objetivos (Nova Diretriz Arquitetural)",
  tags: ["ia-orquestradora", "orientacao-por-objetivos", "especialistas", "diretriz"],
  content:
    "Orientação por Objetivos — Nova Diretriz Arquitetural do Painel Central\n\n" +
    "A partir desta diretriz, o Painel Central deixa de ser orientado por módulos e passa a ser orientado por objetivos.\n\n" +
    "Princípios da nova orientação:\n" +
    "• O ponto de partida do sistema deixa de ser o módulo e passa a ser o objetivo do usuário ou do negócio.\n" +
    "• Cada objetivo define quais especialistas, agentes, dados e fluxos serão mobilizados.\n" +
    "• Os módulos existentes tornam-se especialistas em suas áreas, com competências claras e escopo bem definido.\n" +
    "• A IA Orquestradora (Cérebro Central) coordena todo o ecossistema, distribuindo trabalho entre especialistas, agentes e usuários.\n\n" +
    "Papéis:\n" +
    "• Objetivo — unidade central de organização do trabalho no Painel Central.\n" +
    "• Especialistas (antigos módulos) — executam ações no seu domínio de competência.\n" +
    "• Agentes de IA — apoiam ou automatizam etapas dentro dos objetivos, respeitando políticas de autonomia.\n" +
    "• IA Orquestradora — interpreta o objetivo, seleciona especialistas, coordena a execução e valida o resultado contra o Núcleo.\n" +
    "• Usuário — define objetivos, aprova decisões relevantes e mantém o controle estratégico.\n\n" +
    "Impactos:\n" +
    "• Interfaces, dashboards e rotinas passam a ser organizados por objetivos, não por módulos.\n" +
    "• Especialistas deixam de operar de forma isolada e passam a colaborar sob coordenação da Orquestradora.\n" +
    "• A avaliação de sucesso deixa de ser 'módulo funcionando' e passa a ser 'objetivo alcançado'.\n" +
    "• Toda evolução futura deve considerar primeiro o objetivo a ser atendido e, depois, quais especialistas serão envolvidos.\n\n" +
    "Regra permanente:\n" +
    "Nenhum novo recurso deve ser projetado apenas como 'mais um módulo'. Todo novo recurso deve responder a um objetivo claro e se integrar como especialista sob a coordenação da IA Orquestradora.",
};

const ATLAS_SEED_FLAG_KEY = "nucleo_atlas_seed_v1";

const ATLAS_SEED: Array<{ title: string; content: string; tags: string[] }> = [
  {
    title: "Mapa Geral do Sistema",
    tags: ["atlas", "mapa-geral", "sistema"],
    content:
      "Mapa Geral do Sistema\n\n" +
      "Visão panorâmica de todas as camadas do Painel Central e como elas se conectam.\n\n" +
      "• Camadas principais — \n" +
      "• Módulos e suas fronteiras — \n" +
      "• Fluxos principais de dados e decisões — \n" +
      "• Pontos de integração — \n\n" +
      "Documente aqui em texto, listas, diagramas e imagens. Esta página é a porta de entrada do Atlas.",
  },
  {
    title: "Mapa da Consciência",
    tags: ["atlas", "consciência"],
    content:
      "Mapa da Consciência\n\n" +
      "Estrutura da camada de Consciência: memória, aprendizagem, personalidade, regras e especialistas.\n\n" +
      "• Componentes internos — \n" +
      "• Como cada componente se conecta ao restante da plataforma — \n" +
      "• Entradas, saídas e sinais que a Consciência interpreta — \n" +
      "• Diagramas — \n\n" +
      "Anexe imagens e diagramas conforme evoluir.",
  },
  {
    title: "Mapa do Orquestrador",
    tags: ["atlas", "orquestrador"],
    content:
      "Mapa do Orquestrador\n\n" +
      "Como o Orquestrador coordena agentes, ferramentas, filas e contextos.\n\n" +
      "• Responsabilidades — \n" +
      "• Ciclo de decisão (planejar → executar → avaliar) — \n" +
      "• Filas, retries e estados — \n" +
      "• Integração com Motor de IA, Especialistas e Core — \n\n" +
      "Documente aqui o funcionamento e os diagramas do Orquestrador.",
  },
  {
    title: "Mapa do Motor de IA",
    tags: ["atlas", "motor-ia", "ia"],
    content:
      "Mapa do Motor de IA\n\n" +
      "Estrutura do motor que executa modelos, prompts, contextos e ferramentas.\n\n" +
      "• Provedores e modelos utilizados — \n" +
      "• Pipeline de prompt (contexto → sistema → usuário → ferramentas) — \n" +
      "• Custos, limites e fallback — \n" +
      "• Observabilidade (logs, métricas, auditoria) — \n\n" +
      "Registre aqui os diagramas do motor de IA.",
  },
  {
    title: "Mapa do Core do Sistema",
    tags: ["atlas", "core"],
    content:
      "Mapa do Core do Sistema\n\n" +
      "Núcleo funcional que sustenta todos os módulos: modelos de domínio, regras compartilhadas, serviços base.\n\n" +
      "• Entidades centrais — \n" +
      "• Serviços compartilhados — \n" +
      "• Contratos internos entre módulos — \n" +
      "• Regras invariantes — \n\n" +
      "Documente aqui o coração operacional da plataforma.",
  },
  {
    title: "Mapa do Hub Universal de Integrações",
    tags: ["atlas", "integrações", "hub"],
    content:
      "Mapa do Hub Universal de Integrações\n\n" +
      "Ponto único onde entram e saem todas as integrações externas do Painel Central.\n\n" +
      "• Conectores ativos (WhatsApp, IA, pagamentos, storage, e-mail, etc.) — \n" +
      "• Padrões de contrato (REST, Webhooks, Realtime, MCP) — \n" +
      "• Autenticação e credenciais — \n" +
      "• Estratégias de retry, circuit breaker e observabilidade — \n\n" +
      "Documente aqui cada integração e seu diagrama de fluxo.",
  },
  {
    title: "Mapa dos Especialistas",
    tags: ["atlas", "especialistas", "ia"],
    content:
      "Mapa dos Especialistas\n\n" +
      "Perfis especializados de IA (comercial, financeiro, produção, marketing, etc.) e seus domínios.\n\n" +
      "• Lista de especialistas — \n" +
      "• Domínio, contexto e ferramentas de cada um — \n" +
      "• Como o Orquestrador seleciona o especialista adequado — \n" +
      "• Limites e políticas de decisão — \n\n" +
      "Documente aqui a arquitetura dos especialistas.",
  },
  {
    title: "Mapa do Banco de Dados",
    tags: ["atlas", "banco-de-dados", "schema"],
    content:
      "Mapa do Banco de Dados\n\n" +
      "Modelo lógico e físico do banco de dados: entidades, relacionamentos, políticas e convenções.\n\n" +
      "• Domínios / esquemas — \n" +
      "• Tabelas centrais e suas relações — \n" +
      "• Políticas de acesso (RLS) — \n" +
      "• Convenções (nomes, IDs, timestamps, precisão decimal) — \n\n" +
      "Anexe diagramas ER e descrições evolutivas do schema.",
  },
  {
    title: "Mapa dos Fluxos",
    tags: ["atlas", "fluxos", "processos"],
    content:
      "Mapa dos Fluxos\n\n" +
      "Principais fluxos que atravessam o sistema, do gatilho ao resultado.\n\n" +
      "• Lead → Venda → Produção → Entrega — \n" +
      "• Atendimento → CRM → Financeiro — \n" +
      "• Ideia → Conteúdo → Publicação → Engajamento — \n" +
      "• Rotina → Foco → Execução — \n\n" +
      "Documente cada fluxo com etapas, atores e diagramas.",
  },
  {
    title: "Mapa da Experiência do Usuário (UX)",
    tags: ["atlas", "ux", "experiência"],
    content:
      "Mapa da Experiência do Usuário (UX)\n\n" +
      "Como o usuário percorre a plataforma: jornadas, telas, decisões e pontos críticos de fricção.\n\n" +
      "• Jornadas principais por perfil de usuário — \n" +
      "• Padrões de UI adotados (mobile-first, sticky headers, bottom nav, dialogs responsivos) — \n" +
      "• Momentos de decisão e feedback — \n" +
      "• Oportunidades de melhoria de UX — \n\n" +
      "Anexe wireframes, prints e diagramas de jornada.",
  },
];


const EVOLUCAO_SEED_FLAG_KEY = "nucleo_evolucao_seed_v1";

const EVOLUCAO_SEED: Array<{ title: string; content: string; tags: string[] }> = [
  {
    title: "Roadmap",
    tags: ["roadmap", "planejamento"],
    content:
      "Roadmap do Painel Central\n\n" +
      "Visão de curto, médio e longo prazo do que será construído.\n\n" +
      "• Próximos 30 dias — \n• Próximos 90 dias — \n• Longo prazo — \n\n" +
      "— Atualize conforme o projeto evolui.",
  },
  {
    title: "Melhorias",
    tags: ["melhorias", "backlog"],
    content:
      "Melhorias\n\n" +
      "Lista viva de ajustes e refinamentos em módulos existentes.\n\n" +
      "• Melhoria — módulo — impacto — status\n\n" +
      "— Registre aqui cada melhoria proposta.",
  },
  {
    title: "Ideias",
    tags: ["ideias", "exploração"],
    content:
      "Ideias\n\n" +
      "Espaço aberto para capturar ideias, mesmo que ainda não priorizadas.\n\n" +
      "• Ideia — contexto — potencial\n\n" +
      "— Não filtre: registre primeiro, avalie depois.",
  },
  {
    title: "Decisões Importantes",
    tags: ["decisões", "adr"],
    content:
      "Decisões Importantes\n\n" +
      "Registro de decisões estratégicas e técnicas que moldam o Painel Central.\n\n" +
      "Formato sugerido:\n" +
      "• Data — Decisão — Contexto — Alternativas consideradas — Consequências\n\n" +
      "— Toda decisão relevante deve ser documentada aqui.",
  },
  {
    title: "Histórico de Alterações",
    tags: ["changelog", "histórico"],
    content:
      "Histórico de Alterações\n\n" +
      "Changelog cronológico das mudanças significativas na plataforma.\n\n" +
      "Formato sugerido:\n" +
      "• [AAAA-MM-DD] Módulo — descrição da alteração\n\n" +
      "— Mantenha em ordem cronológica inversa (mais recente no topo).",
  },
];

const ESTADO_ATUAL_SEED_FLAG_KEY = "nucleo_estado_atual_seed_v1";

const ESTADO_ATUAL_TITLES: Array<{ title: string; tags: string[] }> = [
  { title: "Mapa Geral do Sistema", tags: ["mapa", "visão-geral"] },
  { title: "Arquitetura Atual", tags: ["arquitetura", "atual"] },
  { title: "Banco de Dados", tags: ["banco-de-dados"] },
  { title: "Integrações", tags: ["integrações"] },
  { title: "Agentes de IA", tags: ["ia", "agentes"] },
  { title: "Fluxos do Sistema", tags: ["fluxos"] },
  { title: "Funcionalidades Implementadas", tags: ["funcionalidades", "implementadas"] },
  { title: "Funcionalidades Incompletas", tags: ["funcionalidades", "incompletas"] },
  { title: "Pontos Fortes", tags: ["pontos-fortes"] },
  { title: "Pontos de Melhoria", tags: ["melhorias"] },
  { title: "Dívida Técnica", tags: ["dívida-técnica"] },
  { title: "Resumo Executivo", tags: ["resumo", "executivo"] },
];

const ESTADO_ATUAL_INDICADORES_FLAG_KEY = "nucleo_estado_atual_indicadores_v1";

const ESTADO_ATUAL_INDICADORES: Array<{ title: string; content: string; tags: string[] }> = [
  {
    title: "Core do Sistema",
    tags: ["indicador", "core", "estado-atual"],
    content:
      "Core do Sistema — Estado Atual\n\n" +
      "Snapshot do núcleo funcional que sustenta a plataforma.\n\n" +
      "• Entidades centrais em uso — \n" +
      "• Serviços compartilhados ativos — \n" +
      "• Contratos internos entre módulos — \n" +
      "• Cobertura por testes / observabilidade — \n" +
      "• Riscos e limites conhecidos — \n\n" +
      "Atualize periodicamente para refletir o estado real do core.",
  },
  {
    title: "Orquestrador",
    tags: ["indicador", "orquestrador", "estado-atual"],
    content:
      "Orquestrador — Estado Atual\n\n" +
      "Situação do componente que coordena agentes, ferramentas e filas.\n\n" +
      "• Nível de maturidade — (Planejado / Parcial / Ativo / Estável)\n" +
      "• Fluxos orquestrados hoje — \n" +
      "• Filas, retries e políticas em vigor — \n" +
      "• Integrações com Motor de IA, Especialistas e Core — \n" +
      "• Gaps atuais — \n\n" +
      "Registre aqui a evolução do Orquestrador.",
  },
  {
    title: "Motor de IA",
    tags: ["indicador", "motor-ia", "estado-atual"],
    content:
      "Motor de IA — Estado Atual\n\n" +
      "Situação do motor que executa modelos, prompts e ferramentas.\n\n" +
      "• Provedores ativos — \n" +
      "• Modelos em uso (chat, imagem, embeddings, TTS, STT) — \n" +
      "• Custo/limites atuais — \n" +
      "• Observabilidade (logs, métricas) — \n" +
      "• Riscos e dependências — \n\n" +
      "Atualize sempre que houver mudança de provedor ou modelo.",
  },
  {
    title: "IA Local",
    tags: ["indicador", "ia-local", "estado-atual"],
    content:
      "IA Local — Estado Atual\n\n" +
      "Componentes de inteligência que rodam localmente (no navegador ou em ambiente controlado).\n\n" +
      "• Componentes ativos — \n" +
      "• Casos de uso cobertos — \n" +
      "• Limites de hardware/browser — \n" +
      "• Planejamento futuro — \n\n" +
      "Documente aqui o que hoje roda sem depender de nuvem.",
  },
  {
    title: "IA em Nuvem",
    tags: ["indicador", "ia-nuvem", "estado-atual"],
    content:
      "IA em Nuvem — Estado Atual\n\n" +
      "Componentes de inteligência que dependem de provedores externos.\n\n" +
      "• Provedores utilizados — \n" +
      "• Modelos e endpoints ativos — \n" +
      "• Custos observados — \n" +
      "• Contingências (fallback, cache, retry) — \n\n" +
      "Mantenha atualizado o mapa de dependências em nuvem.",
  },
  {
    title: "Hub Universal de Integrações",
    tags: ["indicador", "hub", "integrações", "estado-atual"],
    content:
      "Hub Universal de Integrações — Estado Atual\n\n" +
      "Situação do ponto central de entrada e saída de integrações externas.\n\n" +
      "• Nível de maturidade — \n" +
      "• Conectores unificados hoje — \n" +
      "• Conectores ainda fora do hub — \n" +
      "• Padrões adotados (REST, Webhooks, Realtime, MCP) — \n" +
      "• Observabilidade e retries — \n\n" +
      "Este indicador mostra o quão universal está o hub.",
  },
  {
    title: "Especialistas Existentes",
    tags: ["indicador", "especialistas", "ia", "estado-atual"],
    content:
      "Especialistas Existentes — Estado Atual\n\n" +
      "Lista viva dos perfis especializados de IA implementados.\n\n" +
      "Formato sugerido:\n" +
      "• Nome — Domínio — Ferramentas — Status (Beta / Ativo / Descontinuado)\n\n" +
      "— Especialistas atuais:\n" +
      "  - \n" +
      "  - \n" +
      "  - \n\n" +
      "Atualize sempre que um especialista for criado, alterado ou removido.",
  },
  {
    title: "Integrações Ativas",
    tags: ["indicador", "integrações", "estado-atual"],
    content:
      "Integrações Ativas — Estado Atual\n\n" +
      "Snapshot das integrações externas que estão em produção.\n\n" +
      "Formato sugerido:\n" +
      "• Nome — Tipo (API / Webhook / Realtime / MCP) — Módulos que usam — Status — Última verificação\n\n" +
      "Integrações atuais:\n" +
      "  - \n" +
      "  - \n" +
      "  - \n\n" +
      "Referência rápida para saber com quem o Painel Central conversa hoje.",
  },
  {
    title: "Banco de Dados Atual",
    tags: ["indicador", "banco-de-dados", "estado-atual"],
    content:
      "Banco de Dados Atual — Estado Atual\n\n" +
      "Visão resumida do estado real do banco.\n\n" +
      "• Nº de tabelas no schema public — \n" +
      "• Tabelas com RLS habilitada — \n" +
      "• Tabelas sem políticas (risco) — \n" +
      "• Precisão decimal padrão — numeric(20,10)\n" +
      "• Migrations recentes relevantes — \n" +
      "• Dívidas de schema — \n\n" +
      "Este indicador aponta a saúde estrutural do banco.",
  },
  {
    title: "Saúde da Plataforma",
    tags: ["indicador", "saúde", "estado-atual"],
    content:
      "Saúde da Plataforma — Estado Atual\n\n" +
      "Painel rápido de sinais vitais do sistema.\n\n" +
      "• Build — (verde / amarelo / vermelho)\n" +
      "• Erros de runtime recorrentes — \n" +
      "• Performance percebida (mobile / desktop) — \n" +
      "• Cobertura de testes — \n" +
      "• Uso de credenciais e secrets — \n" +
      "• Incidentes recentes — \n\n" +
      "Atualize com frequência para leitura rápida do estado geral.",
  },
];



const MAPA_GERAL_CONTENT =
  "Mapa Geral do Sistema — Painel Central\n" +
  "Snapshot da estrutura atual da plataforma. Documento descritivo — nenhuma funcionalidade foi alterada.\n\n" +
  "==============================================\n" +
  "1. VISÃO GERAL\n" +
  "==============================================\n" +
  "Painel Central – Cérebro é uma plataforma web (React 18 + Vite + TypeScript + Tailwind + shadcn/ui) que funciona como organograma interativo e hub operacional. Backend em Lovable Cloud (Supabase: Postgres + Auth + Storage + Edge Functions). Estado global via Zustand, dados remotos via TanStack Query e cliente Supabase.\n\n" +
  "==============================================\n" +
  "2. MÓDULOS EXISTENTES\n" +
  "==============================================\n" +
  "• Núcleo — Fonte oficial de conhecimento (Biblioteca, Consciência, Arquitetura, Evolução, Estado Atual).\n" +
  "• Organograma / Node Tree — Árvore hierárquica de nós, múltiplas visualizações (Padrão, Linhas, CEO, Horizontal, Spreadsheet).\n" +
  "• Foco — Fila de execução prioritária com cronômetro (time tracking).\n" +
  "• Planejamento — Drag-and-drop de tarefas sincronizado com Foco.\n" +
  "• Calendário — Hub anual unificando tarefas, pedidos, reuniões, conteúdo digital e datas sazonais.\n" +
  "• Rotina — Blocos de foco, MTs (Métodos de Trabalho), alertas globais e checklists.\n" +
  "• Operações — Pedidos (estoque/produção), OPs, produção semanal, MRP, inventário multi-local, custos.\n" +
  "• Digital — Ideias, variações por plataforma, calendário editorial, mídia, tendências, atendimento.\n" +
  "• Financeiro — Contas, categorias, entradas, pagamentos parciais, faturas, precificação hierárquica (V2), dashboard.\n" +
  "• CRM / Contatos — Funil Kommo, leads, timeline, tags, atividades, tarefas agendadas, inbox de conversas.\n" +
  "• Reuniões — Roteiro estruturado, agenda, action items, sincronização com calendário.\n" +
  "• Assistente (IA CEO) — Chat com contexto amplo, execução de comandos, histórico persistente.\n" +
  "• Planilhas — Editor de planilhas com engine de fórmulas próprio.\n" +
  "• Rotas — Planejamento de entregas, navegação, prova de entrega.\n" +
  "• Minha Área — Dashboard personalizado por usuário ativo.\n" +
  "• Dashboard Panorâmico — KPIs cross-módulo.\n" +
  "• Metas / Oportunidades / Academia — Áreas complementares.\n\n" +
  "==============================================\n" +
  "3. ROTAS (src/App.tsx — React Router)\n" +
  "==============================================\n" +
  "/                     → Index (Organograma principal)\n" +
  "/dashboard            → Dashboard panorâmico\n" +
  "/foco                 → Fila de execução\n" +
  "/planejamento         → Planejamento drag-and-drop\n" +
  "/calendario           → Calendário anual unificado\n" +
  "/rotina               → Rotina e blocos de foco\n" +
  "/operacoes            → Operações (pedidos, produção, estoque)\n" +
  "/digital              → Marketing digital\n" +
  "/planilhas            → Planilhas\n" +
  "/reunioes             → Lista de reuniões\n" +
  "/reunioes/:id         → Detalhe da reunião\n" +
  "/minha-area           → Área pessoal do usuário ativo\n" +
  "/financeiro           → Financeiro\n" +
  "/assistente           → Assistente IA (CEO)\n" +
  "/contatos             → CRM / contatos\n" +
  "/contatos/inbox       → Inbox de conversas\n" +
  "/contatos/tarefas     → Tarefas agendadas do CRM\n" +
  "/rotas                → Rotas de entrega\n" +
  "/academia             → Academia\n" +
  "/metas                → Metas\n" +
  "/oportunidades        → Oportunidades\n" +
  "/nucleo               → Núcleo (base de conhecimento)\n" +
  "/task/:id             → Edição de tarefa\n" +
  "*                     → NotFound\n\n" +
  "==============================================\n" +
  "4. PÁGINAS (src/pages)\n" +
  "==============================================\n" +
  "Index, Dashboard, Foco, Planejamento, Calendario, Rotina, Operacoes, Digital, Planilhas, Reunioes, ReuniaoDetalhe, MinhaArea, Financeiro, Assistente, Contatos, ContatosInbox, TarefasAgendadas, Rotas, Academia, Metas, Oportunidades, Nucleo, TaskEdit, NotFound.\n\n" +
  "==============================================\n" +
  "5. MENUS E NAVEGAÇÃO GLOBAL\n" +
  "==============================================\n" +
  "• GlobalSearchBar — barra de busca superior global.\n" +
  "• GlobalFooterBar — rodapé com toolbar integrada, contadores de tarefas e seletor de modo de visualização.\n" +
  "• Dock flutuante (canto inferior direito): NucleoLauncherButton, ActiveUserPicker, RoutineAlertsToggleButton, AssistantPanel.\n" +
  "• SwipeNavigationWrapper — navegação por gestos (mobile).\n" +
  "• OperationsBottomNav / OperationsTopTabs — navegação interna do módulo Operações.\n" +
  "• Bottom nav mobile e sticky headers com safe-area em todas as páginas.\n\n" +
  "==============================================\n" +
  "6. COMPONENTES PRINCIPAIS (src/components)\n" +
  "==============================================\n" +
  "Raiz:\n" +
  "• NodeTree, NodeBox, NodeEditDialog, MoveNodeDialog, NodeConnectionsOverlay, NodesSpreadsheetView, HorizontalOrgChart, MultiView, CEOLegend.\n" +
  "• TaskBar, TasksDialog, TaskMergeDialog, DayTasksModal, DueDateBanner, DueDatePill, OnHoldBadge, OnHoldDialog.\n" +
  "• PlanningConfirmationDialog, ReplanningBanner, ReplanningModal, ReplanningWizard.\n" +
  "• GlobalSearchBar, GlobalFooterBar, NavLink, SwipeNavigationWrapper, ActiveUserPicker, NucleoLauncherButton.\n" +
  "• MediaUploader, ProductGallery, ProductMovementHistory, BOMEditor, MRPPanel, InventoryMovementDialog.\n" +
  "• SheetList, SheetTabsBar, SpreadsheetEditor, FunnelView, CollaboratorsPanel, ContactHistoryDialog, FollowUpBanner.\n\n" +
  "Assistente (IA):\n" +
  "• AssistantPanel, CEOChat.\n\n" +
  "Automação:\n" +
  "• AutomationRulesPanel.\n\n" +
  "CRM (src/components/crm):\n" +
  "• BulkWhatsAppDispatch, ContactActivitiesPanel, ContactAvatar, ContactCard, ContactChatPanel, ContactOrdersList, ContactTagsManager, ContactTasksPanel, ContactTimeline, FunnelAutomationsPanel, KommoFunnelView, LeadDetailDrawer, LeadImportDialog, LeadOriginPicker, LeadsNeedContactPanel, LostReasonDialog, MergeDuplicatesDialog, NextBestAction, PosVendaPanel, QuickConversationDialog, QuickConversationFAB, WhatsAppAttachments, WhatsAppMessageSelector.\n\n" +
  "Dashboard:\n" +
  "• BottleneckCard, CampaignResults, CommercialDashboard, CompanyStatus, DailyPerformance, DailyPriorities, DailySummary, NextActionsCard, QuickFinance.\n\n" +
  "Digital (src/components/digital):\n" +
  "• AIVariationsGenerator, AllVariationsSpreadsheetView, BatchVariationDialog, CustomFieldsDefinition, CustomFieldsRenderer, DigitalCalendar, DigitalDashboard, DigitalPrioritiesPanel, HierarchicalPlatformSelector, IdeaCard, IdeaEditor, IdeaTypesManager, IdeasSpreadsheetView, InteractionsPanel, KanbanBoard, KnowledgeBasePanel, MediaEditor, MediaFolderSidebar, MediaLibrary, MediaThumbnail, MetricsChart, NextStepHint, PlatformHierarchicalPicker, PlatformReplicaRenderer, PlatformsHealthPanel, PlatformsManager, ProductSelector, QuickActionWizard, ScheduleCalendar, ServicePanel, TrendsPanel, VariationEditor, VariationsSpreadsheetView.\n\n" +
  "Financeiro (src/components/financial):\n" +
  "• AccountsManager, AdvancedPaymentDialog, AvatarCropEditor, CategoriesManager, ContactFormDialog, ContactOrderHistory, ContactsManager, FinancialDashboard, FinancialEntriesList, FinancialEntryForm, InvoiceValidationDialog, InvoicesManager, IssuedInvoiceDetails, MobileFinancialView, PaymentDialog, PricingManager, PricingManagerV2.\n\n" +
  "Foco:\n" +
  "• TasksSpreadsheetView.\n\n" +
  "Operações (src/components/operations):\n" +
  "• ContactAutocomplete, KPICards, LateProductionBadge, LegacyProductionReport, LocationsManager, MRPTab, MultiLocationMovementDialog, OperationsBottomNav, OperationsCalendarTab, OperationsSearchBar, OperationsTopTabs, OrderCard, OrderEditDialog, OrderGridCard, OrderPriorityBadge, OrdersDateFilter, ProcessesManager, ProductCard, ProductCategoriesManager, ProductCostEditor, ProductDeleteDialog, ProductionClosingTab, ProductionLogForm, ProductionOrdersTab, ProductionPlanningView, ProductionTab, ProductionWeekView, ProductivityCharts, ProductsSubFilters.\n\n" +
  "Planejamento:\n" +
  "• SelectionSpreadsheetView.\n\n" +
  "Rotas (src/components/routes):\n" +
  "• AddStopDialog, ContactAddressPicker, DeliveryProofDialog, RouteEditor, SignaturePad, StopSortableItem.\n\n" +
  "Rotina (src/components/routine):\n" +
  "• AddToRoutineButton, AddToRoutineDialog, BlockEditDialog, CustomAlarmsPanel, MTManagerDialog, MTPickerDialog, MTWorkspaceBar, RoutineAlertOverlay, RoutineAlertsToggleButton, RoutineDayView, RoutineMonthView, RoutineWeekView.\n\n" +
  "Sazonais:\n" +
  "• SeasonalBadge, SeasonalDayModal, SeasonalDaysList, SeasonalEventDialog.\n\n" +
  "Verificação de estoque:\n" +
  "• StockCheckAlert, StockCheckWizard.\n\n" +
  "Time reports:\n" +
  "• TimeReportsPanel.\n\n" +
  "Lightbox global:\n" +
  "• LightboxProvider, LightboxRoot, LightboxImage, LightboxVideo (montado no App root).\n\n" +
  "UI base:\n" +
  "• src/components/ui — biblioteca shadcn/ui completa (button, card, dialog, popover, tabs, toast, sonner, etc.).\n\n" +
  "==============================================\n" +
  "7. PROVIDERS GLOBAIS (src/App.tsx)\n" +
  "==============================================\n" +
  "QueryClientProvider → TooltipProvider → UndoRedoProvider → LinesModeProvider → LightboxProvider → Toaster + Sonner + AppContent + LightboxRoot.\n" +
  "Hooks globais no AppContent: useScheduledTaskPromotion, useKeyboardAware.\n\n" +
  "==============================================\n" +
  "8. HOOKS PRINCIPAIS (src/hooks)\n" +
  "==============================================\n" +
  "Dados/CRM: useContacts, useContactsWithOrders, useContactActivities, useContactChecklist, useContactConversations, useContactHistory, useContactNextTasks, useContactTags, useLeadScore, useNoResponseDetection, useAllConversationsSummary.\n" +
  "Operações/Produção: useOrders, useProductionOrders, useProductionLogs, useProductionClosing, useProductsList, useProductCategories, useProductCosts, useBOM, useMRP, useInventoryMovements, useMultiLocationInventory, useStorageLocations, useProcesses.\n" +
  "Financeiro: useFinancial, usePricing, usePricingV2.\n" +
  "Digital: useDigital, useDigitalInteractions, useDigitalTrends, useIdeaActions, useIdeaTypes, useMediaFolders, usePlatformGroups, usePlatforms, usePosts, useProductIdeas, useKnowledgeBase.\n" +
  "Rotina/Foco/Calendário: useRoutine, useRoutineBlocks, useActiveMT, useCalendarService, useSeasonalDays, useScheduledTaskPromotion, useReplanningReminder, useReplanningWizard, useTimeTracking, useOnHold, useTaskMerge.\n" +
  "Sistema: useActiveUser, useNotifications, useSpreadsheet, useSwipeNavigation, useUndoRedo, useKeyboardAware, use-mobile, use-toast, useDailyMetrics, useMeetings, useDeliveryRoutes, useServiceChat, useWhatsAppWithLog, useAICEO.\n\n" +
  "==============================================\n" +
  "9. STATE / STORES (src/stores)\n" +
  "==============================================\n" +
  "• appStore.ts — estado global principal (Zustand).\n" +
  "• selectors.ts — seletores derivados.\n" +
  "• stockCheckStore.ts — estado do assistente de verificação de estoque.\n\n" +
  "==============================================\n" +
  "10. CONTEXTOS (src/contexts)\n" +
  "==============================================\n" +
  "• UndoRedoContext — pilha global de desfazer/refazer.\n" +
  "• LinesModeContext — modo de visualização de linhas do organograma.\n" +
  "• LightboxContext (em components/lightbox) — visualização global de mídia.\n\n" +
  "==============================================\n" +
  "11. BIBLIOTECAS UTILITÁRIAS (src/lib)\n" +
  "==============================================\n" +
  "dateUtils, decimal, formulaEngine, invoiceSync, invoiceValidation, utils, whatsapp, whatsappShare, whatsappTemplates.\n\n" +
  "==============================================\n" +
  "12. BACKEND — LOVABLE CLOUD\n" +
  "==============================================\n" +
  "Cliente: src/integrations/supabase/client.ts (auto-gerado, não editar).\n" +
  "Tipos: src/integrations/supabase/types.ts (auto-gerado).\n\n" +
  "Edge Functions (supabase/functions):\n" +
  "• ai-ceo — Assistente CEO com contexto amplo.\n" +
  "• contact-from-media — Extração de contato a partir de mídia.\n" +
  "• contact-summary — Resumo de contato via IA.\n" +
  "• digital-content-ai — Geração de conteúdo digital.\n" +
  "• digital-trends — Análise de tendências.\n" +
  "• enhance-image / media-enhance — Melhoria de imagem/mídia.\n" +
  "• smart-whatsapp-message — Sugestão inteligente de mensagens WhatsApp.\n\n" +
  "==============================================\n" +
  "13. OBSERVAÇÕES\n" +
  "==============================================\n" +
  "• Timezone obrigatório: America/Sao_Paulo. Parsing sempre com parseISO (date-fns).\n" +
  "• Datas exibidas em DD/MM/YYYY; armazenadas em YYYY-MM-DD.\n" +
  "• Precisão decimal: numeric(20,10) para custos, preços e quantidades.\n" +
  "• Mobile-first: sticky headers com safe-area, bottom nav, ResponsiveDialog fullscreen, framer-motion.\n" +
  "• Todo nó do organograma deve conectar-se ao nó raiz 'Deividi' (ID: d7c76db8-b7e0-4ce1-87ca-21275c346326).\n" +
  "• Documento vivo — atualize conforme o sistema evoluir.";

const MAPA_GERAL_FILL_FLAG = "nucleo_estado_atual_mapa_geral_fill_v1";

const ARQUITETURA_ATUAL_CONTENT =
  "Arquitetura Atual — Painel Central\n" +
  "Snapshot descritivo de como o sistema está organizado hoje. Nenhum código foi alterado.\n\n" +
  "==============================================\n" +
  "1. STACK E ORGANIZAÇÃO GERAL\n" +
  "==============================================\n" +
  "• Frontend: React 18 + Vite 5 + TypeScript 5 + Tailwind CSS v3 + shadcn/ui.\n" +
  "• Estado global: Zustand (src/stores). Dados remotos: TanStack Query.\n" +
  "• Roteamento: React Router (BrowserRouter) com transições via framer-motion (AnimatePresence).\n" +
  "• Backend: Lovable Cloud (Supabase) — Postgres + Auth + Storage + Edge Functions (Deno).\n" +
  "• Cliente Supabase: src/integrations/supabase/client.ts (auto-gerado, imutável).\n" +
  "• Tipos gerados: src/integrations/supabase/types.ts (auto-gerado).\n" +
  "• Design system: tokens semânticos em src/index.css + variantes shadcn em src/components/ui.\n" +
  "• Timezone forçado America/Sao_Paulo, datas parseISO/date-fns ptBR, DD/MM/YYYY na UI.\n\n" +
  "==============================================\n" +
  "2. ESTRUTURA DE PASTAS (raiz)\n" +
  "==============================================\n" +
  ".env, .lovable/, README.md, components.json, eslint.config.js, index.html\n" +
  "package.json, postcss.config.js, tailwind.config.ts, tsconfig*.json, vite.config.ts\n" +
  "public/          → assets estáticos (placeholder.svg, robots.txt)\n" +
  "supabase/        → config.toml + functions/ (edge functions)\n" +
  "src/             → código da aplicação\n\n" +
  "==============================================\n" +
  "3. ESTRUTURA DE PASTAS (src/)\n" +
  "==============================================\n" +
  "src/\n" +
  "├── App.tsx                → Providers globais + rotas + dock flutuante\n" +
  "├── main.tsx               → Bootstrap React\n" +
  "├── App.css / index.css    → Estilos globais e tokens de design\n" +
  "├── vite-env.d.ts\n" +
  "│\n" +
  "├── pages/                 → Uma página por rota (Index, Dashboard, Foco, ...)\n" +
  "├── components/            → Componentes de UI, organizados por domínio\n" +
  "│   ├── ui/                → shadcn/ui base (button, dialog, popover, ...)\n" +
  "│   ├── assistant/         → Assistente CEO (IA)\n" +
  "│   ├── automation/        → Regras de automação\n" +
  "│   ├── crm/               → CRM / contatos / WhatsApp\n" +
  "│   ├── dashboard/         → Widgets do dashboard panorâmico\n" +
  "│   ├── digital/           → Marketing digital / ideias / mídia\n" +
  "│   ├── financial/         → Financeiro (contas, entradas, faturas, pricing)\n" +
  "│   ├── foco/              → Fila de execução\n" +
  "│   ├── lightbox/          → Visualização global de mídia\n" +
  "│   ├── operations/        → Pedidos, produção, estoque, MRP\n" +
  "│   ├── planejamento/      → Planejamento drag-and-drop\n" +
  "│   ├── routes/            → Rotas de entrega\n" +
  "│   ├── routine/           → Rotina, blocos, MTs, alertas\n" +
  "│   ├── seasonal/          → Datas sazonais\n" +
  "│   ├── stock-check/       → Verificação de estoque\n" +
  "│   ├── time-reports/      → Relatórios de tempo\n" +
  "│   └── (raiz)             → Componentes transversais: NodeTree, TaskBar, GlobalSearchBar, ...\n" +
  "│\n" +
  "├── hooks/                 → Hooks de dados e comportamento (useContacts, useOrders, ...)\n" +
  "├── stores/                → Zustand: appStore, selectors, stockCheckStore\n" +
  "├── contexts/              → UndoRedoContext, LinesModeContext\n" +
  "├── lib/                   → Utilitários puros (dateUtils, decimal, formulaEngine, ...)\n" +
  "└── integrations/supabase/ → client.ts + types.ts (auto-gerados)\n\n" +
  "==============================================\n" +
  "4. ORGANIZAÇÃO DOS MÓDULOS\n" +
  "==============================================\n" +
  "Cada módulo funcional segue o mesmo padrão em 3 camadas:\n\n" +
  "  1) Página em src/pages/<Modulo>.tsx  → orquestra layout + estado local + rotas internas.\n" +
  "  2) Componentes em src/components/<modulo>/  → UI específica (dialogs, cards, painéis, editors, spreadsheets).\n" +
  "  3) Hooks em src/hooks/use<Modulo>*.ts  → acesso a dados (Supabase + React Query) e regras de negócio.\n\n" +
  "Módulos mapeados hoje:\n" +
  "• Núcleo               → pages/Nucleo.tsx (estrutura de conhecimento, sem pasta de componentes própria).\n" +
  "• Organograma          → components/NodeTree, NodeBox, NodesSpreadsheetView, HorizontalOrgChart, MultiView.\n" +
  "• Foco                 → pages/Foco.tsx + components/foco/ + hooks/useTimeTracking, useOnHold, useTaskMerge.\n" +
  "• Planejamento         → pages/Planejamento.tsx + components/planejamento/.\n" +
  "• Calendário           → pages/Calendario.tsx + hooks/useCalendarService, useSeasonalDays.\n" +
  "• Rotina               → pages/Rotina.tsx + components/routine/ + hooks/useRoutine, useRoutineBlocks, useActiveMT.\n" +
  "• Operações            → pages/Operacoes.tsx + components/operations/ + hooks/useOrders, useProductionOrders, useMRP, useMultiLocationInventory.\n" +
  "• Digital              → pages/Digital.tsx + components/digital/ + hooks/useDigital*, useIdea*, usePlatform*, useMediaFolders.\n" +
  "• Financeiro           → pages/Financeiro.tsx + components/financial/ + hooks/useFinancial, usePricing, usePricingV2.\n" +
  "• CRM / Contatos       → pages/Contatos*.tsx, TarefasAgendadas.tsx + components/crm/ + hooks/useContact*, useLeadScore, useNoResponseDetection.\n" +
  "• Reuniões             → pages/Reunioes.tsx, ReuniaoDetalhe.tsx + hooks/useMeetings.\n" +
  "• Assistente (IA)      → pages/Assistente.tsx + components/assistant/ + hooks/useAICEO + edge function ai-ceo.\n" +
  "• Planilhas            → pages/Planilhas.tsx + components/SpreadsheetEditor, SheetList, SheetTabsBar + hooks/useSpreadsheet + lib/formulaEngine.\n" +
  "• Rotas de entrega     → pages/Rotas.tsx + components/routes/ + hooks/useDeliveryRoutes.\n" +
  "• Minha Área           → pages/MinhaArea.tsx + hooks/useActiveUser.\n" +
  "• Dashboard            → pages/Dashboard.tsx + components/dashboard/ + hooks/useDailyMetrics.\n" +
  "• Metas / Oportunidades / Academia → páginas independentes complementares.\n\n" +
  "==============================================\n" +
  "5. CAMADA DE APRESENTAÇÃO (App.tsx)\n" +
  "==============================================\n" +
  "Cadeia de providers, de fora para dentro:\n" +
  "  QueryClientProvider\n" +
  "  └── TooltipProvider\n" +
  "      └── UndoRedoProvider\n" +
  "          └── LinesModeProvider\n" +
  "              └── LightboxProvider\n" +
  "                  ├── Toaster + Sonner (notificações globais)\n" +
  "                  ├── AppContent\n" +
  "                  │   ├── Dock flutuante (Núcleo, ActiveUser, Alertas, Assistente)\n" +
  "                  │   ├── GlobalSearchBar (topo)\n" +
  "                  │   ├── SwipeNavigationWrapper → AnimatedRoutes\n" +
  "                  │   ├── GlobalFooterBar (rodapé com toolbar)\n" +
  "                  │   ├── QuickConversationFAB (CRM)\n" +
  "                  │   ├── StockCheckAlert + StockCheckWizard\n" +
  "                  │   └── RoutineAlertOverlay\n" +
  "                  └── LightboxRoot\n\n" +
  "Hooks globais montados em AppContent: useScheduledTaskPromotion, useKeyboardAware.\n\n" +
  "==============================================\n" +
  "6. COMPONENTES PRINCIPAIS (transversais)\n" +
  "==============================================\n" +
  "• Navegação: GlobalSearchBar, GlobalFooterBar, NavLink, SwipeNavigationWrapper, ActiveUserPicker, NucleoLauncherButton.\n" +
  "• Organograma: NodeTree, NodeBox, NodeEditDialog, MoveNodeDialog, NodeConnectionsOverlay, HorizontalOrgChart, MultiView, CEOLegend, NodesSpreadsheetView.\n" +
  "• Tarefas: TaskBar, TasksDialog, TaskMergeDialog, DayTasksModal, DueDateBanner, DueDatePill, OnHoldBadge, OnHoldDialog.\n" +
  "• Replanejamento: PlanningConfirmationDialog, ReplanningBanner, ReplanningModal, ReplanningWizard.\n" +
  "• Mídia global: LightboxProvider, LightboxRoot, LightboxImage, LightboxVideo, MediaUploader, ProductGallery.\n" +
  "• Assistente IA: AssistantPanel, CEOChat.\n" +
  "• Estoque/Produção: BOMEditor, MRPPanel, InventoryMovementDialog, ProductMovementHistory.\n" +
  "• CRM: FunnelView, KommoFunnelView, LeadDetailDrawer, ContactCard, ContactTimeline, QuickConversationFAB, BulkWhatsAppDispatch.\n" +
  "• Financeiro: FinancialDashboard, FinancialEntriesList, FinancialEntryForm, PricingManagerV2, InvoicesManager.\n" +
  "• Rotina: RoutineAlertOverlay, MTWorkspaceBar, RoutineDay/Week/MonthView, CustomAlarmsPanel.\n" +
  "• Verificação de estoque: StockCheckAlert, StockCheckWizard.\n" +
  "• UI base: src/components/ui — todos os primitivos shadcn.\n\n" +
  "==============================================\n" +
  "7. CAMADA DE DADOS\n" +
  "==============================================\n" +
  "• Todo acesso ao backend passa por hooks em src/hooks/, que usam o cliente Supabase importado de @/integrations/supabase/client.\n" +
  "• React Query gerencia cache, invalidação e sincronização otimista.\n" +
  "• RLS (Row Level Security) obrigatório em todas as tabelas públicas + GRANTs explícitos.\n" +
  "• Roles armazenados em tabela separada (user_roles) com função SECURITY DEFINER has_role.\n" +
  "• Precisão decimal: numeric(20,10) para custos, preços e quantidades — nunca arredondar antes de exibir.\n" +
  "• Datas: armazenadas YYYY-MM-DD, sempre lidas com parseISO (nunca new Date()).\n\n" +
  "==============================================\n" +
  "8. EDGE FUNCTIONS (supabase/functions)\n" +
  "==============================================\n" +
  "• ai-ceo                 → Assistente CEO com contexto amplo.\n" +
  "• contact-from-media     → Extração de contato a partir de mídia.\n" +
  "• contact-summary        → Resumo de contato via IA.\n" +
  "• digital-content-ai     → Geração de conteúdo digital.\n" +
  "• digital-trends         → Análise de tendências.\n" +
  "• enhance-image          → Melhoria de imagem.\n" +
  "• media-enhance          → Melhoria genérica de mídia.\n" +
  "• smart-whatsapp-message → Sugestão inteligente de mensagens WhatsApp.\n\n" +
  "==============================================\n" +
  "9. PADRÕES ARQUITETURAIS EM VIGOR\n" +
  "==============================================\n" +
  "• Mobile-first: sticky headers com safe-area, bottom nav, ResponsiveDialog fullscreen no mobile, framer-motion para transições.\n" +
  "• Lazy-loading e divisão de componentes para módulos pesados (ver memory: module-lazy-loading-architecture).\n" +
  "• Spreadsheet implementado com HTML/Tailwind custom (react-data-grid é proibido).\n" +
  "• LightboxProvider único no App root (nunca local) para evitar conflitos de contexto.\n" +
  "• Download de mídia via fetch-to-blob; substituição atualiza registro existente (preserva links).\n" +
  "• Nós do organograma sempre conectados ao root 'Deividi' (ID d7c76db8-b7e0-4ce1-87ca-21275c346326); evitar ciclos em parent_id.\n" +
  "• Autonomia do usuário: campos, categorias, canais e plataformas são dinâmicos — nada hardcoded rígido.\n" +
  "• Segurança: nunca guardar roles no profile; nunca validar admin via localStorage/hardcoded.\n\n" +
  "==============================================\n" +
  "10. FLUXO DE UMA REQUISIÇÃO TÍPICA\n" +
  "==============================================\n" +
  "Usuário → Página (src/pages) → Componentes (src/components/<modulo>) → Hook (src/hooks/use*) →\n" +
  "Cliente Supabase (@/integrations/supabase/client) → Postgres/Edge Function → resposta cacheada por React Query →\n" +
  "UI re-renderiza com transições framer-motion.\n\n" +
  "Documento vivo — atualize conforme a arquitetura evoluir.";

const ARQUITETURA_ATUAL_FILL_FLAG = "nucleo_estado_atual_arquitetura_atual_fill_v1";

const AGENTES_IA_CONTENT =
  "Agentes de IA — Estado Atual\n" +
  "=========================================\n\n" +
  "Inventário dos agentes de IA operando hoje no Painel Central. Todos rodam em Edge Functions Deno (supabase/functions/*), consomem o Lovable AI Gateway (https://ai.gateway.lovable.dev/v1/chat/completions) e usam o modelo padrão google/gemini-2.5-flash (variações indicadas). Documento descritivo — não altera comportamento.\n\n" +
  "1. CEO IA (ai-ceo)\n" +
  "-----------------------------------------\n" +
  "• Responsabilidade: assistente executivo com autonomia operacional. Analisa contexto global do painel, gera decisões/insights e executa CRUD em múltiplas entidades sob governança (ai_policies).\n" +
  "• Fluxo: recebe request do frontend (chat ou geração de insights) → carrega contexto amplo via SUPABASE_SERVICE_ROLE_KEY (tarefas, contatos, financeiro, produção, digital) → monta systemPrompt executivo → chama Gemini 2.5 Flash → parseia decisões/ações e executa CRUD → registra em ai_chat_messages, ai_insights, ai_insight_messages e ai_actions.\n" +
  "• Ferramentas/Ações suportadas: task_create/update/delete, node_create/update/delete, order_*, financial_create/update/delete/pay, contact_*, product_*, routine_*, post_*, notification.\n" +
  "• Governança: políticas em ai_policies (max_risk, escopos) — respeita autopilot definido pelo usuário.\n" +
  "• Modelo: google/gemini-2.5-flash.\n" +
  "• Limitações atuais: não faz streaming (resposta unitária); autonomia depende de max_risk configurado; não valida efeitos colaterais de negócio (ex.: impacto financeiro real de uma exclusão); histórico armazenado sem sumarização automática — contexto pode ficar caro em conversas longas.\n\n" +
  "2. Extrator de Contatos por Mídia (contact-from-media)\n" +
  "-----------------------------------------\n" +
  "• Responsabilidade: extrair dados de contato (CRM) a partir de imagem/vídeo — cartão de visita, print de WhatsApp, perfil social, identidade, etc.\n" +
  "• Fluxo: recebe { mediaUrl, mimeType } → monta prompt multimodal (image_url ou video_url) → chama Gemini 2.5 Flash com tool calling estruturado → retorna JSON com campos identificados (nome, telefone, whatsapp, email, empresa, person_type, notes).\n" +
  "• Ferramentas: tool call schema para normalizar saída (telefones BR só dígitos, WhatsApp com DDI 55, pessoa física vs jurídica).\n" +
  "• Modelo: google/gemini-2.5-flash (multimodal).\n" +
  "• Limitações atuais: qualidade da extração depende da nitidez/idioma da mídia; não valida existência prévia do contato (deduplicação fica no frontend); vídeos longos podem exceder janela de contexto; não persiste o contato — apenas devolve o payload.\n\n" +
  "3. Resumo/Briefing de Contato (contact-summary)\n" +
  "-----------------------------------------\n" +
  "• Responsabilidade: gerar briefing consolidado de um contato para uso comercial/atendimento.\n" +
  "• Fluxo: recebe { contact_id } → busca contato, histórico (contact_history), pedidos e conversas via service role → monta systemPrompt de analista comercial → chama Gemini 2.5 Flash → devolve resumo em texto/markdown.\n" +
  "• Ferramentas: apenas leitura direta no banco (sem tool calling).\n" +
  "• Modelo: google/gemini-2.5-flash.\n" +
  "• Limitações atuais: verify_jwt = false (chamada pública, controle apenas por RLS de leitura da service role); resumo não é armazenado — reprocessado a cada chamada; não cita fontes/eventos específicos com IDs.\n\n" +
  "4. IA de Mensagens WhatsApp (smart-whatsapp-message)\n" +
  "-----------------------------------------\n" +
  "• Responsabilidade: gerar mensagem personalizada de WhatsApp com tom humanizado brasileiro, adaptada ao estágio do funil e histórico do cliente.\n" +
  "• Fluxo: recebe contexto do contato (funnel_status, LTV, último contato, produtos, motivo do envio) → monta systemPrompt de especialista em vendas por WhatsApp → chama Gemini 2.5 Flash → retorna texto pronto para revisão antes do envio.\n" +
  "• Ferramentas: nenhuma — geração pura de texto (envio é via deep link wa.me / api.whatsapp.com no frontend).\n" +
  "• Modelo: google/gemini-2.5-flash.\n" +
  "• Limitações atuais: não envia — apenas sugere; sem A/B testing embutido; não conhece o histórico literal de mensagens já trocadas na conversa (apenas metadados do CRM).\n\n" +
  "5. Especialista em Conteúdo Digital (digital-content-ai)\n" +
  "-----------------------------------------\n" +
  "• Responsabilidade: equipe de especialistas de marketing digital — gera objetivos, público-alvo, mensagens-chave, KPIs, descrições, captions, CTAs, hashtags, checklists, estruturas de plataforma e adaptação de variações por canal (Instagram, TikTok, Shopee, Mercado Livre, etc.).\n" +
  "• Fluxo: recebe { field, platform, ideaContext, variations, mediaUrls } → seleciona prompt correspondente (buildSingleFieldPrompt, buildVariationsPrompt ou engenharia reversa de UI via prints) → chama Gemini 2.5 Flash (texto ou multimodal) → devolve conteúdo pronto para preencher digital_ideas / digital_variations.\n" +
  "• Ferramentas: prompts especializados por tipo de campo + análise multimodal de screenshots para reconstruir estruturas de plataforma.\n" +
  "• Modelo: google/gemini-2.5-flash.\n" +
  "• Limitações atuais: qualidade cai em nichos muito específicos sem contexto de marca; não valida políticas específicas de cada plataforma (limites de caracteres, termos proibidos); reconstrução de UI via prints depende da qualidade das imagens.\n\n" +
  "6. Radar de Tendências Digitais (digital-trends)\n" +
  "-----------------------------------------\n" +
  "• Responsabilidade: identificar tendências de marketing digital por nicho e sugerir ganchos criativos, além de gerar respostas de atendimento e sugestões de FAQ.\n" +
  "• Fluxo: recebe { query, niche, type } → escolhe prompt (trends | reply | faq) → chama Gemini 2.5 Flash pedindo saída JSON estruturada (trends[], reply, faq[]) → retorna ao frontend.\n" +
  "• Ferramentas: prompt-engineering para saída JSON (sem tool calling formal).\n" +
  "• Modelo: google/gemini-2.5-flash.\n" +
  "• Limitações atuais: sem acesso a fontes externas em tempo real (dados baseados no conhecimento do modelo, que tem cutoff); JSON pode falhar em prompts complexos — parsing precisa ser defensivo.\n\n" +
  "7. Enhancer de Foto de Perfil (enhance-image)\n" +
  "-----------------------------------------\n" +
  "• Responsabilidade: melhorar nitidez/resolução de fotos de perfil preservando 100% da identidade (mesmo rosto, expressão, roupa, fundo).\n" +
  "• Fluxo: recebe { imageUrl } → prompt fixo instruindo preservação de identidade → chama modelo de geração/edição de imagem via Gateway → retorna imagem melhorada.\n" +
  "• Ferramentas: geração de imagem (modality image).\n" +
  "• Modelo: modelo de imagem do Gateway (fallback interno via callModel).\n" +
  "• Limitações atuais: risco de leve deriva da identidade em rostos difíceis; sem controle explícito de resolução final; não faz upscale ilimitado.\n\n" +
  "8. Enhancer de Mídia Digital (media-enhance)\n" +
  "-----------------------------------------\n" +
  "• Responsabilidade: reprocessar mídias do módulo Digital (fotos de produto, capas, imagens de post) para uso publicitário/comercial.\n" +
  "• Fluxo: recebe imagem + instrução → chama google/gemini-2.5-flash-image → devolve nova mídia.\n" +
  "• Ferramentas: geração/edição de imagem multimodal.\n" +
  "• Modelo: google/gemini-2.5-flash-image.\n" +
  "• Limitações atuais: pode alterar detalhes visuais do produto se a instrução não for específica; não versiona automaticamente a mídia original (a substituição/preservação é regra do frontend — memória media-download-and-replace-pattern).\n\n" +
  "9. Padrões e Restrições Globais dos Agentes\n" +
  "-----------------------------------------\n" +
  "• Todas as chamadas passam obrigatoriamente pelo Lovable AI Gateway com header Authorization: Bearer ${LOVABLE_API_KEY} — chave nunca exposta ao browser.\n" +
  "• Nenhuma função exige segredo de provider externo além de LOVABLE_API_KEY + chaves Supabase padrão.\n" +
  "• Erros 429 (rate limit) e 402 (créditos esgotados) devem ser tratados no frontend com mensagem clara ao usuário.\n" +
  "• Nenhum agente ainda usa streaming (todas as respostas são unitárias/JSON).\n" +
  "• Persistência de histórico/insights fica em ai_chat_messages, ai_insights, ai_insight_messages, ai_actions, ai_policies e service_ai_logs — memória chat-history-persistence-v21.\n" +
  "• Governança: antes de novo agente ou nova capacidade, consultar o Princípio Mestre do Núcleo e ai_policies para checar alinhamento estratégico e limites de risco.\n\n" +
  "10. Limitações Gerais Conhecidas\n" +
  "-----------------------------------------\n" +
  "• Sem streaming de tokens — respostas curtas parecem instantâneas, longas parecem travar.\n" +
  "• Sem observabilidade centralizada de custo por agente (só métricas do Gateway).\n" +
  "• Sem testes automatizados de regressão dos prompts.\n" +
  "• Sem cache semântico — perguntas repetidas geram novas chamadas pagas.\n" +
  "• Contexto de conversas longas cresce linearmente (não há sumarização automática).\n\n" +
  "Documento vivo — atualize sempre que um agente for adicionado, aposentado ou tiver responsabilidades/modelo alterados.";

const AGENTES_IA_FILL_FLAG = "nucleo_estado_atual_agentes_ia_fill_v1";

const FLUXOS_SISTEMA_CONTENT = `# Fluxos do Sistema — Estado Atual

Documentação dos principais fluxos operacionais do Painel Central. Cada fluxo descreve o caminho real percorrido pelo usuário e pelos dados, incluindo páginas envolvidas, tabelas afetadas e integrações acionadas. Nenhum fluxo foi alterado — este é apenas um mapa do comportamento atual.

---

## 1. Login e Autenticação

**Rota:** \`/auth\` (público) → redireciona para \`/\` após sessão válida.

**Passos:**
1. Usuário acessa \`/auth\` (\`src/pages/Auth.tsx\`).
2. Informa e-mail e senha; front chama \`supabase.auth.signInWithPassword\` (client em \`src/integrations/supabase/client.ts\`).
3. Supabase Auth valida credenciais e devolve sessão JWT (armazenada em localStorage pelo SDK).
4. \`AuthProvider\` (\`src/contexts/AuthContext.tsx\`) escuta \`onAuthStateChange\` e propaga \`user\` / \`session\` para o app.
5. \`ProtectedRoute\` libera as rotas internas; sem sessão, redireciona novamente para \`/auth\`.
6. Papéis são resolvidos via \`user_roles\` + função \`has_role(uid, role)\` (SECURITY DEFINER).
7. Perfil operacional é lido de \`app_users\` para nome, avatar e permissões de módulo.

**Observações:** não há sign-up anônimo, não há confirmação automática de e-mail, e o Google provider só é ativo se configurado explicitamente.

---

## 2. Financeiro (Contas a Pagar / Receber / Conciliação)

**Rota:** \`/financeiro\` (\`src/pages/Financeiro.tsx\` + subcomponentes em \`src/components/financial/\`).

**Fluxo típico de lançamento:**
1. Usuário abre o Financeiro e escolhe o período (Popover de calendário duplo, fuso America/Sao_Paulo).
2. Cria entrada em \`financial_entries\` (tipo: a_pagar / a_receber, categoria, contato, vencimento, valor com \`numeric(20,10)\`).
3. Se recorrente, sistema aplica regra de recorrência configurável e gera parcelas futuras.
4. Pagamentos parciais são registrados em tabela dedicada, mantendo desconto/juros e recalculando saldo.
5. KPIs (a vencer, vencidos, recebidos, pagos, DRE do período) são calculados no cliente sobre o dataset filtrado.
6. Entradas ligadas a pedidos são criadas automaticamente pelo módulo Operações (ver fluxo Vendas).

**Integrações:** apenas banco (Lovable Cloud). Nenhum gateway de pagamento ativo.

---

## 3. CRM (Lead → Cliente → Recorrência)

**Rota:** \`/crm\` (\`src/pages/CRM.tsx\` + \`src/components/crm/\`).

**Fluxo de atendimento:**
1. Lead entra manualmente ou via Atendimento (\`/atendimento\`), gravado em \`contacts\` + \`crm_leads\`.
2. Origem multi-canal é armazenada como JSONB ordenado (jornada de aquisição).
3. Sistema calcula **Lead Score** (4 níveis) e **prioridade** (3 tiers visuais) automaticamente.
4. Ordenação por urgência: pontuação + tempo sem resposta + agendamentos vencidos.
5. Timeline (\`crm_timeline\`) registra cada interação (mensagem, ligação, reunião, mudança de etapa) — editável e auditável.
6. Follow-ups automáticos sugerem templates 1-clique conforme inatividade.
7. Envio de WhatsApp usa deep links (\`api.whatsapp.com\` / \`wa.me\`) via \`useWhatsAppWithLog\`, que grava evento na timeline.
8. Conversão em pedido dispara fluxo bidirecional (dados do lead preenchem a venda; venda atualiza health do cliente).
9. Dashboard e listas atualizam via eventos otimistas (padrão descrito em \`crm-optimistic-sync-pattern\`).

**IA envolvida:** \`smart-whatsapp-message\` (sugestão personalizada), \`contact-summary\`, \`contact-from-media\`.

---

## 4. Atendimento Multiplataforma

**Rota:** \`/atendimento\`.

**Fluxo:**
1. Conversas ficam em \`service_conversations\` + \`service_messages\`, agrupadas por contato e plataforma.
2. Novo contato dispara \`auto_create_service_conversation\` (trigger PL/pgSQL).
3. IA classifica intenção e sugere próxima ação; agente humano confirma ou edita.
4. Toda troca é espelhada na timeline do CRM (sincronização descrita em \`atendimento-sync\`).
5. Envio efetivo ocorre via WhatsApp deep link (não há API oficial conectada ainda).

---

## 5. Estoque (Inventário Unificado)

**Rota:** \`/estoque\` / \`/operacoes\` (componentes em \`src/components/inventory/\` e \`src/components/operations/\`).

**Fluxo:**
1. Cada movimento é atômico e vinculado a um local (\`inventory_locations\`) em \`inventory_movements\`.
2. Tipos: entrada (compra/produção), saída (venda/consumo), ajuste (wizard em 4 passos), transferência entre locais.
3. Saldo por SKU/local é derivado da soma dos movimentos (nunca sobrescrito).
4. KPI global de valor de estoque calcula em tempo real usando \`numeric(20,10)\` (sem arredondamento prematuro).
5. Produção consome insumos do local configurado na OP e devolve produto acabado ao local de destino.
6. Vendas geram baixa automática ao confirmar expedição (fluxo Vendas).

---

## 6. Compras (Aquisição de Insumos)

**Fluxo atual (embutido em Operações/Financeiro):**
1. Necessidade identificada manualmente ou por produção planejada.
2. Registro do pedido de compra como entrada futura de estoque + lançamento em \`financial_entries\` (a_pagar).
3. Recebimento gera movimento de entrada em \`inventory_movements\` no local escolhido.
4. Baixa financeira ocorre no pagamento (parcial ou total) via módulo Financeiro.

**Observação:** não existe módulo "Compras" isolado — o processo é composto por Operações + Estoque + Financeiro.

---

## 7. Vendas / Pedidos

**Rota:** \`/operacoes\` (aba Pedidos) — componentes em \`src/components/operations/\`.

**Fluxo:**
1. Pedido criado a partir do CRM ou diretamente na tela de Pedidos (\`orders\` + \`order_items\`).
2. Tipo do pedido define o caminho:
   - **Estoque:** reserva imediata → separação → expedição → entrega.
   - **Produção:** gera Ordem de Produção (\`production_orders\`), consome insumos, finaliza estoque, depois expede.
3. Prioridade é calculada automaticamente em 5 níveis (data de entrega, tipo, cliente).
4. Ajustes de venda (desconto, frete) são persistidos dinamicamente nas notas do pedido.
5. Confirmação da venda cria automaticamente a entrada "A Receber" no Financeiro.
6. Ao mudar de etapa, dispara \`apply_funnel_automations\` e sincroniza health do cliente no CRM.
7. Entrega segue para o módulo Rotas quando aplicável.

---

## 8. Produção (Ordens de Produção)

**Rota:** \`/producao\` / dentro de Operações.

**Fluxo:**
1. OP criada a partir de pedido (produção) ou reposição de estoque.
2. Custo do produto usa modelo de 3 camadas: BOM + processos + logística opcional.
3. Kanban semanal permite drag-and-drop para reagendar OPs.
4. Ao iniciar, consome insumos do local configurado (\`inventory_movements\` saída).
5. Ao finalizar, gera entrada de produto acabado no local de destino.
6. Alertas visuais pulsantes indicam OPs atrasadas (\`due_date\` vencido).

---

## 9. Rotas / Entregas

**Rota:** \`/rotas\`.

**Fluxo:**
1. Pedidos prontos para expedir entram no planejador de rotas.
2. Sistema organiza paradas por proximidade e prioridade.
3. Motorista navega pelo app; comprovante de entrega é anexado no bucket \`delivery-proof\`.
4. Confirmação atualiza status do pedido e dispara baixa final se necessário.

---

## 10. Agenda / Calendário Unificado

**Rota:** \`/calendario\` / \`/agenda\`.

**Fluxo:**
1. Hub anual consolida tarefas, pedidos (entregas), reuniões, conteúdos digitais e dias sazonais.
2. Sincronização em 3 camadas para o Digital (planejado, agendado, publicado).
3. Dias sazonais recorrentes exibem preparo e urgência visual.
4. Reuniões geram roteiro estruturado, pauta e itens de ação (fluxo Reuniões).
5. Eventos alimentam a "Minha Área" filtrando por usuário ativo.

---

## 11. Digital (Marketing / Conteúdo)

**Rota:** \`/digital\`.

**Fluxo:**
1. "Ideia" estratégica é o núcleo; cada plataforma vira uma variação conectada (JSONB de campos custom).
2. Vincular uma ideia a um SKU preenche automaticamente título e mídias (padrão \`product-link-auto-fill\`).
3. Kanban de cards visuais permite ações diretas (agendar, publicar, duplicar, gerar variação com IA).
4. Agendamento multi-datas por variação; status derivado no filtro (\`platform-specific-status-logic\`).
5. IA (\`digital-content-ai\`, \`digital-trends\`, \`enhance-image\`) gera copies, tendências e melhora imagens.
6. Automações orientadas a objetivo conectam Digital ao CRM (leads gerados por campanha).

---

## 12. Rotina / Foco / Planejamento

**Rotas:** \`/rotina\`, \`/foco\`, \`/planejamento\`.

**Fluxo:**
1. **Planejamento:** drag-and-drop organiza tarefas do dia; sincroniza fila via localStorage.
2. **Foco:** consome a fila; iniciar tarefa cria \`time_entries.started_at\`; encerrar fecha o intervalo.
3. **Rotina:** Métodos de Trabalho (MT) por área, alertas globais interativos, snooze, checklists.
4. Multi-usuário: cada operador vê apenas seus alertas e rotinas (isolamento por sessão).
5. Hub central de execução integra tarefas de todos os módulos.

---

## 13. Reuniões

**Rota:** \`/reunioes\`.

**Fluxo:**
1. Criação com roteiro estruturado e pauta.
2. Durante a reunião, itens de ação são registrados e viram tarefas.
3. Sincronização com o calendário e com a "Minha Área" do participante.

---

## 14. IA (CEO IA e assistentes)

**Rota:** \`/assistente\` (e widgets embutidos em vários módulos).

**Fluxo:**
1. Usuário envia mensagem; front chama edge function \`ai-ceo\` (\`supabase/functions/ai-ceo/\`).
2. Edge function consulta o Lovable AI Gateway (\`google/gemini-2.5-flash\`) com contexto amplo.
3. Ações executáveis são gravadas em \`ai_actions\` e podem rodar em autopilot conforme \`ai_policies.max_risk\`.
4. Histórico persiste em \`ai_chat_sessions\` + \`ai_chat_messages\`; insights em \`ai_insights\`.
5. Outras edges (\`smart-whatsapp-message\`, \`contact-summary\`, etc.) seguem o mesmo padrão de gateway.

---

## 15. Núcleo (Documentação Estratégica)

**Rota:** \`/nucleo\`.

**Fluxo:**
1. Repositório oficial de conhecimento (princípios, arquitetura, estado atual, roadmap).
2. Consultado antes de qualquer novo módulo, agente ou automação.
3. Estritamente estratégico — não interfere na operação.

---

## Observações Gerais

- Todos os fluxos usam o cliente único do backend em \`src/integrations/supabase/client.ts\`.
- Datas seguem SEMPRE America/Sao_Paulo e são parseadas com \`parseISO\`; exibição em DD/MM/YYYY.
- Precisão decimal global \`numeric(20,10)\` em custos, preços e quantidades.
- RLS habilitada em todas as tabelas públicas relevantes; papéis via \`has_role\`.
- Nenhum fluxo foi alterado nesta documentação.
`;

const FLUXOS_SISTEMA_FILL_FLAG = "nucleo_estado_atual_fluxos_sistema_fill_v1";

const INTEGRACOES_CONTENT =
  "Integrações — Estado Atual\n" +
  "=========================================\n\n" +
  "Inventário das integrações existentes no Painel Central. Documento descritivo — não altera nem configura nenhuma integração.\n\n" +
  "1. Backend Principal — Lovable Cloud (Supabase)\n" +
  "-----------------------------------------\n" +
  "• Cliente único: src/integrations/supabase/client.ts (auto-gerado, não editar).\n" +
  "• Data API (PostgREST): CRUD em todas as tabelas do schema public com RLS.\n" +
  "• Realtime: canais postgres_changes em tasks, contacts, service_conversations, service_messages, digital_knowledge_base, financial_entries, entre outras.\n" +
  "• Storage: buckets públicos 'media', 'contact-avatars', 'delivery-proof'.\n" +
  "• Edge Functions (Deno) — todas em supabase/functions/, deploy gerenciado pelo Lovable Cloud.\n" +
  "• Segredos disponíveis no runtime: LOVABLE_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_PUBLISHABLE_KEY(S), SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL, SUPABASE_JWKS, SUPABASE_SECRET_KEYS.\n\n" +
  "2. Autenticação\n" +
  "-----------------------------------------\n" +
  "• Provider: Supabase Auth (via Lovable Cloud).\n" +
  "• Identidade de colaborador operacional consolidada em public.app_users; nunca vincular FKs diretas para auth.users.\n" +
  "• Papéis/roles: devem viver em tabela separada (padrão user_roles + has_role) — não usar profiles/contacts.\n" +
  "• Frontend: sessão obtida via supabase.auth (import.meta.env.VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).\n" +
  "• Timezone padrão de exibição: America/Sao_Paulo.\n\n" +
  "3. Inteligência Artificial — Lovable AI Gateway\n" +
  "-----------------------------------------\n" +
  "• Endpoint único: https://ai.gateway.lovable.dev/v1/chat/completions.\n" +
  "• Header: Authorization: Bearer ${LOVABLE_API_KEY} (server-side, nunca exposto ao browser).\n" +
  "• Modelo padrão do projeto: google/gemini-2.5-flash (com variações em algumas funções).\n" +
  "• Edge Functions que chamam a IA:\n" +
  "  – ai-ceo — Assistente executivo (CEO IA); processa contexto amplo do painel, gera insights, dispara ações e sugestões.\n" +
  "  – contact-summary — Resumo automatizado do contato/lead.\n" +
  "  – contact-from-media — Extração de contato a partir de mídia (imagem/áudio).\n" +
  "  – smart-whatsapp-message — Geração personalizada de mensagens WhatsApp por contexto do cliente.\n" +
  "  – digital-content-ai — Geração de ideias, títulos, roteiros e variações de conteúdo (persona de marketing).\n" +
  "  – digital-trends — Consulta e sintetiza tendências para o módulo Digital.\n" +
  "  – enhance-image / media-enhance — Melhoria e reprocessamento de imagens/mídia.\n" +
  "• Logs de sugestões e execuções ficam em public.ai_chat_messages, ai_insights, ai_insight_messages, ai_actions, ai_policies e service_ai_logs.\n" +
  "• Governança: políticas de autopilot em ai_policies (max_risk, escopos permitidos).\n\n" +
  "4. Edge Functions (visão de integração)\n" +
  "-----------------------------------------\n" +
  "• Padrão: cada função vive em supabase/functions/<nome>/index.ts, exposta em https://<project>.supabase.co/functions/v1/<nome>.\n" +
  "• Consumo no frontend: supabase.functions.invoke('<nome>', { body }).\n" +
  "• Nenhuma função exige atualmente segredo de provider externo além de LOVABLE_API_KEY e as chaves Supabase padrão.\n\n" +
  "5. WhatsApp\n" +
  "-----------------------------------------\n" +
  "• Integração via deep links oficiais (não é API oficial da Meta/Cloud API):\n" +
  "  – Mobile: https://api.whatsapp.com/send?phone=...&text=...\n" +
  "  – Desktop: https://wa.me/<numero>?text=...\n" +
  "• Utilitários: src/lib/whatsapp.ts, src/lib/whatsappShare.ts, src/lib/whatsappTemplates.ts.\n" +
  "• Componentes: BulkWhatsAppDispatch, WhatsAppMessageSelector, WhatsAppAttachments, QuickConversationDialog.\n" +
  "• Toda ação de envio é registrada automaticamente na timeline do contato (contact_history) via useWhatsAppWithLog.\n" +
  "• Anexos: estratégia multi-tier (link, arquivo, mídia da biblioteca) — ver memória whatsapp-file-sharing-strategy.\n\n" +
  "6. Upload e Gestão de Arquivos\n" +
  "-----------------------------------------\n" +
  "• Uploads via Supabase Storage (supabase.storage.from(<bucket>).upload).\n" +
  "• Buckets em uso:\n" +
  "  – media — mídia do módulo Digital, produtos e biblioteca unificada.\n" +
  "  – contact-avatars — fotos e avatares de contatos (com AvatarCropEditor).\n" +
  "  – delivery-proof — comprovantes/assinaturas de entrega (SignaturePad, DeliveryProofDialog).\n" +
  "• Componentes centrais: MediaUploader, ProductGallery, digital media library.\n" +
  "• Download: padrão fetch-to-blob para preservar navegação (memória media-download-and-replace-pattern).\n\n" +
  "7. Atendimento Multiplataforma\n" +
  "-----------------------------------------\n" +
  "• Estrutura pronta para receber mensagens de plataformas externas via service_conversations + service_messages + digital_platforms.\n" +
  "• Vinculação automática de conversa ↔ contato (auto_link_conversation_contact) por email/telefone.\n" +
  "• Não há hoje conector oficial ativo com APIs externas (Meta/WhatsApp Business, Instagram Graph, etc.) — as mensagens externas chegam por importação/registro manual ou via IA.\n\n" +
  "8. Webhooks\n" +
  "-----------------------------------------\n" +
  "• Não há webhooks públicos expostos atualmente no Painel Central.\n" +
  "• As Edge Functions podem receber POST (comportamento HTTP normal), mas nenhum endpoint específico está configurado como webhook receiver de terceiros no momento.\n" +
  "• Automações internas rodam via triggers PL/pgSQL + tabela automation_rules (não são webhooks externos).\n\n" +
  "9. Conectores (MCP / App Connectors)\n" +
  "-----------------------------------------\n" +
  "• Nenhum MCP Connector ou App Connector externo (Slack, Notion, Gmail, Stripe, etc.) está conectado ao projeto atualmente.\n" +
  "• Quando ativados, ficam expostos ao runtime como variáveis (secret ou VITE_LOVABLE_CONNECTOR_*) e são chamados via https://connector-gateway.lovable.dev/{connector_id}/... — ver memória de integrações futuras.\n\n" +
  "10. Bibliotecas de Terceiros com papel de integração\n" +
  "-----------------------------------------\n" +
  "• @supabase/supabase-js — cliente oficial (data, auth, storage, realtime, functions).\n" +
  "• @tanstack/react-query — cache/reatividade das consultas ao backend.\n" +
  "• date-fns (+ ptBR) — parsing/format DD/MM/YYYY, respeitando America/Sao_Paulo.\n" +
  "• sonner — toasts de feedback (inclui erros de integração).\n" +
  "• framer-motion — transições da UI (não é integração externa, mas parte da camada de apresentação).\n" +
  "• react-router-dom — navegação; consumo do consent redirect e rotas /nucleo.\n\n" +
  "11. Variáveis de Ambiente Expostas ao Frontend\n" +
  "-----------------------------------------\n" +
  "• VITE_SUPABASE_URL — endpoint público do projeto.\n" +
  "• VITE_SUPABASE_PUBLISHABLE_KEY — chave anon pública.\n" +
  "• VITE_SUPABASE_PROJECT_ID — ref do projeto (para composição de URLs de auth/OAuth).\n" +
  "• Nenhuma chave server-side (LOVABLE_API_KEY, SERVICE_ROLE_KEY, DB_URL) é exposta ao browser.\n\n" +
  "12. Observações e Riscos\n" +
  "-----------------------------------------\n" +
  "• Todas as chamadas à IA passam obrigatoriamente pelo Lovable AI Gateway — não há fallback direto para OpenAI/Google/Anthropic.\n" +
  "• WhatsApp é integração por link, não API oficial: mensagens dependem do dispositivo do operador e não retornam status de entrega.\n" +
  "• Buckets de Storage são públicos; qualquer URL vazada é acessível — sensibilidade dos arquivos deve considerar isso.\n" +
  "• Antes de adicionar nova integração externa (webhook, conector, API oficial), consultar o Núcleo (Princípio Mestre) para checar alinhamento estratégico.\n\n" +
  "Documento vivo — atualize sempre que uma nova integração for adicionada, removida ou reconfigurada.";

const INTEGRACOES_FILL_FLAG = "nucleo_estado_atual_integracoes_fill_v1";

const BANCO_DE_DADOS_CONTENT =
  "Banco de Dados — Estado Atual\n" +
  "=========================================\n\n" +
  "Documento descritivo do banco de dados do Painel Central. Não altera schema, não executa migrações — apenas registra a estrutura existente para consulta.\n\n" +
  "1. Visão Geral\n" +
  "-----------------------------------------\n" +
  "• Motor: PostgreSQL gerenciado via Lovable Cloud (Supabase).\n" +
  "• Acesso do frontend: PostgREST (Data API) + Realtime, através de @/integrations/supabase/client.\n" +
  "• Segurança: RLS habilitado em todas as tabelas do schema public; políticas por tabela; funções SECURITY DEFINER para regras específicas.\n" +
  "• Armazenamento de arquivos: Supabase Storage — buckets 'media', 'contact-avatars' e 'delivery-proof' (públicos).\n" +
  "• Padrões globais: timestamps com timezone (America/Sao_Paulo na apresentação), IDs uuid (gen_random_uuid), colunas created_at/updated_at, precisão numeric(20,10) para valores monetários e quantidades.\n\n" +
  "2. Entidades Principais (agrupadas por domínio)\n" +
  "-----------------------------------------\n\n" +
  "A) Organograma / Núcleo Operacional\n" +
  "• nodes — Árvore hierárquica de nós do painel (raiz obrigatória 'Deividi' id d7c76db8-b7e0-4ce1-87ca-21275c346326). Campos típicos: title, parent_id, type, color, order_index.\n" +
  "• tasks — Tarefas vinculadas a nós. Campos: title, description, status (estrutural|andamento|pendente|concluído), node_id, dependency_id, progress, order_index, contact_id, scheduled_date, due_date, scheduled_time, assigned_to, on_hold_*.\n" +
  "• on_hold_log — Log de mudanças de status 'em espera' das tarefas.\n" +
  "• task_merge_history — Histórico de mesclagem de tarefas duplicadas.\n" +
  "• time_entries — Apontamentos de tempo por tarefa (started_at, ended_at, duration).\n" +
  "• timer_state — Estado atual do timer ativo do Foco.\n\n" +
  "B) Rotina & Metas\n" +
  "• routine_blocks — Blocos de rotina com horário, duração e vinculação a MT/template.\n" +
  "• routine_templates — Modelos reutilizáveis de rotina.\n" +
  "• routine_mts — Métodos de Trabalho (MT) por área operacional.\n" +
  "• routine_prefs — Preferências de rotina por usuário/operador.\n" +
  "• routine_stats — Estatísticas agregadas de execução.\n" +
  "• monthly_goals — Metas mensais (valor, categoria, progresso).\n" +
  "• seasonal_days — Dias sazonais recorrentes com dias de preparo e urgência.\n" +
  "• meetings, meeting_items, meeting_participants — Reuniões, pauta/itens e participantes.\n\n" +
  "C) CRM / Contatos\n" +
  "• contacts — Cadastro central de contatos (81 colunas): dados pessoais, canais (phone, whatsapp, mobile, email), endereço, funil (funnel_status), classificação (client_classification), lifetime_value, paid_orders_count, last_purchase_date, last_payment_date, ultimo_contato, is_active, photo_url, etc.\n" +
  "• contact_tags + contact_tag_assignments — Tags aplicáveis a contatos (many-to-many).\n" +
  "• contact_activities — Atividades registradas (ligações, follow-ups).\n" +
  "• contact_history — Timeline auditável de eventos (event_type, interaction_type, description, interaction_date, old_value/new_value).\n\n" +
  "D) Atendimento (Multicanal)\n" +
  "• service_conversations — Conversas por plataforma; vincula contact_id, contact_handle, funnel_stage, status, unread_count, auto_reply_enabled.\n" +
  "• service_messages — Mensagens da conversa (sender, content, is_ai_suggested, logged_to_history).\n" +
  "• service_ai_logs — Logs de sugestões/execuções de IA no atendimento.\n\n" +
  "E) Operações / Produção / Estoque\n" +
  "• products — SKUs (nome, sku, cover_image_url, price, cost, category, dimensões, peso, media_urls, is_active, deleted_at).\n" +
  "• product_categories, product_components (BOM), product_processes, product_optional_costs — Estrutura de composição do produto.\n" +
  "• processes — Cadastro de processos produtivos.\n" +
  "• production_orders + production_order_processes — Ordens de produção e etapas.\n" +
  "• production_entries, production_logs — Apontamentos de produção.\n" +
  "• production_closings + production_closing_items — Fechamentos periódicos de produção.\n" +
  "• inventory + inventory_movements — Estoque por local e movimentações atômicas.\n" +
  "• storage_locations — Locais de armazenamento.\n" +
  "• orders + order_items — Pedidos (order_number, contact_id, status, order_date, delivery_date, priority, notes).\n" +
  "• invoices — Notas fiscais associadas a pedidos/contatos.\n\n" +
  "F) Rotas / Entregas\n" +
  "• delivery_routes — Roteiros de entrega (data, motorista, status).\n" +
  "• delivery_stops — Paradas da rota com endereço, contato, comprovante, ordem.\n\n" +
  "G) Financeiro\n" +
  "• financial_accounts — Contas (caixa, banco, cartão) com saldo inicial e corrente.\n" +
  "• financial_categories — Categorias (pagar, receber, ambos).\n" +
  "• financial_entries — Lançamentos a pagar/receber; recorrência, competência, contact_id, order_id, value/value_paid, is_conciliated.\n" +
  "• financial_movements — Movimentações de pagamento por lançamento e conta (dispara triggers de saldo e value_paid).\n" +
  "• price_params, price_param_fees, price_param_history, price_fee_fields, price_channels, price_stores, price_simulations, price_simulation_items — Sistema de precificação hierárquica V2.\n\n" +
  "H) Digital / Marketing\n" +
  "• digital_platforms + digital_platform_groups — Plataformas e agrupamentos (hierárquico).\n" +
  "• digital_ideas — Ideias estratégicas (núcleo do conteúdo).\n" +
  "• digital_variations — Variações por plataforma (40 colunas, campos customizados em JSONB).\n" +
  "• digital_idea_types — Tipos configuráveis de ideia.\n" +
  "• digital_media + digital_media_folders — Biblioteca de mídia unificada.\n" +
  "• digital_templates — Templates de conteúdo.\n" +
  "• digital_interactions — Interações registradas (engajamento).\n" +
  "• digital_trends — Tendências detectadas/importadas.\n" +
  "• digital_knowledge_base — Base de FAQs por plataforma (question, answer, keywords, usage_count).\n" +
  "• posts — Posts publicados/agendados.\n\n" +
  "I) IA / Automação / Assistente\n" +
  "• ai_actions — Ações executáveis pela IA.\n" +
  "• ai_chat_messages — Histórico do chat do assistente.\n" +
  "• ai_insights + ai_insight_messages — Insights gerados e conversas relacionadas.\n" +
  "• ai_policies — Políticas de governança (max_risk, escopos).\n" +
  "• automation_rules — Regras (trigger_type, trigger_config, action_type, action_config, is_active).\n" +
  "• automation_logs — Execuções (status success|error, trigger_data, action_result).\n\n" +
  "J) Planilhas & Diversos\n" +
  "• sheets, sheet_tabs, sheet_cells — Planilhas customizadas.\n" +
  "• wizard_steps — Estado de assistentes multi-etapas.\n" +
  "• app_users — Usuários/colaboradores centralizados.\n\n" +
  "3. Chaves e Relacionamentos Estruturais\n" +
  "-----------------------------------------\n" +
  "• PK padrão: uuid gerada por gen_random_uuid().\n" +
  "• FKs principais:\n" +
  "  – tasks.node_id → nodes.id; tasks.dependency_id → tasks.id; tasks.contact_id → contacts.id.\n" +
  "  – contact_history.contact_id, contact_activities.contact_id, contact_tag_assignments.contact_id, service_conversations.contact_id, delivery_stops.contact_id, invoices.contact_id, orders.contact_id, financial_entries.contact_id → contacts.id.\n" +
  "  – contact_tag_assignments.tag_id → contact_tags.id (par único contact_id+tag_id).\n" +
  "  – service_messages.conversation_id → service_conversations.id.\n" +
  "  – order_items.order_id → orders.id; production_orders → orders/products; product_components → products (BOM).\n" +
  "  – financial_entries.category_id → financial_categories.id; financial_entries.account_id → financial_accounts.id; financial_entries.order_id → orders.id.\n" +
  "  – financial_movements.entry_id → financial_entries.id; financial_movements.account_id → financial_accounts.id.\n" +
  "  – digital_variations.idea_id → digital_ideas.id; digital_variations.platform_id → digital_platforms.id; digital_platforms.parent_id → digital_platforms.id.\n" +
  "  – sheet_tabs.sheet_id → sheets.id; sheet_cells.tab_id → sheet_tabs.id.\n" +
  "  – automation_logs.rule_id → automation_rules.id.\n" +
  "• Constraint global: NUNCA criar FK para auth.users; identidade de usuário fica em app_users.\n\n" +
  "4. Funções e Triggers\n" +
  "-----------------------------------------\n" +
  "Funções SECURITY DEFINER relevantes (schema public):\n" +
  "• update_updated_at_column / update_tasks_updated_at — Mantêm updated_at.\n" +
  "• log_service_message_to_history — Loga mensagens de atendimento na timeline do contato.\n" +
  "• update_account_balance — Ajusta saldo de financial_accounts a cada movimento.\n" +
  "• update_entry_value_paid — Recalcula value_paid do lançamento após inserção/edição/remoção de movimento.\n" +
  "• apply_funnel_automations — Executa automation_rules do tipo 'funnel_stage_changed' (cria tarefa, muda estágio, alerta).\n" +
  "• sync_funnel_contact_to_conversations / sync_funnel_conversation_to_contact — Sincronizam funil entre contatos e conversas.\n" +
  "• map_conv_to_contact_funnel / map_contact_to_conv_funnel — Mapeiam estágios entre os dois vocabulários.\n" +
  "• sync_contact_on_order_change — Atualiza classificação e datas de compra quando pedido é entregue/cancelado.\n" +
  "• sync_contact_on_payment — Incrementa lifetime_value, paid_orders_count e promove a VIP quando pagamento é confirmado.\n" +
  "• sync_contact_to_service_conversations — Propaga edições do contato para conversas.\n" +
  "• auto_create_service_conversation — Cria conversa automaticamente para novos contatos ativos.\n" +
  "• auto_link_conversation_contact — Vincula conversa a contato existente por email/telefone.\n" +
  "• merge_contacts(primary_id, duplicate_id) — Mescla contatos, reapontando FKs e agregando métricas.\n" +
  "• create_default_sheet_tab — Cria aba padrão em nova planilha.\n\n" +
  "5. Segurança (RLS) e Acessos\n" +
  "-----------------------------------------\n" +
  "• Todas as tabelas do schema public têm RLS habilitado e ao menos uma política ativa.\n" +
  "• GRANTs explícitos por tabela para authenticated e service_role; anon apenas quando a política permite leitura pública.\n" +
  "• Funções sensíveis marcadas com SECURITY DEFINER + search_path = public para evitar escalonamento via schema hijacking.\n" +
  "• Papéis de usuário devem ficar sempre em tabela separada (padrão user_roles + has_role), nunca em profiles/contacts.\n\n" +
  "6. Storage (Buckets)\n" +
  "-----------------------------------------\n" +
  "• media — Mídia geral do Digital e produtos (público).\n" +
  "• contact-avatars — Avatares e fotos de contatos (público).\n" +
  "• delivery-proof — Comprovantes/assinaturas de entrega (público).\n\n" +
  "7. Realtime\n" +
  "-----------------------------------------\n" +
  "Canais postgres_changes usados no frontend para: tasks, contacts, service_conversations, service_messages, digital_knowledge_base, financial_entries, entre outros — mantendo listas e painéis reativos sem refetch manual.\n\n" +
  "8. Convenções e Restrições Globais\n" +
  "-----------------------------------------\n" +
  "• Precisão numeric(20,10) para custos, preços e quantidades — nunca arredondar prematuramente.\n" +
  "• Datas armazenadas como YYYY-MM-DD ou timestamptz; exibição sempre DD/MM/YYYY em America/Sao_Paulo.\n" +
  "• Nunca alterar schemas auth/storage/realtime/supabase_functions/vault.\n" +
  "• Nunca editar src/integrations/supabase/client.ts nem types.ts (gerados).\n" +
  "• Toda nova tabela em public exige: CREATE TABLE → GRANT → ENABLE RLS → CREATE POLICY, nessa ordem.\n\n" +
  "Documento vivo — atualize sempre que novas tabelas, funções ou políticas forem criadas.";

const BANCO_DE_DADOS_FILL_FLAG = "nucleo_estado_atual_banco_de_dados_fill_v1";

const FUNCIONALIDADES_IMPLEMENTADAS_CONTENT = `# Funcionalidades Implementadas — Estado Atual

Inventário das funcionalidades já em produção no Painel Central. Para cada item: **Nome**, **Módulo**, **Descrição**, **Status** e **Dependências**. Documento descritivo — nada foi alterado.

Legenda de status: **Ativa** (em uso pleno) · **Parcial** (funciona, com limitações conhecidas) · **Beta** (uso experimental).

---

## Autenticação e Usuários

### Login por e-mail e senha
- **Módulo:** Autenticação
- **Descrição:** Sessão via Supabase Auth com JWT em localStorage; \`AuthProvider\` propaga sessão; \`ProtectedRoute\` guarda rotas internas.
- **Status:** Ativa
- **Dependências:** Lovable Cloud (Auth), \`AuthContext\`, \`ProtectedRoute\`.

### Papéis e permissões (\`has_role\`)
- **Módulo:** Autenticação
- **Descrição:** Tabela \`user_roles\` + função SECURITY DEFINER \`has_role(uid, role)\` usada em RLS.
- **Status:** Ativa
- **Dependências:** \`user_roles\`, RLS.

### Perfil operacional multi-usuário
- **Módulo:** Colaboradores
- **Descrição:** Tabela \`app_users\` centraliza operadores; isolamento de rotinas e alertas por operador.
- **Status:** Ativa
- **Dependências:** \`app_users\`.

---

## Organograma / Node Tree

### Árvore hierárquica interativa
- **Módulo:** Organograma
- **Descrição:** Nó-raiz obrigatório "Deividi"; múltiplos modos de visualização (Padrão, Linhas, CEO, Horizontal); prevenção de ciclos.
- **Status:** Ativa
- **Dependências:** \`nodes\`, integridade de \`parent_id\`.

### Gestos móveis (pan/zoom)
- **Módulo:** Organograma
- **Descrição:** Interações touch específicas para navegação em mobile.
- **Status:** Ativa
- **Dependências:** Node Tree.

---

## CRM

### Kanban de leads com score e prioridade
- **Módulo:** CRM
- **Descrição:** Lead Score (4 níveis), tiers visuais de urgência (3), ordenação automática por pontuação e inatividade.
- **Status:** Ativa
- **Dependências:** \`crm_leads\`, \`contacts\`.

### Timeline de eventos do contato
- **Módulo:** CRM
- **Descrição:** Trilha cronológica auditável e editável de interações.
- **Status:** Ativa
- **Dependências:** \`crm_timeline\`.

### Classificação de clientes (4 tiers)
- **Módulo:** CRM
- **Descrição:** Segmentação estratégica de contatos.
- **Status:** Ativa
- **Dependências:** \`contacts\`.

### Detecção de não-resposta (ghosting)
- **Módulo:** CRM
- **Descrição:** Badges automáticos para leads sem resposta há X dias.
- **Status:** Ativa
- **Dependências:** \`crm_timeline\`.

### Follow-ups automáticos 1-clique
- **Módulo:** CRM
- **Descrição:** Templates estratégicos sugeridos por tempo de inatividade.
- **Status:** Ativa
- **Dependências:** CRM + WhatsApp deep links.

### Conversão bidirecional lead ↔ pedido
- **Módulo:** CRM ↔ Operações
- **Descrição:** Dados de lead preenchem venda; venda atualiza health do cliente.
- **Status:** Ativa
- **Dependências:** \`orders\`, \`crm_leads\`.

### Sync CRM ↔ Atendimento
- **Módulo:** CRM
- **Descrição:** Conversas, funil e timeline totalmente integrados.
- **Status:** Ativa
- **Dependências:** \`service_conversations\`, \`service_messages\`.

### Sugestões de WhatsApp por IA
- **Módulo:** CRM
- **Descrição:** Mensagens personalizadas com base nos dados do cliente.
- **Status:** Ativa
- **Dependências:** Edge \`smart-whatsapp-message\`, Lovable AI Gateway.

### Disparo em massa WhatsApp (Queue mode)
- **Módulo:** CRM
- **Descrição:** Envio sequencial guiado com logging automático.
- **Status:** Ativa
- **Dependências:** \`BulkWhatsAppDispatch\`, WhatsApp deep links.

### Busca fuzzy por telefone (sufixo)
- **Módulo:** CRM
- **Descrição:** Localiza contatos por final do número.
- **Status:** Ativa
- **Dependências:** \`contacts\`.

### Página centralizada de tarefas do CRM
- **Módulo:** CRM
- **Descrição:** View dedicada apenas para tarefas agendadas do CRM.
- **Status:** Ativa
- **Dependências:** \`tasks\`.

### Health do cliente automático
- **Módulo:** CRM
- **Descrição:** Sincroniza funil e LTV a partir de pedidos e pagamentos.
- **Status:** Ativa
- **Dependências:** \`orders\`, \`financial_entries\`.

### Checklist de execução automático
- **Módulo:** CRM
- **Descrição:** Marca progresso a partir de eventos da timeline.
- **Status:** Ativa
- **Dependências:** \`crm_timeline\`.

### "Smart Attend" contextual
- **Módulo:** CRM
- **Descrição:** Escolhe ação/WhatsApp mais adequado ao contexto do lead.
- **Status:** Ativa
- **Dependências:** IA + timeline.

### Performance com virtualização
- **Módulo:** CRM
- **Descrição:** Listas grandes usam lazy-loading/virtualização.
- **Status:** Ativa
- **Dependências:** —

---

## Atendimento

### Hub conversacional multi-plataforma
- **Módulo:** Atendimento
- **Descrição:** Conversas agrupadas por contato/plataforma; IA sugere intenção e próxima ação.
- **Status:** Parcial (sem conectores externos ativos — envios via deep link)
- **Dependências:** \`service_conversations\`, \`service_messages\`, IA.

### Criação automática de conversa por novo contato
- **Módulo:** Atendimento
- **Descrição:** Trigger \`auto_create_service_conversation\`.
- **Status:** Ativa
- **Dependências:** PL/pgSQL.

---

## Operações / Vendas

### Pedidos com 2 fluxos (Estoque / Produção)
- **Módulo:** Operações
- **Descrição:** Ciclo de 4 etapas; produção gera OP e consome insumos.
- **Status:** Ativa
- **Dependências:** \`orders\`, \`order_items\`, \`production_orders\`.

### Prioridade automática (5 níveis)
- **Módulo:** Operações
- **Descrição:** Calculada por data de entrega, tipo, cliente.
- **Status:** Ativa
- **Dependências:** \`orders\`.

### Ajustes de venda (desconto/frete)
- **Módulo:** Operações
- **Descrição:** Persistidos dinamicamente nas notas do pedido.
- **Status:** Ativa
- **Dependências:** \`orders\`.

### Integração automática com Financeiro
- **Módulo:** Operações → Financeiro
- **Descrição:** Confirmação de venda cria "A Receber".
- **Status:** Ativa
- **Dependências:** \`financial_entries\`.

### Planejamento de produção por entrega
- **Módulo:** Operações
- **Descrição:** Visão organizada por data com ações em massa.
- **Status:** Ativa
- **Dependências:** \`production_orders\`.

### Alerta visual de OP atrasada
- **Módulo:** Operações
- **Descrição:** Badge pulsante quando \`due_date\` vence.
- **Status:** Ativa
- **Dependências:** \`production_orders\`.

---

## Produção

### Modelo de custo em 3 camadas
- **Módulo:** Produção
- **Descrição:** BOM + processos + logística opcional.
- **Status:** Ativa
- **Dependências:** \`products\`, \`bom\`.

### Kanban semanal de OPs
- **Módulo:** Produção
- **Descrição:** Drag-and-drop para reagendar.
- **Status:** Ativa
- **Dependências:** \`production_orders\`.

### Consumo por local (location-aware)
- **Módulo:** Produção ↔ Estoque
- **Descrição:** Consumo direcionado a warehouse específico.
- **Status:** Ativa
- **Dependências:** \`inventory_locations\`, \`inventory_movements\`.

### Dimensões e peso do produto
- **Módulo:** Produção
- **Descrição:** Campos detalhados de SKU para logística.
- **Status:** Ativa
- **Dependências:** \`products\`.

### Fluxo OP → Estoque para itens de estoque
- **Módulo:** Produção
- **Descrição:** Finalização gera entrada automática no local destino.
- **Status:** Ativa
- **Dependências:** \`inventory_movements\`.

---

## Estoque

### Inventário unificado com movimentos atômicos
- **Módulo:** Estoque
- **Descrição:** Cada movimento vinculado a local; saldo sempre derivado.
- **Status:** Ativa
- **Dependências:** \`inventory_movements\`, \`inventory_locations\`.

### Wizard de ajuste em 4 passos
- **Módulo:** Estoque
- **Descrição:** Ajustes controlados com motivo e revisão.
- **Status:** Ativa
- **Dependências:** \`inventory_movements\`.

### KPI global de valor de estoque
- **Módulo:** Estoque
- **Descrição:** Em tempo real com \`numeric(20,10)\`.
- **Status:** Ativa
- **Dependências:** \`products\`, \`inventory_movements\`.

---

## Financeiro

### Contas a pagar / receber com recorrência
- **Módulo:** Financeiro
- **Descrição:** Recorrência configurável e parcelas futuras.
- **Status:** Ativa
- **Dependências:** \`financial_entries\`.

### Pagamentos parciais com desconto/juros
- **Módulo:** Financeiro
- **Descrição:** Tabela dedicada mantém histórico.
- **Status:** Ativa
- **Dependências:** \`financial_entries\` + tabela de pagamentos.

### Filtro global de período (calendário duplo)
- **Módulo:** Financeiro
- **Descrição:** Popover com fuso America/Sao_Paulo.
- **Status:** Ativa
- **Dependências:** —

### Interface mobile one-hand
- **Módulo:** Financeiro
- **Descrição:** UX otimizada para uso com uma mão.
- **Status:** Ativa
- **Dependências:** —

### Precificação hierárquica (V2)
- **Módulo:** Financeiro
- **Descrição:** Simulação multi-tier com taxas dinâmicas e histórico.
- **Status:** Ativa
- **Dependências:** \`pricing_*\`.

---

## Digital / Marketing

### Ideia central com variações por plataforma
- **Módulo:** Digital
- **Descrição:** Campos custom em JSONB por variação.
- **Status:** Ativa
- **Dependências:** \`digital_ideas\`.

### Auto-fill ideia ↔ SKU
- **Módulo:** Digital
- **Descrição:** Vincular a produto preenche título e mídia.
- **Status:** Ativa
- **Dependências:** \`products\`.

### Agendamento multi-datas por variação
- **Módulo:** Digital
- **Descrição:** Cada variação pode ser publicada em várias datas.
- **Status:** Ativa
- **Dependências:** —

### Cards visuais estratégicos (Kanban)
- **Módulo:** Digital
- **Descrição:** Ações diretas: agendar, publicar, duplicar, IA.
- **Status:** Ativa
- **Dependências:** —

### Geração de conteúdo por IA
- **Módulo:** Digital
- **Descrição:** Copies e adaptação de variações.
- **Status:** Ativa
- **Dependências:** Edge \`digital-content-ai\`.

### Tendências por IA
- **Módulo:** Digital
- **Descrição:** Sugestões de temas em alta.
- **Status:** Ativa
- **Dependências:** Edge \`digital-trends\`.

### Melhoria de imagem por IA
- **Módulo:** Digital
- **Descrição:** Aprimoramento visual.
- **Status:** Ativa
- **Dependências:** Edges \`enhance-image\` / \`media-enhance\`.

### Preview visual com mockup por aspect-ratio
- **Módulo:** Digital
- **Descrição:** Renderiza mídia no formato real da plataforma.
- **Status:** Ativa
- **Dependências:** —

### Automações orientadas a objetivo
- **Módulo:** Digital ↔ CRM
- **Descrição:** Estratégias disparam triggers no CRM.
- **Status:** Ativa
- **Dependências:** —

### Hierarquia recursiva de plataformas
- **Módulo:** Digital
- **Descrição:** Seletor com breadcrumbs e duplicação.
- **Status:** Ativa
- **Dependências:** —

---

## Rotas / Entregas

### Planejamento e navegação de rota
- **Módulo:** Rotas
- **Descrição:** Ordena paradas por proximidade e prioridade.
- **Status:** Ativa
- **Dependências:** \`orders\`.

### Comprovante de entrega
- **Módulo:** Rotas
- **Descrição:** Upload no bucket \`delivery-proof\`.
- **Status:** Ativa
- **Dependências:** Storage.

---

## Agenda / Calendário

### Hub anual unificado
- **Módulo:** Calendário
- **Descrição:** Consolida tarefas, entregas, reuniões, conteúdo digital, dias sazonais.
- **Status:** Ativa
- **Dependências:** múltiplos módulos.

### Dias sazonais recorrentes
- **Módulo:** Calendário
- **Descrição:** Preparo e urgência visual.
- **Status:** Ativa
- **Dependências:** —

### Sync 3 camadas para Digital
- **Módulo:** Calendário ↔ Digital
- **Descrição:** Planejado, agendado, publicado.
- **Status:** Ativa
- **Dependências:** —

### Popover com pointer-events-auto
- **Módulo:** Calendário/Dialogs
- **Descrição:** Pickers de data/hora funcionam dentro de ResponsiveDialog.
- **Status:** Ativa
- **Dependências:** —

---

## Reuniões

### Roteiro estruturado + pauta + itens de ação
- **Módulo:** Reuniões
- **Descrição:** Sincroniza com calendário e Minha Área.
- **Status:** Ativa
- **Dependências:** \`meetings\`, \`tasks\`.

### Dashboard "Minha Área"
- **Módulo:** Reuniões / Tarefas
- **Descrição:** Filtra tarefas e reuniões do usuário ativo.
- **Status:** Ativa
- **Dependências:** \`app_users\`.

---

## Rotina / Foco / Planejamento

### Planejamento drag-and-drop
- **Módulo:** Planejamento
- **Descrição:** Sincroniza fila via localStorage para o Foco.
- **Status:** Ativa
- **Dependências:** —

### Fila de execução do Foco
- **Módulo:** Foco
- **Descrição:** Consome planejamento e tarefas ativas do DB.
- **Status:** Ativa
- **Dependências:** \`tasks\`.

### Time-tracking acoplado ao Foco
- **Módulo:** Foco
- **Descrição:** Inicia \`time_entries.started_at\` ao começar a tarefa.
- **Status:** Ativa
- **Dependências:** \`time_entries\`.

### Rotina com Métodos de Trabalho (MT)
- **Módulo:** Rotina
- **Descrição:** Templates pré-configurados por área.
- **Status:** Ativa
- **Dependências:** \`routine_*\`.

### Alertas inteligentes e checklists globais
- **Módulo:** Rotina
- **Descrição:** Alertas interativos com snooze e execução central.
- **Status:** Ativa
- **Dependências:** —

### Hub central de execução (blocos)
- **Módulo:** Rotina
- **Descrição:** Integra tarefas agendadas cross-module.
- **Status:** Ativa
- **Dependências:** múltiplos módulos.

### Hierarquia de status de tarefa (4 níveis)
- **Módulo:** Tarefas
- **Descrição:** Ordenação estrutural → concluído.
- **Status:** Ativa
- **Dependências:** \`tasks\`.

### Status "on-hold"
- **Módulo:** Tarefas
- **Descrição:** Espera independente com contexto e data de retorno.
- **Status:** Ativa
- **Dependências:** \`tasks\`.

---

## IA / Assistente

### CEO IA conversacional
- **Módulo:** IA
- **Descrição:** Chat com contexto amplo; executa ações via ferramentas.
- **Status:** Ativa
- **Dependências:** Edge \`ai-ceo\`, Lovable AI Gateway.

### Persistência de histórico e insights
- **Módulo:** IA
- **Descrição:** Sessões, mensagens e insights em tabelas dedicadas.
- **Status:** Ativa
- **Dependências:** \`ai_chat_sessions\`, \`ai_chat_messages\`, \`ai_insights\`.

### Governança e autopilot
- **Módulo:** IA
- **Descrição:** \`ai_policies.max_risk\` define ações executáveis automaticamente.
- **Status:** Ativa
- **Dependências:** \`ai_policies\`, \`ai_actions\`.

### Persona de marketing
- **Módulo:** IA (Digital)
- **Descrição:** IA atua como especialista para geração de conteúdo.
- **Status:** Ativa
- **Dependências:** \`digital-content-ai\`.

### Resumo e criação de contato por IA
- **Módulo:** IA (CRM)
- **Descrição:** \`contact-summary\` e \`contact-from-media\`.
- **Status:** Ativa
- **Dependências:** edges dedicadas.

---

## Núcleo

### Biblioteca estratégica navegável
- **Módulo:** Núcleo
- **Descrição:** Áreas, páginas, tags, versões, busca — fonte oficial de conhecimento.
- **Status:** Ativa
- **Dependências:** localStorage / persistência interna do Núcleo.

### Documentação "Estado Atual" (Mapa, Arquitetura, DB, Integrações, Agentes, Fluxos, Funcionalidades)
- **Módulo:** Núcleo
- **Descrição:** Seed automático das páginas de referência.
- **Status:** Ativa
- **Dependências:** —

---

## Padrões Técnicos e UX Transversais

### Mobile-first (sticky headers, bottom nav, ResponsiveDialog)
- **Módulo:** UI Global
- **Descrição:** Safe-area, fullscreen em mobile, framer-motion.
- **Status:** Ativa
- **Dependências:** —

### Timezone America/Sao_Paulo + \`parseISO\`
- **Módulo:** Data/Hora Global
- **Descrição:** Nunca \`new Date()\` para strings do backend; exibição DD/MM/YYYY.
- **Status:** Ativa
- **Dependências:** \`date-fns\` (ptBR).

### Precisão decimal global (\`numeric(20,10)\`)
- **Módulo:** Cálculos Financeiros/Estoque
- **Descrição:** Sem arredondamento prematuro.
- **Status:** Ativa
- **Dependências:** —

### LightboxProvider global (mídia)
- **Módulo:** UI Global
- **Descrição:** Um único contexto no App para evitar conflitos.
- **Status:** Ativa
- **Dependências:** —

### Download fetch-to-blob e substituição in-place
- **Módulo:** Mídia
- **Descrição:** Evita navegação do browser; preserva links ao substituir.
- **Status:** Ativa
- **Dependências:** Storage.

### Biblioteca unificada de mídia
- **Módulo:** Mídia
- **Descrição:** Fonte única para Digital e imagens de produto.
- **Status:** Ativa
- **Dependências:** Storage.

### Spreadsheet com grid HTML/Tailwind customizado
- **Módulo:** Planilhas
- **Descrição:** Sem \`react-data-grid\` (restrição arquitetural).
- **Status:** Ativa
- **Dependências:** —

### Lazy-loading de módulos pesados
- **Módulo:** Performance Global
- **Descrição:** Divisão de componentes por rota.
- **Status:** Ativa
- **Dependências:** React Router.

### Estratégia multi-tier de compartilhamento WhatsApp
- **Módulo:** Compartilhamento
- **Descrição:** Anexos de arquivo com fallback em camadas.
- **Status:** Ativa
- **Dependências:** WhatsApp deep links.

---

## Funcionalidades Explicitamente Não Ativas (para transparência)

- **Sign-up anônimo:** desativado por decisão.
- **Confirmação automática de e-mail:** desativada.
- **Google OAuth:** disponível, ativado somente se configurado.
- **Conectores externos de mensageria (WhatsApp API oficial, Instagram, etc.):** ainda não conectados — envios usam deep links.
- **Webhooks públicos:** inexistentes; automações internas via triggers PL/pgSQL.
- **Gateway de pagamento:** nenhum ativo (Stripe/Paddle disponíveis, não habilitados).

---

Documento gerado pelo próprio Painel. Nenhuma funcionalidade foi alterada.
`;

const FUNCIONALIDADES_IMPLEMENTADAS_FILL_FLAG = "nucleo_estado_atual_funcionalidades_implementadas_fill_v1";

const FUNCIONALIDADES_INCOMPLETAS_CONTENT = `# Funcionalidades Incompletas — Estado Atual

Itens presentes no sistema hoje que **funcionam parcialmente**, dependem de configuração externa, ou ainda não têm o ciclo completo implementado. Documento descritivo — nada foi alterado.

Legenda: **Parcial** (usável, com lacuna conhecida) · **Rascunho** (estrutura pronta, uso limitado) · **Aguardando integração** (depende de terceiro).

---

### 1. Atendimento multi-plataforma — envio real
- **Módulo:** Atendimento
- **Estado:** Parcial
- **O que funciona:** Recebimento manual, agrupamento por contato/plataforma, IA de intenção, timeline.
- **O que falta:** Conectores oficiais (WhatsApp Business API, Instagram DM, Messenger). Envio hoje ocorre por deep link.
- **Impacto:** Automação de resposta e recebimento em tempo real limitados.

### 2. WhatsApp — envio programado / API oficial
- **Módulo:** CRM / Atendimento
- **Estado:** Aguardando integração
- **O que funciona:** Deep links (\`api.whatsapp.com\`, \`wa.me\`), disparo em massa Queue mode, logging na timeline.
- **O que falta:** Envio server-side (API oficial), templates HSM aprovados, agendamento sem intervenção humana.

### 3. Webhooks públicos
- **Módulo:** Integrações
- **Estado:** Rascunho
- **O que funciona:** Automações internas via triggers PL/pgSQL.
- **O que falta:** Endpoints públicos para receber eventos externos (formulários, Meta Ads, gateways).

### 4. Conectores MCP / App Connectors
- **Módulo:** Integrações
- **Estado:** Rascunho
- **O que funciona:** Infra do Lovable disponível.
- **O que falta:** Nenhuma conexão ativa (Google Calendar, Gmail, Drive, Meta, etc.).

### 5. Gateway de pagamento
- **Módulo:** Financeiro
- **Estado:** Não ativo
- **O que funciona:** Registro manual de recebimentos, parciais, recorrência.
- **O que falta:** Stripe/Paddle habilitados; cobrança automática via link.

### 6. Google OAuth
- **Módulo:** Autenticação
- **Estado:** Parcial
- **O que funciona:** Provider disponível no Supabase Auth.
- **O que falta:** Configuração do provedor efetivamente ativa; hoje o padrão é e-mail/senha.

### 7. Notificações (push / e-mail transacional)
- **Módulo:** Global
- **Estado:** Rascunho
- **O que funciona:** Alertas globais dentro do app (Rotina).
- **O que falta:** Push mobile, e-mail transacional configurado com domínio, SMS.

### 8. Rotas — otimização geográfica avançada
- **Módulo:** Rotas
- **Estado:** Parcial
- **O que funciona:** Planejamento por proximidade/prioridade, navegação, comprovante de entrega.
- **O que falta:** Otimização multi-veículo, janelas de entrega, integração com mapa/tráfego em tempo real.

### 9. Módulo "Compras" isolado
- **Módulo:** Operações
- **Estado:** Ausente como módulo próprio
- **O que funciona:** Fluxo composto por Operações + Estoque + Financeiro.
- **O que falta:** Tela dedicada de cotação, aprovação e histórico de fornecedores.

### 10. Cadastro/gestão de fornecedores
- **Módulo:** CRM / Compras
- **Estado:** Parcial
- **O que funciona:** Fornecedores tratados como contatos.
- **O que falta:** Segmentação específica, catálogo por fornecedor, prazos e SLAs.

### 11. Relatórios exportáveis (PDF/Excel)
- **Módulo:** Global
- **Estado:** Parcial
- **O que funciona:** KPIs e dashboards em tela.
- **O que falta:** Exportação padronizada de DRE, curva ABC, extratos, timelines.

### 12. Autopilot da IA em ações de alto risco
- **Módulo:** IA
- **Estado:** Parcial por design
- **O que funciona:** \`ai_policies.max_risk\` limita o autopilot; execução de ações baixas.
- **O que falta:** Ampliação segura para ações críticas (envio massivo, alterações financeiras).

### 13. Analytics agregado histórico
- **Módulo:** Dashboard Panorâmico
- **Estado:** Parcial
- **O que funciona:** KPIs cross-module em tempo real.
- **O que falta:** Séries históricas longas, comparativos ano/ano, coortes.

### 14. Onboarding e permissões granulares
- **Módulo:** Colaboradores
- **Estado:** Parcial
- **O que funciona:** \`user_roles\` + \`has_role\`.
- **O que falta:** UI de gestão de papéis, permissões por módulo/ação, convites.

### 15. Recuperação de senha / troca de e-mail
- **Módulo:** Autenticação
- **Estado:** Parcial (usa fluxo padrão do backend, sem UI própria polida)
- **O que falta:** Telas dedicadas com templates de e-mail personalizados.

### 16. Backup e restauração pelo usuário
- **Módulo:** Global
- **Estado:** Ausente
- **O que falta:** Exportação completa a pedido, snapshots restauráveis pelo painel.

### 17. Testes automatizados
- **Módulo:** Engenharia
- **Estado:** Ausente
- **O que falta:** Suíte de testes unitários/integrados/E2E.

---

Nenhuma dessas funcionalidades foi alterada por esta documentação.
`;

const FUNCIONALIDADES_INCOMPLETAS_FILL_FLAG = "nucleo_estado_atual_funcionalidades_incompletas_fill_v1";

const PONTOS_FORTES_CONTENT = `# Pontos Fortes — Estado Atual

Aspectos em que o Painel Central hoje se destaca. Base para preservar decisões e evitar regressão.

---

### 1. Núcleo estratégico como fonte oficial
Consulta obrigatória antes de novos módulos, agentes ou automações. Garante coerência de longo prazo.

### 2. Organograma hierárquico com nó-raiz obrigatório ("Deividi")
Previne dependências circulares e mantém integridade da árvore. Múltiplos modos de visualização.

### 3. CRM com inteligência de urgência
Lead Score, tiers de prioridade, detecção de ghosting, follow-up 1-clique, health automático — foco em velocidade de resposta.

### 4. Sync bidirecional CRM ↔ Atendimento ↔ Operações
Conversas, timeline, funil, pedidos e financeiro conversam. Reduz retrabalho.

### 5. Precisão decimal global (\`numeric(20,10)\`)
Custos, preços e quantidades sem arredondamento prematuro. Confiabilidade financeira e de estoque.

### 6. Timezone e datas padronizados
America/Sao_Paulo sempre; \`parseISO\`; exibição DD/MM/YYYY. Evita bugs comuns de fuso.

### 7. Inventário atômico e location-aware
Cada movimento vinculado a local; saldo sempre derivado. Produção consome do local certo.

### 8. Modelo de custo em 3 camadas na produção
BOM + processos + logística opcional. Custo real do produto acabado.

### 9. Financeiro completo com recorrência e parciais
Contas a pagar/receber, parcelas, desconto/juros, filtro global de período com fuso local.

### 10. Digital estratégico (Ideia → Variações)
Núcleo estratégico único com variações por plataforma. Auto-fill via SKU, IA de conteúdo, tendências e mockups por aspect-ratio.

### 11. Rotina e Foco integrados ao tempo real
Planejamento drag-and-drop → Foco → \`time_entries\` acoplado. Multi-usuário isolado.

### 12. IA governada (autopilot com \`max_risk\`)
Ações executáveis com política clara. Histórico e insights persistidos.

### 13. Mobile-first consistente
Sticky headers com safe-area, bottom nav, ResponsiveDialog fullscreen, popovers com \`pointer-events-auto\`.

### 14. Autonomia do usuário sobre estruturas
Campos, categorias, canais e plataformas dinâmicos — sem hardcode.

### 15. Segurança de acesso
RLS em todas as tabelas relevantes; papéis via \`has_role\` (SECURITY DEFINER); sem sign-up anônimo.

### 16. Reuso de padrões técnicos
LightboxProvider global único, fetch-to-blob para mídia, biblioteca unificada de mídia, disparo WhatsApp com log automático.

### 17. Performance em listas grandes (CRM)
Virtualização e lazy-loading; sync otimista via eventos.

### 18. Documentação viva no Núcleo
Estado atual (Mapa, Arquitetura, DB, Integrações, Agentes, Fluxos, Funcionalidades) mantido dentro do próprio painel.
`;

const PONTOS_FORTES_FILL_FLAG = "nucleo_estado_atual_pontos_fortes_fill_v1";

const PONTOS_MELHORIA_CONTENT = `# Pontos de Melhoria — Estado Atual

Oportunidades identificadas a partir da análise do sistema atual. Documento descritivo — nenhuma melhoria foi implementada.

---

### 1. Integrações externas ativas
Conectar WhatsApp Business API, e-mail transacional com domínio próprio, Google Calendar, Meta Ads, gateway de pagamento. Hoje muitos fluxos dependem de deep link ou registro manual.

### 2. Módulo "Compras" próprio
Extrair de Operações/Financeiro uma tela dedicada com cotação, aprovação, fornecedores e SLAs.

### 3. Gestão granular de permissões
UI para papéis, permissões por módulo/ação e convites de novos usuários.

### 4. Relatórios exportáveis
PDF/Excel padronizados para DRE, curva ABC, timelines, extratos, funil.

### 5. Analytics histórico
Séries longas, comparativos ano/ano, coortes de clientes, retenção.

### 6. Notificações fora do app
Push mobile, e-mail transacional configurado, SMS opcional.

### 7. Rotas — otimização avançada
Multi-veículo, janelas de entrega, integração com mapa/tráfego em tempo real.

### 8. Testes automatizados
Cobertura unitária/integração/E2E para módulos críticos (Financeiro, Estoque, CRM).

### 9. Onboarding assistido
Tour interativo por módulo, dados de exemplo, checklist inicial.

### 10. Templates aprovados de WhatsApp (HSM)
Necessários para envios proativos via API oficial.

### 11. Autopilot da IA em risco maior (com salvaguardas)
Aprovação em lote, dry-run, auditoria reforçada para ações críticas.

### 12. Exportação/backup a pedido do usuário
Download completo, snapshots restauráveis.

### 13. UI de rastreio de mudanças
Diff visual entre versões de páginas do Núcleo, entradas financeiras e pedidos.

### 14. Melhoria contínua da IA
Fine-tuning de tom por persona (Marketing, CEO), memória de longo prazo por contato.

### 15. Padronização de cadastro de fornecedores
Segmento específico separado dos clientes, com catálogo próprio.

### 16. Configuração via UI de dias sazonais e regras de recorrência
Reduzir dependência de código para novas regras.

### 17. Observabilidade
Logs estruturados, dashboards de erros, alertas de falha em edge functions.

### 18. Design system explicitado
Tokens semânticos documentados no Núcleo (cores, tipografia, espaçamento) para novas telas.
`;

const PONTOS_MELHORIA_FILL_FLAG = "nucleo_estado_atual_pontos_melhoria_fill_v1";

const DIVIDA_TECNICA_CONTENT = `# Dívida Técnica — Estado Atual

Registro das dívidas técnicas conhecidas. Nada foi refatorado por esta documentação.

---

### 1. Ausência de testes automatizados
- **Área:** Global
- **Descrição:** Não há suíte unitária/integração/E2E.
- **Risco:** Regressões silenciosas em módulos críticos (Financeiro, Estoque, Produção).

### 2. Persistência do Núcleo em localStorage
- **Área:** Núcleo
- **Descrição:** Conteúdo estratégico depende do navegador do usuário; não é sincronizado no backend.
- **Risco:** Perda de conteúdo ao limpar dados; ausência de colaboração multi-dispositivo.

### 3. Envio de WhatsApp via deep link
- **Área:** CRM / Atendimento
- **Descrição:** Sem API oficial; requer interação humana.
- **Risco:** Não há confirmação de entrega/leitura server-side.

### 4. Storage buckets públicos
- **Área:** Mídia
- **Descrição:** \`media\`, \`contact-avatars\`, \`delivery-proof\` acessíveis publicamente.
- **Risco:** Exposição indevida de arquivos sensíveis se URLs vazarem.

### 5. Lógica de negócio no cliente
- **Área:** Financeiro, CRM, KPIs
- **Descrição:** Cálculos de KPI (valor de estoque, score, urgência) rodam em grande parte no front.
- **Risco:** Divergência entre usuários; peso em datasets grandes.

### 6. Ausência de camada de tipos compartilhada além do gerado pelo Supabase
- **Área:** Engenharia
- **Descrição:** Regras de domínio repetidas em vários componentes.
- **Risco:** Inconsistência entre módulos.

### 7. Componentes grandes em módulos críticos
- **Área:** CRM, Digital, Operações
- **Descrição:** Existem componentes com muita responsabilidade; parcialmente mitigado por lazy-loading.
- **Risco:** Dificuldade de manutenção e testes.

### 8. Duplicação de estilos ad-hoc
- **Área:** UI
- **Descrição:** Uso ocasional de utilitários fora do design system quando pressão de prazo apertou.
- **Risco:** Divergência visual em telas novas.

### 9. Sem observabilidade
- **Área:** Global / Edge functions
- **Descrição:** Falhas de edges e queries lentas dependem de inspeção manual.
- **Risco:** MTTR alto em incidentes.

### 10. Autopilot restrito por ausência de auditoria robusta
- **Área:** IA
- **Descrição:** Registrar diffs completos e reverter ações em lote ainda não é trivial.
- **Risco:** Limita expansão do autopilot.

### 11. Datas de arquivos legados
- **Área:** Data/Hora
- **Descrição:** Podem existir consumos residuais de \`new Date()\` fora do padrão \`parseISO\`.
- **Risco:** Bugs de fuso em telas antigas.

### 12. Sem migrações versionadas descritivas por feature
- **Área:** Banco de dados
- **Descrição:** Histórico de migrações existe, mas nem sempre nomeado por feature.
- **Risco:** Dificuldade em auditar quando/por que um campo mudou.

### 13. Sem CI/CD explícito para verificações
- **Área:** Engenharia
- **Descrição:** Deploy contínuo do Lovable, mas sem pipeline com lint/tsc/tests obrigatórios.
- **Risco:** Erros só descobertos em runtime.

### 14. Documentação técnica interna limitada
- **Área:** Engenharia
- **Descrição:** Núcleo cobre estratégia; falta ADRs (Architecture Decision Records) técnicos.
- **Risco:** Perda de contexto em decisões futuras.

### 15. Ausência de rate limiting em edges
- **Área:** IA / Edges
- **Descrição:** Sem controle explícito de uso por usuário.
- **Risco:** Custo elevado em caso de mau uso.
`;

const DIVIDA_TECNICA_FILL_FLAG = "nucleo_estado_atual_divida_tecnica_fill_v1";

const RESUMO_EXECUTIVO_CONTENT = `# Resumo Executivo — Estado Atual do Painel Central

## Visão geral
O **Painel Central – Cérebro** é um sistema hierárquico interativo (organograma vivo) que unifica operação, comercial, financeiro, marketing digital, produção, logística e rotina em um único painel. É construído sobre React + Vite + Tailwind e usa Lovable Cloud (Supabase) como backend com RLS, PostgREST, Realtime, Storage e Edge Functions.

## O que já é forte hoje
- **Núcleo estratégico oficial** como fonte de verdade antes de qualquer nova feature.
- **CRM inteligente** com score, urgência, follow-ups, detecção de ghosting e sync com Atendimento e Operações.
- **Financeiro** com recorrência, parciais, filtro global de período (fuso local) e integração automática com Vendas.
- **Estoque atômico e location-aware**, com KPI global em \`numeric(20,10)\`.
- **Produção com custo em 3 camadas** (BOM + processos + logística) e Kanban semanal.
- **Digital estratégico** (Ideia → Variações), auto-fill via SKU, IA para copies/tendências/imagens, mockups por aspect-ratio.
- **Rotina + Foco + Planejamento** integrados a \`time_entries\`, multi-usuário isolado.
- **IA governada** com autopilot limitado por \`ai_policies.max_risk\` e histórico persistido.
- **Padrões consistentes:** mobile-first, timezone America/Sao_Paulo, LightboxProvider global, RLS ativa, sem sign-up anônimo.

## Onde ainda há lacunas
- **Integrações externas** (WhatsApp Business API, e-mail transacional, Google Calendar, Meta Ads, gateways de pagamento) ainda não ativas.
- **Módulo Compras isolado**, gestão de fornecedores segmentada e relatórios exportáveis (PDF/Excel) são funcionalidades ausentes ou parciais.
- **Analytics histórico**, notificações fora do app e testes automatizados são frentes a evoluir.
- **Autopilot** limitado por ausência de auditoria robusta para ações críticas.

## Principais dívidas técnicas
- **Sem testes automatizados** e sem CI/CD com verificações obrigatórias.
- **Núcleo persiste em localStorage** — não sincronizado no backend.
- **WhatsApp por deep link**, sem confirmação server-side.
- **Storage buckets públicos** exigem cuidado com URLs.
- **KPIs calculados no cliente**, pesados em datasets grandes.
- **Observabilidade limitada** em edge functions.
- **Rate limiting inexistente** em chamadas à IA.

## Riscos e mitigação implícita
- **Segurança:** mitigada por RLS + \`has_role\` + ausência de sign-up anônimo.
- **Precisão financeira:** mitigada por \`numeric(20,10)\` global.
- **Fuso horário:** mitigada por \`parseISO\` e America/Sao_Paulo obrigatórios.
- **Regressão UX:** mitigada por padrões de mobile-first e ResponsiveDialog.
- **Desalinhamento estratégico:** mitigado pelo Núcleo como fonte oficial.

## Maturidade por área
| Área | Maturidade |
|---|---|
| Autenticação e papéis | Alta |
| CRM | Alta |
| Atendimento | Média (falta conector externo) |
| Operações / Vendas | Alta |
| Produção | Alta |
| Estoque | Alta |
| Financeiro | Alta (falta gateway) |
| Digital | Alta |
| Rotas | Média |
| Calendário / Agenda | Alta |
| Rotina / Foco / Planejamento | Alta |
| IA / Assistente | Média-alta (autopilot restrito) |
| Núcleo (documentação) | Alta |
| Observabilidade / Testes | Baixa |
| Integrações externas | Baixa |

## Recomendação de leitura complementar
- **Mapa Geral do Sistema** — módulos, páginas, rotas, componentes.
- **Arquitetura Atual** — organização, estrutura de pastas, camadas.
- **Banco de Dados** — tabelas, chaves, RLS, funções.
- **Integrações** — APIs, IA, storage, autenticação.
- **Agentes de IA** — nome, responsabilidade, fluxo, ferramentas, limitações.
- **Fluxos do Sistema** — login, financeiro, CRM, estoque, vendas, agenda, demais módulos.
- **Funcionalidades Implementadas / Incompletas** — inventário completo.
- **Pontos Fortes / Pontos de Melhoria / Dívida Técnica** — leitura estratégica.

## Conclusão
O Painel Central já opera como cérebro unificado com regras claras (Núcleo), precisão financeira, integridade hierárquica e IA governada. As próximas evoluções passam por **integrações externas oficiais**, **observabilidade + testes**, **relatórios exportáveis** e **ampliação segura do autopilot da IA**, sem comprometer os princípios que sustentam a coerência atual.
`;

const RESUMO_EXECUTIVO_FILL_FLAG = "nucleo_estado_atual_resumo_executivo_fill_v1";


const BIBLIOTECA_SEED: Array<{ title: string; content: string; tags: string[] }> = [
  {
    title: "Princípio Mestre do Painel Central",
    tags: ["princípio", "mestre", "governança", "ia"],
    content:
      "Princípio Mestre do Painel Central\n\n" +
      "O Núcleo do Painel Central é a fonte oficial de conhecimento da plataforma.\n\n" +
      "Antes de desenvolver novas funcionalidades, módulos, agentes de IA, automações ou alterações, a Inteligência Artificial deverá consultar o Núcleo para verificar se a proposta está alinhada com a filosofia, a arquitetura e as diretrizes do projeto.\n\n" +
      "Escopo do Núcleo\n" +
      "— Área estratégica e administrativa.\n" +
      "— Orienta a evolução da plataforma e o comportamento da Inteligência Artificial.\n" +
      "— Não interfere no funcionamento operacional do Painel Central.\n\n" +
      "Compromisso da Inteligência Artificial\n" +
      "— Continua executando normalmente todas as tarefas solicitadas pelos usuários.\n" +
      "— Usa o Núcleo como contexto, regras e base de conhecimento para manter consistência com a identidade do projeto.\n" +
      "— Ao identificar conflito entre um pedido e o Núcleo, sinaliza o conflito antes de prosseguir.\n\n" +
      "Áreas de consulta\n" +
      "• Biblioteca do Projeto — Cartas fundadoras (Teoria, Manifesto, Constituição, Consciência, Filosofia, Arquitetura).\n" +
      "• Consciência — Diretrizes operacionais, memória, aprendizagem, personalidade, regras, especialistas.\n" +
      "• Arquitetura — Módulos, agentes de IA, banco de dados, fluxos, APIs, integrações, estrutura da plataforma.\n" +
      "• Evolução do Projeto — Roadmap, melhorias, ideias, decisões importantes, histórico de alterações.",
  },
  {
    title: "Carta Zero — A Teoria do Painel Central",
    tags: ["carta", "teoria", "fundamento"],
    content:
      "Carta Zero — A Teoria do Painel Central\n\n" +
      "Documento fundacional que apresenta a teoria por trás do Painel Central: a razão de existir, o problema que resolve e a visão que sustenta todo o sistema.\n\n" +
      "— Escreva aqui a teoria completa.",
  },
  {
    title: "Carta I — Manifesto",
    tags: ["carta", "manifesto"],
    content:
      "Carta I — Manifesto\n\n" +
      "Declaração pública dos princípios, crenças e compromissos que guiam o Painel Central.\n\n" +
      "— Escreva aqui o manifesto.",
  },
  {
    title: "Carta II — Constituição",
    tags: ["carta", "constituição", "regras"],
    content:
      "Carta II — Constituição\n\n" +
      "Conjunto de regras, direitos e deveres que estruturam o funcionamento do Painel Central.\n\n" +
      "— Escreva aqui a constituição.",
  },
  {
    title: "Carta III — Consciência",
    tags: ["carta", "consciência"],
    content:
      "Carta III — Consciência\n\n" +
      "Reflexão sobre a consciência do sistema: propósito, autopercepção e responsabilidade.\n\n" +
      "— Escreva aqui a carta da consciência.",
  },
  {
    title: "Carta IV — Filosofia da Experiência",
    tags: ["carta", "filosofia", "experiência"],
    content:
      "Carta IV — Filosofia da Experiência\n\n" +
      "Como o Painel Central entende, projeta e entrega experiência ao usuário.\n\n" +
      "— Escreva aqui a filosofia da experiência.",
  },
  {
    title: "Carta V — Arquitetura da Inteligência",
    tags: ["carta", "arquitetura", "inteligência"],
    content:
      "Carta V — Arquitetura da Inteligência\n\n" +
      "Como a inteligência do sistema é estruturada: dados, decisões, automações e IA.\n\n" +
      "— Escreva aqui a arquitetura da inteligência.",
  },
];

// ---------- Persistence ----------

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadPages(): DocPage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let pages: DocPage[] = [];
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        pages = parsed.map((p) => ({
          ...p,
          versions: Array.isArray(p.versions) ? p.versions : [],
          tags: Array.isArray(p.tags) ? p.tags : [],
        }));
      }
    }
    // Seed biblioteca once
    if (!localStorage.getItem(SEED_FLAG_KEY)) {
      const existingTitles = new Set(
        pages.filter((p) => p.areaId === "biblioteca").map((p) => p.title)
      );
      const now = new Date().toISOString();
      const seeded = BIBLIOTECA_SEED.filter(
        (s) => !existingTitles.has(s.title)
      ).map<DocPage>((s) => ({
        id: uid(),
        areaId: "biblioteca",
        title: s.title,
        content: s.content,
        tags: s.tags,
        createdAt: now,
        updatedAt: now,
        versions: [],
      }));
      pages = [...seeded, ...pages];
      localStorage.setItem(SEED_FLAG_KEY, "1");
    }
    // Seed consciência once
    if (!localStorage.getItem(CONSCIENCIA_SEED_FLAG_KEY)) {
      const existingTitles = new Set(
        pages.filter((p) => p.areaId === "consciencia").map((p) => p.title)
      );
      const now = new Date().toISOString();
      const seeded = CONSCIENCIA_SEED.filter(
        (s) => !existingTitles.has(s.title)
      ).map<DocPage>((s) => ({
        id: uid(),
        areaId: "consciencia",
        title: s.title,
        content: s.content,
        tags: s.tags,
        createdAt: now,
        updatedAt: now,
        versions: [],
      }));
      pages = [...seeded, ...pages];
      localStorage.setItem(CONSCIENCIA_SEED_FLAG_KEY, "1");
    }
    // Seed arquitetura once
    if (!localStorage.getItem(ARQUITETURA_SEED_FLAG_KEY)) {
      const existingTitles = new Set(
        pages.filter((p) => p.areaId === "arquitetura").map((p) => p.title)
      );
      const now = new Date().toISOString();
      const seeded = ARQUITETURA_SEED.filter(
        (s) => !existingTitles.has(s.title)
      ).map<DocPage>((s) => ({
        id: uid(),
        areaId: "arquitetura",
        title: s.title,
        content: s.content,
        tags: s.tags,
        createdAt: now,
        updatedAt: now,
        versions: [],
      }));
      pages = [...seeded, ...pages];
      localStorage.setItem(ARQUITETURA_SEED_FLAG_KEY, "1");
    }
    // Seed princípios arquiteturais once
    if (!localStorage.getItem(PRINCIPIOS_SEED_FLAG_KEY)) {
      const existingTitles = new Set(
        pages.filter((p) => p.areaId === "principios").map((p) => p.title)
      );
      const now = new Date().toISOString();
      const seeded = PRINCIPIOS_SEED.filter(
        (s) => !existingTitles.has(s.title)
      ).map<DocPage>((s) => ({
        id: uid(),
        areaId: "principios",
        title: s.title,
        content: s.content,
        tags: s.tags,
        createdAt: now,
        updatedAt: now,
        versions: [],
      }));
      pages = [...seeded, ...pages];
      localStorage.setItem(PRINCIPIOS_SEED_FLAG_KEY, "1");
    }
    // Seed Princípio da Sequência de Decisão da IA (append-only, safe)
    if (!localStorage.getItem(PRINCIPIO_SEQUENCIA_DECISAO_FLAG_KEY)) {
      const existingTitles = new Set(
        pages.filter((p) => p.areaId === "principios").map((p) => p.title)
      );
      if (!existingTitles.has(PRINCIPIO_SEQUENCIA_DECISAO_PAGE.title)) {
        const now = new Date().toISOString();
        pages = [
          {
            id: uid(),
            areaId: "principios",
            title: PRINCIPIO_SEQUENCIA_DECISAO_PAGE.title,
            content: PRINCIPIO_SEQUENCIA_DECISAO_PAGE.content,
            tags: PRINCIPIO_SEQUENCIA_DECISAO_PAGE.tags,
            createdAt: now,
            updatedAt: now,
            versions: [],
          },
          ...pages,
        ];
      }
      localStorage.setItem(PRINCIPIO_SEQUENCIA_DECISAO_FLAG_KEY, "1");
    }
    // Seed Princípio da Coordenação por Especialistas (append-only, safe)
    if (!localStorage.getItem(PRINCIPIO_COORDENACAO_ESPECIALISTAS_FLAG_KEY)) {
      const existingTitles = new Set(
        pages.filter((p) => p.areaId === "principios").map((p) => p.title)
      );
      if (!existingTitles.has(PRINCIPIO_COORDENACAO_ESPECIALISTAS_PAGE.title)) {
        const now = new Date().toISOString();
        pages = [
          {
            id: uid(),
            areaId: "principios",
            title: PRINCIPIO_COORDENACAO_ESPECIALISTAS_PAGE.title,
            content: PRINCIPIO_COORDENACAO_ESPECIALISTAS_PAGE.content,
            tags: PRINCIPIO_COORDENACAO_ESPECIALISTAS_PAGE.tags,
            createdAt: now,
            updatedAt: now,
            versions: [],
          },
          ...pages,
        ];
      }
      localStorage.setItem(PRINCIPIO_COORDENACAO_ESPECIALISTAS_FLAG_KEY, "1");
    }
    // Seed Princípio da Proatividade da IA (append-only, safe)
    if (!localStorage.getItem(PRINCIPIO_PROATIVIDADE_IA_FLAG_KEY)) {
      const existingTitles = new Set(
        pages.filter((p) => p.areaId === "principios").map((p) => p.title)
      );
      if (!existingTitles.has(PRINCIPIO_PROATIVIDADE_IA_PAGE.title)) {
        const now = new Date().toISOString();
        pages = [
          {
            id: uid(),
            areaId: "principios",
            title: PRINCIPIO_PROATIVIDADE_IA_PAGE.title,
            content: PRINCIPIO_PROATIVIDADE_IA_PAGE.content,
            tags: PRINCIPIO_PROATIVIDADE_IA_PAGE.tags,
            createdAt: now,
            updatedAt: now,
            versions: [],
          },
          ...pages,
        ];
      }
      localStorage.setItem(PRINCIPIO_PROATIVIDADE_IA_FLAG_KEY, "1");
    }
    // Seed Princípio da Orientação por Objetivos (append-only, safe)
    if (!localStorage.getItem(PRINCIPIO_ORIENTACAO_OBJETIVOS_FLAG_KEY)) {
      const existingTitles = new Set(
        pages.filter((p) => p.areaId === "principios").map((p) => p.title)
      );
      if (!existingTitles.has(PRINCIPIO_ORIENTACAO_OBJETIVOS_PAGE.title)) {
        const now = new Date().toISOString();
        pages = [
          {
            id: uid(),
            areaId: "principios",
            title: PRINCIPIO_ORIENTACAO_OBJETIVOS_PAGE.title,
            content: PRINCIPIO_ORIENTACAO_OBJETIVOS_PAGE.content,
            tags: PRINCIPIO_ORIENTACAO_OBJETIVOS_PAGE.tags,
            createdAt: now,
            updatedAt: now,
            versions: [],
          },
          ...pages,
        ];
      }
      localStorage.setItem(PRINCIPIO_ORIENTACAO_OBJETIVOS_FLAG_KEY, "1");
    }
    // Seed Princípio do Organismo Único (append-only, safe)
    if (!localStorage.getItem(PRINCIPIO_ORGANISMO_UNICO_FLAG_KEY)) {
      const existingTitles = new Set(
        pages.filter((p) => p.areaId === "principios").map((p) => p.title)
      );
      if (!existingTitles.has(PRINCIPIO_ORGANISMO_UNICO_PAGE.title)) {
        const now = new Date().toISOString();
        pages = [
          {
            id: uid(),
            areaId: "principios",
            title: PRINCIPIO_ORGANISMO_UNICO_PAGE.title,
            content: PRINCIPIO_ORGANISMO_UNICO_PAGE.content,
            tags: PRINCIPIO_ORGANISMO_UNICO_PAGE.tags,
            createdAt: now,
            updatedAt: now,
            versions: [],
          },
          ...pages,
        ];
      }
      localStorage.setItem(PRINCIPIO_ORGANISMO_UNICO_FLAG_KEY, "1");
    }
    // Seed Princípio da Veracidade Operacional da IA (append-only, safe)
    if (!localStorage.getItem(PRINCIPIO_VERACIDADE_OPERACIONAL_FLAG_KEY)) {
      const existingTitles = new Set(
        pages.filter((p) => p.areaId === "principios").map((p) => p.title)
      );
      if (!existingTitles.has(PRINCIPIO_VERACIDADE_OPERACIONAL_PAGE.title)) {
        const now = new Date().toISOString();
        pages = [
          {
            id: uid(),
            areaId: "principios",
            title: PRINCIPIO_VERACIDADE_OPERACIONAL_PAGE.title,
            content: PRINCIPIO_VERACIDADE_OPERACIONAL_PAGE.content,
            tags: PRINCIPIO_VERACIDADE_OPERACIONAL_PAGE.tags,
            createdAt: now,
            updatedAt: now,
            versions: [],
          },
          ...pages,
        ];
      }
      localStorage.setItem(PRINCIPIO_VERACIDADE_OPERACIONAL_FLAG_KEY, "1");
    }
    // Seed Arquitetura dos Especialistas (append-only, safe)
    if (!localStorage.getItem(ARQUITETURA_ESPECIALISTAS_FLAG_KEY)) {
      const existingTitles = new Set(
        pages.filter((p) => p.areaId === "arquitetura").map((p) => p.title)
      );
      if (!existingTitles.has(ARQUITETURA_ESPECIALISTAS_PAGE.title)) {
        const now = new Date().toISOString();
        pages = [
          {
            id: uid(),
            areaId: "arquitetura",
            title: ARQUITETURA_ESPECIALISTAS_PAGE.title,
            content: ARQUITETURA_ESPECIALISTAS_PAGE.content,
            tags: ARQUITETURA_ESPECIALISTAS_PAGE.tags,
            createdAt: now,
            updatedAt: now,
            versions: [],
          },
          ...pages,
        ];
      }
      localStorage.setItem(ARQUITETURA_ESPECIALISTAS_FLAG_KEY, "1");
    }
    // Seed Princípio dos Especialistas (append-only, safe)
    if (!localStorage.getItem(PRINCIPIO_ESPECIALISTAS_FLAG_KEY)) {
      const existingTitles = new Set(
        pages.filter((p) => p.areaId === "principios").map((p) => p.title)
      );
      if (!existingTitles.has(PRINCIPIO_ESPECIALISTAS_PAGE.title)) {
        const now = new Date().toISOString();
        pages = [
          {
            id: uid(),
            areaId: "principios",
            title: PRINCIPIO_ESPECIALISTAS_PAGE.title,
            content: PRINCIPIO_ESPECIALISTAS_PAGE.content,
            tags: PRINCIPIO_ESPECIALISTAS_PAGE.tags,
            createdAt: now,
            updatedAt: now,
            versions: [],
          },
          ...pages,
        ];
      }
      localStorage.setItem(PRINCIPIO_ESPECIALISTAS_FLAG_KEY, "1");
    }
    // Seed Catálogo de Especialistas no Atlas (append-only, safe)
    if (!localStorage.getItem(CATALOGO_ESPECIALISTAS_FLAG_KEY)) {
      const existingTitles = new Set(
        pages.filter((p) => p.areaId === "atlas").map((p) => p.title)
      );
      if (!existingTitles.has(CATALOGO_ESPECIALISTAS_PAGE.title)) {
        const now = new Date().toISOString();
        pages = [
          {
            id: uid(),
            areaId: "atlas",
            title: CATALOGO_ESPECIALISTAS_PAGE.title,
            content: CATALOGO_ESPECIALISTAS_PAGE.content,
            tags: CATALOGO_ESPECIALISTAS_PAGE.tags,
            createdAt: now,
            updatedAt: now,
            versions: [],
          },
          ...pages,
        ];
      }
      localStorage.setItem(CATALOGO_ESPECIALISTAS_FLAG_KEY, "1");
    }
    // Seed atlas do painel central once

    if (!localStorage.getItem(ATLAS_SEED_FLAG_KEY)) {
      const existingTitles = new Set(
        pages.filter((p) => p.areaId === "atlas").map((p) => p.title)
      );
      const now = new Date().toISOString();
      const seeded = ATLAS_SEED.filter(
        (s) => !existingTitles.has(s.title)
      ).map<DocPage>((s) => ({
        id: uid(),
        areaId: "atlas",
        title: s.title,
        content: s.content,
        tags: s.tags,
        createdAt: now,
        updatedAt: now,
        versions: [],
      }));
      pages = [...seeded, ...pages];
      localStorage.setItem(ATLAS_SEED_FLAG_KEY, "1");
    }
    // Seed IA Orquestradora (Cérebro Central) once
    if (!localStorage.getItem(IA_ORQUESTRADORA_SEED_FLAG_KEY)) {
      const existingTitles = new Set(
        pages.filter((p) => p.areaId === "ia-orquestradora").map((p) => p.title)
      );
      const now = new Date().toISOString();
      const seeded = IA_ORQUESTRADORA_SEED.filter(
        (s) => !existingTitles.has(s.title)
      ).map<DocPage>((s) => ({
        id: uid(),
        areaId: "ia-orquestradora",
        title: s.title,
        content: s.content,
        tags: s.tags,
        createdAt: now,
        updatedAt: now,
        versions: [],
      }));
      pages = [...seeded, ...pages];
      localStorage.setItem(IA_ORQUESTRADORA_SEED_FLAG_KEY, "1");
    }
    // Seed IA Orquestradora — Orientação por Objetivos (append-only, safe)
    if (!localStorage.getItem(IA_ORQUESTRADORA_ORIENTACAO_FLAG_KEY)) {
      const existingTitles = new Set(
        pages.filter((p) => p.areaId === "ia-orquestradora").map((p) => p.title)
      );
      if (!existingTitles.has(IA_ORQUESTRADORA_ORIENTACAO_PAGE.title)) {
        const now = new Date().toISOString();
        pages = [
          {
            id: uid(),
            areaId: "ia-orquestradora",
            title: IA_ORQUESTRADORA_ORIENTACAO_PAGE.title,
            content: IA_ORQUESTRADORA_ORIENTACAO_PAGE.content,
            tags: IA_ORQUESTRADORA_ORIENTACAO_PAGE.tags,
            createdAt: now,
            updatedAt: now,
            versions: [],
          },
          ...pages,
        ];
      }
      localStorage.setItem(IA_ORQUESTRADORA_ORIENTACAO_FLAG_KEY, "1");
    }
    // Seed evolução once
    if (!localStorage.getItem(EVOLUCAO_SEED_FLAG_KEY)) {
      const existingTitles = new Set(
        pages.filter((p) => p.areaId === "evolucao").map((p) => p.title)
      );
      const now = new Date().toISOString();
      const seeded = EVOLUCAO_SEED.filter(
        (s) => !existingTitles.has(s.title)
      ).map<DocPage>((s) => ({
        id: uid(),
        areaId: "evolucao",
        title: s.title,
        content: s.content,
        tags: s.tags,
        createdAt: now,
        updatedAt: now,
        versions: [],
      }));
      pages = [...seeded, ...pages];
      localStorage.setItem(EVOLUCAO_SEED_FLAG_KEY, "1");
    }
    // Seed estado atual do sistema once
    if (!localStorage.getItem(ESTADO_ATUAL_SEED_FLAG_KEY)) {
      const existingTitles = new Set(
        pages.filter((p) => p.areaId === "estado-atual").map((p) => p.title)
      );
      const now = new Date().toISOString();
      const seeded = ESTADO_ATUAL_TITLES.filter(
        (s) => !existingTitles.has(s.title)
      ).map<DocPage>((s) => ({
        id: uid(),
        areaId: "estado-atual",
        title: s.title,
        content: "",
        tags: s.tags,
        createdAt: now,
        updatedAt: now,
        versions: [],
      }));
      pages = [...pages, ...seeded];
      localStorage.setItem(ESTADO_ATUAL_SEED_FLAG_KEY, "1");
    }
    // Seed indicadores arquiteturais do estado atual (append-only, safe)
    if (!localStorage.getItem(ESTADO_ATUAL_INDICADORES_FLAG_KEY)) {
      const existingTitles = new Set(
        pages.filter((p) => p.areaId === "estado-atual").map((p) => p.title)
      );
      const now = new Date().toISOString();
      const seeded = ESTADO_ATUAL_INDICADORES.filter(
        (s) => !existingTitles.has(s.title)
      ).map<DocPage>((s) => ({
        id: uid(),
        areaId: "estado-atual",
        title: s.title,
        content: s.content,
        tags: s.tags,
        createdAt: now,
        updatedAt: now,
        versions: [],
      }));
      pages = [...pages, ...seeded];
      localStorage.setItem(ESTADO_ATUAL_INDICADORES_FLAG_KEY, "1");
    }
    // Fill "Mapa Geral do Sistema" content once (safe: only if page is empty)
    if (!localStorage.getItem(MAPA_GERAL_FILL_FLAG)) {
      const now = new Date().toISOString();
      let mapaExists = false;
      pages = pages.map((p) => {
        if (p.areaId === "estado-atual" && p.title === "Mapa Geral do Sistema") {
          mapaExists = true;
          if (!p.content || p.content.trim() === "") {
            return { ...p, content: MAPA_GERAL_CONTENT, updatedAt: now };
          }
        }
        return p;
      });
      if (!mapaExists) {
        pages = [
          ...pages,
          {
            id: uid(),
            areaId: "estado-atual",
            title: "Mapa Geral do Sistema",
            content: MAPA_GERAL_CONTENT,
            tags: ["mapa", "visão-geral"],
            createdAt: now,
            updatedAt: now,
            versions: [],
          },
        ];
      }
      localStorage.setItem(MAPA_GERAL_FILL_FLAG, "1");
    }
    // Fill "Arquitetura Atual" content once (safe: only if page is empty)
    if (!localStorage.getItem(ARQUITETURA_ATUAL_FILL_FLAG)) {
      const now = new Date().toISOString();
      let exists = false;
      pages = pages.map((p) => {
        if (p.areaId === "estado-atual" && p.title === "Arquitetura Atual") {
          exists = true;
          if (!p.content || p.content.trim() === "") {
            return { ...p, content: ARQUITETURA_ATUAL_CONTENT, updatedAt: now };
          }
        }
        return p;
      });
      if (!exists) {
        pages = [
          ...pages,
          {
            id: uid(),
            areaId: "estado-atual",
            title: "Arquitetura Atual",
            content: ARQUITETURA_ATUAL_CONTENT,
            tags: ["arquitetura", "atual"],
            createdAt: now,
            updatedAt: now,
            versions: [],
          },
        ];
      }
      localStorage.setItem(ARQUITETURA_ATUAL_FILL_FLAG, "1");
    }
    // Fill "Banco de Dados" content once (safe: only if page is empty)
    if (!localStorage.getItem(BANCO_DE_DADOS_FILL_FLAG)) {
      const now = new Date().toISOString();
      let exists = false;
      pages = pages.map((p) => {
        if (p.areaId === "estado-atual" && p.title === "Banco de Dados") {
          exists = true;
          if (!p.content || p.content.trim() === "") {
            return { ...p, content: BANCO_DE_DADOS_CONTENT, updatedAt: now };
          }
        }
        return p;
      });
      if (!exists) {
        pages = [
          ...pages,
          {
            id: uid(),
            areaId: "estado-atual",
            title: "Banco de Dados",
            content: BANCO_DE_DADOS_CONTENT,
            tags: ["banco", "dados", "schema"],
            createdAt: now,
            updatedAt: now,
            versions: [],
          },
        ];
      }
      localStorage.setItem(BANCO_DE_DADOS_FILL_FLAG, "1");
    }
    // Fill "Integrações" content once (safe: only if page is empty)
    if (!localStorage.getItem(INTEGRACOES_FILL_FLAG)) {
      const now = new Date().toISOString();
      let exists = false;
      pages = pages.map((p) => {
        if (p.areaId === "estado-atual" && p.title === "Integrações") {
          exists = true;
          if (!p.content || p.content.trim() === "") {
            return { ...p, content: INTEGRACOES_CONTENT, updatedAt: now };
          }
        }
        return p;
      });
      if (!exists) {
        pages = [
          ...pages,
          {
            id: uid(),
            areaId: "estado-atual",
            title: "Integrações",
            content: INTEGRACOES_CONTENT,
            tags: ["integrações", "apis", "serviços"],
            createdAt: now,
            updatedAt: now,
            versions: [],
          },
        ];
      }
      localStorage.setItem(INTEGRACOES_FILL_FLAG, "1");
    }
    // Fill "Agentes de IA" content once (safe: only if page is empty)
    if (!localStorage.getItem(AGENTES_IA_FILL_FLAG)) {
      const now = new Date().toISOString();
      let exists = false;
      pages = pages.map((p) => {
        if (p.areaId === "estado-atual" && p.title === "Agentes de IA") {
          exists = true;
          if (!p.content || p.content.trim() === "") {
            return { ...p, content: AGENTES_IA_CONTENT, updatedAt: now };
          }
        }
        return p;
      });
      if (!exists) {
        pages = [
          ...pages,
          {
            id: uid(),
            areaId: "estado-atual",
            title: "Agentes de IA",
            content: AGENTES_IA_CONTENT,
            tags: ["ia", "agentes", "edge-functions"],
            createdAt: now,
            updatedAt: now,
            versions: [],
          },
        ];
      }
      localStorage.setItem(AGENTES_IA_FILL_FLAG, "1");
    }
    // Fill "Fluxos do Sistema" content once (safe: only if page is empty)
    if (!localStorage.getItem(FLUXOS_SISTEMA_FILL_FLAG)) {
      const now = new Date().toISOString();
      let exists = false;
      pages = pages.map((p) => {
        if (p.areaId === "estado-atual" && p.title === "Fluxos do Sistema") {
          exists = true;
          if (!p.content || p.content.trim() === "") {
            return { ...p, content: FLUXOS_SISTEMA_CONTENT, updatedAt: now };
          }
        }
        return p;
      });
      if (!exists) {
        pages = [
          ...pages,
          {
            id: uid(),
            areaId: "estado-atual",
            title: "Fluxos do Sistema",
            content: FLUXOS_SISTEMA_CONTENT,
            tags: ["fluxos", "processos", "operação"],
            createdAt: now,
            updatedAt: now,
            versions: [],
          },
        ];
      }
      localStorage.setItem(FLUXOS_SISTEMA_FILL_FLAG, "1");
    }
    // Fill "Funcionalidades Implementadas" content once (safe: only if page is empty)
    if (!localStorage.getItem(FUNCIONALIDADES_IMPLEMENTADAS_FILL_FLAG)) {
      const now = new Date().toISOString();
      let exists = false;
      pages = pages.map((p) => {
        if (p.areaId === "estado-atual" && p.title === "Funcionalidades Implementadas") {
          exists = true;
          if (!p.content || p.content.trim() === "") {
            return { ...p, content: FUNCIONALIDADES_IMPLEMENTADAS_CONTENT, updatedAt: now };
          }
        }
        return p;
      });
      if (!exists) {
        pages = [
          ...pages,
          {
            id: uid(),
            areaId: "estado-atual",
            title: "Funcionalidades Implementadas",
            content: FUNCIONALIDADES_IMPLEMENTADAS_CONTENT,
            tags: ["funcionalidades", "features", "inventário"],
            createdAt: now,
            updatedAt: now,
            versions: [],
          },
        ];
      }
      localStorage.setItem(FUNCIONALIDADES_IMPLEMENTADAS_FILL_FLAG, "1");
    }
    // Generic filler for remaining Estado Atual pages
    const REMAINING_FILLS: Array<{ flag: string; title: string; content: string; tags: string[] }> = [
      {
        flag: FUNCIONALIDADES_INCOMPLETAS_FILL_FLAG,
        title: "Funcionalidades Incompletas",
        content: FUNCIONALIDADES_INCOMPLETAS_CONTENT,
        tags: ["incompletas", "parcial", "pendentes"],
      },
      {
        flag: PONTOS_FORTES_FILL_FLAG,
        title: "Pontos Fortes",
        content: PONTOS_FORTES_CONTENT,
        tags: ["pontos-fortes", "estratégia"],
      },
      {
        flag: PONTOS_MELHORIA_FILL_FLAG,
        title: "Pontos de Melhoria",
        content: PONTOS_MELHORIA_CONTENT,
        tags: ["melhoria", "oportunidades"],
      },
      {
        flag: DIVIDA_TECNICA_FILL_FLAG,
        title: "Dívida Técnica",
        content: DIVIDA_TECNICA_CONTENT,
        tags: ["dívida-técnica", "engenharia"],
      },
      {
        flag: RESUMO_EXECUTIVO_FILL_FLAG,
        title: "Resumo Executivo",
        content: RESUMO_EXECUTIVO_CONTENT,
        tags: ["resumo", "executivo", "visão-geral"],
      },
    ];
    for (const entry of REMAINING_FILLS) {
      if (localStorage.getItem(entry.flag)) continue;
      const now = new Date().toISOString();
      let exists = false;
      pages = pages.map((p) => {
        if (p.areaId === "estado-atual" && p.title === entry.title) {
          exists = true;
          if (!p.content || p.content.trim() === "") {
            return { ...p, content: entry.content, updatedAt: now };
          }
        }
        return p;
      });
      if (!exists) {
        pages = [
          ...pages,
          {
            id: uid(),
            areaId: "estado-atual",
            title: entry.title,
            content: entry.content,
            tags: entry.tags,
            createdAt: now,
            updatedAt: now,
            versions: [],
          },
        ];
      }
      localStorage.setItem(entry.flag, "1");
    }





    // Seed Camada Executor (append-only, safe)
    if (!localStorage.getItem(ARQUITETURA_EXECUTOR_FLAG_KEY)) {
      const existingTitles = new Set(
        pages.filter((p) => p.areaId === "arquitetura").map((p) => p.title)
      );
      if (!existingTitles.has(ARQUITETURA_EXECUTOR_PAGE.title)) {
        const now = new Date().toISOString();
        pages = [
          {
            id: uid(),
            areaId: "arquitetura",
            title: ARQUITETURA_EXECUTOR_PAGE.title,
            content: ARQUITETURA_EXECUTOR_PAGE.content,
            tags: ARQUITETURA_EXECUTOR_PAGE.tags,
            createdAt: now,
            updatedAt: now,
            versions: [],
          },
          ...pages,
        ];
      }
      localStorage.setItem(ARQUITETURA_EXECUTOR_FLAG_KEY, "1");
    }
    // Seed Contrato Oficial do Especialista (append-only, safe)
    if (!localStorage.getItem(CONTRATO_ESPECIALISTA_FLAG_KEY)) {
      const existingTitles = new Set(
        pages.filter((p) => p.areaId === "arquitetura").map((p) => p.title)
      );
      if (!existingTitles.has(CONTRATO_ESPECIALISTA_PAGE.title)) {
        const now = new Date().toISOString();
        pages = [
          {
            id: uid(),
            areaId: "arquitetura",
            title: CONTRATO_ESPECIALISTA_PAGE.title,
            content: CONTRATO_ESPECIALISTA_PAGE.content,
            tags: CONTRATO_ESPECIALISTA_PAGE.tags,
            createdAt: now,
            updatedAt: now,
            versions: [],
          },
          ...pages,
        ];
      }
      localStorage.setItem(CONTRATO_ESPECIALISTA_FLAG_KEY, "1");
    }
    // Seed Modelo Oficial de Criação de Especialistas (append-only, safe)
    if (!localStorage.getItem(MODELO_CRIACAO_ESPECIALISTA_FLAG_KEY)) {
      const existingTitles = new Set(
        pages.filter((p) => p.areaId === "arquitetura").map((p) => p.title)
      );
      if (!existingTitles.has(MODELO_CRIACAO_ESPECIALISTA_PAGE.title)) {
        const now = new Date().toISOString();
        pages = [
          {
            id: uid(),
            areaId: "arquitetura",
            title: MODELO_CRIACAO_ESPECIALISTA_PAGE.title,
            content: MODELO_CRIACAO_ESPECIALISTA_PAGE.content,
            tags: MODELO_CRIACAO_ESPECIALISTA_PAGE.tags,
            createdAt: now,
            updatedAt: now,
            versions: [],
          },
          ...pages,
        ];
      }
      localStorage.setItem(MODELO_CRIACAO_ESPECIALISTA_FLAG_KEY, "1");
    }
    // Seed Princípio da Separação entre Inteligência, Regra e Execução (append-only, safe)
    if (!localStorage.getItem(PRINCIPIO_SEPARACAO_FLAG_KEY)) {
      const existingTitles = new Set(
        pages.filter((p) => p.areaId === "principios").map((p) => p.title)
      );
      if (!existingTitles.has(PRINCIPIO_SEPARACAO_PAGE.title)) {
        const now = new Date().toISOString();
        pages = [
          {
            id: uid(),
            areaId: "principios",
            title: PRINCIPIO_SEPARACAO_PAGE.title,
            content: PRINCIPIO_SEPARACAO_PAGE.content,
            tags: PRINCIPIO_SEPARACAO_PAGE.tags,
            createdAt: now,
            updatedAt: now,
            versions: [],
          },
          ...pages,
        ];
      }
      localStorage.setItem(PRINCIPIO_SEPARACAO_FLAG_KEY, "1");
    }
    // Seed Princípio Mestre once (independent flag so existing installs also receive it)
    const PRINCIPIO_FLAG = "nucleo_principio_mestre_seed_v1";
    if (!localStorage.getItem(PRINCIPIO_FLAG)) {
      const title = "Princípio Mestre do Painel Central";
      const already = pages.some(
        (p) => p.areaId === "biblioteca" && p.title === title
      );
      if (!already) {
        const seedDef = BIBLIOTECA_SEED.find((s) => s.title === title);
        if (seedDef) {
          const now = new Date().toISOString();
          pages = [
            {
              id: uid(),
              areaId: "biblioteca",
              title: seedDef.title,
              content: seedDef.content,
              tags: seedDef.tags,
              createdAt: now,
              updatedAt: now,
              versions: [],
            },
            ...pages,
          ];
        }
      }
      localStorage.setItem(PRINCIPIO_FLAG, "1");
    }
    return pages;
  } catch {
    return [];
  }
}

function savePages(pages: DocPage[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pages));
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function formatDateTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

// ---------- Component ----------

export default function Nucleo() {
  const [pages, setPages] = useState<DocPage[]>(loadPages);
  const [activeArea, setActiveArea] = useState<AreaId>("biblioteca");
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    savePages(pages);
  }, [pages]);

  const activeAreaMeta = AREAS.find((a) => a.id === activeArea)!;

  const areaPages = useMemo(
    () =>
      pages
        .filter((p) => p.areaId === activeArea)
        .filter((p) =>
          search.trim()
            ? (p.title + " " + p.content + " " + p.tags.join(" "))
                .toLowerCase()
                .includes(search.toLowerCase())
            : true
        )
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        ),
    [pages, activeArea, search]
  );

  const activePage = pages.find((p) => p.id === activePageId) || null;

  const countByArea = useMemo(() => {
    const m = new Map<AreaId, number>();
    pages.forEach((p) => m.set(p.areaId, (m.get(p.areaId) || 0) + 1));
    return m;
  }, [pages]);

  const createPage = () => {
    const now = new Date().toISOString();
    const page: DocPage = {
      id: uid(),
      areaId: activeArea,
      title: "Nova página",
      content: "",
      tags: [],
      createdAt: now,
      updatedAt: now,
      versions: [],
    };
    setPages((prev) => [page, ...prev]);
    setActivePageId(page.id);
    toast.success("Página criada");
  };

  const updatePage = (id: string, patch: Partial<DocPage>) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p
      )
    );
  };

  const deletePage = (id: string) => {
    setPages((prev) => prev.filter((p) => p.id !== id));
    if (activePageId === id) setActivePageId(null);
    toast.success("Página excluída");
  };

  const saveVersion = (id: string, label?: string) => {
    setPages((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const version: PageVersion = {
          id: uid(),
          title: p.title,
          content: p.content,
          createdAt: new Date().toISOString(),
          label,
        };
        return { ...p, versions: [version, ...p.versions] };
      })
    );
    toast.success("Versão salva");
  };

  const restoreVersion = (id: string, versionId: string) => {
    setPages((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const v = p.versions.find((x) => x.id === versionId);
        if (!v) return p;
        // Snapshot current before restoring
        const snapshot: PageVersion = {
          id: uid(),
          title: p.title,
          content: p.content,
          createdAt: new Date().toISOString(),
          label: "auto — antes de restaurar",
        };
        return {
          ...p,
          title: v.title,
          content: v.content,
          updatedAt: new Date().toISOString(),
          versions: [snapshot, ...p.versions],
        };
      })
    );
    toast.success("Versão restaurada");
  };

  const deleteVersion = (id: string, versionId: string) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, versions: p.versions.filter((v) => v.id !== versionId) }
          : p
      )
    );
  };

  const selectArea = (id: AreaId) => {
    setActiveArea(id);
    setActivePageId(null);
    setSearch("");
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header
        className="sticky top-0 z-30 bg-background/85 backdrop-blur border-b border-border"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold truncate">
                Núcleo do Painel Central
              </h1>
              <Badge variant="secondary" className="text-[10px]">
                Área administrativa
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              Base estratégica e documental do sistema
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-5 space-y-5">
        {/* Areas grid */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {AREAS.map((a) => {
            const Icon = a.icon;
            const isActive = a.id === activeArea;
            const count = countByArea.get(a.id) || 0;
            return (
              <button
                key={a.id}
                onClick={() => selectArea(a.id)}
                className={cn(
                  "text-left rounded-xl border p-3 transition-all bg-card hover:border-primary/40 hover:shadow-sm",
                  isActive
                    ? "border-primary/60 shadow-sm ring-1 ring-primary/20"
                    : "border-border"
                )}
              >
                <div className="flex items-start gap-2">
                  <div
                    className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: a.color + "1F",
                      color: a.color,
                    }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-semibold truncate">
                        {a.title}
                      </h3>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-snug mt-0.5">
                      {a.description}
                    </p>
                    <div className="mt-2">
                      <Badge variant="outline" className="text-[10px]">
                        {count} {count === 1 ? "página" : "páginas"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Workspace */}
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          {/* Pages list */}
          <Card className="p-3 flex flex-col min-h-[420px]">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="h-8 w-8 rounded-md flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: activeAreaMeta.color + "1F",
                  color: activeAreaMeta.color,
                }}
              >
                <activeAreaMeta.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold truncate">
                  {activeAreaMeta.title}
                </h2>
                <p className="text-[11px] text-muted-foreground truncate">
                  {areaPages.length} {areaPages.length === 1 ? "página" : "páginas"}
                </p>
              </div>
              <Button size="sm" onClick={createPage} className="gap-1">
                <Plus className="h-4 w-4" />
                Nova
              </Button>
            </div>

            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="pl-8 h-8 text-sm"
              />
            </div>

            <ScrollArea className="flex-1 -mx-1">
              <div className="px-1 space-y-1">
                {areaPages.length === 0 && (
                  <div className="text-center py-10 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-xs">Nenhuma página ainda</p>
                    <p className="text-[11px] opacity-70">
                      Clique em "Nova" para começar
                    </p>
                  </div>
                )}
                {areaPages.map((p) => {
                  const isActive = p.id === activePageId;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setActivePageId(p.id)}
                      className={cn(
                        "w-full text-left rounded-lg border px-3 py-2 transition-colors group",
                        isActive
                          ? "border-primary/50 bg-accent"
                          : "border-transparent hover:bg-accent/60"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <FileText className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {p.title || "Sem título"}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {formatDate(p.updatedAt)}
                            {p.versions.length > 0 &&
                              ` · v${p.versions.length}`}
                            {p.tags.length > 0 &&
                              ` · ${p.tags.slice(0, 2).join(", ")}`}
                          </p>
                        </div>
                        <ChevronRight
                          className={cn(
                            "h-3.5 w-3.5 text-muted-foreground transition-opacity",
                            isActive ? "opacity-100" : "opacity-0 group-hover:opacity-60"
                          )}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </Card>

          {/* Editor */}
          <Card className="p-4 min-h-[420px]">
            {!activePage ? (
              <div className="h-full min-h-[380px] flex flex-col items-center justify-center text-center">
                <div
                  className="h-14 w-14 rounded-2xl flex items-center justify-center mb-3"
                  style={{
                    backgroundColor: activeAreaMeta.color + "1F",
                    color: activeAreaMeta.color,
                  }}
                >
                  <activeAreaMeta.icon className="h-7 w-7" />
                </div>
                <h3 className="text-base font-semibold">
                  {activeAreaMeta.title}
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mt-1">
                  {activeAreaMeta.description}
                </p>
                <Button
                  className="mt-4 gap-1.5"
                  onClick={createPage}
                >
                  <Plus className="h-4 w-4" />
                  Criar primeira página
                </Button>
              </div>
            ) : (
              <PageEditor
                key={activePage.id}
                page={activePage}
                onChange={(patch) => updatePage(activePage.id, patch)}
                onDelete={() => deletePage(activePage.id)}
                onSaveVersion={(label) => saveVersion(activePage.id, label)}
                onRestoreVersion={(vid) => restoreVersion(activePage.id, vid)}
                onDeleteVersion={(vid) => deleteVersion(activePage.id, vid)}
                areaColor={activeAreaMeta.color}
              />
            )}
          </Card>
        </div>

        <p className="text-[11px] text-muted-foreground text-center pt-1">
          Estrutura preparada para crescimento — sem integrações ativas com
          outros módulos.
        </p>
      </main>
    </div>
  );
}

// ---------- Page Editor ----------

interface PageEditorProps {
  page: DocPage;
  onChange: (patch: Partial<DocPage>) => void;
  onDelete: () => void;
  onSaveVersion: (label?: string) => void;
  onRestoreVersion: (versionId: string) => void;
  onDeleteVersion: (versionId: string) => void;
  areaColor: string;
}

function PageEditor({
  page,
  onChange,
  onDelete,
  onSaveVersion,
  onRestoreVersion,
  onDeleteVersion,
  areaColor,
}: PageEditorProps) {
  const [tagInput, setTagInput] = useState("");
  const [versionLabel, setVersionLabel] = useState("");

  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    if (page.tags.includes(t)) {
      setTagInput("");
      return;
    }
    onChange({ tags: [...page.tags, t] });
    setTagInput("");
  };

  const removeTag = (t: string) => {
    onChange({ tags: page.tags.filter((x) => x !== t) });
  };

  const handleSaveVersion = () => {
    onSaveVersion(versionLabel.trim() || undefined);
    setVersionLabel("");
  };

  return (
    <div className="flex flex-col h-full min-h-[380px]">
      <div className="flex items-center gap-2 mb-3">
        <Input
          value={page.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Título da página"
          className="text-base font-semibold border-0 shadow-none px-0 h-auto py-1 focus-visible:ring-0"
        />

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1 shrink-0">
              <History className="h-4 w-4" />
              <span className="text-xs">
                {page.versions.length > 0
                  ? `${page.versions.length} versões`
                  : "Versões"}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3" align="end">
            <div className="space-y-2">
              <div>
                <p className="text-sm font-semibold">Salvar versão</p>
                <p className="text-[11px] text-muted-foreground">
                  Cria um snapshot do conteúdo atual.
                </p>
              </div>
              <div className="flex gap-1.5">
                <Input
                  value={versionLabel}
                  onChange={(e) => setVersionLabel(e.target.value)}
                  placeholder="Rótulo (opcional)"
                  className="h-8 text-xs"
                />
                <Button size="sm" onClick={handleSaveVersion} className="gap-1">
                  <Save className="h-3.5 w-3.5" />
                  Salvar
                </Button>
              </div>

              <div className="pt-2 border-t">
                <p className="text-xs font-semibold mb-1.5">Histórico</p>
                {page.versions.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground py-3 text-center">
                    Nenhuma versão salva ainda.
                  </p>
                ) : (
                  <ScrollArea className="max-h-64 -mx-1">
                    <div className="px-1 space-y-1">
                      {page.versions.map((v, idx) => (
                        <div
                          key={v.id}
                          className="rounded border border-border p-2 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">
                                v{page.versions.length - idx}
                                {v.label ? ` — ${v.label}` : ""}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {formatDateTime(v.createdAt)}
                              </p>
                            </div>
                            <div className="flex gap-0.5 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                title="Restaurar"
                                onClick={() => onRestoreVersion(v.id)}
                              >
                                <RotateCcw className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive hover:text-destructive"
                                title="Excluir versão"
                                onClick={() => onDeleteVersion(v.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                            {v.content.slice(0, 120) || "(vazio)"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="text-destructive hover:text-destructive shrink-0"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-3">
        <span>Criada em {formatDate(page.createdAt)}</span>
        <span>·</span>
        <span>Atualizada em {formatDate(page.updatedAt)}</span>
        {page.versions.length > 0 && (
          <>
            <span>·</span>
            <span>{page.versions.length} versões</span>
          </>
        )}
      </div>

      {/* Tags */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {page.tags.map((t) => (
          <Badge
            key={t}
            variant="secondary"
            className="text-[10px] gap-1 cursor-pointer"
            onClick={() => removeTag(t)}
          >
            {t}
            <span className="opacity-60">×</span>
          </Badge>
        ))}
        <div className="flex items-center gap-1">
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="+ tag"
            className="h-6 w-24 text-[11px] px-2"
          />
        </div>
      </div>

      <div
        className="h-0.5 w-12 rounded-full mb-3"
        style={{ backgroundColor: areaColor }}
      />

      <Textarea
        value={page.content}
        onChange={(e) => onChange({ content: e.target.value })}
        placeholder="Escreva o conteúdo desta página..."
        className="flex-1 min-h-[280px] resize-none text-sm leading-relaxed"
      />

      <div className="flex items-center justify-between mt-3 text-[11px] text-muted-foreground">
        <span>{page.content.length} caracteres</span>
        <span className="flex items-center gap-1">
          <Save className="h-3 w-3" />
          Salvamento automático
        </span>
      </div>
    </div>
  );
}
