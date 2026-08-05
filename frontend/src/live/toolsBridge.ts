export type ToolCallArgs = Record<string, unknown>;

export type ToolInvokeResult = {
  name: string;
  result: Record<string, unknown>;
};

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";

export async function invokeTool(
  name: string,
  args: ToolCallArgs = {},
): Promise<ToolInvokeResult> {
  const res = await fetch(`${apiBase}/api/tools/invoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, args }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Tool invoke failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<ToolInvokeResult>;
}

export type StepPanelState = {
  manualId: string | null;
  manualName: string | null;
  stepNumber: number | null;
  stepTitle: string | null;
  instructions: string | null;
  tip: string | null;
  parts: string[];
  checklistSummary: string | null;
  lastTool: string | null;
};

export function emptyStepPanel(): StepPanelState {
  return {
    manualId: null,
    manualName: null,
    stepNumber: null,
    stepTitle: null,
    instructions: null,
    tip: null,
    parts: [],
    checklistSummary: null,
    lastTool: null,
  };
}

/** Derive sidebar UI state from tool results. */
export function deriveStepPanel(
  prev: StepPanelState,
  toolName: string,
  result: Record<string, unknown>,
): StepPanelState {
  const next: StepPanelState = { ...prev, lastTool: toolName };

  if (toolName === "get_assembly_step" && !result.error) {
    const step = result.step as Record<string, unknown> | undefined;
    const parts = (result.parts as Array<{ id?: string; name?: string }>) ?? [];
    next.manualId = String(result.manual_id ?? prev.manualId ?? "");
    next.manualName = String(result.manual_name ?? prev.manualName ?? "");
    next.stepNumber = step?.number != null ? Number(step.number) : prev.stepNumber;
    next.stepTitle = step?.title != null ? String(step.title) : prev.stepTitle;
    next.instructions =
      step?.instructions != null ? String(step.instructions) : prev.instructions;
    next.tip = step?.tip != null ? String(step.tip) : null;
    next.parts = parts.map((p) => p.name || p.id || "").filter(Boolean);
  }

  if (toolName === "get_checklist" && !result.error) {
    next.manualId = String(result.manual_id ?? prev.manualId ?? "");
    next.manualName = String(result.manual_name ?? prev.manualName ?? "");
    const done = Number(result.completed_count ?? 0);
    const rem = Number(result.remaining_count ?? 0);
    const nxt = result.next_step;
    next.checklistSummary = result.all_done
      ? "All steps complete"
      : `${done} done · ${rem} left · next step ${String(nxt)}`;
  }

  if (toolName === "list_manuals" && Array.isArray(result.manuals)) {
    const manuals = result.manuals as Array<{ id?: string; name?: string }>;
    if (manuals.length === 1) {
      next.manualId = manuals[0]?.id ?? next.manualId;
      next.manualName = manuals[0]?.name ?? next.manualName;
    }
  }

  if (toolName === "lookup_part" && Array.isArray(result.matches)) {
    const matches = result.matches as Array<{ name?: string; id?: string }>;
    if (matches[0]) {
      next.lastTool = `lookup_part → ${matches[0].name || matches[0].id}`;
    }
  }

  return next;
}
