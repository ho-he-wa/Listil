// popup.ts

import { cleanUrl } from "@/Misc/MyURL";
import { LikeExp } from "@/RegExp/LikeExp";
import { GlobalSettingManager } from "./GlobalSetting/GlobalSettingManager";
import { ListSettingRepository } from "./ListFilter/ListSettingRepository";
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
  matchedPatternsDisp() {
    return document.getElementById("matched-patterns") as HTMLElement;
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
  matchedatternTemplate() {
    return document.getElementById(
      "matched-pattern-template"
    ) as HTMLTemplateElement;
  }
  updateMatchedPatternsDisp(matchedSettings: { [k: string]: PageSettingType }) {
    this.createMatchedPatternElements(matchedSettings).forEach((element) =>
      this.matchedPatternsDisp().appendChild(element)
    );
  }
  createMatchedPatternElements(matchedSettings: {
    [k: string]: PageSettingType;
  }) {
    if (Object.values(matchedSettings).length === 0) {
      const newPatternElement = this.createMatchedPattern("(新規)");
      return [newPatternElement];
    }
    return Object.values(matchedSettings).map((setting) =>
      this.createMatchedPattern(setting.urlPattern)
    );
  }
  createMatchedPattern(text: string) {
    const newPatternElement = this.matchedatternTemplate().content.cloneNode(
      true
    ) as HTMLElement;
    const item = newPatternElement.querySelector(".matched-pattern-item")!;
    item.textContent = text;
    return newPatternElement;
  }
  formValues(): PageSettingType {
    return {
      enabled: this.enabledToggle().checked,
      urlPattern: this.patternInput().value,
    };
  }
}

function validateUrlPattern(
  url: string,
  urlPattern: string
): string | undefined {
  const likeExp = LikeExp.of(`*${urlPattern}*`);
  if (!url.match(likeExp.toRegExp())) {
    return "Bad. This url pattern is not matched the current url.";
  }
  return undefined;
}

/**
 *
 * @param url
 * @returns
 * @see https://chromeenterprise.google/intl/ja_jp/policies/url-patterns/ chrome suppoted schemes
 */
function isRestrictedUrl(url: string) {
  // const isAllowedUrl =
  //   url.startsWith("http://") ||
  //   url.startsWith("https://") ||
  //   url.startsWith("file://");
  // return !isAllowedUrl;
  return (
    url.startsWith("chrome://") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("devtools://") ||
    url.startsWith("about:") ||
    url.startsWith("edge://")
  );
}

document.addEventListener("DOMContentLoaded", async () => {
  const thisDocument = new ThisDocument();

  try {
    const pageSettingManager = new PageSettingManager();
    const currentUrl = cleanUrl(await getCurrentTabUrl());
    const matchedSettings = await pageSettingManager.findAllByUrl(currentUrl);
    const matchedSetting = await pageSettingManager.findByUrl(currentUrl);

    const urlPattern = matchedSetting?.urlPattern || currentUrl;

    thisDocument.currentUrlDisp().textContent = currentUrl;
    thisDocument.updateMatchedPatternsDisp(matchedSettings);

    thisDocument.oldPatternHidden().value = urlPattern;

    const statusDisplay = thisDocument.statusDisplay();
    statusDisplay.textContent = null;

    const patternInput = thisDocument.patternInput();
    patternInput.value = urlPattern;
    patternInput.disabled =
      Object.values(matchedSettings).length > 1 ? true : false;
    patternInput.addEventListener("change", () => {
      const valErr = validateUrlPattern(currentUrl, patternInput.value.trim());
      if (valErr) {
        statusDisplay.textContent = valErr;
        statusDisplay.style.color = "red";
        return;
      }
      statusDisplay.textContent = "OK";
      statusDisplay.style.color = "green";
      // 保存
      const newUrlPattern = patternInput.value.trim() || cleanUrl(currentUrl);
      const keyToSave = createKey(newUrlPattern);
      pageSettingManager.remove(
        createKey(thisDocument.oldPatternHidden().value)
      );
      pageSettingManager.save(keyToSave, thisDocument.formValues());
      // リスト設定のキーを変更する
      const listRepo = new ListSettingRepository();
      listRepo.changeKeys(thisDocument.oldPatternHidden().value, newUrlPattern);
      // 旧パターンを隠しフィールドに格納
      thisDocument.oldPatternHidden().value = newUrlPattern;
    });

    const globalSettingManager = new GlobalSettingManager();
    const globalSetting = await globalSettingManager.load();

    const enabledToggle = thisDocument.enabledToggle();
    enabledToggle.checked =
      matchedSetting?.enabled ?? globalSetting.enabled ?? true;
    enabledToggle.addEventListener("change", async () => {
      // 保存
      const foundKey = await pageSettingManager.findKeyByUrl(currentUrl);
      const keyToSave = foundKey ?? createKey(currentUrl);
      pageSettingManager.save(keyToSave, thisDocument.formValues());
      // タブにメッセージ送信
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const tab = tabs[0] ?? null;
      if (tab == null || tab.id == null) {
        console.warn("タブの URL を取得できません");
        return;
      }
      if (!tab.url || isRestrictedUrl(tab.url ?? "")) {
        console.warn(
          `このページには content script を注入できません:${tab.url}`
        );
        return;
      }
      chrome.tabs.sendMessage(
        tab.id,
        {
          type: "enabled_changed",
          enabled: thisDocument.formValues().enabled,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("送信失敗:", chrome.runtime.lastError.message);
          }
        }
      );
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
