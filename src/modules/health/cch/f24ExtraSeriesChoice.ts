/** F24 G1: choice to continue beyond M3 planned sets is always explicit.
 * This pure UI guard does not authorize a write or change the published plan.
 * The existing M4/F19 server schema restricts set_number to 1..100.
 */
export function canOfferExtraSeries(
  completed: number,
  plannedMaximum: number,
  exerciseStatus: string,
): boolean {
  return Number.isSafeInteger(completed) &&
    Number.isSafeInteger(plannedMaximum) &&
    plannedMaximum >= 1 &&
    completed >= plannedMaximum &&
    completed < 100 &&
    !["completed", "skipped", "replaced"].includes(exerciseStatus);
}
