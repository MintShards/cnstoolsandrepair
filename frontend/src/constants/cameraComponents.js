// The components a Hathorn camera unit is made of. A library model of that
// brand is tagged with one of them, a tool records a model + serial per
// component, and a part on a work order says which component it is for so
// the parts library files it under that component's model and no other.
export const HATHORN_COMPONENTS = [
  { component: 'controller', label: 'Controller', modelField: 'controller_model', serialField: 'controller_serial' },
  { component: 'reel', label: 'Reel', modelField: 'reel_model', serialField: 'reel_serial' },
  { component: 'camera_head', label: 'Camera Head', modelField: 'camera_head_model', serialField: 'camera_head_serial' },
];

export const COMPONENT_LABELS = Object.fromEntries(HATHORN_COMPONENTS.map((c) => [c.component, c.label]));

// How a component group and chip look in the admin UI (never on a print):
// the Suggested Parts group headings, the chips' left edge and the tool
// card's chip. Deliberately neutral, told apart by lightness — three steps
// of slate: controller dark, reel mid, camera head light (inverted in dark
// mode so the dark one stays the strongest). Coloured hues were tried and
// taken out; green stays reserved for "already on this tool".
export const COMPONENT_STYLES = {
  controller: {
    dot: 'bg-slate-800 dark:bg-slate-200',
    edge: 'border-l-slate-800 dark:border-l-slate-200',
    text: 'text-slate-800 dark:text-slate-200',
    pill: 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900',
  },
  reel: {
    dot: 'bg-slate-500 dark:bg-slate-400',
    edge: 'border-l-slate-500 dark:border-l-slate-400',
    text: 'text-slate-600 dark:text-slate-300',
    pill: 'bg-slate-500 text-white dark:bg-slate-500 dark:text-white',
  },
  camera_head: {
    dot: 'bg-slate-300 dark:bg-slate-600',
    edge: 'border-l-slate-300 dark:border-l-slate-600',
    text: 'text-slate-500 dark:text-slate-400',
    pill: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  },
};
