import { getCrmSocialEventReviewHint } from './socialEventReview';

function check(value: unknown, message: string) {
  if (!value) throw new Error('CRM F3 evento social: ' + message);
}
check(getCrmSocialEventReviewHint({ direction: 'inbound', message_type: 'sticker' })?.includes('figurinha'), 'figurinha inbound deve orientar revisão');
check(getCrmSocialEventReviewHint({ direction: 'inbound', message_type: 'reaction' })?.includes('reação'), 'reação inbound deve orientar revisão');
check(getCrmSocialEventReviewHint({ direction: 'inbound', message_type: 'text' }) === null, 'texto não recebe aviso social');
check(getCrmSocialEventReviewHint({ direction: 'outbound', message_type: 'sticker' }) === null, 'figurinha enviada não altera aviso');
check(getCrmSocialEventReviewHint(null) === null, 'sem evento não inventar alerta');
