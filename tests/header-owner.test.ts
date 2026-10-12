import test from "node:test";
import assert from "node:assert/strict";
import { HeaderOwner } from "../lib/header-owner.ts";
import type { HeaderComponent, HeaderOwnerDeps } from "../lib/header-owner.ts";

interface ScheduledTask {
  fn: () => void;
  delayMs: number;
  cancelled: boolean;
  ran: boolean;
}

// A hand-driven stand-in for the host: nothing here ever sleeps, and the
// "setHeader" implementation mirrors the real one by disposing the previous
// custom header before building the next.
function createHost() {
  const tasks: ScheduledTask[] = [];
  const factories: Array<((tui: unknown, theme: unknown) => HeaderComponent) | undefined> = [];
  const notifications: Array<{ message: string; level?: "info" | "warning" }> = [];
  let built = 0;
  let disposed = 0;
  let invalidated = 0;
  let installed: HeaderComponent | null = null;

  const build = (_tui: unknown, _theme: unknown): HeaderComponent => {
    built += 1;
    return {
      render: (width: number) => [`inner@${width}`],
      invalidate: () => {
        invalidated += 1;
      },
      dispose: () => {
        disposed += 1;
      },
    };
  };

  const deps: HeaderOwnerDeps = {
    setHeader: (factory) => {
      factories.push(factory);
      if (factory) {
        installed?.dispose?.();
        installed = factory({ requestRender() {} }, {});
      } else {
        installed?.dispose?.();
        installed = null;
      }
    },
    schedule: (fn, delayMs) => {
      const task: ScheduledTask = { fn, delayMs, cancelled: false, ran: false };
      tasks.push(task);
      return task;
    },
    cancel: (handle) => {
      (handle as ScheduledTask).cancelled = true;
    },
    notify: (message, level) => {
      notifications.push({ message, level });
    },
  };

  const pending = () => tasks.filter((task) => !task.cancelled && !task.ran);
  const runNext = () => {
    const task = pending()[0];
    if (!task) throw new Error("no pending scheduled task");
    task.ran = true;
    task.fn();
  };

  return {
    deps,
    build,
    factories,
    notifications,
    tasks,
    pending,
    runNext,
    get installed() {
      return installed;
    },
    get built() {
      return built;
    },
    get disposed() {
      return disposed;
    },
    get invalidated() {
      return invalidated;
    },
  };
}

test("status reports idle before start and never throws", () => {
  const host = createHost();
  const owner = new HeaderOwner(host.deps, host.build);
  assert.deepEqual(owner.status(), { phase: "idle", reclaims: 0, renders: 0, lastWidth: null });
});

test("start schedules the install and installs nothing immediately", () => {
  const host = createHost();
  const owner = new HeaderOwner(host.deps, host.build);
  owner.start();
  assert.equal(host.factories.length, 0);
  assert.equal(owner.status().phase, "pending");
  const pending = host.pending();
  assert.equal(pending.length, 1);
  assert.equal(pending[0].delayMs, 300);
});

test("the install lands only when the scheduled delay fires", () => {
  const host = createHost();
  const owner = new HeaderOwner(host.deps, host.build);
  owner.start();
  assert.equal(host.factories.length, 0);
  host.runNext();
  assert.equal(host.factories.length, 1);
  assert.equal(owner.status().phase, "owned");
  assert.ok(host.installed);
});

test("options override the install delay, reclaim delay and budget", () => {
  const host = createHost();
  const owner = new HeaderOwner(host.deps, host.build, {
    installDelayMs: 10,
    reclaimDelayMs: 20,
    maxReclaims: 1,
  });
  owner.start();
  assert.equal(host.pending()[0].delayMs, 10);
  host.runNext();
  host.installed!.dispose();
  assert.equal(host.pending()[0].delayMs, 20);
  assert.equal(owner.status().reclaims, 1);
});

