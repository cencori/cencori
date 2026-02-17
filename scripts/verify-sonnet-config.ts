
import { SUPPORTED_PROVIDERS, getModel, detectProviderFromModel } from '../lib/providers/config';

console.log('Verifying Sonnet 4.6 Configuration...');

const modelId = 'claude-sonnet-4.6';
const model = getModel(modelId);
const provider = detectProviderFromModel(modelId);

if (model) {
    console.log(`✅ Model found: ${model.name} (${model.id})`);
    console.log(`   Type: ${model.type}`);
    console.log(`   Context Window: ${model.contextWindow}`);
} else {
    console.error(`❌ Model ${modelId} not found in configuration.`);
    process.exit(1);
}

if (provider === 'anthropic') {
    console.log(`✅ Provider detected correctly: ${provider}`);
} else {
    console.error(`❌ Provider detection failed. Expected 'anthropic', got '${provider}'`);
    process.exit(1);
}

// Check provider list inclusion
const anthropicProvider = SUPPORTED_PROVIDERS.find(p => p.id === 'anthropic');
const modelInList = anthropicProvider?.models.some(m => m.id === modelId);

if (modelInList) {
    console.log(`✅ Model listed in Anthropic provider config.`);
} else {
    console.error(`❌ Model not found in Anthropic provider models list.`);
    process.exit(1);
}

console.log('Verification successful!');
