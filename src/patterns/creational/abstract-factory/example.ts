// [button]
interface Button {
  render(): string;
}
// [/button]

// [checkbox]
interface Checkbox {
  render(): string;
}
// [/checkbox]

// [uiFactory]
interface UIFactory {
  createButton(): Button;
  createCheckbox(): Checkbox;
}
// [/uiFactory]

// [lightFactory]
class LightButton implements Button {
  render() {
    return "button [light]";
  }
}

class LightCheckbox implements Checkbox {
  render() {
    return "checkbox [light]";
  }
}

class LightFactory implements UIFactory {
  createButton(): Button {
    return new LightButton();
  }
  createCheckbox(): Checkbox {
    return new LightCheckbox();
  }
}
// [/lightFactory]

// [darkFactory]
class DarkButton implements Button {
  render() {
    return "button [dark]";
  }
}

class DarkCheckbox implements Checkbox {
  render() {
    return "checkbox [dark]";
  }
}

class DarkFactory implements UIFactory {
  createButton(): Button {
    return new DarkButton();
  }
  createCheckbox(): Checkbox {
    return new DarkCheckbox();
  }
}
// [/darkFactory]

// Usage
// [usage]
// [client]
function renderDialog(factory: UIFactory) {
  const button = factory.createButton();
  const checkbox = factory.createCheckbox();
  return [button.render(), checkbox.render()];
}
// [/client]

function getUserTheme(): "light" | "dark" {
  return "dark"; // stand-in for a real preference lookup
}

const theme: "light" | "dark" = getUserTheme();
const factory: UIFactory = theme === "dark" ? new DarkFactory() : new LightFactory();

renderDialog(factory); // ["button [dark]", "checkbox [dark]"]

// Switch the whole family just by swapping the factory:
renderDialog(new LightFactory()); // ["button [light]", "checkbox [light]"]
// [/usage]
