/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_OPENAI_API_KEY?: string; // Deprecated - use backend API instead
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}