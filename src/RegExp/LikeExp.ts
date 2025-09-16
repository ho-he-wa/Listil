/**
 * テキストのLIKE比較。ワイルドカード `*` と `?` を利用できる。
 *
 * 例:
 *   LikeExp.of("file-*.txt").match("file-01.txt") => true
 */
export class LikeExp {
  private constructor(private readonly regexp: RegExp) {}
  /**
   * ワイルドカード付きパターンから LikeExp を生成。
   *
   * @param pattern ワイルドカードを含むパターン文字列（`*` = 任意文字列, `?` = 任意1文字）
   * @param options
   *   - ignoreCase: 大文字小文字を無視（RegExpの 'i' フラグ）
   *   - pathSafe: `*` が `/` を越えないようにする（パスセーフモード）
   */
  public static of(
    pattern: string,
    options: { ignoreCase?: boolean; pathSafe?: boolean } = {}
  ): LikeExp {
    const tmp = pattern
      .replace(/\*/g, "<<<WILDCARD_STAR>>>")
      .replace(/\?/g, "<<<WILDCARD_DOT>>>");
    const escapeRegex = (s: string): string =>
      s.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    const escaped = escapeRegex(tmp);
    // ワイルドカード変換
    const wildcarded = escaped
      .replace(/<<<WILDCARD_STAR>>>/g, options.pathSafe ? "[^/]*" : ".*")
      .replace(/<<<WILDCARD_DOT>>>/g, ".");
    const regexString = `^${wildcarded}$`;
    const flags = options.ignoreCase ? "i" : "";
    return new LikeExp(new RegExp(regexString, flags));
  }
  /**
   *  対象の文字列がパターンにマッチするかどうか
   *
   * @param str 判定対象の文字列
   * @returns true:マッチ
   */
  public match(str: string) {
    return str.match(this.regexp) != null;
  }

  /**
   * RegExpインスタンスに変換する
   */
  public toRegExp(): RegExp {
    return new RegExp(this.regexp.source, this.regexp.flags);
  }
}
