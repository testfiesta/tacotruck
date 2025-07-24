export interface PerformanceMetrics {
  startTime: Date
  endTime?: Date
  duration?: number
  phase: 'extract' | 'transform' | 'load' | 'complete'
  recordsProcessed: number
  recordsPerSecond?: number
  memoryUsage?: {
    heapUsed: number
    heapTotal: number
    external: number
    rss: number
  }
  networkMetrics?: {
    requestCount: number
    successfulRequests: number
    failedRequests: number
    averageResponseTime: number
    totalBytesTransferred: number
  }
  errorMetrics?: {
    totalErrors: number
    errorsByType: Record<string, number>
    retryableErrors: number
    criticalErrors: number
  }
  customMetrics?: Record<string, any>
}

export interface PerformanceSnapshot {
  timestamp: Date
  metrics: PerformanceMetrics
  phase: string
  metadata: Record<string, any>
}

export interface PerformanceSummary {
  totalDuration: number
  phases: Record<string, PerformanceMetrics>
  overallMetrics: {
    totalRecordsProcessed: number
    averageRecordsPerSecond: number
    peakMemoryUsage: number
    totalNetworkRequests: number
    totalErrors: number
    successRate: number
  }
  snapshots: PerformanceSnapshot[]
  recommendations: string[]
}

export class PerformanceMonitor {
  private startTime: Date | null = null
  private phases: Map<string, PerformanceMetrics> = new Map()
  private snapshots: PerformanceSnapshot[] = new Map()
  private currentPhase: string | null = null
  private networkRequestCount = 0
  private networkSuccessCount = 0
  private networkFailureCount = 0
  private networkResponseTimes: number[] = []
  private totalBytesTransferred = 0
  private customCounters: Map<string, number> = new Map()
  private customTimers: Map<string, Date> = new Map()

  /**
   * Start monitoring performance for the entire ETL process
   */
  startMonitoring(): void {
    this.startTime = new Date()
    this.phases.clear()
    this.snapshots.length = 0
    this.currentPhase = null
    this.resetNetworkMetrics()
    this.customCounters.clear()
    this.customTimers.clear()
  }

  /**
   * Start monitoring a specific phase (extract, transform, load)
   * @param phase The phase to start monitoring
   * @param recordsToProcess Expected number of records for this phase
   */
  startPhase(phase: string, recordsToProcess: number = 0): void {
    if (this.currentPhase) {
      this.endPhase()
    }

    this.currentPhase = phase
    const metrics: PerformanceMetrics = {
      startTime: new Date(),
      phase: phase as any,
      recordsProcessed: 0,
      memoryUsage: this.getMemoryUsage(),
    }

    // Set expected records for rate calculation
    if (recordsToProcess > 0) {
      metrics.customMetrics = { expectedRecords: recordsToProcess }
    }

    this.phases.set(phase, metrics)
  }

  /**
   * End the current phase and calculate metrics
   */
  endPhase(): void {
    if (!this.currentPhase) {
      return
    }

    const metrics = this.phases.get(this.currentPhase)
    if (metrics) {
      metrics.endTime = new Date()
      metrics.duration = metrics.endTime.getTime() - metrics.startTime.getTime()

      // Calculate records per second
      if (metrics.duration > 0 && metrics.recordsProcessed > 0) {
        metrics.recordsPerSecond = (metrics.recordsProcessed / metrics.duration) * 1000
      }

      // Update memory usage at phase end
      metrics.memoryUsage = this.getMemoryUsage()

      // Update network metrics
      metrics.networkMetrics = {
        requestCount: this.networkRequestCount,
        successfulRequests: this.networkSuccessCount,
        failedRequests: this.networkFailureCount,
        averageResponseTime: this.getAverageResponseTime(),
        totalBytesTransferred: this.totalBytesTransferred,
      }

      this.phases.set(this.currentPhase, metrics)
    }

    this.currentPhase = null
  }

  /**
   * Record that records have been processed in the current phase
   * @param count Number of records processed
   */
  recordProcessed(count: number = 1): void {
    if (!this.currentPhase) {
      return
    }

    const metrics = this.phases.get(this.currentPhase)
    if (metrics) {
      metrics.recordsProcessed += count
      this.phases.set(this.currentPhase, metrics)
    }
  }

  /**
   * Record a network request
   * @param responseTime Response time in milliseconds
   * @param success Whether the request was successful
   * @param bytesTransferred Number of bytes transferred
   */
  recordNetworkRequest(
    responseTime: number,
    success: boolean = true,
    bytesTransferred: number = 0,
  ): void {
    this.networkRequestCount++

    if (success) {
      this.networkSuccessCount++
    }
    else {
      this.networkFailureCount++
    }

    this.networkResponseTimes.push(responseTime)
    this.totalBytesTransferred += bytesTransferred

    // Keep only last 1000 response times to prevent memory issues
    if (this.networkResponseTimes.length > 1000) {
      this.networkResponseTimes = this.networkResponseTimes.slice(-1000)
    }
  }

