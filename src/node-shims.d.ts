declare module "node:fs" { const value:any; export default value; }
declare module "node:path" { const value:any; export default value; }
declare module "node:child_process" { export const spawnSync:any; }
declare const process:any;
declare const Buffer: { from(input:string,encoding?:string): { toString(encoding:string): string } };
declare module "node:module" { export const createRequire:any; }
