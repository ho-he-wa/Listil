import { NumberWithUnit } from "./NumberWithUnit";

export class CriteriaUtility {
  public match(a: string, operator: string, b: string): boolean {
    const wkA = NumberWithUnit.of(a);
    const wkB = NumberWithUnit.of(b);
    if (!wkA || !wkB) {
      return false;
    }
    switch (operator) {
      case "=":
      case "==":
        return wkA.toNumber() == wkB.toNumber();
      case "!=":
        return wkA.toNumber() != wkB.toNumber();
      case ">":
        return wkA.toNumber() > wkB.toNumber();
      case ">=":
        return wkA.toNumber() >= wkB.toNumber();
      case "<":
        return wkA.toNumber() < wkB.toNumber();
      case "<=":
        return wkA.toNumber() <= wkB.toNumber();
      default:
        console.warn(`Unsupported operator: ${operator}`);
        return false;
    }
  }
}

if (import.meta?.env == null || import.meta.env.DEV) {
  // const util = new CriteriaUtility();
  // // trueケース (単位なし)
  // console.log(util.match("100", "==", "100")); // true
  // console.log(util.match("100", "!=", "99")); // true
  // console.log(util.match("50", ">", "40")); // true
  // console.log(util.match("50", ">=", "50")); // true
  // console.log(util.match("30", "<", "40")); // true
  // console.log(util.match("30", "<=", "30")); // true
  // console.log(util.match("+100", "==", "100")); // true
  // console.log(util.match("-100", "!=", "100")); // true
  // console.log(util.match("-50", "<", "0")); // true
  // console.log(util.match("-50", "<=", "-50")); // true
  // console.log(util.match("1,000", "==", "1000")); // true
  // // trueケース (単位あり)
  // console.log(util.match("2.5kg", ">", "2000g")); // true (2500 > 2000)
  // console.log(util.match("5000mg", "==", "5g")); // true (5 == 5)
  // console.log(util.match("1500μg", "<", "2mg")); // true (0.0015 < 0.002)
  // console.log(util.match("1GB", ">", "999MB")); // true (1e9 > 999e6)
  // console.log(util.match(" 2,500 km", "==", "2500km")); // true
  // // falseケース (単位なし)
  // console.log(util.match("100", "==", "99")); // false
  // console.log(util.match("50", "<", "40")); // false
  // console.log(util.match("30", ">", "40")); // false
  // console.log(util.match("30", ">=", "31")); // false
  // console.log(util.match("-50", ">", "0")); // false
  // // falseケース (単位あり)
  // console.log(util.match("2.5kg", "<", "2000g")); // false (2500 < 2000じゃない)
  // console.log(util.match("5000mg", "!=", "5g")); // false (5 != 5じゃない)
  // console.log(util.match("1500μg", ">", "2mg")); // false (0.0015 > 0.002じゃない)
  // console.log(util.match("1GB", "<", "999MB")); // false (1e9 < 999e6じゃない)
  // // falseケース (不正な値)
  // console.log(util.match("abc", "==", "10")); // false (変換失敗)
  // console.log(util.match("10", "==", "xyz")); // false (変換失敗)
  // console.log(util.match("10", "???", "10")); // false (未定義の演算子)
  // console.log(util.match("", "==", "")); // false (空文字は失敗)
}