  /**
   * Take a performance snapshot at the current moment
   * @param metadata Additional metadata to include in the snapshot
   */
  takeSnapshot(metadata: Record<string, any> = {}): void {
    const snapshot: PerformanceSnapshot = {
      timestamp: new Date(),
      phase: this.currentPhase || 'unknown',
      metadata,
      metrics: {
        startTime: this.startTime || new Date(),
        phase: (this.currentPhase || 'unknown') as any,
        recordsProcessed: this.getCurrentRecordsProcessed(),
        memoryUsage: this.getMemoryUsage(),
        networkMetrics: {
          requestCount: this.networkRequestCount,
          successfulRequests: this.networkSuccessCount,
          failedRequests: this.networkFailureCount,
          averageResponseTime: this.getAverageResponseTime(),
          totalBytesTransferred: this.totalBytesTransferred,
        },
      },
    }

    this.snapshots.push(snapshot)

    // Keep only last 100 snapshots to prevent memory issues
    if (this.snapshots.length > 100) {
      this.snapshots = this.snapshots.slice(-100)
    }
  }

  /**
   * Increment a custom counter
   * @param name Counter name
   * @param increment Amount to increment (default: 1)
   */
  incrementCounter(name: string, increment: number = 1): void {
    const current = this.customCounters.get(name) || 0
    this.customCounters.set(name, current + increment)
  }

  /**
   * Start a custom timer
   * @param name Timer name
   */
  startTimer(name: string): void {
    this.customTimers.set(name, new Date())
  }

  /**
   * End a custom timer and return the duration
   * @param name Timer name
   * @returns Duration in milliseconds, or 0 if timer wasn't started
   */
  endTimer(name: string): number {
    const startTime = this.customTimers.get(name)
    if (!startTime) {
      return 0
    }

    const duration = Date.now() - startTime.getTime()
    this.customTimers.delete(name)
    return duration
  }

  /**
   * Set a custom metric value
   * @param phase Phase to set the metric for (current phase if not specified)
   * @param key Metric key
   * @param value Metric value
   */
  setCustomMetric(key: string, value: any, phase?: string): void {
    const targetPhase = phase || this.currentPhase
    if (!targetPhase) {
      return
    }

    const metrics = this.phases.get(targetPhase)
    if (metrics) {
      if (!metrics.customMetrics) {
        metrics.customMetrics = {}
      }
      metrics.customMetrics[key] = value
      this.phases.set(targetPhase, metrics)
    }
  }

  /**
   * Get performance summary for the entire ETL process
   * @returns Complete performance summary
   */
  getSummary(): PerformanceSummary {
    // Ensure current phase is ended
    if (this.currentPhase) {
      this.endPhase()
    }

    const totalDuration = this.startTime
      ? Date.now() - this.startTime.getTime()
      : 0

    const phases: Record<string, PerformanceMetrics> = {}
    let totalRecordsProcessed = 0
    let peakMemoryUsage = 0
    let totalErrors = 0

    // Aggregate phase metrics
    for (const [phaseName, metrics] of this.phases) {
      phases[phaseName] = { ...metrics }
      totalRecordsProcessed += metrics.recordsProcessed

      if (metrics.memoryUsage) {
        peakMemoryUsage = Math.max(peakMemoryUsage, metrics.memoryUsage.heapUsed)
      }

      if (metrics.errorMetrics) {
        totalErrors += metrics.errorMetrics.totalErrors
      }
    }

    const averageRecordsPerSecond = totalDuration > 0
      ? (totalRecordsProcessed / totalDuration) * 1000
      : 0

    const successRate = this.networkRequestCount > 0
      ? (this.networkSuccessCount / this.networkRequestCount) * 100
      : 100

    const recommendations = this.generateRecommendations(
      totalDuration,
      totalRecordsProcessed,
      peakMemoryUsage,
      successRate,
    )

    return {
      totalDuration,
      phases,
      overallMetrics: {
        totalRecordsProcessed,
        averageRecordsPerSecond,
        peakMemoryUsage,
        totalNetworkRequests: this.networkRequestCount,
        totalErrors,
        successRate,
      },
      snapshots: [...this.snapshots],
      recommendations,
    }
  }

