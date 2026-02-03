/**
 * Enhanced Statistics Module
 *
 * Provides proper statistical analysis for performance measurements.
 * Uses sample standard deviation (n-1), confidence intervals,
 * Welch's t-test for comparing samples, and outlier detection.
 */

'use strict';

class Statistics {
    /**
     * Calculate comprehensive statistics from measurements.
     *
     * @param {number[]} measurements - Array of timing measurements
     * @param {Object} options - Analysis options
     * @param {boolean} options.skipOutliers - Enable MAD-based outlier filtering
     * @param {number} options.madThreshold - MAD threshold (default: 3.5)
     * @returns {Object} Complete statistics object
     */
    static analyze(measurements, options = {}) {
        if (!measurements || measurements.length === 0) {
            throw new Error('Cannot analyze empty measurements array');
        }

        const { skipOutliers = false, madThreshold = 3.5 } = options;

        // Apply MAD filtering if enabled (need at least 4 samples for meaningful filtering)
        let dataToAnalyze = measurements;
        let outlierInfo = null;

        if (skipOutliers && measurements.length > 3) {
            const madResult = this.detectOutliersMAD(measurements, madThreshold);
            dataToAnalyze = madResult.cleaned;
            outlierInfo = {
                method: 'mad',
                threshold: madThreshold,
                count: madResult.outlierCount,
                indices: madResult.outlierIndices,
                mad: madResult.mad,
                scaledMAD: madResult.scaledMAD
            };
        }

        const n = dataToAnalyze.length;
        const nRaw = measurements.length;
        const sorted = [...dataToAnalyze].sort((a, b) => a - b);

        // Central tendency
        const mean = dataToAnalyze.reduce((a, b) => a + b, 0) / n;
        const median =
            n % 2 === 0
                ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
                : sorted[Math.floor(n / 2)];

        // Quartiles (for outlier detection via IQR - legacy method)
        const q1Index = Math.floor(n * 0.25);
        const q3Index = Math.floor(n * 0.75);
        const q1 = sorted[q1Index];
        const q3 = sorted[q3Index];
        const iqr = q3 - q1;

        // Outlier bounds (1.5 x IQR rule - legacy detection)
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;
        const outlierValues = dataToAnalyze.filter(
            (m) => m < lowerBound || m > upperBound
        );

        // Cleaned measurements (without IQR outliers - legacy)
        const cleaned = dataToAnalyze.filter(
            (m) => m >= lowerBound && m <= upperBound
        );
        const cleanedMean =
            cleaned.length > 0
                ? cleaned.reduce((a, b) => a + b, 0) / cleaned.length
                : mean;

        // Sample standard deviation (n-1 for unbiased estimator)
        // Only use n-1 if we have more than 1 sample
        const divisor = n > 1 ? n - 1 : n;
        const variance =
            dataToAnalyze.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
            divisor;
        const stddev = Math.sqrt(variance);

        // Standard Error of the Mean
        const sem = stddev / Math.sqrt(n);

        // 95% Confidence Interval
        const tValue = this.getTValue(n - 1, 0.975);
        const ci95Low = mean - tValue * sem;
        const ci95High = mean + tValue * sem;

        // Percentiles
        const p5Index = Math.floor(n * 0.05);
        const p95Index = Math.floor(n * 0.95);
        const p5 = sorted[p5Index];
        const p95 = sorted[Math.min(p95Index, n - 1)];

        return {
            n,
            nRaw, // Original count before MAD filtering
            mean,
            median,
            stddev,
            stddevPercent: mean !== 0 ? (stddev / mean) * 100 : 0,
            sem,
            semPercent: mean !== 0 ? (sem / mean) * 100 : 0,
            ci95: { low: ci95Low, high: ci95High },
            ci95Percent: {
                low: mean !== 0 ? ((ci95Low - mean) / mean) * 100 : 0,
                high: mean !== 0 ? ((ci95High - mean) / mean) * 100 : 0
            },
            min: sorted[0],
            max: sorted[n - 1],
            q1,
            q3,
            iqr,
            p5,
            p95,
            outliers: outlierValues.length, // IQR-based outliers (legacy)
            outlierValues,
            outlierInfo, // MAD-based outlier info (null if not filtering)
            cleanedMean,
            raw: measurements // Always preserve original raw data
        };
    }

