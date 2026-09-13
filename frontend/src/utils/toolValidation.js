// Client-side mirror of the backend's tool identity rules (ToolItemCreate +
// require_identity in models/repair.py), so the form can point at the exact
// field that is missing instead of surfacing a generic server message.

const isHathorn = (tool) => /hathorn/i.test(tool?.brand || '');

const hasComponent = (tool) => [
  tool.camera_head_model, tool.camera_head_serial,
  tool.controller_model, tool.controller_serial,
  tool.reel_model, tool.reel_serial,
].some((v) => v?.trim());

export const TOOL_FIELD_LABELS = {
  tool_type: 'Tool Type',
  brand: 'Brand',
  model_number: 'Model Number',
  hathorn_identity: 'at least one Hathorn component model or serial (camera head, controller, or reel)',
};

/** Keys of the required fields this tool is still missing, in form order. */
export function toolProblems(tool) {
  const problems = [];
  if (!tool?.tool_type?.trim()) problems.push('tool_type');
  if (!tool?.brand?.trim()) problems.push('brand');
  if (isHathorn(tool)) {
    if (!hasComponent(tool)) problems.push('hathorn_identity');
  } else if (!tool?.model_number?.trim()) {
    problems.push('model_number');
  }
  return problems;
}

/** One toast-sized sentence naming what is missing, e.g. for "Tool 2". */
export function describeToolProblems(problems, toolLabel = null) {
  const prefix = toolLabel ? `${toolLabel}: ` : '';
  const plain = problems.filter((p) => p !== 'hathorn_identity').map((p) => TOOL_FIELD_LABELS[p]);
  const parts = [];
  if (plain.length) parts.push(`${plain.join(', ')} ${plain.length === 1 ? 'is' : 'are'} required`);
  if (problems.includes('hathorn_identity')) parts.push(`enter ${TOOL_FIELD_LABELS.hathorn_identity}`);
  return prefix + parts.join('; ') + '.';
}

/**
 * Bring the first highlighted field into view. The add/edit tool modal is
 * tall enough that the offending field can sit above the fold when the
 * submit button at the bottom is what was just clicked. Runs after React
 * has painted the highlight.
 */
export function scrollToFirstProblem() {
  requestAnimationFrame(() => {
    const el = document.querySelector('[aria-invalid="true"], [role="alert"]');
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
}
