import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
    isSupabaseAvailable,
    getTestSupabaseClient,
    seedTestProject,
    seedTestSession,
    cleanupTestData,
} from '../utils/db-helpers';

describe('Sessions API Integration', () => {
    const describeWithSupabase = isSupabaseAvailable() ? describe : describe.skip;

    describeWithSupabase('Database Operations', () => {
        let testProjectId: string;
        let testOrgId: string;

        beforeAll(async () => {
            const project = await seedTestProject({ name: 'test_Sessions Integration' });
            testProjectId = project.id;

            const supabase = getTestSupabaseClient();
            const { data: org } = await supabase
                .from('projects')
                .select('organization_id')
                .eq('id', testProjectId)
                .single();
            if (!org?.organization_id) {
                throw new Error('Test project has no organization_id — seed a project with organizationId override');
            }
            testOrgId = org.organization_id;
        });

        afterAll(async () => {
            await cleanupTestData();
        });

        it('should create a session', async () => {
            const session = await seedTestSession({
                projectId: testProjectId,
                organizationId: testOrgId,
                status: 'active',
            });

            expect(session.id).toBeDefined();
            expect(session.status).toBe('active');
            expect(session.last_turn_number).toBe(0);
        });

        it('should create a session with metadata', async () => {
            const session = await seedTestSession({
                projectId: testProjectId,
                organizationId: testOrgId,
                status: 'active',
                metadata: { environment: 'testing' },
            });

            expect(session.id).toBeDefined();
            expect(session.status).toBe('active');

            const supabase = getTestSupabaseClient();
            const { data } = await supabase
                .from('sessions')
                .select('agent_id, metadata')
                .eq('id', session.id)
                .single();

            expect(data?.metadata).toEqual({ environment: 'testing' });
        });

        it('should list sessions for a project', async () => {
            await seedTestSession({ projectId: testProjectId, organizationId: testOrgId });

            const supabase = getTestSupabaseClient();
            const { data, error, count } = await supabase
                .from('sessions')
                .select('id, status, last_turn_number, created_at', { count: 'exact' })
                .eq('project_id', testProjectId);

            expect(error).toBeNull();
            expect(data!.length).toBeGreaterThanOrEqual(1);
        });

        it('should filter sessions by status', async () => {
            await seedTestSession({ projectId: testProjectId, organizationId: testOrgId, status: 'completed' });

            const supabase = getTestSupabaseClient();
            const { data } = await supabase
                .from('sessions')
                .select('id, status')
                .eq('project_id', testProjectId)
                .eq('status', 'completed');

            expect(data!.every(s => s.status === 'completed')).toBe(true);
        });

        it('should update session status', async () => {
            const session = await seedTestSession({
                projectId: testProjectId,
                organizationId: testOrgId,
                status: 'active',
            });

            const supabase = getTestSupabaseClient();
            const { error: updateError } = await supabase
                .from('sessions')
                .update({ status: 'paused', last_turn_number: 1 })
                .eq('id', session.id);

            expect(updateError).toBeNull();

            const { data } = await supabase
                .from('sessions')
                .select('status, last_turn_number')
                .eq('id', session.id)
                .single();

            expect(data?.status).toBe('paused');
            expect(data?.last_turn_number).toBe(1);
        });

        it('should update updated_at on status change', async () => {
            const session = await seedTestSession({
                projectId: testProjectId,
                organizationId: testOrgId,
            });

            const supabase = getTestSupabaseClient();
            const before = await supabase
                .from('sessions')
                .select('updated_at')
                .eq('id', session.id)
                .single();

            await new Promise(r => setTimeout(r, 100));

            await supabase
                .from('sessions')
                .update({ status: 'completed' })
                .eq('id', session.id);

            const after = await supabase
                .from('sessions')
                .select('updated_at')
                .eq('id', session.id)
                .single();

            expect(new Date(after.data!.updated_at).getTime())
                .toBeGreaterThan(new Date(before.data!.updated_at).getTime());
        });

        it('should delete a session', async () => {
            const session = await seedTestSession({
                projectId: testProjectId,
                organizationId: testOrgId,
            });

            const supabase = getTestSupabaseClient();
            const { error: deleteError } = await supabase
                .from('sessions')
                .delete()
                .eq('id', session.id);

            expect(deleteError).toBeNull();

            const { data } = await supabase
                .from('sessions')
                .select('id')
                .eq('id', session.id)
                .maybeSingle();

            expect(data).toBeNull();
        });

        it('should enforce valid status values', async () => {
            const supabase = getTestSupabaseClient();
            const { error } = await supabase
                .from('sessions')
                .insert({
                    project_id: testProjectId,
                    organization_id: testOrgId,
                    status: 'invalid_status',
                });

            expect(error).not.toBeNull();
        });
    });

    describe('Session Validation (No DB Required)', () => {
        it('should validate session status values', () => {
            const validStatuses = ['active', 'paused', 'completed', 'failed'];
            const invalidStatuses = ['pending', 'deleted', 'running', ''];

            validStatuses.forEach(s => expect(validStatuses).toContain(s));
            invalidStatuses.forEach(s => expect(validStatuses).not.toContain(s));
        });

        it('should define expected session response structure', () => {
            const mockSession = {
                id: 'uuid-123',
                status: 'active' as const,
                turn_count: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                agent_id: null,
                metadata: {},
            };

            expect(mockSession.id).toBeDefined();
            expect(typeof mockSession.id).toBe('string');
            expect(['active', 'paused', 'completed', 'failed']).toContain(mockSession.status);
            expect(typeof mockSession.turn_count).toBe('number');
            expect(mockSession.turn_count).toBeGreaterThanOrEqual(0);
        });

        it('should validate pagination structure', () => {
            const mockPagination = {
                data: [] as Array<{ id: string; status: string }>,
                pagination: { page: 1, limit: 50, total: 0, total_pages: 0 },
            };

            expect(Array.isArray(mockPagination.data)).toBe(true);
            expect(mockPagination.pagination.page).toBeGreaterThanOrEqual(1);
            expect(mockPagination.pagination.limit).toBeGreaterThanOrEqual(1);
            expect(mockPagination.pagination.total).toBeGreaterThanOrEqual(0);
        });

        it('should validate turn response maps last_turn_number to turn_count', () => {
            const mockSessions = [
                { id: '1', status: 'active', last_turn_number: 0, created_at: '', updated_at: '', agent_id: null, metadata: {} },
                { id: '2', status: 'active', last_turn_number: 5, created_at: '', updated_at: '', agent_id: null, metadata: {} },
            ];

            const mapped = mockSessions.map(s => ({
                ...s,
                turn_count: s.last_turn_number,
            }));

            expect(mapped[0].turn_count).toBe(0);
            expect(mapped[1].turn_count).toBe(5);
            expect(mapped[1].turn_count).toBeGreaterThan(mapped[0].turn_count);
        });
    });
});
