/**
 * Binary min-heap used as the priority queue for Dijkstra and A*.
 *
 * The heap is stored in a flat array: the children of index i live at
 * 2i + 1 and 2i + 2, and its parent at (i - 1) >> 1. push and pop are
 * O(log n); peek and size are O(1).
 *
 * Items are ordered by a comparator, so the heap can hold plain numbers
 * or objects such as { node, f, h }. compare(a, b) < 0 means a comes out
 * first.
 */
export class MinHeap {
  constructor(compare = (a, b) => a - b) {
    this.items = [];
    this.compare = compare;
  }

  get size() {
    return this.items.length;
  }

  isEmpty() {
    return this.items.length === 0;
  }

  /** The smallest item, without removing it. undefined when empty. */
  peek() {
    return this.items[0];
  }

  push(item) {
    this.items.push(item);
    this.siftUp(this.items.length - 1);
  }

  /** Removes and returns the smallest item. undefined when empty. */
  pop() {
    const items = this.items;
    if (items.length === 0) return undefined;
    const top = items[0];
    const last = items.pop();
    if (items.length > 0) {
      items[0] = last;
      this.siftDown(0);
    }
    return top;
  }

  clear() {
    this.items.length = 0;
  }

  /** Moves the item at i up until its parent is no larger. */
  siftUp(i) {
    const { items, compare } = this;
    const item = items[i];
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (compare(item, items[parent]) >= 0) break;
      items[i] = items[parent];
      i = parent;
    }
    items[i] = item;
  }

  /** Moves the item at i down until both children are no smaller. */
  siftDown(i) {
    const { items, compare } = this;
    const n = items.length;
    const item = items[i];
    for (;;) {
      const left = 2 * i + 1;
      if (left >= n) break;
      const right = left + 1;
      const child = right < n && compare(items[right], items[left]) < 0 ? right : left;
      if (compare(items[child], item) >= 0) break;
      items[i] = items[child];
      i = child;
    }
    items[i] = item;
  }
}
