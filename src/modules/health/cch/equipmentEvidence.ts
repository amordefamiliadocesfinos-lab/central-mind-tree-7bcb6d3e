export function eligibleMachineLoad(exposures:number,previousLoad:number,recentLoad:number,
 previousReps:number,recentReps:number,rir:number,increment:number|null,
 sameMachine:boolean,sameUnit:boolean):number|null{
 if(!sameMachine||!sameUnit||exposures<3||!Number.isFinite(increment)||(increment??0)<=0||
  !Number.isFinite(recentLoad)||recentLoad<=0||recentLoad!==previousLoad||
  recentReps<previousReps||rir<2||rir>6)return null;
 return Number((recentLoad+increment!).toFixed(3));
}
