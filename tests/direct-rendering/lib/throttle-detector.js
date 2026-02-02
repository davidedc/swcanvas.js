/**
 * CPU Throttling Detector
 *
 * Detects thermal throttling by running reference benchmarks
 * at regular intervals and checking for performance drift.
 *
 * Long benchmark runs can trigger CPU throttling due to heat buildup.
 * This module detects such drift by periodically running a simple
 * reference workload and comparing against an initial baseline.
 */

'use strict';

class ThrottleDetector {
    /**
     * Create a new throttle detector.
     *
     * @param {Object} SWCanvas - The SWCanvas library for running reference benchmarks
     * @param {Object} options - Configuration options
     * @param {number} options.driftThreshold - Drift percentage that triggers warning (default: 0.15 = 15%)
     * @param {number} options.referenceIterations - Iterations for reference benchmark (default: 5000)
     * @param {number} options.canvasWidth - Width of reference canvas (default: 512)
     * @param {number} options.canvasHeight - Height of reference canvas (default: 512)
     */
    constructor(SWCanvas, options = {}) {
        this.SWCanvas = SWCanvas;
        this.referenceResults = [];
        this.baselinePerformance = null;
        this.driftThreshold = options.driftThreshold || 0.15;
        this.referenceIterations = options.referenceIterations || 5000;
        this.canvasWidth = options.canvasWidth || 512;
        this.canvasHeight = options.canvasHeight || 512;
        this.warnings = [];
    }

    /**
     * Run reference benchmark (simple filled rectangles).
     * Uses a simple, predictable workload that should have consistent performance.
     *
     * @returns {number} shapes/sec for reference operation
     */
    runReferenceBenchmark() {
        const canvas = this.SWCanvas.createCanvas(
            this.canvasWidth,
            this.canvasHeight
        );
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgb(128, 128, 128)';

        const iterations = this.referenceIterations;
        const { performance } = require('perf_hooks');
        const startTime = performance.now();

        for (let i = 0; i < iterations; i++) {
            // Deterministic positions using simple modulo arithmetic
            const x = (i * 37) % (this.canvasWidth - 50);
            const y = (i * 23) % (this.canvasHeight - 50);
            ctx.fillRect(x, y, 50, 50);
        }

        const elapsed = performance.now() - startTime;
        return iterations / (elapsed / 1000);
    }

    /**
     * Establish baseline performance (call before benchmarking session).
     * Runs multiple iterations to get a stable baseline.
     *
     * @param {number} runs - Number of warmup runs to establish baseline (default: 5)
     * @returns {number} Baseline shapes/sec
     */
    establishBaseline(runs = 5) {
        const results = [];

        // Warmup run (discarded)
        this.runReferenceBenchmark();

        // Measurement runs
        for (let i = 0; i < runs; i++) {
            results.push(this.runReferenceBenchmark());
        }

        this.baselinePerformance =
            results.reduce((a, b) => a + b, 0) / results.length;
        this.referenceResults = [
            {
                timestamp: Date.now(),
                performance: this.baselinePerformance,
                testIndex: 0
            }
        ];
        this.warnings = [];

        return this.baselinePerformance;
    }

    /**
     * Check for throttling (call periodically during benchmarking).
     *
     * @param {number} testIndex - Current test index (for tracking)
     * @returns {Object} { throttled, currentPerformance, drift, warning }
     */
    checkThrottling(testIndex = 0) {
        if (this.baselinePerformance === null) {
            throw new Error(
                'Baseline not established. Call establishBaseline() first.'
            );
        }

        const current = this.runReferenceBenchmark();
        const drift =
            (this.baselinePerformance - current) / this.baselinePerformance;

        this.referenceResults.push({
            timestamp: Date.now(),
            performance: current,
            testIndex,
            drift
        });

        const throttled = drift > this.driftThreshold;
        let warning = null;

        if (drift > 0.3) {
            warning = `SEVERE: CPU throttled by ${(drift * 100).toFixed(1)}% - results unreliable`;
        } else if (drift > 0.15) {
            warning = `WARNING: CPU throttled by ${(drift * 100).toFixed(1)}% - consider cooling`;
        } else if (drift > 0.1) {
            warning = `NOTICE: Minor drift of ${(drift * 100).toFixed(1)}%`;
        }

        if (warning) {
            this.warnings.push({
                testIndex,
                message: warning,
                drift,
                timestamp: Date.now()
            });
        }

        return {
            throttled,
            currentPerformance: current,
            baselinePerformance: this.baselinePerformance,
            drift,
            driftPercent: drift * 100,
            warning
        };
    }

    /**
     * Get throttling summary for the entire session.
     *
     * @returns {Object} Summary of throttling during session
     */
    getSummary() {
        if (this.referenceResults.length < 2) {
            return {
                stable: true,
                maxDriftPercent: 0,
                avgDriftPercent: 0,
                checkCount: this.referenceResults.length,
                recommendation: 'Insufficient data for throttling analysis.'
            };
        }

        const perfs = this.referenceResults.map((r) => r.performance);
        const drifts = this.referenceResults
            .slice(1)
            .map(
                (r) =>
                    (this.baselinePerformance - r.performance) /
                    this.baselinePerformance
            );

        const maxDrift = Math.max(...drifts.map((d) => d));
        const avgDrift =
            drifts.reduce((sum, d) => sum + d, 0) / drifts.length;

        let recommendation;
        if (maxDrift > 0.15) {
            recommendation =
                'Results may be unreliable due to thermal throttling. Consider re-running after cooling.';
        } else if (maxDrift > 0.1) {
            recommendation =
                'Minor performance drift detected. Results should still be valid.';
        } else {
            recommendation = 'System performance was stable during benchmarking.';
        }

        return {
            stable: maxDrift < this.driftThreshold,
            maxDriftPercent: maxDrift * 100,
            avgDriftPercent: avgDrift * 100,
            minPerformance: Math.min(...perfs),
            maxPerformance: Math.max(...perfs),
            checkCount: this.referenceResults.length,
            warnings: this.warnings,
            recommendation
        };
    }

    /**
     * Get detailed throttling timeline for analysis.
     *
     * @returns {Array} Array of throttling check results
     */
    getTimeline() {
        return this.referenceResults.map((r, i) => ({
            ...r,
            driftPercent: r.drift !== undefined ? r.drift * 100 : 0,
            relativeToBaseline:
                this.baselinePerformance > 0
                    ? ((r.performance - this.baselinePerformance) /
                          this.baselinePerformance) *
                      100
                    : 0
        }));
    }

    /**
     * Reset the detector for a new session.
     */
    reset() {
        this.referenceResults = [];
        this.baselinePerformance = null;
        this.warnings = [];
    }
}

module.exports = ThrottleDetector;
