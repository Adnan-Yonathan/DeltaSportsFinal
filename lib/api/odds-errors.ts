export class OddsAPIError extends Error {
  public isRateLimited: boolean = false

  constructor(message: string, public statusCode?: number) {
    super(message)
    this.name = 'OddsAPIError'

    if (
      statusCode === 429 ||
      message.toLowerCase().includes('rate limit') ||
      message.toLowerCase().includes('too many requests') ||
      message.toLowerCase().includes('quota exceeded')
    ) {
      this.isRateLimited = true
    }
  }
}
