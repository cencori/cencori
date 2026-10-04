/**
 * Project memory settings — Redis-cached lookup of project_memory_settings.
 *
 * Memory works out of the box (API opt-in): a missing settings row means
 * defaults with enabled: true. A row exists only to customize extraction
 * or to flip the kill switch.
 */

import type { createAdminClient } from '@/lib/supabaseAdmin';
import {
    getCachedMemoryConfig,
    setCachedMemoryConfig,
} from '@/lib/config-cache';
import { DEFAULT_MEMORY_SETTINGS, resolveMemoryModel, type MemorySettings } from './types';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

export async function getProjectMemorySettings(
    supabase: SupabaseAdmin,
    projectId: string
): Promise<MemorySettings> {
    const cached = await getCachedMemoryConfig(projectId);
    if (cached?.data) {
        const settings = cached.data as MemorySettings;
        return {
            ...settings,
            extractionModel: resolveMemoryModel(settings.extractionModel),
        };
    }

    let settings: MemorySettings = DEFAULT_MEMORY_SETTINGS;

    try {
        const { data: row } = await supabase
            .from('project_memory_settings')
            // Select * rather than a column list: a settings row is one row, and
            // naming a column the live DB doesn't have yet (migrations are not
            // auto-applied) would error the whole lookup and silently drop a
            // project's custom extraction config back to defaults.
            .select('*')
            .eq('project_id', projectId)
            .maybeSingle();

        if (row) {
            settings = {
                enabled: row.enabled !== false,
                // Normalize retired/unsupported stored choices at read time. This
                // changes runtime behavior safely without a data-rewriting migration.
                extractionModel: resolveMemoryModel(row.extraction_model),
                extractionPrompt: row.extraction_prompt || null,
                minImportance:
                    typeof row.min_importance === 'number'
                        ? row.min_importance
                        : Number(row.min_importance ?? DEFAULT_MEMORY_SETTINGS.minImportance),
                maxMemoriesPerExchange:
                    row.max_memories_per_exchange ?? DEFAULT_MEMORY_SETTINGS.maxMemoriesPerExchange,
                sessionTtlSeconds:
                    row.session_ttl_seconds ?? DEFAULT_MEMORY_SETTINGS.sessionTtlSeconds,
                // Column added after the table shipped — absent (pre-migration)
                // reads as the default, not as disabled.
                graphEnabled: row.graph_enabled !== false,
                // Custom ops caps (migration 20261004). Absent pre-migration →
                // null → tier default. Positive integers only; anything else
                // is treated as unset rather than as zero (zero would brick).
                maxSearchesMonthly:
                    typeof row.max_searches_monthly === 'number' && row.max_searches_monthly > 0
                        ? Math.floor(row.max_searches_monthly)
                        : null,
                maxWritesMonthly:
                    typeof row.max_writes_monthly === 'number' && row.max_writes_monthly > 0
                        ? Math.floor(row.max_writes_monthly)
                        : null,
            };
        }
    } catch (error) {
        console.warn('[Memory] Settings lookup failed, using defaults:', error);
    }

    await setCachedMemoryConfig(projectId, settings);
    return settings;
}
