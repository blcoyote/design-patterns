// [command]
interface Command {
  execute(): () => void;
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
  constructor(private light: Light) {}

  execute(): () => void {
    const wasOn = this.light.on;
    this.light.turnOn();
    return () => {
      if (!wasOn) this.light.turnOff();
    };
  }
}
// [/onCommand]

// [offCommand]
class LightOffCommand implements Command {
  constructor(private light: Light) {}

  execute(): () => void {
    const wasOn = this.light.on;
    this.light.turnOff();
    return () => {
      if (wasOn) this.light.turnOn();
    };
  }
}
// [/offCommand]

// [remote]
class RemoteButton {
  private current: Command | null = null;
  private history: Array<() => void> = [];

  // [setCommand]
  setCommand(command: Command) {
    this.current = command;
  }
  // [/setCommand]

  // [execute]
  press() {
    if (!this.current) return;
    this.history.push(this.current.execute());
  }
  // [/execute]

  // [undo]
  undoLast() {
    const undo = this.history.pop();
    undo?.();
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
