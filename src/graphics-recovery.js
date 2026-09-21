// A lost WebGL context must not look like a running match with a blank canvas.
// Three.js restores its GL state; the application rebuilds render-target data.
export class GraphicsRecovery {
  constructor(canvas, { pause, restore }) {
    this.canvas = canvas;
    this.pause = pause;
    this.restore = restore;
    this.blocked = false;
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      this.fail(new Error("The browser lost its graphics context."), true);
    });
    canvas.addEventListener("webglcontextrestored", () =>
      queueMicrotask(() => this.retry(true)),
    );
  }
  fail(error, lost = false) {
    if (this.blocked) return;
    this.blocked = true;
    this.pause();
    document.exitPointerLock?.();
    // Diagnostic detail is retained locally, never sent to a remote service.
    this.lastError = {
      message: String(error?.message || error),
      time: new Date().toISOString(),
      contextLost: lost,
    };
    console.warn("CROSSLINE graphics paused", this.lastError);
    this.panel = document.createElement("section");
    this.panel.id = "graphics-recovery";
    this.panel.setAttribute("role", "alert");
    this.panel.innerHTML = `<div class="panel"><div class="eyebrow">GRAPHICS RECOVERY</div><h2>Rendering paused</h2><p class="recovery-message"></p><p>Your room connection remains active. Your player is still in the match.</p><button class="primary recovery-retry">RETRY WITH LOW GRAPHICS</button><p class="muted">If this keeps happening, reload the page and rejoin the room. Chrome requires WebGL 2 and hardware acceleration.</p></div>`;
    this.panel.querySelector(".recovery-message").textContent = lost
      ? "The graphics driver was interrupted. Waiting for the browser to restore it…"
      : "A rendering error was caught. You can retry without leaving the room.";
    this.panel.querySelector("button").onclick = () => this.retry(false);
    document.body.append(this.panel);
  }
  async retry(contextRestored = false) {
    if (!this.blocked || this.recovering) return;
    this.recovering = true;
    const button = this.panel?.querySelector("button");
    if (button) button.disabled = true;
    try {
      await this.restore(contextRestored);
      this.blocked = false;
      this.panel?.remove();
      this.panel = null;
    } catch (error) {
      if (this.panel)
        this.panel.querySelector(".recovery-message").textContent =
          `Recovery could not finish: ${error.message}. Try again, or reload and rejoin your room.`;
    } finally {
      this.recovering = false;
      if (button) button.disabled = false;
    }
  }
}
