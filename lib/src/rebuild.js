"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const spawn_rx_1 = require("spawn-rx");
const debug = require("debug");
const EventEmitter = require("events");
const fs = require("fs-promise");
const nodeAbi = require("node-abi");
const os = require("os");
const path = require("path");
const read_package_json_1 = require("./read-package-json");
const util_1 = require("util");
const d = debug('electron-rebuild');
const defaultMode = process.platform === 'win32' ? 'sequential' : 'parallel';
const locateGypModule = (cli) => __awaiter(this, void 0, void 0, function* () {
    let testPath = __dirname;
    for (let upDir = 0; upDir <= 20; upDir++) {
        const nodeGypTestPath = path.resolve(testPath, `node_modules/.bin/${cli}${process.platform === 'win32' ? '.cmd' : ''}`);
        if (yield fs.exists(nodeGypTestPath)) {
            return nodeGypTestPath;
        }
        testPath = path.resolve(testPath, '..');
    }
    return null;
});
const locateNodeGyp = () => __awaiter(this, void 0, void 0, function* () {
    return yield locateGypModule('node-gyp');
});
const locateNodePreGyp = () => __awaiter(this, void 0, void 0, function* () {
    return yield locateGypModule('node-pre-gyp');
});
class Rebuilder {
    constructor(lifecycle, buildPath, electronVersion, arch = process.arch, extraModules = [], forceRebuild = false, headerURL = 'https://atom.io/download/electron', types = ['prod', 'optional'], mode = defaultMode) {
        this.lifecycle = lifecycle;
        this.buildPath = buildPath;
        this.electronVersion = electronVersion;
        this.arch = arch;
        this.extraModules = extraModules;
        this.forceRebuild = forceRebuild;
        this.headerURL = headerURL;
        this.types = types;
        this.mode = mode;
        this.ABI = nodeAbi.getAbi(electronVersion, 'electron');
        this.prodDeps = extraModules.reduce((acc, x) => acc.add(x), new Set());
        this.rebuilds = [];
    }
    rebuild() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!path.isAbsolute(this.buildPath)) {
                throw new Error('Expected buildPath to be an absolute path');
            }
            d('rebuilding with args:', this.buildPath, this.electronVersion, this.arch, this.extraModules, this.forceRebuild, this.headerURL, this.types);
            this.lifecycle.emit('start');
            const rootPackageJson = yield read_package_json_1.readPackageJson(this.buildPath);
            const markWaiters = [];
            const depKeys = [];
            if (this.types.indexOf('prod') !== -1) {
                depKeys.push(...Object.keys(rootPackageJson.dependencies || {}));
            }
            if (this.types.indexOf('optional') !== -1) {
                depKeys.push(...Object.keys(rootPackageJson.optionalDependencies || {}));
            }
            if (this.types.indexOf('dev') !== -1) {
                depKeys.push(...Object.keys(rootPackageJson.devDependencies || {}));
            }
            depKeys.forEach((key) => {
                this.prodDeps[key] = true;
                markWaiters.push(this.markChildrenAsProdDeps(path.resolve(this.buildPath, 'node_modules', key)));
            });
            yield Promise.all(markWaiters);
            d('identified prod deps:', this.prodDeps);
            this.rebuildAllModulesIn(path.resolve(this.buildPath, 'node_modules'));
            if (this.mode !== 'sequential') {
                yield Promise.all(this.rebuilds.map(fn => fn()));
            }
            else {
                for (const rebuildFn of this.rebuilds) {
                    yield rebuildFn();
                }
            }
        });
    }
    rebuildModuleAt(modulePath) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(yield fs.exists(path.resolve(modulePath, 'binding.gyp')))) {
                return;
            }
            const nodeGypPath = yield locateNodeGyp();
            const nodePreGypPath = yield locateNodePreGyp();
            if (!nodeGypPath || !nodePreGypPath) {
                throw new Error('Could not locate node-gyp or node-pre-gyp');
            }
            const metaPath = path.resolve(modulePath, 'build', 'Release', '.forge-meta');
            const metaData = `${this.arch}--${this.ABI}`;
            this.lifecycle.emit('module-found', path.basename(modulePath));
            if (!this.forceRebuild && (yield fs.exists(metaPath))) {
                const meta = yield fs.readFile(metaPath, 'utf8');
                if (meta === metaData) {
                    d(`skipping: ${path.basename(modulePath)} as it is already built`);
                    this.lifecycle.emit('module-done');
                    this.lifecycle.emit('module-skip');
                    return;
                }
            }
            if (yield fs.exists(path.resolve(modulePath, 'prebuilds', `${process.platform}-${this.arch}`, `electron-${this.ABI}.node`))) {
                d(`skipping: ${path.basename(modulePath)} as it was prebuilt`);
                return;
            }
            d('rebuilding:', path.basename(modulePath));
            const modulePackageJson = yield read_package_json_1.readPackageJson(modulePath);
            const moduleName = path.basename(modulePath);
            let moduleBinaryPath = path.resolve(modulePath, 'build/Release');
            const preGypReady = !util_1.isNullOrUndefined(modulePackageJson.binary);
            const rebuildArgs = [
                preGypReady ? 'reinstall' : 'rebuild',
                `--target=${this.electronVersion}`,
                `--arch=${this.arch}`,
                `--dist-url=${this.headerURL}`,
                preGypReady ? '--fallback-to-build' : '--build-from-source',
            ];
            Object.keys(modulePackageJson.binary || {}).forEach((binaryKey) => {
                let value = modulePackageJson.binary[binaryKey];
                value = value.replace('{configuration}', 'Release')
                    .replace('{node_abi}', `electron-v${this.electronVersion.split('.').slice(0, 2).join('.')}`)
                    .replace('{platform}', process.platform)
                    .replace('{arch}', this.arch)
                    .replace('{version}', modulePackageJson.version)
                    .replace('{name}', modulePackageJson.name);
                if (binaryKey === 'module_path') {
                    value = path.resolve(modulePath, value);
                    moduleBinaryPath = value;
                }
                Object.keys(modulePackageJson.binary).forEach((binaryReplaceKey) => {
                    value = value.replace(`{${binaryReplaceKey}}`, modulePackageJson.binary[binaryReplaceKey]);
                });
                rebuildArgs.push(`--${binaryKey}=${value}`);
            });
            d('rebuilding', moduleName, 'with args', rebuildArgs);
            yield spawn_rx_1.spawnPromise(preGypReady ? nodePreGypPath : nodeGypPath, rebuildArgs, {
                cwd: modulePath,
                env: Object.assign({}, process.env, {
                    HOME: path.resolve(os.homedir(), '.electron-gyp'),
                    USERPROFILE: path.resolve(os.homedir(), '.electron-gyp'),
                    npm_config_disturl: 'https://atom.io/download/electron',
                    npm_config_runtime: 'electron',
                    npm_config_arch: this.arch,
                    npm_config_target_arch: this.arch,
                    npm_config_build_from_source: !preGypReady,
                }),
            });
            d('built:', moduleName);
            if (!(yield fs.exists(metaPath))) {
                yield fs.mkdirs(path.dirname(metaPath));
            }
            yield fs.writeFile(metaPath, metaData);
            d('searching for .node file', moduleBinaryPath);
            d('testing files', (yield fs.readdir(moduleBinaryPath)));
            const nodePath = path.resolve(moduleBinaryPath, (yield fs.readdir(moduleBinaryPath))
                .find((file) => file !== '.node' && file.endsWith('.node')));
            const abiPath = path.resolve(modulePath, `bin/${process.platform}-${this.arch}-${this.ABI}`);
            if (yield fs.exists(nodePath)) {
                d('found .node file', nodePath);
                d('copying to prebuilt place:', abiPath);
                if (!(yield fs.exists(abiPath))) {
                    yield fs.mkdirs(abiPath);
                }
                yield fs.copy(nodePath, path.resolve(abiPath, `${moduleName}.node`));
            }
            this.lifecycle.emit('module-done');
        });
    }
    rebuildAllModulesIn(nodeModulesPath, prefix = '') {
        d('scanning:', nodeModulesPath);
        for (const modulePath of fs.readdirSync(nodeModulesPath)) {
            if (this.prodDeps[`${prefix}${modulePath}`]) {
                this.rebuilds.push(() => this.rebuildModuleAt(path.resolve(nodeModulesPath, modulePath)));
            }
            if (modulePath.startsWith('@')) {
                this.rebuildAllModulesIn(path.resolve(nodeModulesPath, modulePath), `${modulePath}/`);
            }
            if (fs.existsSync(path.resolve(nodeModulesPath, modulePath, 'node_modules'))) {
                this.rebuildAllModulesIn(path.resolve(nodeModulesPath, modulePath, 'node_modules'));
            }
        }
    }
    ;
    findModule(moduleName, fromDir, foundFn) {
        return __awaiter(this, void 0, void 0, function* () {
            let targetDir = fromDir;
            const foundFns = [];
            while (targetDir !== path.dirname(this.buildPath)) {
                const testPath = path.resolve(targetDir, 'node_modules', moduleName);
                if (yield fs.exists(testPath)) {
                    foundFns.push(foundFn(testPath));
                }
                targetDir = path.dirname(targetDir);
            }
            yield Promise.all(foundFns);
        });
    }
    ;
    markChildrenAsProdDeps(modulePath) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(yield fs.exists(modulePath))) {
                return;
            }
            d('exploring', modulePath);
            const childPackageJson = yield read_package_json_1.readPackageJson(modulePath);
            const moduleWait = [];
            const callback = this.markChildrenAsProdDeps.bind(this);
            Object.keys(childPackageJson.dependencies || {}).concat(Object.keys(childPackageJson.optionalDependencies || {})).forEach((key) => {
                if (this.prodDeps[key]) {
                    return;
                }
                this.prodDeps[key] = true;
                moduleWait.push(this.findModule(key, modulePath, callback));
            });
            yield Promise.all(moduleWait);
        });
    }
    ;
}
function rebuild(buildPath, electronVersion, arch = process.arch, extraModules = [], forceRebuild = false, headerURL = 'https://atom.io/download/electron', types = ['prod', 'optional'], mode = defaultMode) {
    d('rebuilding with args:', arguments);
    const lifecycle = new EventEmitter();
    const rebuilder = new Rebuilder(lifecycle, buildPath, electronVersion, arch, extraModules, forceRebuild, headerURL, types, mode);
    let ret = rebuilder.rebuild();
    ret.lifecycle = lifecycle;
    return ret;
}
exports.rebuild = rebuild;
function rebuildNativeModules(electronVersion, modulePath, whichModule = '', _headersDir = null, arch = process.arch, _command, _ignoreDevDeps = false, _ignoreOptDeps = false, _verbose = false) {
    if (path.basename(modulePath) === 'node_modules') {
        modulePath = path.dirname(modulePath);
    }
    d('rebuilding in:', modulePath);
    console.warn('You are using the old API, please read the new docs and update to the new API');
    return rebuild(modulePath, electronVersion, arch, whichModule.split(','));
}
exports.rebuildNativeModules = rebuildNativeModules;
;
//# sourceMappingURL=rebuild.js.map