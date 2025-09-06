import { AttrCriterion } from "./AttrCriterion";
import { CriterionInterface } from "./CriterionInterface";
import { DispCriterion } from "./DispCriterion";
import { InputCriterion } from "./InputCriterion";
import { RegexCriterion } from "./RegexCriterion";
import { SelectorCriterion } from "./SelectorCriterion";

/**
 * 特殊条件
 */
export class CriterionFactory {
  public constructor() {}
  public create(str: string): CriterionInterface {
    console.log("DEBUG", `CriteriaFactory.create('${str}')`);
    switch (true) {
      case str.startsWith("*a:"):
        return AttrCriterion.from(str);
      case str.startsWith("*i:"):
        return InputCriterion.from(str);
      case str.startsWith("*s:"):
        return SelectorCriterion.from(str);
      case str.startsWith("*d:"):
        return DispCriterion.from(str);
      default:
        // 利用想定なし
        throw new Error("not supported.");
        try {
          return RegexCriterion.from(str);
        } catch (e) {
          console.warn("Invalid regular expression:" + str);
          return RegexCriterion.from("(?!)"); // どれにも該当しない正規表現
        }
    }
  }
}

// if (import.meta?.env == null || import.meta.env.DEV) {
//   const map = new Map<string, string>();
//   map.set("data-test", "100");
//   map.set("data-test2", "101");
//   map.set("data-test3", "102");
//   const c = new CriteriaFactory().create("*a:data-test <= 101");
//   if (c instanceof AttrCriterion) {
//     console.log(c?.findInMap(map));
//   }
// }
