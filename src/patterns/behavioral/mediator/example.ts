// [mediatorIface]
// A marker interface every widget satisfies, so the mediator can accept
// "some colleague" without depending on any concrete widget class.
interface Colleague {}

interface Mediator {
  notify(sender: Colleague, event: string): void;
}
// [/mediatorIface]

// [dialog]
class LoginDialog implements Mediator {
  // [holds]
  // Exposed read-only so a caller can drive the demo widgets directly
  // (dialog.username.type(...)) — the dialog still owns construction and
  // wiring, which is all Mediator actually requires.
  readonly username = new UsernameField(this);
  readonly password = new PasswordField(this);
  readonly checkbox = new RememberMeCheckbox(this);
  readonly submit = new SubmitButton(this);
  // [/holds]

  // [notify]
  notify(sender: Colleague, event: string) {
    if (sender === this.username && event === "changed") {
      // [enable]
      this.submit.setEnabled(this.username.value.length > 0);
      // [/enable]
    }
    if (sender === this.checkbox && event === "toggled") {
      // [focus]
      if (this.checkbox.checked) this.password.focus();
      // [/focus]
    }
  }
  // [/notify]
}
// [/dialog]

// [username]
class UsernameField implements Colleague {
  value = "";
  constructor(private mediator: Mediator) {}

  type(value: string) {
    this.value = value;
    this.mediator.notify(this, "changed");
  }
}
// [/username]

// [password]
class PasswordField implements Colleague {
  constructor(private mediator: Mediator) {}

  focus() {
    console.log("password: focused");
  }
}
// [/password]

// [checkbox]
class RememberMeCheckbox implements Colleague {
  checked = false;
  constructor(private mediator: Mediator) {}

  toggle() {
    this.checked = !this.checked;
    this.mediator.notify(this, "toggled");
  }
}
// [/checkbox]

// [submit]
class SubmitButton implements Colleague {
  enabled = false;
  constructor(private mediator: Mediator) {}

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    console.log(`submit: enabled = ${enabled}`);
  }
}
// [/submit]

// [usage]
// Usage — widgets are only ever handed the mediator, never each other
const dialog = new LoginDialog();

dialog.username.type("ada"); // submit: enabled = true
dialog.checkbox.toggle(); // password: focused
// [/usage]
