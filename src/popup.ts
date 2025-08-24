// popup.ts

import { PageSettingKeyManager } from "./PageSetting/PageSettingKeyManager";
import { PageSettingManager } from "./PageSetting/PageSettingManager";
import { PageSettingType } from "./PageSetting/PageSettingType";

function getCurrentTabUrl(): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      const tab = tabs[0];
      if (tab && tab.url) {
        resolve(tab.url);
      } else {
        reject("No active tab found.");
      }
    });
  });
}

function createKey(urlPattern: string) {
  return PageSettingKeyManager.createKey(urlPattern);
}

class ThisDocument {
  currentUrlDisp() {
    return document.getElementById("current-url") as HTMLElement;
  }
  matchingPatternsDisp() {
    return document.getElementById("matching-patterns") as HTMLElement;
  }
  enabledToggle() {
    return document.getElementById("enabled-in-page") as HTMLInputElement;
  }
  patternInput() {
    return document.getElementById("url-pattern") as HTMLInputElement;
  }
  oldPatternHidden() {
    return document.getElementById("old-url-pattern") as HTMLInputElement;
  }
  statusDisplay() {
    return document.getElementById("pattern-status") as HTMLDivElement;
  }
  globalBtn() {
    return document.getElementById("global-settings-btn") as HTMLButtonElement;
  }
  formValues(): PageSettingType {
    return {
      enabled: this.enabledToggle().checked,
      urlPattern: this.patternInput().value,
    };
  }
}

function validateUrlPattern(url: string, urlPattern: string): boolean {
  if (!url.match(new RegExp(urlPattern))) {
    return false;
  }
  return true;
}

document.addEventListener("DOMContentLoaded", async () => {
  const thisDocument = new ThisDocument();

  try {
    const pageSettingManager = new PageSettingManager();
    const currentUrl = await getCurrentTabUrl();
    const matchedSettings = await pageSettingManager.findAllByUrl(currentUrl);
    const matchedSetting = await pageSettingManager.findByUrl(currentUrl);

    const urlPattern = matchedSetting?.urlPattern || currentUrl;

    thisDocument.currentUrlDisp().textContent = currentUrl;
    thisDocument.matchingPatternsDisp().textContent = (() => {
      if (Object.values(matchedSettings).length === 0) {
        return "(新規)";
      }
      return Object.values(matchedSettings)
        .map((setting) => setting.urlPattern)
        .join("\n");
    })();

    thisDocument.oldPatternHidden().value = urlPattern;

    const statusDisplay = thisDocument.statusDisplay();
    statusDisplay.textContent = null;

    const patternInput = thisDocument.patternInput();
    patternInput.value = urlPattern;
    patternInput.disabled =
      Object.values(matchedSettings).length > 1 ? true : false;
    patternInput.addEventListener("change", () => {
      const newUrlPattern = patternInput.value.trim();
      if (!validateUrlPattern(currentUrl, newUrlPattern)) {
        statusDisplay.textContent =
          "Bad. This url pattern is not matched the current url.";
        statusDisplay.style.color = "red";
        return;
      }
      statusDisplay.textContent = "OK";
      statusDisplay.style.color = "green";
      // 保存
      const keyToSave = newUrlPattern
        ? createKey(newUrlPattern)
        : createKey(currentUrl);
      pageSettingManager.remove(
        createKey(thisDocument.oldPatternHidden().value)
      );
      pageSettingManager.save(keyToSave, thisDocument.formValues());
      // 旧パターンを隠しフィールドに格納
      thisDocument.oldPatternHidden().value = newUrlPattern;
    });

    const enabledToggle = thisDocument.enabledToggle();
    enabledToggle.checked = matchedSetting?.enabled ?? true;
    enabledToggle.addEventListener("change", async () => {
      const foundKey = await pageSettingManager.findKeyByUrl(currentUrl);
      const keyToSave = foundKey ?? createKey(currentUrl);
      pageSettingManager.save(keyToSave, thisDocument.formValues());
    });

    thisDocument.globalBtn().addEventListener("click", () => {
      chrome.runtime.openOptionsPage();
    });
  } catch (error) {
    console.error(error);
    const display = document.getElementById("test-display");
    if (display) {
      display.textContent = "現在のタブ情報を取得できませんでした。";
    }
  }
});
