/** F1 — modelo puramente isolado. Não é autorização, RLS ou vínculo criado. */
"use strict";
const NUC="636768e6-e782-4c7d-8132-e7381621be12";
const ROLE="Especialista Núcleo 2.0";
const SPEC="nucleo-continuity";
// É proibido usar metadados autoeditáveis ou nomes de chat para conferir permissão.
function mayReadContext({identity,grants,assignments,moduleId,specialtyId,role}) {
 if(!identity?.authUid||identity.anonymous===true||identity.sessionActive!==true)return false;
 if(moduleId!==NUC||specialtyId!==SPEC||role!==ROLE)return false;
 if(grants.some(g=>g.authUid===identity.authUid&&g.capability==="nucleo_manage"&&g.active===true&&g.revokedAt===null))return true;
 return assignments.some(a=>
   a.authUid===identity.authUid&&a.moduleId===moduleId&&a.specialtyId===specialtyId&&
   a.role===role&&a.action==="read_context"&&a.active===true&&a.revokedAt===null&&
   a.validFrom<=identity.now&&(a.validUntil===null||identity.now<a.validUntil)
 );
}
module.exports={NUC,ROLE,SPEC,mayReadContext};
