import DB from './db';

/**
 * @description 结果集合，用于抛出不同结果
 */
const errorCode = {
    updateSuccess: {
        code: 114,
        message: '更新成功'
    },
    updateFail: {
        code: 115,
        message: '更新失败'
    },
    noFound: {
        code: 116,
        message: '没有找到符合条件的值'
    },
    primaryKey: {
        code: 117,
        message: '不能修改主键'
    },
    deleteSuccess: {
        code: 118,
        message: '删除成功'
    },
    deleteFail: {
        code: 119,
        message: '删除失败'
    }
};

/**
 * @description 在DB类的基础上新增索引操作
 * @author elric_tang
 */
export class IndexDB extends DB {
    createIndex(indexList, store) {
        for (const {indexName, keyPath, objectParameters} of indexList) {
            store.createIndex(indexName, keyPath, objectParameters);
        }
    };

    /**
     * @description 重写父类的open方法，在打开数据库连接的时候创建索引
     */
    open() {
        return super.open(this.createIndex);
    };

    /**
     * @description 获取cursor请求对象
     * @param {String} storeName 目标store名
     * @param {String} mode 模式
     * @returns cursor对象
     */
    getCursor(storeName, mode) {
        return this.makeRequest(storeName, mode, 'openCursor');
    }

    /**
     * @description 获取readonly模式下的request对象
     * @param {String} storeName 目标store名
     * @param {String} indexName 索引表名
     * @param {String} action 动作
     * @param  {...any} params action参数
     * @returns request对象
     */
    makeIndexRequest(storeName, indexName, action, ...params) {
        return this.makeRequest(storeName, 'readonly', 'index', indexName)[action](...params);
    }

    /**
     * @description 使用索引获取值
     * @param {String} storeName 目标store名
     * @param {String} indexName 索引表名
     * @param {String} index 索引
     * @returns promise
     */
    getByIndex(storeName, indexName, index) {
        const req = this.makeIndexRequest(storeName, indexName, 'get', index);

        return this.promisifyRes(req);
    };

    /**
     * @description 根据索引统计数量
     * @param {String} storeName 目标store名
     * @param {String} indexName 索引表名
     * @param {String} index 索引
     * @returns promise
     */
    getCountByIndex(storeName, indexName, index) {
        const req = this.makeIndexRequest(storeName, indexName, 'count', index);

        return this.promisifyRes(req);
    };

    /**
     * @description 获取索引表所有值
     * @param {String} storeName 目标store名
     * @param {String} indexName 索引表名
     * @returns promise
     */
    getAllByIndex(storeName, indexName) {
        const req = this.makeIndexRequest(storeName, indexName, 'getAll');

        return this.promisifyRes(req);
    };

    /**
     * @description 获取索引表内所有主键值
     * @param {String} storeName 目标store名
     * @param {String} indexName 索引表名
     * @returns promise
     */
    getAllKeysByIndex(storeName, indexName) {
        const req = this.makeIndexRequest(storeName, indexName, 'getAllKeys');

        return this.promisifyRes(req);
    };

    /**
     * @description 根据索引取值
     * @param {String} storeName 目标store名
     * @param {String} indexName 索引表名
     * @param {String} index 索引
     * @returns promise
     */
    getKeyByIndex(storeName, indexName, index) {
        const req = this.makeIndexRequest(storeName, indexName, 'getKey', index);

        return this.promisifyRes(req);
    };

    /**
     * @description 使用游标获取store内所有值
     * @param {String} storeName 目标store名
     * @returns promise
     */
    getAllByCursor(storeName) {
        const req = this.getCursor(storeName);

        return new Promise(resolve=> {
            const values = [];

            req.onsuccess = e=> {
                const cursor = e.target.result;

                if (cursor) {
                    values.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(values);
                }
            };
            req.onerror = ()=> {
                resolve(undefined);
            };
        });
    };

    /**
     * @description 根据游标更新数据
     * @param {String} storeName 目标store名
     * @param {String} attrName 目标数据拥有的属性名
     * @param {*} attr 目标数据拥有的属性值
     * @param {Object} newVal 更新的新值
     * @returns promise
     */
    updateByCursor(storeName, attrName, attr, newVal) {
        const req = this.getCursor(storeName, 'readwrite');
        const {updateSuccess, updateFail, primaryKey, noFound} = errorCode;

        return new Promise(resolve=> {
            req.onsuccess = e=> {
                const cursor = e.target.result;

                if (cursor) {
                    const {value, source} = cursor;

                    // 判断当前游标是否有对应属性
                    if (value.hasOwnProperty(attrName) && value[attrName] === attr) {
                        const keyPath = source.keyPath;

                        // 对比新旧主键，判断是否是修改主键
                        if (value[keyPath] === newVal[keyPath]) {
                            const updateReq = cursor.update(newVal);

                            resolve(this.promisify(updateReq, updateSuccess, updateFail));
                        } else {
                            resolve(primaryKey);
                        }
                    }
                    cursor.continue();
                } else {
                    resolve(noFound);
                }
            };
            req.onerror = ()=> resolve(errorCode.updateFail);
        });
    };

    /**
     * @description 根据游标删除数据
     * @param {*} storeName 目标store名
     * @param {*} attrName 目标数据拥有的属性名
     * @param {*} attr 目标数据拥有的属性值
     * @returns promise
     */
    deleteByCursor(storeName, attrName, attr) {
        const req = this.getCursor(storeName, 'readwrite');
        const {deleteSuccess, deleteFail, noFound} = errorCode;

        return new Promise(resolve=> {
            req.onsuccess = e=> {
                const cursor = e.target.result;

                if (cursor) {
                    const {value} = cursor;

                    // 判断当前游标是否有对应属性
                    if (value.hasOwnProperty(attrName) && value[attrName] === attr) {
                        const deleteReq = cursor.delete();

                        resolve(this.promisify(deleteReq, deleteSuccess, deleteFail));
                    }
                    cursor.continue();
                } else {
                    resolve(noFound);
                }
            };
            req.onerror = ()=> resolve(deleteFail);
        });
    };
}

export const IndexDBVuePlugin = {
    install(Vue, options) {
        Vue.prototype.IndexDB = IndexDB;
    }
}