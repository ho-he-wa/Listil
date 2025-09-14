export interface MarkInterface {
  markRegExp(regExp: RegExp, option: { className?: string }): void;
  unmark(): void;
}
