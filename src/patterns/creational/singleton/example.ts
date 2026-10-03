// [config]
class AppConfig {
  private static instance: AppConfig | null = null

  private readonly settings = new Map<string, string>()

  // [class]
  // A private constructor blocks `new AppConfig()` from outside this class
  // (TypeScript enforces this at compile time only).
  private constructor() {
    this.settings.set('apiUrl', 'https://api.example.com')
  }
  // [/class]

  // [getInstance]
  static getInstance(): AppConfig {
    if (!AppConfig.instance) {
      AppConfig.instance = new AppConfig()
    }
    return AppConfig.instance
  }
  // [/getInstance]

  get(key: string): string | undefined {
    return this.settings.get(key)
  }

  set(key: string, value: string): void {
    this.settings.set(key, value)
  }
}
// [/config]

// [userService]
class UserService {
  private readonly config = AppConfig.getInstance()

  apiUrl(): string | undefined {
    return this.config.get('apiUrl')
  }
}
// [/userService]

// [paymentService]
class PaymentService {
  private readonly config = AppConfig.getInstance()

  apiUrl(): string | undefined {
    return this.config.get('apiUrl')
  }

  updateApiUrl(url: string): void {
    this.config.set('apiUrl', url)
  }
}
// [/paymentService]

// Usage
// [usage]
const users = new UserService()
const payments = new PaymentService()

users.apiUrl() // "https://api.example.com"
payments.apiUrl() // the exact same value, from the exact same object

payments.updateApiUrl('https://updated.example.com')
users.apiUrl() // "https://updated.example.com" — set via PaymentService, seen through UserService

// new AppConfig() // compile error: constructor is private
// [/usage]
