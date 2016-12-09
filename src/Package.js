const Path = require('path');
const FileUtil = require('./utils/FileUtil.js');
const Graph = require('./Graph');

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
        this._repo = repo;
    }

    get name() {
        return this._name;
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

    get mondoDependencies() {
        let mondoDependencies = this._mondoDependencies;

        if (!mondoDependencies) {
            const deps =  this._mondo.dependencies || {};
            const visiblePackages = this.repo.visiblePackages;
            mondoDependencies = this._mondoDependencies = Object.keys(deps).map(depName => {
                const pkg = visiblePackages[depName];

                if (!pkg) {
                    throw new Error(`Package ${depName} was not found`);
                }

                return pkg;
            });
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
                pkg = this.repo.visiblePackages[pkg];
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
                pkg = this.repo.visiblePackages[pkg];
            }

            if (!this.allMondoDependencies.includes(pkg)) {
                return false;
            }
        }

        return true;
    }
}

module.exports = Package;
