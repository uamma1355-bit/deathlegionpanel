// Type declaration for CSS module imports.
// Each class may be undefined when accessed by name (noUncheckedIndexedAccess),
// so the value type is `string | undefined`. clsx handles falsy values
// gracefully so this is safe to pass through.
declare module '*.module.css' {
  const classes: { readonly [key: string]: string | undefined };
  export default classes;
}
