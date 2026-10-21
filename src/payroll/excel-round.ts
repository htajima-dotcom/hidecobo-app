// Excelの丸め関数と同じ結果を返すための関数群。
// Excelは数値を15桁で扱うため、先に15桁へそろえてから丸める（2.675 などの誤差対策）。

const to15 = (x: number): number => Number(x.toPrecision(15));

const shift = (x: number, digits: number): number => Number(`${x}e${digits}`);

/** ROUND(x, digits)：0から遠い方へ四捨五入 */
export function round(x: number, digits = 0): number {
  const v = to15(x);
  const r = Math.round(shift(Math.abs(v), digits));
  return Math.sign(v) * shift(r, -digits) || 0;
}

/** ROUNDUP(x, digits)：0から遠い方へ切り上げ */
export function roundUp(x: number, digits = 0): number {
  const v = to15(x);
  const r = Math.ceil(to15(shift(Math.abs(v), digits)));
  return Math.sign(v) * shift(r, -digits) || 0;
}

/** ROUNDDOWN(x, digits)：0に近い方へ切り捨て */
export function roundDown(x: number, digits = 0): number {
  const v = to15(x);
  const r = Math.floor(to15(shift(Math.abs(v), digits)));
  return Math.sign(v) * shift(r, -digits) || 0;
}
