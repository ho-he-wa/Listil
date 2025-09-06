import { CriterionInterface } from "./CriterionInterface";
import { CriterionUtility } from "./CriterionUtility";

export class AttrCriterion implements CriterionInterface {
  public readonly name;
  public readonly option;
  public readonly operator;
  public readonly value;
  private readonly util;
  public constructor(params: {
    name: string;
    option: string;
    operator: string;
    value: string;
  }) {
    this.name = params.name;
    this.option = params.option;
    this.operator = params.operator;
    this.value = params.value;
    this.util = new CriterionUtility();
    console.log(this);
  }

  public static from(str: string) {
    //const matches = str.match(/^(\*a:)(.+?)\s*(==|!=|>=|<=|=|>|<)\s*(.+)/);
    const matches = str.match(
      /^(\*a:)([a-zA-Z0-9_-]+)\s*(\(\S*\))?\s*(==|!=|>=|<=|=|>|<)\s*(.+)/
    );
    if (!matches) {
      throw new Error("invalid attribute criterion.");
    }
    return new this({
      name: matches[2].trim(),
      option: (matches[3] ?? "").replace(/^\(|\)$/g, ""),
      operator: matches[4].trim(),
      value: matches[5].trim(),
    });
  }

  public findInMap(target: Map<string, string>): string | undefined {
    const value = target.get(this.name);
    if (!value) {
      return undefined;
    }
    return this.matchValue(value) ? value : undefined;
  }

  public existsIn(element: HTMLElement): boolean {
    // const attributeMaps = extractAttributeMaps(element);
    // const attributeMatch = attributeMaps.some((attributeMap) => {
    //   if (!attributeMap.has(this.name)) {
    //     return false;
    //   }
    //   return !!this.findInMap(attributeMap);
    // });
    // return attributeMatch;
    return !!this.findIn(element);
  }

  public findIn(element: HTMLElement): HTMLElement | undefined {
    const found = Array.from(element.querySelectorAll(`[${this.name}]`))
      .filter((el) => el instanceof HTMLElement)
      .find((el) => {
        return Array.from(el.attributes).find((attr) =>
          this.matchValue(attr.value)
        );
      });
    return found;
  }

  public matchValue(value: string): boolean {
    const util = this.util;
    return util.match(value, this.operator, this.value);
  }
}

// if (import.meta?.env == null || import.meta.env.DEV) {
//   const eq100yen = AttrCriterion.from("*a:data-price <= 100円");
//   console.log(eq100yen.matchValue("100"));
//   console.log(eq100yen.matchValue("101"));
// }
