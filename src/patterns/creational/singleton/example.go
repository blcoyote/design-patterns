package main

import "sync"

// [config]
type AppConfig struct {
	settings map[string]string
}

var (
	instance *AppConfig
	once     sync.Once
)

// [class]
// Go has no constructors. The lower-case newAppConfig is the only intended way
// to build one, but in package main nothing stops code from writing an
// AppConfig{} literal, so this is a convention, not enforcement (a separate
// package with unexported fields would be needed for that).
func newAppConfig() *AppConfig {
	return &AppConfig{settings: map[string]string{"apiUrl": "https://api.example.com"}}
}

// [/class]

// [getInstance]
// sync.Once makes the lazy creation safe even when called from many goroutines.
func GetInstance() *AppConfig {
	once.Do(func() {
		instance = newAppConfig()
	})
	return instance
}

// [/getInstance]

func (c *AppConfig) Get(key string) (string, bool) {
	value, ok := c.settings[key]
	return value, ok
}

func (c *AppConfig) Set(key, value string) {
	c.settings[key] = value
}

// [/config]

// [userService]
type UserService struct {
	config *AppConfig
}

func NewUserService() *UserService {
	return &UserService{config: GetInstance()}
}

func (s *UserService) ApiUrl() (string, bool) {
	return s.config.Get("apiUrl")
}

// [/userService]

// [paymentService]
type PaymentService struct {
	config *AppConfig
}

func NewPaymentService() *PaymentService {
	return &PaymentService{config: GetInstance()}
}

func (s *PaymentService) ApiUrl() (string, bool) {
	return s.config.Get("apiUrl")
}

func (s *PaymentService) UpdateApiUrl(url string) {
	s.config.Set("apiUrl", url)
}

// [/paymentService]

// Usage
// [usage]
func main() {
	users := NewUserService()
	payments := NewPaymentService()

	users.ApiUrl()    // "https://api.example.com"
	payments.ApiUrl() // the exact same value, from the exact same object

	payments.UpdateApiUrl("https://updated.example.com")
	users.ApiUrl() // "https://updated.example.com" — set via PaymentService, seen through UserService

	// newAppConfig() is the lower-case, intended-private constructor; callers use GetInstance().
}

// [/usage]
