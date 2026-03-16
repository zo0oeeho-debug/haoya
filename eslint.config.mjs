import { FlatCompat } from "@eslint/eslintrc";

const baseDirectory = new URL(".", import.meta.url).pathname;

const compat = new FlatCompat({
  baseDirectory
});

export default [...compat.extends("next/core-web-vitals")];

