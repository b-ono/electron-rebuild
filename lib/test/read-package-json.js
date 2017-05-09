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
const path = require("path");
const chai_1 = require("chai");
const read_package_json_1 = require("../src/read-package-json");
describe('read-package-json', () => {
    it('should find a package.json file from the given directory', () => __awaiter(this, void 0, void 0, function* () {
        chai_1.expect(yield read_package_json_1.readPackageJson(path.resolve(__dirname, '..'))).to.deep.equal(require('../package.json'));
    }));
});
//# sourceMappingURL=read-package-json.js.map