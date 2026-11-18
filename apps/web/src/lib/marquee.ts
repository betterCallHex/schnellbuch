export interface Point {
  x: number;
  y: number;
}

export interface Box {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

export interface RowSpan {
  end: number;
  start: number;
}

export function boxBetween(from: Point, to: Point): Box {
  return {
    left: Math.min(from.x, to.x),
    right: Math.max(from.x, to.x),
    top: Math.min(from.y, to.y),
    bottom: Math.max(from.y, to.y),
  };
}

export function indexesInBox({
  box,
  rows,
  columns,
  width,
  columnGap,
  rowGap,
  count,
}: {
  box: Box;
  rows: RowSpan[];
  columns: number;
  width: number;
  columnGap: number;
  rowGap: number;
  count: number;
}) {
  const tileWidth = (width - columnGap * (columns - 1)) / columns;
  const hits: number[] = [];
  for (const [rowIndex, row] of rows.entries()) {
    const tileRow = { top: row.start, bottom: row.end - rowGap };
    if (!overlapsVertically(box, tileRow)) {
      continue;
    }
    for (let column = 0; column < columns; column += 1) {
      const index = rowIndex * columns + column;
      const left = column * (tileWidth + columnGap);
      if (index < count && box.left < left + tileWidth && box.right > left) {
        hits.push(index);
      }
    }
  }
  return hits;
}

function overlapsVertically(box: Box, row: { top: number; bottom: number }) {
  return box.top < row.bottom && box.bottom > row.top;
}
