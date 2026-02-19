import { detectProviderFromModel, getProvider, getModel } from '../lib/providers/config';

function verifyGemini31() {
    console.log('🧪 Verifying Gemini 3.1 Pro Configuration...');

    const modelsToTest = [
        'gemini-3.1-pro-preview',
        'gemini-3.1-pro-preview-customtools'
    ];

    for (const modelId of modelsToTest) {
        console.log(`\nChecking model: ${modelId}`);

        const providerId = detectProviderFromModel(modelId);
        console.log(`- Detected Provider: ${providerId}`);

        const model = getModel(modelId);
        if (model) {
            console.log(`- Model Info: ${model.name} (${model.type})`);
            console.log(`- Context Window: ${model.contextWindow}`);
            console.log(`- Description: ${model.description}`);
        } else {
            console.log(`- ❌ Model not found in configuration!`);
        }

        if (providerId !== 'google') {
            console.log(`- ❌ Incorrect provider detected! Expected 'google', got '${providerId}'`);
        } else {
            console.log(`- ✅ Provider correctly detected.`);
        }
    }
}

verifyGemini31();
