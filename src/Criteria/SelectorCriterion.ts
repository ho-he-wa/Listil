import { CriterionUtility } from "./CriterionUtility";

export class SelectorCriterion {
  public readonly selector;
  public readonly option;
  public readonly operator;
  public readonly value;
  public constructor(params: {
    selector: string;
    option: string;
    operator: string;
    value: string;
  }) {
    this.selector = params.selector;
    this.option = params.option;
    this.operator = params.operator;
    this.value = params.value;
    console.log(this);
  }

  public static from(str: string) {
    const matches = str.match(
      /^(\*s:)(.+?)\s*=>text\s*(\(\S*\))?\s*(==|!=|>=|<=|=|>|<)\s*(.+)/
    );
    if (!matches) {
      throw new Error("invalid selector criterion.");
    }
    return new this({
      selector: matches[2].trim(),
      option: (matches[3] ?? "").replace(/^\(|\)$/g, ""),
      operator: matches[4].trim(),
      value: matches[5].trim(),
    });
  }

  public existsIn(element: HTMLElement): boolean {
    return !!this.findIn(element);
  }

  public findIn(element: HTMLElement): HTMLElement | undefined {
    const elements = Array.from(element.querySelectorAll(this.selector)).filter(
      (el) => el instanceof HTMLElement
    );
    const found = Array.from(elements).filter((element) => {
      return this.matchValue(element.innerText);
    });
    return found.length > 0 ? found[0] : undefined;
  }

  public matchValue(value: string): boolean {
    const util = new CriterionUtility();
    return util.match(value, this.operator, this.value);
  }
}

// if (import.meta?.env == null || import.meta.env.DEV) {
//   console.log(SelectorCriterion.from('*s:div>div>[name="abcd"]=>text<=100'));
//   console.log(
//     SelectorCriterion.from('*s:div > div > [name="abcd"] =>text <= 100')
//   );
//   const eq100yen = SelectorCriterion.from('*s:div>div>[name="abcd"]=>text<=100');
//   console.log(eq100yen.matchValue("100"));
//   console.log(eq100yen.matchValue("101"));
// }
