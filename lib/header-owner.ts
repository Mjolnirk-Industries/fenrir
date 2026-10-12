// Ownership state machine for Pi's single header slot.
//
// Pi replaces the header on every `setHeader`, and it disposes the previous
// custom component first. Another extension (gentle-shell's banner) installs
// itself from a deferred timer, so a synchronous install loses the race: this
// owner installs from its own timer and treats the wrapper's `dispose()` as the
// "I lost the slot" signal. Every host effect is injected, and there are no
// ambient timers, so the whole machine is testable without Pi.

export interface HeaderComponent {
  render(width: number): string[];
  invalidate?(): void;
  dispose?(): void;
}

export interface HeaderOwnerDeps {
  /** Maps to ctx.ui.setHeader. `undefined` restores Pi's built-in header. */
  setHeader(factory: ((tui: unknown, theme: unknown) => HeaderComponent) | undefined): void;
  schedule(fn: () => void, delayMs: number): unknown;
  cancel(handle: unknown): void;
  notify(message: string, level?: "info" | "warning"): void;
}

export interface HeaderOwnerOptions {
  installDelayMs?: number;
  reclaimDelayMs?: number;
  maxReclaims?: number;
}

export type HeaderOwnerPhase =
  | "idle"
  | "pending"
  | "owned"
  | "reclaiming"
  | "gave-up"
  | "stopped";

export interface HeaderOwnerStatus {
  phase: HeaderOwnerPhase;
  reclaims: number;
  renders: number;
  lastWidth: number | null;
}

const DEFAULT_INSTALL_DELAY_MS = 300;
const DEFAULT_RECLAIM_DELAY_MS = 400;
const DEFAULT_MAX_RECLAIMS = 3;

export class HeaderOwner {
  private readonly deps: HeaderOwnerDeps;
  private readonly build: (tui: unknown, theme: unknown) => HeaderComponent;
  private readonly installDelayMs: number;
  private readonly reclaimDelayMs: number;
  private readonly maxReclaims: number;

  private phase: HeaderOwnerPhase = "idle";
  private reclaims = 0;
  private renders = 0;
  private lastWidth: number | null = null;

  private installHandle: unknown = null;
  private reclaimHandle: unknown = null;
  private wrapper: HeaderComponent | null = null;
  private inner: HeaderComponent | null = null;

  constructor(
    deps: HeaderOwnerDeps,
    build: (tui: unknown, theme: unknown) => HeaderComponent,
    options: HeaderOwnerOptions = {},
  ) {
    this.deps = deps;
    this.build = build;
    this.installDelayMs = options.installDelayMs ?? DEFAULT_INSTALL_DELAY_MS;
    this.reclaimDelayMs = options.reclaimDelayMs ?? DEFAULT_RECLAIM_DELAY_MS;
    this.maxReclaims = options.maxReclaims ?? DEFAULT_MAX_RECLAIMS;
  }

  /** Install nothing now; land after the upstream deferred install instead. */
  start(): void {
    if (this.phase !== "idle") return;
    this.phase = "pending";
    this.installHandle = this.deps.schedule(() => {
      this.installHandle = null;
      this.install();
    }, this.installDelayMs);
  }

  /**
   * Cancel every pending timer, give the slot back if we still hold it, and
   * dispose the inner component. The wrapper dispose triggered by restoring the
   * built-in header must not be read as a loss, so the phase is flipped before
   * the host can call back into it.
   */
  stop(): void {
    if (this.phase === "stopped") return;
    this.phase = "stopped";
    this.clearHandle("install");
    this.clearHandle("reclaim");

    const owned = this.wrapper !== null;
    this.wrapper = null;
    if (owned) this.deps.setHeader(undefined);

    this.disposeInner();
  }

  /**
   * Manual path used by /fenrir:reinstall. Installs immediately without waiting,
   * still bounded by the same reclaim budget, and a no-op once stopped.
   */
  reclaim(): void {
    if (this.phase === "stopped" || this.phase === "gave-up") return;
    const hadPendingReclaim = this.reclaimHandle !== null;
    this.clearHandle("install");
    this.clearHandle("reclaim");
    // Drop the old wrapper before the host disposes it, so replacing our own
    // header is not mistaken for losing the slot.
    this.wrapper = null;

    // A pending automatic reclaim was already counted and notified when the
    // slot was lost; do the same attempt now instead of spending budget twice.
    if (hadPendingReclaim) {
      this.install();
      return;
    }

    if (this.reclaims >= this.maxReclaims) {
      this.phase = "gave-up";
      return;
    }
    this.reclaims += 1;
    this.deps.notify(this.reclaimMessage(), "warning");
    this.install();
  }

  status(): HeaderOwnerStatus {
    return {
      phase: this.phase,
      reclaims: this.reclaims,
      renders: this.renders,
      lastWidth: this.lastWidth,
    };
  }

  private install(): void {
    if (this.phase === "stopped") return;
    const owner = this;
    this.deps.setHeader((tui, theme) => {
      let wrapper: HeaderComponent;
      wrapper = {
        render(width: number): string[] {
          if (owner.inner === null) owner.inner = owner.build(tui, theme);
          owner.renders += 1;
          owner.lastWidth = width;
          return owner.inner.render(width);
        },
        invalidate(): void {
          owner.inner?.invalidate?.();
        },
        dispose(): void {
          owner.onWrapperDisposed(wrapper);
        },
      };
      owner.wrapper = wrapper;
      return wrapper;
    });
    this.phase = "owned";
  }

  private onWrapperDisposed(wrapper: HeaderComponent): void {
    // Ignore a stale wrapper (e.g. the host disposing an already-replaced one).
    if (this.wrapper !== wrapper) return;
    this.wrapper = null;
    if (this.phase === "stopped" || this.phase === "gave-up") return;
    if (this.reclaims >= this.maxReclaims) {
      this.phase = "gave-up";
      return;
    }

    this.reclaims += 1;
    this.phase = "reclaiming";
    this.deps.notify(this.reclaimMessage(), "warning");
    this.reclaimHandle = this.deps.schedule(() => {
      this.reclaimHandle = null;
      this.install();
    }, this.reclaimDelayMs);
  }

  private reclaimMessage(): string {
    return `Fenrir header lost the slot; reclaiming (${this.reclaims}/${this.maxReclaims}).`;
  }

  private disposeInner(): void {
    const inner = this.inner;
    this.inner = null;
    inner?.dispose?.();
  }

  private clearHandle(which: "install" | "reclaim"): void {
    if (which === "install") {
      if (this.installHandle !== null) {
        this.deps.cancel(this.installHandle);
        this.installHandle = null;
      }
      return;
    }
    if (this.reclaimHandle !== null) {
      this.deps.cancel(this.reclaimHandle);
      this.reclaimHandle = null;
    }
  }
}
