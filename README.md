# ELLSound App - Player de Música Premium

Este é o **ELLSound**, um player de música premium estilo Spotify. O aplicativo consome metadados e capas da API do iTunes e reproduz o áudio diretamente do YouTube em segundo plano, garantindo uma experiência contínua e sem anúncios.

O banco de dados foi integrado ao **Supabase** para permitir autenticação de usuários, criação de playlists e sincronização das músicas curtidas.

---

## 🛠️ Requisitos de Configuração Local

### 1. Clonar e Instalar Dependências
Navegue até a pasta do projeto e instale as dependências:
```bash
# Se utilizar o Bun (Recomendado):
bun install

# Ou npm:
npm install
```

### 2. Configurar o Banco de Dados no Supabase
1. Crie uma conta gratuita em [supabase.com](https://supabase.com/).
2. Crie um novo projeto.
3. No painel do seu projeto no Supabase, abra o **SQL Editor** (no menu lateral esquerdo).
4. Copie o script SQL que está em [supabase/schema.sql](file:///supabase/schema.sql) (na raiz deste projeto).
5. Cole no editor do Supabase e clique em **Run** para criar as tabelas e as políticas de segurança (RLS).

### 3. Configurar Variáveis de Ambiente
1. Copie o arquivo `.env.example` e renomeie-o para `.env` na raiz do seu projeto local:
   ```bash
   cp .env.example .env
   ```
2. Abra o arquivo `.env` e preencha as chaves fornecidas pelo Supabase (disponíveis em *Project Settings -> API* no painel do Supabase):
   ```env
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-chave-anonima-aqui
   ```

*Nota: Se o aplicativo for iniciado sem as chaves no `.env`, ele ativará automaticamente o modo **Nuvem Offline (Armazenamento Local)**. Dessa forma, você e seus usuários ainda poderão curtir músicas e criar playlists no cache local (LocalStorage) diretamente no navegador, mas sem sincronização em nuvem.*

---

## 🚀 Como Executar Localmente

Para rodar o servidor de desenvolvimento local no seu computador:
```bash
# Com Bun:
bun run dev

# Com npm:
npm run dev
```
Abra o navegador no endereço indicado no terminal (normalmente `http://localhost:3000`).

---

## ☁️ Como Subir para a Vercel

O aplicativo está pronto para ser publicado de forma gratuita na Vercel!

1. Crie ou acesse sua conta em [vercel.com](https://vercel.com).
2. Adicione um novo projeto e conecte com o repositório git correspondente.
3. Na seção de **Environment Variables** (Variáveis de Ambiente), configure as mesmas chaves que colocou localmente:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Na build do Vercel, o Nitro (motor de agrupamento do TanStack Start) autodetecta o ambiente Vercel e compila de forma nativa e automática como Serverless. A configuração sugerida é:
   - **Framework Preset**: *Vite* ou *Other* (deixe o padrão autodetectado).
   - **Build Command**: `bun run build` ou `npm run build`.
   - **Output Directory**: `.output/public` (deixe o padrão autodetectado).
5. Clique em **Deploy**.

Uma vez publicado, seu aplicativo de música estará online e pronto para uso mundial!
