// File: src/nanoswarm/objects/selectorObject.js

/**
 * SelectorObject:
 * Stable nanoscale descriptor for DOM or file-system targets.
 */

class SelectorObject {
    constructor({
        selectorId,
        kind,                 // "dom" | "file"
        primary,
        fallbacks = [],
        priority = 0,
        robustness = {
            allowTextFuzzyMatch: false,
            allowAttributeContains: false
        },
        contextHash = null,   // hash of nearby text/structure, optional
        description = ""
    }) {
        this.kind = "selector_object.v1";
        this.selectorId = selectorId;
        this.targetKind = kind;
        this.primary = primary;
        this.fallbacks = fallbacks;
        this.priority = priority;
        this.robustness = robustness;
        this.contextHash = contextHash;
        this.description = description;
    }

    toJSON() {
        return {
            kind: this.kind,
            selectorId: this.selectorId,
            targetKind: this.targetKind,
            primary: this.primary,
            fallbacks: this.fallbacks,
            priority: this.priority,
            robustness: this.robustness,
            contextHash: this.contextHash,
            description: this.description
        };
    }

    static validate(obj) {
        if (!obj || obj.kind !== "selector_object.v1") return false;
        if (typeof obj.selectorId !== "string") return false;
        if (obj.targetKind !== "dom" && obj.targetKind !== "file") return false;
        if (typeof obj.primary !== "string") return false;
        if (!Array.isArray(obj.fallbacks)) return false;
        return true;
    }

    /**
     * DOM match helper (browser or jsdom context).
     * Tries primary then fallbacks via querySelector.
     */
    findDomElement(root = document) {
        if (this.targetKind !== "dom") {
            throw new Error("SelectorObject is not DOM kind");
        }

        let el = root.querySelector(this.primary);
        if (el) return el;

        for (const sel of this.fallbacks) {
            el = root.querySelector(sel);
            if (el) return el;
        }

        return null;
    }

    /**
     * File match helper: checks if a given path matches primary or any fallback.
     * Uses simple substring matching; can be strengthened later.
     */
    matchesFilePath(path) {
        if (this.targetKind !== "file") {
            throw new Error("SelectorObject is not file kind");
        }
        if (path.includes(this.primary)) return true;
        return this.fallbacks.some(f => path.includes(f));
    }
}

module.exports = {
    SelectorObject
};
