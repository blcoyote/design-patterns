// [command]
interface Command {
  execute(): void;
  undo(): void;
}
// [/command]

// [light]
class Light {
  private isOn = false;

  get on(): boolean {
    return this.isOn;
  }

  turnOn() {
    this.isOn = true;
    console.log("light: on");
  }

  turnOff() {
    this.isOn = false;
    console.log("light: off");
  }
}
// [/light]

// [onCommand]
class LightOnCommand implements Command {
  // One saved state per execute(): the same command object can be pressed again before undo.
  private previous: boolean[] = [];

  constructor(private light: Light) {}

  execute() {
    this.previous.push(this.light.on); // remember what execute() is about to overwrite
    this.light.turnOn();
  }

  undo() {
    if (this.previous.pop() === false) this.light.turnOff();
  }
}
// [/onCommand]

// [offCommand]
class LightOffCommand implements Command {
  // One saved state per execute(): the same command object can be pressed again before undo.
  private previous: boolean[] = [];

  constructor(private light: Light) {}

  execute() {
    this.previous.push(this.light.on); // remember what execute() is about to overwrite
    this.light.turnOff();
  }

  undo() {
    if (this.previous.pop() === true) this.light.turnOn();
  }
}
// [/offCommand]

// [remote]
class RemoteButton {
  private current: Command | null = null;
  private history: Command[] = [];

  // [setCommand]
  setCommand(command: Command) {
    this.current = command;
  }
  // [/setCommand]

  // [execute]
  press() {
    if (!this.current) return;
    this.current.execute();
    this.history.push(this.current);
  }
  // [/execute]

  // [undo]
  undoLast() {
    const command = this.history.pop();
    command?.undo();
  }
  // [/undo]
}
// [/remote]

// Usage
// [createCommands]
const light = new Light();
const on = new LightOnCommand(light);
const off = new LightOffCommand(light);
// [/createCommands]

const remote = new RemoteButton();

remote.setCommand(on);
remote.press(); // light turns on, pushed onto history

remote.setCommand(off);
remote.press(); // light turns off, pushed onto history

remote.undoLast(); // pops LightOffCommand, calls undo() -> light turns back on
