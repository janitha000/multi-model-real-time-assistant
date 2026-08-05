const TARGET_RATE = 16_000;
/** ~40 ms of mono PCM at 16 kHz */
const CHUNK_SAMPLES = 640;

function floatTo16BitPCM(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const s = Math.max(-1, Math.min(1, input[i]!));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

function downsample(
  input: Float32Array,
  inputRate: number,
  outputRate: number,
): Float32Array {
  if (inputRate === outputRate) {
    return input;
  }
  const ratio = inputRate / outputRate;
  const newLength = Math.floor(input.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i += 1) {
    const start = Math.floor(i * ratio);
    result[i] = input[start] ?? 0;
  }
  return result;
}

function int16ToBase64(samples: Int16Array): string {
  const bytes = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export type MicCapture = {
  stop: () => void;
};

/**
 * Capture mic audio as 16 kHz 16-bit PCM base64 chunks (~40 ms).
 */
export async function startMicCapture(
  onChunk: (base64Pcm: string) => void,
): Promise<MicCapture> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
    },
    video: false,
  });

  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  const silent = audioContext.createGain();
  silent.gain.value = 0;

  let pending = new Float32Array(0);

  processor.onaudioprocess = (event) => {
    const input = event.inputBuffer.getChannelData(0);
    const down = downsample(input, audioContext.sampleRate, TARGET_RATE);
    const merged = new Float32Array(pending.length + down.length);
    merged.set(pending);
    merged.set(down, pending.length);
    pending = merged;

    while (pending.length >= CHUNK_SAMPLES) {
      const slice = pending.subarray(0, CHUNK_SAMPLES);
      pending = pending.subarray(CHUNK_SAMPLES);
      const pcm = floatTo16BitPCM(slice);
      onChunk(int16ToBase64(pcm));
    }
  };

  source.connect(processor);
  processor.connect(silent);
  silent.connect(audioContext.destination);

  return {
    stop: () => {
      processor.onaudioprocess = null;
      try {
        processor.disconnect();
        source.disconnect();
        silent.disconnect();
      } catch {
        /* already closed */
      }
      stream.getTracks().forEach((t) => t.stop());
      void audioContext.close();
    },
  };
}
