import { createElementByHtml } from "./createElementByHtml";

/**
 * カラー(CSSクラス)の選択
 */
export function colorClassSelect(
  colorInput: HTMLInputElement,
  value: string,
  onchange: (value: string) => void
) {
  return {
    apply: () => {
      const colorSelectWrapper = createElementByHtml(/*html*/ `
        <div data-name="marker-color-select" class="listil-select">
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
          <div data-name="replace-input"></div>
        </div>
        `);
      const selected = colorSelectWrapper.querySelector(
        ".listil-selected"
      )! as HTMLElement;
      const options = colorSelectWrapper.querySelector(
        ".listil-options"
      )! as HTMLElement;
      selected.addEventListener("click", (e) => {
        e.stopPropagation();
        options.style.display =
          options.style.display === "block" ? "none" : "block";
      });
      const colorOptions = Array.from(
        colorSelectWrapper.querySelectorAll(".listil-option")
      ) as HTMLElement[];
      colorOptions.forEach((option) => {
        option.addEventListener("click", () => {
          selected.innerHTML = option.innerHTML;
          options.style.display = "none";
          if (!option.dataset.value) {
            throw new Error("Invalid marker color.");
          }
          colorInput.value = option.dataset.value;
          onchange(option.dataset.value);
        });
      });
      colorInput.value = value;
      const initValue = colorInput.value;
      // 初期値選択
      if (initValue) {
        const matchedOption = [...colorOptions].find(
          (opt) => opt.dataset.value === initValue
        );
        if (matchedOption) {
          selected.innerHTML = matchedOption.innerHTML;
        }
      }
      const replaceInput = colorSelectWrapper.querySelector(
        '[data-name="replace-input"]'
      )!;
      colorInput.after(colorSelectWrapper);
      replaceInput.replaceWith(colorInput);
    },
  };
}
