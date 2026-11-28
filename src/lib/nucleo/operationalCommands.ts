export interface OperationalCommand { id: string; code: string; catalogState: 'active' | 'pending' | 'candidate'; evidence: string; authority: 'approved' | 'model' | 'pending'; name: string; category: string; purpose: string; when: string; version: string; source: string; body: string | null }

export const operationalCommands: readonly OperationalCommand[] = [
  {
    "id": "C01",
    "catalogState": "active",
    "evidence": "Uso recorrente pelo proprietário; texto literal aprovado no Comando Mestre NUC-BIB01.",
    "code": "MAP1",
    "authority": "approved",
    "name": "Continuar pelo mapa",
    "category": "Continuidade",
    "purpose": "Avançar a partir do último checkpoint.",
    "when": "Quando existir uma próxima etapa autorizada.",
    "version": "Texto aprovado em 27/11/2026",
    "source": "Comando Mestre NUC-BIB01, seção 5",
    "body": "CONTINUE PELO MAPA — Execute a próxima etapa autorizada, por diferença, sem reconstruir o que já foi concluído. Preserve os contratos e o escopo; desenvolva, teste, comprove, registre e avance enquanto houver atividades liberadas."
  },
  {
    "id": "C02",
    "catalogState": "pending",
    "evidence": "Fonte integral original não localizada; não executar nem copiar.",
    "code": "MAP2",
    "authority": "pending",
    "name": "Continuidade universal — versão completa",
    "category": "Continuidade",
    "purpose": "Aplicar a diretriz integral de continuidade executiva.",
    "when": "Quando for necessária a orientação completa.",
    "version": "Não confirmada",
    "source": "Texto original ainda não recuperado",
    "body": null
  },
  {
    "id": "C03",
    "catalogState": "active",
    "evidence": "Patrimônio U06 e contraprova de resolução independente ASS1/SAU, Issue #1037 comentário 7230447309; assunção integral pendente.",
    "code": "ASS1",
    "authority": "model",
    "name": "Assunção de novo especialista",
    "category": "Assunção",
    "purpose": "Recuperar o patrimônio de uma especialidade.",
    "when": "Ao iniciar uma nova conversa.",
    "version": "Modelo V1.1 — não homologado",
    "source": "Protocolo U06 + NUC-BIB01 + contraprova #1037/7230447309",
    "body": "Assuma a especialidade [ESPECIALIDADE] do Painel Central pelo Núcleo U06. Recupere a identidade, mapas, métodos, ecossistema, fichas FM, contribuições AC-01, contexto AC-02 disponível, checkpoints, frente vigente e próxima ação. Reconcilie GitHub e Core, preservando autoridades e versões; declare lacunas e limites da prova. Utilize Chat normal e conectores oficiais, sem Work obrigatório. Não crie identidade Supabase, usuário, mandato ou concessão por conversa. Não grave durante a assunção. Apresente evidências e a próxima ação sustentada.\n\nDescubra as operações disponíveis dos conectores oficiais GitHub e Lovable; procure especificamente query_database no Lovable antes de declarar indisponibilidade. Confira o projeto 1720a410-34cd-4410-995c-8c92c7edf16b e a identidade conectada e autorização administrativa demonstradas. Recupere na main docs/architecture/u06/ASSUMPTION_PROJECTION_V1_PROTOCOL.md e ASSUMPTION_PROJECTION_V1_READONLY.sql no mesmo diretório. Siga o protocolo aprovado: somente SELECT canônico, seleção restrita aos códigos autorizados no recorte vigente, sem interpolar texto livre, sem alterações ou concessões. Confira raiz única, código, cobertura FM-03/08/09/10, conflitos, ausências e truncamento; reconcilie as fontes GitHub e Core e explicite access_mode e authority. Não confunda consulta administrativa com AC-02 autenticado por JWT. Se a operação, identidade ou autorização não puder ser confirmada, registre precisamente o impedimento e a assunção parcial, sem inventar dados ou usar memória como prova. Para especialidades fora do recorte, respeite o contrato posterior oficialmente aprovado, se existente; não amplie o piloto por inferência."
  },
  {
    "id": "C04",
    "catalogState": "active",
    "evidence": "Patrimônio de checkpoint M3: docs/architecture/u06/U06_F_A07_CONTRATO_TRANSVERSAL_CANDIDATO_V1.md, A07.3; modelo, não autorização de escrita.",
    "code": "CHK1",
    "authority": "model",
    "name": "Registrar checkpoint",
    "category": "Documentação",
    "purpose": "Preservar estado, evidências e continuidade.",
    "when": "Após entrega, teste ou integração.",
    "version": "Modelo V1.0 — não homologado",
    "source": "Comando Mestre NUC-BIB01 + protocolo U06",
    "body": "Registre o checkpoint da especialidade [ESPECIALIDADE], mapa e frente. Identifique estado anterior e posterior, trabalho executado, evidências, PRs, commits, testes, publicação quando comprovada, pendências, próxima ação, autorizações e restrições. Use o mecanismo competente com autoria e autorização aplicáveis; não substitua autoria por SQL administrativo avulso. Preserve histórico e confirme por readback antes de declarar gravação. Diferencie código, merge, publicação e homologação."
  },
  {
    "id": "C05",
    "catalogState": "candidate",
    "evidence": "Patrimônio FM/AC01 existe, mas uso deste comando combinado e distinção prática frente a CHK1 ainda não demonstrados.",
    "code": "MET1",
    "authority": "model",
    "name": "Registrar método, ecossistema e aprendizagem",
    "category": "Documentação",
    "purpose": "Preservar e evoluir conhecimento operacional.",
    "when": "Após melhoria metodológica ou aprendizado comprovado.",
    "version": "Modelo V1.0 — não homologado",
    "source": "Comando Mestre NUC-BIB01 + protocolo U06",
    "body": "Recupere os documentos vigentes da especialidade [ESPECIALIDADE]. Compare versões e identifique somente o delta real, com fontes, autoridade e evidência. Preserve método e ecossistema como conceitos distintos; evite duplicações e mantenha o histórico. Prepare a revisão documental mínima e registre pelo fluxo AC-01/FM competente, quando autorizado, com autoria e readback. Não promova rascunho automaticamente a documento homologado. Se não houver melhoria justificada, mantenha o método vigente."
  }
];

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function filterOperationalCommands(query: string, category: string) {
  const term = normalize(query.trim());
  return operationalCommands.filter(entry => (category === 'Todos' || entry.category === category) && normalize([entry.id, entry.code, entry.name, entry.purpose, entry.when, entry.body ?? ''].join(' ')).includes(term));
}

// Stable code, independent of text revision. No fuzzy execution resolution.
export function resolveOperationalCommand(code: string) {
  const matches = operationalCommands.filter(entry => entry.code === code.trim().toUpperCase());
  return matches.length === 1 ? matches[0] : undefined;
}
export function operationalCommandInvocation(code: string) {
  return "EXECUTE CÓDIGO " + code + " DO NÚCLEO COMANDOS";
}

// Catalog visibility does not grant operational authority.
export function isOperationalCommandAvailable(entry: OperationalCommand) {
  return entry.catalogState === 'active' && entry.authority !== 'pending' && entry.body !== null;
}
