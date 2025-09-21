/**
 * 非同期処理を順次実行にする
 */
export class AsyncQueue {
  // 前回のタスクの完了を記録する Promise（最初はすぐに解決されている）
  private lastTask: Promise<any> = Promise.resolve();

  /**
   * タスクをキューに追加して、必ず順番に1つずつ実行されるようにする
   * @param task - 非同期関数（Promiseを返す関数）
   * @returns task() の戻り値（Promise<T>）
   */
  async run<T>(task: () => Promise<T>): Promise<T> {
    // 直前のタスクが完了するまで待ってから task() を実行する Promise を作る
    const resultPromise = this.lastTask.then(() => task());
    // 次のタスクのために lastTask を更新
    // catch することで、task() が失敗してもチェーンが途切れないようにする
    this.lastTask = resultPromise.catch(() => {});
    // task() の実行結果を呼び出し元に返す
    return await resultPromise;
  }
}

// // 使用例
// const queue = new AsyncQueue();
// /** テスト用関数 */
// async function doTask(id: number, prefix: string) {
//   console.log(`${prefix}Start: ${id}`);
//   await new Promise((resolve) => setTimeout(resolve, 1000));
//   console.log(`${prefix}End: ${id}`);
// }
// // 呼び出し
// console.log("AsyncQueueあり版");
// for (let i = 0; i < 5; i++) {
//   queue.run(() => doTask(i, "With AsyncQueue)"));
// }
// console.log("AsyncQueueなし版");
// for (let i = 0; i < 5; i++) {
//   doTask(i, "Without AsyncQueue)");
// }
