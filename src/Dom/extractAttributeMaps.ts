/**
 * 指定要素配下の要素の data-* 属性および任意の指定属性を抽出して
 * 属性名 → 属性値 の Map の配列を返す。
 *
 * - 同名がある場合は1つのみ抽出
 * @param root - 探索対象のルート要素
 * @param targetAttributes - 抽出対象とする追加属性（例：['href', 'src']）
 * @returns Map<string, string>[] - 属性名をキー、属性値を値とするMapの配列
 */
export function extractAttributeMaps(
  root: Element,
  targetAttributes: string[] = ["href"]
): Map<string, string>[] {
  const result: Map<string, string>[] = [];
  const elements = root.querySelectorAll<HTMLElement>("*");
  elements.forEach((el) => {
    // data-* 属性と指定されたその他の属性を抽出
    const item = new Map<string, string>();
    Array.from(el.attributes)
      .filter(
        (attr) =>
          attr.name.startsWith("data-") || targetAttributes.includes(attr.name)
      )
      .forEach((attr) => {
        console.log("DEBUG attribute:", attr);
        item.set(attr.name, attr.value); // e.g., "data-role" => "admin"
      });
    if (item.size > 0) {
      result.push(item);
    }
  });
  return result;
}
