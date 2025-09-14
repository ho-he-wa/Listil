import { MarkInterface } from "@/Mark/MarkInterface";
import Mark from "mark.js";

/**
 * 実績のあるマーカーライブラリのラッパー
 */
export class MarkProven implements MarkInterface {
  private mark;

  constructor(rootElement: HTMLElement) {
    this.mark = new Mark(rootElement);
  }

  markRegExp(regExp: RegExp, option: { className?: string } = {}) {
    this.mark.markRegExp(regExp, option);
  }

  unmark() {
    this.unmark();
  }
}
