-- ============================================================
-- Maddaniello's Physique — Schema v8 (RAG knowledge base)
-- Richiede 0001..0007 già applicate.
-- ============================================================

-- pgvector per embedding ------------------------------------
create extension if not exists vector;

-- knowledge_docs ---------------------------------------------
create table if not exists knowledge_docs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  source_url text,
  content_md text not null,
  char_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists knowledge_docs_user_idx
  on knowledge_docs(user_id, created_at desc);

-- knowledge_chunks -------------------------------------------
-- Embedding dim 1536 = OpenAI text-embedding-3-small
create table if not exists knowledge_chunks (
  id uuid primary key default uuid_generate_v4(),
  doc_id uuid not null references knowledge_docs(id) on delete cascade,
  position integer not null default 0,
  chunk_text text not null,
  embedding vector(1536) not null,
  token_count integer,
  created_at timestamptz not null default now()
);
create index if not exists knowledge_chunks_doc_idx
  on knowledge_chunks(doc_id, position);
-- HNSW per similarity search veloce su cosine distance
create index if not exists knowledge_chunks_embedding_idx
  on knowledge_chunks using hnsw (embedding vector_cosine_ops);

-- Trigger updated_at
drop trigger if exists knowledge_docs_touch on knowledge_docs;
create trigger knowledge_docs_touch before update on knowledge_docs
  for each row execute function public.touch_updated_at();

-- RLS --------------------------------------------------------
alter table knowledge_docs enable row level security;
alter table knowledge_chunks enable row level security;

drop policy if exists knowledge_docs_select_own on knowledge_docs;
create policy knowledge_docs_select_own on knowledge_docs
  for select using (auth.uid() = user_id);
drop policy if exists knowledge_docs_insert_own on knowledge_docs;
create policy knowledge_docs_insert_own on knowledge_docs
  for insert with check (auth.uid() = user_id);
drop policy if exists knowledge_docs_update_own on knowledge_docs;
create policy knowledge_docs_update_own on knowledge_docs
  for update using (auth.uid() = user_id);
drop policy if exists knowledge_docs_delete_own on knowledge_docs;
create policy knowledge_docs_delete_own on knowledge_docs
  for delete using (auth.uid() = user_id);

-- Chunks: leggibili se il doc padre è dell'utente
drop policy if exists knowledge_chunks_select on knowledge_chunks;
create policy knowledge_chunks_select on knowledge_chunks
  for select using (
    exists (
      select 1 from knowledge_docs d
      where d.id = knowledge_chunks.doc_id and d.user_id = auth.uid()
    )
  );
-- Writes SOLO via service_role (bypassa RLS). Nessuna insert policy lato client.

-- RPC per similarity search ----------------------------------
create or replace function match_knowledge_chunks(
  query_embedding vector(1536),
  match_user_id uuid,
  match_threshold float default 0.3,
  match_count int default 5
) returns table (
  id uuid,
  doc_id uuid,
  chunk_text text,
  similarity float,
  doc_title text
)
language sql
stable
as $$
  select k.id, k.doc_id, k.chunk_text,
         1 - (k.embedding <=> query_embedding) as similarity,
         d.title as doc_title
  from knowledge_chunks k
  join knowledge_docs d on d.id = k.doc_id
  where d.user_id = match_user_id
    and 1 - (k.embedding <=> query_embedding) > match_threshold
  order by k.embedding <=> query_embedding
  limit match_count;
$$;

-- ============================================================
-- FINE v8. Questa era l'ultima migration prevista.
-- ============================================================
