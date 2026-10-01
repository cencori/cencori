import { afterEach, describe, expect, it } from 'vitest';
import { resolveTensorPlanModel } from '@/lib/gateway/providers-setup';

describe('Tensor plan model policy', () => {
  afterEach(() => {
    delete process.env.TENSOR_AUTO_MODEL;
    delete process.env.TENSOR_BUILDER_AUTO_MODEL;
  });

  it('routes Free requests through the server-controlled Auto model', () => {
    process.env.TENSOR_AUTO_MODEL = 'nvidia/nemotron-3-nano-30b-a3b:free';
    expect(resolveTensorPlanModel('gpt-5.6-sol', 'auto')).toBe(
      'nvidia/nemotron-3-nano-30b-a3b:free',
    );
  });

  it('defaults Free Auto requests to GLM 5.3 Flash', () => {
    expect(resolveTensorPlanModel('auto', 'auto')).toBe('glm-5.3-flash');
  });

  /**
   * Auto is the default on the Free plan, not the only option. Every request used to be replaced by
   * the auto model whatever it named, so a picker offering a choice would have been lying — the
   * pick was discarded and every turn ran on the same model.
   */
  it('serves a Free user the open-weight model they asked for', () => {
    for (const model of ['maximo-atlas-1.2', 'glm-5.3-flash']) {
      expect(resolveTensorPlanModel(model, 'auto')).toBe(model);
    }
  });

  /** A frontier model is not on this plan, and is answered rather than refused, as it always was. */
  it('still substitutes rather than refusing a frontier model on Free', () => {
    expect(resolveTensorPlanModel('claude-opus-5', 'auto')).toBe('glm-5.3-flash');
  });

  it('allows open-weight Builder models and rejects frontier models', () => {
    expect(resolveTensorPlanModel('deepseek-v4-flash', 'open_weight')).toBe(
      'deepseek-v4-flash',
    );
    expect(() => resolveTensorPlanModel('gpt-5.6-sol', 'open_weight')).toThrow();
  });

  it('does not narrow Pro frontier access', () => {
    expect(resolveTensorPlanModel('claude-opus-5', 'frontier')).toBe('claude-opus-5');
  });
});
