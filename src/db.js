/**
 * @description 结果集合，用于抛出不同结果
 */
const errorCode = {
    openFail: {
        code: 101,
        message: '打开数据库失败'
    },
    compatibleFail: {
        code: 102,
        message: '你的浏览器不支持indexedDB'
    },
    setSuccess: {
        code: 103,
        message: '插入新数据成功'
    },
    setFail: {
        code: 104,
        message: '插入新数据失败'
    },
    setNoCorresponding: {
        code: 105,
        message: '插入新数据失败,value不存在与store对应的key'
    },
    updateSuccess: {
        code: 106,
        message: '更新数据成功'
    },
    updateFail: {
        code: 107,
        message: '更新数据失败'
    },
    removeSuccess: {
        code: 108,
        message: '删除数据成功'
    },
    removeFail: {
        code: 109,
        message: '删除数据失败'
    },
    removeAllSuccess: {
        code: 110,
        message: '清空store成功'
    },
    removeAllFail: {
        code: 111,
        message: '清空store失败'
    },
    setBatchSuccess: {
        code: 112,
        message: '批量插入数据成功'
    },
    setBatchFail: {
        code: 113,
        message: '批量插入数据失败'
    }
};

/**
* @description indexedDB的简单封装
* @author elric_tang
* @constructor
* @param {String} dataBaseName 数据库名
* @param {Array} storeList store配置
*/
export default class DB {
    constructor(dataBaseName, storeList) {
        this._dataBase = {};
        this._dataBaseName = dataBaseName;
        this._dbVersion = 1;
        this._indexedDB = window.indexedDB || window.webkitIndexedDB;
        this._storeList = storeList;
    };

    /**
     * @description 打开数据库连接
     * @returns {Object} promise
     */
    async open(createIndex = ()=> {}) {
        const {openFail, compatibleFail} = errorCode;

        if (this._dataBase) {
            const req = this._indexedDB.open(this._dataBaseName, this._dbVersion);

            return await new Promise((resolve, reject)=> {
                req.onerror = ()=> reject(openFail);
                req.onsuccess = e=> {
                    this._dataBase = e.target.result;
                    resolve(this);
                };
                req.onupgradeneeded = e=> {
                    this._dataBase = e.target.result;
                    for (const {name, key, indexList} of this._storeList) {
                        if (!this._dataBase.objectStoreNames.contains(name)) {
                            const store = this._dataBase.createObjectStore(name, {keyPath: key});

                            indexList && createIndex(indexList, store);
                        }
                    }
                    this._dataBase.transaction.oncomplete = ()=> resolve(this);
                };
            });
        } else {
            return compatibleFail;
        }
    };

    /**
     * @description 主动关闭当前数据库
     */
    close() {
        this._dataBase.close();
    }

    /**
     * @description 创建一个事务
     * @param {String} storeName 
     * @param {String} mode 
     * @returns {Object} 返回一个IDBRequest对象
     */
    getStore(storeName, mode) {
        return this._dataBase.transaction(storeName, mode).objectStore(storeName);
    };

    /**
     * @description 用promise包装监听事件
     * @param {Object} req store上的IDBRequest对象
     * @param {Object} success 监听成功后抛出的结果
     * @param {Object} error 监听失败后抛出的结果
     * @returns {Object} promise
     */
    promisify(req, success, error) {
        return new Promise((resolve, reject)=> {
            req.onsuccess = ()=> resolve(success);
            req.onerror = ()=> reject(error);
        });
    };

    /**
     * @description 用promise包装监听事件
     * @param {Object} req store上的IDBRequest对象
     * @returns {Object} promise
     */
    promisifyRes(req) {
        return new Promise(resolve=> {
            req.onsuccess = ()=> resolve(req.result);
            req.onerror = ()=> resolve(undefined);
        });
    };

    /**
     * @description 执行一个事务
     * @param {String} storeName 目标store
     * @param {String} mode 插入的值
     * @param {String} action 动作
     * @param {String} params action的参数
     * @returns 返回事务对象
     */
    makeRequest(storeName, mode, action, ...params) {
        return this.getStore(storeName, mode)[action](...params);
    };

    /**
     * @description 插入单个值方法,key重复时会触发数据更新
     * @param {String} storeName 目标store
     * @param {Object} value 插入的值
     * @returns {Object} promise
     */
    async set(storeName, value) {
        // 获取当前存储表的keyPath
        const key = this.getStore(storeName, 'readonly').keyPath;
        const {setSuccess, setFail, setNoCorresponding} = errorCode;

        // 判断插入值是否存在与该store对应的key
        if (value.hasOwnProperty(key)) {
            const keys = await this.getAllKeys(storeName);

            if (keys.indexOf(value[key]) > -1) {
                // 已存在更新已有值
                return this.update(storeName, value);
            } else {
                // 未存在执行插入
                const req = this.makeRequest(storeName, 'readwrite', 'add', value);

                return this.promisify(req, setSuccess, setFail);
            }
        } else {
            return setNoCorresponding;
        }
    };

    /**
     * @description 批量插入数据方法
     * @param {String} storeName 目标store
     * @param {Array} list 数据数组
     * @returns {Object} promise
     */
    async setBatch(storeName, list) {
        const setList = [];
        const {setBatchSuccess, setBatchFail} = errorCode;

        for (const item of list) {
            setList.push(this.set(storeName, item));
        }

        const resList = await Promise.all(setList);

        return resList.length === list.length ? setBatchSuccess : setBatchFail;
    };

    /**
     * @description 更新值的方法
     * @param {String} storeName 目标store
     * @param {Object} newValue 新的值
     * @returns {Object} promise
     */
    update(storeName, newValue) {
        const req = this.makeRequest(storeName, 'readwrite', 'put', newValue);
        const {updateSuccess, updateFail} = errorCode;

        return this.promisify(req, updateSuccess, updateFail);
    };

    /**
     * @description 读取值的方法,读取不到时返回undefined
     * @param {String} storeName 目标store
     * @param {*} key 值的key
     * @returns {Object} promise
     */
    get(storeName, key) {
        const req = this.makeRequest(storeName, 'readonly', 'get', key);

        return this.promisifyRes(req);
    };

    /**
     * @description 读取store内所有值,读取不到时返回undefined
     * @param {String} storeName 目标store
     * @returns {Object} promise
     */
    getAll(storeName) {
        const req = this.makeRequest(storeName, 'readonly', 'getAll');

        return this.promisifyRes(req);
    };

    /**
     * @description 读取store内的所有key,读取不到时返回undefined
     * @param {String} storeName 目标store
     * @returns {Object} promise
     */
    getAllKeys(storeName) {
        const req = this.makeRequest(storeName, 'readonly', 'getAllKeys');

        return this.promisifyRes(req);
    };

    /**
     * @description 根据key删除值
     * @param {String} storeName 目标store
     * @param {*} key 要删除值的key
     * @returns {Object} promise
     */
    remove(storeName, key) {
        const req = this.makeRequest(storeName, 'readwrite', 'delete', key);
        const {removeSuccess, removeFail} = errorCode;

        return this.promisify(req, removeSuccess, removeFail);
    };

    /**
     * @description 清空store
     * @param {String} storeName 目标store
     * @returns {Object} promise
     */
    removeAll(storeName) {
        const req = this.makeRequest(storeName, 'readwrite', 'clear');
        const {removeAllSuccess, removeAllFail} = errorCode;

        return this.promisify(req, removeAllSuccess, removeAllFail);
    };
};