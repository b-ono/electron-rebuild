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
const fs = require("fs-promise");
const path = require("path");
const os = require("os");
const ora = require("ora");
const spawn_rx_1 = require("spawn-rx");
const chai_1 = require("chai");
const rebuild_1 = require("../src/rebuild");
ora.ora = ora;
describe('rebuilder', () => {
    const testModulePath = path.resolve(os.tmpdir(), 'electron-forge-rebuild-test');
    const resetTestModule = () => __awaiter(this, void 0, void 0, function* () {
        yield fs.remove(testModulePath);
        yield fs.mkdirs(testModulePath);
        yield fs.writeFile(path.resolve(testModulePath, 'package.json'), yield fs.readFile(path.resolve(__dirname, '../test/fixture/native-app1/package.json'), 'utf8'));
        yield spawn_rx_1.spawnPromise('npm', ['install'], {
            cwd: testModulePath,
            stdio: 'inherit',
        });
    });
    describe('core behavior', function () {
        this.timeout(2 * 60 * 1000);
        before(resetTestModule);
        before(() => __awaiter(this, void 0, void 0, function* () {
            yield rebuild_1.rebuild(testModulePath, '1.4.12', process.arch);
        }));
        it('should have rebuilt top level prod dependencies', () => __awaiter(this, void 0, void 0, function* () {
            const forgeMeta = path.resolve(testModulePath, 'node_modules', 'ref', 'build', 'Release', '.forge-meta');
            chai_1.expect(yield fs.exists(forgeMeta), 'ref build meta should exist').to.equal(true);
        }));
        it('should not have rebuild top level prod dependencies that are prebuilt', () => __awaiter(this, void 0, void 0, function* () {
            const forgeMeta = path.resolve(testModulePath, 'node_modules', 'sodium-native', 'build', 'Release', '.forge-meta');
            chai_1.expect(yield fs.exists(forgeMeta), 'ref build meta should exist').to.equal(false);
        }));
        it('should have rebuilt children of top level prod dependencies', () => __awaiter(this, void 0, void 0, function* () {
            const forgeMetaGoodNPM = path.resolve(testModulePath, 'node_modules', 'microtime', 'build', 'Release', '.forge-meta');
            const forgeMetaBadNPM = path.resolve(testModulePath, 'node_modules', 'benchr', 'node_modules', 'microtime', 'build', 'Release', '.forge-meta');
            chai_1.expect((yield fs.exists(forgeMetaGoodNPM)) || (yield fs.exists(forgeMetaBadNPM)), 'microtime build meta should exist').to.equal(true);
        }));
        it('should have rebuilt children of scoped top level prod dependencies', () => __awaiter(this, void 0, void 0, function* () {
            const forgeMeta = path.resolve(testModulePath, 'node_modules', '@newrelic/native-metrics', 'build', 'Release', '.forge-meta');
            chai_1.expect(yield fs.exists(forgeMeta), '@newrelic/native-metrics build meta should exist').to.equal(true);
        }));
        it('should have rebuilt top level optional dependencies', () => __awaiter(this, void 0, void 0, function* () {
            const forgeMeta = path.resolve(testModulePath, 'node_modules', 'zipfile', 'build', 'Release', '.forge-meta');
            chai_1.expect(yield fs.exists(forgeMeta), 'zipfile build meta should exist').to.equal(true);
        }));
        it('should not have rebuilt top level devDependencies', () => __awaiter(this, void 0, void 0, function* () {
            const forgeMeta = path.resolve(testModulePath, 'node_modules', 'ffi', 'build', 'Release', '.forge-meta');
            chai_1.expect(yield fs.exists(forgeMeta), 'ffi build meta should not exist').to.equal(false);
        }));
        after(() => __awaiter(this, void 0, void 0, function* () {
            yield fs.remove(testModulePath);
        }));
    });
    describe('force rebuild', function () {
        this.timeout(2 * 60 * 1000);
        before(resetTestModule);
        it('should skip the rebuild step when disabled', () => __awaiter(this, void 0, void 0, function* () {
            yield rebuild_1.rebuild(testModulePath, '1.4.12', process.arch);
            const rebuilder = rebuild_1.rebuild(testModulePath, '1.4.12', process.arch, [], false);
            let skipped = 0;
            rebuilder.lifecycle.on('module-skip', () => {
                skipped++;
            });
            yield rebuilder;
            chai_1.expect(skipped).to.equal(4);
        }));
        it('should rebuild all modules again when disabled but the electron ABI bumped', () => __awaiter(this, void 0, void 0, function* () {
            yield rebuild_1.rebuild(testModulePath, '1.4.12', process.arch);
            const rebuilder = rebuild_1.rebuild(testModulePath, '1.6.0', process.arch, [], false);
            let skipped = 0;
            rebuilder.lifecycle.on('module-skip', () => {
                skipped++;
            });
            yield rebuilder;
            chai_1.expect(skipped).to.equal(0);
        }));
        it('should rebuild all modules again when enabled', () => __awaiter(this, void 0, void 0, function* () {
            yield rebuild_1.rebuild(testModulePath, '1.4.12', process.arch);
            const rebuilder = rebuild_1.rebuild(testModulePath, '1.4.12', process.arch, [], true);
            let skipped = 0;
            rebuilder.lifecycle.on('module-skip', () => {
                skipped++;
            });
            yield rebuilder;
            chai_1.expect(skipped).to.equal(0);
        }));
    });
});
//# sourceMappingURL=rebuild.js.map