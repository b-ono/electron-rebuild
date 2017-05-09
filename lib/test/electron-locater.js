"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const chai_1 = require("chai");
const spawn_rx_1 = require("spawn-rx");
const electron_locater_1 = require("../src/electron-locater");
function packageCommand(command, packageName) {
    return spawn_rx_1.spawnPromise('npm', [command, packageName], {
        cwd: path.resolve(__dirname, '..'),
        stdio: 'ignore',
    });
}
const install = packageCommand.bind(null, 'install');
const uninstall = packageCommand.bind(null, 'uninstall');
const testElectronCanBeFound = () => {
    it('should return a valid path', () => {
        const electronPath = electron_locater_1.locateElectronPrebuilt();
        chai_1.expect(electronPath).to.be.a('string');
        chai_1.expect(fs.existsSync(electronPath)).to.be.equal(true);
    });
};
describe('locateElectronPrebuilt', function () {
    this.timeout(30 * 1000);
    before(() => uninstall('electron-prebuilt'));
    it('should return null when electron is not installed', () => {
        chai_1.expect(electron_locater_1.locateElectronPrebuilt()).to.be.equal(null);
    });
    describe('with electron-prebuilt installed', () => {
        before(() => install('electron-prebuilt'));
        testElectronCanBeFound();
        after(() => uninstall('electron-prebuilt'));
    });
    describe('with electron installed', () => {
        before(() => install('electron'));
        testElectronCanBeFound();
        after(() => uninstall('electron'));
    });
    after(() => install('electron-prebuilt'));
});
//# sourceMappingURL=electron-locater.js.map