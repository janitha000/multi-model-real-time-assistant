const OUTPUT_RATE = 24_000;

function base64ToInt16(base64: string): Int16Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

/**
 * Queued PCM playback at 24 kHz with interrupt-safe flush.
 */
export class PcmPlayer {
  private context: AudioContext | null = null;
  private nextTime = 0;
  private sources: AudioBufferSourceNode[] = [];

  private ensureContext(): AudioContext {
    if (!this.context || this.context.state === "closed") {
      this.context = new AudioContext({ sampleRate: OUTPUT_RATE });
      this.nextTime = 0;
    }
    return this.context;
  }

  async resume(): Promise<void> {
    const ctx = this.ensureContext();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
  }

  enqueueBase64Pcm(base64: string): void {
    const ctx = this.ensureContext();
    const pcm = base64ToInt16(base64);
    const buffer = ctx.createBuffer(1, pcm.length, OUTPUT_RATE);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i += 1) {
      channel[i] = (pcm[i] ?? 0) / 0x8000;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const startAt = Math.max(this.nextTime, ctx.currentTime + 0.02);
    source.start(startAt);
    this.nextTime = startAt + buffer.duration;
    this.sources.push(source);
    source.onended = () => {
      this.sources = this.sources.filter((s) => s !== source);
    };
  }

  /** Drop all buffered/scheduled audio immediately (barge-in). */
  interrupt(): void {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    }
    this.sources = [];
    if (this.context) {
      this.nextTime = this.context.currentTime;
    }
  }

  async close(): Promise<void> {
    this.interrupt();
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
  }
}
