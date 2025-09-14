import { createElementByHtml } from "@/Dom/createElementByHtml";

export function listilModalSettingEditor() {
  return createElementByHtml(/*html*/ `
      <div class="listil-setting-editor">
        <h4 data-name="setting-no" class="listil-modal-setting-no"></h4>
        <fieldset data-name="control-set" class="listil-fieldset">
          <div data-name="top-row" class="listil-top-row" style="width:100%;">
            <div class="listil-top-row">
              <input name="listil-pattern-input"
                form="not-exists"
                placeholder="正規表現を入力..."
                class="listil-modal-setting-input">
              <span data-name="listil-pattern-error"
                class="listil-validation-error" style="display: none;">
                  無効な正規表現です
              </span>
              <label style="margin-right:8px;">
                <input type="checkbox" name="invert-matching"
                  form="not-exists"
                  class="listil-checkbox"
                  style="margin-right:4px;">
                invert matching
              </label>
            </div>
          </div>
          <label style="margin-right:8px;">
            <input type="checkbox" name="marker"
              form="not-exists"
              class="listil-checkbox"
              style="margin-right:4px;">
            Marker
          </label>
          <label style="margin-right:8px;">
            <!-- Select Color -->
            <div data-name="marker-color-select" class="listil-select">
              <!-- Add dynamically -->
            </div>
          </label>
          <label style="margin-right:8px;">
            <input type="checkbox" name="highlight"
              form="not-exists"
              class="listil-checkbox"
              style="margin-right:4px;">
            Highlight
          </label>
          <label style="margin-right:8px;">
            <input type="checkbox" name="grayout-others"
              form="not-exists"
              class="listil-checkbox"
              style="margin-right:4px;">
            GrayOut others
          </label>
          <label style="margin-right:8px;">
            <input type="checkbox" name="narrow-others"
              form="not-exists"
              class="listil-checkbox"
              style="margin-right:4px;">
            Narrow others
          </label>
          <label style="margin-right:8px;">
            <input type="checkbox" name="hide-others"
              form="not-exists"
              class="listil-checkbox"
              style="margin-right:4px;">
            Hide others
          </label>
          <button name="remove-filter" title="Remove this filter">
            🗑
          </button>
        </fieldset>
      </div>
    `);
}
