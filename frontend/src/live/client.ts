import { GoogleGenAI, Modality } from "@google/genai/web";
import type { Session } from "@google/genai/web";
import { startMicCapture, type MicCapture } from "../audio/capture";
import { PcmPlayer } from "../audio/playback";
import type { SessionPayload } from "../api/session";
import type { JpegFrame } from "../vision/frames";
import {
  deriveStepPanel,
  emptyStepPanel,
  invokeTool,
  type StepPanelState,
} from "./toolsBridge";

export type TranscriptEntry = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

export type LiveClientCallbacks = {
  onStatus?: (status: string) => void;
  onError?: (message: string) => void;
  /** Upsert by id so streaming deltas update one bubble. */
  onTranscript?: (entry: TranscriptEntry) => void;
  onStepPanel?: (state: StepPanelState) => void;
};

function extractInlineAudioBase64(message: unknown): string | null {
  const msg = message as {
    serverContent?: {
      modelTurn?: {
        parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }>;
      };
    };
  };
  const parts = msg.serverContent?.modelTurn?.parts ?? [];
  for (const part of parts) {
    const data = part.inlineData?.data;
    const mime = part.inlineData?.mimeType ?? "";
    if (data && mime.startsWith("audio/")) {
      return data;
    }
  }
  return null;
}

export class LiveVoiceClient {
  private session: Session | null = null;
  private mic: MicCapture | null = null;
  private player = new PcmPlayer();
  private turn = 0;
  private userText = "";
  private assistantText = "";
  private stepPanel: StepPanelState = emptyStepPanel();

  constructor(private readonly callbacks: LiveClientCallbacks = {}) {}

  private userId(): string {
    return `user-${this.turn}`;
  }

  private assistantId(): string {
    return `assistant-${this.turn}`;
  }

  async start(payload: SessionPayload): Promise<void> {
    this.callbacks.onStatus?.("Connecting to Gemini Live…");
    this.stepPanel = emptyStepPanel();
    this.callbacks.onStepPanel?.(this.stepPanel);
    await this.player.resume();

    const ai = new GoogleGenAI({
      apiKey: payload.token,
      apiVersion: payload.api_version || "v1alpha",
    });

    this.session = await ai.live.connect({
      model: payload.model,
      config: {
        responseModalities: [Modality.AUDIO],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        contextWindowCompression: {
          slidingWindow: {},
        },
        tools: (payload.tools as never[]) ?? [],
      },
      callbacks: {
        onopen: () => {
          this.callbacks.onStatus?.("Live session open");
        },
        onmessage: (message) => {
          void this.handleMessage(message);
        },
        onerror: (e) => {
          this.callbacks.onError?.(e.message || "Live WebSocket error");
        },
        onclose: (e) => {
          this.callbacks.onStatus?.(
            e.reason ? `Session closed: ${e.reason}` : "Session closed",
          );
        },
      },
    });

    this.mic = await startMicCapture((base64Pcm) => {
      if (!this.session) return;
      try {
        this.session.sendRealtimeInput({
          audio: {
            data: base64Pcm,
            mimeType: "audio/pcm;rate=16000",
          },
        });
      } catch (err) {
        this.callbacks.onError?.(
          err instanceof Error ? err.message : "Failed to send audio",
        );
      }
    });

    this.session.sendRealtimeInput({
      text: "Please greet me, list available kits with your tools, and ask if I am assembling the Desk Lamp Mini kit.",
    });

    this.callbacks.onStatus?.("Listening — speak, Look, or ask for a step");
  }

  /** Send a JPEG keyframe for visual context (Gemini Live video input). */
  sendVideoFrame(frame: JpegFrame): boolean {
    if (!this.session) return false;
    try {
      this.session.sendRealtimeInput({
        video: {
          data: frame.base64,
          mimeType: frame.mimeType,
        },
      });
      return true;
    } catch (err) {
      this.callbacks.onError?.(
        err instanceof Error ? err.message : "Failed to send video frame",
      );
      return false;
    }
  }

  /** Light text cue after an on-demand Look (skip in continuous mode). */
  nudgeAfterLook(): void {
    if (!this.session) return;
    try {
      this.session.sendRealtimeInput({
        text: "I just sent a camera still of my workbench. Please use it.",
      });
    } catch (err) {
      this.callbacks.onError?.(
        err instanceof Error ? err.message : "Failed to send look nudge",
      );
    }
  }

  private async handleToolCall(message: {
    toolCall?: {
      functionCalls?: Array<{
        id?: string;
        name?: string;
        args?: Record<string, unknown>;
      }>;
    };
  }): Promise<void> {
    const calls = message.toolCall?.functionCalls ?? [];
    if (!calls.length || !this.session) return;

    this.callbacks.onStatus?.(`Running tool: ${calls.map((c) => c.name).join(", ")}`);

    const functionResponses = [];
    for (const fc of calls) {
      const name = fc.name || "unknown";
      try {
        const { result } = await invokeTool(name, fc.args ?? {});
        this.stepPanel = deriveStepPanel(this.stepPanel, name, result);
        this.callbacks.onStepPanel?.(this.stepPanel);
        functionResponses.push({
          id: fc.id,
          name,
          response: { result },
        });
      } catch (err) {
        const detail = err instanceof Error ? err.message : "tool failed";
        functionResponses.push({
          id: fc.id,
          name,
          response: { error: detail },
        });
        this.callbacks.onError?.(detail);
      }
    }

    try {
      this.session.sendToolResponse({ functionResponses });
      this.callbacks.onStatus?.("Listening — speak, Look, or ask for a step");
    } catch (err) {
      this.callbacks.onError?.(
        err instanceof Error ? err.message : "Failed to send tool response",
      );
    }
  }

  private async handleMessage(message: unknown): Promise<void> {
    const msg = message as {
      toolCall?: {
        functionCalls?: Array<{
          id?: string;
          name?: string;
          args?: Record<string, unknown>;
        }>;
      };
      serverContent?: {
        interrupted?: boolean;
        turnComplete?: boolean;
        inputTranscription?: { text?: string };
        outputTranscription?: { text?: string };
      };
    };

    if (msg.toolCall?.functionCalls?.length) {
      await this.handleToolCall(msg);
    }

    if (msg.serverContent?.interrupted) {
      this.player.interrupt();
    }

    const audio = extractInlineAudioBase64(message);
    if (audio) {
      this.player.enqueueBase64Pcm(audio);
    }

    const inText = msg.serverContent?.inputTranscription?.text;
    if (inText) {
      this.userText += inText;
      this.callbacks.onTranscript?.({
        id: this.userId(),
        role: "user",
        text: this.userText.trim(),
      });
    }

    const outText = msg.serverContent?.outputTranscription?.text;
    if (outText) {
      this.assistantText += outText;
      this.callbacks.onTranscript?.({
        id: this.assistantId(),
        role: "assistant",
        text: this.assistantText.trim(),
      });
    }

    if (msg.serverContent?.turnComplete) {
      this.turn += 1;
      this.userText = "";
      this.assistantText = "";
    }
  }

  async stop(): Promise<void> {
    this.mic?.stop();
    this.mic = null;
    try {
      this.session?.close();
    } catch {
      /* ignore */
    }
    this.session = null;
    await this.player.close();
    this.stepPanel = emptyStepPanel();
    this.callbacks.onStepPanel?.(this.stepPanel);
    this.callbacks.onStatus?.("Idle");
  }
}
