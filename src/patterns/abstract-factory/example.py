from typing import Literal, Protocol


# [button]
class Button(Protocol):
    def render(self) -> str: ...
# [/button]


# [checkbox]
class Checkbox(Protocol):
    def render(self) -> str: ...
# [/checkbox]


# [uiFactory]
class UIFactory(Protocol):
    def create_button(self) -> Button: ...
    def create_checkbox(self) -> Checkbox: ...
# [/uiFactory]


# [lightFactory]
class LightButton:
    def render(self) -> str:
        return 'button [light]'


class LightCheckbox:
    def render(self) -> str:
        return 'checkbox [light]'


class LightFactory:
    def create_button(self) -> Button:
        return LightButton()

    def create_checkbox(self) -> Checkbox:
        return LightCheckbox()
# [/lightFactory]


# [darkFactory]
class DarkButton:
    def render(self) -> str:
        return 'button [dark]'


class DarkCheckbox:
    def render(self) -> str:
        return 'checkbox [dark]'


class DarkFactory:
    def create_button(self) -> Button:
        return DarkButton()

    def create_checkbox(self) -> Checkbox:
        return DarkCheckbox()
# [/darkFactory]


# Usage
# [usage]
# [client]
def render_dialog(factory: UIFactory) -> list[str]:
    button = factory.create_button()
    checkbox = factory.create_checkbox()
    return [button.render(), checkbox.render()]
# [/client]


def get_user_theme() -> Literal['light', 'dark']:
    return 'dark'


theme: Literal['light', 'dark'] = get_user_theme()
factory: UIFactory = DarkFactory() if theme == 'dark' else LightFactory()

print(render_dialog(factory))  # ['button [dark]', 'checkbox [dark]']

# Switch the whole family just by swapping the factory:
print(render_dialog(LightFactory()))  # ['button [light]', 'checkbox [light]']
# [/usage]
