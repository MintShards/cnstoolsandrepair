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

/** The components whose model field is filled on a tool, in display order. */
export const componentsOnTool = (tool) =>
  HATHORN_COMPONENTS.filter((c) => (tool?.[c.modelField] || '').trim()).map((c) => c.component);

// The colour each component wears in the admin UI (never on a print): the
// Suggested Parts group headings, the chips' left edge, the tool card's chip
// and the Parts Library model badge. Dark jewel tones that sit with the
// site's blue and slate — navy, plum, petrol — chosen to stay clear of the
// colours the app already gives a meaning (green = already on this tool /
// installed, amber = warnings, red = out of stock, blue = primary, orange =
// ordered, cyan = received; petrol is darker and greener than that cyan).
// The shop picked this set over neutral slate, navy/olive/brown and
// gunmetal/bronze/petrol after seeing each on dev.
export const COMPONENT_STYLES = {
  controller: { // navy
    dot: 'bg-indigo-800 dark:bg-indigo-300',
    edge: 'border-l-indigo-800 dark:border-l-indigo-300',
    text: 'text-indigo-900 dark:text-indigo-200',
    pill: 'bg-indigo-100 text-indigo-900 dark:bg-indigo-900/60 dark:text-indigo-200',
  },
  reel: { // plum
    dot: 'bg-purple-800 dark:bg-purple-300',
    edge: 'border-l-purple-800 dark:border-l-purple-300',
    text: 'text-purple-900 dark:text-purple-200',
    pill: 'bg-purple-100 text-purple-900 dark:bg-purple-900/60 dark:text-purple-200',
  },
  camera_head: { // petrol
    dot: 'bg-teal-800 dark:bg-teal-300',
    edge: 'border-l-teal-800 dark:border-l-teal-300',
    text: 'text-teal-900 dark:text-teal-200',
    pill: 'bg-teal-100 text-teal-900 dark:bg-teal-900/60 dark:text-teal-200',
  },
};
