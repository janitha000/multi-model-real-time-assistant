import type { StepPanelState } from "../live/toolsBridge";

type Props = {
  state: StepPanelState;
};

export function StepPanel({ state }: Props) {
  const hasStep = state.stepNumber != null && state.stepTitle;
  const hasAnything =
    hasStep || state.checklistSummary || state.manualName || state.lastTool;

  if (!hasAnything) {
    return (
      <aside className="step-panel empty">
        <p className="step-panel-label">Current step</p>
        <p className="step-panel-hint">
          When Aria loads a kit step via tools, it will show here.
        </p>
      </aside>
    );
  }

  return (
    <aside className="step-panel">
      <p className="step-panel-label">Current step</p>
      {state.manualName ? (
        <p className="step-kit">{state.manualName}</p>
      ) : null}
      {hasStep ? (
        <>
          <h2>
            Step {state.stepNumber}: {state.stepTitle}
          </h2>
          {state.instructions ? <p className="step-body">{state.instructions}</p> : null}
          {state.tip ? <p className="step-tip">Tip: {state.tip}</p> : null}
          {state.parts.length > 0 ? (
            <ul className="step-parts">
              {state.parts.map((part) => (
                <li key={part}>{part}</li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
      {state.checklistSummary ? (
        <p className="step-checklist">{state.checklistSummary}</p>
      ) : null}
      {state.lastTool ? (
        <p className="step-tool">Last tool: {state.lastTool}</p>
      ) : null}
    </aside>
  );
}
