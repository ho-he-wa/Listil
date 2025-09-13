export class MyURL extends URL {
  clone() {
    return new MyURL(this.toString());
  }

  /**
   * クエリパラメータとハッシュを除去したURL文字列を返す
   */
  cleanUrl(): MyURL {
    return this.withoutSearch().withoutHash();
  }

  /**
   * クエリパラメータ（search）を削除する
   */
  withoutSearch(): MyURL {
    const newUrl = this.clone();
    newUrl.search = "";
    return newUrl;
  }

  /**
   * ハッシュ部分（#xxx）を削除する
   */
  withoutHash(): MyURL {
    const newUrl = this.clone();
    newUrl.hash = "";
    return newUrl;
  }
}

export function cleanUrl(url: string): string {
  return new MyURL(url).cleanUrl().toString();
}
