module.exports = {
  extends: [
    'plugin:security/recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
  ],
  ignorePatterns: ['node_modules/', 'dist/'],
  root: true,
  env: {
    es2017: true,
    node: true,
  },
  plugins: ['security', 'prettier'],
  rules: {
    'no-console': 'error',
    'no-bitwise': 'error',
    'import/order': 'error',
    // Allow unresolved imports. TypeScript already checks this and nuxt webpack aliases are not supported.
    'import/no-unresolved': 'off',
    'prettier/prettier': 'error',
    'security/detect-object-injection': 'off',
  },
  overrides: [
    {
      files: ['*.ts'],
      extends: [
        'plugin:@typescript-eslint/recommended-requiring-type-checking',
        'prettier/@typescript-eslint',
      ],
      plugins: ['@typescript-eslint'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 2019,
        sourceType: 'module',
        project: './tsconfig.json',
      },
      rules: {
        // We need to access members of variables and assign to variables of type any (e.g. errors).
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        // Sometimeis we need to call any, e.g. when a library does not have typings.
        '@typescript-eslint/no-unsafe-call': 'off',
        // Explicitly writing each functions return type feels cumbersome and is not very usefull unless writing
        // a public library api where it may be unsafe to infer return types.
        '@typescript-eslint/explicit-function-return-type': 'off',
        // Explicit typing can help reading the code, whereas only relying on inferrable types can make code less readable.
        '@typescript-eslint/no-inferrable-types': 'off',
        // Template expressions are awesome for their ease of use. Not allowing booleans, numbers or undefined variables
        // feels like a step back.
        '@typescript-eslint/restrict-template-expressions': 'off',
        // Allow unused args.
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            vars: 'all',
            // Unused function arguments often indicate a mistake in JavaScript code.  However in TypeScript code,
            // the compiler catches most of those mistakes, and unused arguments are fairly common for type signatures
            // that are overriding a base class method or implementing an interface.
            args: 'none',
          },
        ],
      },
    },
  ],
}
