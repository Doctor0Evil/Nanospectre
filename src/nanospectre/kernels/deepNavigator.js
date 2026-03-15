// File: src/nanospectre/kernels/deepNavigator.js
// Nanospectre deep-excavation + hidden-object navigation kernel.

class DeepNavigator {
  constructor(config = {}) {
    this.maxDepth = typeof config.maxDepth === "number" ? config.maxDepth : 64;
    this.maxMatches = typeof config.maxMatches === "number" ? config.maxMatches : 256;
    this.enableContextHash = config.enableContextHash === true;
  }

  // Internal: safe type helpers (nanoscale JSON / DOM-like).
  static isObject(v) {
    return v !== null && typeof v === "object" && !Array.isArray(v);
  }

  static isArray(v) {
    return Array.isArray(v);
  }

  // Internal: tiny, deterministic context hash for “hidden” navigation anchors.
  static contextHash(fragment) {
    const json = JSON.stringify(fragment);
    let h = 0;
    for (let i = 0; i < json.length; i++) {
      h = (h * 31 + json.charCodeAt(i)) >>> 0;
    }
    return h.toString(16);
  }

  /**
   * Deep excavation over arbitrary tree.
   * - root: JSON / DOM-like node.
   * - predicate: (value, path, meta) => boolean.
   * Returns array of match records with minimal context.
   */
  excavate(root, predicate) {
    const matches = [];
    const stack = [
      {
        node: root,
        path: [],
        depth: 0,
        parentWindow: null
      }
    ];

    while (stack.length > 0 && matches.length < this.maxMatches) {
      const frame = stack.pop();
      const { node, path, depth } = frame;

      if (depth > this.maxDepth) {
        continue;
      }

      const meta = {
        depth,
        isArray: DeepNavigator.isArray(node),
        isObject: DeepNavigator.isObject(node)
      };

      try {
        if (predicate(node, path, meta) === true) {
          const record = {
            kind: "deepnav.match.v1",
            path,
            depth,
            value: node
          };

          if (this.enableContextHash) {
            const contextFragment = this._extractContextFragment(root, path, 2);
            record.contextHash = DeepNavigator.contextHash(contextFragment);
          }

          matches.push(record);
        }
      } catch {
        // Predicate errors are ignored to keep kernel robust.
      }

      if (DeepNavigator.isArray(node)) {
        for (let i = node.length - 1; i >= 0; i--) {
          stack.push({
            node: node[i],
            path: path.concat(i),
            depth: depth + 1
          });
        }
      } else if (DeepNavigator.isObject(node)) {
        const keys = Object.keys(node);
        for (let i = keys.length - 1; i >= 0; i--) {
          const k = keys[i];
          stack.push({
            node: node[k],
            path: path.concat(k),
            depth: depth + 1
          });
        }
      }
    }

    return matches;
  }

  /**
   * Hidden-object navigation using a compact path motif.
   * motif = {
   *   pathPattern: Array< string | number | { anyKey?: true, anyIndex?: true } >,
   *   valueHint?: { equals?: any, containsText?: string, type?: string },
   *   contextHash?: string
   * }
   */
  navigate(root, motif) {
    const { pathPattern, valueHint, contextHash } = motif || {};
    if (!Array.isArray(pathPattern) || pathPattern.length === 0) {
      return [];
    }

    const predicate = (node, path) => {
      if (!this._matchPath(path, pathPattern)) {
        return false;
      }

      if (valueHint) {
        if (!this._matchValueHint(node, valueHint)) {
          return false;
        }
      }

      if (contextHash && this.enableContextHash) {
        const fragment = this._extractContextFragment(root, path, 2);
        const h = DeepNavigator.contextHash(fragment);
        if (h !== contextHash) {
          return false;
        }
      }

      return true;
    };

    return this.excavate(root, predicate);
  }

  // Path matcher for simple wildcards.
  _matchPath(actualPath, pattern) {
    if (actualPath.length < pattern.length) {
      return false;
    }

    const offset = actualPath.length - pattern.length;
    for (let i = 0; i < pattern.length; i++) {
      const expect = pattern[i];
      const got = actualPath[offset + i];

      if (typeof expect === "string" || typeof expect === "number") {
        if (got !== expect) {
          return false;
        }
      } else if (expect && typeof expect === "object") {
        if (expect.anyKey === true && typeof got === "string") {
          continue;
        }
        if (expect.anyIndex === true && typeof got === "number") {
          continue;
        }
        return false;
      } else {
        return false;
      }
    }

    return true;
  }

  // Minimal value-hint matcher.
  _matchValueHint(node, hint) {
    if (hint.type) {
      if (hint.type === "array" && !DeepNavigator.isArray(node)) return false;
      if (hint.type === "object" && !DeepNavigator.isObject(node)) return false;
      if (hint.type === "string" && typeof node !== "string") return false;
      if (hint.type === "number" && typeof node !== "number") return false;
    }

    if (Object.prototype.hasOwnProperty.call(hint, "equals")) {
      if (node !== hint.equals) return false;
    }

    if (hint.containsText && typeof node === "string") {
      if (!node.toLowerCase().includes(String(hint.containsText).toLowerCase())) {
        return false;
      }
    } else if (hint.containsText && typeof node !== "string") {
      return false;
    }

    return true;
  }

  // Extract a small neighborhood around the path for hashing.
  _extractContextFragment(root, path, radius) {
    // For JSON-like trees, “context” is just the parent plus nearby siblings.
    if (!path.length) {
      return root;
    }

    const parentPath = path.slice(0, -1);
    const key = path[path.length - 1];

    let parent = root;
    for (let i = 0; i < parentPath.length; i++) {
      const p = parentPath[i];
      if (parent == null) break;
      parent = parent[p];
    }

    if (DeepNavigator.isArray(parent) && typeof key === "number") {
      const start = Math.max(0, key - radius);
      const end = Math.min(parent.length, key + radius + 1);
      return parent.slice(start, end);
    }

    if (DeepNavigator.isObject(parent) && typeof key === "string") {
      const out = {};
      const keys = Object.keys(parent);
      const idx = keys.indexOf(key);
      const start = Math.max(0, idx - radius);
      const end = Math.min(keys.length, idx + radius + 1);
      for (let i = start; i < end; i++) {
        const k = keys[i];
        out[k] = parent[k];
      }
      return out;
    }

    return parent;
  }
}

module.exports = DeepNavigator;
