import { defineConfig } from 'orval';
import * as fs from 'fs';
import * as path from 'path';

const getInfiniteOverrides = () => {
  const operations: Record<string, any> = {};
  const inputPath = path.resolve(process.cwd(), '../core-api/.open-api/open-api.json');

  if (!fs.existsSync(inputPath)) {
    console.warn('OpenAPI file not found at:', inputPath);
    return operations;
  }

  const fileContent = fs.readFileSync(inputPath, 'utf-8');
  const doc = JSON.parse(fileContent);

  Object.values(doc.paths || {}).forEach((pathItem: any) => {
    ['get', 'post', 'put', 'patch', 'delete'].forEach((method) => {
      if (pathItem[method]) {
        const operation = pathItem[method];
        const operationId = operation.operationId;

        if (!operationId) return;

        const allParams = [
          ...(pathItem.parameters || []),
          ...(operation.parameters || []),
        ];

        const hasPageParam = allParams.some((p: any) => p.name === 'page');
        const hasCursorParam = allParams.some((p: any) => p.name === 'cursor');

        if (hasPageParam) {
          operations[operationId] = {
            query: {
              useInfinite: true,
              useInfiniteQueryParam: 'page',
            },
          };
        } else if (hasCursorParam) {
          operations[operationId] = {
            query: {
              useInfinite: true,
              useInfiniteQueryParam: 'cursor',
            },
          };
        }
      }
    });
  });

  return operations;
};

export default defineConfig({
  api: {
    output: {
      target: 'src/services/apis/gen/queries.ts',
      clean: true,
      client: 'react-query',
      override: {
        useTypeOverInterfaces: true,
        mutator: {
          path: 'src/services/apis/axios-client.ts',
          name: 'orvalClient',
        },
        operations: getInfiniteOverrides(),
      },
    },
    input: {
      target: '../core-api/.open-api/open-api.json',
    },
  },
});
