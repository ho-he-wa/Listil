import { CriterionInterface } from "./CriterionInterface";

export class RegexCriterion implements CriterionInterface {
  protected readonly regex;
  public constructor(regex: RegExp) {
    this.regex = regex;
  }

  public static from(str: string) {
    return new this(new RegExp(str, "gi"));
  }

  public existsIn(element: HTMLElement): boolean {
    return !!this.findIn(element);
  }

  public findIn(element: HTMLElement): HTMLElement | undefined {
    const text = element.innerText;
    const textMatched = text.match(this.regex) !== null;
    return textMatched ? element : undefined;
  }

  public matchValue(target: string): boolean {
    return target.match(this.regex) !== null;
  }
}

// if (import.meta?.env == null || import.meta.env.DEV) {
//   const eq100yen = RegexCriterion.from("(100)");
//   console.log(eq100yen.matchValue("100"));
//   console.log(eq100yen.matchValue("101"));
// }
