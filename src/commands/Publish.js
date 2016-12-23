"use strict";
const Path = require('path');
const fs = require('fs');
const {Command} = require('switchit');
const semver = require('semver');
const chalk = require('chalk');
const columnify = require('columnify');
const JSON5 = require('json5');
const NPM = require('../pkgMgrs/Npm.js');
const Repo = require('../Repo.js');
const Collection = require('../utils/Collection.js');

class Publish extends Command {
    execute(params) {
        const {recursive, dry, write, 'check-existing': checkExisting} = params;
        const path = params.path ? Path.isAbsolute(params.path) ? params.path : Path.join(process.cwd(), params.path) : process.cwd();
        const repo = Repo.open(path);

        this._packages = new Collection();
        this.dry = dry;
        this.write = write;

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
                .then(!dry ? write ? this.writeScript.bind(this) : this.publish.bind(this) : Promise.resolve());
        } else {
            this.log();

            if (!dry) {
                return this.publish();
            }
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
                            pkg.$$alreadyPublished = true;
                        } else {
                            pkg.$$alreadyPublished = false;
                        }
                    }).catch(() => {
                        pkg.$$neverPublished = true;
                        //catch here though so the promise.all doesn't fail
                    });
            }));
    }

    log() {
        let columns = Array.from(this._packages.items);
        let statusRegExp = /^ (W|E) /g;
        let statusRegExpResult, colorFunc;

        columns.map(column => {
            if (column.$$alreadyPublished) {
                column.status = 'E';
                column.details = `This version is already published to the NPM Registry`;
            } else if (column.$$alreadyPublished === false) {
                column.details = `OK`;
            } else if (column.$$neverPublished) {
                column.details = `OK (first publish)`;
            } else {
                column.details = `Unknown published status`;
            }
        });

        columns = columnify(columns, {
            showHeaders: false,
            minWidth: 20,
            config: {
                status: {align: 'center', minWidth: 3}
            },
            columns: ['status', 'name', 'version', 'details']
        });

        // Color any Warnings or Errors
        columns = columns.split('\n')
            .map(row => {
                statusRegExpResult = statusRegExp.exec(row);
                if (statusRegExpResult) {
                    colorFunc = statusRegExpResult[1] === 'W' ? chalk.yellow : chalk.red;
                    return colorFunc(row);
                }
                return row;
            }).join('\n');

        console.log(columns);
    }

    publish() {
        let allowPublish = true;

        this._packages.forEach(pkg => {
            if (pkg.$$alreadyPublished) {
                console.log(`Publish Aborted, ${pkg.name} is already published at version ${pkg.version}`);
                allowPublish = false;
            }
        });

        if (allowPublish) {
            const npm = new NPM();

            // Shortcut to chain then's of promises from an array
            return this._packages.reduce((promise, pkg) => {
                return promise.then(() => {
                    return npm.publish(pkg.path);
                });
            }, Promise.resolve());
        }
    }

    writeScript() {
        let scriptPath = this.write;
        let commands = [];

        // Shortcut to chain then's of promises from an array
        this._packages.forEach(pkg => {
            commands.push(`npm publish ${pkg.path}`);
        });

        if (!Path.isAbsolute(scriptPath)) {
            scriptPath = Path.resolve(process.cwd(), scriptPath);
        }

        fs.writeFileSync(scriptPath, commands.join('\n'));
    }
}

Publish.define({
    help: {
        '': 'Rev version of packages from the current repo'
    },
    parameters: '[path=]',
    switches: `[dry:boolean=false]
 [write:string=]
 [check-existing:boolean=true]
 [recursive:boolean=false]`
});


module.exports = Publish;
