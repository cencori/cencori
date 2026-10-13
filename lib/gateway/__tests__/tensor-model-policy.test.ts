import { afterEach, describe, expect, it } from 'vitest';
import { resolveTensorPlanModel } from '@/lib/gateway/providers-setup';

describe('Tensor plan model policy', () => {
  afterEach(() => {
    delete process.env.TENSOR_AUTO_MODEL;
    delete process.env.TENSOR_BUILDER_AUTO_MODEL;
    delete process.env.TENSOR_ONLY_MODEL;
  });

  /** While the open-weight upstream is down, one model that works answers every plan below Pro. */
  it('answers Trial, Starter and Builder with the one model when one is set', () => {
    process.env.TENSOR_ONLY_MODEL = 'maximo-atlas-1.3';
    for (const model of ['auto', 'glm-5.3-flash', 'deepseek-v4-flash', 'gpt-5.6-sol']) {
      expect(resolveTensorPlanModel(model, 'auto')).toBe('maximo-atlas-1.3');
      expect(resolveTensorPlanModel(model, 'open_weight')).toBe('maximo-atlas-1.3');
    }
    expect(resolveTensorPlanModel('claude-opus-5', 'frontier')).toBe('claude-opus-5');
  });

  it('routes Free requests through the server-controlled Auto model', () => {
    process.env.TENSOR_AUTO_MODEL = 'nvidia/nemotron-3-nano-30b-a3b:free';
    expect(resolveTensorPlanModel('gpt-5.6-sol', 'auto')).toBe(
      'nvidia/nemotron-3-nano-30b-a3b:free',
    );
  });

  it('answers even the cheap model by name with the pinned one', () => {
    process.env.TENSOR_AUTO_MODEL = 'maximo-atlas-1.3';
    expect(resolveTensorPlanModel('deepseek-v4-flash', 'auto')).toBe('maximo-atlas-1.3');
    expect(resolveTensorPlanModel('glm-5.3-flash', 'auto')).toBe('maximo-atlas-1.3');
  });

  it('defaults Free Auto requests to DeepSeek V4 Flash', () => {
    expect(resolveTensorPlanModel('auto', 'auto')).toBe('deepseek-v4-flash');
  });

  /** Trial and Starter are counted in tasks with a small ceiling each, so one cheap model serves them. */
  it('serves the cheap model when it is asked for by name', () => {
    expect(resolveTensorPlanModel('deepseek-v4-flash', 'auto')).toBe('deepseek-v4-flash');
  });

  /** A Maximo task averages more than a Starter task may cost, so it would rarely finish there. */
  it('answers a Maximo request on Trial and Starter with the auto model', () => {
    for (const model of ['maximo-atlas-1.3', 'maximo-atlas-1.2']) {
      expect(resolveTensorPlanModel(model, 'auto')).toBe('deepseek-v4-flash');
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

  /** The desktop app selects Maximo by default, so Builder answers it rather than refusing. */
  it('answers a Maximo request on Builder with Builder\'s own model', () => {
    expect(resolveTensorPlanModel('maximo-atlas-1.3', 'open_weight')).toBe('glm-5.3-flash');
    process.env.TENSOR_BUILDER_AUTO_MODEL = 'qwen-4-coder';
    expect(resolveTensorPlanModel('maximo-atlas-1.3', 'open_weight')).toBe('qwen-4-coder');
  });

  it('serves Maximo on Pro', () => {
    expect(resolveTensorPlanModel('maximo-atlas-1.3', 'frontier')).toBe('maximo-atlas-1.3');
  });

  it('does not narrow Pro frontier access', () => {
    expect(resolveTensorPlanModel('claude-opus-5', 'frontier')).toBe('claude-opus-5');
  });
});