    /**
     * Welch's t-test for comparing two samples with potentially different variances.
     * This is more robust than Student's t-test when variances may differ.
     *
     * @param {Object} stats1 - Statistics object from analyze() for sample 1 (before)
     * @param {Object} stats2 - Statistics object from analyze() for sample 2 (after)
     * @param {number} alpha - Significance level (default 0.05 for 95% confidence)
     * @returns {Object} { tStatistic, degreesOfFreedom, pValue, significant, changePercent }
     */
    static welchTTest(stats1, stats2, alpha = 0.05) {
        const n1 = stats1.n,
            n2 = stats2.n;
        const m1 = stats1.mean,
            m2 = stats2.mean;
        const v1 = stats1.stddev ** 2,
            v2 = stats2.stddev ** 2;

        // Handle edge cases
        if (n1 < 2 || n2 < 2) {
            return {
                tStatistic: NaN,
                degreesOfFreedom: NaN,
                pValue: 1,
                significant: false,
                changePercent: m1 !== 0 ? ((m2 - m1) / m1) * 100 : 0,
                error: 'Insufficient samples for t-test (need at least 2 per group)'
            };
        }

        // Standard error of the difference
        const se = Math.sqrt(v1 / n1 + v2 / n2);

        if (se === 0) {
            // No variance - can't compute t-statistic
            return {
                tStatistic: m1 === m2 ? 0 : Infinity,
                degreesOfFreedom: n1 + n2 - 2,
                pValue: m1 === m2 ? 1 : 0,
                significant: m1 !== m2,
                changePercent: m1 !== 0 ? ((m2 - m1) / m1) * 100 : 0
            };
        }

        // Welch's t-statistic
        const t = (m1 - m2) / se;

        // Welch-Satterthwaite degrees of freedom
        const num = (v1 / n1 + v2 / n2) ** 2;
        const denom =
            (v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1);
        const df = num / denom;

        // Two-tailed p-value
        const pValue = this.tDistributionPValue(Math.abs(t), df);

        return {
            tStatistic: t,
            degreesOfFreedom: df,
            pValue,
            significant: pValue < alpha,
            changePercent: m1 !== 0 ? ((m2 - m1) / m1) * 100 : 0
        };
    }

    /**
     * Check if confidence intervals overlap (quick significance check).
     * Non-overlapping CIs strongly suggest significant difference.
     *
     * @param {Object} stats1 - Statistics object from analyze()
     * @param {Object} stats2 - Statistics object from analyze()
     * @returns {boolean} true if CIs overlap
     */
    static ciOverlap(stats1, stats2) {
        return !(
            stats1.ci95.high < stats2.ci95.low ||
            stats2.ci95.high < stats1.ci95.low
        );
    }

    /**
     * Calculate overlap percentage between two confidence intervals.
     * Returns 0 if no overlap, 100 if one is contained within the other.
     *
     * @param {Object} stats1 - Statistics object from analyze()
     * @param {Object} stats2 - Statistics object from analyze()
     * @returns {number} Overlap percentage (0-100)
     */
    static ciOverlapPercent(stats1, stats2) {
        const low1 = stats1.ci95.low,
            high1 = stats1.ci95.high;
        const low2 = stats2.ci95.low,
            high2 = stats2.ci95.high;

        const overlapLow = Math.max(low1, low2);
        const overlapHigh = Math.min(high1, high2);

        if (overlapLow >= overlapHigh) {
            return 0; // No overlap
        }

        const overlapWidth = overlapHigh - overlapLow;
        const minWidth = Math.min(high1 - low1, high2 - low2);

        if (minWidth === 0) return 100;

        return Math.min(100, (overlapWidth / minWidth) * 100);
    }

