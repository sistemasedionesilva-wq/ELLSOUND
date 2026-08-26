-- SQL para Configuração do Banco de Dados no Supabase
-- Copie e cole este código no editor SQL do seu painel Supabase (SQL Editor)

-- 1. TABELA DE MÚSICAS CURTIDAS (LIKED SONGS)
create table if not exists public.liked_songs (
    id uuid default gen_random_uuid() primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    track_id text not null,
    title text not null,
    artist text not null,
    album text,
    artwork text,
    preview_url text,
    duration_ms integer,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    
    unique(user_id, track_id)
);

-- Ativa RLS (Row Level Security) na tabela
alter table public.liked_songs enable row level security;

-- Políticas de acesso para liked_songs
create policy "Usuários podem ver apenas suas próprias músicas curtidas" 
    on public.liked_songs for select 
    using (auth.uid() = user_id);

create policy "Usuários podem curtir músicas para si mesmos" 
    on public.liked_songs for insert 
    with check (auth.uid() = user_id);

create policy "Usuários podem descurtir suas próprias músicas" 
    on public.liked_songs for delete 
    using (auth.uid() = user_id);


-- 2. TABELA DE PLAYLISTS
create table if not exists public.playlists (
    id uuid default gen_random_uuid() primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    description text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.playlists enable row level security;

-- Políticas de acesso para playlists
create policy "Usuários podem visualizar suas próprias playlists" 
    on public.playlists for select 
    using (auth.uid() = user_id);

create policy "Usuários podem criar suas próprias playlists" 
    on public.playlists for insert 
    with check (auth.uid() = user_id);

create policy "Usuários podem atualizar suas próprias playlists" 
    on public.playlists for update 
    using (auth.uid() = user_id);

create policy "Usuários podem deletar suas próprias playlists" 
    on public.playlists for delete 
    using (auth.uid() = user_id);


-- 3. TABELA DE MÚSICAS DAS PLAYLISTS (PLAYLIST TRACKS)
create table if not exists public.playlist_tracks (
    id uuid default gen_random_uuid() primary key,
    playlist_id uuid not null references public.playlists(id) on delete cascade,
    track_id text not null,
    title text not null,
    artist text not null,
    album text,
    artwork text,
    preview_url text,
    duration_ms integer,
    added_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.playlist_tracks enable row level security;

-- Políticas de acesso para playlist_tracks baseadas na posse da playlist pai
create policy "Usuários podem ver músicas de suas playlists" 
    on public.playlist_tracks for select 
    using (
        exists (
            select 1 from public.playlists 
            where public.playlists.id = playlist_tracks.playlist_id 
            and public.playlists.user_id = auth.uid()
        )
    );

create policy "Usuários podem adicionar músicas em suas playlists" 
    on public.playlist_tracks for insert 
    with check (
        exists (
            select 1 from public.playlists 
            where public.playlists.id = playlist_tracks.playlist_id 
            and public.playlists.user_id = auth.uid()
        )
    );

create policy "Usuários podem remover músicas de suas playlists" 
    on public.playlist_tracks for delete 
    using (
        exists (
            select 1 from public.playlists 
            where public.playlists.id = playlist_tracks.playlist_id 
            and public.playlists.user_id = auth.uid()
        )
    );


-- 4. TABELA DE HISTÓRICO DE REPRODUÇÃO (PLAY HISTORY)
create table if not exists public.play_history (
    id uuid default gen_random_uuid() primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    track_id text not null,
    title text not null,
    artist text not null,
    album text,
    artwork text,
    preview_url text,
    duration_ms integer,
    played_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.play_history enable row level security;

-- Políticas de acesso para play_history
create policy "Usuários podem ver seu próprio histórico de reprodução" 
    on public.play_history for select 
    using (auth.uid() = user_id);

create policy "Usuários podem registrar músicas tocadas" 
    on public.play_history for insert 
    with check (auth.uid() = user_id);

create policy "Usuários podem limpar seu próprio histórico" 
    on public.play_history for delete 
    using (auth.uid() = user_id);
