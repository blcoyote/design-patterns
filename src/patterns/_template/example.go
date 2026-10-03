package main

// [service]
type Service struct{}

func (s *Service) Run() {}

// [/service]

// [usage]
func main() {
	// [client]
	(&Service{}).Run()
	// [/client]
}

// [/usage]
