// [model]
/**
 * The entire application state, as one immutable value. Nothing outside update()
 * is ever allowed to mutate a Model — a new Model is always a new object.
 */
interface Todo {
  readonly id: number;
  readonly text: string;
  readonly done: boolean;
}

interface Model {
  readonly todos: readonly Todo[];
  readonly nextId: number;
  readonly lastSaved: number | null;
}
// [/model]

// [msg]
/**
 * Messages are data describing intent, not method calls — the Command pattern's
 * "encapsulate a request as an object" taken to its logical extreme. The client
 * never calls a method on the model; it builds one of these and dispatches it.
 */
type Msg =
  { type: "add"; text: string } | { type: "toggle"; id: number } | { type: "saved"; id: number };

/**
 * A Cmd is likewise a description of an effect to perform, not the effect itself.
 * update() never touches the outside world — it only ever returns Cmds for the
 * runtime to carry out.
 */
type Cmd = { type: "save"; id: number };
// [/msg]

// [update]
/**
 * The pure core: (model, msg) -> (model, cmds). Same inputs, same outputs, forever.
 * No I/O, no randomness, no clock — an explicit state machine (every Msg maps to
 * exactly one transition) with the transition function made a first-class value.
 */
function update(model: Model, msg: Msg): [Model, readonly Cmd[]] {
  switch (msg.type) {
    case "add": {
      const todo: Todo = { id: model.nextId, text: msg.text, done: false };
      const next: Model = { ...model, todos: [...model.todos, todo], nextId: model.nextId + 1 };
      return [next, [{ type: "save", id: todo.id }]];
    }
    case "toggle": {
      const todos = model.todos.map((t) => (t.id === msg.id ? { ...t, done: !t.done } : t));
      return [{ ...model, todos }, []];
    }
    case "saved": {
      return [{ ...model, lastSaved: msg.id }, []];
    }
  }
}
// [/update]

// [view]
/**
 * The other pure function: model -> rendered text. No DOM, no console I/O —
 * view() only ever builds a string; the runtime decides what to do with it.
 */
function view(model: Model): string {
  const lines = model.todos.map((t) => `[${t.done ? "x" : " "}] ${t.text}`);
  const saved = model.lastSaved !== null ? `saved #${model.lastSaved}` : "saved: none yet";
  return [...lines, `(${saved})`].join("\n");
}
// [/view]

// [runtime]
/**
 * The imperative shell: a tiny loop that dispatches messages, calls the pure
 * update(), keeps every resulting model in history (what makes time-travel
 * possible), renders + notifies after every change, and only then performs
 * whatever Cmds came back. It is the only part of the program that does anything impure.
 */
class Runtime {
  private history: Model[];
  private cursor: number;
  private subscribers: Array<(rendered: string) => void> = [];

  constructor(initial: Model) {
    this.history = [initial];
    this.cursor = 0;
  }

  get model(): Model {
    return this.history[this.cursor];
  }

  get historyLength(): number {
    return this.history.length;
  }

  subscribe(fn: (rendered: string) => void): void {
    this.subscribers.push(fn);
  }

  dispatch(msg: Msg): void {
    const [next, cmds] = update(this.model, msg);
    // A dispatch after time-travel discards any history past the current cursor —
    // an undo-stack policy chosen for this demo (Redux DevTools keeps the later actions).
    this.history = [...this.history.slice(0, this.cursor + 1), next];
    this.cursor = this.history.length - 1;
    this.notify();
    for (const cmd of cmds) this.perform(cmd);
  }

  /** The interpreter: walks each returned Cmd and performs the matching effect. */
  private perform(cmd: Cmd): void {
    switch (cmd.type) {
      case "save": {
        // A simulated save effect: synchronous and deterministic for this demo,
        // but in a real app this would be a network call whose result arrives later.
        this.dispatch({ type: "saved", id: cmd.id });
        break;
      }
    }
  }

  /** Steps back to an earlier model without re-running update — pure time-travel. */
  timeTravel(index: number): void {
    this.cursor = index;
    this.notify();
  }

  private notify(): void {
    const rendered = view(this.model);
    for (const sub of this.subscribers) sub(rendered);
  }
}
// [/runtime]

// [usage]
const runtime = new Runtime({ todos: [], nextId: 1, lastSaved: null });
runtime.subscribe((rendered) => console.log("--- view ---\n" + rendered));

runtime.dispatch({ type: "add", text: "Buy milk" });
runtime.dispatch({ type: "toggle", id: 1 });

console.log("history length:", runtime.historyLength);

runtime.timeTravel(0);
// [/usage]
