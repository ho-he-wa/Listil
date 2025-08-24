/**
 * 深さ制限付きで指定セレクタに一致する要素を探索する関数
 * 呼び出し時に型パラメータで戻り値の型を指定可能
 *
 * @param root - 探索の起点となるルート要素
 * @param selector - CSS セレクタ文字列
 * @param maxDepth - 探索する最大の深さ（0はルート自身）
 * @returns 条件に一致した要素の配列（指定された型にキャスト）
 */
export function querySelectorAllWithDepth<T extends Element>(
    root: Element,
    selector: string,
    maxDepth: number = 1): T[] {
    const results: T[] = [];
    const traverse = (node: Element, depth: number): void => {
        if (depth > maxDepth) return;

        if (node.matches(selector)) {
            results.push(node as T); // 明示的にキャスト
        }
        for (const child of Array.from(node.children)) {
            traverse(child, depth + 1);
        }
    };
    traverse(root, 0);
    return results;
}
