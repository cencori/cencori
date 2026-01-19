import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { encryptApiKey } from '@/lib/encryption';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgSlug: string; providerId: string }> }
) {
  const supabase = createAdminClient();
  
  try {
    const { orgSlug, providerId } = await params;
    const body = await req.json();
    const { name, baseUrl, apiKey, format, isActive } = body;
    
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', orgSlug)
      .single();
    
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }
    
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (baseUrl !== undefined) updateData.base_url = baseUrl;
    if (format !== undefined) updateData.format = format;
    if (isActive !== undefined) updateData.is_active = isActive;
    if (apiKey !== undefined) {
      updateData.api_key_encrypted = apiKey ? encryptApiKey(apiKey, org.id) : null;
    }
    
    const { data: provider, error } = await supabase
      .from('custom_providers')
      .update(updateData)
      .eq('id', providerId)
      .eq('organization_id', org.id)
      .select()
      .single();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ provider });
  } catch (error) {
    console.error('[API] Error updating provider:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgSlug: string; providerId: string }> }
) {
  const supabase = createAdminClient();
  
  try {
    const { orgSlug, providerId } = await params;
    
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', orgSlug)
      .single();
    
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }
    
    const { error } = await supabase
      .from('custom_providers')
      .delete()
      .eq('id', providerId)
      .eq('organization_id', org.id);
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting provider:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
