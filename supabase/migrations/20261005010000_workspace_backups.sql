-- Private immutable snapshots. No service role is used by the browser.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('workspace-backups', 'workspace-backups', false, 26214400, array['application/json'])
on conflict (id) do nothing;
create policy workspace_backup_read on storage.objects for select to authenticated
using (bucket_id = 'workspace-backups'
  and (storage.foldername(name))[1] = auth.jwt()->'app_metadata'->>'organisation_id'
  and (storage.foldername(name))[2] = auth.uid()::text);
create policy workspace_backup_insert on storage.objects for insert to authenticated
with check (bucket_id = 'workspace-backups'
  and (storage.foldername(name))[1] = auth.jwt()->'app_metadata'->>'organisation_id'
  and (storage.foldername(name))[2] = auth.uid()::text
  and auth.jwt()->'app_metadata'->>'role' in ('SUPER_ADMIN','ORGANISATION_ADMIN','ENERGY_MANAGER','ANALYST'));
-- No update or delete policy: old snapshots are not silently overwritten.
-- Administrators must establish retention/cleanup and verify existing permissive
-- storage policies do not grant broader access to this bucket.
