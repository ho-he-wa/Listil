import { createElementByHtml } from "./createElementByHtml";

/**
 * カラー(CSSクラス)の選択
 */
export function colorClassSelect(
  colorSelect: HTMLDivElement,
  value: string,
  onchange: (value: string) => void
) {
  return {
    apply: () => {
      const colorSelectWk = createElementByHtml(/*html*/ `
        <div>
          <div class="listil-selected">&nbsp;</div>
          <div class="listil-options">
            <div class="listil-option" data-value="listil-custom-mark-red">
              <div class="listil-custom-mark-red">&nbsp;</div>
            </div>
            <div class="listil-option" data-value="listil-custom-mark-yellow">
              <div class="listil-custom-mark-yellow">&nbsp;</div>
            </div>
            <div class="listil-option" data-value="listil-custom-mark-green">
              <div class="listil-custom-mark-green">&nbsp;</div>
            </div>
            <div class="listil-option" data-value="listil-custom-mark-cyan">
              <div class="listil-custom-mark-cyan">&nbsp;</div>
            </div>
            <div class="listil-option" data-value="listil-custom-mark-blue">
              <div class="listil-custom-mark-blue">&nbsp;</div>
            </div>
            <div class="listil-option" data-value="listil-custom-mark-purple">
              <div class="listil-custom-mark-purple">&nbsp;</div>
            </div>
          </div>
          <input type="hidden" name="marker-color" />
        </div>
        `);
      const selected = colorSelectWk.querySelector(
        ".listil-selected"
      )! as HTMLElement;
      const options = colorSelectWk.querySelector(
        ".listil-options"
      )! as HTMLElement;
      const markerColor = colorSelectWk.querySelector(
        '[name="marker-color"]'
      )! as HTMLInputElement;
      selected.addEventListener("click", (e) => {
        e.stopPropagation();
        options.style.display =
          options.style.display === "block" ? "none" : "block";
      });
      const colorOptions = Array.from(
        colorSelectWk.querySelectorAll(".listil-option")
      ) as HTMLElement[];
      colorOptions.forEach((option) => {
        option.addEventListener("click", () => {
          selected.innerHTML = option.innerHTML;
          options.style.display = "none";
          if (!option.dataset.value) {
            throw new Error("Invalid marker color.");
          }
          markerColor.value = option.dataset.value;
          onchange(option.dataset.value);
        });
      });
      markerColor.value = value;
      const initValue = markerColor.value;
      // 初期値選択
      if (initValue) {
        const matchedOption = [...colorOptions].find(
          (opt) => opt.dataset.value === initValue
        );
        if (matchedOption) {
          selected.innerHTML = matchedOption.innerHTML;
        }
      }
      Array.from(colorSelectWk.children).forEach((el) => {
        colorSelect.appendChild(el);
      });
    },
  };
}
