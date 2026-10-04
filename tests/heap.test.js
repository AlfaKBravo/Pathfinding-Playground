import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MinHeap } from '../js/core/heap.js';
import { rng } from './helpers.js';

test('a new heap is empty', () => {
  const heap = new MinHeap();
  assert.equal(heap.size, 0);
  assert.equal(heap.isEmpty(), true);
  assert.equal(heap.peek(), undefined);
  assert.equal(heap.pop(), undefined);
});

test('pops numbers in ascending order', () => {
  const heap = new MinHeap();
  [5, 3, 8, 1, 9, 2, 7].forEach((n) => heap.push(n));
  assert.equal(heap.size, 7);
  assert.equal(heap.peek(), 1);
  const out = [];
  while (!heap.isEmpty()) out.push(heap.pop());
  assert.deepEqual(out, [1, 2, 3, 5, 7, 8, 9]);
});

test('keeps duplicates', () => {
  const heap = new MinHeap();
  [4, 1, 4, 1, 4].forEach((n) => heap.push(n));
  const out = [];
  while (!heap.isEmpty()) out.push(heap.pop());
  assert.deepEqual(out, [1, 1, 4, 4, 4]);
});

test('matches a sort on 2,000 random values, with pushes and pops interleaved', () => {
  const random = rng(42);
  const heap = new MinHeap();
  const mirror = [];
  for (let i = 0; i < 2000; i++) {
    if (mirror.length > 0 && random() < 0.3) {
      mirror.sort((a, b) => a - b);
      assert.equal(heap.pop(), mirror.shift());
    } else {
      const n = Math.floor(random() * 500);
      heap.push(n);
      mirror.push(n);
    }
    assert.equal(heap.size, mirror.length);
  }
  mirror.sort((a, b) => a - b);
  const rest = [];
  while (!heap.isEmpty()) rest.push(heap.pop());
  assert.deepEqual(rest, mirror);
});

test('orders objects with a custom comparator and breaks ties by it', () => {
  const heap = new MinHeap((a, b) => a.f - b.f || a.h - b.h);
  heap.push({ id: 'a', f: 5, h: 3 });
  heap.push({ id: 'b', f: 2, h: 9 });
  heap.push({ id: 'c', f: 5, h: 1 });
  heap.push({ id: 'd', f: 2, h: 4 });
  assert.deepEqual([heap.pop(), heap.pop(), heap.pop(), heap.pop()].map((x) => x.id), ['d', 'b', 'c', 'a']);
});

test('works as a max-heap with a reversed comparator', () => {
  const heap = new MinHeap((a, b) => b - a);
  [3, 10, 1, 7].forEach((n) => heap.push(n));
  assert.equal(heap.pop(), 10);
  assert.equal(heap.pop(), 7);
});

test('clear empties the heap', () => {
  const heap = new MinHeap();
  [1, 2, 3].forEach((n) => heap.push(n));
  heap.clear();
  assert.equal(heap.size, 0);
  assert.equal(heap.pop(), undefined);
});