  /**
   * Get current memory usage
   * @returns Memory usage information
   */
  private getMemoryUsage(): PerformanceMetrics['memoryUsage'] {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memory = process.memoryUsage()
      return {
        heapUsed: memory.heapUsed,
        heapTotal: memory.heapTotal,
        external: memory.external,
        rss: memory.rss,
      }
    }
    return undefined
  }

  /**
   * Get average response time for network requests
   * @returns Average response time in milliseconds
   */
  private getAverageResponseTime(): number {
    if (this.networkResponseTimes.length === 0) {
      return 0
    }

    const sum = this.networkResponseTimes.reduce((a, b) => a + b, 0)
    return sum / this.networkResponseTimes.length
  }

  /**
   * Get current records processed across all phases
   * @returns Total records processed
   */
  private getCurrentRecordsProcessed(): number {
    let total = 0
    for (const metrics of this.phases.values()) {
      total += metrics.recordsProcessed
    }
    return total
  }

  /**
   * Reset network metrics
   */
  private resetNetworkMetrics(): void {
    this.networkRequestCount = 0
    this.networkSuccessCount = 0
    this.networkFailureCount = 0
    this.networkResponseTimes = []
    this.totalBytesTransferred = 0
  }

  /**
   * Generate performance recommendations based on metrics
   * @param totalDuration Total duration in milliseconds
   * @param totalRecords Total records processed
   * @param peakMemory Peak memory usage in bytes
   * @param successRate Success rate percentage
   * @returns Array of recommendation strings
   */
  private generateRecommendations(
    totalDuration: number,
    totalRecords: number,
    peakMemory: number,
    successRate: number,
  ): string[] {
    const recommendations: string[] = []

    // Performance recommendations
    const recordsPerSecond = totalDuration > 0 ? (totalRecords / totalDuration) * 1000 : 0

    if (recordsPerSecond < 10) {
      recommendations.push('Consider increasing batch sizes or parallelism to improve throughput')
    }

    if (totalDuration > 300000) { // 5 minutes
      recommendations.push('ETL process is taking a long time - consider optimizing queries or adding caching')
    }

    // Memory recommendations
    const memoryInMB = peakMemory / (1024 * 1024)
    if (memoryInMB > 512) {
      recommendations.push('High memory usage detected - consider processing data in smaller chunks')
    }

    // Network recommendations
    if (successRate < 95) {
      recommendations.push('Low network success rate - consider implementing retry mechanisms or checking network stability')
    }

    if (this.getAverageResponseTime() > 5000) {
      recommendations.push('High average response times - consider optimizing API endpoints or adding timeouts')
    }

    // General recommendations
    if (this.networkRequestCount > totalRecords * 2) {
      recommendations.push('High number of network requests relative to records - consider using bulk operations')
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance looks good! No specific recommendations at this time.')
    }

    return recommendations
  }

  /**
   * Reset all metrics and start fresh
   */
  reset(): void {
    this.startTime = null
    this.phases.clear()
    this.snapshots.length = 0
    this.currentPhase = null
    this.resetNetworkMetrics()
    this.customCounters.clear()
    this.customTimers.clear()
  }

  /**
   * Get custom counter value
   * @param name Counter name
   * @returns Counter value or 0 if not found
   */
  getCounter(name: string): number {
    return this.customCounters.get(name) || 0
  }

  /**
   * Get all custom counters
   * @returns Map of all custom counters
   */
  getAllCounters(): Map<string, number> {
    return new Map(this.customCounters)
  }

  /**
   * Check if a timer is currently running
   * @param name Timer name
   * @returns True if timer is running
   */
  isTimerRunning(name: string): boolean {
    return this.customTimers.has(name)
  }

  /**
   * Get metrics for a specific phase
   * @param phase Phase name
   * @returns Phase metrics or undefined if not found
   */
  getPhaseMetrics(phase: string): PerformanceMetrics | undefined {
    return this.phases.get(phase)
  }

  /**
   * Get current phase name
   * @returns Current phase name or null if no phase is active
   */
  getCurrentPhase(): string | null {
    return this.currentPhase
  }

  /**
   * Export metrics to JSON format
   * @returns JSON string of the complete performance summary
   */
  exportToJSON(): string {
    return JSON.stringify(this.getSummary(), null, 2)
  }

  /**
   * Import metrics from JSON (useful for testing or persistence)
   * @param json JSON string containing performance data
   */
  importFromJSON(json: string): void {
    try {
      const data = JSON.parse(json) as PerformanceSummary

      // Reset current state
      this.reset()

      // Import phases
      for (const [phaseName, metrics] of Object.entries(data.phases)) {
        this.phases.set(phaseName, {
          ...metrics,
          startTime: new Date(metrics.startTime),
          endTime: metrics.endTime ? new Date(metrics.endTime) : undefined,
        })
      }

      // Import snapshots
      this.snapshots = data.snapshots.map(snapshot => ({
        ...snapshot,
        timestamp: new Date(snapshot.timestamp),
        metrics: {
          ...snapshot.metrics,
          startTime: new Date(snapshot.metrics.startTime),
          endTime: snapshot.metrics.endTime ? new Date(snapshot.metrics.endTime) : undefined,
        },
      }))

      // Set network metrics from overall metrics
      this.networkRequestCount = data.overallMetrics.totalNetworkRequests
      this.networkSuccessCount = Math.round(
        data.overallMetrics.totalNetworkRequests * (data.overallMetrics.successRate / 100),
      )
      this.networkFailureCount = this.networkRequestCount - this.networkSuccessCount
    }
    catch (error) {
      throw new Error(`Failed to import performance data: ${error}`)
    }
  }
}
