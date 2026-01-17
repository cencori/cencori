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

// src/workflow/index.ts
var workflow_exports = {};
__export(workflow_exports, {
  WorkflowNamespace: () => WorkflowNamespace
});
module.exports = __toCommonJS(workflow_exports);
var WorkflowNamespace = class {
  /**
   * Trigger a workflow
   * 
   * 🚧 Coming Soon - This feature is not yet available.
   */
  async trigger(workflowId, options) {
    throw new Error(
      `cencori.workflow.trigger() is coming soon! Workflow "${workflowId}" cannot be triggered yet. Join our waitlist at https://cencori.com/workflow`
    );
  }
  /**
   * Create a new workflow
   * 
   * 🚧 Coming Soon - This feature is not yet available.
   */
  async create(config) {
    throw new Error(
      `cencori.workflow.create() is coming soon! Join our waitlist at https://cencori.com/workflow`
    );
  }
  /**
   * Get workflow run status
   * 
   * 🚧 Coming Soon - This feature is not yet available.
   */
  async status(runId) {
    throw new Error(
      `cencori.workflow.status() is coming soon! Join our waitlist at https://cencori.com/workflow`
    );
  }
  /**
   * List workflows
   * 
   * 🚧 Coming Soon - This feature is not yet available.
   */
  async list() {
    throw new Error(
      `cencori.workflow.list() is coming soon! Join our waitlist at https://cencori.com/workflow`
    );
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  WorkflowNamespace
});
//# sourceMappingURL=index.js.map