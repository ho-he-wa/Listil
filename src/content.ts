console.log("[DEBUG] Content script loaded");

// ページ内のタイトルを取得してログ出力
const title = document.title;
console.log("Page title is:", title);

// 要素を強調する例
const h1 = document.querySelector("h1");
if (h1) {
  h1.style.backgroundColor = "yellow";
  h1.style.border = "2px solid red";
}
