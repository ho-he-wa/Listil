import { createElementByHtml } from "@/Dom/createElementByHtml";

export function controlsRoot() {
  return createElementByHtml(/*html*/ `
      <div class="listil-root">
        <div class="listil-toggle-button-div">
          <button type="button" name="listil-showhide-toggle"
            form="not-exists"
            class="listil-toggle-button"
            style="margin-bottom:6px;">
              Hide List
          </button>
          <button type="button" name="listil-onoff-toggle"
            form="not-exists"
            class="listil-toggle-button"
            style="margin-bottom:6px;">
              Show Controls
          </button>
        </div>
        <!-- Add dynamically -->
      </div>
    `);
}
