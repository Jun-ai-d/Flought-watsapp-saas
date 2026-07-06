-- Migration: Add DELETE policy to conversations
-- Allows tenant members to delete conversations (and via CASCADE, their messages).

create policy "tenant members can delete their conversations"
  on conversations for delete
  using (is_tenant_member(tenant_id));
