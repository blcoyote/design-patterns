// [service]
/** A downstream dependency that can start failing under load. */
class RemoteService {
  constructor(private isHealthy: () => boolean) {}

  async request(): Promise<string> {
    if (!this.isHealthy()) {
      throw new Error('service unavailable')
    }
    return 'ok'
  }
}
// [/service]

type BreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

// [breaker]
class CircuitBreaker {
  private state: BreakerState = 'CLOSED'
  private failureCount = 0
  private nextAttempt = 0
  private trialInFlight = false
  // Bumped on every state transition, so a slow call that started in an
  // earlier state can't drive a transition it never actually observed.
  private generation = 0

  constructor(
    private readonly failureThreshold: number,
    private readonly cooldownMs: number,
  ) {}

  // [call]
  async call<T>(fn: () => Promise<T>): Promise<T> {
    // [openCheck]
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('circuit open — failing fast') // fn() never runs
      }
      // [halfOpenCheck]
      this.state = 'HALF_OPEN' // cooldown elapsed: let exactly one trial through
      this.generation++
      // [/halfOpenCheck]
    }
    // Only one probe at a time: while it is in flight, everyone else keeps failing fast.
    if (this.state === 'HALF_OPEN' && this.trialInFlight) {
      throw new Error('circuit half-open — trial in progress')
    }
    // [/openCheck]

    const isTrial = this.state === 'HALF_OPEN'
    const callGeneration = this.generation // only *this* call's own outcome may move that generation on
    if (isTrial) this.trialInFlight = true
    try {
      // [invoke]
      const result = await fn()
      // [/invoke]
      // [onSuccess]
      if (callGeneration === this.generation) {
        this.failureCount = 0
        this.state = 'CLOSED'
      }
      // [/onSuccess]
      return result
    } catch (err) {
      // [onFailure]
      if (callGeneration === this.generation) {
        this.failureCount++
        if (this.state === 'HALF_OPEN' || this.failureCount >= this.failureThreshold) {
          this.state = 'OPEN'
          this.nextAttempt = Date.now() + this.cooldownMs
          this.generation++
        }
      }
      // [/onFailure]
      throw err
    } finally {
      if (isTrial) this.trialInFlight = false
    }
  }
  // [/call]
}
// [/breaker]

// [client]
// Usage
let serviceIsHealthy = true
const service = new RemoteService(() => serviceIsHealthy)
const breaker = new CircuitBreaker(/* failureThreshold */ 3, /* cooldownMs */ 4000)

await breaker.call(() => service.request())
// [/client]
