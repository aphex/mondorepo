const Path = require('path');
const Collection = require('./utils/Collection.js');
const FileUtil = require('./utils/FileUtil.js');
const Graph = require('./Graph.js');
const glob = require('glob');
const hashFiles = require('hash-files');
const semver = require('semver');

class Package {

    constructor(packageFile, repo) {
        packageFile = FileUtil.absolute(packageFile);

        if (!FileUtil.isFile(packageFile)) {
            packageFile = Path.resolve(packageFile, 'package.json');
        }

        this._packageFile = packageFile;
        this._packagePath = Path.dirname(packageFile);
        this._package = require(packageFile) || {};
        this._mondo = (this._package && this._package.mondo) || {};
        this._basePath = Path.resolve(this.path, this._mondo.base || '.');
        this._name = this._package.name;
        if (!this._package.version) {
            throw new Error(`Package '${this._name}' requires a version`);
        }
        this._version = semver(this._package.version);
        this._repo = repo;
    }

    get name() {
        return this._name;
    }

    get version() {
        return this._version;
    }

    get path() {
        return this._packagePath;
    }

    get base() {
        return this._basePath;
    }

    get package() {
        return this._package;
    }

    get hash() {
        if (!this._hash) {
            const files = glob.sync(Path.join(this.path, '**'), {ignore: ['**/node_modules/**/*']});
            this._hash = hashFiles.sync({files: files});
        }

        return this._hash;
    }

    get mondoDependencies() {
        let mondoDependencies = this._mondoDependencies;

        if (!mondoDependencies) {
            const deps =  this._mondo.dependencies || {};
            const visiblePackages = this.repo.visiblePackages;
            mondoDependencies =  new Collection();

            Object.keys(deps).forEach(depName => {
                const pkg = visiblePackages.get(depName);

                if (!pkg) {
                    throw new Error(`Package ${depName} was not found from package ${this.name}`);
                }

                mondoDependencies.add(pkg);
            });

            this._mondoDependencies = mondoDependencies;
        }

        return mondoDependencies;
    }

    get allMondoDependencies() {
        let allMondoDependencies = this._allMondoDependencies;

        if (!allMondoDependencies) {
            const graph = new Graph(this);
            allMondoDependencies = this._allMondoDependencies = graph.depends;
        }

        return allMondoDependencies;
    }


    get _children() {
        return this.mondoDependencies;
    }

    get repo() {
        return this._repo;
    }

    isAnyDependent(...pkgs) {
        for (let pkg of pkgs) {
            if (typeof pkg === "string") {
                pkg = this.repo.allPackages.get(pkg);
            }

            if (this.allMondoDependencies.includes(pkg)) {
                return true;
            }
        }

        return false;
    }

    isDependent(...pkgs) {
        for (let pkg of pkgs) {
            if (typeof pkg === "string") {
                pkg = this.repo.allPackages.get(pkg);
            }

            if (!this.allMondoDependencies.includes(pkg)) {
                return false;
            }
        }

        return true;
    }
}

module.exports = Package;
