import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";

export type CameraPreviewHandle = {
  getVideo: () => HTMLVideoElement | null;
};

type Props = {
  stream: MediaStream | null;
  lastSentAt: number | null;
  continuous: boolean;
  onContinuousChange: (value: boolean) => void;
  onLook: () => void;
  lookDisabled: boolean;
};

export const CameraPreview = forwardRef<CameraPreviewHandle, Props>(
  function CameraPreview(
    { stream, lastSentAt, continuous, onContinuousChange, onLook, lookDisabled },
    ref,
  ) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useImperativeHandle(ref, () => ({
      getVideo: () => videoRef.current,
    }));

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      if (stream) {
        void video.play().catch(() => {
          /* autoplay may require gesture; session start counts */
        });
      }
      return () => {
        video.srcObject = null;
      };
    }, [stream]);

    return (
      <section className="camera">
        <div className="camera-frame">
          {stream ? (
            <video ref={videoRef} className="camera-video" playsInline muted autoPlay />
          ) : (
            <div className="camera-placeholder">
              <p>Camera starts with the session.</p>
            </div>
          )}
        </div>
        <div className="camera-actions">
          <button
            type="button"
            className="btn secondary"
            disabled={lookDisabled || !stream}
            onClick={onLook}
          >
            Look
          </button>
          <label className="toggle">
            <input
              type="checkbox"
              checked={continuous}
              disabled={!stream}
              onChange={(e) => onContinuousChange(e.target.checked)}
            />
            <span>Continuous (~1 FPS)</span>
          </label>
          {lastSentAt ? (
            <span className="camera-meta">
              Last frame {new Date(lastSentAt).toLocaleTimeString()}
            </span>
          ) : (
            <span className="camera-meta">No frame sent yet</span>
          )}
        </div>
      </section>
    );
  },
);
