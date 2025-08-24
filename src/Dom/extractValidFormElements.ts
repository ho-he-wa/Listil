/**
 * 指定要素配下の有効なフォーム要素を抽出する
 *
 * - 同名がある場合は1つのみ抽出
 */
export function extractValidFormElements(root: Element, withDisabled: boolean = false): Map<string, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> {
    const elements = root.querySelectorAll<HTMLElement>('input, select, textarea');
    const result = new Map<string, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>();
    elements.forEach(el => {
        if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
            if (!withDisabled && el.disabled) {
                return;
            };
            if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio') && !el.checked) {
                return;
            };
            const key = el.name || el.id;
            if (!key) {
                return;
            };
            result.set(key, el);
        }
    });
    return result;
}
