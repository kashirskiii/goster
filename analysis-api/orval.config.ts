import { defineConfig } from 'orval';

export default defineConfig({
  analysisApi: {
    input: {
      target: './openapi.yaml',
    },
    output: {
      target: './generated/api.ts',
      schemas: './generated/models',
      client: 'axios',
      mode: 'tags-split',
      prettier: true,
    },
  },
});
