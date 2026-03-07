alter table scan_chat_memory
    drop constraint if exists scan_chat_memory_source_check;

alter table scan_chat_memory
    add constraint scan_chat_memory_source_check
    check (
        source in (
            'chat',
            'dismiss',
            'pr_merged',
            'done',
            'project_brief',
            'scan_summary',
            'accepted_risk',
            'weak_spot'
        )
    );
