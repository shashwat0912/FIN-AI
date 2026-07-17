-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable: knowledge_chunks
CREATE TABLE "knowledge_chunks" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "source" TEXT,
    "metadata" JSONB,
    "embedding" vector(1536) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: category index for filtering
CREATE INDEX "knowledge_chunks_category_idx" ON "knowledge_chunks"("category");

-- CreateIndex: vector similarity search index (using HNSW for fast approximate search)
CREATE INDEX "knowledge_chunks_embedding_idx" ON "knowledge_chunks" 
USING hnsw (embedding vector_cosine_ops);

-- Add comment explaining the table
COMMENT ON TABLE "knowledge_chunks" IS 'Stores finance knowledge chunks with embeddings for RAG (Retrieval-Augmented Generation)';
COMMENT ON COLUMN "knowledge_chunks"."embedding" IS 'OpenAI text-embedding-3-small vector (1536 dimensions)';

