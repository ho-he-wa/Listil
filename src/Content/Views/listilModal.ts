import { createElementByHtml } from "@/Dom/createElementByHtml";

export function listilModal() {
  return createElementByHtml<HTMLDivElement>(/*html*/ `
      <div data-name="listil-modal" class="listil-modal listil-root">
        <div data-name="listil-overlay" class="listil-overlay">
        </div>
        <div data-name="listil-modal-content" class="listil-modal-content">
          <h3 class="listil-modal-title">Advanced Filter Settings</h3>
          <div data-name="switch-setting-div" data-dandd-ignore="on">
            <select name="setting-select"></select>
            <input name="setting-name" type="text"
              placeholder="Setting Name">
            <button name="add-setting">＋Copy Setting</button>
          </div>
          <div data-name="listil-setting-list" class="listil-setting-list" data-dandd-ignore="on">
            <!-- Add dynamically -->
          </div>
          <div data-dandd-ignore="on">
            <button name="add-filter">＋ Add Filter</button>
            <button name="close">✖ Close</button>
          </div>
        </div>
      </div>
    `);
}