    /**
     * Classify the comparison between two measurements.
     *
     * @param {Object} stats1 - Statistics for baseline (before)
     * @param {Object} stats2 - Statistics for comparison (after)
     * @returns {Object} Classification with reasoning
     */
    static classifyChange(stats1, stats2) {
        const tTest = this.welchTTest(stats1, stats2);
        const overlap = this.ciOverlap(stats1, stats2);
        const changePercent = tTest.changePercent;

        let classification;
        let confidence;
        let reasoning;

        if (tTest.significant && !overlap) {
            // Strong statistical evidence
            // Note: changePercent is based on TIMING (ms), so positive = more time = SLOWER
            if (changePercent > 0) {
                classification = 'SIGNIFICANT_SLOWER';
                confidence = 'high';
                reasoning = `p=${tTest.pValue.toFixed(4)}, CIs don't overlap`;
            } else {
                classification = 'SIGNIFICANT_FASTER';
                confidence = 'high';
                reasoning = `p=${tTest.pValue.toFixed(4)}, CIs don't overlap`;
            }
        } else if (tTest.significant && overlap) {
            // Suggestive but not conclusive
            // Note: changePercent is based on TIMING (ms), so positive = more time = SLOWER
            if (changePercent > 2 * stats1.semPercent) {
                classification = 'LIKELY_SLOWER';
                confidence = 'medium';
                reasoning = `p=${tTest.pValue.toFixed(4)}, CIs overlap but trend clear`;
            } else if (changePercent < -2 * stats1.semPercent) {
                classification = 'LIKELY_FASTER';
                confidence = 'medium';
                reasoning = `p=${tTest.pValue.toFixed(4)}, CIs overlap but trend clear`;
            } else {
                classification = 'SAME';
                confidence = 'medium';
                reasoning = 'CIs overlap, change within noise';
            }
        } else {
            // Not statistically significant
            classification = 'SAME';
            confidence = 'low';
            reasoning = `p=${tTest.pValue.toFixed(4)}, not significant`;
        }

        return {
            classification,
            confidence,
            reasoning,
            changePercent,
            pValue: tTest.pValue,
            significant: tTest.significant,
            ciOverlap: overlap
        };
    }

    // =========================================================================
    // Statistical helper functions
    // =========================================================================

    /**
     * T-distribution critical values (two-tailed).
     * Returns the t-value for given degrees of freedom and probability.
     *
     * @param {number} df - Degrees of freedom
     * @param {number} p - Probability (e.g., 0.975 for 95% two-tailed)
     * @returns {number} Critical t-value
     */
    static getTValue(df, p) {
        // T-table for common values (two-tailed 95%, so p=0.975)
        const tTable = {
            1: 12.706,
            2: 4.303,
            3: 3.182,
            4: 2.776,
            5: 2.571,
            6: 2.447,
            7: 2.365,
            8: 2.306,
            9: 2.262,
            10: 2.228,
            11: 2.201,
            12: 2.179,
            13: 2.16,
            14: 2.145,
            15: 2.131,
            16: 2.12,
            17: 2.11,
            18: 2.101,
            19: 2.093,
            20: 2.086,
            25: 2.06,
            30: 2.042,
            40: 2.021,
            50: 2.009,
            60: 2.0,
            80: 1.99,
            100: 1.984,
            120: 1.98
        };

        // For large df, approaches normal distribution
        if (df >= 120) return 1.96;

        // Find closest value in table
        if (tTable[df]) return tTable[df];

        // Interpolate for values not in table
        const keys = Object.keys(tTable)
            .map(Number)
            .sort((a, b) => a - b);
        for (let i = 0; i < keys.length - 1; i++) {
            if (keys[i] < df && df < keys[i + 1]) {
                // Linear interpolation
                const t1 = tTable[keys[i]];
                const t2 = tTable[keys[i + 1]];
                const ratio = (df - keys[i]) / (keys[i + 1] - keys[i]);
                return t1 + (t2 - t1) * ratio;
            }
        }

        // Default to normal distribution approximation
        return 1.96;
    }

