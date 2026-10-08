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

  it('defaults Free Auto requests to DeepSeek V4 Flash', () => {
    expect(resolveTensorPlanModel('auto', 'auto')).toBe('deepseek-v4-flash');
  });

  /**
   * Free/auto is request-counted, so it stays pinned to the cheap weak models.
   * Atlas + flash pass through; expensive open-weight falls back to auto.
   */
  it('serves a Free user the cheap auto model they asked for', () => {
    for (const model of ['maximo-atlas-1.3', 'maximo-atlas-1.2', 'deepseek-v4-flash']) {
      expect(resolveTensorPlanModel(model, 'auto')).toBe(model);
    }
  });

  it('falls back to auto for expensive open-weight on Free', () => {
    expect(resolveTensorPlanModel('glm-5.3-flash', 'auto')).toBe('deepseek-v4-flash');
    expect(resolveTensorPlanModel('deepseek-v4-pro', 'auto')).toBe('deepseek-v4-flash');
  });

  /** A frontier model is not on this plan, and is answered rather than refused, as it always was. */
  it('still substitutes rather than refusing a frontier model on Free', () => {
    expect(resolveTensorPlanModel('claude-opus-5', 'auto')).toBe('deepseek-v4-flash');
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
