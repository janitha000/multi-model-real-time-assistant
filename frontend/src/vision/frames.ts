const MAX_EDGE = 768;
const JPEG_QUALITY = 0.72;

export type JpegFrame = {
  base64: string;
  mimeType: "image/jpeg";
  width: number;
  height: number;
};

/**
 * Capture a downscaled JPEG keyframe from a <video> element.
 */
export function captureJpegFromVideo(
  video: HTMLVideoElement,
  options?: { maxEdge?: number; quality?: number },
): Promise<JpegFrame | null> {
  if (!video.videoWidth || !video.videoHeight) {
    return Promise.resolve(null);
  }

  const maxEdge = options?.maxEdge ?? MAX_EDGE;
  const quality = options?.quality ?? JPEG_QUALITY;
  const scale = Math.min(1, maxEdge / Math.max(video.videoWidth, video.videoHeight));
  const width = Math.max(1, Math.round(video.videoWidth * scale));
  const height = Math.max(1, Math.round(video.videoHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return Promise.resolve(null);
  }
  ctx.drawImage(video, 0, 0, width, height);

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          resolve(null);
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result;
          if (typeof result !== "string") {
            resolve(null);
            return;
          }
          const comma = result.indexOf(",");
          const base64 = comma >= 0 ? result.slice(comma + 1) : result;
          resolve({ base64, mimeType: "image/jpeg", width, height });
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}

export type CameraStream = {
  stream: MediaStream;
  stop: () => void;
};

export async function startCameraStream(
  constraints?: MediaStreamConstraints["video"],
): Promise<CameraStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video:
      constraints ??
      ({
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      } as MediaTrackConstraints),
  });

  return {
    stream,
    stop: () => {
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}

/** ~1 FPS continuous capture helper. */
export function startFrameLoop(
  intervalMs: number,
  tick: () => void | Promise<void>,
): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const loop = async () => {
    if (cancelled) return;
    try {
      await tick();
    } finally {
      if (!cancelled) {
        timer = setTimeout(() => void loop(), intervalMs);
      }
    }
  };

  timer = setTimeout(() => void loop(), intervalMs);
  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}
