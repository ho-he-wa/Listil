/**
 * ドラッグ・アンド・ドロップ
 * @param dAndDElement ドラッグ・アンド・ドロップの対象
 */
export function dragAndDrop(dAndDElement: HTMLElement) {
  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  const onMouseDown = (e: MouseEvent) => {
    isDragging = true;
    dAndDElement.style.cursor = "grabbing";
    offsetX = e.clientX - dAndDElement.offsetLeft;
    offsetY = e.clientY - dAndDElement.offsetTop;
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    dAndDElement.style.left = `${e.clientX - offsetX}px`;
    dAndDElement.style.top = `${e.clientY - offsetY}px`;
  };

  const onMouseUp = () => {
    isDragging = false;
    dAndDElement.style.cursor = "grab";
  };

  return {
    /** 適用 */
    apply: () => {
      // ドラッグ開始は対象要素に設定
      dAndDElement.addEventListener("mousedown", onMouseDown);
      // ドラッグ中・終了はドキュメント全体で検知（ドラッグ中にカーソルが外に出ても検出可能）
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
  };
}
