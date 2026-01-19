import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { encryptApiKey } from '@/lib/encryption';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ orgSlug: string }> }
) {
    const supabase = createAdminClient();

    try {
        const { orgSlug } = await params;

        const { data: org, error: orgError } = await supabase
            .from('organizations')
            .select('id')
            .eq('slug', orgSlug)
            .single();

        if (orgError || !org) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        const { data: providers, error } = await supabase
            .from('custom_providers')
            .select(`
        id,
        name,
        base_url,
        format,
        is_active,
        created_at,
        custom_models(id, name, model_id)
      `)
            .eq('organization_id', org.id)
            .order('created_at', { ascending: false });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ providers: providers || [] });
    } catch (error) {
        console.error('[API] Error fetching providers:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ orgSlug: string }> }
) {
    const supabase = createAdminClient();

    try {
        const { orgSlug } = await params;

        const { data: org, error: orgError } = await supabase
            .from('organizations')
            .select('id')
            .eq('slug', orgSlug)
            .single();

        if (orgError || !org) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        const body = await req.json();
        const { name, baseUrl, apiKey, format, models } = body;

        if (!name || !baseUrl || !format) {
            return NextResponse.json(
                { error: 'Missing required fields: name, baseUrl, format' },
                { status: 400 }
            );
        }

        const encryptedKey = apiKey ? encryptApiKey(apiKey, org.id) : null;

        const { data: provider, error } = await supabase
            .from('custom_providers')
            .insert({
                organization_id: org.id,
                name,
                base_url: baseUrl,
                api_key_encrypted: encryptedKey,
                format,
                is_active: true,
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (models && Array.isArray(models) && models.length > 0) {
            const modelsToInsert = models.map((model: { name: string; modelId: string }) => ({
                provider_id: provider.id,
                name: model.name,
                model_id: model.modelId,
            }));

            await supabase.from('custom_models').insert(modelsToInsert);
        }

        return NextResponse.json({ provider }, { status: 201 });
    } catch (error) {
        console.error('[API] Error creating provider:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