test("renders are counted, widths recorded, and the inner component is built lazily once", () => {
  const host = createHost();
  const owner = new HeaderOwner(host.deps, host.build);
  owner.start();
  host.runNext();
  const component = host.installed!;
  assert.equal(host.built, 0);
  assert.deepEqual(component.render(80), ["inner@80"]);
  assert.deepEqual(component.render(100), ["inner@100"]);
  assert.equal(host.built, 1);
  const status = owner.status();
  assert.equal(status.renders, 2);
  assert.equal(status.lastWidth, 100);
});

test("the wrapper forwards invalidate once the inner component exists", () => {
  const host = createHost();
  const owner = new HeaderOwner(host.deps, host.build);
  owner.start();
  host.runNext();
  host.installed!.render(80);
  host.installed!.invalidate?.();
  assert.equal(host.invalidated, 1);
});

test("a successful claim that never loses the slot notifies nothing", () => {
  const host = createHost();
  const owner = new HeaderOwner(host.deps, host.build);
  owner.start();
  host.runNext();
  host.installed!.render(80);
  assert.equal(host.notifications.length, 0);
});

test("a wrapper dispose schedules exactly one reclaim and notifies once", () => {
  const host = createHost();
  const owner = new HeaderOwner(host.deps, host.build);
  owner.start();
  host.runNext();
  host.installed!.dispose();
  assert.equal(owner.status().phase, "reclaiming");
  assert.equal(owner.status().reclaims, 1);
  assert.equal(host.notifications.length, 1);
  assert.equal(host.notifications[0].level, "warning");
  const pending = host.pending();
  assert.equal(pending.length, 1);
  assert.equal(pending[0].delayMs, 400);
  host.runNext();
  assert.equal(owner.status().phase, "owned");
  assert.equal(host.factories.length, 2);
  assert.equal(host.notifications.length, 1);
});

test("a second dispose of the same wrapper does not add a reclaim", () => {
  const host = createHost();
  const owner = new HeaderOwner(host.deps, host.build);
  owner.start();
  host.runNext();
  const wrapper = host.installed!;
  wrapper.dispose();
  wrapper.dispose();
  assert.equal(owner.status().reclaims, 1);
  assert.equal(host.notifications.length, 1);
});

test("the reclaim budget is enforced and gave-up schedules nothing further", () => {
  const host = createHost();
  const owner = new HeaderOwner(host.deps, host.build, { maxReclaims: 3 });
  owner.start();
  host.runNext();
  for (let attempt = 1; attempt <= 3; attempt++) {
    host.installed!.dispose();
    assert.equal(owner.status().reclaims, attempt);
    assert.equal(owner.status().phase, "reclaiming");
    host.runNext();
    assert.equal(owner.status().phase, "owned");
  }
  host.installed!.dispose();
  assert.equal(owner.status().phase, "gave-up");
  assert.equal(owner.status().reclaims, 3);
  assert.equal(host.pending().length, 0);
  assert.equal(host.notifications.length, 3);
});

test("stop before the install delay cancels it so setHeader is never called", () => {
  const host = createHost();
  const owner = new HeaderOwner(host.deps, host.build);
  owner.start();
  owner.stop();
  assert.equal(host.factories.length, 0);
  assert.equal(host.pending().length, 0);
  assert.equal(owner.status().phase, "stopped");
});

test("stop after install restores the built-in header and disposes the inner component", () => {
  const host = createHost();
  const owner = new HeaderOwner(host.deps, host.build);
  owner.start();
  host.runNext();
  const wrapper = host.installed!;
  wrapper.render(80);
  owner.stop();
  assert.equal(host.factories.length, 2);
  assert.equal(host.factories[1], undefined);
  assert.equal(host.disposed, 1);
  assert.equal(owner.status().phase, "stopped");
  wrapper.dispose();
  assert.equal(owner.status().reclaims, 0);
  assert.equal(host.notifications.length, 0);
  assert.equal(host.pending().length, 0);
});

