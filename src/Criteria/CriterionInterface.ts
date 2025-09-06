export interface CriterionInterface {
  existsIn(element: HTMLElement): boolean;
  findIn(element: HTMLElement): HTMLElement | undefined;
  matchValue(target: string): boolean;
}
