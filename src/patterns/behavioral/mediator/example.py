from typing import Protocol


# [mediatorIface]
# A marker type every widget satisfies, so the mediator can accept
# "some colleague" without depending on any concrete widget class.
class Colleague(Protocol):
    pass


class Mediator(Protocol):
    def notify(self, sender: Colleague, event: str) -> None: ...
# [/mediatorIface]


# [dialog]
class LoginDialog:
    def __init__(self) -> None:
        # [holds]
        # Exposed as plain public attributes so a caller can drive the demo
        # widgets directly (dialog.username.type(...)) — the dialog still
        # owns construction and wiring, which is all Mediator actually requires.
        self.username = UsernameField(self)
        self.password = PasswordField(self)
        self.checkbox = RememberMeCheckbox(self)
        self.submit = SubmitButton(self)
        # [/holds]

    # [notify]
    def notify(self, sender: Colleague, event: str) -> None:
        if sender is self.username and event == "changed":
            # [enable]
            self.submit.set_enabled(len(self.username.value) > 0)
            # [/enable]
        if sender is self.checkbox and event == "toggled":
            # [focus]
            if self.checkbox.checked:
                self.password.focus()
            # [/focus]
    # [/notify]
# [/dialog]


# [username]
class UsernameField:
    def __init__(self, mediator: Mediator) -> None:
        self.value = ""
        self._mediator = mediator

    def type(self, value: str) -> None:
        self.value = value
        self._mediator.notify(self, "changed")
# [/username]


# [password]
class PasswordField:
    def __init__(self, mediator: Mediator) -> None:
        self._mediator = mediator

    def focus(self) -> None:
        print("password: focused")
# [/password]


# [checkbox]
class RememberMeCheckbox:
    def __init__(self, mediator: Mediator) -> None:
        self.checked = False
        self._mediator = mediator

    def toggle(self) -> None:
        self.checked = not self.checked
        self._mediator.notify(self, "toggled")
# [/checkbox]


# [submit]
class SubmitButton:
    def __init__(self, mediator: Mediator) -> None:
        self.enabled = False
        self._mediator = mediator

    def set_enabled(self, enabled: bool) -> None:
        self.enabled = enabled
        print(f"submit: enabled = {str(enabled).lower()}")
# [/submit]


# [usage]
# Usage — widgets are only ever handed the mediator, never each other
dialog = LoginDialog()

dialog.username.type("ada")  # submit: enabled = true
dialog.checkbox.toggle()  # password: focused
# [/usage]
