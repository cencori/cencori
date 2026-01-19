import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

const VERSIONS = {
    getProxyVersion: () => {
        try {
            const packagePath = join(process.cwd(), 'package.json');
            const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
            return packageJson.version || '0.1.0';
        } catch {
            return '0.1.0';
        }
    },

    getSdkVersion: () => {
        try {
            const sdkPackagePath = join(process.cwd(), 'packages', 'sdk', 'package.json');
            const sdkPackageJson = JSON.parse(readFileSync(sdkPackagePath, 'utf-8'));
            return sdkPackageJson.version || '0.1.0';
        } catch {
            return '0.1.0';
        }
    },

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
