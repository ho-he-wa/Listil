/**
 * htmlから要素を作成する。
 */
function createElementsByHtml(htmlString: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, "text/html");
  const elements = (doc.body.cloneNode(true) as HTMLElement).children;
  return elements;
}
/**
 * htmlから要素を作成する。
 */
export function createElementByHtml<T extends HTMLElement>(htmlString: string) {
  const elements = createElementsByHtml(htmlString);
  if (elements.length === 0) {
    throw new Error("no elements in a html string.");
  }
  if (elements.length >= 2) {
    throw new Error("two or more elements in a html string.");
  }
  if (!(elements[0] instanceof HTMLElement)) {
    throw new Error("Created element is not HTMLElement.");
  }
  return elements[0] as T;
}
