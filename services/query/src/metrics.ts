const LATENCY_BUCKETS = [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10] as const;

interface Histogram {
  count: number;
  sum: number;
  buckets: number[];
}

function labels(values: Record<string, string | number>): string {
  const encoded = Object.entries(values).map(([key, value]) =>
    `${key}="${String(value).replaceAll("\\", "\\\\").replaceAll("\"", "\\\"").replaceAll("\n", "\\n")}"`
  );
  return `{${encoded.join(",")}}`;
}

function histogram(): Histogram {
  return { count: 0, sum: 0, buckets: LATENCY_BUCKETS.map(() => 0) };
}

export class Metrics {
  head = 0;
  indexed = 0;
  projectionCycles = 0;
  projectionErrors = 0;
  queryRequests = 0;
  lastProjectionSuccess = 0;
  lastProjectionError = 0;
  sourceHealthy = false;
  private readonly requests = new Map<string, Histogram>();
  private readonly projections = histogram();

  observeRequest(method: string, route: string, status: number, seconds: number): void {
    this.queryRequests += 1;
    const key = JSON.stringify([method, route, status]);
    const target = this.requests.get(key) ?? histogram();
    target.count += 1;
    target.sum += seconds;
    LATENCY_BUCKETS.forEach((boundary, index) => {
      if (seconds <= boundary) target.buckets[index] = (target.buckets[index] ?? 0) + 1;
    });
    this.requests.set(key, target);
  }

  observeProjection(seconds: number): void {
    this.projections.count += 1;
    this.projections.sum += seconds;
    LATENCY_BUCKETS.forEach((boundary, index) => {
      if (seconds <= boundary) this.projections.buckets[index] = (this.projections.buckets[index] ?? 0) + 1;
    });
  }

  render(): string {
    const lag = Math.max(0, this.head - this.indexed);
    const lines = [
      "# HELP toscan_projection_head Current node masterchain head.",
      "# TYPE toscan_projection_head gauge",
      `toscan_projection_head ${this.head}`,
      "# HELP toscan_projection_indexed Last projected masterchain block.",
      "# TYPE toscan_projection_indexed gauge",
      `toscan_projection_indexed ${this.indexed}`,
      "# HELP toscan_projection_lag Masterchain blocks waiting to be projected.",
      "# TYPE toscan_projection_lag gauge",
      `toscan_projection_lag ${lag}`,
      "# TYPE toscan_projection_cycles_total counter",
      `toscan_projection_cycles_total ${this.projectionCycles}`,
      "# TYPE toscan_projection_errors_total counter",
      `toscan_projection_errors_total ${this.projectionErrors}`,
      "# TYPE toscan_query_requests_total counter",
      `toscan_query_requests_total ${this.queryRequests}`,
      "# TYPE toscan_projection_last_success_unixtime gauge",
      `toscan_projection_last_success_unixtime ${this.lastProjectionSuccess}`,
      "# TYPE toscan_projection_last_error_unixtime gauge",
      `toscan_projection_last_error_unixtime ${this.lastProjectionError}`,
      "# TYPE toscan_projection_source_healthy gauge",
      `toscan_projection_source_healthy ${this.sourceHealthy ? 1 : 0}`,
      "# HELP toscan_query_duration_seconds Public query latency by stable route template.",
      "# TYPE toscan_query_duration_seconds histogram",
    ];
    for (const [key, value] of this.requests) {
      const [method, route, status] = JSON.parse(key) as [string, string, number];
      LATENCY_BUCKETS.forEach((boundary, index) => {
        lines.push(`toscan_query_duration_seconds_bucket${labels({ method, route, status, le: boundary })} ${value.buckets[index]}`);
      });
      lines.push(`toscan_query_duration_seconds_bucket${labels({ method, route, status, le: "+Inf" })} ${value.count}`);
      lines.push(`toscan_query_duration_seconds_sum${labels({ method, route, status })} ${value.sum}`);
      lines.push(`toscan_query_duration_seconds_count${labels({ method, route, status })} ${value.count}`);
    }
    lines.push(
      "# HELP toscan_projection_cycle_duration_seconds Projection cycle wall time.",
      "# TYPE toscan_projection_cycle_duration_seconds histogram",
    );
    LATENCY_BUCKETS.forEach((boundary, index) => {
      lines.push(`toscan_projection_cycle_duration_seconds_bucket${labels({ le: boundary })} ${this.projections.buckets[index]}`);
    });
    lines.push(`toscan_projection_cycle_duration_seconds_bucket${labels({ le: "+Inf" })} ${this.projections.count}`);
    lines.push(`toscan_projection_cycle_duration_seconds_sum ${this.projections.sum}`);
    lines.push(`toscan_projection_cycle_duration_seconds_count ${this.projections.count}`, "");
    return lines.join("\n");
  }
}
