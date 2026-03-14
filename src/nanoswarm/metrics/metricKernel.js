// File: src/nanoswarm/metrics/metricKernel.js

/**
 * MetricKernel:
 * Nanoscale time-series kernel with rolling median + deviation threshold.
 */

class MetricKernel {
    constructor({
        kernelId,
        metricName,
        windowSize,
        deviationMultiplier,
        aggregation = "median",   // reserved for future extensions
        direction = "both"        // "both" | "above" | "below"
    }) {
        this.kind = "metric_kernel.v1";
        this.kernelId = kernelId;
        this.metricName = metricName;
        this.windowSize = windowSize;
        this.deviationMultiplier = deviationMultiplier;
        this.aggregation = aggregation;
        this.direction = direction;
    }

    toJSON() {
        return {
            kind: this.kind,
            kernelId: this.kernelId,
            metricName: this.metricName,
            windowSize: this.windowSize,
            deviationMultiplier: this.deviationMultiplier,
            aggregation: this.aggregation,
            direction: this.direction
        };
    }

    static validate(obj) {
        if (!obj || obj.kind !== "metric_kernel.v1") return false;
        if (typeof obj.kernelId !== "string") return false;
        if (typeof obj.metricName !== "string") return false;
        if (typeof obj.windowSize !== "number" || obj.windowSize <= 0) return false;
        if (typeof obj.deviationMultiplier !== "number" || obj.deviationMultiplier < 0) {
            return false;
        }
        return true;
    }

    /**
     * Apply kernel to a numeric series.
     * Returns an array of { value, median, dev, lower, upper, anomaly }.
     */
    apply(series) {
        const n = series.length;
        const results = new Array(n);

        for (let i = 0; i < n; i++) {
            const windowStart = Math.max(0, i - this.windowSize + 1);
            const window = series.slice(windowStart, i + 1);

            const median = MetricKernel.median(window);
            const absDevs = window.map(v => Math.abs(v - median));
            const mad = MetricKernel.median(absDevs);

            const lower = median - this.deviationMultiplier * mad;
            const upper = median + this.deviationMultiplier * mad;

            const value = series[i];
            let anomaly = false;

            if (this.direction === "both") {
                anomaly = value < lower || value > upper;
            } else if (this.direction === "above") {
                anomaly = value > upper;
            } else if (this.direction === "below") {
                anomaly = value < lower;
            }

            results[i] = {
                index: i,
                value,
                median,
                mad,
                lower,
                upper,
                anomaly
            };
        }

        return results;
    }

    static median(values) {
        if (!values.length) return NaN;
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        if (sorted.length % 2 === 0) {
            return (sorted[mid - 1] + sorted[mid]) / 2;
        }
        return sorted[mid];
    }
}

module.exports = {
    MetricKernel
};
