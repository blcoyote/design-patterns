// In production C# you'd often reach for the lazy-initialization helper
// Lazy<T> (thread-safe by default) instead of hand-rolling the null check,
// but we keep the explicit pattern structure here for clarity.

// Usage (top-level statements must come before type declarations in a
// C# file, so this runs first even though it reads last).
// [usage]
var users = new UserService();
var payments = new PaymentService();

Console.WriteLine(users.ApiUrl()); // "https://api.example.com"
Console.WriteLine(payments.ApiUrl()); // the exact same value, from the exact same object

payments.UpdateApiUrl("https://updated.example.com");
Console.WriteLine(users.ApiUrl()); // "https://updated.example.com" — set via PaymentService, seen through UserService

// new AppConfig() // compile error: constructor is private
// [/usage]

// [config]
class AppConfig
{
    private static AppConfig? _instance;

    private readonly Dictionary<string, string> _settings = new();

    // [class]
    // A private constructor blocks `new AppConfig()` from outside this class.
    private AppConfig()
    {
        _settings["apiUrl"] = "https://api.example.com";
    }
    // [/class]

    // [getInstance]
    public static AppConfig GetInstance()
    {
        return _instance ??= new AppConfig();
    }
    // [/getInstance]

    public string? Get(string key) => _settings.GetValueOrDefault(key);

    public void Set(string key, string value) => _settings[key] = value;
}
// [/config]

// [userService]
class UserService
{
    private readonly AppConfig _config = AppConfig.GetInstance();

    public string? ApiUrl() => _config.Get("apiUrl");
}
// [/userService]

// [paymentService]
class PaymentService
{
    private readonly AppConfig _config = AppConfig.GetInstance();

    public string? ApiUrl() => _config.Get("apiUrl");

    public void UpdateApiUrl(string url) => _config.Set("apiUrl", url);
}
// [/paymentService]