    /**
     * Approximate the standard normal CDF using the error function.
     *
     * @param {number} x - Input value
     * @returns {number} Cumulative probability
     */
    static normalCDF(x) {
        // Approximation of standard normal CDF
        const a1 = 0.254829592,
            a2 = -0.284496736,
            a3 = 1.421413741;
        const a4 = -1.453152027,
            a5 = 1.061405429,
            p = 0.3275911;

        const sign = x < 0 ? -1 : 1;
        x = Math.abs(x) / Math.sqrt(2);

        const t = 1.0 / (1.0 + p * x);
        const y =
            1 -
            ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

        return 0.5 * (1.0 + sign * y);
    }

    /**
     * Approximate two-tailed p-value for t-distribution.
     * Uses normal approximation for large df, otherwise beta function approximation.
     *
     * @param {number} t - Absolute t-statistic
     * @param {number} df - Degrees of freedom
     * @returns {number} Two-tailed p-value
     */
    static tDistributionPValue(t, df) {
        // For large df, use normal approximation
        if (df > 100) {
            return 2 * (1 - this.normalCDF(t));
        }

        // Approximation using incomplete beta function relationship
        // P(T > t) = I_{x}(df/2, 1/2) where x = df/(df + t^2)
        const x = df / (df + t * t);
        const p = this.incompleteBeta(x, df / 2, 0.5);

        return p;
    }

    /**
     * Incomplete beta function approximation.
     * Used for t-distribution p-value calculation.
     *
     * @param {number} x - Upper limit of integration (0 to 1)
     * @param {number} a - Shape parameter alpha
     * @param {number} b - Shape parameter beta
     * @returns {number} Regularized incomplete beta value
     */
    static incompleteBeta(x, a, b) {
        // Simple continued fraction approximation (Lentz's algorithm)
        if (x === 0) return 0;
        if (x === 1) return 1;

        // Use symmetry relation if needed for better convergence
        if (x > (a + 1) / (a + b + 2)) {
            return 1 - this.incompleteBeta(1 - x, b, a);
        }

        const maxIterations = 200;
        const epsilon = 1e-10;

        // Calculate the beta function coefficient
        const lnBeta = this.lnGamma(a) + this.lnGamma(b) - this.lnGamma(a + b);
        const front =
            Math.exp(
                Math.log(x) * a + Math.log(1 - x) * b - lnBeta
            ) / a;

        // Continued fraction using Lentz's algorithm
        let f = 1;
        let c = 1;
        let d = 0;

        for (let m = 0; m <= maxIterations; m++) {
            let numerator;
            if (m === 0) {
                numerator = 1;
            } else if (m % 2 === 0) {
                const k = m / 2;
                numerator =
                    (k * (b - k) * x) / ((a + 2 * k - 1) * (a + 2 * k));
            } else {
                const k = (m - 1) / 2;
                numerator =
                    -((a + k) * (a + b + k) * x) /
                    ((a + 2 * k) * (a + 2 * k + 1));
            }

            d = 1 + numerator * d;
            if (Math.abs(d) < epsilon) d = epsilon;
            d = 1 / d;

            c = 1 + numerator / c;
            if (Math.abs(c) < epsilon) c = epsilon;

            const delta = c * d;
            f *= delta;

            if (Math.abs(delta - 1) < epsilon) {
                return front * (f - 1);
            }
        }

        // Fallback if no convergence
        return front * (f - 1);
    }

    /**
     * Natural logarithm of the gamma function (Lanczos approximation).
     *
     * @param {number} z - Input value
     * @returns {number} ln(Gamma(z))
     */
    static lnGamma(z) {
        const g = 7;
        const coefficients = [
            0.99999999999980993, 676.5203681218851, -1259.1392167224028,
            771.32342877765313, -176.61502916214059, 12.507343278686905,
            -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
        ];

        if (z < 0.5) {
            // Reflection formula
            return (
                Math.log(Math.PI / Math.sin(Math.PI * z)) -
                this.lnGamma(1 - z)
            );
        }

        z -= 1;
        let x = coefficients[0];
        for (let i = 1; i < g + 2; i++) {
            x += coefficients[i] / (z + i);
        }

        const t = z + g + 0.5;
        return (
            0.5 * Math.log(2 * Math.PI) +
            (z + 0.5) * Math.log(t) -
            t +
            Math.log(x)
        );
    }

