/**
 * 指定要素の高さと幅 (パディング含まない) を取得する
 */
export function getContentBoxSize(el: HTMLElement): { width: number; height: number; } {
    const style = window.getComputedStyle(el);
    const boxSizing = style.boxSizing;
    let width = el.clientWidth;
    let height = el.clientHeight;
    // NOTE : content-box の場合は rect.width = content size なのでそのまま返す
    if (boxSizing === 'border-box') {
        // NOTE : clientWidth には padding は含まれるが border は含まれない
        const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
        const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
        width -= paddingX;
        height -= paddingY;
    }
    return {
        width: Math.max(0, width),
        height: Math.max(0, height),
    };
}
