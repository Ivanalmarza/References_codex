'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'references-vue-typecheck-'));
const TEMP_SRC = path.join(TEMP, 'src');

function mkdir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function walk(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...walk(full));
    else result.push(full);
  }
  return result;
}

function copyTsAndExtractVue() {
  for (const sourcePath of walk(path.join(ROOT, 'src'))) {
    const relative = path.relative(path.join(ROOT, 'src'), sourcePath);
    if (sourcePath.endsWith('.ts') || sourcePath.endsWith('.d.ts')) {
      const dest = path.join(TEMP_SRC, relative);
      mkdir(path.dirname(dest));
      fs.copyFileSync(sourcePath, dest);
      continue;
    }
    if (!sourcePath.endsWith('.vue')) continue;
    const source = fs.readFileSync(sourcePath, 'utf8');
    const match = source.match(/<script(?:\s+setup)?(?:\s+lang=["']ts["'])?[^>]*>([\s\S]*?)<\/script>/i);
    if (!match) continue;
    const dest = path.join(TEMP_SRC, `${relative}.ts`);
    mkdir(path.dirname(dest));
    fs.writeFileSync(dest, `${match[1]}\nexport default {} as any\n`, 'utf8');
  }
  fs.copyFileSync(path.join(ROOT, 'vite.config.ts'), path.join(TEMP, 'vite.config.ts'));
}

const stubs = `
declare type EmitMap = Record<string, unknown[]>;
declare type PropsWithDefaults<T, D> = Omit<T, keyof D> & Required<Pick<T, Extract<keyof T, keyof D>>>;
declare function defineProps<T>(): Readonly<T>;
declare function withDefaults<T, D>(props: T, defaults: D): Readonly<PropsWithDefaults<T, D>>;
declare function defineEmits<T extends EmitMap>(): <K extends keyof T>(event: K, ...args: T[K]) => void;

declare module '*.vue' {
  const component: any;
  export default component;
}

declare module 'vue' {
  export interface Ref<T> { value: T }
  export interface ComputedRef<T> extends Ref<T> {}
  export function ref<T = any>(): Ref<T | undefined>;
  export function ref<T>(value: T): Ref<T>;
  export function reactive<T extends object>(value: T): T;
  export function computed<T>(getter: () => T): ComputedRef<T>;
  export function computed<T>(options: { get: () => T; set: (value: T) => void }): ComputedRef<T>;
  export function watch<T>(source: () => T, callback: (value: T, oldValue: T | undefined) => any, options?: any): () => void;
  export function watch<T>(source: Ref<T> | ComputedRef<T>, callback: (value: T, oldValue: T | undefined) => any, options?: any): () => void;
  export function onMounted(callback: () => any): void;
  export function onBeforeUnmount(callback: () => any): void;
  export function nextTick(callback?: () => any): Promise<void>;
  export function createApp(component: any): { use(plugin: any): any; mount(selector: string): any };
}

declare module 'pinia' {
  type UnwrapStore<Store> = { [K in keyof Store]: Store[K] extends import('vue').Ref<infer V> ? V : Store[K] };
  export function defineStore<Id extends string, Store>(id: Id, setup: () => Store): (pinia?: any) => UnwrapStore<Store>;
  export function createPinia(): any;
}

declare module 'vue-router' {
  export function useRoute(): { name?: unknown; params: Record<string, unknown>; meta: Record<string, unknown> };
  export function useRouter(): { push(to: string): Promise<unknown>; replace(to: string): Promise<unknown> };
  export function createWebHashHistory(): any;
  export function createRouter(options: any): { afterEach(callback: (to: any) => any): void };
}

declare module 'axios' {
  export interface AxiosResponse<T = any> { data: T; headers: Record<string, string | undefined>; status?: number }
  export interface AxiosError<T = any> extends Error { response?: AxiosResponse<T>; isAxiosError?: boolean }
  export interface AxiosInstance {
    get<T = any>(url: string, config?: any): Promise<AxiosResponse<T>>;
    post<T = any>(url: string, data?: any, config?: any): Promise<AxiosResponse<T>>;
    delete<T = any>(url: string, config?: any): Promise<AxiosResponse<T>>;
  }
  interface AxiosStatic {
    create(config?: any): AxiosInstance;
    get<T = any>(url: string, config?: any): Promise<AxiosResponse<T>>;
    isAxiosError(value: unknown): boolean;
  }
  const axios: AxiosStatic;
  export default axios;
}

declare module 'notyf' {
  export class Notyf {
    constructor(options?: any);
    success(message: string): any;
    error(message: string): any;
    open(options: any): any;
  }
}

declare module 'vite' {
  export interface ProxyOptions { target?: string; changeOrigin?: boolean; secure?: boolean; rewrite?: (path: string) => string }
  export function defineConfig(config: ((env: { mode: string; command: string }) => any) | Record<string, unknown>): any;
  export function loadEnv(mode: string, cwd: string, prefix?: string): Record<string, string>;
}

declare module '@vitejs/plugin-vue' { const plugin: (options?: any) => any; export default plugin; }
declare module '@tailwindcss/vite' { const plugin: (options?: any) => any; export default plugin; }
declare module 'notyf/notyf.min.css' {}

declare namespace NodeJS { interface Process { cwd(): string } }
declare const process: NodeJS.Process;

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_DEV_PROXY_TARGET?: string;
}
interface ImportMeta { readonly env: ImportMetaEnv }
`;

copyTsAndExtractVue();
fs.writeFileSync(path.join(TEMP, 'stubs.d.ts'), stubs, 'utf8');
fs.writeFileSync(path.join(TEMP, 'tsconfig.json'), JSON.stringify({
  compilerOptions: {
    target: 'ES2022',
    module: 'ESNext',
    moduleResolution: 'Bundler',
    strict: true,
    skipLibCheck: true,
    noEmit: true,
    lib: ['ES2022', 'DOM', 'DOM.Iterable'],
    baseUrl: '.',
  },
  include: ['src/**/*.ts', 'src/**/*.d.ts', 'vite.config.ts', 'stubs.d.ts'],
}, null, 2), 'utf8');

try {
  const output = execFileSync('tsc', ['-p', path.join(TEMP, 'tsconfig.json'), '--pretty', 'false'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  console.log(JSON.stringify({ ok: true, temp: TEMP, output: output.trim() }, null, 2));
  fs.rmSync(TEMP, { recursive: true, force: true });
} catch (error) {
  const stdout = String(error.stdout || '');
  const stderr = String(error.stderr || '');
  console.error(stdout || stderr || error.message);
  console.error(`Temporary typecheck tree retained: ${TEMP}`);
  process.exitCode = 1;
}
