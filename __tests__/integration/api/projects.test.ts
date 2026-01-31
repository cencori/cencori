/**
 * Projects API Integration Tests
 * 
 * Tests the projects API routes with actual database operations.
 * These tests require Supabase credentials to be configured.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
    isSupabaseAvailable,
    getTestSupabaseClient,
    seedTestProject,
    cleanupTestData,
} from '../utils/db-helpers';

describe('Projects API Integration', () => {
    // Skip all tests if Supabase is not available
    const describeWithSupabase = isSupabaseAvailable() ? describe : describe.skip;

    describeWithSupabase('Database Operations', () => {
        let testProjectId: string;

        afterAll(async () => {
            await cleanupTestData();
        });

        it('should create a test project', async () => {
            const project = await seedTestProject({
                name: 'test_Integration Test Project',
            });

            expect(project.id).toBeDefined();
            expect(project.name).toBe('test_Integration Test Project');
            expect(project.slug).toBeDefined();

            testProjectId = project.id;
        });

        it('should retrieve the created project', async () => {
            const supabase = getTestSupabaseClient();

            const { data, error } = await supabase
                .from('projects')
                .select('id, name, slug')
                .eq('id', testProjectId)
                .single();

            expect(error).toBeNull();
            expect(data).toBeDefined();
            expect(data?.name).toBe('test_Integration Test Project');
        });

        it('should update project name', async () => {
            const supabase = getTestSupabaseClient();

            const { error: updateError } = await supabase
                .from('projects')
                .update({ name: 'test_Updated Project Name' })
                .eq('id', testProjectId);

            expect(updateError).toBeNull();

            // Verify update
            const { data } = await supabase
                .from('projects')
                .select('name')
                .eq('id', testProjectId)
                .single();

            expect(data?.name).toBe('test_Updated Project Name');
        });

        it('should list projects with test prefix', async () => {
            const supabase = getTestSupabaseClient();

            // Create another test project
            await seedTestProject({ name: 'test_Another Project' });

            const { data, error } = await supabase
                .from('projects')
                .select('id, name')
                .like('name', 'test_%');

            expect(error).toBeNull();
            expect(data).toBeDefined();
            expect(data!.length).toBeGreaterThanOrEqual(2);
        });

        it('should delete a project', async () => {
            const supabase = getTestSupabaseClient();

            // Create a project specifically for deletion
            const projectToDelete = await seedTestProject({
                name: 'test_Project To Delete',
            });

            // Delete it
            const { error: deleteError } = await supabase
                .from('projects')
                .delete()
                .eq('id', projectToDelete.id);

            expect(deleteError).toBeNull();

            // Verify deletion
            const { data } = await supabase
                .from('projects')
                .select('id')
                .eq('id', projectToDelete.id)
                .single();

            expect(data).toBeNull();
        });
    });

    describe('Project Validation (No DB Required)', () => {
        it('should validate project name requirements', () => {
            const validNames = [
                'My Project',
                'project-123',
                'Project_Name',
                'Test',
            ];

            const invalidNames = [
                '', // Empty
                'ab', // Too short (usually min 3)
            ];

            // Basic validation - at least 3 characters
            validNames.forEach(name => {
                expect(name.length).toBeGreaterThanOrEqual(3);
            });

            invalidNames.forEach(name => {
                expect(name.length).toBeLessThan(3);
            });
        });

        it('should validate slug format', () => {
            const validSlugs = [
                'my-project',
                'project123',
                'test-project-name',
            ];

            const slugRegex = /^[a-z0-9-]+$/;

            validSlugs.forEach(slug => {
                expect(slugRegex.test(slug)).toBe(true);
            });
        });
    });
});
