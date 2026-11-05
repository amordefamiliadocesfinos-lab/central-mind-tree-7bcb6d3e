import { getCrmSocialEventReviewHint, getCrmSocialContextReviewHint } from './socialEventReview';

function check(value: unknown, message: string) {
  if (!value) throw new Error('CRM F3 evento social: ' + message);
}
check(getCrmSocialEventReviewHint({ direction: 'inbound', message_type: 'sticker' })?.includes('figurinha'), 'figurinha inbound deve orientar revisão');
check(getCrmSocialEventReviewHint({ direction: 'inbound', message_type: 'reaction' })?.includes('reação'), 'reação inbound deve orientar revisão');
check(getCrmSocialEventReviewHint({ direction: 'inbound', message_type: 'text' }) === null, 'texto não recebe aviso social');
check(getCrmSocialEventReviewHint({ direction: 'outbound', message_type: 'sticker' }) === null, 'figurinha enviada não altera aviso');
check(getCrmSocialEventReviewHint(null) === null, 'sem evento não inventar alerta');

check(getCrmSocialContextReviewHint([
  {direction:'inbound',message_type:'sticker'},
  {direction:'inbound',message_type:'text'},
  {direction:'outbound',message_type:'text'},
])?.includes('mensagem anterior de outro tipo'), 'figurinha após texto inbound não é somente social');
check(getCrmSocialContextReviewHint([
  {direction:'inbound',message_type:'reaction'},
  {direction:'inbound',message_type:'sticker'},
  {direction:'outbound',message_type:'text'},
])?.includes('mensagens recebidas examinadas'), 'apenas sociais orienta revisão sem concluir');
check(getCrmSocialContextReviewHint([
  {direction:'inbound',message_type:'reaction'},
  {direction:'outbound',message_type:'text'},
  {direction:'inbound',message_type:'text'},
])?.includes('mensagens recebidas examinadas'), 'texto antes de nosso outbound não pertence à pendência atual');
check(getCrmSocialContextReviewHint([
  {direction:'inbound',message_type:'text'},
  {direction:'inbound',message_type:'sticker'},
]) === null, 'texto mais recente não é aviso social');
check(getCrmSocialContextReviewHint([]) === null, 'sem mensagem não cria pendência');

check(getCrmSocialContextReviewHint([{direction:'inbound',message_type:'unsupported'}])?.includes('canal oficial'),
  'entrada não suportada exige inspeção do canal, sem inferir resposta');
check(getCrmSocialContextReviewHint([{direction:'inbound',message_type:'system'}])?.includes('prioridade continua ativa'),
  'evento de sistema não pode desaparecer da fila automaticamente');
check(getCrmSocialContextReviewHint([{direction:'outbound',message_type:'unsupported'}]) === null,
  'mensagem não suportada enviada não deve criar revisão inbound');
check(getCrmSocialContextReviewHint([{direction:'inbound',message_type:'audio'}]) === null,
  'áudio recebido permanece em fluxo normal, não tratar como não suportado');