test("stop cancels a pending reclaim", () => {
  const host = createHost();
  const owner = new HeaderOwner(host.deps, host.build);
  owner.start();
  host.runNext();
  host.installed!.dispose();
  assert.equal(host.pending().length, 1);
  owner.stop();
  assert.equal(host.pending().length, 0);
  assert.equal(owner.status().phase, "stopped");
});

test("stop is idempotent and setHeader(undefined) runs only once", () => {
  const host = createHost();
  const owner = new HeaderOwner(host.deps, host.build);
  owner.start();
  host.runNext();
  owner.stop();
  owner.stop();
  assert.equal(host.factories.length, 2);
  assert.equal(owner.status().phase, "stopped");
});

test("start after stop does not reinstall", () => {
  const host = createHost();
  const owner = new HeaderOwner(host.deps, host.build);
  owner.start();
  host.runNext();
  owner.stop();
  const factories = host.factories.length;
  owner.start();
  assert.equal(host.factories.length, factories);
  assert.equal(owner.status().phase, "stopped");
});

test("manual reclaim while stopped is a no-op", () => {
  const host = createHost();
  const owner = new HeaderOwner(host.deps, host.build);
  owner.start();
  host.runNext();
  owner.stop();
  const factories = host.factories.length;
  owner.reclaim();
  assert.equal(host.factories.length, factories);
  assert.equal(owner.status().phase, "stopped");
  assert.equal(owner.status().reclaims, 0);
});

test("manual reclaim installs immediately and cancels the pending automatic reclaim", () => {
  const host = createHost();
  const owner = new HeaderOwner(host.deps, host.build);
  owner.start();
  host.runNext();
  host.installed!.dispose();
  const before = host.factories.length;
  owner.reclaim();
  assert.equal(owner.status().phase, "owned");
  assert.equal(owner.status().reclaims, 1);
  assert.equal(host.factories.length, before + 1);
  assert.equal(host.pending().length, 0);
});

test("manual reclaim while owning replaces the header without a spurious reclaim", () => {
  const host = createHost();
  const owner = new HeaderOwner(host.deps, host.build);
  owner.start();
  host.runNext();
  owner.reclaim();
  assert.equal(owner.status().phase, "owned");
  assert.equal(owner.status().reclaims, 1);
  assert.equal(host.notifications.length, 1);
  assert.equal(host.pending().length, 0);
});

test("repeated manual reclaims exhaust the budget and report gave-up", () => {
  const host = createHost();
  const owner = new HeaderOwner(host.deps, host.build, { maxReclaims: 2 });
  owner.start();
  host.runNext();
  owner.reclaim();
  owner.reclaim();
  assert.equal(owner.status().reclaims, 2);
  assert.equal(owner.status().phase, "owned");
  owner.reclaim();
  assert.equal(owner.status().phase, "gave-up");
  assert.equal(owner.status().reclaims, 2);
  owner.reclaim();
  assert.equal(owner.status().phase, "gave-up");
  assert.equal(host.pending().length, 0);
});

test("stop before start is a no-op that leaves the header alone", () => {
  const host = createHost();
  const owner = new HeaderOwner(host.deps, host.build);
  owner.stop();
  assert.equal(host.factories.length, 0);
  assert.equal(owner.status().phase, "stopped");
  assert.equal(host.pending().length, 0);
});

test("a reclaim callback that still fires after stop cannot install", () => {
  const host = createHost();
  const owner = new HeaderOwner(host.deps, host.build);
  owner.start();
  host.runNext();
  host.installed!.dispose();
  const task = host.pending()[0];
  owner.stop();
  const factories = host.factories.length;
  // A misbehaving scheduler that ignored cancel must still be inert.
  task.fn();
  assert.equal(host.factories.length, factories);
  assert.equal(owner.status().phase, "stopped");
});

test("the Pi extension module imports under bare node and exports a factory", async () => {
  const mod = await import("../extensions/fenrir.ts");
  assert.equal(typeof mod.default, "function");
});
