const tsRules = {
  // TypeScript already ensures we are not using non-existent variables.
  'no-undef': 'off',
  // This rule might interfere with prettier styling.
  'no-unexpected-multiline': 'off',
  // We need to access members of variables and assign to variables of type any (e.g. errors).
  '@typescript-eslint/no-unsafe-member-access': 'off',
  '@typescript-eslint/no-unsafe-assignment': 'off',
  // Sometimes we need to call any, e.g. when a library does not have typings.
  '@typescript-eslint/no-unsafe-call': 'off',
  // Explicitly writing each functions return type feels cumbersome and is not very useful unless writing
  // a public library api where it may be unsafe to infer return types.
  '@typescript-eslint/explicit-function-return-type': 'off',
  '@typescript-eslint/explicit-module-boundary-types': 'off',
  // Explicit typing can help reading the code, whereas only relying on inferrable types can make code less readable.
  '@typescript-eslint/no-inferrable-types': 'off',
  // Template expressions are awesome for their ease of use. Not allowing booleans, numbers or undefined variables
  // feels like a step back.
  '@typescript-eslint/restrict-template-expressions': 'off',
  // TypeScript sometimes can't know that a type is non-null (e.g. when using express middlewares).
  // There are a lot of places in our code where that is the case and too many eslint-disable comments
  // would harm code readability. non-null-assertions need to be used with care!
  '@typescript-eslint/no-non-null-assertion': 'off',
  // Allow rest args to be of type any (...args: any[]) and auto fix any usage to unknown.
  '@typescript-eslint/no-explicit-any': [
    'warn',
    {
      fixToUnknown: true,
      ignoreRestArgs: true,
    },
  ],
}

module.exports = {
  extends: ['eslint:recommended', 'plugin:prettier/recommended', 'prettier'],
  ignorePatterns: ['node_modules/', 'dist/'],
  root: true,
  env: {
    node: true,
    es2017: true,
  },
  rules: {
    'no-console': 'error',
    'no-bitwise': 'error',
  },
  overrides: [
    {
      files: ['*.ts'],
      extends: [
        'plugin:@typescript-eslint/recommended',
        'plugin:@typescript-eslint/recommended-requiring-type-checking',
        'prettier', // We need to extend prettier again so that ts rules get disabled.
      ],
      plugins: ['@typescript-eslint'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        project: './tsconfig.json',
      },
      rules: tsRules,
    },
  ],
}
