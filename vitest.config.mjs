import ts from 'typescript';
export default {
  plugins: [
    {
      name: 'typescript-in-process',
      enforce: 'pre',
      transform(code, id) {
        if (!/\.[cm]?tsx?(\?|$)/.test(id) || id.includes('node_modules')) return;
        const result = ts.transpileModule(code, {
          compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
            jsx: ts.JsxEmit.ReactJSX,
            sourceMap: true,
          },
          fileName: id,
        });
        return { code: result.outputText, map: result.sourceMapText };
      },
    },
  ],
  esbuild: false,
  keepProcessEnv: true,
  resolve: { preserveSymlinks: true },
  test: {
    include: ['tests/**/*.test.ts'],
    pool: 'threads',
    fileParallelism: false,
    testTimeout: 20000,
  },
};
