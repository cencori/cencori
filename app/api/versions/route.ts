import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

// Service version helpers
const VERSIONS = {
    // Read proxy version from root package.json
    getProxyVersion: () => {
        try {
            const packagePath = join(process.cwd(), 'package.json');
            const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
            return packageJson.version || '0.1.0';
        } catch {
            return '0.1.0';
        }
    },

    // Read SDK version from packages/sdk/package.json
    getSdkVersion: () => {
        try {
            const sdkPackagePath = join(process.cwd(), 'packages', 'sdk', 'package.json');
            const sdkPackageJson = JSON.parse(readFileSync(sdkPackagePath, 'utf-8'));
            return sdkPackageJson.version || '0.1.0';
        } catch {
            return '0.1.0';
        }
    },

    // API version - the current API endpoint version
    apiVersion: 'v1',
};

export async function GET() {
    return NextResponse.json({
        sdk: VERSIONS.getSdkVersion(),
        api: VERSIONS.apiVersion,
        proxy: VERSIONS.getProxyVersion(),
        checkedAt: new Date().toISOString(),
    });
}
