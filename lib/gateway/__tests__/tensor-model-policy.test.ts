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

  /** Trial and Starter run on two models, and Tensor's Auto names the one it wants for a turn. */
  it('serves either Starter model when it is asked for by name', () => {
    for (const model of ['deepseek-v4-flash', 'maximo-atlas-1.3', 'maximo-atlas-1.2']) {
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

  /** Builder is Starter's two models plus the open-weight ones. */
  it('serves Starter\'s models and the open-weight models on Builder', () => {
    for (const model of ['maximo-atlas-1.3', 'deepseek-v4-flash', 'deepseek-v4-pro', 'glm-5.3-flash']) {
      expect(resolveTensorPlanModel(model, 'open_weight')).toBe(model);
    }
  });

  it('serves Maximo on Pro', () => {
    expect(resolveTensorPlanModel('maximo-atlas-1.3', 'frontier')).toBe('maximo-atlas-1.3');
  });

  it('does not narrow Pro frontier access', () => {
    expect(resolveTensorPlanModel('claude-opus-5', 'frontier')).toBe('claude-opus-5');
  });
});
