/**
 * 単位あり数値
 */
export class NumberWithUnit {
  public readonly value;
  public readonly unit;
  /**
   * @param value 数値
   * @param unit 単位
   */
  private constructor(value: number, unit: string = "") {
    this.value = value;
    this.unit = unit;
  }

  /**
   * 文字列から変換
   */
  public static of(str: string) {
    // format: {value}{unit}
    const regex = new RegExp(/(?<value>[+-]?\d+\.?\d*)\s*(?<unit>[\wμ]?\S*)?/u);
    // 3桁区切り文字(カンマ or 空白)を削除
    const matches = regex.exec(str.replaceAll(",", "").replaceAll(" ", ""));
    console.log("DEBUG", `NumberWithUnit.of('${str}')`);
    if (matches == null || !matches.groups || !matches.groups.value) {
      return undefined;
    }
    return new this(
      Number.parseFloat(matches.groups.value ?? ""),
      matches.groups.unit ?? ""
    );
  }

  /**
   * SI接頭語マップ
   */
  public static readonly siPrefixes: { [key: string]: number } = {
    p: 1e-12,
    n: 1e-9,
    μ: 1e-6,
    u: 1e-6, // μの代用としてuも許容
    m: 1e-3,
    c: 1e-2,
    d: 1e-1,
    h: 1e2,
    k: 1e3,
    K: 1e3, // 大文字Kも許容
    M: 1e6,
    G: 1e9,
    T: 1e12,
  };

  /**
   * 単位接頭辞の係数
   */
  protected multiplier(unitPrefix: string) {
    const multiplier =
      unitPrefix in NumberWithUnit.siPrefixes
        ? NumberWithUnit.siPrefixes[unitPrefix]
        : 1;
    return multiplier;
  }

  /**
   * 単位接頭語
   */
  public unitPrefix() {
    if (this.unit.length <= 1) {
      return "";
    }
    return this.unit.at(0) ?? "";
  }

  /**
   * 数値に変換
   *
   * @param applyPrefix true の場合、SI接頭辞の係数を掛けた数値を返す。false の場合は生の値を返す
   */
  public toNumber(applyPrefix: boolean = true) {
    const multiplier = applyPrefix ? this.multiplier(this.unitPrefix()) : 1;
    return this.value * multiplier;
  }
}

if (import.meta?.env == null || import.meta.env.DEV) {
  // // example for applyPrefix
  // console.log("== Apply Prefix ==");
  // console.log(NumberWithUnit.of("2.5km")?.toNumber()); // 2500
  // console.log(NumberWithUnit.of("2.5km")?.toNumber(false)); // 2.5
  // // example for simple values
  // console.log("== Simple Values ==");
  // console.log(NumberWithUnit.of("0")?.toNumber()); // 0
  // console.log(NumberWithUnit.of("1")?.toNumber()); // 1
  // console.log(NumberWithUnit.of("+1")?.toNumber()); // 1
  // console.log(NumberWithUnit.of("-1")?.toNumber()); // -1
  // console.log(NumberWithUnit.of("+1.1")?.toNumber()); // 1.1
  // console.log(NumberWithUnit.of("-1.1")?.toNumber()); // -1.1
  // // example for comma-separated/space-separated values
  // console.log("== Comma/Space Separated Values ==");
  // console.log(NumberWithUnit.of("+10,987 654 321.12345")?.toNumber()); // 10987654321.12345
  // console.log(NumberWithUnit.of("-10,987,654,321.12345")?.toNumber()); // -10987654321.12345
  // // example for with a unit prefix
  // console.log("== With SI Unit Prefix ==");
  // console.log(NumberWithUnit.of("0km")?.toNumber()); // 0
  // console.log(NumberWithUnit.of("+0.0km")?.toNumber()); // 0
  // console.log(NumberWithUnit.of("10 987 654 321.1234 Km")?.toNumber()); // 10987654321123.4
  // console.log(NumberWithUnit.of("10 987 654 321.1234 m")?.toNumber()); // 10987654321.1234
  // console.log(NumberWithUnit.of("10 987 654 321.1234 mm")?.toNumber()); // 10987654.3211234
  // console.log(NumberWithUnit.of("10 987 654 321.1234 μm")?.toNumber()); // 10987.654321123398
  // // example for with junk characters
  // console.log("== Junk Input Test ==");
  // console.log(NumberWithUnit.of("最安値 ¥12 456.12 ！")?.toNumber()); // 12456.12
  // console.log(NumberWithUnit.of("最安値 ¥-12 456.12 ！")?.toNumber()); // -12456.12
  // console.log(NumberWithUnit.of("最安値¥12 456.12！")?.toNumber()); // 12456.12
  // console.log(NumberWithUnit.of("最安値¥-12 456.12！")?.toNumber()); // -12456.12
}
