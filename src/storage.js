(function (exports) {
    "use strict";

    const TRANSACTION_TYPE_READONLY = 'readonly';
    const TRANSACTION_TYPE_READWRITE = 'readwrite';

    class Collection {
        constructor(dbHandler, name) {
            this.dbHandler = dbHandler;
            this.name = name;
        }

        put(key, value) {
            return new Promise((resolve, reject) => {
                const transaction = this.dbHandler.transaction([this.name], TRANSACTION_TYPE_READWRITE);
                const objectStore = transaction.objectStore(this.name);
                const request = objectStore.put({ key: key, value: value });

                request.onerror = event => {
                    reject(event.target.error);
                };
                request.onsuccess = event => {
                    resolve();
                };
            });
        }

        fetch(key) {
            return new Promise((resolve, reject) => {
                const transaction = this.dbHandler.transaction([this.name], TRANSACTION_TYPE_READONLY);
                const objectStore = transaction.objectStore(this.name);
                const request = objectStore.get(key);

                request.onerror = event => {
                    reject(event.target.error);
                };
                request.onsuccess = event => {
                    let value;

                    if (event.target.result) {
                        value = event.target.result.value;
                    }

                    resolve(value);
                };
            });
        }

        has(key) {
            return this.fetch(key).then(value => typeof(value) !== 'undefined');
        }
    }

    class Storage {
        constructor(name, version, collectionNames) {
            this.dbHandler = null;
            this.name = name;
            this.version = version;
            this.collectionNames = collectionNames;

            this.collections = {};
        }

        open() {
            return new Promise((resolve, reject) => {
                const request = window.indexedDB.open(this.name, this.version);

                request.onupgradeneeded = event => {
                    const dbHandler = event.target.result;

                    this.collectionNames.forEach(collectionName => {
                        if (dbHandler.objectStoreNames.contains(collectionName)) {
                            return;
                        }

                        const objectStore = dbHandler.createObjectStore(collectionName, { keyPath: 'key' });
                        objectStore.createIndex('key', 'key', { unique: true });
                    });
                }

                request.onsuccess = event => {
                    this.dbHandler = event.target.result;
                    resolve();
                };
                request.onerror = event => {
                    reject(event.target.error);
                };
            });
        }

        getCollection(name) {
            if (!this.collections[name]) {
                this.collections[name] = new Collection(this.dbHandler, name);
            }

            return this.collections[name];
        }
    }

    exports.Storage = Storage;
}(window));