    // =========================================================================
    // Outlier detection using MAD (Median Absolute Deviation)
    // =========================================================================

    /**
     * Detect outliers using Median Absolute Deviation (MAD).
     * More robust than IQR for skewed timing data (e.g., right-skewed due to GC pauses).
     *
     * @param {number[]} measurements - Raw measurements
     * @param {number} threshold - Modified z-score threshold (default: 3.5)
     * @returns {Object} { cleaned, outlierIndices, outlierCount, median, mad, scaledMAD, threshold }
     */
    static detectOutliersMAD(measurements, threshold = 3.5) {
        const sorted = [...measurements].sort((a, b) => a - b);
        const n = sorted.length;

        // Calculate median
        const median =
            n % 2 === 0
                ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
                : sorted[Math.floor(n / 2)];

        // Calculate MAD (median of absolute deviations from median)
        const deviations = measurements.map((m) => Math.abs(m - median));
        const sortedDevs = [...deviations].sort((a, b) => a - b);
        const mad =
            sortedDevs.length % 2 === 0
                ? (sortedDevs[sortedDevs.length / 2 - 1] +
                      sortedDevs[sortedDevs.length / 2]) /
                  2
                : sortedDevs[Math.floor(sortedDevs.length / 2)];

        // Scale factor for normal distribution consistency (1.4826)
        const scaledMAD = mad * 1.4826;

        // Handle zero MAD (all values identical or near-identical)
        if (scaledMAD === 0) {
            return {
                cleaned: [...measurements],
                outlierIndices: [],
                outlierCount: 0,
                median,
                mad: 0,
                scaledMAD: 0,
                threshold
            };
        }

        // Filter using modified z-score
        const outlierIndices = [];
        const cleaned = [];
        measurements.forEach((m, i) => {
            const modifiedZ = Math.abs(m - median) / scaledMAD;
            if (modifiedZ > threshold) {
                outlierIndices.push(i);
            } else {
                cleaned.push(m);
            }
        });

        return {
            cleaned,
            outlierIndices,
            outlierCount: outlierIndices.length,
            median,
            mad,
            scaledMAD,
            threshold
        };
    }

    // =========================================================================
    // Simple CV calculation for sub-run stability detection
    // =========================================================================

    /**
     * Calculate Coefficient of Variation (CV) for an array of measurements.
     * Used for sub-run stability detection in the super-measurement approach.
     *
     * @param {number[]} measurements - Array of timing measurements
     * @returns {number} CV as a percentage (0-100)
     */
    static calculateCV(measurements) {
        if (!measurements || measurements.length === 0) {
            return 0;
        }

        const n = measurements.length;
        const mean = measurements.reduce((a, b) => a + b, 0) / n;

        if (mean === 0) {
            return 0;
        }

        const variance = measurements.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
        const stddev = Math.sqrt(variance);

        return (stddev / mean) * 100;
    }

    /**
     * Apply IQR-based outlier removal to measurements.
     * Returns cleaned measurements with outliers removed.
     *
     * @param {number[]} measurements - Array of timing measurements
     * @returns {Object} { cleaned, outlierCount, lowerBound, upperBound }
     */
    static removeOutliersIQR(measurements) {
        if (!measurements || measurements.length < 4) {
            return {
                cleaned: measurements || [],
                outlierCount: 0,
                lowerBound: null,
                upperBound: null
            };
        }

        const sorted = [...measurements].sort((a, b) => a - b);
        const n = sorted.length;
        const q1 = sorted[Math.floor(n * 0.25)];
        const q3 = sorted[Math.floor(n * 0.75)];
        const iqr = q3 - q1;
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;

        const cleaned = measurements.filter(m => m >= lowerBound && m <= upperBound);

        return {
            cleaned,
            outlierCount: measurements.length - cleaned.length,
            lowerBound,
            upperBound
        };
    }
}

module.exports = Statistics;
