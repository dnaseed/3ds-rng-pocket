/**
 * Exact TypeScript port of Pk3DSRNGTool.Gen7EggPath.Calc.
 * Computes the shortest Accept/Reject sequence from index 0 to FrameAdvList.length - 1.
 */
export function calcEggShortestPath(frameAdvList: readonly number[]): number[] {
  const maxDist = frameAdvList.length - 1;
  if (maxDist <= 0) return [0];

  const accept = 1;
  const reject = 1;
  const pre = new Int32Array(maxDist + 1);
  const w = new Int32Array(maxDist + 1);
  for (let i = 1; i <= maxDist; i++) {
    w[i] = 0x7fffffff;
  }

  for (let i = 0; i <= maxDist; i++) {
    // Reject path
    if (i !== 0 && w[i]! > w[i - 1]! + reject) {
      pre[i] = i - 1;
      w[i] = w[i - 1]! + reject;
    }
    // Accept path
    for (let j = i, k = i + frameAdvList[i]!; k <= maxDist; j = k, k = j + frameAdvList[j]!) {
      if (w[k]! > w[j]! + accept) {
        pre[k] = j;
        w[k] = w[j]! + accept;
      }
    }
  }

  const results: number[] = [];
  for (let node = maxDist; node !== 0; node = pre[node]!) {
    results.push(node);
  }
  results.push(0);
  results.reverse();
  return results;
}
