# Underscore-prefixed sentinel: by convention only get_instance() passes it.
# This blocks an accidental AppConfig() call, not a deliberate bypass —
# Python cannot make a constructor truly private.
_CREATE = object()


# [config]
class AppConfig:
    _instance: "AppConfig | None" = None

    # [class]
    # Python has no private constructors, so a runtime guard stands in:
    # __init__ refuses to run unless it is handed the module-private key.
    def __init__(self, key: object = None) -> None:
        if key is not _CREATE:
            raise RuntimeError("AppConfig is a singleton — use AppConfig.get_instance() instead of AppConfig()")
        self._settings: dict[str, str] = {"apiUrl": "https://api.example.com"}
    # [/class]

    # [getInstance]
    @classmethod
    def get_instance(cls) -> "AppConfig":
        if cls._instance is None:
            cls._instance = cls(_CREATE)
        return cls._instance
    # [/getInstance]

    def get(self, key: str) -> str | None:
        return self._settings.get(key)

    def set(self, key: str, value: str) -> None:
        self._settings[key] = value
# [/config]


# [userService]
class UserService:
    def __init__(self) -> None:
        self._config = AppConfig.get_instance()

    def api_url(self) -> str | None:
        return self._config.get("apiUrl")
# [/userService]


# [paymentService]
class PaymentService:
    def __init__(self) -> None:
        self._config = AppConfig.get_instance()

    def api_url(self) -> str | None:
        return self._config.get("apiUrl")

    def update_api_url(self, url: str) -> None:
        self._config.set("apiUrl", url)
# [/paymentService]


# Usage
# [usage]
users = UserService()
payments = PaymentService()

users.api_url()  # "https://api.example.com"
payments.api_url()  # the exact same value, from the exact same object

payments.update_api_url("https://updated.example.com")
users.api_url()  # "https://updated.example.com" — set via PaymentService, seen through UserService

# AppConfig()  # raises RuntimeError: use get_instance() instead
# [/usage]
