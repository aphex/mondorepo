class Collection {
    constructor() {
        this.map = {};
        this.items = [];
    }

    *[Symbol.iterator]() {
        for (let x of this.items) {
            yield x;
        }
    }

    get forEach() {
        return this.items.forEach.bind(this.items);
    }

    get length() {
        return this.items.length;
    }

    add(...items) {
        for (let item of items) {
            const key = item.name;

            if (!this.map[key]) {
                this.map[key] = this.items.length;
                this.items.push(item);
            }
        }
    }

    addAll(items) {
        if (Array.isArray(items)) {
            this.add(...items);
        } else {
            this.add(...items.items);
        }
    }

    clone() {
        const c = new Collection();
        c.addAll(this);
        return c;
    }


    get(key) {
        if (typeof key === "string") {
            key = this.map[key];
        }

        return this.items[key] || null;
    }

    getAt(index) {
        if (index < this.items.length) {
            return this.items[index];
        }

        throw new Error(`Index ${index} is out of range ${this.items.length}`);
    }

    remove(item) {
        const key = item.name;

        if (this.map[key]) {
            const index = this.map[key];
            this.items.splice(index, 1);
            delete this.map[key];

            for (let i = index; i < this.items.length; i++) {
                const it = this.items[i];
                this.map[it.name] = i;
            }
        }
    }

    contains(item) {
        return this.includes(item);
    }

    includes(item) {
        return this.items.includes(item);
    }

    indexOf(item) {
        let index;
        if (typeof item === "string") {
            index = this.map[item];
        } else {
            index = this.map[item.name];
            if (this.items[index] !== item) {
                index = -1;
            }
        }

        if (index === undefined) {
            index = -1;
        }

        return index;
    }
}

module.exports = Collection;
