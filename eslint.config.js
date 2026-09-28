import js from '@eslint/js'
import globals from 'globals'
import hooks from 'eslint-plugin-react-hooks'
export default [
 {ignores:['dist/**','node_modules/**','reference_ui/**']},
 js.configs.recommended,
 {files:['**/*.{js,jsx}'],languageOptions:{ecmaVersion:'latest',sourceType:'module',parserOptions:{ecmaFeatures:{jsx:true}},globals:{...globals.browser,...globals.node}},plugins:{'react-hooks':hooks},rules:{'no-unused-vars':['error',{varsIgnorePattern:'^[A-Z_]',args:'none',caughtErrors:'none'}],'no-irregular-whitespace':['error',{skipStrings:true,skipTemplates:true,skipJSXText:true}],'react-hooks/rules-of-hooks':'error'}},
]
