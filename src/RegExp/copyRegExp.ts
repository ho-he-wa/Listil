export function copyRegExp(
  srcRegExp: RegExp,
  options: { flagsToAdd?: string } = {}
): RegExp {
  return new RegExp(
    srcRegExp.source,
    addFlags(srcRegExp.flags, options.flagsToAdd ?? "")
  );

  /**
   * 与えられた正規表現フラグ文字列に、追加のフラグを重複なく加える。
   *
   * @param originalFlags - 例: "i"
   * @param flagsToAdd - 例: "g"
   * @returns 新しいフラグ文字列。例: "gi"
   */
  function addFlags(originalFlags: string, flagsToAdd: string): string {
    const combined = new Set([...originalFlags, ...flagsToAdd]);
    return [...combined].sort().join(""); // フラグ順は推奨順にソート
  }
}
