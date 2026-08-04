import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: { react: { version: '18.3' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react/jsx-no-target-blank': 'off',
      // Las dos siguientes se apagan a propósito, no por dejadez.
      //
      // `prop-types` generaba ~500 avisos —uno por cada prop de cada
      // componente—, y el problema no era el ruido en sí: es que hacía
      // IMPOSIBLE ver un aviso nuevo. En cada revisión había que filtrarlos a
      // mano, que es exactamente cuando se escapa el que importaba. El proyecto
      // no usa PropTypes en ninguna parte, así que la regla no protegía nada; si
      // algún día se pasa a TypeScript, ese chequeo lo hace el compilador.
      'react/prop-types': 'off',
      // Misma razón: los apóstrofos y comillas de la prosa en español disparaban
      // cientos de avisos. React ya escapa el texto, así que detrás de la regla
      // no hay un riesgo, solo una preferencia de estilo.
      'react/no-unescaped-entities': 'off',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    // Funciones serverless de Vercel: corren en Node, no en el navegador.
    // Los tres archivos de src/lib entran aquí porque los importa /api y leen
    // `process.env` en ese lado: constants.js, y socrataClient/edgeConfig, que
    // están escritos para funcionar en los DOS entornos (ver su cabecera).
    files: [
      'api/**/*.js',
      'src/lib/constants.js',
      'src/lib/socrataClient.js',
      'src/lib/edgeConfig.js',
    ],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    // Scripts de precálculo: corren en Node desde GitHub Actions.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
]
