// Stub for @upstash/redis - used in vitest tests only
export class Redis {
  constructor(_opts: { url: string; token: string }) {}
  pipeline() {
    return {
      incr: () => {},
      expire: () => {},
      exec: async () => [1],
    };
  }
  async ttl() {
    return 60;
  }
}
