/**
 * JIT Warmup Stabilization
 *
 * Runs warmup iterations until performance variance stabilizes,
 * indicating the JIT compiler has finished optimizing.
 *
 * JavaScript JIT compilers optimize code as it runs. Initial iterations
 * may be slower while the JIT gathers profiling data and compiles
 * optimized machine code. This module detects when performance has
 * stabilized, ensuring measurements reflect optimized code.
 */

'use strict';

class WarmupStabilizer {
    /**
     * Create a new warmup stabilizer.
     *
     * @param {Object} options - Configuration options
     * @param {number} options.minIterations - Minimum warmup iterations (default: 50)
     * @param {number} options.maxIterations - Maximum warmup iterations (default: 500)
     * @param {number} options.batchSize - Iterations per measurement batch (default: 10)
     * @param {number} options.stabilityThreshold - Coefficient of variation threshold (default: 0.05 = 5%)
     * @param {number} options.windowSize - Number of batches to compare for stability (default: 5)
     */
    constructor(options = {}) {
        this.minIterations = options.minIterations || 50;
        this.maxIterations = options.maxIterations || 500;
        this.batchSize = options.batchSize || 10;
        this.stabilityThreshold = options.stabilityThreshold || 0.05;
        this.windowSize = options.windowSize || 5;
    }

    /**
     * Run warmup until JIT stabilizes.
     *
     * @param {Function} runBatch - Function that runs one batch and returns elapsed time (ms)
     *                              Signature: (batchSize: number) => number
     * @returns {Object} { iterations, stabilized, finalVariance, batchTimes, warning? }
     */
    stabilize(runBatch) {
        if (typeof runBatch !== 'function') {
            throw new Error('runBatch must be a function');
        }

        const batchTimes = [];
        let iterations = 0;

        while (iterations < this.maxIterations) {
            // Run a batch
            const batchTime = runBatch(this.batchSize);
            batchTimes.push(batchTime);
            iterations += this.batchSize;

            // Check stability after minimum iterations
            if (
                iterations >= this.minIterations &&
                batchTimes.length >= this.windowSize
            ) {
                const recentBatches = batchTimes.slice(-this.windowSize);
                const mean =
                    recentBatches.reduce((a, b) => a + b, 0) /
                    recentBatches.length;

                if (mean === 0) continue; // Avoid division by zero

                const variance =
                    recentBatches.reduce(
                        (sum, t) => sum + Math.pow(t - mean, 2),
                        0
                    ) / recentBatches.length;
                const cv = Math.sqrt(variance) / mean; // Coefficient of variation

                if (cv < this.stabilityThreshold) {
                    return {
                        iterations,
                        stabilized: true,
                        finalVariance: cv,
                        finalVariancePercent: cv * 100,
                        batchTimes,
                        meanBatchTime: mean
                    };
                }
            }
        }

        // Max iterations reached without stabilization
        const recentBatches = batchTimes.slice(-this.windowSize);
        const mean =
            recentBatches.reduce((a, b) => a + b, 0) / recentBatches.length;
        const variance =
            recentBatches.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) /
            recentBatches.length;
        const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;

        return {
            iterations,
            stabilized: false,
            finalVariance: cv,
            finalVariancePercent: cv * 100,
            batchTimes,
            meanBatchTime: mean,
            warning: `Warmup did not stabilize after ${iterations} iterations (CV: ${(cv * 100).toFixed(1)}%)`
        };
    }

    /**
     * Create a quick check to see if additional warmup might help.
     * Useful for deciding whether to extend warmup dynamically.
     *
     * @param {number[]} recentTimes - Array of recent batch times
     * @returns {Object} { needsMoreWarmup, currentCV, trend }
     */
    assessStability(recentTimes) {
        if (recentTimes.length < 3) {
            return {
                needsMoreWarmup: true,
                currentCV: null,
                trend: 'insufficient_data'
            };
        }

        const mean = recentTimes.reduce((a, b) => a + b, 0) / recentTimes.length;
        if (mean === 0) {
            return {
                needsMoreWarmup: false,
                currentCV: 0,
                trend: 'zero_mean'
            };
        }

        const variance =
            recentTimes.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) /
            recentTimes.length;
        const cv = Math.sqrt(variance) / mean;

        // Check trend (is performance improving or stable?)
        const firstHalf = recentTimes.slice(0, Math.floor(recentTimes.length / 2));
        const secondHalf = recentTimes.slice(Math.floor(recentTimes.length / 2));
        const firstMean = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondMean =
            secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

        let trend;
        if (secondMean < firstMean * 0.95) {
            trend = 'improving'; // Performance getting better (times decreasing)
        } else if (secondMean > firstMean * 1.05) {
            trend = 'degrading'; // Performance getting worse (possible throttling?)
        } else {
            trend = 'stable';
        }

        return {
            needsMoreWarmup: cv > this.stabilityThreshold || trend === 'improving',
            currentCV: cv,
            currentCVPercent: cv * 100,
            trend
        };
    }

    /**
     * Helper to create a batch runner from a test function.
     *
     * @param {Function} drawOnce - Function that draws one shape
     * @param {Object} ctx - Canvas context
     * @returns {Function} Batch runner function
     */
    static createBatchRunner(drawOnce, ctx) {
        const { performance } = require('perf_hooks');

        return function (batchSize) {
            const startTime = performance.now();
            for (let i = 0; i < batchSize; i++) {
                drawOnce(ctx, i);
            }
            return performance.now() - startTime;
        };
    }
}

module.exports = WarmupStabilizer;
