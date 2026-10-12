import test from "node:test";
import assert from "node:assert/strict";
import { padEndToWidth, truncateToWidth, visibleWidth } from "../lib/width.ts";

test("visibleWidth counts code points and strips ANSI SGR sequences", () => {
  assert.equal(visibleWidth(""), 0);
  assert.equal(visibleWidth("abc"), 3);
  assert.equal(visibleWidth("\x1b[31mred\x1b[39m"), 3);
  assert.equal(visibleWidth("\x1b[38;2;1;2;3mxy\x1b[0m"), 2);
  assert.equal(visibleWidth("a\u0301"), 2);
  assert.equal(visibleWidth("🐺ab"), 3);
  assert.equal(visibleWidth("\x1b[1m\x1b[31mbold red\x1b[0m"), 8);
});

test("truncateToWidth returns the input unchanged when it fits", () => {
  assert.equal(truncateToWidth("hello", 5), "hello");
  assert.equal(truncateToWidth("hello", 10), "hello");
  assert.equal(truncateToWidth("", 0), "");
  assert.equal(truncateToWidth("\x1b[31mred\x1b[39m", 3), "\x1b[31mred\x1b[39m");
});

test("truncateToWidth reserves one column for the single-width ellipsis", () => {
  assert.equal(truncateToWidth("hello", 4), "hel…");
  assert.equal(truncateToWidth("hello", 3), "he…");
  assert.equal(truncateToWidth("hello", 2), "h…");
  assert.equal(visibleWidth(truncateToWidth("hello", 4)), 4);
});

test("truncateToWidth boundary values 0, 1, 2 and exact fit", () => {
  assert.equal(truncateToWidth("hello", 0), "");
  assert.equal(truncateToWidth("hello", -5), "");
  assert.equal(truncateToWidth("hello", 1), "…");
  assert.equal(truncateToWidth("hello", 2), "h…");
  assert.equal(truncateToWidth("hi", 2), "hi");
  assert.equal(truncateToWidth("h", 1), "h");
  assert.equal(visibleWidth(truncateToWidth("hello", 2)), 2);
});

test("truncateToWidth counts astral code points as one column each", () => {
  assert.equal(truncateToWidth("🐺🐺🐺", 3), "🐺🐺🐺");
  assert.equal(truncateToWidth("🐺🐺🐺", 2), "🐺…");
  assert.equal(visibleWidth(truncateToWidth("🐺🐺🐺", 2)), 2);
});

test("truncateToWidth keeps the leading SGR style and closes it when it truncates", () => {
  const out = truncateToWidth("\x1b[38;2;242;140;40mno branch not a repo\x1b[0m", 8);
  assert.equal(out, "\x1b[38;2;242;140;40mno bran…\x1b[0m");
  assert.equal(visibleWidth(out), 8);
});

test("truncateToWidth never introduces an escape on unstyled input", () => {
  const out = truncateToWidth("plain text long", 5);
  assert.equal(out, "plai…");
  assert.equal(out.includes("\x1b"), false);
});

test("truncateToWidth drops mid-string styling without leaking an open style", () => {
  const out = truncateToWidth("plain \x1b[31mred\x1b[0m tail", 6);
  assert.equal(out, "plain…");
  assert.equal(out.includes("\x1b"), false);
});

test("padEndToWidth pads with spaces and never truncates", () => {
  assert.equal(padEndToWidth("ab", 5), "ab   ");
  assert.equal(padEndToWidth("abcdef", 3), "abcdef");
  assert.equal(padEndToWidth("", 2), "  ");
  assert.equal(padEndToWidth("abc", 3), "abc");
  assert.equal(padEndToWidth("\x1b[31mab\x1b[39m", 4), "\x1b[31mab\x1b[39m  ");
});
