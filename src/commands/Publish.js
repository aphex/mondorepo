"use strict";
const Path = require('path');
const {Command} = require('switchit');
const semver = require('semver');
const columnify = require('columnify');
const JSON5 = require('json5');
const NPM = require('../pkgMgrs/Npm.js');
const Repo = require('../Repo.js');
const Collection = require('../utils/Collection.js');

class Publish extends Command {
    execute(params) {
        const {recursive, dry, 'check-existing': checkExisting} = params;
        const path = params.path ? Path.isAbsolute(params.path) ? params.path : Path.join(process.cwd(), params.path) : process.cwd();
        const repo = Repo.open(path);

        this._packages = new Collection();
        this.dry = dry;

        // Get a list of all the this._revPackages we will be reving
        for (let pkg of repo.packages) {
            this._packages.add(pkg);
            if (recursive) {
                this._packages.addAll(pkg.allMondoDependencies);
            }
        }

        if (checkExisting) {
            return this.checkExisting()
                .then(this.log.bind(this))
                .then(this.publish.bind(this));
        } else {
            this.log();
            return this.publish();
        }
    }

    checkExisting() {
        const npm = new NPM();
        return Promise.all(
            this._packages.map(pkg => {
                // Run NPM view over the package to get registry data
                return npm.view(pkg.name, pkg.version)
                    .then(results => {
                        const registry = pkg.registry = !!results ? JSON5.parse(results) : false;

                        // Check if the version we would like to rev to is already published for this package
                        if (registry) {
                            for (let version of registry.versions) {
                                if (semver.eq(pkg.version, version)) {
                                    throw new Error(`${pkg.name} is already published at version ${pkg.version}`);
                                }
                            }
                        }
                    }).catch(() => {
                        //catch here though so the promise.all doesn't fail
                    });
            }));
    }

    log() {
        let columns = columnify(this._packages.items, {
            showHeaders: false,
            minWidth: 20,
            columns: ['name', 'version']
        });

        console.log(columns);
    }

    publish() {
        if (!this.dry) {
            const npm = new NPM();

            const serial = funcs =>
                funcs.reduce((promise, func) =>
                    promise.then(result => func().then(Array.prototype.concat.bind(result))), Promise.resolve([]));
            const funcs = this._packages.map(pkg => () => npm.publish(pkg.path));

            return serial(funcs);
        }
    }
}

Publish.define({
    help: {
        '': 'Rev version of packages from the current repo'
    },
    parameters: '[path=]',
    switches: `[dry:boolean=false]
 [check-existing:boolean=true]
 [recursive:boolean=false]`
});


module.exports = Publish;
