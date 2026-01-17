"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/compute/index.ts
var compute_exports = {};
__export(compute_exports, {
  ComputeNamespace: () => ComputeNamespace
});
module.exports = __toCommonJS(compute_exports);
var ComputeNamespace = class {
  /**
   * Run a serverless function
   * 
   * 🚧 Coming Soon - This feature is not yet available.
   */
  async run(functionId, options) {
    throw new Error(
      `cencori.compute.run() is coming soon! Function "${functionId}" cannot be executed yet. Join our waitlist at https://cencori.com/compute`
    );
  }
  /**
   * Deploy a function
   * 
   * 🚧 Coming Soon - This feature is not yet available.
   */
  async deploy(config) {
    throw new Error(
      `cencori.compute.deploy() is coming soon! Join our waitlist at https://cencori.com/compute`
    );
  }
  /**
   * List deployed functions
   * 
   * 🚧 Coming Soon - This feature is not yet available.
   */
  async list() {
    throw new Error(
      `cencori.compute.list() is coming soon! Join our waitlist at https://cencori.com/compute`
    );
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ComputeNamespace
});
//# sourceMappingURL=index.js.map